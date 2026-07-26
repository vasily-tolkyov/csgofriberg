import fs from 'fs/promises';
import { createServer, Server } from 'http';
import os from 'os';
import path from 'path';
import { AddressInfo } from 'net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { FilePlayerCatalogProvider } from './catalog';
import { GameService } from './gameService';
import { MemoryGameStore } from './gameStore';
import { GAME_TTL_SECONDS } from './types';

class TestClient {
  private cookie: string | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly token?: string
  ) {}

  async request(method: string, pathname: string, body?: unknown) {
    const headers = new Headers();
    if (body !== undefined) {
      headers.set('content-type', 'application/json');
    }
    if (this.cookie) {
      headers.set('cookie', this.cookie);
    }
    if (this.token) {
      headers.set('x-anon-token', this.token);
    }
    const response = await fetch(`${this.baseUrl}${pathname}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      this.cookie = setCookie.split(';', 1)[0];
    }
    const text = await response.text();
    const contentType = response.headers.get('content-type') ?? '';
    return {
      status: response.status,
      headers: response.headers,
      body: contentType.includes('application/json') && text ? JSON.parse(text) : null,
      text,
    };
  }
}

interface FixtureContext {
  close(): Promise<void>;
  writePlayers(players: unknown[]): Promise<void>;
  client: TestClient;
  otherClient: TestClient;
  thirdClient: TestClient;
  advanceMs(ms: number): void;
}

const cleanupDirs: string[] = [];
let server: Server | null = null;

async function createFixtureContext(): Promise<FixtureContext> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lol-backend-app-'));
  cleanupDirs.push(dir);
  const playersPath = path.join(dir, 'players.json');
  const easyPath = path.join(dir, 'easy-players.json');
  const clientDistPath = path.join(dir, 'client-dist');
  const players = [
    {
      id: 'faker',
      nickname: 'Faker',
      aliases: ['Hide on bush'],
      birthDate: '1996-05-07',
      role: 'mid',
      nationality: 'Korea',
      geoRegion: 'LCK',
      status: 'active',
      currentTeam: 'T1',
      msiTitles: 2,
      msiAppearances: 6,
      worldsTitles: 4,
      worldsAppearances: 9,
      difficulties: ['easy', 'normal'],
      sources: ['fixture'],
      verifiedAt: '2026-07-01T00:00:00.000Z',
    },
    {
      id: 'caps',
      nickname: 'Caps',
      aliases: ['Baby Faker'],
      birthDate: '1999-11-17',
      role: 'mid',
      nationality: 'Denmark',
      geoRegion: 'LEC',
      status: 'active',
      currentTeam: 'G2 Esports',
      msiTitles: 1,
      msiAppearances: 3,
      worldsTitles: 0,
      worldsAppearances: 5,
      difficulties: ['easy', 'normal'],
      sources: ['fixture'],
      verifiedAt: '2026-07-01T00:00:00.000Z',
    },
    {
      id: 'ruler',
      nickname: 'Ruler',
      aliases: ['Park Jae-hyuk'],
      birthDate: '1998-12-29',
      role: 'bot',
      nationality: 'Korea',
      geoRegion: 'LPL',
      status: 'active',
      currentTeam: 'Gen.G',
      msiTitles: 1,
      msiAppearances: 4,
      worldsTitles: 1,
      worldsAppearances: 7,
      difficulties: ['easy', 'normal'],
      sources: ['fixture'],
      verifiedAt: '2026-07-01T00:00:00.000Z',
    },
    {
      id: 'canyon',
      nickname: 'Canyon',
      aliases: ['Kim Geon-bu'],
      birthDate: '2001-06-18',
      role: 'jungle',
      nationality: 'Korea',
      geoRegion: 'LCK',
      status: 'active',
      currentTeam: 'Dplus KIA',
      msiTitles: 0,
      msiAppearances: 2,
      worldsTitles: 1,
      worldsAppearances: 4,
      difficulties: ['normal'],
      sources: ['fixture'],
      verifiedAt: '2026-07-01T00:00:00.000Z',
    },
    {
      id: 'bin',
      nickname: 'Bin',
      aliases: ['Chen Ze-Bin'],
      birthDate: '2003-09-28',
      role: 'top',
      nationality: 'China',
      geoRegion: 'LPL',
      status: 'active',
      currentTeam: 'Bilibili Gaming',
      msiTitles: 0,
      msiAppearances: 2,
      worldsTitles: 0,
      worldsAppearances: 3,
      difficulties: ['normal'],
      sources: ['fixture'],
      verifiedAt: '2026-07-01T00:00:00.000Z',
    },
    {
      id: 'mata',
      nickname: 'Mata',
      aliases: ['Cho Se-hyeong'],
      birthDate: '1994-02-14',
      role: 'support',
      nationality: 'Korea',
      geoRegion: 'LCK',
      status: 'retired',
      currentTeam: '',
      msiTitles: 1,
      msiAppearances: 2,
      worldsTitles: 1,
      worldsAppearances: 5,
      difficulties: ['normal'],
      sources: ['fixture'],
      verifiedAt: '2026-07-01T00:00:00.000Z',
    },
    {
      id: 'kkoma',
      nickname: 'kkOma',
      aliases: ['Kim Jeong-gyun'],
      birthDate: '1985-12-23',
      role: 'support',
      nationality: 'Korea',
      geoRegion: 'LCK',
      status: 'coach',
      currentTeam: 'T1',
      msiTitles: 2,
      msiAppearances: 6,
      worldsTitles: 4,
      worldsAppearances: 9,
      difficulties: ['normal'],
      sources: ['fixture'],
      verifiedAt: '2026-07-01T00:00:00.000Z',
    },
    {
      id: 'nuguri',
      nickname: 'Nuguri',
      aliases: ['Jang Ha-gwon'],
      birthDate: '1999-07-21',
      role: 'top',
      nationality: 'Korea',
      geoRegion: 'LCK',
      status: 'free_agent',
      currentTeam: '',
      msiTitles: 0,
      msiAppearances: 1,
      worldsTitles: 1,
      worldsAppearances: 3,
      difficulties: ['normal'],
      sources: ['fixture'],
      verifiedAt: '2026-07-01T00:00:00.000Z',
    },
    {
      id: 'ale',
      nickname: 'Ale',
      aliases: ['Hu Jia-Le'],
      birthDate: '2001-01-28',
      role: 'top',
      nationality: 'China',
      geoRegion: 'LPL',
      status: 'demoted',
      currentTeam: '',
      msiTitles: 0,
      msiAppearances: 0,
      worldsTitles: 0,
      worldsAppearances: 1,
      difficulties: ['normal'],
      sources: ['fixture'],
      verifiedAt: '2026-07-01T00:00:00.000Z',
    },
    {
      id: 'deft',
      nickname: 'Deft',
      aliases: ['Kim Hyuk-kyu'],
      birthDate: '1996-10-23',
      role: 'bot',
      nationality: 'Korea',
      geoRegion: 'LCK',
      status: 'retired',
      currentTeam: '',
      msiTitles: 0,
      msiAppearances: 2,
      worldsTitles: 1,
      worldsAppearances: 7,
      difficulties: ['normal'],
      sources: ['fixture'],
      verifiedAt: '2026-07-01T00:00:00.000Z',
    },
  ];
  const easyPlayers = [{ nickname: 'Faker' }, { nickname: 'Caps' }, { nickname: 'Ruler' }];
  await fs.writeFile(playersPath, JSON.stringify(players, null, 2));
  await fs.writeFile(easyPath, JSON.stringify(easyPlayers, null, 2));
  await fs.mkdir(clientDistPath, { recursive: true });
  await fs.writeFile(
    path.join(clientDistPath, 'index.html'),
    '<!doctype html><html><body><div id="root">lol-client</div></body></html>'
  );

  let nowMs = Date.parse('2026-07-26T00:00:00.000Z');
  const provider = new FilePlayerCatalogProvider({
    playersPath,
    easyPlayersPath: easyPath,
    now: () => new Date(nowMs),
  });
  const gameService = new GameService({
    catalogProvider: provider,
    store: new MemoryGameStore(() => nowMs),
    pickIndex: () => 0,
  });
  const created = await createApp({
    gameService,
    initializeRedis: false,
    clientDistPath,
    serveClientDist: true,
  });
  server = createServer(created.app);
  await new Promise<void>((resolve) => {
    server!.listen(0, resolve);
  });
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    client: new TestClient(baseUrl, 'token-alpha-123456789'),
    otherClient: new TestClient(baseUrl, 'token-beta-123456789'),
    thirdClient: new TestClient(baseUrl, 'token-gamma-123456789'),
    advanceMs(ms: number) {
      nowMs += ms;
    },
    async writePlayers(nextPlayers: unknown[]) {
      await fs.writeFile(playersPath, JSON.stringify(nextPlayers, null, 2));
    },
    async close() {
      if (server) {
        await new Promise<void>((resolve, reject) => {
          server!.close((error) => (error ? reject(error) : resolve()));
        });
        server = null;
      }
      await created.close();
    },
  };
}

let context: FixtureContext;

beforeEach(async () => {
  context = await createFixtureContext();
});

afterEach(async () => {
  await context.close();
  await Promise.all(cleanupDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('MVP API', () => {
  it('returns ranked typo-tolerant candidates for nicknames and aliases', async () => {
    const nicknameSearch = await context.client.request('GET', '/api/players/search?q=fakr');
    expect(nicknameSearch.status).toBe(200);
    expect(nicknameSearch.body.players[0].id).toBe('faker');

    const aliasSearch = await context.client.request('GET', '/api/players/search?q=baby-fakr');
    expect(aliasSearch.status).toBe(200);
    expect(aliasSearch.body.players[0].id).toBe('caps');
    expect(aliasSearch.body.players[0].aliases).toContain('Baby Faker');

    const oversizedSearch = await context.client.request(
      'GET',
      `/api/players/search?q=${'a'.repeat(65)}`
    );
    expect(oversizedSearch.status).toBe(400);
  });

  it('restores an in-progress game for the same anonymous owner and blocks other owners', async () => {
    const started = await context.client.request('POST', '/api/game/start', { difficulty: 'easy' });
    expect(started.status).toBe(200);
    expect(started.body.restored).toBe(false);
    expect(started.body.game.guesses).toHaveLength(0);
    expect(started.body.game.answer).toBeUndefined();

    const guessed = await context.client.request('POST', `/api/game/${started.body.game.id}/guess`, {
      nickname: 'Baby Faker',
    });
    expect(guessed.status).toBe(200);
    expect(guessed.body.status).toBe('active');
    expect(guessed.body.answer).toBeUndefined();

    const resumed = await context.client.request('POST', '/api/game/start', { difficulty: 'easy' });
    expect(resumed.status).toBe(200);
    expect(resumed.body.restored).toBe(true);
    expect(resumed.body.game.id).toBe(started.body.game.id);
    expect(resumed.body.game.guesses).toHaveLength(1);

    const foreignGuess = await context.otherClient.request('POST', `/api/game/${started.body.game.id}/guess`, {
      nickname: 'Ruler',
    });
    expect(foreignGuess.status).toBe(404);
    expect(foreignGuess.body.code).toBe('GAME_NOT_FOUND');
  });

  it('matches aliases, rejects duplicate guesses, and never leaks the answer while active', async () => {
    const started = await context.client.request('POST', '/api/game/start', { difficulty: 'easy' });
    const gameId = started.body.game.id as string;

    const aliasGuess = await context.client.request('POST', `/api/game/${gameId}/guess`, {
      nickname: 'Baby Faker',
    });
    expect(aliasGuess.status).toBe(200);
    expect(aliasGuess.body.feedback.guess.id).toBe('caps');
    expect(aliasGuess.body.answer).toBeUndefined();

    const duplicate = await context.client.request('POST', `/api/game/${gameId}/guess`, {
      playerId: 'caps',
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe('DUPLICATE_GUESS');
  });

  it('reveals the answer only on the eighth miss and keeps earlier miss responses opaque', async () => {
    const started = await context.client.request('POST', '/api/game/start', { difficulty: 'easy' });
    const gameId = started.body.game.id as string;
    const misses = ['caps', 'ruler', 'canyon', 'bin', 'mata', 'kkoma', 'nuguri', 'ale'];

    for (const [index, playerId] of misses.entries()) {
      const response = await context.client.request('POST', `/api/game/${gameId}/guess`, { playerId });
      expect(response.status).toBe(200);
      if (index < misses.length - 1) {
        expect(response.body.status).toBe('active');
        expect(response.body.answer).toBeUndefined();
      } else {
        expect(response.body.status).toBe('lost');
        expect(response.body.answer.nickname).toBe('Faker');
      }
    }
  });

  it('expires inactive games after thirty minutes and abandons on exit without revealing the answer', async () => {
    const started = await context.client.request('POST', '/api/game/start', { difficulty: 'easy' });
    const gameId = started.body.game.id as string;

    context.advanceMs((GAME_TTL_SECONDS + 1) * 1000);
    const expired = await context.client.request('POST', `/api/game/${gameId}/guess`, { playerId: 'caps' });
    expect(expired.status).toBe(404);
    expect(expired.body.code).toBe('GAME_NOT_FOUND');

    const restarted = await context.client.request('POST', '/api/game/start', { difficulty: 'easy' });
    const exitResponse = await context.client.request('POST', `/api/game/${restarted.body.game.id}/exit`);
    expect(exitResponse.status).toBe(200);
    expect(exitResponse.body.status).toBe('abandoned');
    expect(exitResponse.body.answer).toBeUndefined();
  });

  it('invalidates active games when the seed data version changes without leaking the answer', async () => {
    const started = await context.client.request('POST', '/api/game/start', { difficulty: 'easy' });
    const gameId = started.body.game.id as string;

    await context.writePlayers([
      {
        id: 'faker',
        nickname: 'Faker',
        aliases: ['Hide on bush'],
        birthDate: '1996-05-07',
        role: 'mid',
        nationality: 'Korea',
        geoRegion: 'LCK',
        status: 'active',
        currentTeam: 'T1',
        msiTitles: 3,
        msiAppearances: 7,
        worldsTitles: 4,
        worldsAppearances: 10,
        difficulties: ['easy', 'normal'],
        sources: ['fixture'],
        verifiedAt: '2026-07-02T00:00:00.000Z',
      },
    ]);

    const invalidated = await context.client.request('POST', `/api/game/${gameId}/guess`, { playerId: 'caps' });
    expect(invalidated.status).toBe(409);
    expect(invalidated.body.code).toBe('GAME_DATA_CHANGED');
    expect(invalidated.body.answer).toBeUndefined();
  });

  it('reveals the answer on give-up and creates a stable anonymous token for the client', async () => {
    const meta = await context.thirdClient.request('GET', '/api/meta');
    expect(meta.status).toBe(200);
    expect(meta.headers.get('x-anon-token')).toBeTruthy();

    const started = await context.thirdClient.request('POST', '/api/game/start', { difficulty: 'easy' });
    const giveUp = await context.thirdClient.request('POST', `/api/game/${started.body.game.id}/giveup`);
    expect(giveUp.status).toBe(200);
    expect(giveUp.body.status).toBe('gave_up');
    expect(giveUp.body.answer.nickname).toBe('Faker');
  });

  it('serves the built SPA index for non-api routes when client assets exist', async () => {
    const page = await context.client.request('GET', '/play');
    expect(page.status).toBe(200);
    expect(page.text).toContain('lol-client');
    expect(page.headers.get('cache-control')).toBe('no-cache');
  });
});
