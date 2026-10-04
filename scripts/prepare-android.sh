#!/usr/bin/env bash
set -euo pipefail

APP_DIR="android/app/src/main"
JAVA_DIR="$APP_DIR/java/com/guardkids/app"
mkdir -p "$JAVA_DIR"

cat > "$JAVA_DIR/GuardianNativePlugin.java" <<'JAVA'
package com.guardkids.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Base64;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PluginMethod;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;

@CapacitorPlugin(name = "GuardianNative", permissions = {
  @Permission(alias = "camera", strings = { Manifest.permission.CAMERA }),
  @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }),
  @Permission(alias = "location", strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }),
  @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }),
  @Permission(alias = "mediaModern", strings = { Manifest.permission.READ_MEDIA_IMAGES, Manifest.permission.READ_MEDIA_VIDEO, Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED }),
  @Permission(alias = "mediaLegacy", strings = { Manifest.permission.READ_EXTERNAL_STORAGE })
})
public class GuardianNativePlugin extends Plugin {
  @PluginMethod
  public void requestPermissions(PluginCall call) {
    ArrayList<String> aliases = new ArrayList<>();
    aliases.add("camera");
    aliases.add("microphone");
    aliases.add("location");
    if (Build.VERSION.SDK_INT >= 33) {
      aliases.add("mediaModern");
      aliases.add("notifications");
    } else {
      aliases.add("mediaLegacy");
    }
    requestPermissionForAliases(aliases.toArray(new String[0]), call, "permissionCallback");
  }

  @PermissionCallback
  private void permissionCallback(PluginCall call) {
    call.resolve(getPermissionState());
  }

  @PluginMethod
  public void requestGalleryPermissions(PluginCall call) {
    if (Build.VERSION.SDK_INT >= 33) {
      requestPermissionForAlias("mediaModern", call, "galleryPermissionCallback");
    } else {
      requestPermissionForAlias("mediaLegacy", call, "galleryPermissionCallback");
    }
  }

  @PermissionCallback
  private void galleryPermissionCallback(PluginCall call) {
    call.resolve(getPermissionState());
  }

  @PluginMethod
  public void getPermissionStatus(PluginCall call) {
    call.resolve(getPermissionState());
  }

  private JSObject getPermissionState() {
    JSObject out = new JSObject();
    out.put("camera", granted(Manifest.permission.CAMERA));
    out.put("microphone", granted(Manifest.permission.RECORD_AUDIO));
    out.put("location", granted(Manifest.permission.ACCESS_FINE_LOCATION) || granted(Manifest.permission.ACCESS_COARSE_LOCATION));
    out.put("notifications", Build.VERSION.SDK_INT < 33 || granted(Manifest.permission.POST_NOTIFICATIONS));
    boolean galleryFull;
    boolean galleryPartial = false;
    if (Build.VERSION.SDK_INT >= 33) {
      galleryFull = granted(Manifest.permission.READ_MEDIA_IMAGES) || granted(Manifest.permission.READ_MEDIA_VIDEO);
      if (Build.VERSION.SDK_INT >= 34) {
        galleryPartial = granted(Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED) && !galleryFull;
      }
    } else {
      galleryFull = granted(Manifest.permission.READ_EXTERNAL_STORAGE);
    }
    out.put("gallery", galleryFull || galleryPartial);
    out.put("galleryFull", galleryFull);
    out.put("galleryPartial", galleryPartial);
    return out;
  }

  private boolean granted(String permission) {
    return ContextCompat.checkSelfPermission(getContext(), permission) == PackageManager.PERMISSION_GRANTED;
  }

  @PluginMethod
  public void startConnection(PluginCall call) {
    String childId = call.getString("childId", "");
    String token = call.getString("sessionToken", "");
    if (childId.isEmpty() || token.isEmpty()) {
      call.reject("Identitas perangkat tidak lengkap");
      return;
    }
    Intent intent = new Intent(getContext(), GuardianConnectionService.class);
    intent.putExtra("child_id", childId);
    intent.putExtra("session_token", token);
    if (Build.VERSION.SDK_INT >= 26) getContext().startForegroundService(intent);
    else getContext().startService(intent);
    call.resolve();
  }

  @PluginMethod
  public void stopConnection(PluginCall call) {
    getContext().stopService(new Intent(getContext(), GuardianConnectionService.class));
    call.resolve();
  }

