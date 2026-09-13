# music 分支增量更新（2026-09-14）

本次基于 GitHub `music` 分支提交 `5dbbdf6a399815c264ffb1c6d4a3c1317e2f446e`，保留该分支已合并的安全更新。不要再叠加 2026-09-13 的旧完整补丁。

## 变化

- `/music` 按 Enter 或发送按钮后立即清空输入框。成功、失败、搜索结果均由服务器生成 `system` 消息，与 `-roll` 一样存入当前群聊/私聊历史并发送给聊天成员。输入中的下一条消息不会在旧请求完成时被清除。Tab 用于补全，Enter 用于发送。
- 命令提示框半透明；顶部音乐区域换成紧凑半透明布局，显示旋转唱片、标题、歌手/专辑、点歌人、歌词及可用的译词、进度和待播队列，保留个人音量。
- 音乐面板增加“网易云账号”。站点管理员可以发送短信验证码、登录、查看状态和退出。`/music login` 打开该面板；不要将手机号、验证码、Cookie 写进聊天指令。
- 与 mod 的服务器账号方式一致，登录账号为全站音乐播放使用，普通用户仍可点歌。这里只管理网易云登录，不改变聊天室登录。

## 应用补丁

在干净的上述基线项目根目录执行（路径换成实际补丁路径）：

```sh
git apply --check /path/to/fiora-music-update.patch
git apply /path/to/fiora-music-update.patch
```

压缩包 `files/` 同时附带所有改动文件。不要直接覆盖自己更新过的冲突文件。

## 账号服务部署

主应用需要 `NeteaseMusicApi` 和 `MusicAuthToken`；适配器使用同一个 `MusicAuthToken`。审核 Compose 已配置这些字段。运行 `deploy/setup-review.py` 会在 `/opt/fiora-review/.env` 添加随机 `FIORA_MUSIC_AUTH_TOKEN`，保留已有密钥和曲库；同时创建 `data/music-auth`。

`data/music-auth/account.json` 持久化网易云 Cookie，仅服务端读取，不加入 Git。短信验证码不落盘、不进入聊天历史。旧的 `secrets/netease-cookie.txt` 作为首次登录前的兼容来源保留；在页面退出后不会自动重新使用旧 Cookie。

若当前聊天室账号还不是站点管理员，可在审核 `.env` 中设置 `FIORA_ADMINISTRATOR=你的聊天室用户ID`（多个 ID 用逗号分隔），重建容器后重新登录聊天室。已有数据库管理员账号无需此项。

假设源码仍部署在 `/opt/fiora-review/source`，在该目录应用补丁后：

```sh
python3 deploy/setup-review.py
cp deploy/review.compose.yaml /opt/fiora-review/deploy/review.compose.yaml
docker build -t fiora-review:latest -f deploy/Dockerfile.review-update .
docker build -t fiora-review-netease:4.40.1 -f deploy/Dockerfile.netease-update .
cd /opt/fiora-review
docker compose --env-file .env -f deploy/review.compose.yaml up -d web netease
```

上述增量构建依赖原审核镜像。若镜像也丢失，先按 `Dockerfile.review` 构建主镜像，再按 `Dockerfile.netease` 构建适配器；源代码必须是已打本次补丁的最新 music 分支。账号服务内部路径为 POST `/auth/status`、`/auth/send-code`、`/auth/login`、`/auth/logout`，适配器不发布公网端口。

## 本次验证及边界

- 生产前端构建通过（保留原项目的资源体积警告）。
- 仅执行本次必要检查：指令失败回复、普通用户无法发送验证码/修改账号，以及模拟登录时凭据保存与退出；没有发送真实短信，也未进行大范围回归测试。
- 2026-09-14 连接 `172.16.24.3:22` 两次超时，本次未改虚拟机，未推送 GitHub。
- 真实手机号登录需要管理员在页面验收；网易云可能要求额外验证，遇到此情况会提示在官方客户端处理，不绕过平台验证。VIP、地区及歌曲可播性仍由网易云账号权限决定。
- QQ 接口保留此前方式，本次未新增 QQ 账号登录。

参考：
- AllMusic：https://github.com/Coloryr/AllMusic
- mod 网易云接口示例：https://github.com/Coloryr/netapi
- 网易云适配器登录文档：https://neteasecloudmusicapienhanced.js.org/
