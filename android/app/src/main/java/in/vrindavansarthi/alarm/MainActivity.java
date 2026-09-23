package in.vrindavansarthi.alarm;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.google.firebase.messaging.FirebaseMessaging;

public class MainActivity extends AppCompatActivity {
    private WebView webView;
    private String fcmToken = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        VrsFirebaseMessagingService.ensureAlarmChannel(this);
        requestNotificationPermission();
        setupWebView();
        FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token -> {
            fcmToken = token == null ? "" : token;
            NativeDeviceRegistrar.saveFcmToken(this, fcmToken);
            tryRegisterNativeDevice();
        });
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        webView = new WebView(this);
        setContentView(webView);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                tryRegisterNativeDevice();
            }
        });
        webView.loadUrl(BuildConfig.APP_URL);
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT < 33) return;
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return;
        ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, 108);
    }

    private void tryRegisterNativeDevice() {
        if (webView == null || fcmToken == null || fcmToken.isEmpty()) return;
        webView.evaluateJavascript(
            "(function(){try{return localStorage.getItem('vvs-auth')||'';}catch(e){return '';}})();",
            value -> {
                String jwt = NativeDeviceRegistrar.extractJwtFromLocalStorageValue(value);
                if (jwt.isEmpty()) return;
                NativeDeviceRegistrar.saveJwt(this, jwt);
                NativeDeviceRegistrar.register(
                    BuildConfig.API_BASE_URL,
                    jwt,
                    getNativeDeviceId(),
                    fcmToken
                );
            }
        );
    }

    private String getNativeDeviceId() {
        String androidId = Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID);
        return "android-native-" + (androidId == null ? "unknown" : androidId);
    }
}