  @PluginMethod
  public void getGallery(PluginCall call) {
    if (!hasGalleryPermission()) {
      call.reject("Izin galeri belum diberikan");
      return;
    }
    int limit = Math.max(1, Math.min(call.getInt("limit", 50), 100));
    ContentResolver resolver = getContext().getContentResolver();
    Uri collection = MediaStore.Files.getContentUri("external");
    String[] projection = {
      MediaStore.Files.FileColumns._ID,
      MediaStore.Files.FileColumns.DISPLAY_NAME,
      MediaStore.Files.FileColumns.MIME_TYPE,
      MediaStore.Files.FileColumns.DATE_ADDED,
      MediaStore.Files.FileColumns.SIZE,
      MediaStore.Files.FileColumns.MEDIA_TYPE
    };
    String selection = MediaStore.Files.FileColumns.MEDIA_TYPE + "=? OR " + MediaStore.Files.FileColumns.MEDIA_TYPE + "=?";
    String[] args = {
      String.valueOf(MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE),
      String.valueOf(MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO)
    };
    JSArray medias = new JSArray();
    try (Cursor cursor = resolver.query(collection, projection, selection, args, MediaStore.Files.FileColumns.DATE_ADDED + " DESC")) {
      if (cursor != null) {
        int idCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns._ID);
        int nameCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DISPLAY_NAME);
        int mimeCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.MIME_TYPE);
        int dateCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DATE_ADDED);
        int sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.SIZE);
        int typeCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.MEDIA_TYPE);
        int count = 0;
        while (cursor.moveToNext() && count < limit) {
          long id = cursor.getLong(idCol);
          String mime = cursor.getString(mimeCol);
          Uri uri = (MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE == cursor.getInt(typeCol))
              ? Uri.withAppendedPath(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, String.valueOf(id))
              : Uri.withAppendedPath(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, String.valueOf(id));
          JSObject item = new JSObject();
          item.put("sourceId", uri.toString());
          item.put("uri", uri.toString());
          item.put("filename", cursor.getString(nameCol));
          item.put("mimeType", mime == null ? "application/octet-stream" : mime);
          item.put("createdAt", cursor.getLong(dateCol) * 1000L);
          item.put("size", cursor.getLong(sizeCol));
          item.put("mediaType", mime != null && mime.startsWith("video/") ? "video" : "image");
          item.put("thumbnail", thumbnail(resolver, uri));
          medias.put(item);
          count++;
        }
      }
      JSObject result = new JSObject();
      result.put("items", medias);
      result.put("permission", getPermissionState());
      call.resolve(result);
    } catch (Exception e) {
      call.reject("Gagal membaca galeri: " + e.getMessage());
    }
  }

  private boolean hasGalleryPermission() {
    if (Build.VERSION.SDK_INT >= 33) {
      return granted(Manifest.permission.READ_MEDIA_IMAGES)
          || granted(Manifest.permission.READ_MEDIA_VIDEO)
          || (Build.VERSION.SDK_INT >= 34 && granted(Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED));
    }
    return granted(Manifest.permission.READ_EXTERNAL_STORAGE);
  }

  private String thumbnail(ContentResolver resolver, Uri uri) {
    try {
      Bitmap bitmap;
      if (Build.VERSION.SDK_INT >= 29) {
        bitmap = resolver.loadThumbnail(uri, new android.util.Size(480, 480), null);
      } else {
        try (InputStream in = resolver.openInputStream(uri)) {
          bitmap = BitmapFactory.decodeStream(in);
        }
      }
      if (bitmap == null) return "";
      ByteArrayOutputStream out = new ByteArrayOutputStream();
      bitmap.compress(Bitmap.CompressFormat.JPEG, 72, out);
      bitmap.recycle();
      return "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
    } catch (Exception e) {
      return "";
    }
  }

  @PluginMethod
  public void readMedia(PluginCall call) {
    String uriText = call.getString("uri", "");
    if (uriText.isEmpty()) {
      call.reject("URI media kosong");
      return;
    }
    try {
      Uri uri = Uri.parse(uriText);
      ContentResolver resolver = getContext().getContentResolver();
      String mime = resolver.getType(uri);
      String name = uri.getLastPathSegment() == null ? "media" : "media_" + uri.getLastPathSegment();
      ByteArrayOutputStream out = new ByteArrayOutputStream();
      try (InputStream in = resolver.openInputStream(uri)) {
        if (in == null) throw new IllegalStateException("Media tidak dapat dibaca");
        byte[] buffer = new byte[16384];
        int read;
        while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
      }
      JSObject result = new JSObject();
      result.put("mimeType", mime == null ? "application/octet-stream" : mime);
      result.put("filename", name);
      result.put("base64", Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
      call.resolve(result);
    } catch (Exception e) {
      call.reject("Gagal membaca media: " + e.getMessage());
    }
  }
}
JAVA

