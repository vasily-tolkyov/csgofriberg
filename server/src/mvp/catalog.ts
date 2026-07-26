import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import {
  DIFFICULTIES,
  Difficulty,
  IDENTITY_LABELS,
  PLAYER_ROLES,
  PLAYER_STATUSES,
  PlayerCatalog,
  PlayerCatalogProvider,
  PlayerRecord,
  PlayerRole,
  PlayerSource,
  PlayerStatus,
  PublicPlayerProfile,
} from './types';

const roleMap: Record<string, PlayerRole> = {
  awper: 'mid',
  adc: 'bot',
  bot: 'bot',
  carry: 'bot',
  coach: 'coach',
  igl: 'jungle',
  jungle: 'jungle',
  lurker: 'bot',
  mid: 'mid',
  rifler: 'top',
  roamer: 'support',
  shotcaller: 'jungle',
  support: 'support',
  top: 'top',
};

const rawDifficultySchema = z.enum(DIFFICULTIES);
const rawStatusSchema = z.enum(PLAYER_STATUSES);
const rawRoleSchema = z.enum(PLAYER_ROLES);

const generatedPlayerSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  nickname: z.string().min(1),
  aliases: z.array(z.string().min(1)).optional().default([]),
  birthDate: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
  nationality: z.string().min(1),
  geoRegion: z.string().min(1).optional(),
  region: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  currentTeam: z.string().optional(),
  team: z.string().optional(),
  msiTitles: z.number().int().min(0).optional(),
  msiAppearances: z.number().int().min(0).optional(),
  worldsTitles: z.number().int().min(0).optional(),
  worldsAppearances: z.number().int().min(0).optional(),
  difficulties: z.array(z.string().min(1)).optional(),
  sources: z.array(
    z.union([
      z.string().min(1),
      z.object({
        url: z.string().min(1),
        label: z.string().min(1),
      }),
    ])
  ).optional().default([]),
  verifiedAt: z.string().min(1).optional(),
  age: z.number().int().positive().optional(),
  is_easy: z.union([z.boolean(), z.number().int()]).optional(),
  is_active: z.union([z.boolean(), z.number().int()]).optional(),
  major_championships: z.number().int().min(0).optional(),
  major_appearances: z.number().int().min(0).optional(),
});

const easyMembershipSchema = z.array(
  z.object({
    nickname: z.string().min(1),
  })
);

function normalizeText(value: string): string {
  return value.trim();
}

function normalizeLookup(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '');
}

function isOrderedSubsequence(query: string, candidate: string): boolean {
  let queryIndex = 0;
  for (const character of candidate) {
    if (character === query[queryIndex]) queryIndex += 1;
    if (queryIndex === query.length) return true;
  }
  return false;
}

function levenshteinDistance(left: string, right: string, limit: number): number {
  if (Math.abs(left.length - right.length) > limit) return limit + 1;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    let rowMinimum = current[0];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      const value = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost
      );
      current.push(value);
      rowMinimum = Math.min(rowMinimum, value);
    }
    if (rowMinimum > limit) return limit + 1;
    previous = current;
  }
  return previous[right.length];
}

function fuzzyTermScore(query: string, term: string): number | null {
  if (!query || !term) return null;
  if (term === query) return 0;
  if (term.startsWith(query)) return 10 + (term.length - query.length) / 100;
  const substringIndex = term.indexOf(query);
  if (substringIndex >= 0) return 20 + substringIndex / 100;

  if (
    query.length >= 3
    && query.length / term.length >= 0.5
    && isOrderedSubsequence(query, term)
  ) {
    return 30 + (term.length - query.length) / 100;
  }

  const editLimit = query.length >= 7 ? 2 : query.length >= 3 ? 1 : 0;
  if (editLimit === 0) return null;
  const distance = levenshteinDistance(query, term, editLimit);
  return distance <= editLimit ? 40 + distance + Math.abs(term.length - query.length) / 100 : null;
}

