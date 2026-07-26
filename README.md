# 弗一把 · 英雄联盟版（20 人端到端样板）

一个基于《英雄联盟》职业选手信息的猜选手小游戏。当前仓库以 MVP 为准：前端是单页应用，后端提供 JSON 种子驱动的猜题 API，运行时依赖 Redis，不依赖 PostgreSQL。

仓库内当前生成的数据快照校验时间为 `2026-07-26`。CI 会在构建和发布前检查数据是否超过 14 天未复核。

当前提交按计划先交付 20 人端到端样板：完整版 20 人，知名池 12 人。数据流水线、校验规则和人工审阅门槛已就绪；80 / 220 是正式题库的扩充目标，不是当前样板已经达到的数量。

## 当前范围

- 单人猜选手流程：开始、搜索、提交猜测、放弃、退出
- `easy` / `normal` 两个难度
- 运行时使用同步后的 `server/src/db/seeds/*.json` 作为只读题库
- Redis 用于进行中对局状态
- LoL 数据流水线：抓取夹具、生成、校验、差异审阅、同步运行时种子

## 当前非目标

- 不包含 Riot 官方 API 集成
- 不包含 Riot 英雄头像、战队 Logo、官方素材打包
- 不包含当前可上线的账号体系、后台管理、排行榜、多人房间
- 不把缺失 GCD 记录静默推断成 `free_agent` 或 `demoted`

## 本地开发

环境要求：

- Node.js 22+
- pnpm 11+
- Redis 7.x

安装并启动：

```bash
pnpm install
cp .env.example .env
pnpm dev
```

默认地址：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:3000`

如果本机没有 Redis，可保留 `.env` 中的 `REDIS_REQUIRED=false`，后端会退化为内存态对局存储，仅适合本地开发。

## MVP 环境变量

根目录 `.env` 仅保留当前 MVP 真正使用的配置：

```dotenv
PORT=3000
TRUST_PROXY=false
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://127.0.0.1:3000
REDIS_URL=redis://127.0.0.1:6379
REDIS_PREFIX=friberg:
REDIS_REQUIRED=false
REDIS_COMMAND_TIMEOUT_MS=1500
```

## 数据同步与审阅流程

数据链路：

- 源：Riot GCD CSV + Leaguepedia 页面 / 战绩页
- 生成：`data/generated/*.json`
- 审阅：`data/generated/proposed-player-changes.md`
- 运行时题库：`server/src/db/seeds/players.json` 与 `server/src/db/seeds/easy-players.json`

推荐流程：

```bash
node --test scripts/tests/lol-data.test.mjs
node scripts/fetch-lol-data-fixtures.mjs
node scripts/build-lol-data.mjs
node scripts/validate-lol-data.mjs
node scripts/validate-oracles-diff.mjs
node scripts/sync-runtime-player-data.mjs
pnpm test
pnpm build
```

重点检查：

- `data/generated/validation-report.json`
- `data/generated/release-readiness.json`
- `data/generated/proposed-player-changes.md`
- `data/quarantine/players.invalid.json`

发布门槛：

- 生成数据必须通过结构与业务语义校验
- `verifiedAt` 距发布日不得超过 14 天
- 缺失 GCD 行的选手必须通过手工覆写或进入隔离，不允许静默发布

## API 概览

当前后端公开的 MVP API：

- `GET /api/health`
- `GET /api/meta`
- `GET /api/players/list`
- `GET /api/players/search?q=...`
- `POST /api/game/start`
- `POST /api/game/:id/guess`
- `POST /api/game/:id/giveup`
- `POST /api/game/:id/exit`

接口契约以 `server/src/app.ts` 和 `server/src/mvp/**` 为准。

## Docker / VPS

生产编排是单个 `app` 加单个 `redis`：

- `app`：Node 运行时，直接执行 `server/dist/index.js`
- `redis`：持久化 AOF，用于进行中对局状态

部署说明见 [deploy/README.md](deploy/README.md)。

CI 会在 Docker 构建前执行：

- LoL 数据单测
- 生成与校验
- 运行时题库同步
- `pnpm test`
- `pnpm build`
- Docker compose 冒烟与健康检查

## 品牌与合规

- 如果未取得原作者对公共品牌的明确书面同意，对外产品名应使用“召一把”，不要直接使用 `Friberg` 作为面向公众的主品牌。
- 公开实例需要向远程用户提供该实例对应版本的完整 AGPL 对应源代码。
- 当前公开版本应避免使用 Riot Logo、英雄头像、战队 Logo、官方宣传图。
- Riot 未对本项目提供认可、赞助或背书。

详细要求见：

- [ATTRIBUTION.md](ATTRIBUTION.md)
- [LEGAL_AND_LAUNCH_GATES.md](LEGAL_AND_LAUNCH_GATES.md)

## 许可

本仓库继承并继续以 `AGPL-3.0` 分发。部署修改版本时，请同时提供完整对应源代码。