cat > "$JAVA_DIR/GuardianConnectionService.java" <<'JAVA'
package com.guardkids.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.util.Log;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class GuardianConnectionService extends Service {
  private static final String CHANNEL_ID = "guardkids_connection";
  private static final int NOTIFICATION_ID = 4101;
  private static final long INTERVAL_MS = 30000L;
  private final Handler handler = new Handler();
  private final Runnable heartbeat = new Runnable() {
    @Override public void run() {
      sendHeartbeat();
      handler.postDelayed(this, INTERVAL_MS);
    }
  };

  @Override public void onCreate() {
    super.onCreate();
    createChannel();
    Notification.Builder builder = Build.VERSION.SDK_INT >= 26
      ? new Notification.Builder(this, CHANNEL_ID)
      : new Notification.Builder(this);
    Notification notification = builder
      .setSmallIcon(android.R.drawable.ic_popup_sync)
      .setContentTitle("GuardKids")
      .setContentText("Perangkat anak tetap terhubung")
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .build();
    if (Build.VERSION.SDK_INT >= 29) {
      startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC | android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA);
    } else {
      startForeground(NOTIFICATION_ID, notification);
    }
  }

  @Override public int onStartCommand(Intent intent, int flags, int startId) {
    if (intent != null) {
      String childId = intent.getStringExtra("child_id");
      String token = intent.getStringExtra("session_token");
      if (childId != null && token != null) {
        getSharedPreferences("guardkids_connection", MODE_PRIVATE).edit()
          .putString("child_id", childId).putString("session_token", token).apply();
      }
    }
    handler.removeCallbacks(heartbeat);
    handler.post(heartbeat);
    return START_STICKY;
  }

  private void sendHeartbeat() {
    String childId = getSharedPreferences("guardkids_connection", MODE_PRIVATE).getString("child_id", "");
    String token = getSharedPreferences("guardkids_connection", MODE_PRIVATE).getString("session_token", "");
    if (childId.isEmpty() || token.isEmpty()) return;
    HttpURLConnection connection = null;
    try {
      URL url = new URL("https://mxrffgfdygkawbzhrhbt.supabase.co/rest/v1/rpc/guardkids_heartbeat");
      connection = (HttpURLConnection) url.openConnection();
      connection.setRequestMethod("POST");
      connection.setConnectTimeout(10000);
      connection.setReadTimeout(10000);
      connection.setRequestProperty("Content-Type", "application/json");
      connection.setRequestProperty("apikey", "sb_publishable_dGi335AHTBTqiihiYd-EIA_956EnECY");
      connection.setRequestProperty("x-guardkids-session", token);
      connection.setDoOutput(true);
      byte[] body = ("{\"p_child_id\":\"" + childId + "\"}").getBytes(StandardCharsets.UTF_8);
      try (OutputStream out = connection.getOutputStream()) { out.write(body); }
      int code = connection.getResponseCode();
      if (code >= 200 && code < 300) {
        StringBuilder response = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
          String line; while ((line = reader.readLine()) != null) response.append(line);
        }
        if (response.toString().contains("false")) stopSelf();
      } else if (code == 401 || code == 403 || code == 404 || code == 409) {
        stopSelf();
      }
    } catch (Exception e) {
      Log.w("GuardKids", "Heartbeat failed", e);
    } finally {
      if (connection != null) connection.disconnect();
    }
  }

  private void createChannel() {
    if (Build.VERSION.SDK_INT >= 26) {
      NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Koneksi perangkat", NotificationManager.IMPORTANCE_LOW);
      channel.setDescription("Menjaga koneksi perangkat anak tetap aktif saat aplikasi ditutup.");
      channel.setShowBadge(false);
      NotificationManager manager = getSystemService(NotificationManager.class);
      if (manager != null) manager.createNotificationChannel(channel);
    }
  }

  @Override public void onTaskRemoved(Intent rootIntent) {
    // Keep the connection service alive when the WebView task is swiped away.
    super.onTaskRemoved(rootIntent);
  }

  @Override public void onDestroy() {
    handler.removeCallbacksAndMessages(null);
    super.onDestroy();
  }

  @Override public IBinder onBind(Intent intent) { return null; }
}
JAVA

