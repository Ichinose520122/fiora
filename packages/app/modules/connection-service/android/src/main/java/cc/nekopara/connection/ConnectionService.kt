package cc.nekopara.connection

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class ConnectionService : HeadlessJsTaskService() {
  companion object { @Volatile var running = false }
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == "stop" || !getSharedPreferences("connection", 0).getBoolean("enabled", true)) {
      getSharedPreferences("connection", 0).edit().putBoolean("enabled", false).apply()
      stopSelf()
      return START_NOT_STICKY
    }
    if (running) return START_STICKY
    val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(NotificationChannel("fiora-connection", "后台在线", NotificationManager.IMPORTANCE_LOW))
    val open = packageManager.getLaunchIntentForPackage(packageName)!!
    val content = PendingIntent.getActivity(this, 781, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val stop = PendingIntent.getService(this, 782, Intent(this, ConnectionService::class.java).setAction("stop"), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, "fiora-connection") else Notification.Builder(this)
    val notification = builder.setSmallIcon(android.R.drawable.sym_action_chat)
      .setContentTitle("Fiora · 后台在线")
      .setContentText("保持聊天连接，断网后自动重连")
      .setContentIntent(content).setOngoing(true).setShowWhen(false)
      .addAction(Notification.Action.Builder(null, "停止后台在线", stop).build()).build()
    startForeground(781, notification)
    running = true
    super.onStartCommand(intent, flags, startId)
    return START_STICKY
  }
  override fun getTaskConfig(intent: Intent?) = HeadlessJsTaskConfig("FioraConnection", Arguments.createMap(), 0, true)
  override fun onDestroy() {
    running = false
    super.onDestroy()
  }
}
