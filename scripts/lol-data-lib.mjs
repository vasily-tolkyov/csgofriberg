import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const THIS_FILE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(THIS_FILE), "..");
export const DATA_ROOT = path.join(REPO_ROOT, "data");

export const GCD_SOURCES = {
  KR: {
    gid: "905624073",
    label: "Riot GCD KR"
  },
  EMEA: {
    gid: "148326031",
    label: "Riot GCD EMEA"
  },
  CN: {
    gid: "594163931",
    label: "Riot GCD CN"
  },
  LCP: {
    gid: "1177719586",
    label: "Riot GCD LCP"
  },
  AME: {
    gid: "0",
    label: "Riot GCD AME"
  }
};

export const ALLOWED_STATUSES = new Set([
  "active",
  "retired",
  "coach",
  "free_agent",
  "demoted"
]);

const COUNTRY_REGION_MAP = new Map([
  ["Australia", "OCE"],
  ["Belgium", "EMEA"],
  ["Canada", "Americas"],
  ["China", "China"],
  ["Croatia", "EMEA"],
  ["Czech Republic", "EMEA"],
  ["Denmark", "EMEA"],
  ["France", "EMEA"],
  ["Germany", "EMEA"],
  ["Greece", "EMEA"],
  ["Hong Kong", "LCP"],
  ["Japan", "LCP"],
  ["Netherlands", "EMEA"],
  ["Norway", "EMEA"],
  ["Poland", "EMEA"],
  ["Romania", "EMEA"],
  ["Slovenia", "EMEA"],
  ["South Korea", "Korea"],
  ["Spain", "EMEA"],
  ["Sweden", "EMEA"],
  ["Taiwan", "LCP"],
  ["Turkey", "EMEA"],
  ["United Kingdom", "EMEA"],
  ["United States", "Americas"],
  ["Vietnam", "LCP"]
]);

const ROLE_MAP = new Map([
  ["top", "top"],
  ["TOP", "top"],
  ["Top", "top"],
  ["jungle", "jungle"],
  ["JUG", "jungle"],
  ["JUNGLE", "jungle"],
  ["Jungle", "jungle"],
  ["Jungler", "jungle"],
  ["mid", "mid"],
  ["MID", "mid"],
  ["Mid", "mid"],
  ["bot", "bot"],
  ["ADC", "bot"],
  ["BOT", "bot"],
  ["Bot", "bot"],
  ["support", "support"],
  ["SUP", "support"],
  ["SUPPORT", "support"],
  ["Support", "support"],
  ["coach", "coach"],
  ["HEAD COACH", "coach"],
  ["LCS Head Coach", "coach"],
  ["Head Coach", "coach"],
  ["Coach", "coach"]
]);

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function writeText(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value, "utf8");
}

export function slugifyId(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function foldSearchText(value) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "");
}

