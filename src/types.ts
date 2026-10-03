export type ScreenStatus = 'unlocked' | 'locked_bedtime' | 'locked_limit' | 'locked_manual';

export interface LocationPoint {
  id: string;
  time: string;
  address: string;
  lat: number;
  lng: number;
  battery: number;
}

export interface SafeZone {
  id: string;
  name: string;
  address: string;
  radiusMeters: number;
  lat: number;
  lng: number;
  isInside: boolean;
  type: 'home' | 'school' | 'other';
}

export interface AppUsageItem {
  id: string;
  name: string;
  packageName: string;
  category: 'games' | 'social' | 'education' | 'entertainment' | 'system';
  minutesToday: number;
  dailyLimitMinutes: number;
  isBlocked: boolean;
  iconName: string;
}

export interface AlertNotification {
  id: string;
  timestamp: string;
  type: 'geofence' | 'battery' | 'screen_time' | 'request' | 'sos';
  title: string;
  message: string;
  isRead: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface TimeRequest {
  id: string;
  timestamp: string;
  childId: string;
  childName: string;
  appName?: string;
  requestedMinutes: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface MediaItem {
  id: string;
  filename: string;
  timestamp: string;
  category: 'camera' | 'screenshot' | 'whatsapp' | 'download';
  mediaType?: 'image' | 'video';
  duration?: string;
  videoUrl?: string;
  title: string;
  imageUrl: string;
  aiSafetyScore: 'safe' | 'warning' | 'flagged';
  aiSafetyTag: string;
  fileSize: string;
}

export interface ChildDevice {
  id: string;
  name: string;
  age: number;
  avatarColor: string;
  deviceModel: string;
  osVersion: string;
  batteryLevel: number;
  isCharging: boolean;
  networkType: 'WiFi' | '4G' | '5G';
  wifiSSID: string;
  isOnline: boolean;
  lastSyncTime: string;
  screenStatus: ScreenStatus;
  lockMessage?: string;
  todayScreenTimeMinutes: number;
  screenTimeDate: string;
  screenTimeLimitMinutes: number;
  bedtimeStart: string;
  bedtimeEnd: string;
  isBedtimeEnabled: boolean;
  currentCoordinates: {
    lat: number;
    lng: number;
    address: string;
    accuracy: number;
    timestamp: string;
  };
  locationHistory: LocationPoint[];
  safeZones: SafeZone[];
  appUsages: AppUsageItem[];
  pairingCode: string;
  isScreenMirroringActive?: boolean;
  isScreenMirroringRequested?: boolean;
  isCameraActive?: boolean;
  cameraFacing?: 'front' | 'back';
  isFlashlightOn?: boolean;
  galleryItems?: MediaItem[];
  companionPermissions: {
    camera?: boolean;
    microphone?: boolean;
    location: boolean;
    gallery?: boolean;
    galleryFull?: boolean;
    galleryPartial?: boolean;
    notifications?: boolean;
    usageStats: boolean;
    notificationAccess: boolean;
    deviceAdmin: boolean;
    batteryOptimization: boolean;
  };
}
