import path from "node:path";
import {
  DATA_ROOT,
  daysBetween,
  readJson,
  validateCanonicalPlayers,
  writeJson
} from "./lol-data-lib.mjs";

const TODAY = process.argv.find((arg) => arg.startsWith("--today="))?.slice("--today=".length)
  || new Date().toISOString().slice(0, 10);
const MAX_AGE_DAYS = 14;
const players = readJson(path.join(DATA_ROOT, "generated", "players.json"));
const sourceStatus = readJson(path.join(DATA_ROOT, "generated", "source-status-report.json"));
const validation = validateCanonicalPlayers(players, TODAY, MAX_AGE_DAYS);

const targetSize = {
  minimumRequired: 20,
  actual: players.length,
  easyCount: players.filter((player) => player.difficulties.includes("easy")).length,
  normalCount: players.filter((player) => player.difficulties.includes("normal")).length,
  meetsMinimum: players.length >= 20
};

if (!targetSize.meetsMinimum) {
  validation.issues.push({
    code: "TARGET_SIZE_TOO_SMALL",
    actual: players.length,
    minimumRequired: targetSize.minimumRequired
  });
  validation.ok = false;
}

const verificationDates = players.map((player) => player.verifiedAt).sort();
const releaseReadiness = {
  checkedAt: TODAY,
  freshnessMaxAgeDays: MAX_AGE_DAYS,
  oldestVerifiedAt: verificationDates[0],
  newestVerifiedAt: verificationDates.at(-1),
  oldestVerificationAgeDays: daysBetween(verificationDates[0], TODAY),
  readyForRelease: validation.ok
};

const report = {
  checkedAt: TODAY,
  validation,
  targetSize,
  releaseReadiness,
  sourceStatus
};

writeJson(path.join(DATA_ROOT, "generated", "validation-report.json"), report);
writeJson(path.join(DATA_ROOT, "generated", "release-readiness.json"), releaseReadiness);
writeJson(path.join(DATA_ROOT, "generated", "target-size-report.json"), targetSize);

if (!validation.ok) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(report, null, 2));
