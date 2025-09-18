package webviewapp

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Message
import android.util.Log
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import webviewapp.ui.theme.WebViewAppTheme
import androidx.core.net.toUri
import com.google.android.gms.tasks.OnCompleteListener
import com.google.firebase.messaging.FirebaseMessaging

const val MAIN_URI: String = "https://valhalla.gaia.cc/?platform=android&source=webview"

class MainActivity : ComponentActivity() {
    private var fileCallback: ValueCallback<Array<Uri>>? = null

    private val fileChooserLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val uriArray: Array<Uri>? = when {
                result.resultCode != Activity.RESULT_OK -> null   // 사용자가 취소
                result.data?.clipData != null -> {                // 여러 장 선택
                    val clip = result.data!!.clipData!!
                    Array(clip.itemCount) { clip.getItemAt(it).uri }
                }
                else -> WebChromeClient.FileChooserParams.parseResult( // 단일 선택
                    result.resultCode, result.data)
            }

            fileCallback?.onReceiveValue(uriArray)
            fileCallback = null
        }

    private var webViewRef: WebView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        askNotificationPermission()

        FirebaseMessaging.getInstance().token.addOnCompleteListener(OnCompleteListener { task ->
            if (!task.isSuccessful) {
                Log.w("FCM", "Fetching FCM registration token failed", task.exception)
                return@OnCompleteListener
            }

            // Get new FCM registration token
            val token = task.result

            // Log and toast
            val msg = "FCM registration token: %s".format(token)
            Log.d("FCM", msg)
            Toast.makeText(baseContext, msg, Toast.LENGTH_SHORT).show()
        })

        setContent {
            WebViewAppTheme {
                Scaffold(
                    modifier = Modifier
                        .fillMaxSize()
                        .imePadding()
                ) { innerPadding ->
                    WebViewScreen(
                        url = MAIN_URI,
                        modifier = Modifier.padding(innerPadding),
                        onFileChooser = { callback, intent ->
                            fileCallback?.onReceiveValue(null) // 이전 콜백 정리
                            fileCallback = callback
                            try {
                                fileChooserLauncher.launch(intent)
                            } catch (e: ActivityNotFoundException) {
                                fileCallback = null
                            }
                        },
                        onWebViewReady = { wv -> webViewRef = wv }
                    )
                }
            }
        }

        handleAuthRedirect(intent)
    }

    private fun handleAuthRedirect(intent: Intent?) {
        val data = intent?.data ?: return
        if (data.scheme == "valhalla" && data.host == "oauth2redirect") {
            // 1) 여기서 code/state를 꺼내 서버로 교환하거나,
            // 2) WebView의 프론트엔드가 처리하도록 전달합니다.

            val query = data.query ?: "" // code=...&state=...
            // (A) 프론트엔드로 넘기는 방식: 특정 URL로 로드
            //     예: https://valhalla.gaia.cc/auth/callback#code=...&state=...
            val resumeUrl = "https://valhalla.gaia.cc/api/oauth2/callback#$query"
            webViewRef?.loadUrl(resumeUrl)

            // (대안) JS Bridge로 전달하고 싶다면 evaluateJavascript 사용:
            // webViewRef?.evaluateJavascript("window.__onOAuthCallback(${JSONObject.quote(query)})", null)
        }
    }

    // Declare the launcher at the top of your Activity/Fragment:
    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { isGranted: Boolean ->
        if (isGranted) {
            // FCM SDK (and your app) can post notifications.
        } else {
            // TODO: Inform user that that your app will not show notifications.
        }
    }

    private fun askNotificationPermission() {
        // This is only necessary for API level >= 33 (TIRAMISU)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
                PackageManager.PERMISSION_GRANTED
            ) {
                // FCM SDK (and your app) can post notifications.
            } else if (shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)) {
                // TODO: display an educational UI explaining to the user the features that will be enabled
                //       by them granting the POST_NOTIFICATION permission. This UI should provide the user
                //       "OK" and "No thanks" buttons. If the user selects "OK," directly request the permission.
                //       If the user selects "No thanks," allow the user to continue without notifications.
            } else {
                // Directly ask for the permission
                requestPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun WebViewScreen(
    url: String,
    modifier: Modifier = Modifier,
    onFileChooser: ((ValueCallback<Array<Uri>>, Intent) -> Unit)? = null,
    onWebViewReady: ((WebView) -> Unit)? = null
) {
    var webView: WebView? by remember { mutableStateOf(null) }
    var progress by remember { mutableStateOf(0) }

    BackHandler(enabled = true) {
        if (webView?.canGoBack() == true) webView?.goBack()
        else (webView?.context as? Activity)?.finish()
    }

    Box(modifier = modifier.fillMaxSize()) {
        AndroidView(
            factory = { context ->
                WebView(context).apply {
                    setBackgroundColor(Color.BLACK)
                    settings.apply {
                        javaScriptEnabled = true
                        domStorageEnabled = true
                        setSupportMultipleWindows(true)
                    }

                    webViewClient = object : WebViewClient() {
                        override fun shouldOverrideUrlLoading(
                            view: WebView,
                            request: WebResourceRequest
                        ): Boolean {
                            val u = request.url
                            val url = u.toString()

                            // http/https 아닌 스킴은 외부 앱으로
                            if (!(url.startsWith("http://") || url.startsWith("https://"))) {
                                return try {
                                    val intent = Intent(Intent.ACTION_VIEW, u)
                                    view.context.startActivity(intent)
                                    true
                                } catch (_: Exception) {
                                    true
                                }
                            }

                            // === (중요) 구글 로그인/계정 관련 URL이면 시스템 브라우저로 ===
                            val isGoogleAccountFlow =
                                u.host?.endsWith("accounts.google.com") == true ||
                                        url.contains("/o/oauth2/") || url.contains("/oauth2/") ||
                                        url.contains("signin") || url.contains("chooseaccount")

                            return if (isGoogleAccountFlow) {
                                launchInCustomTab(view.context, u)
                                true
                            } else {
                                false // 일반 페이지는 WebView에서 계속
                            }
                        }
                    }

                    webChromeClient = object : WebChromeClient() {
                        override fun onShowFileChooser(
                            webView: WebView?,
                            filePathCallback: ValueCallback<Array<Uri>>,
                            fileChooserParams: FileChooserParams
                        ): Boolean {
                            onFileChooser?.invoke(filePathCallback, fileChooserParams.createIntent())
                            return true
                        }

                        override fun onCreateWindow(
                            view: WebView,
                            isDialog: Boolean,
                            isUserGesture: Boolean,
                            resultMsg: Message
                        ): Boolean {
                            val ctx = view.context
                            val newWebView = WebView(ctx).apply {
                                settings.javaScriptEnabled = true
                                webViewClient = object : WebViewClient() {
                                    override fun onPageStarted(
                                        view: WebView?, url: String?, favicon: android.graphics.Bitmap?
                                    ) {
                                        if (url != null) ctx.startActivity(Intent(Intent.ACTION_VIEW, url.toUri()))
                                        destroy()
                                    }
                                }
                            }
                            (resultMsg.obj as WebView.WebViewTransport).apply {
                                webView = newWebView
                            }
                            resultMsg.sendToTarget()
                            return true
                        }

                        override fun onProgressChanged(view: WebView?, newProgress: Int) {
                            progress = newProgress.coerceIn(0, 100)
                        }
                    }

                    loadUrl(url)
                    webView = this
                    onWebViewReady?.invoke(this)
                }
            },
            modifier = Modifier.fillMaxSize()
        )

        // === 가운데 오버레이 (로딩 중일 때만) ===
        if (progress in 0..99) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .imePadding() // 키보드 올라올 때도 중앙 유지
                    .padding(24.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator()
                    Spacer(Modifier.height(12.dp))
                    Text(
                        text = "$progress%",
                        style = MaterialTheme.typography.titleMedium
                    )
                }
            }
        }
    }
}
