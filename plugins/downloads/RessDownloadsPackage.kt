package dev.iydheko.ress

import android.content.ContentValues
import android.os.Environment
import android.provider.MediaStore
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.ViewManager

class RessDownloadsModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "RessDownloads"

  @ReactMethod
  fun save(filename: String, content: String, promise: Promise) {
    val resolver = reactApplicationContext.contentResolver
    var uri: android.net.Uri? = null
    try {
      val values = ContentValues().apply {
        put(MediaStore.Downloads.DISPLAY_NAME, filename)
        put(MediaStore.Downloads.MIME_TYPE, "text/x-opml")
        put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
        put(MediaStore.Downloads.IS_PENDING, 1)
      }
      val target = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
        ?: throw IllegalStateException("Could not create download")
      uri = target
      (resolver.openOutputStream(target) ?: throw IllegalStateException("Could not open download"))
        .bufferedWriter(Charsets.UTF_8).use { it.write(content) }
      resolver.update(target, ContentValues().apply { put(MediaStore.Downloads.IS_PENDING, 0) }, null, null)
      promise.resolve(target.toString())
    } catch (error: Exception) {
      uri?.let { runCatching { resolver.delete(it, null, null) } }
      promise.reject("EXPORT_FAILED", "Could not save OPML to Download.", error)
    }
  }
}

class RessDownloadsPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(RessDownloadsModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
