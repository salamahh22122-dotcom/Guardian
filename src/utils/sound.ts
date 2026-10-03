// Web Audio API Synthesizer for alerts and device ring feature

class SoundEffects {
  private ctx: AudioContext | null = null;

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Play Find My Phone ring tone
  playRing(durationMs = 4000) {
    const ctx = this.initCtx();
    if (!ctx) return;

    const startTime = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    
    // Play melody cycles
    const repetitions = Math.floor(durationMs / 800);
    for (let r = 0; r < repetitions; r++) {
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime + r * 0.8 + idx * 0.18);
        
        gain.gain.setValueAtTime(0, startTime + r * 0.8 + idx * 0.18);
        gain.gain.linearRampToValueAtTime(0.25, startTime + r * 0.8 + idx * 0.18 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + r * 0.8 + idx * 0.18 + 0.16);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime + r * 0.8 + idx * 0.18);
        osc.stop(startTime + r * 0.8 + idx * 0.18 + 0.17);
      });
    }
  }

  // Emergency SOS alarm sound
  playSOS() {
    const ctx = this.initCtx();
    if (!ctx) return;

    const startTime = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      
      const noteStart = startTime + i * 0.45;
      osc.frequency.setValueAtTime(880, noteStart); // A5
      osc.frequency.linearRampToValueAtTime(1200, noteStart + 0.2);
      osc.frequency.linearRampToValueAtTime(880, noteStart + 0.4);

      gain.gain.setValueAtTime(0.3, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.01, noteStart + 0.42);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(noteStart);
      osc.stop(noteStart + 0.44);
    }
  }

  // Soft notification chime
  playNotify() {
    const ctx = this.initCtx();
    if (!ctx) return;

    const startTime = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, startTime); // D5
    osc.frequency.setValueAtTime(880, startTime + 0.1); // A5

    gain.gain.setValueAtTime(0.2, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + 0.36);
  }
}

export const sounds = new SoundEffects();
