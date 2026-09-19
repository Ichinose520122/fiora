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
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.Ringtone
import android.media.RingtoneManager
import android.app.NotificationManager
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ConnectionModule : Module() {
  private var installedHandler: Thread.UncaughtExceptionHandler? = null
  private var previousHandler: Thread.UncaughtExceptionHandler? = null
  private var speech: TextToSpeech? = null
  private var speechReady = false
  private var pendingSpeech = ""
  private var notificationTone: Ringtone? = null
  private var connectivity: ConnectivityManager? = null
  private val callback = object : ConnectivityManager.NetworkCallback() {
    override fun onAvailable(network: Network) { sendEvent("onNetworkAvailable", emptyMap<String, Any>()) }
  }
  override fun definition() = ModuleDefinition {
    Name("FioraConnection")
    Events("onNetworkAvailable")
    OnCreate {
      val prefs = context().applicationContext.getSharedPreferences("diagnostics", 0)
      previousHandler = Thread.getDefaultUncaughtExceptionHandler()
      val previous = previousHandler
      installedHandler = Thread.UncaughtExceptionHandler { thread, error ->
        try {
          val report = "Screen: " + prefs.getString("screen", "unknown") + "\n" + android.util.Log.getStackTraceString(error).take(16000)
          prefs.edit().putString("crash", report).putBoolean("unseen", true).commit()
        } catch (_: Exception) { }
        previous?.uncaughtException(thread, error)
      }
      Thread.setDefaultUncaughtExceptionHandler(installedHandler)
      connectivity = context().getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
      if (Build.VERSION.SDK_INT >= 24) connectivity?.registerDefaultNetworkCallback(callback)
    }
    OnDestroy {
      if (Thread.getDefaultUncaughtExceptionHandler() === installedHandler) Thread.setDefaultUncaughtExceptionHandler(previousHandler)
      speech?.stop(); speech?.shutdown(); speech = null; speechReady = false
      notificationTone?.stop(); notificationTone = null
      if (Build.VERSION.SDK_INT >= 24) try { connectivity?.unregisterNetworkCallback(callback) } catch (_: Exception) { }
    }
    AsyncFunction("markScreen") { screen: String -> context().getSharedPreferences("diagnostics", 0).edit().putString("screen", screen.take(100)).apply() }
    AsyncFunction("recordError") { report: String -> context().getSharedPreferences("diagnostics", 0).edit().putString("crash", report.take(16000)).putBoolean("unseen", true).apply() }
    AsyncFunction("getLastCrash") { context().getSharedPreferences("diagnostics", 0).getString("crash", "") ?: "" }
    AsyncFunction("consumeCrash") {
      val prefs = context().getSharedPreferences("diagnostics", 0)
      val report = if (prefs.getBoolean("unseen", false)) prefs.getString("crash", "") ?: "" else ""
      prefs.edit().putBoolean("unseen", false).apply()
      report
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
    AsyncFunction("playMessageSound") {
      val ctx = context().applicationContext
      val audio = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      val notifications = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (audio.ringerMode != AudioManager.RINGER_MODE_NORMAL || audio.getStreamVolume(AudioManager.STREAM_NOTIFICATION) == 0 || notifications.currentInterruptionFilter == NotificationManager.INTERRUPTION_FILTER_NONE || notifications.currentInterruptionFilter == NotificationManager.INTERRUPTION_FILTER_ALARMS) {
        false
      } else {
        notificationTone?.stop()
        notificationTone = RingtoneManager.getRingtone(ctx, RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION))
        notificationTone?.audioAttributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()
        if (Build.VERSION.SDK_INT >= 28) notificationTone?.isLooping = false
        notificationTone?.play()
        notificationTone != null
      }
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
