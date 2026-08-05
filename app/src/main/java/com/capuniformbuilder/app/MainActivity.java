package com.capuniformbuilder.app;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.ViewGroup;
import android.webkit.DownloadListener;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.OutputStream;

public class MainActivity extends Activity {
    private static final String APP_URL = "https://guiseppesdoran-lang.github.io/CAP-Uniform-Builder/?app=android&v=2";
    private static final int FILE_CHOOSER_REQUEST = 4102;

    private WebView webView;
    private ValueCallback<Uri[]> pendingFileChooser;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(8, 47, 99));
        getWindow().setNavigationBarColor(Color.rgb(8, 47, 99));

        webView = new WebView(this);
        webView.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setUseWideViewPort(false);
        settings.setLoadWithOverviewMode(false);
        settings.setTextZoom(100);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        webView.clearCache(true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost();
                if(host != null && (host.equals("guiseppesdoran-lang.github.io") || host.endsWith("githubusercontent.com"))) {
                    return false;
                }
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView view,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams
            ) {
                if(pendingFileChooser != null) pendingFileChooser.onReceiveValue(null);
                pendingFileChooser = filePathCallback;
                Intent chooser = fileChooserParams.createIntent();
                try {
                    startActivityForResult(chooser, FILE_CHOOSER_REQUEST);
                    return true;
                } catch(Exception error) {
                    pendingFileChooser = null;
                    Toast.makeText(MainActivity.this, "No file picker is available.", Toast.LENGTH_LONG).show();
                    return false;
                }
            }
        });

        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            if(url != null && url.startsWith("data:")) {
                saveDataUrl(url, mimeType);
            } else {
                enqueueDownload(url, userAgent, contentDisposition, mimeType);
            }
        });

        if(savedInstanceState == null) webView.loadUrl(APP_URL);
        else webView.restoreState(savedInstanceState);
    }

    private void saveDataUrl(String url, String fallbackMimeType) {
        try {
            int comma = url.indexOf(',');
            if(comma < 0) throw new IllegalArgumentException("Invalid data URL");
            String header = url.substring(5, comma);
            String mimeType = header.split(";")[0];
            if(mimeType.isEmpty()) mimeType = fallbackMimeType != null ? fallbackMimeType : "image/png";
            String payload = url.substring(comma + 1);
            byte[] bytes = header.contains(";base64")
                    ? Base64.decode(payload, Base64.DEFAULT)
                    : Uri.decode(payload).getBytes(java.nio.charset.StandardCharsets.UTF_8);

            String extension = mimeType.contains("png") ? ".png" : ".bin";
            String fileName = "CAP_Uniform_" + System.currentTimeMillis() + extension;
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
            values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/CAP Uniform Builder");
            Uri destination = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if(destination == null) throw new IllegalStateException("Could not create download");
            try(OutputStream output = getContentResolver().openOutputStream(destination)) {
                if(output == null) throw new IllegalStateException("Could not open download");
                output.write(bytes);
            }
            Toast.makeText(this, "Saved to Downloads/CAP Uniform Builder", Toast.LENGTH_LONG).show();
        } catch(Exception error) {
            Toast.makeText(this, "PNG download failed: " + error.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private void enqueueDownload(String url, String userAgent, String contentDisposition, String mimeType) {
        try {
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.addRequestHeader("User-Agent", userAgent);
            request.setMimeType(mimeType);
            request.setTitle("CAP Uniform Builder download");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "CAP_Uniform_Builder_download");
            DownloadManager manager = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
            manager.enqueue(request);
        } catch(Exception error) {
            Toast.makeText(this, "Download failed: " + error.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if(requestCode != FILE_CHOOSER_REQUEST || pendingFileChooser == null) return;
        Uri[] results = resultCode == RESULT_OK
                ? WebChromeClient.FileChooserParams.parseResult(resultCode, data)
                : null;
        pendingFileChooser.onReceiveValue(results);
        pendingFileChooser = null;
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    public void onBackPressed() {
        if(webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}

