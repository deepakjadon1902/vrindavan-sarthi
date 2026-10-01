package in.vrindavansarthi.alarm;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public final class VrsAppUpdateManager {
    private static final String TAG = "VrsAppUpdate";
    private static final String PREFS = "vrs_app_update";
    private static final String APK_FILE_NAME = "vrindavan-sarthi-update.apk";
    private static final long CHECK_INTERVAL_MS = 6L * 60L * 60L * 1000L;

    private VrsAppUpdateManager() {}

    public static void checkForUpdates(Activity activity, boolean forceCheck) {
        if (activity == null) return;
        SharedPreferences prefs = activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        long now = System.currentTimeMillis();
        long lastCheckAt = prefs.getLong("lastCheckAt", 0L);
        if (!forceCheck && now - lastCheckAt < CHECK_INTERVAL_MS) return;
        prefs.edit().putLong("lastCheckAt", now).apply();

        new Thread(() -> {
            try {
                UpdateInfo update = fetchUpdateInfo(BuildConfig.UPDATE_MANIFEST_URL);
                if (update.versionCode <= BuildConfig.VERSION_CODE || update.apkUrl.isEmpty()) {
                    Log.d(TAG, "No APK update available");
                    return;
                }
                activity.runOnUiThread(() -> startDownload(activity, update));
            } catch (Exception error) {
                Log.w(TAG, "APK update check failed", error);
            }
        }).start();
    }

    private static UpdateInfo fetchUpdateInfo(String manifestUrl) throws Exception {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(manifestUrl);
            conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);
            conn.setRequestProperty("Accept", "application/json");
            int status = conn.getResponseCode();
            if (status < 200 || status >= 300) throw new IllegalStateException("Update manifest HTTP " + status);

            StringBuilder json = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) json.append(line);
            }

            JSONObject root = new JSONObject(json.toString());
            String apkUrl = root.optString("apkUrl", "");
            if (apkUrl.startsWith("/")) {
                apkUrl = url.getProtocol() + "://" + url.getHost() + apkUrl;
            }
            return new UpdateInfo(
                root.optInt("versionCode", 0),
                root.optString("versionName", ""),
                apkUrl,
                root.optString("releaseNotes", ""),
                root.optBoolean("force", false)
            );
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static void startDownload(Activity activity, UpdateInfo update) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !activity.getPackageManager().canRequestPackageInstalls()) {
                Toast.makeText(activity, "Allow Vrindavan Sarthi to install app updates", Toast.LENGTH_LONG).show();
                activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putLong("lastCheckAt", 0L).apply();
                Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                intent.setData(Uri.parse("package:" + activity.getPackageName()));
                activity.startActivity(intent);
                return;
            }

            File updateDir = new File(activity.getExternalFilesDir(null), "updates");
            if (!updateDir.exists() && !updateDir.mkdirs()) {
                Toast.makeText(activity, "Could not prepare update download", Toast.LENGTH_LONG).show();
                return;
            }
            File apkFile = new File(updateDir, APK_FILE_NAME);
            if (apkFile.exists() && !apkFile.delete()) {
                Log.w(TAG, "Could not replace old APK update file");
            }

            DownloadManager manager = (DownloadManager) activity.getSystemService(Context.DOWNLOAD_SERVICE);
            if (manager == null) {
                Toast.makeText(activity, "Download manager is unavailable", Toast.LENGTH_LONG).show();
                return;
            }

            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(update.apkUrl));
            request.setTitle("Vrindavan Sarthi update " + update.versionName);
            request.setDescription(update.releaseNotes.isEmpty() ? "Downloading app update" : update.releaseNotes);
            request.setMimeType("application/vnd.android.package-archive");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationUri(Uri.fromFile(apkFile));

            long downloadId = manager.enqueue(request);
            Toast.makeText(activity, "Downloading Vrindavan Sarthi update", Toast.LENGTH_LONG).show();

            BroadcastReceiver receiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    long completedId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
                    if (completedId != downloadId) return;
                    try {
                        context.unregisterReceiver(this);
                    } catch (Exception ignored) {
                    }
                    installDownloadedApk(activity, apkFile);
                }
            };
            IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                activity.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                activity.registerReceiver(receiver, filter);
            }
        } catch (Exception error) {
            Log.e(TAG, "APK update download failed", error);
            Toast.makeText(activity, "Could not download app update", Toast.LENGTH_LONG).show();
        }
    }

    private static void installDownloadedApk(Activity activity, File apkFile) {
        if (!apkFile.exists()) {
            Toast.makeText(activity, "App update download failed", Toast.LENGTH_LONG).show();
            return;
        }
        Uri apkUri = FileProvider.getUriForFile(
            activity,
            activity.getPackageName() + ".fileprovider",
            apkFile
        );
        Intent installIntent = new Intent(Intent.ACTION_VIEW);
        installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
        installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        activity.startActivity(installIntent);
    }

    private static final class UpdateInfo {
        final int versionCode;
        final String versionName;
        final String apkUrl;
        final String releaseNotes;
        final boolean force;

        UpdateInfo(int versionCode, String versionName, String apkUrl, String releaseNotes, boolean force) {
            this.versionCode = versionCode;
            this.versionName = versionName;
            this.apkUrl = apkUrl == null ? "" : apkUrl.trim();
            this.releaseNotes = releaseNotes == null ? "" : releaseNotes.trim();
            this.force = force;
        }
    }
}
