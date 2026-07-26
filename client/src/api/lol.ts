import axios from 'axios';
import { api } from './client';

export type PlayerId = string;
export type FeedbackLevel = 'correct' | 'close' | 'wrong';
export type GuessHint = 'higher' | 'lower';
export type GameStatus = 'playing' | 'won' | 'lost';

export type GuessColumnKey =
  | 'teamIdentity'
  | 'nationalityRegion'
  | 'age'
  | 'role'
  | 'msiTitles'
  | 'msiAppearances'
  | 'worldsTitles'
  | 'worldsAppearances';

export interface GuessAttribute {
  value?: string | number | boolean;
  level: FeedbackLevel;
  hint?: GuessHint;
}

export interface GuessRow {
  playerId: PlayerId;
  nickname: string;
  correct: boolean;
  attributes: Record<GuessColumnKey, GuessAttribute>;
}

export interface PlayerSuggestion {
  id: PlayerId;
  nickname: string;
  aliases: string[];
}

export interface PlayerProfile {
  id: PlayerId;
  nickname: string;
  aliases: string[];
  teamIdentity: string;
  nationalityRegion: string;
  age: number | null;
  role: string;
  msiTitles: number | null;
  msiAppearances: number | null;
  worldsTitles: number | null;
  worldsAppearances: number | null;
  active: boolean | null;
}

export interface SingleGameSession {
  gameId: string;
  difficulty: string;
  maxGuesses: number;
  guesses: GuessRow[];
}

export interface GuessResult {
  feedback: GuessRow | null;
  status: GameStatus;
  guessCount: number;
  maxGuesses: number;
  answer: PlayerProfile | null;
}

export interface AppMeta {
  title: string;
  subtitle: string;
  brandStatus: string;
  dataVersion: string;
  lastVerifiedAt: string | null;
  poolSizes: {
    easy: number;
    normal: number;
    total: number;
  };
  sourceStatus: {
    playersWithSources: number;
    playersWithoutSources: number;
    totalSourceLinks: number;
  };
  links: {
    source: string;
    upstream: string;
    license: string;
  };
}

const FALLBACK_META: AppMeta = {
  title: '弗一把',
  subtitle: '英雄联盟版 · 社区衍生项目',
  brandStatus: '“弗一把”名称沿用尚待原作者许可；公开上线前未获许可时将改用“召一把”。',
  dataVersion: 'local-sample',
  lastVerifiedAt: '2026-07-26',
  poolSizes: {
    easy: 12,
    normal: 20,
    total: 20,
  },
  sourceStatus: {
    playersWithSources: 20,
    playersWithoutSources: 0,
    totalSourceLinks: 40,
  },
  links: {
    source: 'https://github.com/vasily-tolkyov/csgofriberg',
    upstream: 'https://github.com/shnlfriberg/csgofriberg',
    license: 'https://www.gnu.org/licenses/agpl-3.0.html',
  },
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function firstNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return undefined;
}

function firstBoolean(record: Record<string, unknown>, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'boolean') return value;
    if (value === 1 || value === '1') return true;
    if (value === 0 || value === '0') return false;
  }
  return undefined;
}

function normalizeId(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function normalizeAliases(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => typeof item === 'string' ? item.trim() : '')
    .filter(Boolean);
}

function normalizeHint(value: unknown): GuessHint | undefined {
  if (value === 'higher' || value === 'up') return 'higher';
  if (value === 'lower' || value === 'down') return 'lower';
  return undefined;
}

function normalizeLevel(value: unknown): FeedbackLevel {
  if (value === 'correct' || value === 'green') return 'correct';
  if (value === 'close' || value === 'yellow') return 'close';
  if (value === 'wrong' || value === 'gray') return 'wrong';
  return 'wrong';
}

function normalizeGameStatus(value: unknown): GameStatus {
  if (value === 'won' || value === 'win' || value === 'solved') return 'won';
  if (value === 'lost' || value === 'lose' || value === 'gave_up' || value === 'failed' || value === 'revealed') {
    return 'lost';
  }
  return 'playing';
}

function normalizeAttribute(value: unknown, fallbackValue?: string | number | boolean | null): GuessAttribute {
  const record = asRecord(value);
  const directValue = record.value;
  const normalizedValue =
    typeof directValue === 'string' || typeof directValue === 'number' || typeof directValue === 'boolean'
      ? directValue
      : fallbackValue ?? undefined;
  return {
    value: normalizedValue === null ? undefined : normalizedValue,
    level: normalizeLevel(record.level ?? record.status ?? value),
    hint: normalizeHint(record.hint ?? record.direction),
  };
}

