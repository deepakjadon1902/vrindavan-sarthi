package in.vrindavansarthi.alarm;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public class VrsFirebaseMessagingService extends FirebaseMessagingService {
    public static final String CHANNEL_ID = "booking_alarm";

    @Override
    public void onNewToken(String token) {
        NativeDeviceRegistrar.saveFcmToken(this, token);
        String jwt = NativeDeviceRegistrar.getJwt(this);
        if (!jwt.isEmpty()) {
            NativeDeviceRegistrar.register(BuildConfig.API_BASE_URL, jwt, getNativeDeviceId(), token);
        }
    }

    @Override
    public void onMessageReceived(RemoteMessage message) {
        ensureAlarmChannel(this);
        Map<String, String> data = message.getData();
        String title = value(data, "title", "Vrindavan Sarthi booking alert");
        String body = value(data, "body", "A booking notification is waiting.");
        String notificationId = value(data, "notificationId", String.valueOf(System.currentTimeMillis()));

        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
            this,
            notificationId.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Uri alarmUri = defaultAlarmUri();
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_vrs_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setVibrate(new long[]{0, 700, 200, 700, 200, 1000})
            .setSound(alarmUri)
            .setContentIntent(contentIntent)
            .setFullScreenIntent(contentIntent, true)
            .addAction(R.drawable.ic_vrs_notification, "View Booking", contentIntent);

        NotificationManagerCompat.from(this).notify(notificationId.hashCode(), builder.build());
    }

    public static void ensureAlarmChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;
        Uri alarmUri = defaultAlarmUri();
        AudioAttributes audioAttributes = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Booking Alarm",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Critical booking alarms for admins and partners");
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[]{0, 700, 200, 700, 200, 1000});
        channel.setSound(alarmUri, audioAttributes);
        channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        manager.createNotificationChannel(channel);
    }

    private static Uri defaultAlarmUri() {
        Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        return alarmUri != null ? alarmUri : RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
    }

    private static String value(Map<String, String> data, String key, String fallback) {
        String value = data == null ? null : data.get(key);
        return value == null || value.trim().isEmpty() ? fallback : value;
    }

    private String getNativeDeviceId() {
        String androidId = android.provider.Settings.Secure.getString(getContentResolver(), android.provider.Settings.Secure.ANDROID_ID);
        return "android-native-" + (androidId == null ? "unknown" : androidId);
    }
}
