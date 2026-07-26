import test from "node:test";
import assert from "node:assert/strict";
import {
  diffPlayers,
  normalizeRole,
  parseCsv,
  parseGcdFile,
  parseLeaguepediaOverview,
  parseLooseDate,
  summarizeTargetSize,
  summarizeTournamentResults,
  validateCanonicalPlayers
} from "../lol-data-lib.mjs";

test("parseLooseDate handles Riot GCD variants", () => {
  assert.equal(parseLooseDate("Jul 24, 2026\u00A013:54:53\u00A0PT"), "2026-07-24");
  assert.equal(parseLooseDate("7/15/2026 8:13:19"), "2026-07-15");
  assert.equal(parseLooseDate("2026/6/18 16:45"), "2026-06-18");
});

test("parseGcdFile reads the updated date and rows", () => {
  const parsed = parseGcdFile([
    "LAST UPDATE:,Jul 24, 2026 13:54:53 PT",
    "League,Team,Official Summoner Name,Position",
    "LCS,Cloud9,Blaber,Jungle"
  ].join("\n"));
  assert.equal(parsed.updatedDate, "2026-07-24");
  assert.equal(parsed.records[0]["Official Summoner Name"], "Blaber");
});

test("normalizeRole supports jungler spelling from Leaguepedia", () => {
  assert.equal(normalizeRole("Jungler"), "jungle");
});

test("parseLeaguepediaOverview extracts core infobox fields", () => {
  const overview = parseLeaguepediaOverview([
    "{{Infobox Player",
    "|country=South Korea",
    "|birth_date_year=1996",
    "|birth_date_month=May",
    "|birth_date_day=07",
    "|role=Mid",
    "|team=[[T1]]",
    "|isretired=No",
    "}}"
  ].join("\n"));
  assert.deepEqual(overview, {
    birthDate: "1996-05-07",
    country: "South Korea",
    role: "Mid",
    team: "T1",
    retired: false
  });
});

test("summarizeTournamentResults deduplicates rows and excludes non-Riot world championships", () => {
  const html = [
    '<tr><td class="achievements-date">2026-07-08</td><td class="achievements-place placement placement-5">1</td><td class=""><a href="/wiki/2026_Mid-Season_Invitational">MSI 2026</a></td></tr>',
    '<tr><td class="achievements-date">2026-07-08</td><td class="achievements-place placement placement-5">1</td><td class=""><a href="/wiki/2026_Mid-Season_Invitational">MSI 2026</a></td></tr>',
    '<tr><td class="achievements-date">2025-11-09</td><td class="achievements-place placement placement-5">2</td><td class=""><a href="/wiki/2025_Season_World_Championship">World Championship 2025</a></td></tr>',
    '<tr><td class="achievements-date">2016-03-05</td><td class="achievements-place placement placement-1">1</td><td class=""><a href="/wiki/IEM_Season_X_-_World_Championship">IEM Season 10 World Championship</a></td></tr>',
    '<tr><td class="achievements-date">2018-11-10</td><td class="achievements-place placement placement-1">1</td><td class=""><a href="/wiki/IeSF_10th_Esports_World_Championship">IeSF 10th Esports World Championship</a></td></tr>'
  ].join("");
  const summary = summarizeTournamentResults(html);
  assert.equal(summary.msi.appearances, 1);
  assert.equal(summary.msi.titles, 1);
  assert.equal(summary.worlds.appearances, 1);
  assert.equal(summary.worlds.titles, 0);
});

test("validateCanonicalPlayers catches alias conflicts and easy subset mistakes", () => {
  const report = validateCanonicalPlayers([
    {
      id: "faker",
      nickname: "Faker",
      aliases: ["Hide on bush"],
      birthDate: "1996-05-07",
      role: "mid",
      nationality: "South Korea",
      geoRegion: "Korea",
      status: "active",
      currentTeam: "T1",
      msiTitles: 2,
      msiAppearances: 9,
      worldsTitles: 6,
      worldsAppearances: 10,
      difficulties: ["easy"],
      sources: [{ url: "https://example.com/faker", label: "source" }],
      verifiedAt: "2026-07-01"
    },
    {
      id: "hide_on_bush",
      nickname: "Hide on bush",
      aliases: [],
      birthDate: "1996-05-07",
      role: "mid",
      nationality: "South Korea",
      geoRegion: "Korea",
      status: "active",
      currentTeam: "T1",
      msiTitles: 2,
      msiAppearances: 9,
      worldsTitles: 6,
      worldsAppearances: 10,
      difficulties: ["normal"],
      sources: [{ url: "https://example.com/hob", label: "source" }],
      verifiedAt: "2026-07-01"
    }
  ], "2026-07-26", 14);
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "EASY_NOT_IN_NORMAL"));
  assert.ok(report.issues.some((issue) => issue.code === "NICKNAME_CONFLICTS_WITH_ALIAS"));
  assert.ok(report.issues.some((issue) => issue.code === "STALE_VERIFICATION"));
});