function combineNationalityRegion(record: Record<string, unknown>): string {
  const nationality = firstString(record, ['nationality', 'country', 'countryOrRegion', 'nationalityLabel']) ?? '';
  const region = firstString(record, ['geoRegion', 'region', 'geo', 'regionLabel', 'area']) ?? '';
  const nationalityLabels: Record<string, string> = {
    China: '中国',
    'South Korea': '韩国',
    'United States': '美国',
    Canada: '加拿大',
    Germany: '德国',
    Denmark: '丹麦',
    France: '法国',
    Slovenia: '斯洛文尼亚',
    Spain: '西班牙',
    Poland: '波兰',
    Sweden: '瑞典',
    Vietnam: '越南',
    Japan: '日本',
    Taiwan: '中国台湾',
  };
  const regionLabels: Record<string, string> = {
    China: '中国赛区',
    Korea: '韩国赛区',
    Americas: '美洲',
    EMEA: '欧洲、中东与非洲',
    Pacific: '太平洋赛区',
  };
  const nationalityLabel = nationalityLabels[nationality] ?? nationality;
  const regionLabel = regionLabels[region] ?? region;
  if (nationalityLabel && regionLabel) return `${nationalityLabel}（${regionLabel}）`;
  return nationalityLabel || regionLabel || '未知';
}

function deriveStatusIdentity(record: Record<string, unknown>): string | undefined {
  const status = firstString(record, ['status', 'playerStatus'])?.toLowerCase();
  if (!status) return undefined;
  if (status.includes('coach')) return '教练';
  if (status.includes('free')) return '自由人';
  if (status.includes('demot') || status.includes('bench') || status.includes('sub')) return '已下放';
  if (status.includes('retire') || status.includes('inactive')) return '退役';
  return undefined;
}

function normalizeTeamIdentity(record: Record<string, unknown>): string {
  const explicit = firstString(record, [
    'teamIdentity',
    'teamOrIdentity',
    'identity',
    'identityLabel',
    'statusLabel',
  ]);
  if (explicit) return explicit;

  const statusIdentity = deriveStatusIdentity(record);
  const isActive = firstBoolean(record, ['isActive', 'active', 'is_active']);
  const team = firstString(record, ['currentTeam', 'team']);
  if ((isActive !== false || !statusIdentity) && team) return team;
  return statusIdentity || team || '未知';
}

function normalizeRole(record: Record<string, unknown>): string {
  const value = firstString(record, ['role', 'position', 'lane']) ?? '未知';
  const labels: Record<string, string> = {
    top: '上单',
    jungle: '打野',
    mid: '中单',
    bot: '下路',
    adc: '下路',
    support: '辅助',
    coach: '教练',
  };
  return labels[value.toLowerCase()] ?? value;
}

function normalizeProfile(raw: unknown): PlayerProfile {
  const record = asRecord(raw);
  const active = firstBoolean(record, ['isActive', 'active', 'is_active']);
  return {
    id: normalizeId(record.id ?? record.playerId ?? record.slug),
    nickname: firstString(record, ['nickname', 'name']) ?? '未知选手',
    aliases: normalizeAliases(record.aliases ?? record.aka ?? record.altNames),
    teamIdentity: normalizeTeamIdentity(record),
    nationalityRegion:
      firstString(record, ['nationalityRegion', 'countryOrRegion']) ?? combineNationalityRegion(record),
    age: firstNumber(record, ['age']) ?? null,
    role: normalizeRole(record),
    msiTitles: firstNumber(record, ['msiTitles', 'msiChampionships', 'majorChampionships']) ?? null,
    msiAppearances: firstNumber(record, ['msiAppearances', 'msiAttendances', 'majorAppearances']) ?? null,
    worldsTitles: firstNumber(record, ['worldsTitles', 'worldTitles', 'sTitles']) ?? null,
    worldsAppearances: firstNumber(record, ['worldsAppearances', 'worldAppearances', 'sAppearances']) ?? null,
    active: active ?? (!deriveStatusIdentity(record) && Boolean(firstString(record, ['currentTeam', 'team']))),
  };
}

