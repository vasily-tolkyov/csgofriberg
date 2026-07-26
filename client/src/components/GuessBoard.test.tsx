import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '../test/render';
import GuessBoard from './GuessBoard';
import type { GuessRow } from '../api/lol';

const guesses: GuessRow[] = [
  {
    playerId: 'faker',
    nickname: 'Faker',
    correct: false,
    attributes: {
      teamIdentity: { value: 'T1', level: 'correct' },
      nationalityRegion: { value: '韩国 / 韩国赛区', level: 'correct' },
      age: { value: 29, level: 'close', hint: 'lower' },
      role: { value: '中单', level: 'correct' },
      msiTitles: { value: 2, level: 'close', hint: 'higher' },
      msiAppearances: { value: 7, level: 'wrong' },
      worldsTitles: { value: 6, level: 'correct' },
      worldsAppearances: { value: 10, level: 'close', hint: 'higher' },
    },
  },
];

describe('GuessBoard', () => {
  it('renders the 9-field desktop table without visible feedback copy', () => {
    renderWithProviders(<GuessBoard guesses={guesses} />);

    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '昵称' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'MSI冠军' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'S赛参赛' })).toBeInTheDocument();
    expect(screen.queryByText('完全正确')).not.toBeInTheDocument();
    expect(screen.queryByText('接近答案')).not.toBeInTheDocument();
    expect(screen.queryByText('继续缩小范围')).not.toBeInTheDocument();
    expect(screen.getAllByLabelText('年龄：29，接近答案，目标更低')).toHaveLength(2);
    expect(within(table).getAllByText('↓')).toHaveLength(1);
    expect(within(table).getAllByText('↑')).toHaveLength(2);
  });

  it('renders mobile cards with labels and arrow-only visible hints', () => {
    renderWithProviders(<GuessBoard guesses={guesses} />);

    const mobileBoard = screen.getByLabelText('移动端猜测记录');
    expect(mobileBoard).toBeInTheDocument();
    expect(within(mobileBoard).getByText('队伍/身份')).toBeInTheDocument();
    expect(within(mobileBoard).queryByText('接近答案')).not.toBeInTheDocument();
    expect(within(mobileBoard).getByLabelText('年龄：29，接近答案，目标更低')).toBeInTheDocument();
    expect(within(mobileBoard).getAllByText('↓')).toHaveLength(1);
    expect(within(mobileBoard).getAllByText('↑')).toHaveLength(2);
  });
});
