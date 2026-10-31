package io.jlynn.tvhome;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.drawable.Drawable;
import android.media.tv.TvContract;
import android.media.tv.TvInputInfo;
import android.media.tv.TvInputManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The home screen. A full-screen WebView shows the shared UI from assets/ (the repo's web/ folder)
 * and a small bridge lets it list apps, launch them and switch inputs.
 */
public class HomeActivity extends Activity {
    private static final String ORIGIN = "https://app.local/";
    private WebView web;
    private final Map<String, byte[]> iconCache = new HashMap<>();

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);

        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(248, 244, 239));
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        web.addJavascriptInterface(new Bridge(), "TVHost");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                return serve(req.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                return true;
            }
        });
        setContentView(web);
        web.loadUrl(ORIGIN + "index.html");
        web.requestFocus();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.evaluateJavascript("window.tvOnResume && window.tvOnResume()", null);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (web != null) web.evaluateJavascript("window.tvOnResume && window.tvOnResume()", null);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        // Back must never leave the home screen. The page decides what it does.
        if (e.getKeyCode() == KeyEvent.KEYCODE_BACK) {
            if (e.getAction() == KeyEvent.ACTION_UP) web.evaluateJavascript("window.tvBack && window.tvBack()", null);
            return true;
        }
        return super.dispatchKeyEvent(e);
    }

    // Serves web/ from assets and app banners at /icon/<package>. Nothing leaves the TV.
    private WebResourceResponse serve(Uri uri) {
        if (!"app.local".equals(uri.getHost())) return new WebResourceResponse("text/plain", "utf-8", null);
        String path = uri.getPath() == null ? "/" : uri.getPath();
        try {
            if (path.startsWith("/icon/")) {
                byte[] png = icon(Uri.decode(path.substring(6)));
                if (png == null) return notFound();
                return new WebResourceResponse("image/png", null, new ByteArrayInputStream(png));
            }
            String file = path.equals("/") ? "index.html" : path.substring(1);
            InputStream in = getAssets().open(file);
            return new WebResourceResponse(mime(file), "utf-8", in);
        } catch (IOException e) {
            return notFound();
        }
    }

    private static WebResourceResponse notFound() {
        WebResourceResponse r = new WebResourceResponse("text/plain", "utf-8", new ByteArrayInputStream(new byte[0]));
        r.setStatusCodeAndReasonPhrase(404, "Not Found");
        return r;
    }

    private static String mime(String f) {
        if (f.endsWith(".html")) return "text/html";
        if (f.endsWith(".css")) return "text/css";
        if (f.endsWith(".js")) return "application/javascript";
        if (f.endsWith(".svg")) return "image/svg+xml";
        if (f.endsWith(".png")) return "image/png";
        if (f.endsWith(".jpg")) return "image/jpeg";
        return "application/octet-stream";
    }

    // The app's 16:9 TV banner, or its icon centred on a 16:9 canvas.
    private synchronized byte[] icon(String pkg) {
        if (iconCache.containsKey(pkg)) return iconCache.get(pkg);
        byte[] out = null;
        try {
            PackageManager pm = getPackageManager();
            Drawable banner = pm.getApplicationBanner(pkg);
            if (banner == null) {
                Intent i = pm.getLeanbackLaunchIntentForPackage(pkg);
                if (i != null) banner = pm.getActivityBanner(i);
            }
            Bitmap bmp = Bitmap.createBitmap(320, 180, Bitmap.Config.ARGB_8888);
            Canvas c = new Canvas(bmp);
            if (banner != null) {
                banner.setBounds(0, 0, 320, 180);
                banner.draw(c);
            } else {
                Drawable ic = pm.getApplicationIcon(pkg);
                ic.setBounds(112, 42, 208, 138);
                ic.draw(c);
            }
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            bmp.compress(Bitmap.CompressFormat.PNG, 100, bos);
            out = bos.toByteArray();
        } catch (Exception ignored) {
        }
        iconCache.put(pkg, out);
        return out;
    }

    private void start(Intent i) {
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        runOnUiThread(() -> {
            try {
                startActivity(i);
            } catch (ActivityNotFoundException | SecurityException ignored) {
            }
        });
    }

    /** Called from the page as window.TVHost. Every method returns plain strings. */
    private class Bridge {
        @JavascriptInterface
        public String apps() {
            PackageManager pm = getPackageManager();
            Map<String, String> found = new LinkedHashMap<>();
            for (String cat : new String[]{Intent.CATEGORY_LEANBACK_LAUNCHER, Intent.CATEGORY_LAUNCHER}) {
                Intent q = new Intent(Intent.ACTION_MAIN).addCategory(cat);
                List<ResolveInfo> list = pm.queryIntentActivities(q, 0);
                for (ResolveInfo r : list) {
                    String pkg = r.activityInfo.packageName;
                    if (pkg.equals(getPackageName()) || found.containsKey(pkg)) continue;
                    found.put(pkg, r.loadLabel(pm).toString());
                }
            }
            JSONArray arr = new JSONArray();
            try {
                for (Map.Entry<String, String> e : found.entrySet()) {
                    arr.put(new JSONObject().put("id", e.getKey()).put("name", e.getValue()));
                }
            } catch (Exception ignored) {
            }
            return arr.toString();
        }

        @JavascriptInterface
        public void launch(String pkg) {
            PackageManager pm = getPackageManager();
            Intent i = pm.getLeanbackLaunchIntentForPackage(pkg);
            if (i == null) i = pm.getLaunchIntentForPackage(pkg);
            if (i != null) start(i);
        }

        @JavascriptInterface
        public void playStore(String pkg) {
            start(new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + pkg)));
        }

        @JavascriptInterface
        public void settings() {
            start(new Intent(Settings.ACTION_SETTINGS));
        }

        @JavascriptInterface
        public String inputs() {
            JSONArray arr = new JSONArray();
            try {
                TvInputManager tim = (TvInputManager) getSystemService(TV_INPUT_SERVICE);
                if (tim == null) return "[]";
                for (TvInputInfo info : tim.getTvInputList()) {
                    if (!info.isPassthroughInput() || info.isHidden(HomeActivity.this)) continue;
                    CharSequence custom = info.loadCustomLabel(HomeActivity.this);
                    String name = (custom != null && custom.length() > 0 ? custom : info.loadLabel(HomeActivity.this)).toString();
                    arr.put(new JSONObject().put("id", info.getId()).put("name", name));
                }
            } catch (Exception ignored) {
            }
            return arr.toString();
        }

        @JavascriptInterface
        public void openInput(String id) {
            start(new Intent(Intent.ACTION_VIEW, TvContract.buildChannelUriForPassthroughInput(id)));
        }

        @JavascriptInterface
        public String deviceName() {
            String n = Settings.Global.getString(getContentResolver(), "device_name");
            return n != null && !n.isEmpty() ? n : Build.MODEL;
        }
    }
}
