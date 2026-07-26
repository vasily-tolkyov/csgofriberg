import fs from "node:fs";
import path from "node:path";
import { DATA_ROOT, REPO_ROOT, readJson, validateCanonicalPlayers } from "./lol-data-lib.mjs";

const TODAY = process.argv.find((arg) => arg.startsWith("--today="))?.slice("--today=".length)
  || new Date().toISOString().slice(0, 10);
const generatedPlayersPath = path.join(DATA_ROOT, "generated", "players.json");
const generatedEasyPlayersPath = path.join(DATA_ROOT, "generated", "easy-players.json");
const serverPlayersSeedPath = path.join(REPO_ROOT, "server", "src", "db", "seeds", "players.json");
const serverEasySeedPath = path.join(REPO_ROOT, "server", "src", "db", "seeds", "easy-players.json");

const players = readJson(generatedPlayersPath);
const validation = validateCanonicalPlayers(players, TODAY, 14);
if (!validation.ok) {
  console.error(JSON.stringify(validation, null, 2));
  process.exit(1);
}

fs.copyFileSync(generatedPlayersPath, serverPlayersSeedPath);
fs.copyFileSync(generatedEasyPlayersPath, serverEasySeedPath);

console.log(JSON.stringify({
  copiedAt: TODAY,
  playersSeed: serverPlayersSeedPath,
  easyPlayersSeed: serverEasySeedPath,
  copiedPlayers: players.length
}, null, 2));