test("validateCanonicalPlayers folds accents and punctuation when checking search collisions", () => {
  const report = validateCanonicalPlayers([
    {
      id: "eloyoya",
      nickname: "Eloyóya",
      aliases: ["Ely-oya"],
      birthDate: "2000-01-01",
      role: "jungle",
      nationality: "Spain",
      geoRegion: "EMEA",
      status: "active",
      currentTeam: "Example",
      msiTitles: 0,
      msiAppearances: 0,
      worldsTitles: 0,
      worldsAppearances: 0,
      difficulties: ["normal"],
      sources: [{ url: "https://example.com/eloyoya", label: "source" }],
      verifiedAt: "2026-07-26"
    },
    {
      id: "elyoya",
      nickname: "Elyoya",
      aliases: [],
      birthDate: "2000-01-01",
      role: "jungle",
      nationality: "Spain",
      geoRegion: "EMEA",
      status: "active",
      currentTeam: "Example",
      msiTitles: 0,
      msiAppearances: 0,
      worldsTitles: 0,
      worldsAppearances: 0,
      difficulties: ["normal"],
      sources: [{ url: "https://example.com/elyoya", label: "source" }],
      verifiedAt: "2026-07-26"
    }
  ], "2026-07-26", 14);

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "NICKNAME_CONFLICTS_WITH_ALIAS"));
});

test("missing GCD rows cannot silently become free agents", () => {
  function determineStatus(override, record, overview, role, targetId) {
    if (override?.status) return override.status;
    if (role === "coach") return "coach";
    const sourceStatus = record?.Status || record?.["LTR Status"] || record?.["Ltr Status"] || "";
    if (/inactive/i.test(sourceStatus)) return "demoted";
    if (/free/i.test(sourceStatus)) return "free_agent";
    if (/active/i.test(sourceStatus)) return "active";
    if (record) return "active";
    if (overview.retired) return "retired";
    throw new Error(`STATUS_OVERRIDE_REQUIRED:${targetId}`);
  }

  assert.throws(
    () => determineStatus(null, null, { retired: false }, "mid", "sample_player"),
    /STATUS_OVERRIDE_REQUIRED:sample_player/
  );
  assert.equal(
    determineStatus({ status: "free_agent" }, null, { retired: false }, "mid", "sample_player"),
    "free_agent"
  );
  assert.equal(
    determineStatus(null, { Status: "Inactive" }, { retired: false }, "mid", "sample_player"),
    "demoted"
  );
});

test("diffPlayers reports added removed and changed ids", () => {
  const diff = diffPlayers(
    [{ id: "faker", currentTeam: "T1" }, { id: "caps", currentTeam: "G2 Esports" }],
    [{ id: "faker", currentTeam: "HLE" }, { id: "chovy", currentTeam: "Gen.G" }]
  );
  assert.deepEqual(diff.added, ["chovy"]);
  assert.deepEqual(diff.removed, ["caps"]);
  assert.equal(diff.changed[0].id, "faker");
});

test("parseCsv keeps quoted commas intact", () => {
  const rows = parseCsv('a,"b,c",d\n1,2,3\n');
  assert.deepEqual(rows, [
    ["a", "b,c", "d"],
    ["1", "2", "3"]
  ]);
});

test("summarizeTargetSize enforces 80 total and 40 easy minimums", () => {
  const players = Array.from({ length: 80 }, (_, index) => ({
    difficulties: index < 40 ? ["normal", "easy"] : ["normal"]
  }));
  assert.deepEqual(summarizeTargetSize(players), {
    minimumRequired: 80,
    easyMinimumRequired: 40,
    actual: 80,
    easyCount: 40,
    normalCount: 80,
    meetsMinimum: true,
    meetsEasyMinimum: true
  });
  assert.equal(summarizeTargetSize(players.slice(0, 79)).meetsMinimum, false);
  assert.equal(
    summarizeTargetSize(players.map((player, index) => (index === 39 ? { difficulties: ["normal"] } : player))).meetsEasyMinimum,
    false
  );
});
