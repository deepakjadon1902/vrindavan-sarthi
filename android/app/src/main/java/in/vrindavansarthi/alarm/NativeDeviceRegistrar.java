package in.vrindavansarthi.alarm;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public final class NativeDeviceRegistrar {
    private static final String PREFS = "vrs_native_alarm";
    private static final String TAG = "VrsNativeAlarm";
    private NativeDeviceRegistrar() {}

    public static void saveFcmToken(Context context, String token) {
        prefs(context).edit().putString("fcmToken", token == null ? "" : token).apply();
    }

    public static void saveJwt(Context context, String jwt) {
        prefs(context).edit().putString("jwt", jwt == null ? "" : jwt).apply();
    }

    public static String getJwt(Context context) {
        return prefs(context).getString("jwt", "");
    }

    public static String getFcmToken(Context context) {
        return prefs(context).getString("fcmToken", "");
    }

    public static String extractJwtFromLocalStorageValue(String encodedValue) {
        try {
            if (encodedValue == null || encodedValue.equals("null")) return "";
            String value = encodedValue;
            if (value.startsWith("\"") && value.endsWith("\"")) {
                value = value.substring(1, value.length() - 1)
                    .replace("\\\"", "\"")
                    .replace("\\\\", "\\");
            }
            JSONObject root = new JSONObject(value);
            JSONObject state = root.optJSONObject("state");
            return state == null ? "" : state.optString("token", "");
        } catch (Exception ignored) {
            return "";
        }
    }

    public static void register(String apiBaseUrl, String jwt, String deviceId, String fcmToken) {
        if (apiBaseUrl == null || jwt == null || deviceId == null || fcmToken == null) return;
        if (apiBaseUrl.isEmpty() || jwt.isEmpty() || deviceId.isEmpty() || fcmToken.isEmpty()) return;
        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                URL url = new URL(apiBaseUrl.replaceAll("/+$", "") + "/notifications/devices");
                Log.d(TAG, "Registering native device at " + url);
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(15000);
                conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("Authorization", "Bearer " + jwt);
                JSONObject body = new JSONObject();
                body.put("deviceId", deviceId);
                body.put("platform", "Android native");
                body.put("browser", "Vrindavan Sarthi Android App");
                body.put("userAgent", "VrindavanSarthiAndroid");
                body.put("permissionStatus", "granted");
                body.put("notificationEnabled", true);
                body.put("alarmEnabled", true);
                body.put("appPlatform", "android_native");
                body.put("fcmToken", fcmToken);
                byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(bytes);
                }
                int status = conn.getResponseCode();
                Log.d(TAG, "Native device registration status=" + status);
            } catch (Exception error) {
                Log.e(TAG, "Native device registration failed", error);
                // Registration retries on next page load or FCM token refresh.
            } finally {
                if (conn != null) conn.disconnect();
            }
        }).start();
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
