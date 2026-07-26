import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Route } from 'react-router-dom';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SingleGame from './SingleGame';
import { renderAtRoute } from '../test/render';
import { api } from '../api/client';
import { installViewportMocks } from '../test/setup';

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return {
    ...actual,
    api: {
      post: vi.fn(),
      get: vi.fn(),
    },
  };
});

vi.mock('../api/playerList', () => ({
  getPlayerList: vi.fn(async () => [{ id: 'faker', nickname: 'Faker', aliases: ['Hide on bush'] }]),
  searchPlayerList: (list: Array<{ id: string; nickname: string; aliases?: string[] }>, query: string) =>
    list.filter((item) => item.nickname.toLowerCase().includes(query.trim().toLowerCase())),
}));

const post = vi.mocked(api.post);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function renderGame(mode = 'easy') {
  return renderAtRoute(
    <SingleGame />,
    {
      route: `/single/${mode}`,
      path: '/single/:difficulty',
      extraRoutes: (
        <>
          <Route path="/single" element={<div data-testid="lobby" />} />
          <Route path="/" element={<div data-testid="home" />} />
        </>
      ),
    }
  );
}

async function waitForReadyInput() {
  const input = await screen.findByPlaceholderText('输入选手昵称或别名...');
  await waitFor(() => expect(input).not.toBeDisabled());
  return input;
}

describe('SingleGame UX', () => {
  beforeEach(() => {
    post.mockReset();
    localStorage.clear();
    installViewportMocks(false);
  });

  it('redirects invalid difficulty URLs without writing localStorage', async () => {
    renderGame('hard');
    expect(await screen.findByTestId('lobby')).toBeInTheDocument();
    expect(localStorage.getItem('csgofriberg.single-difficulty')).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });

  it('shows starting feedback and keeps dock input disabled while start is pending', async () => {
    const start = deferred<{ data: { restored: boolean; game: { id: string; difficulty: string; status: 'active'; guesses: []; maxGuesses: number } } }>();
    post.mockReturnValueOnce(start.promise as never);

    renderGame('easy');

    expect(await screen.findByText('正在开始新对局…', { selector: 'p' })).toBeInTheDocument();
    expect(document.querySelector('.spinner')).toBeTruthy();
    expect(screen.getByPlaceholderText('输入选手昵称或别名...')).toBeDisabled();
    expect(document.querySelector('.guess-input-feedback')).toBeNull();

    start.resolve({ data: { restored: false, game: { id: 'g1', difficulty: 'easy', status: 'active', guesses: [], maxGuesses: 8 } } });
    await waitForReadyInput();
    expect(screen.getByText('在下方输入选手昵称或别名开始猜测')).toBeInTheDocument();
    expect(localStorage.getItem('csgofriberg.single-difficulty')).toBe('easy');
  });

  it('shows start failure recovery actions when network fails', async () => {
    post.mockRejectedValueOnce(new Error('offline'));

    renderGame('easy');

    expect(await screen.findByText('开局失败')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回难度选择' })).toBeInTheDocument();
  });

  it('disables dock and shows starting copy while restart is in flight', async () => {
    post.mockResolvedValueOnce({ data: { restored: false, game: { id: 'g1', difficulty: 'easy', status: 'active', guesses: [], maxGuesses: 8 } } } as never);
    renderGame('easy');
    await waitForReadyInput();

    const restart = deferred<unknown>();
    post
      .mockReturnValueOnce(restart.promise as never)
      .mockReturnValueOnce(restart.promise as never);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '重新开始' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: '重新开始' }));

    expect(await screen.findByText('正在开始新对局…', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('输入选手昵称或别名...')).toBeDisabled();
    expect(screen.getByRole('button', { name: '重新开始' })).toBeDisabled();
  });

  it('marks page keyboard-active on focus for mobile chrome collapse CSS', async () => {
    installViewportMocks(true);
    post.mockResolvedValueOnce({ data: { restored: false, game: { id: 'g1', difficulty: 'easy', status: 'active', guesses: [], maxGuesses: 8 } } } as never);
    renderGame('easy');

    const input = await waitForReadyInput();
    await userEvent.click(input);
    expect(document.querySelector('.single-game-page')).toHaveClass('keyboard-active');
    expect(window.matchMedia('(max-width: 640px)').matches).toBe(true);
  });

  it('shows reveal busy state on the action button and top status bar', async () => {
    post.mockResolvedValueOnce({ data: { restored: false, game: { id: 'g1', difficulty: 'easy', status: 'active', guesses: [], maxGuesses: 8 } } } as never);
    renderGame('easy');
    await waitForReadyInput();

    const giveup = deferred<{ data: { status: 'gave_up'; answer: { id: string; nickname: string; teamIdentity: string; nationalityRegion: string; role: string; msiTitles: number; msiAppearances: number; worldsTitles: number; worldsAppearances: number; aliases: string[] } } }>();
    post.mockReturnValueOnce(giveup.promise as never);

    const user = userEvent.setup();
    const revealButton = screen.getByRole('button', { name: '查看答案' });
    await user.click(revealButton);
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: '查看答案' }));

    await waitFor(() => {
      expect(revealButton).toBeDisabled();
      expect(revealButton).toHaveTextContent('正在结算答案');
    });
    expect(document.querySelector('.status-bar')).toHaveTextContent('正在结算答案');
    expect(screen.getByPlaceholderText('输入选手昵称或别名...')).toBeDisabled();

    giveup.resolve({
      data: {
        status: 'gave_up',
        answer: {
          id: 'faker',
          nickname: 'Faker',
          teamIdentity: 'T1',
          nationalityRegion: '韩国',
          role: '中单',
          msiTitles: 2,
          msiAppearances: 7,
          worldsTitles: 4,
          worldsAppearances: 9,
          aliases: ['Hide on bush'],
        },
      },
    });
    expect(await screen.findByRole('dialog')).toHaveTextContent('Faker');
  });

  it('shows leaving busy state before navigating home', async () => {
    post.mockResolvedValueOnce({ data: { restored: false, game: { id: 'g1', difficulty: 'easy', status: 'active', guesses: [], maxGuesses: 8 } } } as never);
    renderGame('easy');
    await waitForReadyInput();

    const exit = deferred<unknown>();
    post.mockReturnValueOnce(exit.promise as never);

    const user = userEvent.setup();
    const homeButton = screen.getByRole('button', { name: '主菜单' });
    await user.click(homeButton);
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: '返回主菜单' }));

    await waitFor(() => {
      expect(homeButton).toBeDisabled();
      expect(homeButton).toHaveTextContent('退出中');
    });
    expect(document.querySelector('.status-bar')).toHaveTextContent('退出中');

    exit.resolve({});
    expect(await screen.findByTestId('home')).toBeInTheDocument();
  });

  it('shows an inline duplicate-guess message when backend rejects the pick', async () => {
    post
      .mockResolvedValueOnce({ data: { restored: false, game: { id: 'g1', difficulty: 'easy', status: 'active', guesses: [], maxGuesses: 8 } } } as never)
      .mockRejectedValueOnce({ response: { data: { code: 'ALREADY_GUESSED' } } } as never);

    renderGame('easy');
    const user = userEvent.setup();
    const input = await waitForReadyInput();
    await user.type(input, 'Fak');
    await screen.findByText('Faker');
    await user.click(screen.getByRole('button', { name: '提交猜测' }));

    expect(await screen.findByRole('status')).toHaveTextContent('这名选手已经猜过了，请换一个。');
  });
});
