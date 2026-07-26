import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Search from './Search';
import { renderAtRoute } from '../test/render';

vi.mock('../api/lol', async () => {
  const actual = await vi.importActual<typeof import('../api/lol')>('../api/lol');
  return {
    ...actual,
    searchPlayers: vi.fn(async () => [
      {
        id: 'faker',
        nickname: 'Faker',
        aliases: ['Hide on bush'],
        teamIdentity: 'T1',
        nationalityRegion: '韩国',
        age: 29,
        role: '中单',
        msiTitles: 2,
        msiAppearances: 7,
        worldsTitles: 4,
        worldsAppearances: 9,
        active: true,
      },
    ]),
  };
});

vi.mock('../api/playerList', () => ({
  getPlayerList: vi.fn(async () => [{ id: 'faker', nickname: 'Faker', aliases: ['Hide on bush'] }]),
  searchPlayerList: (list: Array<{ id: string; nickname: string; aliases: string[] }>, query: string) =>
    list.filter((item) =>
      item.nickname.toLowerCase().includes(query.toLowerCase()) ||
      item.aliases.some((alias) => alias.toLowerCase().includes(query.toLowerCase()))
    ),
}));

describe('Search page', () => {
  it('loads a player profile when an alias is selected from the list', async () => {
    renderAtRoute(<Search />, { route: '/search', path: '/search' });
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('输入选手昵称或别名（支持模糊搜索）...'), 'hide');
    expect(await screen.findByText('Faker')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '查询' }));

    expect(await screen.findByText('历史别名')).toBeInTheDocument();
    expect(screen.getByText('Hide on bush')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('已加载 Faker 的资料');
  });
});
