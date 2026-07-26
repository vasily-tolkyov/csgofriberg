import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GuessInputBar from './GuessInputBar';
import { renderWithProviders } from '../test/render';

const players = [
  { id: 'faker', nickname: 'Faker', aliases: ['Hide on bush'] },
  { id: 'ruler', nickname: 'Ruler', aliases: [] },
];

vi.mock('../api/playerList', () => ({
  getPlayerList: vi.fn(async () => players),
  searchPlayerList: (list: typeof players, query: string) =>
    list.filter((item) =>
      item.nickname.toLowerCase().includes(query.trim().toLowerCase()) ||
      item.aliases.some((alias) => alias.toLowerCase().includes(query.trim().toLowerCase()))
    ),
}));

describe('GuessInputBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows submitting on the button only, never a secondary status line', async () => {
    const user = userEvent.setup();
    let resolvePick: ((value: void) => void) | undefined;
    const onPick = vi.fn(() => new Promise<void>((resolve) => {
      resolvePick = resolve;
    }));

    renderWithProviders(<GuessInputBar onPick={onPick} />);

    await user.type(screen.getByPlaceholderText('输入选手昵称或别名...'), 'fake');
    await screen.findByText('Faker');
    await user.click(screen.getByRole('button', { name: '提交猜测' }));

    expect(await screen.findByRole('button', { name: '提交中...' })).toBeDisabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText('正在提交...')).not.toBeInTheDocument();

    resolvePick?.();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '提交猜测' })).toBeInTheDocument();
    });
  });

  it('keeps input text when onPick rejects the guess (network/busy guard)', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn(async () => false);
    renderWithProviders(<GuessInputBar onPick={onPick} />);

    const input = screen.getByPlaceholderText('输入选手昵称或别名...');
    await user.type(input, 'fake');
    await screen.findByText('Faker');
    await user.click(screen.getByRole('button', { name: '提交猜测' }));

    await waitFor(() => expect(onPick).toHaveBeenCalled());
    expect(input).toHaveValue('fake');
  });

  it('disables input while parent marks the dock busy (desktop and mobile)', () => {
    renderWithProviders(<GuessInputBar onPick={vi.fn()} disabled />);
    expect(screen.getByPlaceholderText('输入选手昵称或别名...')).toBeDisabled();
    expect(screen.getByRole('button', { name: '提交猜测' })).toBeDisabled();
  });

  it('renders external status only when explicitly provided (e.g. multi cooldown)', () => {
    renderWithProviders(<GuessInputBar onPick={vi.fn()} statusText="这名选手已经猜过了，请换一个。" />);
    expect(screen.getByRole('status')).toHaveTextContent('这名选手已经猜过了，请换一个。');
  });

  it('matches aliases in the suggestion list and renders alias text', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GuessInputBar onPick={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('输入选手昵称或别名...'), 'hide');
    expect(await screen.findByText('Faker')).toBeInTheDocument();
    expect(screen.getByText('Hide on bush')).toBeInTheDocument();
  });

  it('submits the highlighted suggestion with Enter', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn(async () => true);
    renderWithProviders(<GuessInputBar onPick={onPick} />);

    const input = screen.getByPlaceholderText('输入选手昵称或别名...');
    await user.type(input, 'fake');
    await screen.findByRole('option', { name: /Faker/ });
    await user.keyboard('{Enter}');

    await waitFor(() => expect(onPick).toHaveBeenCalledWith(players[0]));
  });
});
