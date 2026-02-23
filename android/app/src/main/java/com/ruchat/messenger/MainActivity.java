package com.ruchat.messenger;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ClipData;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Parcelable;
import android.provider.MediaStore;
import android.util.Log;
import android.view.View;
import android.webkit.ConsoleMessage;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "RuChat";
    private static final int PERMISSION_REQUEST_CODE = 100;
    private static final int FILE_CHOOSER_REQUEST_CODE = 101;
    private static final int CAMERA_REQUEST_CODE = 102;

    private WebView webView;
    private ProgressBar progressBar;
    
    private ValueCallback<Uri[]> fileUploadCallback;
    private Uri cameraImageUri;

    // Разрешения для Android 13+
    private static final String[] PERMISSIONS_ANDROID_13 = {
        Manifest.permission.READ_MEDIA_IMAGES,
        Manifest.permission.READ_MEDIA_VIDEO,
        Manifest.permission.READ_MEDIA_AUDIO
    };

    // Разрешения для Android 12 и ниже
    private static final String[] PERMISSIONS_LEGACY = {
        Manifest.permission.CAMERA,
        Manifest.permission.RECORD_AUDIO,
        Manifest.permission.READ_EXTERNAL_STORAGE,
        Manifest.permission.WRITE_EXTERNAL_STORAGE
    };

    // Все необходимые разрешения
    private static final String[] ALL_PERMISSIONS = {
        Manifest.permission.CAMERA,
        Manifest.permission.RECORD_AUDIO,
        Manifest.permission.READ_EXTERNAL_STORAGE,
        Manifest.permission.WRITE_EXTERNAL_STORAGE,
        Manifest.permission.READ_MEDIA_IMAGES,
        Manifest.permission.READ_MEDIA_VIDEO,
        Manifest.permission.READ_MEDIA_AUDIO
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webView);
        progressBar = findViewById(R.id.progressBar);

        // Запрашиваем все разрешения при запуске
        requestAllPermissions();

        // Настраиваем WebView
        setupWebView();

        // Загружаем приложение
        webView.loadUrl("file:///android_asset/www/index.html");
    }

    private void requestAllPermissions() {
        ArrayList<String> permissionsToRequest = new ArrayList<>();
        
        for (String permission : ALL_PERMISSIONS) {
            // Пропускаем разрешения для старых версий Android
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (permission.equals(Manifest.permission.READ_EXTERNAL_STORAGE) ||
                    permission.equals(Manifest.permission.WRITE_EXTERNAL_STORAGE)) {
                    continue;
                }
            } else {
                if (permission.equals(Manifest.permission.READ_MEDIA_IMAGES) ||
                    permission.equals(Manifest.permission.READ_MEDIA_VIDEO) ||
                    permission.equals(Manifest.permission.READ_MEDIA_AUDIO)) {
                    continue;
                }
            }
            
            if (ContextCompat.checkSelfPermission(this, permission) 
                    != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(permission);
            }
        }

        if (!permissionsToRequest.isEmpty()) {
            ActivityCompat.requestPermissions(this, 
                permissionsToRequest.toArray(new String[0]), 
                PERMISSION_REQUEST_CODE);
        }
    }

    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        
        // Включаем JavaScript
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        
        // Включаем геолокацию
        settings.setGeolocationEnabled(true);
        
        // Включаем WebRTC (для звонков)
        settings.setMediaPlaybackRequiresUserGesture(false);
        
        // Разрешаем доступ к файлам
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        
        // Кэширование
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setAppCacheEnabled(true);
        
        // Zoom
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        
        // Аппаратное ускорение
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        
        // User Agent
        settings.setUserAgentString(settings.getUserAgentString() + " RuChatAndroid/1.0");

        // WebViewClient для навигации внутри приложения
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith("file://") || 
                    url.startsWith("blob:") ||
                    url.contains("firebaseio.com")) {
                    return false;
                }
                // Открываем внешние ссылки в браузере
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                startActivity(intent);
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                progressBar.setVisibility(View.GONE);
            }
        });

        // WebChromeClient для разрешений и файлов
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, 
                    FileChooserParams fileChooserParams) {
                if (fileUploadCallback != null) {
                    fileUploadCallback.onReceiveValue(null);
                }
                fileUploadCallback = filePathCallback;
                showFileChooser(fileChooserParams);
                return true;
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, 
                    GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                Log.d(TAG, "Permission request: " + request.getResources().length);
                // Разрешаем камеру и микрофон для WebRTC
                request.grant(request.getResources());
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                Log.d(TAG, consoleMessage.message() + " -- From line " 
                    + consoleMessage.lineNumber() + " of " + consoleMessage.sourceId());
                return true;
            }

            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
                if (newProgress < 100) {
                    progressBar.setVisibility(View.VISIBLE);
                } else {
                    progressBar.setVisibility(View.GONE);
                }
            }
        });

        // Обработчик загрузок
        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, 
                    String mimetype, long contentLength) {
                downloadFile(url, contentDisposition, mimetype);
            }
        });

        // JavaScript интерфейс
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void showToast(String message) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show());
            }

            @JavascriptInterface
            public void requestPermissions() {
                runOnUiThread(() -> requestAllPermissions());
            }
        }, "AndroidInterface");
    }

    private void showFileChooser(WebChromeClient.FileChooserParams params) {
        Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        
        String[] mimeTypes = params.getAcceptTypes();
        if (mimeTypes != null && mimeTypes.length > 0) {
            ArrayList<String> allMimeTypes = new ArrayList<>();
            for (String type : mimeTypes) {
                if (type.equals("*/*") || type.equals("image/*") || 
                    type.equals("video/*") || type.equals("audio/*")) {
                    allMimeTypes.add(type);
                } else {
                    allMimeTypes.add(type);
                }
            }
            if (!allMimeTypes.isEmpty()) {
                intent.setType(allMimeTypes.get(0));
            }
        } else {
            intent.setType("*/*");
        }

        // Разрешаем множественный выбор
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        
        // Добавляем возможность съемки фото/видео
        if (params.getAcceptTypes() == null || 
            params.getAcceptTypes().length == 0 ||
            params.getAcceptTypes()[0].equals("*/*") ||
            params.getAcceptTypes()[0].startsWith("image/")) {
            
            Intent cameraIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            if (cameraIntent.resolveActivity(getPackageManager()) != null) {
                try {
                    File photoFile = createImageFile();
                    cameraImageUri = FileProvider.getUriForFile(this, 
                        getPackageName() + ".fileprovider", photoFile);
                    cameraIntent.putExtra(MediaStore.EXTRA_OUTPUT, cameraImageUri);
                    
                    Intent chooser = Intent.createChooser(intent, "Выберите файл");
                    chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Parcelable[]{cameraIntent});
                    startActivityForResult(chooser, FILE_CHOOSER_REQUEST_CODE);
                    return;
                } catch (IOException e) {
                    Log.e(TAG, "Error creating image file", e);
                }
            }
        }

        startActivityForResult(Intent.createChooser(intent, "Выберите файл"), 
            FILE_CHOOSER_REQUEST_CODE);
    }

    private File createImageFile() throws IOException {
        String timeStamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(new Date());
        String imageFileName = "RuChat_" + timeStamp + "_";
        File storageDir = getExternalFilesDir(Environment.DIRECTORY_PICTURES);
        return File.createTempFile(imageFileName, ".jpg", storageDir);
    }

    private void downloadFile(String url, String contentDisposition, String mimetype) {
        try {
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setTitle("RuChat Download");
            request.setDescription("Загрузка файла...");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setAllowedOverMetered(true);
            request.setAllowedOverRoaming(true);
            
            String fileName = getFileNameFromUrl(url);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
            
            DownloadManager downloadManager = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
            downloadManager.enqueue(request);
            
            Toast.makeText(this, "Загрузка началась", Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            Log.e(TAG, "Download error", e);
            Toast.makeText(this, "Ошибка загрузки", Toast.LENGTH_SHORT).show();
        }
    }

    private String getFileNameFromUrl(String url) {
        String fileName = "ruchat_download";
        try {
            String[] parts = url.split("/");
            if (parts.length > 0) {
                String lastPart = parts[parts.length - 1];
                if (!lastPart.isEmpty() && lastPart.contains(".")) {
                    fileName = lastPart;
                }
            }
        } catch (Exception e) {
            // ignore
        }
        return fileName;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, 
            @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        
        if (requestCode == PERMISSION_REQUEST_CODE) {
            boolean allGranted = true;
            for (int result : grantResults) {
                if (result != PackageManager.PERMISSION_GRANTED) {
                    allGranted = false;
                    break;
                }
            }
            
            if (allGranted) {
                Toast.makeText(this, "Все разрешения предоставлены", Toast.LENGTH_SHORT).show();
            } else {
                Toast.makeText(this, "Некоторые разрешения не предоставлены. " +
                    "Функционал может быть ограничен", Toast.LENGTH_LONG).show();
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (resultCode == Activity.RESULT_OK) {
                ArrayList<Uri> uris = new ArrayList<>();
                
                // Обработка результата от камеры
                if (cameraImageUri != null && data == null) {
                    uris.add(cameraImageUri);
                } 
                // Обработка результата от выбора файлов
                else if (data != null) {
                    if (data.getClipData() != null) {
                        ClipData clipData = data.getClipData();
                        for (int i = 0; i < clipData.getItemCount(); i++) {
                            uris.add(clipData.getItemAt(i).getUri());
                        }
                    } else if (data.getData() != null) {
                        uris.add(data.getData());
                    }
                }
                
                if (fileUploadCallback != null) {
                    fileUploadCallback.onReceiveValue(uris.toArray(new Uri[0]));
                    fileUploadCallback = null;
                }
            } else {
                if (fileUploadCallback != null) {
                    fileUploadCallback.onReceiveValue(null);
                    fileUploadCallback = null;
                }
            }
            cameraImageUri = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
