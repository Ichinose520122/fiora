# Fiora · Ichinose Custom

基于 [Fiora](https://github.com/yinxin630/fiora) 的自用聊天站，维护分支为 **`ichinose-custom`**。服务端与网页使用 Docker Compose 部署，手机 App 源码保留在 `packages/app`，供后续开发。

支持群聊、私聊、表情收藏、图片与文件消息，以及每个聊天独立的“一起听”房间：点歌队列、空闲歌单顺序 / 随机播放、歌词、旋转封面和个人音量。聊天框支持命令补全与 `/pixiv` 发图。

## 部署方式

本项目主要使用“**聊天服务器 + 国内阿里云网易云接口服务器**”的方式部署：搜索、歌单、登录和播放地址解析走国内服务器，避免主站海外 IP 访问网易云时出现的问题。

```text
浏览器 ──HTTPS / WebSocket──> 聊天服务器
                                  │
                                  └──HTTPS + 内部密钥──> 阿里云 music-api ──> 网易云
浏览器 ──播放解析后的音频地址────────────────────────────> 音乐 CDN
```

国内服务器负责音乐接口请求，**不代理浏览器的音频流量**。客户端仍需要能访问返回的音乐地址；账号权限、会员限制和平台风控仍可能影响播放。

主 Compose 也带有本地 `netease` 服务，可用于单机部署。接入阿里云后，默认不自动回退到本地接口，以免请求再次从海外 IP 发出。本地服务仍会启动，但主站优先使用配置的远程地址。

已有阿里云接口、Caddy 和数据卷时，保留现有配置；只对照下面的变量进行接入，不必重建国内服务或更改 Compose 项目名。

## 1. 从零部署需要什么

| 项目 | 用途 |
| --- | --- |
| 一台 Linux x86_64 / amd64 聊天服务器 | 运行 Fiora、MongoDB、Redis；发布的镜像当前为 amd64 |
| 一台能正常访问网易云的国内服务器 | 可使用国内地域的阿里云 ECS，运行本项目的 music-api 镜像 |
| Docker Engine、Compose 插件、Git、OpenSSL | 两台服务器均安装；宿主机不需要单独安装 Node.js、MongoDB 或 Redis |
| 两个域名 | 例如 `chat.example.com` 指向聊天服务器，`music-api.example.com` 指向国内服务器 |
| DNS、端口与出站网络 | 配置 A 记录；只有 IPv6 确实可用时才配置 AAAA。HTTPS 网关需 TCP 80/443，SSH 保留你的管理端口 |
| 可用磁盘与内存 | 保存数据库、图片、曲库和备份；源码构建的 Node 堆上限为 1600 MB，需额外留出系统及容器内存 |
| 网易云账号 | 站点管理员可在音乐面板登录；部分歌曲需要相应会员权限 |

MongoDB 27017、Redis 6379、Fiora 9200 均不需要公开到互联网。国内接口通过 HTTPS 提供服务，3000 端口只绑定本机回环地址。除了主机防火墙，还需检查云平台安全组。

### 安装 Docker（全新 Ubuntu 22.04 / 24.04）

下面命令在两台服务器分别执行。使用 root shell；非 root 用户先执行 `sudo -i`。已有 Docker 环境只需确认 `docker compose version` 正常，不要重复覆盖安装。

```sh
apt-get update
apt-get install -y ca-certificates curl git openssl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${UBUNTU_CODENAME:-$VERSION_CODENAME}
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
docker version
docker compose version
```

其他系统、旧版 Docker 升级和软件源连通问题，参考 [Docker 官方安装文档](https://docs.docker.com/engine/install/)。Ubuntu 命令依据 [官方 apt 安装说明](https://docs.docker.com/engine/install/ubuntu/)。

## 2. 国内阿里云：部署网易云接口

**已有本项目 music-api 的用户可跳到第 3 节**，复用原来的 HTTPS 地址、密钥和登录数据。普通的 NeteaseCloudMusicApi 镜像不一定包含本项目的 `/auth/*` 登录接口，不能直接视作同一服务。

首次部署，在国内服务器执行：

```sh
mkdir -p /opt
cd /opt
git clone --branch ichinose-custom --single-branch https://github.com/Ichinose520122/fiora.git fiora-music
cd /opt/fiora-music
cp deploy/netease.env.example deploy/netease.env
openssl rand -hex 32
chmod 600 deploy/netease.env
```

编辑 `deploy/netease.env`：

```dotenv
NETEASE_DOMAIN=music-api.example.com
NETEASE_API_TOKEN=上一步生成的64位十六进制密钥
NETEASE_BIND_PORT=3000
```

这把密钥用于聊天服务器与音乐服务之间的鉴权，稍后原样填到聊天服务器的 `NETEASE_API_TOKEN`。它与聊天 JWT 密钥、网易云 Cookie 是三种不同的凭据。

### 国内服务器还没有 HTTPS 反向代理

确认域名解析正确、80/443 空闲，使用附带的 Caddy：

```sh
cd /opt/fiora-music
docker compose --env-file deploy/netease.env -p fiora-music -f deploy/netease.compose.yaml --profile https config --quiet
docker compose --env-file deploy/netease.env -p fiora-music -f deploy/netease.compose.yaml --profile https up -d --build
docker compose --env-file deploy/netease.env -p fiora-music -f deploy/netease.compose.yaml --profile https ps
curl -fsS https://music-api.example.com/health
```

`/health` 返回 `{"ok":true}` 表示服务能被访问，不代表网易云已经登录或歌曲一定可播放。普通音乐 API 与登录 API 均需内部密钥。

### 国内服务器已有 HTTPS 反向代理

仅启动音乐服务：

```sh
docker compose --env-file deploy/netease.env -p fiora-music -f deploy/netease.compose.yaml up -d --build netease
```

让现有代理把 `music-api.example.com` 转发到 `127.0.0.1:3000`，并保留 `X-Music-Auth` 请求头。这个地址适用于**运行在宿主机上的代理**；如果代理也在容器中，应把两个容器接入同一个 Docker 网络，通过音乐容器的服务名访问 3000，不能使用代理容器自己的 `127.0.0.1`。

网易云账号保存在这个 Compose 项目的 `music_account` 数据卷中。不要为了换部署目录或改项目名而创建一套空数据卷。

## 3. 聊天服务器：配置主站

在聊天服务器执行：

```sh
mkdir -p /opt
cd /opt
git clone --branch ichinose-custom --single-branch https://github.com/Ichinose520122/fiora.git fiora
cd /opt/fiora
cp .env.example .env
openssl rand -hex 32
chmod 600 .env
sh scripts/setup-storage.sh
```

编辑 `.env`，使用你自己的域名和密钥：

```dotenv
FIORA_DOMAIN=chat.example.com
FIORA_JWT_SECRET=为主站单独生成的64位十六进制密钥
FIORA_INVITE_CODE=
DisableRegister=false
FIORA_TRUST_PROXY_HEADERS=true
FIORA_ADMINISTRATOR=

NETEASE_API_URL=https://music-api.example.com
NETEASE_API_TOKEN=与国内music-api完全相同的密钥
NETEASE_API_FALLBACK=
```

| 变量 | 说明 |
| --- | --- |
| `FIORA_DOMAIN` | 只有域名，不带 `https://`、路径或末尾斜杠 |
| `FIORA_JWT_SECRET` | 用于聊天登录，首次随机生成；更新时保留原值 |
| `FIORA_INVITE_CODE` | 可选注册邀请码，留空表示不要求通用邀请码 |
| `DisableRegister` | 注册开放时为 `false`，关闭新注册时为 `true` |
| `FIORA_TRUST_PROXY_HEADERS` | 主站仅经可信反向代理访问时使用 `true`；直接公开应用端口时改为 `false` |
| `FIORA_ADMINISTRATOR` | 可选用户数据库 ID，多个用逗号分隔；通常使用下一节的管理员命令即可 |
| `NETEASE_API_URL` | 国内接口根地址，不追加 `/search`、`/auth` 等路径 |
| `NETEASE_API_TOKEN` | 国内服务的 `MusicAuthToken`，至少 32 个字符 |
| `NETEASE_API_FALLBACK` | 默认为空；有需要才填 `http://netease:3000` 启用本地回退 |

这些变量会由 Compose 显式传入容器。只在 `.env` 随意写一个未映射的变量，并不会让应用自动读取它，见 [Compose 环境变量说明](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)。

**单机部署**：如果主站本身就在能访问网易云的国内网络，可把 `NETEASE_API_URL` 设为 `http://netease:3000`，`NETEASE_API_TOKEN` 留空。本地服务会自动生成共享密钥，主站通过只读数据卷读取，无需人工复制。

### 启动主站

首次建立反向代理网络，然后构建并启动：

```sh
cd /opt/fiora
docker network inspect caddy-proxy >/dev/null 2>&1 || docker network create caddy-proxy
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 fiora
```

Compose 会启动 Fiora、MongoDB、Redis 和本地音乐服务。Fiora 等依赖健康后启动；首次启动还会缓存 QQ 表情。

如果源码已经推送且 GitHub Actions 的镜像构建成功，可以使用发布镜像，免去服务器构建：

```sh
docker compose pull
docker compose up -d --no-build
```

镜像标签为 `ghcr.io/ichinose520122/fiora:ichinose-custom` 和 `ghcr.io/ichinose520122/fiora:music-api`。国内服务器无法拉取 GHCR 时，可在能拉取的机器执行 `docker save`，传输后在国内机器 `docker load`；不要用其他 API 镜像替代本项目音乐镜像来碰运气。

### 给主站配置 HTTPS

如果当前没有占用 80/443 的反向代理，执行：

```sh
cd /opt/fiora
docker compose --env-file .env -p fiora-gateway -f deploy/caddy.compose.yaml up -d
```

这个命令单独启动 Caddy，不改变主站的 Compose 项目名和数据卷。Caddy 根据域名申请证书，具体前提见 [Caddy HTTPS 文档](https://caddyserver.com/docs/quick-starts/https)。

**已有 Docker Caddy 的用户不需要再启动一份。** 将 Caddy 接入 `caddy-proxy` 网络，在自己的 Caddyfile 中添加并重载：

```caddyfile
chat.example.com {
    encode zstd gzip
    reverse_proxy fiora:9200
}
```

Fiora 使用 WebSocket，Caddy 的 `reverse_proxy` 可以代理。不要将整个 `packages/server/public` 挂载到宿主机，会遮住镜像内编译好的网页。

## 4. 注册账号、设置管理员、登录网易云

1. 浏览器打开 `https://chat.example.com`，注册并登录聊天账号。
2. 在聊天服务器把该账号设为管理员，参数填**登录账号名 / 洛克王国 ID**，不是展示昵称：

```sh
cd /opt/fiora
docker compose exec fiora ../../node_modules/.bin/ts-node --transpile-only ../bin/index.ts setAdmin "你的登录账号" true
```

3. 退出聊天账号并重新登录，以刷新当前连接权限。
4. 打开左侧“音乐 → 网易云账号”，用手机号和验证码登录；短信被平台风控拦截时，可以使用界面里的 `MUSIC_U` 登录。
5. 搜索并点一首可完整播放的歌。浏览器阻止自动播放时，点击播放器的“加入”或“重试”。

这是**服务器共用的网易云账号**，仅站点管理员可管理；其他聊天用户不需要分别登录网易云。使用远程接口时，登录请求和账号保存都发生在国内服务上，不在浏览器保存网易云 Cookie，也不要把凭据发到聊天框。

取消数据库中的管理员权限：

```sh
docker compose exec fiora ../../node_modules/.bin/ts-node --transpile-only ../bin/index.ts setAdmin "你的登录账号" false
```

若同时在 `FIORA_ADMINISTRATOR` 中配置过该用户 ID，也要删除该 ID 并重建 Fiora；已建立的连接需要重新登录才会刷新权限。

## 5. 音乐、本地曲库与 Pixiv

| 操作 | 用法 |
| --- | --- |
| 点歌 | `/music 歌名`，也支持网易云歌曲 ID / 完整链接 |
| 搜索 | `/music search 关键词`，system 搜索结果可点击点歌 |
| 选择来源 | `/music netease 歌名`、`/music local 歌名` |
| 导入歌单 | 音乐面板“导入歌单”，可加入队列、仅保存或设为空闲歌单 |
| 查看队列 | `/music list` 或音乐面板“播放队列” |
| 加入 / 退出 | `/music join`、`/music leave` |
| 投票切歌 | `/music vote` |
| 管理播放 | 有控制权限时使用 `/music pause`、`/music resume`、`/music next` |
| Pixiv 发图 | `/pixiv 作品ID` 或 `/pixiv https://www.pixiv.net/artworks/作品ID` |
| 其他命令 | `-roll`、`-roll 1000`、`-rps` |

群聊和私聊各有独立音乐房间。点歌优先进入队列；队列结束后继续空闲歌单。群主、站点管理员或私聊参与者可在“导入歌单”选择空闲播放模式，默认顺序，也支持随机。当前没有歌曲时隐藏顶部播放器。

### 本地歌曲

在聊天服务器的 `/opt/fiora/music/` 放音频和 `library.json`，例如：

```text
music/
├── library.json
└── sample.mp3
```

`library.json`：

```json
[
  {
    "id": "local-001",
    "title": "示例歌曲",
    "artist": "歌手",
    "duration": 180,
    "file": "sample.mp3",
    "lyrics": "[00:00.00]第一行歌词\n[00:12.00]第二行歌词"
  }
]
```

`duration` 为实际秒数；`file` 为曲库根目录中的文件名。也可用 `url` 字段提供客户端能访问的 HTTPS 音频地址。目录已只读挂载到容器，添加歌曲后重新搜索即可。

QQ 音乐保留了自定义 API 入口，但没有随本部署提供 QQ 服务；本文默认部署网易云和本地曲库。

### Pixiv

支持 `/pixiv 作品ID` 和 `/pixiv 作品页链接`，多图按页全部发送。`/pixiv https://i.pximg.net/...jpg` 只发送链接对应的那张图片；也可以把完整的 HTTPS 图片直链单独粘贴到聊天框发送。直链保留原本的页码和清晰度，不会转换成整组作品。支持 JPG、PNG、GIF、WebP。

图片由**聊天服务器**下载并保存在 `uploads/ImageMessage`，聊天服务器必须能访问 Pixiv 和 `i.pximg.net`，与阿里云音乐接口无关。客户端读取本站保存的图片，避免直接外链的防盗链限制。

需要登录才能访问的作品，可由站点管理员连接一个站点共用的 Pixiv 账号：

1. 在浏览器登录 [Pixiv 官网](https://www.pixiv.net/)。
2. 按 F12，打开 **Application（应用）→ Cookies → https://www.pixiv.net**，复制 `PHPSESSID` 的 Value。Firefox 在“存储”面板查找。
3. 在聊天室侧栏打开 **管理员控制台 → Pixiv 账号**，粘贴到密码输入框，点击 **验证并保存**。请使用 HTTPS，不要把凭据发在聊天、日志或 GitHub。
4. 保存成功后，所有用户的作品 ID / 作品页请求会使用该账号。可点击 **验证已保存状态** 检查是否过期，失效后重新导入。**移除登录** 仅删除聊天服务器保存的凭据，不会退出浏览器中的 Pixiv。

采用网页登录状态导入，无需提交 Pixiv 密码。此接入使用 Pixiv 网页接口，接口或风控变化可能需要调整；账号本身没有查看权限、作品删除、网络不可达的问题不会因登录而自动解决。

Docker Compose 已包含 `PixivAccountFile: /pixiv-auth/account.json` 和 `pixiv_account:/pixiv-auth` 持久卷，重建主站容器后登录状态仍保留。凭据存放在静态文件目录之外，不回传给客户端，也不发送给图片 CDN。

**已有部署升级：** 本次只需要更新主站，阿里云网易云服务无需变更。拉取新代码和主站镜像后，确认自己的 Compose 中 `fiora.environment` 有上述路径、`fiora.volumes` 有上述挂载，且顶层 `volumes` 声明了 `pixiv_account:`；然后执行 `docker compose up -d --no-deps --force-recreate fiora`。自定义 Compose 请保留现有网易云地址、令牌和其他配置。

单张上限 20 MB，整组上限 100 MB / 200 张；不可访问或超过限制会返回 system 提示，不会悄悄只发一部分。

## 6. 更新与备份

### 更新代码

保留原部署目录、Compose 项目名、`.env` 和数据卷：

```sh
cd /opt/fiora
sh scripts/backup-local.sh
git pull --ff-only origin ichinose-custom
docker compose config --quiet
docker compose up -d --build
```

如果使用发布镜像，等本次 Actions 构建成功后，改用 `docker compose pull && docker compose up -d --no-build`。只更新代码但继续运行旧镜像不会生效。

国内服务使用独立配置；首次按本 README 部署的实例可执行：

```sh
cd /opt/fiora-music
git pull --ff-only origin ichinose-custom
docker compose --env-file deploy/netease.env -p fiora-music -f deploy/netease.compose.yaml --profile https up -d --build
```

使用已有反向代理的国内实例，去掉 `--profile https`，并在命令末尾指定 `netease`。既有实例按自己的原 Compose 文件和项目名更新。

### 保存了哪些数据

| 位置 | 内容 |
| --- | --- |
| 主站 `mongodb_data`、`mongodb_config` | 用户、聊天记录、群聊与音乐房间状态 |
| 主站 `redis_data` | Redis 持久化状态 |
| 主站 `uploads/` | 头像、背景、文件、图片（含 Pixiv）与 QQ 表情缓存 |
| 主站 `pixiv_account` 卷 | Pixiv 登录凭据，备份需保密 |
| 主站 `music/` | 本地音频及曲库配置 |
| 主站 `music_internal` | 本地音乐服务自动生成的内部密钥 |
| 音乐服务所在主机的 `music_account` | 网易云登录信息；远程模式需备份国内服务的数据卷 |
| Caddy 的 `caddy_data`、`caddy_config` | 证书与代理运行数据 |
| `.env`、`deploy/netease.env` | 域名、JWT 密钥、服务间密钥等配置 |

表中为 Compose 逻辑卷名，实际名称带项目名前缀。普通 `docker compose down` 保留命名数据卷；**不要使用 `down -v` 清理正在使用的数据**。

### 本地与异地备份

```sh
cd /opt/fiora
sh scripts/backup-local.sh
```

此脚本备份 **MongoDB 和 uploads**，生成 `backups/<UTC时间>/mongodb.archive.gz`、`uploads.tar.gz` 和校验清单。它不包含 `music/`、配置文件、Redis、音乐账号或 Caddy 数据卷；这些内容按上表另行备份。数据库与文件不是事务快照，重要迁移前可暂停聊天写入。

可选 Cloudflare R2 异地备份仍保留，上传的是上述备份目录：

```sh
cp scripts/r2.env.example r2.env
chmod 600 r2.env
# 编辑 r2.env，填写 R2 的 S3 凭据、桶名等
set -a
. ./r2.env
set +a
sh scripts/backup-r2.sh
```

脚本可通过 Docker 运行 AWS CLI，宿主机不必单独安装。备份默认不自动删除，请按磁盘容量和保留周期管理。备份含账号数据，配置与网易云 Cookie 不要提交到 Git。

## 7. 常见问题

| 现象 | 检查方向 |
| --- | --- |
| 主站 502 | `docker compose ps`、`docker compose logs --tail=100 fiora`；Caddy 与 Fiora 是否同在 `caddy-proxy` |
| HTTPS 证书申请失败 | 域名 A / AAAA 记录、80/443、安全组及是否已有服务占用端口 |
| 提示 caddy-proxy 网络不存在 | 先执行 `docker network create caddy-proxy` |
| 网易云接口不可用 | 国内服务健康状态、HTTPS 连通、主站 URL、两边密钥是否一致；修改环境变量后需 `up -d` 重建容器，单纯 restart 不会更新环境 |
| 健康检查正常但登录失败 | `/health` 只检查进程；确认是本项目 music-api，检查国内服务日志与平台风控 |
| 搜索正常但某首无法播放 | 登录状态、会员 / 版权 / 试听限制；尝试其他歌曲，确认浏览器能访问音乐 CDN |
| 没声音 | 点击“加入 / 重试”，检查个人音量、标签页静音与浏览器自动播放限制 |
| Pixiv 下载失败 | 检查聊天服务器网络、作品访问权限和体积；需要登录时在管理员控制台连接 Pixiv 并验证状态。已有 pximg 直链可单独发送 |
| 上传或账号重建后丢失 | 核对是否换了部署目录、Compose 项目名或数据卷挂载；不要直接删除旧卷 |
| 构建被系统终止 | 查看内存占用，优先使用已发布镜像；Docker 构建仍需要访问镜像仓库和 npm / Yarn 软件源 |

## 仓库结构与维护范围

- `docker-compose.yaml`、`Dockerfile`：主站部署与构建。
- `deploy/`：国内 music-api、可选 Caddy、Docker 构建辅助与网易云登录适配。
- `packages/web`、`server`、`config`、`database`、`utils`、`assets`：网页与后端依赖，Docker 构建必需。
- `packages/bin`：容器内管理员和维护工具。
- `packages/app`：保留的旧版手机 App；不参与 Docker 构建，本次未验证其构建及新功能兼容性。
- `scripts/`：存储初始化、本地备份和 R2 备份。

旧文档站和临时审核部署文件已清理，部署说明统一以本 README 为准。网页 / 服务端源码测试与开发配置保留；GitHub Actions 提供 Docker 镜像构建和 CodeQL 分析。

## 贡献者与 AI 协作

| 贡献者 / 工具 | 参与内容 |
| --- | --- |
| [yinxin630 及 Fiora 原项目贡献者](https://github.com/yinxin630/fiora/graphs/contributors) | 原项目设计、开发与维护 |
| [Ichinose520122](https://github.com/Ichinose520122) | 本分支需求、定制方向、审核、部署与维护 |
| ChatGPT（OpenAI） | AI 协作：需求梳理、方案讨论与文档辅助 |
| Codex（OpenAI） | AI 协作：代码实现、问题排查、针对性验证与仓库整理 |

感谢 ChatGPT 和 Codex 在本项目定制过程中的协助。AI 工具署名用于记录协作，项目的最终审核、发布和维护由维护者负责。

## 许可与依赖致谢

基于 [yinxin630/fiora](https://github.com/yinxin630/fiora)，遵循 [MIT License](LICENSE)，保留原作者版权声明。网易云接口使用 [NeteaseCloudMusicApiEnhanced](https://github.com/neteasecloudmusicapienhanced/api)。
