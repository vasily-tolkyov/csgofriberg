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
      nationalityRegion: { value: '韩国', level: 'correct' },
      age: { value: 29, level: 'close', hint: 'lower' },
      role: { value: '中单', level: 'correct' },
      msiTitles: { value: 2, level: 'close', hint: 'higher' },
      msiAppearances: { value: 7, level: 'wrong' },
      worldsTitles: { value: 4, level: 'correct' },
      worldsAppearances: { value: 9, level: 'close', hint: 'higher' },
    },
  },
];

describe('GuessBoard', () => {
  it('renders the 9-field desktop table with text feedback labels', () => {
    renderWithProviders(<GuessBoard guesses={guesses} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '昵称' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'MSI冠军' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'S赛参赛' })).toBeInTheDocument();
    expect(screen.getAllByText('完全正确').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('年龄：29，接近答案，目标更低')).toBeInTheDocument();
  });

  it('renders mobile card content with labeled fields for accessibility', () => {
    renderWithProviders(<GuessBoard guesses={guesses} />);

    const mobileBoard = screen.getByLabelText('移动端猜测记录');
    expect(mobileBoard).toBeInTheDocument();
    expect(within(mobileBoard).getByText('队伍/身份')).toBeInTheDocument();
    expect(within(mobileBoard).getByText('继续缩小范围')).toBeInTheDocument();
  });
});