MAIN="$JAVA_DIR/MainActivity.java"
if [ ! -f "$MAIN" ]; then
cat > "$MAIN" <<'JAVA'
package com.guardkids.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;

import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;
import com.guardkids.app.GuardianNativePlugin;

public class MainActivity extends BridgeActivity {
  public MainActivity() { registerPlugin(GuardianNativePlugin.class); }
  @Override
  public void onCreate(android.os.Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    installGuardianWebPermissions();
  }

  private void installGuardianWebPermissions() {
    WebView webView = getBridge().getWebView();
    super.onStart();
    final WebChromeClient existing = webView.getWebChromeClient();
    webView.setWebChromeClient(new WebChromeClient() {
      @Override
      public void onPermissionRequest(final PermissionRequest request) {
        runOnUiThread(() -> {
          String[] resources = request.getResources();
          boolean camera = false;
          boolean microphone = false;
          for (String resource : resources) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) camera = true;
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) microphone = true;
          }
          boolean cameraGranted = !camera || ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
          boolean microphoneGranted = !microphone || ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
          if (cameraGranted && microphoneGranted) request.grant(resources);
          else request.deny();
        });
      }
    });
  }

  @Override
  public void onStart() {
    super.onStart();
    installGuardianWebPermissions();
  }
}
JAVA
fi

if [ -f "$MAIN" ] && ! grep -q "GuardianNativePlugin" "$MAIN"; then
  python3 - "$MAIN" <<'PY'
from pathlib import Path
p=Path(__import__('sys').argv[1])
s=p.read_text()
s=s.replace('import com.getcapacitor.BridgeActivity;', 'import com.getcapacitor.BridgeActivity;\nimport com.guardkids.app.GuardianNativePlugin;')
s=s.replace('public class MainActivity extends BridgeActivity {', 'public class MainActivity extends BridgeActivity {\n  public MainActivity() { registerPlugin(GuardianNativePlugin.class); }')
p.write_text(s)
PY
fi

MANIFEST="android/app/src/main/AndroidManifest.xml"
if [ -f "$MANIFEST" ]; then
  python3 - "$MANIFEST" <<'PY'
from pathlib import Path
p=Path(__import__('sys').argv[1])
s=p.read_text()
perms=[
'android.permission.CAMERA',
'android.permission.RECORD_AUDIO',
'android.permission.MODIFY_AUDIO_SETTINGS',
'android.permission.ACCESS_FINE_LOCATION',
'android.permission.ACCESS_COARSE_LOCATION',
'android.permission.POST_NOTIFICATIONS',
'android.permission.READ_MEDIA_IMAGES',
'android.permission.READ_MEDIA_VIDEO',
'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
'android.permission.FOREGROUND_SERVICE',
'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
'android.permission.FOREGROUND_SERVICE_CAMERA',
]
for perm in perms:
    line=f'    <uses-permission android:name="{perm}" />'
    if line not in s:
        marker='<application'
        s=s.replace(marker, line+'\n    '+marker, 1)
legacy='    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />'
if legacy not in s:
    s=s.replace('<application', legacy+'\n    <application', 1)
feature_camera='    <uses-feature android:name="android.hardware.camera" android:required="false" />'
feature_autofocus='    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />'
if feature_camera not in s:
    s=s.replace('<application', feature_camera+'\n    <application', 1)
if feature_autofocus not in s:
    s=s.replace('<application', feature_autofocus+'\n    <application', 1)
service='      <service android:name=".GuardianConnectionService" android:exported="false" android:foregroundServiceType="dataSync|camera" />'
if service not in s:
    s=s.replace('</application>', service+'\n    </application>', 1)
p.write_text(s)
PY
fi
