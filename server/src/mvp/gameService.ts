import { AppError } from './errors';
import { createGameState, MemoryGameStore } from './gameStore';
import { withKeyLock } from '../services/keyLock';
import {
  PlayerCatalogProvider,
  Difficulty,
  FeedbackDirection,
  FeedbackLevel,
  GameState,
  GameStatus,
  GameStore,
  GuessFeedback,
  GuessFieldFeedback,
  GuessHistoryEntry,
  GAME_TTL_SECONDS,
  MAX_GUESSES,
  SerializedGame,
} from './types';
import { resolvePlayerGuess, searchPlayers, serializePlayer } from './catalog';

function compareExact(guess: string, answer: string): GuessFieldFeedback {
  return { level: guess === answer ? 'green' : 'gray' };
}

function compareNationality(
  guessNationality: string,
  guessRegion: string,
  answerNationality: string,
  answerRegion: string
): GuessFieldFeedback {
  if (guessNationality === answerNationality) return { level: 'green' };
  if (guessRegion === answerRegion) return { level: 'yellow' };
  return { level: 'gray' };
}

function compareNumber(
  guessValue: number,
  answerValue: number,
  closeThreshold: number
): GuessFieldFeedback {
  if (guessValue === answerValue) return { level: 'green', direction: null };
  const level: FeedbackLevel = Math.abs(guessValue - answerValue) <= closeThreshold ? 'yellow' : 'gray';
  const direction: FeedbackDirection = guessValue < answerValue ? 'up' : 'down';
  return { level, direction };
}

export function buildGuessFeedback(
  guess: ReturnType<typeof serializePlayer>,
  answer: ReturnType<typeof serializePlayer>
): GuessFeedback {
  return {
    nickname: { level: guess.id === answer.id ? 'green' : 'gray' },
    role: compareExact(guess.role, answer.role),
    identity: compareExact(guess.identity, answer.identity),
    nationality: compareNationality(
      guess.nationality,
      guess.geoRegion,
      answer.nationality,
      answer.geoRegion
    ),
    age: compareNumber(guess.age, answer.age, 3),
    msiTitles: compareNumber(guess.msiTitles, answer.msiTitles, 1),
    msiAppearances: compareNumber(guess.msiAppearances, answer.msiAppearances, 1),
    worldsTitles: compareNumber(guess.worldsTitles, answer.worldsTitles, 1),
    worldsAppearances: compareNumber(guess.worldsAppearances, answer.worldsAppearances, 1),
  };
}

interface GameServiceOptions {
  catalogProvider: PlayerCatalogProvider;
  store: GameStore;
  pickIndex?: (maxExclusive: number) => number;
}

export class GameService {
  private readonly catalogProvider: PlayerCatalogProvider;
  private readonly store: GameStore;
  private readonly pickIndex: (maxExclusive: number) => number;

  constructor(options: GameServiceOptions) {
    this.catalogProvider = options.catalogProvider;
    this.store = options.store;
    this.pickIndex = options.pickIndex ?? ((maxExclusive) => Math.floor(Math.random() * maxExclusive));
  }

  get storageMode() {
    return this.store.mode;
  }

  async getMeta() {
    const catalog = await this.catalogProvider.getCatalog();
    return {
      dataVersion: catalog.version,
      difficulties: ['easy', 'normal'] as const,
      maxGuesses: MAX_GUESSES,
      ttlSeconds: GAME_TTL_SECONDS,
      storage: this.store.mode,
      lastVerifiedAt: catalog.lastVerifiedAt,
      sourceStatus: catalog.sourceStatus,
      poolSizes: {
        total: catalog.players.length,
        easy: catalog.byDifficulty.get('easy')?.length ?? 0,
        normal: catalog.byDifficulty.get('normal')?.length ?? 0,
      },
    };
  }

  async getPublicPlayerList() {
    const catalog = await this.catalogProvider.getCatalog();
    return {
      dataVersion: catalog.version,
      players: catalog.publicList,
    };
  }

  async searchPlayers(query: string) {
    const catalog = await this.catalogProvider.getCatalog();
    return {
      dataVersion: catalog.version,
      players: searchPlayers(catalog, query),
    };
  }

  async startGame(ownerId: string, difficulty: Difficulty) {
    return withKeyLock(`lol:start:${ownerId}:${difficulty}`, async () => {
      const catalog = await this.catalogProvider.getCatalog();
      const existing = await this.store.getActiveGame(ownerId, difficulty);
      if (existing && existing.dataVersion === catalog.version) {
        await this.store.saveGame(existing);
        return {
          restored: true,
          game: await this.serializeGame(existing, catalog.version),
        };
      }
      if (existing) {
        await this.store.deleteGame(existing);
      }

      const pool = catalog.byDifficulty.get(difficulty) ?? [];
      if (pool.length === 0) {
        throw new AppError(503, 'DIFFICULTY_UNAVAILABLE');
      }

      const pickedIndex = this.pickIndex(pool.length);
      const answer = pool[Math.max(0, Math.min(pool.length - 1, pickedIndex))];
      const game = createGameState({
        ownerId,
        difficulty,
        answerPlayerId: answer.id,
        dataVersion: catalog.version,
      });
      await this.store.saveGame(game);
      return {
        restored: false,
        game: await this.serializeGame(game, catalog.version),
      };
    });
  }

