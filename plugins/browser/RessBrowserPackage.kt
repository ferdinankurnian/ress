package dev.iydheko.ress

import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.ViewManager

class RessBrowserModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "RessBrowser"

  @ReactMethod
  fun open(url: String, promise: Promise) {
    try {
      val uri = Uri.parse(url)
      require(uri.scheme == "https" || uri.scheme == "http") { "Invalid page URL" }
      val manager = reactApplicationContext.packageManager
      // A hostless URL resolves browsers without matching domain-specific apps.
      val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse("https://"))
        .addCategory(Intent.CATEGORY_BROWSABLE)
      val browsers = manager.queryIntentActivities(browserIntent, PackageManager.MATCH_DEFAULT_ONLY)
        .map { it.activityInfo.packageName }.distinct()
      val defaultPackage = manager.resolveActivity(browserIntent, PackageManager.MATCH_DEFAULT_ONLY)?.activityInfo?.packageName
      fun target(packageName: String) = Intent(Intent.ACTION_VIEW, uri)
        .addCategory(Intent.CATEGORY_BROWSABLE).setPackage(packageName)
      val intent = if (defaultPackage != null && browsers.contains(defaultPackage)) {
        target(defaultPackage)
      } else {
        require(browsers.isNotEmpty()) { "No browser installed" }
        Intent.createChooser(target(browsers.first()), "Open in browser").apply {
          putExtra(Intent.EXTRA_INITIAL_INTENTS, browsers.drop(1).map { target(it) }.toTypedArray())
        }
      }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactApplicationContext.startActivity(intent)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("BROWSER_FAILED", "Could not open browser.", error)
    }
  }
}

class RessBrowserPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(RessBrowserModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
