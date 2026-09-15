# Fiora 原生 Android App

本目录保留原来的原生聊天页面，并适配 `ichinose-custom` 分支的服务端。默认连接 **https://chat.nekopara.cc**。App 与网页共用账号、聊天记录和音乐房间，服务端仍按仓库根目录的 Docker 文档部署。

## 当前已接入

- 原生登录、邀请码注册、群聊、私聊、图片选择及预览、文件发送（单个不超过 30 MB）。登录兼容旧 token，临时断网会重试恢复。
- `/music`、`/pixiv` 和骰子等命令提示。提交后清空输入框，服务器结果作为 system 消息展示。
- `/pixiv ID`、作品链接的多图返回，以及单张 `i.pximg.net` 链接。
- 表情栏依次为默认、QQ、搜索、收藏；长按自己发出的图片可收藏。
- 群聊和私聊各自的音乐房间、点歌与队列、空闲歌单的顺序/随机播放。
- 顶部紧凑毛玻璃播放器、旋转封面、歌词及译文、独立音量。没有当前歌曲时不显示播放器。
- 网易云手机号验证码/MUSIC_U 账号面板；“我”页面提供 Pixiv PHPSESSID 设置。账号管理仅限站点管理员，凭据不会保存在 App 本地配置中。

Android 12 及以上使用原生背景模糊；更旧系统回退为半透明底板。收听需要点击加入或点歌，退出聊天页面会结束该页面的收听。后台播放已配置 Android 媒体服务和锁屏信息，具体设备的后台保活仍待真机验证。

## 最方便的 APK 构建方式：GitHub Actions

不需要在部署 Fiora 的服务器安装 Android 环境，也不需要 Expo 账号。

1. 推送 App 或共享工具改动到 `ichinose-custom`，自动开始构建。
2. 打开 GitHub 的 **Actions → Build Android APK → Run workflow**，选择包含本次改动的分支。
3. 构建完成后，在该次运行的 **Artifacts** 下载 `fiora-android-review-...`，解压取得 APK。
4. 将 APK 安装到 64 位 ARM Android 手机上进行审核。

该流程编译 `assembleRelease`，把 JavaScript 和资源打进 APK，安装后不需要电脑运行 Metro。当前使用 Expo 模板的调试签名供内部审核；正式分发前需要配置自己的长期签名并备份密钥。工作流同时发布到固定的 `android-latest` GitHub Release，保留版本化 APK，并在上传完成后更新 `latest.json`。每次构建生成递增 versionCode；同一分支并发构建会取消旧任务。请保留签名，换签名后无法直接覆盖已安装版本。

## 本地开发和构建

准备 Node.js 24、npm、JDK 17 和 Android SDK/Android Studio；开发时可连接真机或启动模拟器。

```sh
cd packages/app
npm ci
npm run typecheck
npm run android
```

生成与 Actions 相同的独立审核 APK：

```sh
cd packages/app
npm ci
npx expo prebuild --platform android --no-install
cd android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

Windows PowerShell 使用 `./gradlew.bat`。APK 输出在 `packages/app/android/app/build/outputs/apk/release/`。

Android 工程由 Expo 自动生成，未纳入版本控制；不要只修改生成的 `android/` 目录作为长期配置。依赖使用本目录的 `package-lock.json`，旧 `packages/app/yarn.lock` 已移除。

也可以在 `packages/app` 内运行 `npx eas-cli@latest login`、`npx eas-cli@latest build:configure`，再运行 `npm run build:android`，使用 `eas.json` 的 preview 配置云构建 APK。EAS 需要你自己的 Expo 账号及项目关联。

## 服务地址与现有部署

在 `app.json` 的 `expo.extra.serverUrl` 修改站点 HTTPS 地址并重新构建。此地址是聊天站本身，不是阿里云网易云 API 地址；原有阿里云接口、认证令牌、Pixiv/网易云账号存储都继续由服务端管理。

App 只接受 HTTPS 聊天站，证书须被 Android 信任，反向代理需要支持 WebSocket。媒体源也应提供 HTTPS URL；服务器本地 `/music-files/`、上传图片等相对路径会使用同一站点地址。

App 不需要写入数据库密码、JWT 密钥、网易云接口令牌或 Pixiv Cookie。管理员可通过面板提交平台登录信息，普通用户直接使用服务器已经配置好的音乐及图片功能。

## 已验证和待验证

已完成依赖兼容检查、TypeScript 检查、Android JavaScript/Hermes 资源导出和 Expo Android 工程生成，以及 Socket 断线/超时、消息去重、多图确认与撤回处理的针对性检查。

首版独立 APK 已由 GitHub Actions 编译成功。本地针对登录存储迁移、附件二进制解码和更新元数据完成检查，界面修改通过类型检查和 Android 资源导出。每次提交的实际编译结果以对应 Actions 运行状态为准；真机上仍需确认升级保留登录、文件选择、QQ 表情、两端音乐同步及安装权限弹窗。

远程推送通知还需要 EAS 项目 ID 和 Android FCM 凭据，当前未配置；这不影响 App 打开时通过 Socket 接收消息。文件消息可发送、打开及下载；代码消息的原生语法高亮和 iOS 构建尚未适配。

## 在 App 内更新

打开“我 → 应用更新”，检查新版后选择“下载并安装”。应用从本仓库的 [Android Release](https://github.com/Ichinose520122/fiora/releases/tag/android-latest) 读取版本，不需要 GitHub 登录；下载完成后校验大小和 MD5，再交给系统安装。GitHub 元数据同时提供 SHA-256 供独立核验。首次安装更新时，按 Android 提示允许 Fiora 安装应用；如系统未自动返回安装器，可点“重新安装”。

覆盖安装保留账号与数据，请勿卸载旧版。当前仅提供 ARM64 APK。GitHub 无法访问时会提示重试，也可从发布页面手动下载安装包。

### 2.1.1 补充

- 文件由原生文件接口直接读取二进制；从系统选文件界面返回时等待 Socket 登录恢复，再开始上传。消息显示读取、上传和发送状态，失败原因可点开查看。
- 炫彩标签采用与网页相同的双色/三色/黑白配色、5 秒流动渐变与 6 个星星/爱心粒子，参数共用 `packages/config/tagEffect.ts`。系统启用减少动态效果时停止动画。
- 网页附件、代码和邀请卡片随浅色气泡调整文字颜色，长标签支持截断。

### 2.2.0：上传与后台在线

- 文件采用 48 KiB 分片，最大 30 MB；短暂断线自动续传，失败消息保留并支持点击重试。失败记录目前保留在本次运行中，退出账号或结束应用后不保留。
- 先更新服务器 Fiora 镜像，再安装新 APK。分片上传和头像挂件需要这一版服务端，无需修改 compose.yaml 或 .env。
- Android 登录后启动“后台在线”常驻通知，可在“我”中或通知中停止。前台服务运行聊天连接和重连任务，并在后台显示收到的消息通知。会增加耗电；请允许后台运行。系统强行停止、厂商清理和断网仍可能中断，重新打开应用会自动恢复登录和同步消息。
- “我 → 头像挂件”提供星河环、花间枝、月光猫、晴空羽；网页端在个人信息设置中选择，随账号存储。管理员皇冠由服务端身份自动决定。
