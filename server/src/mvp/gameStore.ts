import { randomUUID } from 'crypto';
import { evalCommandScript, redisKey, redis } from '../redis';
import { Difficulty, GAME_TTL_SECONDS, GameState, GameStore } from './types';

function nowIso(clock: () => number): string {
  return new Date(clock()).toISOString();
}

function activeKey(ownerId: string, difficulty: Difficulty): string {
  return redisKey(`lol:active:${ownerId}:${difficulty}`);
}

function gameKey(gameId: string): string {
  return redisKey(`lol:game:${gameId}`);
}

export function createGameState(input: {
  ownerId: string;
  difficulty: Difficulty;
  answerPlayerId: string;
  dataVersion: string;
  clock?: () => number;
}): GameState {
  const clock = input.clock ?? Date.now;
  const timestamp = nowIso(clock);
  return {
    id: randomUUID(),
    ownerId: input.ownerId,
    difficulty: input.difficulty,
    answerPlayerId: input.answerPlayerId,
    guessPlayerIds: [],
    dataVersion: input.dataVersion,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export class MemoryGameStore implements GameStore {
  readonly mode = 'memory' as const;
  private readonly clock: () => number;
  private readonly games = new Map<string, { game: GameState; expiresAt: number }>();
  private readonly active = new Map<string, { gameId: string; expiresAt: number }>();

  constructor(clock: () => number = Date.now) {
    this.clock = clock;
  }

  private purgeExpired(): void {
    const now = this.clock();
    for (const [key, record] of this.games.entries()) {
      if (record.expiresAt <= now) {
        this.games.delete(key);
      }
    }
    for (const [key, record] of this.active.entries()) {
      if (record.expiresAt <= now || !this.games.has(record.gameId)) {
        this.active.delete(key);
      }
    }
  }

  private activeIndexKey(ownerId: string, difficulty: Difficulty): string {
    return `${ownerId}:${difficulty}`;
  }

  async getActiveGame(ownerId: string, difficulty: Difficulty): Promise<GameState | null> {
    this.purgeExpired();
    const record = this.active.get(this.activeIndexKey(ownerId, difficulty));
    if (!record) return null;
    return this.getGame(ownerId, record.gameId);
  }

  async getGame(ownerId: string, gameId: string): Promise<GameState | null> {
    this.purgeExpired();
    const record = this.games.get(gameId);
    if (!record || record.game.ownerId !== ownerId) return null;
    return structuredClone(record.game);
  }

  async saveGame(game: GameState): Promise<void> {
    this.purgeExpired();
    const expiresAt = this.clock() + GAME_TTL_SECONDS * 1000;
    const updatedGame = {
      ...game,
      updatedAt: nowIso(this.clock),
    };
    this.games.set(updatedGame.id, { game: structuredClone(updatedGame), expiresAt });
    this.active.set(this.activeIndexKey(updatedGame.ownerId, updatedGame.difficulty), {
      gameId: updatedGame.id,
      expiresAt,
    });
  }

  async deleteGame(game: GameState): Promise<void> {
    this.games.delete(game.id);
    const key = this.activeIndexKey(game.ownerId, game.difficulty);
    const record = this.active.get(key);
    if (record?.gameId === game.id) {
      this.active.delete(key);
    }
  }
}

export class RedisGameStore implements GameStore {
  readonly mode = 'redis' as const;

  async getActiveGame(ownerId: string, difficulty: Difficulty): Promise<GameState | null> {
    const client = redis();
    if (!client) throw new Error('REDIS_UNAVAILABLE');
    const existingId = await client.get(activeKey(ownerId, difficulty));
    if (!existingId) return null;
    const game = await this.getGame(ownerId, existingId);
    if (!game) {
      await client.del(activeKey(ownerId, difficulty));
    }
    return game;
  }

  async getGame(ownerId: string, gameId: string): Promise<GameState | null> {
    const client = redis();
    if (!client) throw new Error('REDIS_UNAVAILABLE');
    const raw = await client.get(gameKey(gameId));
    if (!raw) return null;
    const game = JSON.parse(raw) as GameState;
    if (game.ownerId !== ownerId) return null;
    return game;
  }

  async saveGame(game: GameState): Promise<void> {
    const client = redis();
    if (!client) throw new Error('REDIS_UNAVAILABLE');
    const updatedGame = {
      ...game,
      updatedAt: new Date().toISOString(),
    };
    await client.multi()
      .set(gameKey(updatedGame.id), JSON.stringify(updatedGame), { EX: GAME_TTL_SECONDS })
      .set(
        activeKey(updatedGame.ownerId, updatedGame.difficulty),
        updatedGame.id,
        { EX: GAME_TTL_SECONDS }
      )
      .exec();
  }

  async deleteGame(game: GameState): Promise<void> {
    await evalCommandScript(
      'lol-game-delete-v1',
      `if redis.call('get', KEYS[1]) == ARGV[1] then
         return redis.call('del', KEYS[1], KEYS[2])
       end
       return redis.call('del', KEYS[2])`,
      [activeKey(game.ownerId, game.difficulty), gameKey(game.id)],
      [game.id]
    );
  }
}