function playerSearchScore(player: PlayerRecord, query: string): number | null {
  let best: number | null = null;
  for (const rawTerm of [player.nickname, ...player.aliases]) {
    const score = fuzzyTermScore(query, normalizeLookup(rawTerm));
    if (score !== null && (best === null || score < best)) best = score;
  }
  return best;
}

function stableIdFromNickname(nickname: string): string {
  return crypto.createHash('sha1').update(nickname).digest('hex').slice(0, 16);
}

function normalizeRole(value: string | undefined, nickname: string): PlayerRole {
  if (value) {
    const trimmed = value.trim().toLocaleLowerCase();
    const strict = rawRoleSchema.safeParse(trimmed);
    if (strict.success) return strict.data;
    if (trimmed in roleMap) return roleMap[trimmed];
  }
  const fallback = stableIdFromNickname(nickname).charCodeAt(0) % PLAYER_ROLES.length;
  return PLAYER_ROLES[fallback];
}

function normalizeStatus(value: string | undefined, isActive: unknown): PlayerStatus {
  if (value) {
    const strict = rawStatusSchema.safeParse(value.trim().toLocaleLowerCase());
    if (strict.success) return strict.data;
  }
  if (typeof isActive === 'boolean') {
    return isActive ? 'active' : 'retired';
  }
  if (typeof isActive === 'number') {
    return Boolean(isActive) ? 'active' : 'retired';
  }
  return 'active';
}

function makeBirthDate(age: number, now: Date): string {
  const year = now.getUTCFullYear() - age;
  return `${year.toString().padStart(4, '0')}-01-01`;
}

