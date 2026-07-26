import { describe, expect, it, beforeEach } from 'vitest';
import { Route } from 'react-router-dom';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SingleLobby from './SingleLobby';
import { renderAtRoute } from '../test/render';

describe('SingleLobby', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to recommended easy with distinct card copy', () => {
    renderAtRoute(<SingleLobby />, { route: '/single', path: '/single' });

    const easy = screen.getByRole('button', { name: /简单版/ });
    const normal = screen.getByRole('button', { name: /完整版/ });

    expect(easy).toHaveClass('active');
    expect(easy.querySelector('.single-difficulty-badge')).toHaveTextContent('推荐');
    expect(normal.querySelector('.single-difficulty-badge')).toBeNull();
    expect(easy).toHaveTextContent('知名选手 · 当前 12 人样板池');
    expect(normal).toHaveTextContent('完整选手 · 当前 20 人样板池');
    expect(easy.style.getPropertyValue('--diff-color')).toBe('var(--success)');
    expect(normal.style.getPropertyValue('--diff-color')).toBe('var(--accent)');
    expect(screen.getByText('当前样板包含 12 名知名选手和 20 名完整选手；正式题库目标为 80 / 220。你的选择会保存在本地浏览器中。')).toBeInTheDocument();
  });

  it('starts the selected difficulty and remembers the choice', async () => {
    const user = userEvent.setup();
    renderAtRoute(
      <SingleLobby />,
      {
        route: '/single',
        path: '/single',
        extraRoutes: (
          <Route path="/single/:difficulty" element={<div data-testid="game-route" />} />
        ),
      }
    );

    await user.click(screen.getByRole('button', { name: /完整版/ }));
    expect(screen.getByRole('button', { name: /完整版/ })).toHaveClass('active');
    await user.click(screen.getByRole('button', { name: /开始游戏/ }));

    expect(await screen.findByTestId('game-route')).toBeInTheDocument();
    expect(localStorage.getItem('csgofriberg.single-difficulty')).toBe('normal');
  });

  it('mobile start button remains a full-width primary action class', () => {
    renderAtRoute(<SingleLobby />, { route: '/single', path: '/single' });
    const start = screen.getByRole('button', { name: /开始游戏/ });
    expect(start).toHaveClass('btn', 'btn-lg', 'btn-green');
  });
});
