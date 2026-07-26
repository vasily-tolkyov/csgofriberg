# 数据目录与许可说明

此目录保存“弗一把 · 英雄联盟版”20 人端到端样板的数据源快照、人工覆盖、规范化题库、隔离记录与审阅报告。

## 目录用途

- `staging/fixtures/gcd/`：Riot 官方 Global Contract Database 的 CSV 来源快照
- `staging/fixtures/leaguepedia/`：Leaguepedia 页面与赛事结果的可复现构建快照
- `staging/fixtures/oracles-elixir/player-event-summary.csv`：仅用于差异校验的最小聚合检查表
- `canonical/`：清洗后的规范记录
- `manual/`：人工状态覆盖
- `generated/`：构建、差异、来源和发布门槛报告
- `quarantine/`：因必填字段或来源无法确认而被隔离的记录

## 来源约束

- Leaguepedia 来源快照按对应页面标示的 CC BY-SA 3.0 条款处理。每名选手的来源 URL 保存在 `generated/source-status-report.json` 与题库 `sources` 字段中，页面作者贡献记录可由对应 URL 查看。
- Oracle’s Elixir 仅用于独立差异校验。仓库不保存或重新分发其逐场比赛原始数据；当前 CSV 只保留 20 名样板选手的昵称和四项国际赛事聚合计数。
- 运行时只读取同步到 `server/src/db/seeds/` 的规范化结构化事实，不直接向网站返回来源页面正文。

完整项目署名和公开上线门槛见仓库根目录的 `ATTRIBUTION.md` 与 `LEGAL_AND_LAUNCH_GATES.md`。
