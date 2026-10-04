import { Capacitor, registerPlugin } from '@capacitor/core';

export type GuardianPermissionState = {
  camera: boolean;
  microphone: boolean;
  location: boolean;
  notifications: boolean;
  gallery: boolean;
  galleryFull: boolean;
  galleryPartial: boolean;
};

export type NativeGalleryItem = {
  sourceId: string;
  uri: string;
  filename: string;
  mimeType: string;
  createdAt: number;
  size: number;
  mediaType: 'image' | 'video';
  thumbnail: string;
};

export interface GuardianNativePlugin {
  requestPermissions(): Promise<GuardianPermissionState>;
  getPermissionStatus(): Promise<GuardianPermissionState>;
  requestGalleryPermissions(): Promise<GuardianPermissionState>;
  startConnection(options: { childId: string; sessionToken: string }): Promise<void>;
  stopConnection(): Promise<void>;
  hideApp(): Promise<{ hidden: boolean }>;
  showApp(): Promise<{ hidden: boolean }>;
  getGallery(options?: { limit?: number }): Promise<{ items: NativeGalleryItem[]; permission: GuardianPermissionState }>;
  readMedia(options: { uri: string }): Promise<{ mimeType: string; filename: string; base64: string }>;
}

export const GuardianNative = registerPlugin<GuardianNativePlugin>('GuardianNative');

export const isNativeAndroid = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
