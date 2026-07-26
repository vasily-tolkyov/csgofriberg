import fs from "node:fs";
import path from "node:path";
import { DATA_ROOT, parseCsv, readJson, writeJson } from "./lol-data-lib.mjs";

const dataset = readJson(path.join(DATA_ROOT, "generated", "players.json"));
const oracleFile = process.argv.find((arg) => arg.startsWith("--oracle-file="))?.slice("--oracle-file=".length)
  || path.join(DATA_ROOT, "staging", "fixtures", "oracles-elixir", "player-event-summary.csv");

const rows = parseCsv(fs.readFileSync(oracleFile, "utf8"));
const headers = rows[0];
const oracleRows = rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
const oracleById = new Map(oracleRows.map((row) => [row.id, row]));

const mismatches = [];
for (const player of dataset) {
  const oracle = oracleById.get(player.id);
  if (!oracle) {
    mismatches.push({ id: player.id, code: "ORACLE_ROW_MISSING" });
    continue;
  }
  const checks = [
    ["msiAppearances", Number(oracle.msiAppearances)],
    ["msiTitles", Number(oracle.msiTitles)],
    ["worldsAppearances", Number(oracle.worldsAppearances)],
    ["worldsTitles", Number(oracle.worldsTitles)]
  ];
  for (const [field, expected] of checks) {
    if (player[field] !== expected) {
      mismatches.push({
        id: player.id,
        code: "ORACLE_DIFF",
        field,
        actual: player[field],
        expected
      });
    }
  }
}

const report = {
  oracleFile: path.relative(DATA_ROOT, oracleFile).replaceAll("\\", "/"),
  checkedPlayers: dataset.length,
  mismatches,
  ok: mismatches.length === 0
};

writeJson(path.join(DATA_ROOT, "generated", "oracles-diff-report.json"), report);

if (!report.ok) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(report, null, 2));
