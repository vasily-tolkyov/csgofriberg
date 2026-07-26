# Attribution

## Upstream

本仓库基于以下上游仓库继续开发：

- 上游仓库：`https://github.com/shnlfriberg/csgofriberg`
- 参考基线提交：`7353fc7e562b1690df226798a483b28a210a6a65`

当前仓库在该基础上收敛为 LoL 选手猜题 MVP，并新增了：

- `data/**` 下的 LoL 数据抓取、生成、校验、隔离与审阅产物
- `scripts/build-lol-data.mjs` 等数据流水线脚本
- 以 `server/src/db/seeds/*.json` 为运行时题库的 MVP API

## Leaguepedia

本仓库的数据管线会读取 Leaguepedia 页面与战绩页作为来源之一，示例来源链接可在以下文件中查看：

- `data/generated/source-status-report.json`
- `data/generated/players.json` 的 `sources` 字段

使用约束：

- Leaguepedia 页面显示其内容“除非另有说明，按 CC BY-SA 3.0 提供”
- 如果你在公开产品、文档或营销材料中复制或改编了 Leaguepedia 的文字、表格、截图或其他可版权内容，需要补足署名与同许可义务
- 当前仓库主要保存结构化事实与来源 URL；是否构成需要额外分享同许可材料的改编，发布方应自行复核

建议至少保留：

- 来源页面 URL
- 采集日期
- 生成版本或提交号
- 对外可见的 attribution 说明

## Riot IP

当前公开版本的默认要求：

- 不使用 Riot Logo、英雄头像、战队 Logo、官方宣传图
- 不把 Riot 商标写进公开主品牌、域名、商店名或营销文案
- 对外页面应明确这是粉丝项目，不是 Riot 官方产品

推荐在公开站点保留一段醒目的非背书说明：

```text
本项目是由社区创建的《英雄联盟》相关粉丝项目，Riot Games 未对本项目提供认可、赞助或背书。
```

## AGPL 对应源代码

本仓库继续按 `AGPL-3.0` 分发。对外部署修改版时，运营方需要向远程交互用户提供与线上版本对应的完整源代码，包括：

- 当前仓库源码
- 构建、安装、启动所需脚本
- 数据流水线脚本与题库同步脚本
- 与线上版本一致的前后端改动

更完整的上线前检查见 [LEGAL_AND_LAUNCH_GATES.md](LEGAL_AND_LAUNCH_GATES.md)。
