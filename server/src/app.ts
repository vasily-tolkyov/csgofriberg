import fs from 'fs';
import path from 'path';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { z } from 'zod';
import { config } from './config';
import { closeRedis, initRedis, isRedisAvailable } from './redis';
import { FilePlayerCatalogProvider } from './mvp/catalog';
import { AppError } from './mvp/errors';
import { GameService } from './mvp/gameService';
import { RedisGameStore, MemoryGameStore } from './mvp/gameStore';
import { asyncHandler, errorHandler, validateBody, validateParams, validateQuery } from './mvp/http';
import { anonymousSession } from './mvp/session';
import { DIFFICULTIES, Difficulty } from './mvp/types';

const difficultySchema = z.object({
  difficulty: z.enum(DIFFICULTIES),
});

const gameParamsSchema = z.object({
  id: z.string().uuid(),
});

const guessBodySchema = z.object({
  playerId: z.string().min(1).optional(),
  nickname: z.string().min(1).optional(),
}).refine((value) => Boolean(value.playerId || value.nickname), {
  message: 'playerId or nickname is required',
  path: ['playerId'],
});

const searchQuerySchema = z.object({
  q: z.string().trim().max(64).default(''),
});

interface AppDependencies {
  gameService?: GameService;
  initializeRedis?: boolean;
  clientDistPath?: string;
  serveClientDist?: boolean;
}

function createCorsOriginValidator() {
  return (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    if (!origin) return callback(null, true);
    if (config.corsOrigins.includes(origin)) return callback(null, true);
    return callback(new AppError(403, 'INVALID_ORIGIN'));
  };
}

export async function createApp(dependencies: AppDependencies = {}) {
  const initializeRedis = dependencies.initializeRedis ?? !dependencies.gameService;
  const redisReady = initializeRedis ? await initRedis() : false;
  if (process.env.NODE_ENV === 'production' && initializeRedis && !redisReady) {
    throw new Error('REDIS_REQUIRED_IN_PRODUCTION');
  }

  const gameService = dependencies.gameService ?? new GameService({
    catalogProvider: new FilePlayerCatalogProvider(),
    store: redisReady ? new RedisGameStore() : new MemoryGameStore(),
  });
  const clientDistPath = dependencies.clientDistPath ?? path.resolve(__dirname, '../../client/dist');
  const serveClientDist = dependencies.serveClientDist ?? process.env.NODE_ENV === 'production';

  const app = express();
  app.set('trust proxy', config.trustProxy ? 1 : false);
  app.use(helmet());
  app.use(cors({ origin: createCorsOriginValidator(), credentials: true }));
  app.use(express.json({ limit: '64kb' }));
  app.use('/api', anonymousSession);

  app.get('/api/health', asyncHandler(async (_req, res) => {
    const meta = await gameService.getMeta();
    res.json({
      ok: true,
      storage: gameService.storageMode,
      redis: isRedisAvailable() ? 'up' : 'down',
      dataVersion: meta.dataVersion,
    });
  }));

  app.get('/api/meta', asyncHandler(async (_req, res) => {
    res.json(await gameService.getMeta());
  }));

  app.get('/api/players/list', asyncHandler(async (_req, res) => {
    res.json(await gameService.getPublicPlayerList());
  }));

  app.get(
    '/api/players/search',
    validateQuery(searchQuerySchema),
    asyncHandler(async (req, res) => {
      res.json(await gameService.searchPlayers(req.query.q as string));
    })
  );

  app.post(
    '/api/game/start',
    validateBody(difficultySchema),
    asyncHandler(async (req, res) => {
      const ownerId = req.anonymousId;
      if (!ownerId) throw new AppError(500, 'ANONYMOUS_SESSION_MISSING');
      res.json(await gameService.startGame(ownerId, req.body.difficulty as Difficulty));
    })
  );

  app.post(
    '/api/game/:id/guess',
    validateParams(gameParamsSchema),
    validateBody(guessBodySchema),
    asyncHandler(async (req, res) => {
      const ownerId = req.anonymousId;
      if (!ownerId) throw new AppError(500, 'ANONYMOUS_SESSION_MISSING');
      res.json(await gameService.submitGuess(ownerId, req.params.id, req.body));
    })
  );

  app.post(
    '/api/game/:id/giveup',
    validateParams(gameParamsSchema),
    asyncHandler(async (req, res) => {
      const ownerId = req.anonymousId;
      if (!ownerId) throw new AppError(500, 'ANONYMOUS_SESSION_MISSING');
      res.json(await gameService.giveUp(ownerId, req.params.id));
    })
  );

  app.post(
    '/api/game/:id/exit',
    validateParams(gameParamsSchema),
    asyncHandler(async (req, res) => {
      const ownerId = req.anonymousId;
      if (!ownerId) throw new AppError(500, 'ANONYMOUS_SESSION_MISSING');
      res.json(await gameService.exitGame(ownerId, req.params.id));
    })
  );

  if (serveClientDist && fs.existsSync(path.join(clientDistPath, 'index.html'))) {
    app.use(express.static(clientDistPath, {
      index: false,
      setHeaders(res, servedPath) {
        const isHtml = servedPath.endsWith('.html');
        res.setHeader('Cache-Control', isHtml ? 'no-cache' : 'public, max-age=31536000, immutable');
      },
    }));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  }

  app.use(errorHandler);
  return {
    app,
    close: async () => {
      if (initializeRedis) {
        await closeRedis();
      }
    },
  };
}
