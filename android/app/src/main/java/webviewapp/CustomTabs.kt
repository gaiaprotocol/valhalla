package webviewapp

import android.content.Context
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent

fun launchInCustomTab(context: Context, uri: Uri) {
    val intent = CustomTabsIntent.Builder().build()
    intent.launchUrl(context, uri)
}
