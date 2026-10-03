import type { RealtimeChannel } from '@supabase/supabase-js';
import { requireSupabase } from './supabase';

export type RtcKind = 'camera' | 'screen';
export type RtcRole = 'parent' | 'child';

type SignalRow = {
  id: string;
  child_id: string;
  session_id: string;
  sender_role: RtcRole;
  signal_type: 'offer' | 'answer' | 'ice';
  payload: any;
};

const turnUrls = String((import.meta.env as Record<string, string | undefined>).VITE_TURN_URLS || '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  ...(turnUrls.length ? [{
    urls: turnUrls,
    username: String((import.meta.env as Record<string, string | undefined>).VITE_TURN_USERNAME || ''),
    credential: String((import.meta.env as Record<string, string | undefined>).VITE_TURN_CREDENTIAL || ''),
  }] : []),
];

export class GuardKidsRtcSession {
  readonly sessionId: string;
  readonly kind: RtcKind;
  readonly role: RtcRole;
  private childId: string;
  private pc: RTCPeerConnection | null = null;
  private channel: RealtimeChannel | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private stream: MediaStream | null = null;
  private closed = false;
  private onRemoteStream?: (stream: MediaStream) => void;
  private onState?: (state: RTCPeerConnectionState) => void;

  private constructor(childId: string, kind: RtcKind, role: RtcRole, sessionId: string) {
    this.childId = childId;
    this.kind = kind;
    this.role = role;
    this.sessionId = sessionId;
  }

  private async insertSignal(signalType: SignalRow['signal_type'], payload: unknown) {
    const db = requireSupabase();
    const { error } = await db.from('rtc_signals').insert({
      child_id: this.childId, session_id: this.sessionId, sender_role: this.role, signal_type: signalType, payload,
    });
    if (error) throw error;
  }

  private async subscribe(onSignal: (row: SignalRow) => void) {
    const db = requireSupabase();
    this.channel = db.channel(`rtc-signal-${this.childId}-${this.sessionId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'rtc_signals',
        filter: `child_id=eq.${this.childId}`,
      }, (payload) => {
        const row = payload.new as SignalRow;
        if (row.session_id !== this.sessionId || row.sender_role === this.role || this.closed) return;
        onSignal(row);
      });
    await new Promise<void>((resolve, reject) => {
      this.channel!.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve();
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(`Realtime signaling ${status.toLowerCase()}.`));
      });
    });
  }

  private async addRemoteCandidate(candidate: RTCIceCandidateInit) {
    if (!this.pc) return;
    if (!this.pc.remoteDescription) {
      this.pendingCandidates.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(candidate);
    } catch (error) {
      console.warn('ICE candidate ignored', error);
    }
  }

  private async flushCandidates() {
    const pending = [...this.pendingCandidates];
    this.pendingCandidates = [];
    for (const candidate of pending) await this.addRemoteCandidate(candidate);
  }

  static async startParent(
    childId: string,
    kind: RtcKind,
    onRemoteStream: (stream: MediaStream) => void,
    onState?: (state: RTCPeerConnectionState) => void,
  ) {
    const session = new GuardKidsRtcSession(childId, kind, 'parent', crypto.randomUUID());
    session.onRemoteStream = onRemoteStream;
    session.onState = onState;
    await session.setupParent();
    return session;
  }

  private async setupParent() {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc = pc;
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) this.onRemoteStream?.(stream);
    };
    pc.onicecandidate = (event) => {
      if (event.candidate) this.insertSignal('ice', event.candidate.toJSON()).catch(console.error);
    };
    pc.onconnectionstatechange = () => this.onState?.(pc.connectionState);
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });

    await this.subscribe((row) => {
      if (row.signal_type === 'answer') this.handleAnswer(row.payload).catch(console.error);
      if (row.signal_type === 'ice') this.addRemoteCandidate(row.payload).catch(console.error);
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await this.insertSignal('offer', offer);
  }

  private async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.pc || this.pc.remoteDescription) return;
    await this.pc.setRemoteDescription(answer);
    await this.flushCandidates();
  }

  static async startChild(
    childId: string,
    sessionId: string,
    kind: RtcKind,
    stream: MediaStream,
    onState?: (state: RTCPeerConnectionState) => void,
  ) {
    const session = new GuardKidsRtcSession(childId, kind, 'child', sessionId);
    session.stream = stream;
    session.onState = onState;
    await session.setupChild();
    return session;
  }

  private async setupChild() {
    const db = requireSupabase();
    const { data: offers, error } = await db.from('rtc_signals').select('*')
      .eq('child_id', this.childId).eq('session_id', this.sessionId).eq('signal_type', 'offer')
      .order('created_at', { ascending: false }).limit(1);
    if (error) throw error;
    const offer = offers?.[0]?.payload as RTCSessionDescriptionInit | undefined;
    if (!offer) throw new Error('Permintaan media sudah kedaluwarsa. Minta sesi baru.');

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc = pc;
    pc.onicecandidate = (event) => {
      if (event.candidate) this.insertSignal('ice', event.candidate.toJSON()).catch(console.error);
    };
    pc.onconnectionstatechange = () => this.onState?.(pc.connectionState);
    for (const track of this.stream!.getTracks()) pc.addTrack(track, this.stream!);

    await this.subscribe((row) => {
      if (row.signal_type === 'ice') this.addRemoteCandidate(row.payload).catch(console.error);
    });

    await pc.setRemoteDescription(offer);
    const { data: existingIce, error: iceError } = await db.from('rtc_signals').select('payload')
      .eq('child_id', this.childId).eq('session_id', this.sessionId).eq('signal_type', 'ice').eq('sender_role', 'parent').order('created_at');
    if (iceError) throw iceError;
    for (const row of existingIce || []) await this.addRemoteCandidate(row.payload as RTCIceCandidateInit);
    await this.flushCandidates();
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await this.insertSignal('answer', answer);
  }

  getMediaStream(): MediaStream | null {
    return this.stream;
  }

  stop() {
    this.closed = true;
    this.channel?.unsubscribe();
    this.channel = null;
    this.pc?.getSenders().forEach((sender) => sender.track?.stop());
    this.pc?.close();
    this.pc = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }
}

export async function captureCamera(facing: 'front' | 'back'): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Kamera tidak tersedia di browser ini.');
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: facing === 'front' ? 'user' : { ideal: 'environment' },
      width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 },
    },
  });
}

export async function captureScreen(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('Screen sharing tidak tersedia di browser ini.');
  return navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
}

export async function setTorch(stream: MediaStream, enabled: boolean): Promise<boolean> {
  const track = stream.getVideoTracks()[0];
  if (!track) return false;
  const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
  if (!capabilities?.torch) return false;
  await track.applyConstraints({ advanced: [{ torch: enabled } as MediaTrackConstraintSet] });
  return true;
}