  async submitGuess(
    ownerId: string,
    gameId: string,
    input: { playerId?: string; nickname?: string }
  ) {
    return withKeyLock(`lol:game:${gameId}`, async () => {
      const catalog = await this.catalogProvider.getCatalog();
      const game = await this.store.getGame(ownerId, gameId);
      if (!game) throw new AppError(404, 'GAME_NOT_FOUND');
      if (game.dataVersion !== catalog.version) {
        await this.store.deleteGame(game);
        throw new AppError(409, 'GAME_DATA_CHANGED', { status: 'invalidated' });
      }
      const answer = catalog.byId.get(game.answerPlayerId);
      if (!answer) {
        await this.store.deleteGame(game);
        throw new AppError(409, 'GAME_DATA_CHANGED', { status: 'invalidated' });
      }
      const guessedPlayer = resolvePlayerGuess(catalog, input);
      if (!guessedPlayer) throw new AppError(404, 'PLAYER_NOT_FOUND');
      if (game.guessPlayerIds.includes(guessedPlayer.id)) {
        throw new AppError(409, 'DUPLICATE_GUESS');
      }

      game.guessPlayerIds.push(guessedPlayer.id);
      const serializedGuess = serializePlayer(guessedPlayer);
      const serializedAnswer = serializePlayer(answer);
      const historyEntry = this.makeHistoryEntry(
        game.guessPlayerIds.length,
        serializedGuess,
        serializedAnswer
      );
      const status: GameStatus = historyEntry.correct
        ? 'won'
        : game.guessPlayerIds.length >= MAX_GUESSES
          ? 'lost'
          : 'active';

      if (status === 'active') {
        await this.store.saveGame(game);
      } else {
        await this.store.deleteGame(game);
      }

      return {
        status,
        guessCount: game.guessPlayerIds.length,
        maxGuesses: MAX_GUESSES,
        feedback: historyEntry,
        answer: status === 'active' ? undefined : serializedAnswer,
      };
    });
  }

  async giveUp(ownerId: string, gameId: string) {
    return withKeyLock(`lol:game:${gameId}`, async () => {
      const catalog = await this.catalogProvider.getCatalog();
      const game = await this.store.getGame(ownerId, gameId);
      if (!game) throw new AppError(404, 'GAME_NOT_FOUND');
      if (game.dataVersion !== catalog.version) {
        await this.store.deleteGame(game);
        throw new AppError(409, 'GAME_DATA_CHANGED', { status: 'invalidated' });
      }
      const answer = catalog.byId.get(game.answerPlayerId);
      if (!answer) {
        await this.store.deleteGame(game);
        throw new AppError(409, 'GAME_DATA_CHANGED', { status: 'invalidated' });
      }
      await this.store.deleteGame(game);
      return {
        status: 'gave_up' as const,
        answer: serializePlayer(answer),
      };
    });
  }

  async exitGame(ownerId: string, gameId: string) {
    return withKeyLock(`lol:game:${gameId}`, async () => {
      const game = await this.store.getGame(ownerId, gameId);
      if (game) {
        await this.store.deleteGame(game);
      }
      return { status: 'abandoned' as const };
    });
  }

  private makeHistoryEntry(
    index: number,
    guess: ReturnType<typeof serializePlayer>,
    answer: ReturnType<typeof serializePlayer>
  ): GuessHistoryEntry {
    return {
      index,
      guess,
      feedback: buildGuessFeedback(guess, answer),
      correct: guess.id === answer.id,
    };
  }

  private async hydrateHistory(game: GameState, dataVersion: string): Promise<SerializedGame> {
    const catalog = await this.catalogProvider.getCatalog();
    const answer = catalog.byId.get(game.answerPlayerId);
    if (!answer || dataVersion !== catalog.version) {
      throw new AppError(409, 'GAME_DATA_CHANGED', { status: 'invalidated' });
    }
    const serializedAnswer = serializePlayer(answer);
    const guesses = game.guessPlayerIds.map((guessedId, index) => {
      const player = catalog.byId.get(guessedId);
      if (!player) {
        throw new AppError(409, 'GAME_DATA_CHANGED', { status: 'invalidated' });
      }
      return this.makeHistoryEntry(index + 1, serializePlayer(player), serializedAnswer);
    });
    return {
      id: game.id,
      difficulty: game.difficulty,
      status: 'active',
      dataVersion: game.dataVersion,
      guessCount: game.guessPlayerIds.length,
      maxGuesses: MAX_GUESSES,
      ttlSeconds: GAME_TTL_SECONDS,
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
      guesses,
    };
  }

  private serializeGame(game: GameState, dataVersion: string) {
    return this.hydrateHistory(game, dataVersion);
  }
}

export function createMemoryGameService(
  provider: PlayerCatalogProvider,
  clock?: () => number
) {
  return new GameService({
    catalogProvider: provider,
    store: new MemoryGameStore(clock),
  });
}
