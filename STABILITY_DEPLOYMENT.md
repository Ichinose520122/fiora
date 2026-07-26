# Fiora 稳固优化部署说明

本次不做 Go 重写，也不更换 Node.js 运行时。改动集中在上传文件持久化、MongoDB/上传文件备份、R2 异地备份、可信代理真实 IP、在线状态准确性和低风险数据库索引。

## 1. 先理解现有 `.env`

你当前的配置大致是：

```env
FIORA_JWT_SECRET=保留你原来的值
FIORA_DOMAIN=chat.nekopara.cc
DisableRegister=false
FIORA_INVITE_CODE=nekopara
```

`FIORA_JWT_SECRET` 是登录令牌的签名密钥，不是 MongoDB 密码，也与代理真实 IP 无关。当前 Compose 中 MongoDB 没有设置账号密码，但它只连接内部 Docker 网络、没有公开端口；这次不贸然启用 MongoDB 鉴权，以免造成停机或旧数据无法连接。

再增加：

```env
FIORA_TRUST_PROXY_HEADERS=true
```

你的 Fiora 没有公开 `9200` 端口，只通过同机 Caddy 网络访问，因此可以设为 `true`。前提是 Caddy 必须覆盖客户端传入的 `X-Forwarded-For`；默认的 Caddy `reverse_proxy` 会管理这个请求头。若以后直接公开 9200，必须改回 `false`。

## 2. 第一次加上传目录挂载前，复制容器内旧文件

必须在重建 Fiora 容器前执行，否则新的空目录挂载会暂时遮住镜像或旧容器中的文件：

```sh
cd /opt/fiora

mkdir -p \
  uploads/Avatar \
  uploads/BackgroundImage \
  uploads/FileMessage \
  uploads/GroupAvatar \
  uploads/ImageMessage

container_id=$(docker compose ps -q fiora)
public_root=/usr/app/fiora/packages/server/public

for directory in Avatar BackgroundImage FileMessage GroupAvatar ImageMessage; do
  if docker compose exec -T fiora test -d "$public_root/$directory"; then
    docker cp \
      "$container_id:$public_root/$directory/." \
      "./uploads/$directory/"
  fi
done
```

检查复制结果：

```sh
du -sh uploads/*
find uploads -type f | wc -l
```

不要把整个 `packages/server/public` 挂载出去，否则会遮住镜像中编译好的网页文件。本项目只挂载五个上传子目录。

## 3. 部署修改后的源码

先给当前镜像保留一个本地回退标签：

```sh
docker image tag \
  ghcr.io/ichinose520122/fiora:custom \
  ghcr.io/ichinose520122/fiora:before-stability
```

将交付包内容上传到 `/opt/fiora`，保留原来的 `.env`，然后执行：

```sh
cd /opt/fiora
sh scripts/setup-storage.sh
docker compose config --quiet
docker compose build fiora
docker compose up -d
docker compose ps
docker compose logs --tail=100 fiora
```

确认五个挂载已经生效：

```sh
docker inspect "$(docker compose ps -q fiora)" \
  --format '{{json .Mounts}}'
```

输出中应出现五个 `Type: bind`，目标分别是 `Avatar`、`BackgroundImage`、`FileMessage`、`GroupAvatar` 和 `ImageMessage`。

若需要回退代码镜像：

```sh
docker image tag \
  ghcr.io/ichinose520122/fiora:before-stability \
  ghcr.io/ichinose520122/fiora:custom
docker compose up -d --no-deps --force-recreate fiora
```

MongoDB、Redis 和五个宿主机上传目录不会因回退 Fiora 镜像而被删除。

## 4. 本地备份

运行：

```sh
cd /opt/fiora
sh scripts/backup-local.sh
```

每次会创建：

```text
backups/<UTC 时间>/
├── mongodb.archive.gz
├── uploads.tar.gz
└── manifest.sha256
```

校验某次备份：

```sh
cd /opt/fiora/backups/<UTC 时间>
sha256sum --check manifest.sha256
docker compose exec -T mongodb \
  mongorestore --archive --gzip --dryRun \
  < mongodb.archive.gz
```

脚本使用临时目录和最终原子改名；备份失败时不会留下一个看似完整的最终目录。并发任务遇到相同临时目录时会拒绝运行，不会互相删除文件。

脚本默认不自动删除旧备份。建议确认 R2 连续备份成功后，在 R2 控制台设置生命周期规则，例如保留 30 或 90 天；本地只保留你能接受的最近几份，避免磁盘被历史备份占满。

## 5. 备份到 Cloudflare R2

需要的是 R2 的 S3 凭据：

- Access Key ID
- Secret Access Key
- Account ID
- Bucket 名称

普通 Cloudflare API Key/API Token 不能直接替代这组 S3 凭据。令牌权限只给备份 Bucket 的 Object Read & Write。

在服务器创建 `/opt/fiora/r2.env`，不要提交到 Git：

```env
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PREFIX=fiora-backups
```

执行：

```sh
chmod 600 /opt/fiora/r2.env
cd /opt/fiora
set -a
. /opt/fiora/r2.env
set +a
sh scripts/backup-r2.sh
```

R2 脚本会先生成本地备份并校验 SHA-256，再上传。服务器装有 AWS CLI 时直接使用；没有时自动运行 `amazon/aws-cli:2` 容器。密钥只从环境变量读取。

每天 03:20 的 cron 示例：

```cron
20 3 * * * cd /opt/fiora && set -a && . /opt/fiora/r2.env && set +a && /bin/sh scripts/backup-r2.sh >> /var/log/fiora-backup.log 2>&1
```

先手工完整执行一次并在 R2 中确认三个文件都存在，再添加 cron。

## 6. 在线状态变化

- “服务器已连接/连接已断开”只表示浏览器与 Fiora Socket 服务的连接。
- “对方在线/对方离线”表示目标用户是否存在有效 Socket。
- 群组显示在线人数。
- 查询失败或服务器断开时显示“状态未知”，不再错误显示离线。
- 服务端用户和群组在线缓存为 10 秒。
- Socket 登录和断开时主动清除相关缓存。
- 仍保留一分钟轮询，作为保守的最终一致性兜底。

## 7. 数据库低风险优化

新增的都是非唯一索引，旧库即使已有重复数据也不会因此阻塞启动：

- `messages`: `{ to: 1, createTime: -1 }`
- `histories`: `{ user: 1, linkman: 1 }`
- `sockets`: `{ user: 1 }`
- `notifications`: `{ user: 1 }`
- `friends`: `{ from: 1, to: 1 }`

历史已读位置从“先查询、再写入”改成一次原子 `upsert`，并等待写入完成。唯一约束、重复数据清理和更激进的数据结构调整暂缓。
