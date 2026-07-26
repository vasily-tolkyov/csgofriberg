import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readCss = (relativePath: string) =>
  readFileSync(resolve(__dirname, relativePath), 'utf8');

describe('desktop/mobile layout contracts', () => {
  it('caps single difficulty cards on wide screens and stacks actions on mobile', () => {
    const home = readCss('./home.css');
    expect(home).toMatch(
      /\.single-difficulty-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(230px,\s*360px\)\)/s
    );
    expect(home).toMatch(/\.single-difficulty-grid\s*\{[^}]*justify-content:\s*center/s);
    expect(home).toMatch(
      /\.single-difficulty-icon\s*\{[^}]*var\(--diff-color,\s*var\(--primary\)\)/s
    );
    expect(home).toMatch(
      /\.single-difficulty-option\.active\s+\.single-difficulty-check\s*\{[^}]*background:\s*var\(--primary\)/s
    );
    expect(home).toMatch(/\.single-difficulty-check\s*\{[^}]*color:\s*#201118/s);

    const responsive = readCss('./responsive.css');
    expect(responsive).toMatch(
      /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*\.single-lobby-action\s*\{[^}]*flex-direction:\s*column/ 
    );
    expect(responsive).toMatch(
      /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*\.single-lobby-action\s+\.btn\s*\{[^}]*width:\s*100%/
    );
  });

  it('hides chrome for the mobile keyboard and swaps the table for labeled cards', () => {
    const responsive = readCss('./responsive.css');
    expect(responsive).toMatch(
      /\.game-page\.keyboard-active\s+\.header-bar,\s*\n?\s*\.game-page\.keyboard-active\s+\.status-bar\s*\{\s*display:\s*none/
    );
    expect(responsive).toMatch(/\.guess-board-desktop\s*\{\s*display:\s*none/);
    expect(responsive).toMatch(
      /\.guess-board-mobile\s*\{[^}]*display:\s*grid[^}]*gap:\s*12px/s
    );
    expect(responsive).toMatch(
      /\.guess-mobile-field\s+dt\s*\{[^}]*font-size:\s*0\.76rem[^}]*font-weight:\s*700/s
    );
  });
});
