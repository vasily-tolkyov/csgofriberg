# Alias governance

- Community nicknames and former IDs in `data/source-targets/players.v1.targets.json` are hand-maintained.
- Riot GCD and Leaguepedia remain the primary sources for roster, identity, and tournament verification; alias strings are added only after manual review.
- Every alias addition must pass the normalized collision check in `scripts/validate-lol-data.mjs` before release.
- When an alias is ambiguous across multiple players, keep it out of the published dataset until a disambiguation policy is added.