export function normalizeName(value) {
  return foldSearchText(value)
    .trim()
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

export function normalizeRole(value) {
  const normalized = ROLE_MAP.get(value?.trim() || "");
  if (!normalized) throw new Error(`UNKNOWN_ROLE:${value}`);
  return normalized;
}

export function geoRegionForCountry(country) {
  return COUNTRY_REGION_MAP.get(country) || "International";
}

export function gcdSourceUrl(regionKey) {
  const source = GCD_SOURCES[regionKey];
  return `https://docs.google.com/spreadsheets/d/1Y7k5kQ2AegbuyiGwEPsa62e883FYVtHqr6UVut9RC4o/pub?output=csv&gid=${source.gid}`;
}

export function leaguepediaPageUrl(pageTitle) {
  return `https://lol.fandom.com/wiki/${encodeURIComponent(pageTitle).replace(/%20/g, "_")}`;
}

export function leaguepediaResultsUrl(pageTitle) {
  return `${leaguepediaPageUrl(pageTitle)}/Tournament_Results`;
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows
    .map((fields) => fields.map((field) => field.replace(/\uFEFF/g, "").trim()))
    .filter((fields) => fields.some((field) => field.length > 0));
}

export function parseLooseDate(value) {
  const trimmed = value.replaceAll("\u00A0", " ").trim();
  if (!trimmed) return null;

  const yearFirst = /^(\d{4})\/(\d{1,2})\/(\d{1,2})/.exec(trimmed);
  if (yearFirst) {
    return `${yearFirst[1]}-${yearFirst[2].padStart(2, "0")}-${yearFirst[3].padStart(2, "0")}`;
  }

  const monthFirst = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(trimmed);
  if (monthFirst) {
    return `${monthFirst[3]}-${monthFirst[1].padStart(2, "0")}-${monthFirst[2].padStart(2, "0")}`;
  }

  const monthNames = {
    January: "01",
    February: "02",
    March: "03",
    April: "04",
    May: "05",
    June: "06",
    July: "07",
    August: "08",
    September: "09",
    October: "10",
    November: "11",
    December: "12",
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12"
  };
  const monthName = /([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/.exec(trimmed);
  if (monthName && monthNames[monthName[1]]) {
    return `${monthName[3]}-${monthNames[monthName[1]]}-${monthName[2].padStart(2, "0")}`;
  }

  return null;
}

function extractUpdatedRaw(row) {
  if (!row?.length) return "";
  for (let index = 0; index < row.length; index += 1) {
    for (let width = 1; width <= 3 && index + width <= row.length; width += 1) {
      const candidate = row.slice(index, index + width).join(", ");
      if (parseLooseDate(candidate)) return candidate;
    }
  }
  return row[1] || "";
}

export function parseGcdFile(text) {
  const rows = parseCsv(text);
  const updatedRaw = extractUpdatedRaw(rows[0]);
  const headerIndex = rows.findIndex((row) => row[0] === "League");
  if (headerIndex < 0) {
    throw new Error("GCD_HEADER_NOT_FOUND");
  }
  const headers = rows[headerIndex];
  const records = rows
    .slice(headerIndex + 1)
    .filter((row) => row[0] && row[1] && row[2])
    .map((row) => Object.fromEntries(headers.map((header, index) => [header || `column_${index}`, row[index] || ""])));
  return {
    updatedRaw,
    updatedDate: parseLooseDate(updatedRaw),
    records
  };
}

export function findGcdRecord(parsed, name) {
  const matches = parsed.records.filter((row) => row["Official Summoner Name"] === name);
  if (matches.length !== 1) {
    throw new Error(`GCD_ROW_NOT_FOUND_OR_AMBIGUOUS:${name}:${matches.length}`);
  }
  return matches[0];
}

export function maybeFindGcdRecord(parsed, name) {
  const matches = parsed.records.filter((row) => row["Official Summoner Name"] === name);
  if (matches.length === 0) return null;
  if (matches.length !== 1) {
    throw new Error(`GCD_ROW_NOT_FOUND_OR_AMBIGUOUS:${name}:${matches.length}`);
  }
  return matches[0];
}

export function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&#160;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#8211;/g, "-")
    .replace(/&#8217;/g, "'");
}

export function stripHtml(value) {
  return decodeHtml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function extractInfoboxField(wikitext, field) {
  const pattern = new RegExp(`\\|${field}=([^\\n]*)`);
  const match = pattern.exec(wikitext);
  return match ? match[1].trim() : "";
}

function normalizePageTeam(value) {
  return value
    .replace(/\[\[|\]\]/g, "")
    .replace(/\|.*$/g, "")
    .trim();
}

export function parseLeaguepediaOverview(wikitext) {
  const year = extractInfoboxField(wikitext, "birth_date_year");
  const month = extractInfoboxField(wikitext, "birth_date_month");
  const day = extractInfoboxField(wikitext, "birth_date_day");
  const monthMap = {
    January: "01",
    February: "02",
    March: "03",
    April: "04",
    May: "05",
    June: "06",
    July: "07",
    August: "08",
    September: "09",
    October: "10",
    November: "11",
    December: "12"
  };
  const birthDate = year && monthMap[month] && day
    ? `${year}-${monthMap[month]}-${String(day).padStart(2, "0")}`
    : "";
  const country = extractInfoboxField(wikitext, "country");
  const role = extractInfoboxField(wikitext, "role");
  const team = normalizePageTeam(extractInfoboxField(wikitext, "team"));
  const retired = /^yes$/i.test(extractInfoboxField(wikitext, "isretired"))
    || /^yes$/i.test(extractInfoboxField(wikitext, "isretiredplayer"));
  return {
    birthDate,
    country,
    role,
    team,
    retired
  };
}

export function summarizeTournamentResults(html) {
  const appearances = [];
  const rowRegex = /<tr><td class="achievements-date">[\s\S]*?<td class="achievements-place[^"]*"[^>]*>([\s\S]*?)<\/td><td class="">[\s\S]*?<a href="([^"]+)"[^>]*>(.*?)<\/a>/g;
  for (const match of html.matchAll(rowRegex)) {
    const placement = stripHtml(match[1]);
    const href = decodeHtml(match[2]);
    const title = stripHtml(match[3]);
    let eventType = null;
    if (/Mid-Season Invitational/i.test(title) || /Mid-Season_Invitational/i.test(href)) {
      eventType = "msi";
    } else if (
      /^Worlds(?:\s|$)/i.test(title) ||
      /^\/wiki\/(?:\d{4}_Season_|Season_\d+_)World_Championship(?:$|[/?#])/i.test(href)
    ) {
      eventType = "worlds";
    }
    if (!eventType) continue;
    appearances.push({
      eventType,
      placement,
      href
    });
  }

  const deduped = new Map();
  for (const appearance of appearances) {
    const key = `${appearance.eventType}:${appearance.href}`;
    if (!deduped.has(key)) deduped.set(key, appearance);
  }

  const results = [...deduped.values()];
  const summarize = (eventType) => {
    const filtered = results.filter((row) => row.eventType === eventType);
    return {
      appearances: filtered.length,
      titles: filtered.filter((row) => /^1(\b|st)/i.test(row.placement)).length
    };
  };

  return {
    results,
    msi: summarize("msi"),
    worlds: summarize("worlds")
  };
}

export function daysBetween(olderIsoDate, newerIsoDate) {
  const older = new Date(`${olderIsoDate}T00:00:00Z`);
  const newer = new Date(`${newerIsoDate}T00:00:00Z`);
  return Math.floor((newer - older) / 86400000);
}

export function validateCanonicalPlayers(players, todayIsoDate, maxAgeDays = 14) {
  const issues = [];
  const nicknameMap = new Map();
  const aliasMap = new Map();

  for (const player of players) {
    const requiredFields = [
      "id",
      "nickname",
      "birthDate",
      "role",
      "nationality",
      "geoRegion",
      "status",
      "verifiedAt"
    ];
    for (const field of requiredFields) {
      if (player[field] === undefined || player[field] === null || player[field] === "") {
        issues.push({ code: "MISSING_FIELD", playerId: player.id, field });
      }
    }
    if (
      player.status !== "retired"
      && player.status !== "free_agent"
      && player.status !== "coach"
      && (player.currentTeam === undefined || player.currentTeam === null || player.currentTeam === "")
    ) {
      issues.push({ code: "MISSING_FIELD", playerId: player.id, field: "currentTeam" });
    }
    if (!ALLOWED_STATUSES.has(player.status)) {
      issues.push({ code: "INVALID_STATUS", playerId: player.id, status: player.status });
    }
    if (!Array.isArray(player.sources) || player.sources.length === 0) {
      issues.push({ code: "MISSING_SOURCES", playerId: player.id });
    }
    if (!Array.isArray(player.difficulties) || player.difficulties.length === 0) {
      issues.push({ code: "MISSING_DIFFICULTIES", playerId: player.id });
    }
    if (player.difficulties?.includes("easy") && !player.difficulties.includes("normal")) {
      issues.push({ code: "EASY_NOT_IN_NORMAL", playerId: player.id });
    }
    if (daysBetween(player.verifiedAt, todayIsoDate) > maxAgeDays) {
      issues.push({
        code: "STALE_VERIFICATION",
        playerId: player.id,
        verifiedAt: player.verifiedAt,
        ageDays: daysBetween(player.verifiedAt, todayIsoDate)
      });
    }
    const normalizedNickname = normalizeName(player.nickname);
    if (nicknameMap.has(normalizedNickname)) {
      issues.push({
        code: "NICKNAME_CONFLICT",
        playerId: player.id,
        otherPlayerId: nicknameMap.get(normalizedNickname),
        value: player.nickname
      });
    } else if (aliasMap.has(normalizedNickname) && aliasMap.get(normalizedNickname) !== player.id) {
      issues.push({
        code: "NICKNAME_CONFLICTS_WITH_ALIAS",
        playerId: player.id,
        otherPlayerId: aliasMap.get(normalizedNickname),
        value: player.nickname
      });
    } else {
      nicknameMap.set(normalizedNickname, player.id);
    }
    for (const alias of player.aliases || []) {
      const normalizedAlias = normalizeName(alias);
      if (!normalizedAlias) continue;
      if (normalizedAlias === normalizedNickname) {
        issues.push({ code: "ALIAS_DUPLICATES_NICKNAME", playerId: player.id, alias });
      }
      if (aliasMap.has(normalizedAlias)) {
        issues.push({
          code: "ALIAS_CONFLICT",
          playerId: player.id,
          otherPlayerId: aliasMap.get(normalizedAlias),
          alias
        });
      } else if (nicknameMap.has(normalizedAlias) && nicknameMap.get(normalizedAlias) !== player.id) {
        issues.push({
          code: "ALIAS_CONFLICTS_WITH_NICKNAME",
          playerId: player.id,
          otherPlayerId: nicknameMap.get(normalizedAlias),
          alias
        });
      } else {
        aliasMap.set(normalizedAlias, player.id);
      }
    }
  }

  const easyCount = players.filter((player) => player.difficulties.includes("easy")).length;
  return {
    ok: issues.length === 0,
    playerCount: players.length,
    easyCount,
    normalCount: players.filter((player) => player.difficulties.includes("normal")).length,
    issues
  };
}

export function diffPlayers(previousPlayers, nextPlayers) {
  const previousMap = new Map(previousPlayers.map((player) => [player.id, player]));
  const nextMap = new Map(nextPlayers.map((player) => [player.id, player]));
  const added = [];
  const removed = [];
  const changed = [];

  for (const player of nextPlayers) {
    const previous = previousMap.get(player.id);
    if (!previous) {
      added.push(player.id);
      continue;
    }
    if (JSON.stringify(previous) !== JSON.stringify(player)) {
      changed.push({
        id: player.id,
        before: previous,
        after: player
      });
    }
  }

  for (const player of previousPlayers) {
    if (!nextMap.has(player.id)) removed.push(player.id);
  }

  return { added, removed, changed };
}

export function summarizeTargetSize(players, minimumRequired = 80, easyMinimumRequired = 40) {
  const easyCount = players.filter((player) => player.difficulties.includes("easy")).length;
  const normalCount = players.filter((player) => player.difficulties.includes("normal")).length;
  return {
    minimumRequired,
    easyMinimumRequired,
    actual: players.length,
    easyCount,
    normalCount,
    meetsMinimum: players.length >= minimumRequired,
    meetsEasyMinimum: easyCount >= easyMinimumRequired
  };
}
