import { fetchPlayerSuggestions, PlayerSuggestion } from './lol';

interface CachedPlayerList {
  version: string;
  players: PlayerSuggestion[];
}

const STORAGE_KEY = 'player-list-v1';
const REVALIDATE_INTERVAL_MS = 30_000;
let memory: CachedPlayerList | null = null;
let loading: Promise<PlayerSuggestion[]> | null = null;
let validatedAt: number | null = null;

function readStored(): CachedPlayerList | null {
  if (memory) return memory;
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as CachedPlayerList | null;
    if (parsed?.players?.length) memory = parsed;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return memory;
}

async function refresh(cached: CachedPlayerList | null): Promise<PlayerSuggestion[]> {
  const players = await fetchPlayerSuggestions();
  const next: CachedPlayerList = {
    version: String(Date.now()),
    players,
  };
  memory = next;
  validatedAt = performance.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next.players;
}

export async function getPlayerList(): Promise<PlayerSuggestion[]> {
  const cached = readStored();
  if (cached) {
    if (validatedAt === null || performance.now() - validatedAt > REVALIDATE_INTERVAL_MS) {
      loading ??= refresh(cached).finally(() => { loading = null; });
      try {
        return await loading;
      } catch {
        return cached.players;
      }
    }
    return cached.players;
  }
  loading ??= refresh(null).finally(() => { loading = null; });
  return loading;
}

export function clearPlayerListCache(): void {
  memory = null;
  validatedAt = null;
  localStorage.removeItem(STORAGE_KEY);
}

function normalizeLookupValue(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[\s\p{P}\p{S}]+/gu, '');
}

function matchesSubsequence(haystack: string, needle: string): boolean {
  if (!needle) return false;
  let index = 0;
  for (const char of haystack) {
    if (char === needle[index]) index += 1;
    if (index === needle.length) return true;
  }
  return false;
}

function scoreText(rawValue: string, normalizedQuery: string, compactQuery: string): number | null {
  const raw = rawValue.trim().toLocaleLowerCase();
  const compact = normalizeLookupValue(rawValue);
  const hasCompactQuery = compactQuery.length > 0;

  if (raw === normalizedQuery || (hasCompactQuery && compact === compactQuery)) return 0;
  if (raw.startsWith(normalizedQuery) || (hasCompactQuery && compact.startsWith(compactQuery))) return 1;
  if (raw.split(/[^\p{L}\p{N}]+/gu).some((token) => token.startsWith(normalizedQuery))) return 2;
  if (raw.includes(normalizedQuery) || (hasCompactQuery && compact.includes(compactQuery))) return 3;
  if (hasCompactQuery && matchesSubsequence(compact, compactQuery)) return 4;
  return null;
}

export function searchPlayerList(players: PlayerSuggestion[], query: string): PlayerSuggestion[] {
  const normalized = query.trim().toLocaleLowerCase();
  const compactQuery = normalizeLookupValue(query);
  if (!normalized) return [];

  return players
    .map((player) => {
      const aliases = Array.isArray(player.aliases) ? player.aliases : [];
      const nicknameScore = scoreText(player.nickname, normalized, compactQuery);
      const aliasScore = aliases
        .map((alias) => scoreText(alias, normalized, compactQuery))
        .filter((score): score is number => score !== null)
        .sort((left, right) => left - right)[0] ?? null;
      const score = [nicknameScore, aliasScore]
        .filter((value): value is number => value !== null)
        .sort((left, right) => left - right)[0] ?? null;

      return {
        player,
        score,
        aliasScore,
      };
    })
    .filter((entry) => entry.score !== null)
    .sort((left, right) => {
      if (left.score !== right.score) return (left.score ?? Number.MAX_SAFE_INTEGER) - (right.score ?? Number.MAX_SAFE_INTEGER);
      if ((left.aliasScore ?? Number.MAX_SAFE_INTEGER) !== (right.aliasScore ?? Number.MAX_SAFE_INTEGER)) {
        return (left.aliasScore ?? Number.MAX_SAFE_INTEGER) - (right.aliasScore ?? Number.MAX_SAFE_INTEGER);
      }
      return left.player.nickname.localeCompare(right.player.nickname, 'en-US');
    })
    .map((entry) => entry.player)
    .slice(0, 10);
}
