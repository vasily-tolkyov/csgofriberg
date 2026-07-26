export const MAX_GUESSES = 8;
export const GAME_TTL_SECONDS = 30 * 60;

export const DIFFICULTIES = ['easy', 'normal'] as const;
export type Difficulty = typeof DIFFICULTIES[number];

export const PLAYER_ROLES = ['top', 'jungle', 'mid', 'bot', 'support', 'coach'] as const;
export type PlayerRole = typeof PLAYER_ROLES[number];

export const PLAYER_STATUSES = ['active', 'retired', 'coach', 'free_agent', 'demoted'] as const;
export type PlayerStatus = typeof PLAYER_STATUSES[number];

export const IDENTITY_LABELS: Record<PlayerStatus, string> = {
  active: '',
  retired: '退役',
  coach: '教练',
  free_agent: '自由人',
  demoted: '已下放',
};

export type FeedbackLevel = 'green' | 'yellow' | 'gray';
export type FeedbackDirection = 'up' | 'down' | null;
export type GameStatus = 'active' | 'won' | 'lost' | 'gave_up';

export interface PlayerSource {
  url: string;
  label: string;
}

export interface PlayerRecord {
  id: string;
  nickname: string;
  aliases: string[];
  birthDate: string;
  role: PlayerRole;
  nationality: string;
  geoRegion: string;
  status: PlayerStatus;
  currentTeam: string;
  msiTitles: number;
  msiAppearances: number;
  worldsTitles: number;
  worldsAppearances: number;
  difficulties: Difficulty[];
  sources: PlayerSource[];
  verifiedAt: string;
  ageYears: number;
  identityValue: string;
  searchText: string;
}

export interface PublicPlayerProfile {
  id: string;
  nickname: string;
  aliases: string[];
  birthDate: string;
  age: number;
  role: PlayerRole;
  nationality: string;
  geoRegion: string;
  status: PlayerStatus;
  currentTeam: string;
  identity: string;
  msiTitles: number;
  msiAppearances: number;
  worldsTitles: number;
  worldsAppearances: number;
  difficulties: Difficulty[];
  sources: PlayerSource[];
  verifiedAt: string;
}

export interface GuessFieldFeedback {
  level: FeedbackLevel;
  direction?: FeedbackDirection;
}

export interface GuessFeedback {
  nickname: GuessFieldFeedback;
  role: GuessFieldFeedback;
  identity: GuessFieldFeedback;
  nationality: GuessFieldFeedback;
  age: GuessFieldFeedback;
  msiTitles: GuessFieldFeedback;
  msiAppearances: GuessFieldFeedback;
  worldsTitles: GuessFieldFeedback;
  worldsAppearances: GuessFieldFeedback;
}

export interface GuessHistoryEntry {
  index: number;
  guess: PublicPlayerProfile;
  feedback: GuessFeedback;
  correct: boolean;
}

export interface GameState {
  id: string;
  ownerId: string;
  difficulty: Difficulty;
  answerPlayerId: string;
  guessPlayerIds: string[];
  dataVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface SerializedGame {
  id: string;
  difficulty: Difficulty;
  status: 'active';
  dataVersion: string;
  guessCount: number;
  maxGuesses: number;
  ttlSeconds: number;
  createdAt: string;
  updatedAt: string;
  guesses: GuessHistoryEntry[];
}

export interface PlayerCatalog {
  version: string;
  players: PlayerRecord[];
  byId: Map<string, PlayerRecord>;
  byLookup: Map<string, PlayerRecord>;
  byDifficulty: Map<Difficulty, PlayerRecord[]>;
  publicList: Array<Pick<PublicPlayerProfile, 'id' | 'nickname' | 'aliases'>>;
  lastVerifiedAt: string | null;
  sourceStatus: {
    playersWithSources: number;
    playersWithoutSources: number;
    totalSourceLinks: number;
  };
}

export interface PlayerCatalogProvider {
  getCatalog(): Promise<PlayerCatalog>;
}

export interface GameStore {
  readonly mode: 'memory' | 'redis';
  getActiveGame(ownerId: string, difficulty: Difficulty): Promise<GameState | null>;
  getGame(ownerId: string, gameId: string): Promise<GameState | null>;
  saveGame(game: GameState): Promise<void>;
  deleteGame(game: GameState): Promise<void>;
}
