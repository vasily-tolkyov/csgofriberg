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

export function searchPlayerList(players: PlayerSuggestion[], query: string): PlayerSuggestion[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];
  return players
    .filter((player) => {
      const aliases = Array.isArray(player.aliases) ? player.aliases : [];
      return (
      player.nickname.toLocaleLowerCase().includes(normalized) ||
      aliases.some((alias) => alias.toLocaleLowerCase().includes(normalized))
      );
    })
    .sort((a, b) => {
      const aName = a.nickname.toLocaleLowerCase();
      const bName = b.nickname.toLocaleLowerCase();
      const aAliases = Array.isArray(a.aliases) ? a.aliases : [];
      const bAliases = Array.isArray(b.aliases) ? b.aliases : [];
      const aAlias = aAliases.some((alias) => alias.toLocaleLowerCase().startsWith(normalized));
      const bAlias = bAliases.some((alias) => alias.toLocaleLowerCase().startsWith(normalized));
      return Number(bName.startsWith(normalized) || bAlias) - Number(aName.startsWith(normalized) || aAlias) ||
        a.nickname.localeCompare(b.nickname);
    })
    .slice(0, 10);
}
