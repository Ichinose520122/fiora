# 一起听审核版

基线：`7fffc94a4838cc304b5962cf149cfff4d9cbc643`。本次补丁同时包含此前尚未合并的安全修复；不要与旧安全补丁重复应用。

## 已实现

- 收藏表情独立标签，位于在线搜索后面。
- 每个群聊、每对私聊独立队列；首首点歌立即播放，后续排队；空闲歌单让位于点歌。
- `/music 歌名`、`/music local 歌名`、`/music netease 歌名`、`/music qq 歌名`；输入 `/mu` 后 Tab 补全，方向键选择。
- `/music search 关键词` 打开搜索；`/music playlist ID或链接` 导入所选平台歌单；`join`、`leave`、`pause`、`resume`、`vote`、`next` 操作。
- 侧栏与聊天输入功能菜单中的音乐入口，聊天顶部唱片、歌词、个人音量。
- 服务端统一计时与切歌、访问权限检查、请求去重、队列限额、投票去重、Mongo 持久化。服务重启后暂停等待继续播放。
- 群主/管理员控制群房间，私聊双方均可控制；普通成员加入后投票，达到在线听众半数向上取整即可切歌。

## 审核部署

当前地址：http://172.16.24.3:9200 。虚拟机目录 `/opt/fiora-review`，与原有其他项目隔离。没有推送 GitHub。

应用源码在 `source`；Compose 文件在 `/opt/fiora-review/deploy/review.compose.yaml`；账号密码在虚拟机 `secrets/review-password.txt`，测试账号 `reviewer1`、`reviewer2`、`reviewer3`。密钥和账号密码不随补丁发布。

已有镜像时，将补丁应用到 source 后，在 source 目录运行：

```sh
docker build -t fiora-review:latest -f deploy/Dockerfile.review-update .
cd /opt/fiora-review
docker compose --env-file .env -f deploy/review.compose.yaml up -d web
```

全新环境先用 `deploy/setup-review.py` 初始化指定审核目录，按 `Dockerfile.review` 构建主镜像，再按 `Dockerfile.netease` 构建适配器镜像。请先读脚本中的路径与环境配置。审核版使用单个应用进程；多实例需另做分布式房间锁和广播。

## 本地及外部曲库

`MusicDirectory` 指向曲库目录，审核环境为 `/opt/fiora-review/music`。放置音频和 `library.json`，无需重启即可在下次查询读取：

```json
[
  {
    "id": "my-song-1",
    "title": "歌曲名称",
    "artist": "歌手",
    "duration": 180,
    "file": "my-song.mp3",
    "cover": "https://example.com/cover.jpg",
    "lyrics": "[00:00.00]第一句\n[00:10.00]第二句"
  }
]
```

时长单位为秒。`file` 可替换成外部直链 `url`，媒体必须能被客户端访问。音频仅由管理员配置；`/music-files/` 是公开媒体地址，不用于存放私密文件。支持分段请求，配置文件不会通过该路由公开。审核曲库仅为合成测试旋律。

## 平台接口与当前限制

- `NeteaseMusicApi`：审核环境已接内部适配器，搜索已实测通过。适配器 SDK 4.40.1 新播放接口提示缺少 xeapi 公钥，已加入同平台标准旧接口兼容；实际播放链路仍有间歇性失败，需要继续验收，不能当成全部可播。空的 `secrets/netease-cookie.txt` 可由管理员填入自有账号 Cookie。不会解锁付费歌曲，试听结果会被拒绝。
- `QQMusicApi`：已留适配接口，尚未配置真实 QQ 服务，因此当前 QQ 不是开箱即用。适配器提供 GET `/search?keywords=&limit=30` 返回 `{tracks:[...]}`，`/track?id=` 返回 `{track:...}`，`/playlist?id=&limit=50` 返回 `{tracks:[...]}`，`/resolve?id=` 返回 `{track:...,trial:false}`。歌曲字段为 `id,title,artist,duration,cover,url,lyrics`，时长为秒。Cookie 留在适配器，不传给网页。
- 浏览器首次播放需要点击加入；切换聊天会退出原房间。个人音量只影响本客户端。

## 验证与接续点

已通过 28 项本地测试，以及部署环境中三账号的权限隔离、队列、去重、暂停恢复、投票、静态媒体 Range 和网易云搜索检查。生产前端构建已通过。

最新补丁还包含窄屏导航与布局调整，这几处修改尚未重新构建部署及完成浏览器验收。桌面收藏表情位置和唱片旋转已确认；完整双浏览器音频进度同步、手机布局、网易云实际歌曲播放需要继续验收。QQ 需配置适配服务后验收。

虚拟机磁盘曾满导致 Mongo 停止，已恢复；打包前剩余约 737 MB。后续放大量歌曲前需要扩容。日志已设上限。未改动其他项目的数据卷。

测试脚本：`packages/server/test/music.spec.ts`、`musicPersistence.spec.ts` 和 `deploy/test-review.cjs`；后者仅操作种子审核账号的测试房间，会清空这些测试房间队列。
