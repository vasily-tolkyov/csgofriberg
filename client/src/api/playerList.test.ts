import { describe, expect, it } from 'vitest';
import { searchPlayerList } from './playerList';
import type { PlayerSuggestion } from './lol';

const players: PlayerSuggestion[] = [
  { id: 'faker', nickname: 'Faker', aliases: ['Hide on bush', '李相赫'] },
  { id: 'showmaker', nickname: 'ShowMaker', aliases: [] },
  { id: 'jackeylove', nickname: 'JackeyLove', aliases: ['JKL', '喻文波'] },
];

describe('searchPlayerList', () => {
  it('matches aliases and keeps alias hits in the candidate list', () => {
    expect(searchPlayerList(players, 'hide')).toEqual([players[0]]);
    expect(searchPlayerList(players, 'jkl')).toEqual([players[2]]);
    expect(searchPlayerList(players, '李相赫')).toEqual([players[0]]);
    expect(searchPlayerList(players, '喻文波')).toEqual([players[2]]);
  });

  it('matches compact fuzzy input against nickname formatting', () => {
    expect(searchPlayerList(players, 'show maker')).toEqual([players[1]]);
    expect(searchPlayerList(players, 'jackey love')).toEqual([players[2]]);
  });

  it('supports subsequence-style fuzzy input for well-known aliases', () => {
    expect(searchPlayerList(players, 'hdb')).toEqual([players[0]]);
    expect(searchPlayerList(players, 'fakr')).toEqual([players[0]]);
  });

  it('does not treat unrelated Chinese input as an empty compact exact match', () => {
    expect(searchPlayerList(players, '田野')).toEqual([]);
  });
});
