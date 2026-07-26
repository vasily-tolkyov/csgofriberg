# Legal And Launch Gates

以下清单用于公开部署前自检，不构成法律意见。

## 1. 品牌门槛

- 若未取得原作者对公共品牌的明确书面许可，对外产品名使用“召一把”
- 不要把 `Friberg` 作为面对公众的主品牌、域名或商店标题
- 不要使用 Riot 或其游戏相关商标作为产品主标识

## 2. AGPL 门槛

- 公开实例必须向远程用户提供该实例对应版本的完整对应源代码
- 源码链接应与当前线上部署版本一一对应，不能只给主分支
- 构建脚本、部署脚本、题库同步脚本和必要配置样例都应包含在对应源码中

推荐做法：

- 在站点页脚或“关于”页放一个 `Source` 链接
- 链接到具体提交、release 包或源码归档

## 3. 数据来源门槛

- 发布前确认 `data/generated/validation-report.json` 为通过状态
- 发布前确认 `data/generated/release-readiness.json.readyForRelease` 为 `true`
- 发布前审阅 `data/generated/proposed-player-changes.md`
- 若有 `data/quarantine/players.invalid.json` 非空，先处理再发布
- 缺失 GCD 行的选手必须手工覆写或继续隔离，不能静默带入线上题库

## 4. Riot 素材门槛

- 默认不使用 Riot Logo、英雄头像、战队 Logo、官方海报或赛事素材
- 如果未来确实使用 Riot 资产，需要单独复核 Riot 公共项目规则与展示文案
- 对外页面需要有清晰的非官方、非赞助、非背书说明

## 5. Leaguepedia / 第三方内容门槛

- 如果公开产品中复制了 Leaguepedia 的文字、截图或可版权内容，需补足署名与同许可义务
- 保留原始来源 URL、采集日期和生成版本
- 对只保留结构化事实的使用场景，也建议在“关于数据来源”页面显式列出 Leaguepedia 和 Riot GCD

## 6. 产品登记门槛

- 在目标投放地区上线前，确认是否存在域名备案、站点备案、经营资质、隐私告知或未成年人相关义务
- 如果面向中国大陆公网用户，先由实际运营主体确认是否需要 ICP 备案或其他前置手续
- 如果接入分析、广告或第三方脚本，另行补齐隐私与合规披露

## 7. 发布前最小动作

```bash
node --test scripts/tests/lol-data.test.mjs
node scripts/build-lol-data.mjs
node scripts/validate-lol-data.mjs
node scripts/validate-oracles-diff.mjs
node scripts/sync-runtime-player-data.mjs
pnpm test
pnpm build
```

只有以上检查通过后，再执行镜像构建和公开部署。