function normalizeGuessRow(raw: unknown): GuessRow {
  const record = asRecord(raw);
  const legacyAttributes = asRecord(record.attributes);
  if (Object.keys(legacyAttributes).length > 0) {
    const nationality = normalizeAttribute(legacyAttributes.nationality);
    const region = normalizeAttribute(legacyAttributes.region);
    const nationalityValue = typeof nationality.value === 'string' ? nationality.value : undefined;
    const regionValue = typeof region.value === 'string' ? region.value : undefined;
    return {
      playerId: normalizeId(record.playerId ?? record.id),
      nickname: firstString(record, ['nickname', 'name']) ?? '未知选手',
      correct: firstBoolean(record, ['correct']) ?? false,
      attributes: {
        teamIdentity: normalizeAttribute(
          legacyAttributes.teamIdentity ?? legacyAttributes.teamOrIdentity ?? legacyAttributes.identity ?? legacyAttributes.team
        ),
        nationalityRegion: normalizeAttribute(
          legacyAttributes.nationalityRegion ?? {
            value: nationalityValue && regionValue ? `${nationalityValue}（${regionValue}）` : nationalityValue ?? regionValue,
            level:
              nationality.level === 'correct'
                ? 'correct'
                : nationality.level === 'close' || region.level === 'close'
                  ? 'close'
                  : nationality.level,
          }
        ),
        age: normalizeAttribute(legacyAttributes.age),
        role: normalizeAttribute(legacyAttributes.role ?? legacyAttributes.position),
        msiTitles: normalizeAttribute(
          legacyAttributes.msiTitles ?? legacyAttributes.msiChampionships ?? legacyAttributes.majorChampionships
        ),
        msiAppearances: normalizeAttribute(
          legacyAttributes.msiAppearances ?? legacyAttributes.msiAttendances ?? legacyAttributes.majorAppearances
        ),
        worldsTitles: normalizeAttribute(legacyAttributes.worldsTitles ?? legacyAttributes.worldTitles ?? legacyAttributes.sTitles),
        worldsAppearances: normalizeAttribute(
          legacyAttributes.worldsAppearances ?? legacyAttributes.worldAppearances ?? legacyAttributes.sAppearances
        ),
      },
    };
  }

  const guessRecord = asRecord(record.guess);
  const feedbackRecord = asRecord(record.feedback);
  const profile = normalizeProfile(record.guess ? guessRecord : record);

  const teamIdentityFeedback = feedbackRecord.identity ?? feedbackRecord.teamIdentity ?? feedbackRecord.team;
  const nationalityFeedback = feedbackRecord.nationality ?? feedbackRecord.nationalityRegion;

  return {
    playerId: profile.id,
    nickname: profile.nickname,
    correct: firstBoolean(record, ['correct']) ?? false,
    attributes: {
      teamIdentity: normalizeAttribute(teamIdentityFeedback, profile.teamIdentity),
      nationalityRegion: normalizeAttribute(nationalityFeedback, profile.nationalityRegion),
      age: normalizeAttribute(feedbackRecord.age, profile.age),
      role: normalizeAttribute(feedbackRecord.role ?? feedbackRecord.position, profile.role),
      msiTitles: normalizeAttribute(feedbackRecord.msiTitles ?? feedbackRecord.msiChampionships, profile.msiTitles),
      msiAppearances: normalizeAttribute(
        feedbackRecord.msiAppearances ?? feedbackRecord.msiAttendances,
        profile.msiAppearances
      ),
      worldsTitles: normalizeAttribute(feedbackRecord.worldsTitles ?? feedbackRecord.worldTitles, profile.worldsTitles),
      worldsAppearances: normalizeAttribute(
        feedbackRecord.worldsAppearances ?? feedbackRecord.worldAppearances,
        profile.worldsAppearances
      ),
    },
  };
}

function normalizeSession(raw: unknown, requestedDifficulty: string): SingleGameSession {
  const rootRecord = asRecord(raw);
  const record = rootRecord.game ? asRecord(rootRecord.game) : rootRecord;
  const guesses = Array.isArray(record.guesses) ? record.guesses.map(normalizeGuessRow) : [];
  return {
    gameId: firstString(record, ['gameId', 'id']) ?? '',
    difficulty: firstString(record, ['difficulty', 'mode']) ?? requestedDifficulty,
    maxGuesses: firstNumber(record, ['maxGuesses']) ?? 8,
    guesses,
  };
}

function findTerminalAnswer(record: Record<string, unknown>): unknown {
  return record.answer ?? record.target ?? record.solution ?? record.player ?? null;
}

