package cc.nekopara.connection

import android.content.Intent
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ConnectionModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FioraConnection")
    Function("isEnabled") { context().getSharedPreferences("connection", 0).getBoolean("enabled", true) }
    Function("isRunning") { ConnectionService.running }
    AsyncFunction("setEnabled") { enabled: Boolean ->
      context().getSharedPreferences("connection", 0).edit().putBoolean("enabled", enabled).apply()
      if (!enabled) context().stopService(Intent(context(), ConnectionService::class.java))
    }
    AsyncFunction("start") {
      val intent = Intent(context(), ConnectionService::class.java)
      if (Build.VERSION.SDK_INT >= 26) context().startForegroundService(intent) else context().startService(intent)
      Unit
    }
    AsyncFunction("stop") { context().stopService(Intent(context(), ConnectionService::class.java)); Unit }
  }
  private fun context() = requireNotNull(appContext.reactContext)
}
