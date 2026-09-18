package cc.nekopara.connection

import android.content.ClipData
import android.content.ClipboardManager
import android.speech.tts.TextToSpeech
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.Network
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ConnectionModule : Module() {
  private var speech: TextToSpeech? = null
  private var speechReady = false
  private var pendingSpeech = ""
  private var connectivity: ConnectivityManager? = null
  private val callback = object : ConnectivityManager.NetworkCallback() {
    override fun onAvailable(network: Network) { sendEvent("onNetworkAvailable", emptyMap<String, Any>()) }
  }
  override fun definition() = ModuleDefinition {
    Name("FioraConnection")
    Events("onNetworkAvailable")
    OnCreate {
      connectivity = context().getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
      if (Build.VERSION.SDK_INT >= 24) connectivity?.registerDefaultNetworkCallback(callback)
    }
    OnDestroy {
      speech?.stop(); speech?.shutdown(); speech = null; speechReady = false
      if (Build.VERSION.SDK_INT >= 24) try { connectivity?.unregisterNetworkCallback(callback) } catch (_: Exception) { }
    }
    AsyncFunction("copyText") { text: String ->
      (context().getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("Fiora", text))
    }
    AsyncFunction("speak") { text: String ->
      pendingSpeech = text.take(300)
      if (speech == null) {
        speech = TextToSpeech(context().applicationContext) { status ->
          speechReady = status == TextToSpeech.SUCCESS
          if (speechReady) speech?.speak(pendingSpeech, TextToSpeech.QUEUE_FLUSH, null, "fiora-message")
        }
      } else if (speechReady) speech?.speak(pendingSpeech, TextToSpeech.QUEUE_FLUSH, null, "fiora-message")
      Unit
    }
    Function("isEnabled") { context().getSharedPreferences("connection", 0).getBoolean("enabled", true) }
    Function("isRunning") { ConnectionService.running }
    Function("isBatteryUnrestricted") {
      Build.VERSION.SDK_INT < 23 || (context().getSystemService(Context.POWER_SERVICE) as PowerManager).isIgnoringBatteryOptimizations(context().packageName)
    }
    AsyncFunction("openBatterySettings") {
      val ctx = context()
      val intent = if (Build.VERSION.SDK_INT >= 23) Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${ctx.packageName}")) else Intent(Settings.ACTION_SETTINGS)
      try { ctx.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
      catch (_: Exception) { ctx.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${ctx.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
      Unit
    }
    AsyncFunction("setEnabled") { enabled: Boolean ->
      context().getSharedPreferences("connection", 0).edit().putBoolean("enabled", enabled).apply()
      if (!enabled) context().stopService(Intent(context(), ConnectionService::class.java))
    }
    AsyncFunction("start") {
      if (context().getSharedPreferences("connection", 0).getBoolean("enabled", true)) {
        val intent = Intent(context(), ConnectionService::class.java)
        if (Build.VERSION.SDK_INT >= 26) context().startForegroundService(intent) else context().startService(intent)
      }
      Unit
    }
    AsyncFunction("stop") { context().stopService(Intent(context(), ConnectionService::class.java)); Unit }
  }
  private fun context() = requireNotNull(appContext.reactContext)
}
