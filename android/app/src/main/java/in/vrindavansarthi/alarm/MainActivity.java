package in.vrindavansarthi.alarm;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.google.firebase.messaging.FirebaseMessaging;

public class MainActivity extends AppCompatActivity {
    private static final String TAG = "VrsNativeAlarm";
    private static final int REGISTER_REQUEST_CODE = 108;
    private static final int CAMERA_REQUEST_CODE = 109;
    private static final long REGISTER_POLL_MS = 10_000L;
    private WebView webView;
    private String fcmToken = "";
    private PermissionRequest pendingCameraPermissionRequest;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable registrationPoller = new Runnable() {
        @Override
        public void run() {
            tryRegisterNativeDevice();
            handler.postDelayed(this, REGISTER_POLL_MS);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        VrsFirebaseMessagingService.ensureAlarmChannel(this);
        requestNotificationPermission();
        setupWebView();
        VrsAppUpdateManager.checkForUpdates(this, false);
        FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token -> {
            fcmToken = token == null ? "" : token;
            Log.d(TAG, "FCM token received=" + !fcmToken.isEmpty());
            NativeDeviceRegistrar.saveFcmToken(this, fcmToken);
            tryRegisterNativeDevice();
        }).addOnFailureListener(error -> {
            Log.e(TAG, "FCM token failed", error);
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        handler.removeCallbacks(registrationPoller);
        handler.post(registrationPoller);
    }

    @Override
    protected void onPause() {
        handler.removeCallbacks(registrationPoller);
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacks(registrationPoller);
        if (pendingCameraPermissionRequest != null) {
            pendingCameraPermissionRequest.deny();
            pendingCameraPermissionRequest = null;
        }
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
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
                Log.d(TAG, "Page finished " + url);
                markAndroidApkSession();
                tryRegisterNativeDevice();
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                Log.d(TAG, "WebView onPermissionRequest: " + request.getOrigin());
                if (!isTrustedOrigin(request.getOrigin())) {
                    Log.w(TAG, "Denying permission request from untrusted origin: " + request.getOrigin());
                    request.deny();
                    return;
                }

                boolean requestsVideo = false;
                for (String resource : request.getResources()) {
                    if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                        requestsVideo = true;
                        break;
                    }
                }

                if (!requestsVideo) {
                    Log.d(TAG, "Requested resources do not include video capture; denying");
                    request.deny();
                    return;
                }

                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                    Log.d(TAG, "Camera permission already granted; granting to WebView");
                    runOnUiThread(() -> request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE}));
                } else {
                    Log.d(TAG, "Camera permission not granted; requesting runtime permission");
                    if (pendingCameraPermissionRequest != null) {
                        pendingCameraPermissionRequest.deny();
                    }
                    pendingCameraPermissionRequest = request;
                    ActivityCompat.requestPermissions(MainActivity.this, new String[]{Manifest.permission.CAMERA}, CAMERA_REQUEST_CODE);
                }
            }

            @Override
            public void onPermissionRequestCanceled(PermissionRequest request) {
                Log.d(TAG, "WebView onPermissionRequestCanceled");
                if (pendingCameraPermissionRequest != null && pendingCameraPermissionRequest.equals(request)) {
                    pendingCameraPermissionRequest = null;
                }
            }
        });

        webView.loadUrl(BuildConfig.APP_URL);
    }

    private boolean isTrustedOrigin(Uri origin) {
        if (origin == null) return false;
        String host = origin.getHost();
        if (host == null) return false;
        String scheme = origin.getScheme();
        if (!"https".equalsIgnoreCase(scheme) && !"http".equalsIgnoreCase(scheme)) return false;

        return host.equalsIgnoreCase("www.vrindavansarthi.in")
            || host.equalsIgnoreCase("vrindavansarthi.in")
            || host.endsWith(".vrindavansarthi.in")
            || host.equalsIgnoreCase("localhost")
            || host.equals("127.0.0.1");
    }

    private void markAndroidApkSession() {
        if (webView == null) return;
        webView.evaluateJavascript(
            "(function(){try{sessionStorage.setItem('vrs_native_apk','1');localStorage.setItem('vrs_native_apk','1');}catch(e){}})();",
            value -> {}
        );
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT < 33) return;
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return;
        ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, REGISTER_REQUEST_CODE);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REGISTER_REQUEST_CODE) {
            tryRegisterNativeDevice();
        } else if (requestCode == CAMERA_REQUEST_CODE) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            Log.d(TAG, "Camera runtime permission result=" + granted);
            if (pendingCameraPermissionRequest != null) {
                final PermissionRequest pendingRequest = pendingCameraPermissionRequest;
                pendingCameraPermissionRequest = null;
                runOnUiThread(() -> {
                    if (granted) {
                        pendingRequest.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                    } else {
                        pendingRequest.deny();
                    }
                });
            }
        }
    }

    private void tryRegisterNativeDevice() {
        if (webView == null || fcmToken == null || fcmToken.isEmpty()) return;
        webView.evaluateJavascript(
            "(function(){try{return localStorage.getItem('vvs-auth')||'';}catch(e){return '';}})();",
            value -> {
                String jwt = NativeDeviceRegistrar.extractJwtFromLocalStorageValue(value);
                if (jwt.isEmpty()) {
                    Log.d(TAG, "JWT not found in WebView localStorage yet");
                    return;
                }
                Log.d(TAG, "JWT found; registering native alarm device");
                NativeDeviceRegistrar.saveJwt(this, jwt);
                NativeDeviceRegistrar.register(
                    BuildConfig.API_BASE_URL,
                    jwt,
                    getNativeDeviceId(),
                    fcmToken,
                    androidx.core.app.NotificationManagerCompat.from(this).areNotificationsEnabled()
                );
            }
        );
    }

    private String getNativeDeviceId() {
        String androidId = Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID);
        return "android-native-" + (androidId == null ? "unknown" : androidId);
    }
}
