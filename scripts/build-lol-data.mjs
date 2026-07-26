import fs from "node:fs";
import path from "node:path";
import {
  DATA_ROOT,
  diffPlayers,
  gcdSourceUrl,
  geoRegionForCountry,
  leaguepediaPageUrl,
  leaguepediaResultsUrl,
  maybeFindGcdRecord,
  normalizeRole,
  parseGcdFile,
  parseLeaguepediaOverview,
  readJson,
  summarizeTournamentResults,
  writeJson,
  writeText
} from "./lol-data-lib.mjs";

const targets = readJson(path.join(DATA_ROOT, "source-targets", "players.v1.targets.json"));
const statusOverrides = readJson(path.join(DATA_ROOT, "manual", "status-overrides.json")).players;
const published = readJson(path.join(DATA_ROOT, "review", "published", "players.json"));
const fixtureRoot = path.join(DATA_ROOT, "staging", "fixtures");
const manifest = readJson(path.join(fixtureRoot, "fetch-manifest.json"));
const TODAY = process.argv.find((arg) => arg.startsWith("--today="))?.slice("--today=".length)
  || String(manifest.fetchedAt).slice(0, 10);

const gcdByRegion = Object.fromEntries(
  ["KR", "EMEA", "CN", "LCP", "AME"].map((regionKey) => {
    const file = path.join(fixtureRoot, "gcd", `${regionKey}.csv`);
    return [regionKey, parseGcdFile(fs.readFileSync(file, "utf8"))];
  })
);

function gcdRole(record) {
  return record?.["Position"] || record?.["Main Role"] || "";
}

function gcdStatus(record) {
  return record?.["Status"] || record?.["LTR Status"] || record?.["Ltr Status"] || "";
}

function determineStatus(target, override, record, overview, role) {
  if (override?.status) return override.status;
  if (role === "coach") return "coach";
  const sourceStatus = gcdStatus(record);
  if (/inactive/i.test(sourceStatus)) return "demoted";
  if (/free/i.test(sourceStatus)) return "free_agent";
  if (/active/i.test(sourceStatus)) return "active";
  if (record) return "active";
  if (overview.retired) return "retired";
  throw new Error(`STATUS_OVERRIDE_REQUIRED:${target.id}`);
}

function determineCurrentTeam(override, record, overview) {
  return override?.currentTeam ?? record?.["Team"] ?? overview.team ?? "";
}

function determineRole(record, overview, override) {
  const raw = override?.role || gcdRole(record) || overview.role;
  return normalizeRole(raw);
}

function buildSources(target) {
  return [
    {
      url: gcdSourceUrl(target.gcdRegion),
      label: `Riot GCD ${target.gcdRegion}`
    },
    {
      url: leaguepediaPageUrl(target.pageTitle),
      label: "Leaguepedia player page"
    },
    {
      url: leaguepediaResultsUrl(target.pageTitle),
      label: "Leaguepedia tournament results"
    }
  ];
}

function buildPlayer(target) {
  const fixture = readJson(path.join(fixtureRoot, "leaguepedia", `${target.id}.json`));
  const gcdRecord = maybeFindGcdRecord(gcdByRegion[target.gcdRegion], target.gcdName);
  const overview = parseLeaguepediaOverview(fixture.overviewWikitext);
  const tournamentSummary = summarizeTournamentResults(fixture.tournamentHtml);
  const override = statusOverrides[target.id] || null;
  const role = determineRole(gcdRecord, overview, override);
  const status = determineStatus(target, override, gcdRecord, overview, role);
  return {
    id: target.id,
    nickname: target.nickname,
    aliases: target.aliases,
    birthDate: overview.birthDate,
    role,
    nationality: overview.country,
    geoRegion: geoRegionForCountry(overview.country),
    status,
    currentTeam: determineCurrentTeam(override, gcdRecord, overview),
    msiTitles: tournamentSummary.msi.titles,
    msiAppearances: tournamentSummary.msi.appearances,
    worldsTitles: tournamentSummary.worlds.titles,
    worldsAppearances: tournamentSummary.worlds.appearances,
    difficulties: [...target.difficulties],
    sources: buildSources(target),
    verifiedAt: TODAY
  };
}

function summarizeSourceStatus() {
  return {
    fetchedAt: manifest.fetchedAt,
    gcdFetchedAt: manifest.gcdFetchedAt ?? manifest.fetchedAt,
    leaguepediaFetchedAt: manifest.leaguepediaFetchedAt ?? manifest.fetchedAt,
    gcd: Object.fromEntries(
      Object.entries(gcdByRegion).map(([regionKey, parsed]) => [
        regionKey,
        {
          sourceUrl: gcdSourceUrl(regionKey),
          upstreamUpdatedRaw: parsed.updatedRaw,
          upstreamUpdatedDate: parsed.updatedDate
        }
      ])
    ),
    leaguepedia: manifest.leaguepedia
  };
}

function markdownReview(diff) {
  const lines = [
    "# 数据变更评审草案",
    "",
    `- 生成日期: ${TODAY}`,
    `- 新增记录: ${diff.added.length}`,
    `- 删除记录: ${diff.removed.length}`,
    `- 变更记录: ${diff.changed.length}`,
    "",
    "## 新增",
    ""
  ];
  lines.push(...(diff.added.length ? diff.added.map((id) => `- ${id}`) : ["- 无"]));
  lines.push("", "## 删除", "");
  lines.push(...(diff.removed.length ? diff.removed.map((id) => `- ${id}`) : ["- 无"]));
  lines.push("", "## 变更", "");
  if (!diff.changed.length) {
    lines.push("- 无");
  } else {
    for (const change of diff.changed) {
      lines.push(`- ${change.id}: ${change.before.currentTeam} -> ${change.after.currentTeam}, ${change.before.status} -> ${change.after.status}`);
    }
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

const players = [];
const quarantine = [];

for (const target of targets.players) {
  try {
    players.push(buildPlayer(target));
  } catch (error) {
    quarantine.push({
      id: target.id,
      nickname: target.nickname,
      reason: error instanceof Error ? error.message : String(error)
    });
  }
}

players.sort((left, right) => left.nickname.localeCompare(right.nickname, "en-US"));

const diff = diffPlayers(published, players);
const easyPlayers = players.filter((player) => player.difficulties.includes("easy"));
const sourceStatus = summarizeSourceStatus();

writeJson(path.join(DATA_ROOT, "canonical", "players.v1.json"), players);
writeJson(path.join(DATA_ROOT, "generated", "players.json"), players);
writeJson(path.join(DATA_ROOT, "generated", "easy-players.json"), easyPlayers);
writeJson(path.join(DATA_ROOT, "generated", "source-status-report.json"), sourceStatus);
writeJson(path.join(DATA_ROOT, "generated", "proposed-player-changes.json"), diff);
writeJson(path.join(DATA_ROOT, "quarantine", "players.invalid.json"), quarantine);
writeText(path.join(DATA_ROOT, "generated", "proposed-player-changes.md"), markdownReview(diff));

console.log(JSON.stringify({
  players: players.length,
  easyPlayers: easyPlayers.length,
  quarantine: quarantine.length,
  generatedAt: TODAY
}, null, 2));
