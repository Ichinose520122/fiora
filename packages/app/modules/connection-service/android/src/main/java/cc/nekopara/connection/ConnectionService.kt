package cc.nekopara.connection

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class ConnectionService : HeadlessJsTaskService() {
  companion object {
    @Volatile var running = false
    @Volatile var generation = 0
    @Volatile var lastHeartbeat = 0L
    @Volatile var connected = false
  }
  private fun notification(online: Boolean): Notification {
    val open = packageManager.getLaunchIntentForPackage(packageName)!!
    val content = PendingIntent.getActivity(this, 781, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val stop = PendingIntent.getService(this, 782, Intent(this, ConnectionService::class.java).setAction("stop"), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, "fiora-connection") else Notification.Builder(this)
    return builder.setSmallIcon(android.R.drawable.sym_action_chat)
      .setContentTitle(if (online) "Fiora · 后台连接正常" else "Fiora · 正在恢复连接")
      .setContentText("后台服务运行中 · 点此打开聊天")
      .setContentIntent(content).setOngoing(true).setShowWhen(false).setOnlyAlertOnce(true)
      .addAction(Notification.Action.Builder(null, "停止后台在线", stop).build()).build()
  }
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == "stop" || !getSharedPreferences("connection", 0).getBoolean("enabled", true)) {
      getSharedPreferences("connection", 0).edit().putBoolean("enabled", false).apply()
      stopSelf()
      return START_NOT_STICKY
    }
    if (intent?.action == "status") {
      // A queued heartbeat must not resurrect a service stopped by logout.
      if (!running) { stopSelf(); return START_NOT_STICKY }
      val online = intent.getBooleanExtra("connected", false)
      lastHeartbeat = SystemClock.elapsedRealtime()
      if (connected != online) {
        connected = online
        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).notify(781, notification(online))
      }
      return START_STICKY
    }
    if (running) return START_STICKY
    val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(NotificationChannel("fiora-connection", "后台在线", NotificationManager.IMPORTANCE_LOW))
    startForeground(781, notification(false))
    generation += 1
    lastHeartbeat = 0L
    connected = false
    running = true
    super.onStartCommand(intent, flags, startId)
    return START_STICKY
  }
  override fun getTaskConfig(intent: Intent?) = HeadlessJsTaskConfig("FioraConnection", Arguments.createMap(), 0, true)
  override fun onDestroy() {
    running = false
    connected = false
    lastHeartbeat = 0L
    super.onDestroy()
  }
}
