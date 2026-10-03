#!/usr/bin/env bash
set -euo pipefail

APP_DIR="android/app/src/main"
JAVA_DIR="$APP_DIR/java/com/guardkids/app"
mkdir -p "$JAVA_DIR"

cat > "$JAVA_DIR/GuardianNativePlugin.java" <<'JAVA'
package com.guardkids.app;

import android.Manifest;
import android.content.ContentResolver;
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

MAIN="$JAVA_DIR/MainActivity.java"
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
'android.permission.CAMERA','android.permission.RECORD_AUDIO',
'android.permission.ACCESS_FINE_LOCATION','android.permission.ACCESS_COARSE_LOCATION',
'android.permission.POST_NOTIFICATIONS','android.permission.READ_MEDIA_IMAGES',
'android.permission.READ_MEDIA_VIDEO','android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
]
for perm in perms:
    line=f'    <uses-permission android:name="{perm}" />'
    if line not in s:
        s=s.replace('<application', line+'\n    <application',1)
legacy='    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />'
if legacy not in s:
    s=s.replace('<application', legacy+'\n    <application',1)
p.write_text(s)
PY
fi
