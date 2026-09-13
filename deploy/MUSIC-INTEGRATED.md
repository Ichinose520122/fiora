# 音乐服务已整合进主部署

本说明取代此前需要单独部署音乐适配器的步骤。使用项目根目录的 `docker-compose.yaml`，不要混用 `/opt/fiora-review` 的审核配置。

在现有项目目录更新源码后，保留原 `.env`，运行：

```sh
docker compose up -d --build
```

会一起构建并启动聊天室、网易云服务、MongoDB、Redis。音乐服务先生成内部连接密钥，通过健康检查后再启动聊天室。不需要手动填 `NeteaseMusicApi`、`MusicAuthToken`，也不需要单独运行 Python 初始化脚本。

随后以聊天室站点管理员登录，打开“音乐 → 网易云账号”，填写手机号和验证码即可。普通用户可以搜索、点歌。已有数据库 `isAdmin: true` 的账号继续有效。

主应用改用此前审核环境使用的 Node.js 22 构建方式，音乐服务使用独立的 Node.js 22 镜像，不依赖任何 `fiora-review` 镜像。

## 保存位置

- 网易云登录：Compose 的 `music_account` 数据卷，重建容器后保留。
- 内部随机密钥：`music_internal` 数据卷，自动生成且重复启动不会覆盖；聊天室只读挂载。它与聊天室 JWT 密钥分开。
- 本地歌曲：宿主机项目目录的 `music/`，按已有 `library.json` 格式放文件即可。
- 原有 MongoDB、Redis 数据卷和上传目录挂载保持原名、原路径。继续在原项目目录执行部署，保持原 Compose 项目名。

音乐服务只连接内部 Docker 网络，没有公开端口。原有 Caddy 外部网络 `caddy-proxy` 和域名配置继续使用。

## GitHub 镜像

原 GitHub Actions 工作流现在同时构建：

- `ghcr.io/ichinose520122/fiora:music`
- `ghcr.io/ichinose520122/fiora:music-api`

只有你推送本次源码且工作流成功后，这两个更新后的镜像才可拉取。届时可改用：

```sh
docker compose pull
docker compose up -d
```

当前交付只修改了本地源码，没有推送 GitHub、发布镜像或修改服务器。

## 验证范围

本次仅做 Compose 结构、启动依赖、镜像标签和自动密钥持久化检查；没有运行大范围回归。当前电脑没有 Docker 命令，未完成容器实际启动验收。真实网易云短信登录仍由管理员在部署后的页面完成。
