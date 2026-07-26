import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  FilePlayerCatalogProvider,
  getIdentityValue,
  resolvePlayerGuess,
  searchPlayers,
  serializePlayer,
} from './catalog';
import { buildGuessFeedback } from './gameService';

const tempDirs: string[] = [];

async function createFixtureProvider() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lol-backend-catalog-'));
  tempDirs.push(dir);
  const players = [
    {
      id: 'faker',
      nickname: 'Faker',
      aliases: ['Hide on bush', '大飞老师'],
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
      role: 'coach',
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
  ];
  const easyPlayers = [{ nickname: 'Faker' }, { nickname: 'Caps' }];
  await fs.writeFile(path.join(dir, 'players.json'), JSON.stringify(players, null, 2));
  await fs.writeFile(path.join(dir, 'easy-players.json'), JSON.stringify(easyPlayers, null, 2));
  return new FilePlayerCatalogProvider({
    playersPath: path.join(dir, 'players.json'),
    easyPlayersPath: path.join(dir, 'easy-players.json'),
    now: () => new Date('2026-07-26T00:00:00.000Z'),
  });
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('catalog compatibility and feedback', () => {
  it('resolves aliases and exposes the five identity outputs', async () => {
    const provider = await createFixtureProvider();
    const catalog = await provider.getCatalog();

    expect(resolvePlayerGuess(catalog, { nickname: 'hide on bush' })?.id).toBe('faker');
    expect(resolvePlayerGuess(catalog, { nickname: 'hide-on-bush' })?.id).toBe('faker');
    expect(resolvePlayerGuess(catalog, { nickname: '大飞老师' })?.id).toBe('faker');
    expect(catalog.byId.get('kkoma')?.role).toBe('coach');
    expect(getIdentityValue('active', 'T1')).toBe('T1');
    expect(getIdentityValue('retired', '')).toBe('退役');
    expect(getIdentityValue('coach', 'T1')).toBe('教练');
    expect(getIdentityValue('free_agent', '')).toBe('自由人');
    expect(getIdentityValue('demoted', '')).toBe('已下放');
  });

  it('ranks partial, punctuation-insensitive, and typo-tolerant nickname or alias searches', async () => {
    const provider = await createFixtureProvider();
    const catalog = await provider.getCatalog();

    expect(searchPlayers(catalog, 'fakr')[0]?.id).toBe('faker');
    expect(searchPlayers(catalog, 'hide-bush')[0]?.id).toBe('faker');
    expect(searchPlayers(catalog, '大飞')[0]?.id).toBe('faker');
    expect(searchPlayers(catalog, 'babyfakr')[0]?.id).toBe('caps');
    expect(searchPlayers(catalog, '   ')).toEqual([]);
  });

  it('marks same-region nationality as yellow and numeric hints toward the answer', async () => {
    const provider = await createFixtureProvider();
    const catalog = await provider.getCatalog();
    const answer = serializePlayer(catalog.byId.get('faker')!);
    const guess = serializePlayer({
      ...catalog.byId.get('caps')!,
      nationality: 'Taiwan',
      geoRegion: 'LCK',
      ageYears: answer.age + 2,
      msiTitles: answer.msiTitles - 1,
      msiAppearances: answer.msiAppearances + 1,
      worldsTitles: answer.worldsTitles + 3,
      worldsAppearances: answer.worldsAppearances - 1,
    });

    const feedback = buildGuessFeedback(guess, answer);
    expect(feedback.nationality.level).toBe('yellow');
    expect(feedback.age.level).toBe('yellow');
    expect(feedback.age.direction).toBe('down');
    expect(feedback.msiTitles.level).toBe('yellow');
    expect(feedback.msiTitles.direction).toBe('up');
    expect(feedback.msiAppearances.level).toBe('yellow');
    expect(feedback.msiAppearances.direction).toBe('down');
    expect(feedback.worldsTitles.level).toBe('gray');
    expect(feedback.worldsTitles.direction).toBe('down');
    expect(feedback.worldsAppearances.level).toBe('yellow');
    expect(feedback.worldsAppearances.direction).toBe('up');
  });
});