function computeAge(birthDate: string, now: Date): number {
  const date = new Date(`${birthDate}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf())) {
    throw new Error(`INVALID_BIRTHDATE:${birthDate}`);
  }
  let age = now.getUTCFullYear() - date.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - date.getUTCMonth();
  const beforeBirthday = monthDelta < 0
    || (monthDelta === 0 && now.getUTCDate() < date.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function normalizeDifficulties(
  rawDifficulties: string[] | undefined,
  easyNicknames: Set<string>,
  nickname: string,
  legacyEasy: boolean | number | undefined
): Difficulty[] {
  const normalized = new Set<Difficulty>();
  for (const entry of rawDifficulties ?? []) {
    const parsed = rawDifficultySchema.safeParse(entry.trim().toLocaleLowerCase());
    if (parsed.success) normalized.add(parsed.data);
  }
  normalized.add('normal');
  if (easyNicknames.has(normalizeLookup(nickname)) || Boolean(legacyEasy)) {
    normalized.add('easy');
  }
  return [...normalized];
}

function identityValueFor(status: PlayerStatus, currentTeam: string): string {
  return status === 'active' ? currentTeam : IDENTITY_LABELS[status];
}

function normalizeSources(rawSources: Array<string | PlayerSource>): PlayerSource[] {
  return rawSources.map((entry) => {
    if (typeof entry === 'string') {
      return { url: entry, label: entry };
    }
    return {
      url: normalizeText(entry.url),
      label: normalizeText(entry.label),
    };
  });
}

function toPublicProfile(player: PlayerRecord): PublicPlayerProfile {
  return {
    id: player.id,
    nickname: player.nickname,
    aliases: [...player.aliases],
    birthDate: player.birthDate,
    age: player.ageYears,
    role: player.role,
    nationality: player.nationality,
    geoRegion: player.geoRegion,
    status: player.status,
    currentTeam: player.currentTeam,
    identity: player.identityValue,
    msiTitles: player.msiTitles,
    msiAppearances: player.msiAppearances,
    worldsTitles: player.worldsTitles,
    worldsAppearances: player.worldsAppearances,
    difficulties: [...player.difficulties],
    sources: [...player.sources],
    verifiedAt: player.verifiedAt,
  };
}

function normalizePlayer(
  rawPlayer: z.infer<typeof generatedPlayerSchema>,
  easyNicknames: Set<string>,
  now: Date
): PlayerRecord {
  const nickname = normalizeText(rawPlayer.nickname);
  const id = rawPlayer.id != null ? String(rawPlayer.id) : stableIdFromNickname(nickname);
  const aliases = [...new Set(
    (rawPlayer.aliases ?? [])
      .map((alias) => normalizeText(alias))
      .filter((alias) => alias.length > 0 && normalizeLookup(alias) !== normalizeLookup(nickname))
  )];
  const birthDate = rawPlayer.birthDate
    ? normalizeText(rawPlayer.birthDate)
    : rawPlayer.age
      ? makeBirthDate(rawPlayer.age, now)
      : '2000-01-01';
  const status = normalizeStatus(rawPlayer.status, rawPlayer.is_active);
  const currentTeam = normalizeText(rawPlayer.currentTeam ?? rawPlayer.team ?? '');
  const verifiedAt = normalizeText(rawPlayer.verifiedAt ?? now.toISOString());
  const geoRegion = normalizeText(rawPlayer.geoRegion ?? rawPlayer.region ?? 'Unknown');
  const nationality = normalizeText(rawPlayer.nationality);
  const role = normalizeRole(rawPlayer.role, nickname);
  const difficulties = normalizeDifficulties(
    rawPlayer.difficulties,
    easyNicknames,
    nickname,
    rawPlayer.is_easy
  );

  const player: PlayerRecord = {
    id,
    nickname,
    aliases,
    birthDate,
    role,
    nationality,
    geoRegion,
    status,
    currentTeam,
    msiTitles: rawPlayer.msiTitles ?? rawPlayer.major_championships ?? 0,
    msiAppearances: rawPlayer.msiAppearances ?? rawPlayer.major_appearances ?? 0,
    worldsTitles: rawPlayer.worldsTitles ?? rawPlayer.major_championships ?? 0,
    worldsAppearances: rawPlayer.worldsAppearances ?? rawPlayer.major_appearances ?? 0,
    difficulties,
    sources: normalizeSources(rawPlayer.sources ?? []),
    verifiedAt,
    ageYears: computeAge(birthDate, now),
    identityValue: identityValueFor(status, currentTeam),
    searchText: '',
  };

  player.searchText = normalizeLookup([
    player.nickname,
    ...player.aliases,
    player.nationality,
    player.geoRegion,
    player.currentTeam,
    player.identityValue,
    player.status,
  ].join(' '));
  return player;
}

function buildCatalog(
  rawPlayers: unknown,
  rawEasyMembership: unknown,
  now: Date,
  version: string
): PlayerCatalog {
  const parsedPlayers = z.array(generatedPlayerSchema).parse(rawPlayers);
  const parsedEasyMembership = easyMembershipSchema.parse(rawEasyMembership);
  const easyNicknames = new Set(parsedEasyMembership.map((entry) => normalizeLookup(entry.nickname)));
  const players = parsedPlayers.map((player) => normalizePlayer(player, easyNicknames, now));
  const byId = new Map<string, PlayerRecord>();
  const byLookup = new Map<string, PlayerRecord>();
  for (const player of players) {
    byId.set(player.id, player);
    byLookup.set(normalizeLookup(player.nickname), player);
    for (const alias of player.aliases) {
      byLookup.set(normalizeLookup(alias), player);
    }
  }

  const byDifficulty = new Map<Difficulty, PlayerRecord[]>(
    DIFFICULTIES.map((difficulty) => [
      difficulty,
      players.filter((player) => player.difficulties.includes(difficulty)),
    ])
  );
  const verifiedDates = players
    .map((player) => player.verifiedAt)
    .filter((value) => value.length > 0)
    .sort();
  const playersWithSources = players.filter((player) => player.sources.length > 0).length;

  return {
    version,
    players,
    byId,
    byLookup,
    byDifficulty,
    publicList: players.map((player) => ({
      id: player.id,
      nickname: player.nickname,
      aliases: [...player.aliases],
    })),
    lastVerifiedAt: verifiedDates.at(-1) ?? null,
    sourceStatus: {
      playersWithSources,
      playersWithoutSources: players.length - playersWithSources,
      totalSourceLinks: players.reduce((sum, player) => sum + player.sources.length, 0),
    },
  };
}

interface FileFingerprint {
  mtimeMs: number;
  size: number;
}

interface ProviderOptions {
  playersPath?: string;
  easyPlayersPath?: string;
  now?: () => Date;
}

export class FilePlayerCatalogProvider implements PlayerCatalogProvider {
  private readonly playersPath: string;
  private readonly easyPlayersPath: string;
  private readonly now: () => Date;
  private cachedCatalog: PlayerCatalog | null = null;
  private playersFingerprint: FileFingerprint | null = null;
  private easyFingerprint: FileFingerprint | null = null;

  constructor(options: ProviderOptions = {}) {
    this.playersPath = options.playersPath ?? path.resolve(__dirname, '../db/seeds/players.json');
    this.easyPlayersPath = options.easyPlayersPath ?? path.resolve(__dirname, '../db/seeds/easy-players.json');
    this.now = options.now ?? (() => new Date());
  }

  async getCatalog(): Promise<PlayerCatalog> {
    const [playersStat, easyStat] = await Promise.all([
      fs.stat(this.playersPath),
      fs.stat(this.easyPlayersPath),
    ]);
    const playersFingerprint = { mtimeMs: playersStat.mtimeMs, size: playersStat.size };
    const easyFingerprint = { mtimeMs: easyStat.mtimeMs, size: easyStat.size };
    if (
      this.cachedCatalog
      && this.playersFingerprint
      && this.easyFingerprint
      && this.playersFingerprint.mtimeMs === playersFingerprint.mtimeMs
      && this.playersFingerprint.size === playersFingerprint.size
      && this.easyFingerprint.mtimeMs === easyFingerprint.mtimeMs
      && this.easyFingerprint.size === easyFingerprint.size
    ) {
      return this.cachedCatalog;
    }

    const [playersRaw, easyRaw] = await Promise.all([
      fs.readFile(this.playersPath, 'utf8'),
      fs.readFile(this.easyPlayersPath, 'utf8'),
    ]);
    const version = crypto.createHash('sha256')
      .update(playersRaw)
      .update('\n--easy--\n')
      .update(easyRaw)
      .digest('hex');
    const catalog = buildCatalog(
      JSON.parse(playersRaw) as unknown,
      JSON.parse(easyRaw) as unknown,
      this.now(),
      version
    );
    this.cachedCatalog = catalog;
    this.playersFingerprint = playersFingerprint;
    this.easyFingerprint = easyFingerprint;
    return catalog;
  }
}

export function getIdentityValue(status: PlayerStatus, currentTeam: string): string {
  return identityValueFor(status, currentTeam);
}

export function serializePlayer(player: PlayerRecord): PublicPlayerProfile {
  return toPublicProfile(player);
}

export function searchPlayers(
  catalog: PlayerCatalog,
  query: string,
  limit = 25
): PublicPlayerProfile[] {
  const normalized = normalizeLookup(query);
  if (!normalized) return [];

  return catalog.players
    .map((player) => ({ player, score: playerSearchScore(player, normalized) }))
    .filter((entry): entry is { player: PlayerRecord; score: number } => entry.score !== null)
    .sort((left, right) => (
      left.score - right.score
      || left.player.nickname.localeCompare(right.player.nickname, 'en-US')
    ))
    .slice(0, limit)
    .map(({ player }) => toPublicProfile(player));
}

export function resolvePlayerGuess(
  catalog: PlayerCatalog,
  input: { playerId?: string; nickname?: string }
): PlayerRecord | null {
  if (input.playerId) {
    return catalog.byId.get(input.playerId) ?? null;
  }
  if (input.nickname) {
    return catalog.byLookup.get(normalizeLookup(input.nickname)) ?? null;
  }
  return null;
}
