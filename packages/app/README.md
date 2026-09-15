# Fiora 原生 Android App

本目录保留原来的原生聊天页面，并适配 `ichinose-custom` 分支的服务端。默认连接 **https://chat.nekopara.cc**。App 与网页共用账号、聊天记录和音乐房间，服务端仍按仓库根目录的 Docker 文档部署。

## 当前已接入

- 原生登录、邀请码注册、群聊、私聊、图片选择及预览。
- `/music`、`/pixiv` 和骰子等命令提示。提交后清空输入框，服务器结果作为 system 消息展示。
- `/pixiv ID`、作品链接的多图返回，以及单张 `i.pximg.net` 链接。
- 表情栏依次为默认、搜索、收藏；长按自己发出的图片可收藏。
- 群聊和私聊各自的音乐房间、点歌与队列、空闲歌单的顺序/随机播放。
- 顶部紧凑半透明播放器、旋转封面、歌词及译文、独立音量。没有当前歌曲时不显示播放器。
- 网易云手机号验证码/MUSIC_U 账号面板；“我”页面提供 Pixiv PHPSESSID 设置。账号管理仅限站点管理员，凭据不会保存在 App 本地配置中。

Android 12 及以上使用原生背景模糊；更旧系统回退为半透明底板。收听需要点击加入或点歌，退出聊天页面会结束该页面的收听。后台播放已配置 Android 媒体服务和锁屏信息，具体设备的后台保活仍待真机验证。

## 最方便的 APK 构建方式：GitHub Actions

不需要在部署 Fiora 的服务器安装 Android 环境，也不需要 Expo 账号。

1. 将这次 App 改动及 `.github/workflows/android-apk.yml` 放入仓库。
2. 打开 GitHub 的 **Actions → Build Android review APK → Run workflow**，选择包含本次改动的分支。
3. 构建完成后，在该次运行的 **Artifacts** 下载 `fiora-android-review-...`，解压取得 APK。
4. 将 APK 安装到 64 位 ARM Android 手机上进行审核。

该流程编译 `assembleRelease`，把 JavaScript 和资源打进 APK，安装后不需要电脑运行 Metro。当前使用 Expo 模板的调试签名供内部审核；正式分发前需要配置自己的长期签名并备份密钥。工作流只上传构建产物，不发布到应用商店，也不改动 Docker 部署。

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

**尚未完成实际 Gradle APK 编译及真机验收**：当前本地只有 Java 11、没有 Android SDK；新增 Actions 工作流尚未推送运行。优先在真机确认登录、图片上传、Pixiv 多图、两端音乐同步、切换房间、锁屏播放及权限弹窗。

远程推送通知还需要 EAS 项目 ID 和 Android FCM 凭据，当前未配置；这不影响 App 打开时通过 Socket 接收消息。iOS 构建、旧版文件/代码消息界面的进一步适配不在此次 Android 验证范围内。
