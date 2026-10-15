# 独立影院接入

影院放在独立仓库 `fiora-watch`，可与 Fiora 同机或部署在另一台服务器。Fiora 不解析、不下载、不转发视频。

在 Fiora `.env` 增加：

```dotenv
WATCH_SERVER_URL=https://watch.example.com
WATCH_SHARED_SECRET=影院服务端使用的同一个专用密钥
```

密钥用 `openssl rand -hex 32` 生成，至少 32 字符，不复用 `FIORA_JWT_SECRET`。Compose 会将 `WatchIssuer` 设置为 `https://${FIORA_DOMAIN}`，必须与影院的 `FIORA_ORIGIN` 一致。非 Compose 启动使用 `WatchServerUrl`、`WatchIssuer`、`WatchSharedSecret` 环境变量。

更新后重建 Fiora 服务。在私聊或群聊输入 `/watch`，或 `/watch https://视频地址`。Web 和 App 显示影院邀请卡片，点击时才重新验证成员资格并生成 60 秒一次性票据，在浏览器打开影院。邀请码和视频地址可以保存在聊天中，登录票据不会写入聊天消息。

每个聊天对应一个房间；私聊双方、群主和站点管理员可控制播放，普通群成员跟随；下载任务仅站点管理员可管理。入口支持旧邀请重复使用，每次点击签发新票据。附带地址只预填，不自动切换视频。

影院独立会话最长两小时，不与 Fiora 的退出 / 密码修改 / 退群实时联动。会话到期需从 Fiora 重新进入，影院重启会使所有影院会话失效。

首版影院提供在线 HLS / MP4、适配的 MacCMS 页面解析、管理员提前下载、只读本地媒体库。Bilibili 登录解析尚未接入。完整部署和模式限制见影院仓库 README。
