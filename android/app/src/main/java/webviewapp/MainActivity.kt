package webviewapp

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import webviewapp.ui.theme.WebViewAppTheme

class MainActivity : ComponentActivity() {
    private var fileCallback: ValueCallback<Array<Uri>>? = null

    private val fileChooserLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            if (result.resultCode == RESULT_OK) {
                val data = result.data
                val resultUris =
                    WebChromeClient.FileChooserParams.parseResult(result.resultCode, data)
                fileCallback?.onReceiveValue(resultUris)
            } else {
                fileCallback?.onReceiveValue(null)
            }
            fileCallback = null
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            WebViewAppTheme {
                Scaffold(
                    modifier = Modifier
                        .fillMaxSize()
                        .imePadding()
                ) { innerPadding ->
                    WebViewScreen(
                        url = "https://valhalla.gaia.cc/",
                        modifier = Modifier.padding(innerPadding),
                        onFileChooser = { callback, intent ->
                            fileCallback?.onReceiveValue(null) // 이전 콜백 정리
                            fileCallback = callback
                            try {
                                fileChooserLauncher.launch(intent)
                            } catch (e: ActivityNotFoundException) {
                                fileCallback = null
                            }
                        }
                    )
                }
            }
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun WebViewScreen(
    url: String,
    modifier: Modifier = Modifier,
    onFileChooser: ((ValueCallback<Array<Uri>>, Intent) -> Unit)? = null
) {
    AndroidView(
        factory = { context ->
            WebView(context).apply {
                webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(
                        view: WebView,
                        request: WebResourceRequest
                    ): Boolean {
                        val requestedUrl = request.url.toString()
                        if (requestedUrl.startsWith("http://") || requestedUrl.startsWith("https://")) {
                            return false
                        } else {
                            try {
                                val intent = Intent(Intent.ACTION_VIEW, request.url)
                                view.context.startActivity(intent)
                            } catch (e: Exception) {
                                e.printStackTrace()
                            }
                            return true
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
                }

                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                loadUrl(url)
            }
        },
        modifier = modifier.fillMaxSize()
    )
}
