import fs from "node:fs";
import path from "node:path";
import { DATA_ROOT, GCD_SOURCES, gcdSourceUrl, leaguepediaPageUrl, leaguepediaResultsUrl, readJson, writeJson, writeText } from "./lol-data-lib.mjs";

const targetsPath = path.join(DATA_ROOT, "source-targets", "players.v1.targets.json");
const targets = readJson(targetsPath);

const fixtureRoot = path.join(DATA_ROOT, "staging", "fixtures");
const gcdRoot = path.join(fixtureRoot, "gcd");
const leaguepediaRoot = path.join(fixtureRoot, "leaguepedia");
const fetchedAt = new Date().toISOString();
const gcdOnly = process.argv.includes("--gcd-only");
const manifestPath = path.join(fixtureRoot, "fetch-manifest.json");

function existingManifest() {
  if (!fs.existsSync(manifestPath)) {
    return { gcd: {}, leaguepedia: {} };
  }
  return readJson(manifestPath);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "friberg-data-pipeline/1.0"
    }
  });
  if (!response.ok) {
    throw new Error(`FETCH_FAILED:${response.status}:${url}`);
  }
  return response.text();
}

async function main() {
  const previous = existingManifest();
  const manifest = {
    fetchedAt,
    gcdFetchedAt: fetchedAt,
    leaguepediaFetchedAt: previous.leaguepediaFetchedAt ?? previous.fetchedAt ?? null,
    gcd: {},
    leaguepedia: previous.leaguepedia ?? {}
  };

  for (const [regionKey] of Object.entries(GCD_SOURCES)) {
    const url = gcdSourceUrl(regionKey);
    const text = await fetchText(url);
    writeText(path.join(gcdRoot, `${regionKey}.csv`), text);
    manifest.gcd[regionKey] = { url };
  }

  if (!gcdOnly) {
    for (const target of targets.players) {
      const overviewApiUrl = `https://lol.fandom.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(target.pageTitle)}&format=json`;
      const tournamentApiUrl = `https://lol.fandom.com/api.php?action=parse&page=${encodeURIComponent(`${target.pageTitle}/Tournament_Results`)}&prop=text&format=json`;
      const [overviewText, tournamentText] = await Promise.all([
        fetchText(overviewApiUrl),
        fetchText(tournamentApiUrl)
      ]);
      const overview = JSON.parse(overviewText);
      const tournament = JSON.parse(tournamentText);
      const page = Object.values(overview.query.pages)[0];
      const overviewWikitext = page.revisions?.[0]?.slots?.main?.["*"] || "";
      const tournamentHtml = tournament.parse?.text?.["*"] || "";
      writeJson(path.join(leaguepediaRoot, `${target.id}.json`), {
        fetchedAt,
        pageTitle: target.pageTitle,
        overviewWikitext,
        tournamentHtml
      });
      manifest.leaguepedia[target.id] = {
        overviewUrl: leaguepediaPageUrl(target.pageTitle),
        tournamentResultsUrl: leaguepediaResultsUrl(target.pageTitle)
      };
    }
    manifest.leaguepediaFetchedAt = fetchedAt;
  }

  const verificationDates = [manifest.gcdFetchedAt, manifest.leaguepediaFetchedAt]
    .filter((value) => typeof value === "string")
    .sort();
  manifest.fetchedAt = verificationDates[0] ?? fetchedAt;
  writeJson(manifestPath, manifest);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