function normalizeGuessResult(raw: unknown): GuessResult {
  const record = asRecord(raw);
  const guesses = Array.isArray(record.guesses) ? record.guesses.map(normalizeGuessRow) : [];
  const latestGuess = record.feedback
    ? normalizeGuessRow(record.feedback)
    : record.guess
      ? normalizeGuessRow(record)
      : guesses.at(-1) ?? null;

  return {
    feedback: latestGuess,
    status: normalizeGameStatus(record.status),
    guessCount: firstNumber(record, ['guessCount']) ?? guesses.length,
    maxGuesses: firstNumber(record, ['maxGuesses']) ?? 8,
    answer: findTerminalAnswer(record) ? normalizeProfile(findTerminalAnswer(record)) : null,
  };
}

function normalizeSuggestion(raw: unknown): PlayerSuggestion {
  const record = asRecord(raw);
  return {
    id: normalizeId(record.id ?? record.playerId ?? record.slug),
    nickname: firstString(record, ['nickname', 'name']) ?? '未知选手',
    aliases: normalizeAliases(record.aliases ?? record.aka ?? record.altNames),
  };
}

export async function fetchMeta(): Promise<AppMeta> {
  try {
    const response = await api.get('/meta');
    const record = asRecord(response.data);
    return {
      title: firstString(record, ['title']) ?? FALLBACK_META.title,
      subtitle: firstString(record, ['subtitle']) ?? FALLBACK_META.subtitle,
      brandStatus: firstString(record, ['brandStatus', 'brandConsentStatus']) ?? FALLBACK_META.brandStatus,
      dataVersion: firstString(record, ['dataVersion']) ?? FALLBACK_META.dataVersion,
      lastVerifiedAt: firstString(record, ['lastVerifiedAt']) ?? FALLBACK_META.lastVerifiedAt,
      poolSizes: {
        easy: firstNumber(asRecord(record.poolSizes), ['easy']) ?? FALLBACK_META.poolSizes.easy,
        normal: firstNumber(asRecord(record.poolSizes), ['normal']) ?? FALLBACK_META.poolSizes.normal,
        total: firstNumber(asRecord(record.poolSizes), ['total']) ?? FALLBACK_META.poolSizes.total,
      },
      sourceStatus: {
        playersWithSources:
          firstNumber(asRecord(record.sourceStatus), ['playersWithSources'])
          ?? FALLBACK_META.sourceStatus.playersWithSources,
        playersWithoutSources:
          firstNumber(asRecord(record.sourceStatus), ['playersWithoutSources'])
          ?? FALLBACK_META.sourceStatus.playersWithoutSources,
        totalSourceLinks:
          firstNumber(asRecord(record.sourceStatus), ['totalSourceLinks'])
          ?? FALLBACK_META.sourceStatus.totalSourceLinks,
      },
      links: {
        source: firstString(asRecord(record.links), ['source']) ?? FALLBACK_META.links.source,
        upstream: firstString(asRecord(record.links), ['upstream']) ?? FALLBACK_META.links.upstream,
        license: firstString(asRecord(record.links), ['license']) ?? FALLBACK_META.links.license,
      },
    };
  } catch {
    return FALLBACK_META;
  }
}

export async function fetchPlayerSuggestions(): Promise<PlayerSuggestion[]> {
  const response = await api.get('/players/list');
  const payload: unknown[] = Array.isArray(response.data)
    ? response.data
    : Array.isArray(response.data?.players)
      ? response.data.players
      : [];
  return payload
    .map(normalizeSuggestion)
    .filter((item: PlayerSuggestion) => item.id && item.nickname);
}

export async function searchPlayers(query: string): Promise<PlayerProfile[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  try {
    const response = await api.get('/players/search', { params: { q: trimmed } });
    const payload = Array.isArray(response.data?.players) ? response.data.players : response.data;
    return Array.isArray(payload) ? payload.map(normalizeProfile) : [];
  } catch (error) {
    if (!axios.isAxiosError(error) || error.response?.status !== 404) throw error;
    const fallback = await api.get('/players', {
      params: { search: trimmed },
    });
    return Array.isArray(fallback.data) ? fallback.data.map(normalizeProfile) : [];
  }
}

export async function startSingleGame(difficulty: string): Promise<SingleGameSession> {
  const response = await api.post('/game/start', { difficulty, mode: difficulty });
  return normalizeSession(response.data, difficulty);
}

export async function submitGuess(gameId: string, playerId: PlayerId): Promise<GuessResult> {
  const response = await api.post(`/game/${gameId}/guess`, { playerId });
  return normalizeGuessResult(response.data);
}

export async function giveUpSingleGame(gameId: string): Promise<GuessResult> {
  const response = await api.post(`/game/${gameId}/giveup`);
  return normalizeGuessResult(response.data);
}

export async function exitSingleGame(gameId: string): Promise<void> {
  await api.post(`/game/${gameId}/exit`);
}
