# Docker 部署

当前生产形态是单个应用容器加单个 Redis 容器，不再依赖 PostgreSQL、SQLite bind mount、迁移 sidecar 或双实例滚动切换。

## 1. 准备文件

服务器目录至少需要：

```text
compose.yaml
deploy/.env.example
deploy/update.sh
```

示例：

```bash
sudo mkdir -p /opt/friberg
sudo cp compose.yaml /opt/friberg/compose.yaml
sudo cp deploy/.env.example /opt/friberg/.env
sudo cp deploy/update.sh /opt/friberg/update.sh
cd /opt/friberg
sudo chmod 600 .env
sudo chmod 700 update.sh
```

## 2. 配置环境变量

编辑 `/opt/friberg/.env`：

```dotenv
IMAGE=ghcr.io/your-org/friberg-lol-guess:latest
APP_PORT=3000
TRUST_PROXY=true
CORS_ORIGINS=https://game.example.com
REDIS_PREFIX=friberg:
REDIS_COMMAND_TIMEOUT_MS=1500
```

说明：

- `IMAGE` 必填，建议固定为自己的 GHCR 镜像标签
- `CORS_ORIGINS` 必须是精确的公网 Origin，多个值用逗号分隔
- `APP_PORT` 默认监听本机 `127.0.0.1:3000`

## 3. 首次启动

```bash
docker compose pull
docker compose up -d
docker compose ps
docker compose logs -f app redis
```

健康检查：

```bash
curl http://127.0.0.1:3000/api/health
```

当前应用镜像直接启动 `server/dist/index.js`。运行时题库在镜像构建阶段打包进 `server/dist/db/seeds/*.json`，不依赖宿主机数据目录。

## 4. 更新

仓库自带的更新脚本会：

- 校验 compose 配置
- 拉取 `app` 和 `redis`
- 先确认 Redis 健康
- 强制重建 `app`
- 等待 `app` 健康后结束

执行：

```bash
cd /opt/friberg
sudo ./update.sh
```

可选参数：

```bash
sudo UPDATE_HEALTH_TIMEOUT_SECONDS=300 ./update.sh
sudo PRUNE_OLD_IMAGES=1 ./update.sh
```

## 5. 反向代理

建议通过 Nginx 或 Caddy 暴露服务，只把容器端口绑定到 `127.0.0.1`。

Nginx 需要透传：

```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

如果前面只有一层可信代理，应用侧保持 `TRUST_PROXY=true`。

## 6. 运营注意事项

- Redis 现在持有进行中的对局状态；如果 Redis 不可用，生产环境不会降级为内存模式
- 当前 MVP 没有账号、后台、排行榜持久化，不要按旧版 CSGO 文档理解部署语义
- 上线前完成 [../LEGAL_AND_LAUNCH_GATES.md](../LEGAL_AND_LAUNCH_GATES.md) 中的品牌、AGPL、数据来源和 Riot 素材检查
