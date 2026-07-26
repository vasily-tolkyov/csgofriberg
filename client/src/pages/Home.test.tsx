import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import Home from './Home';
import { renderAtRoute } from '../test/render';

vi.mock('../api/lol', async () => {
  const actual = await vi.importActual<typeof import('../api/lol')>('../api/lol');
  return {
    ...actual,
    fetchMeta: vi.fn(async () => ({
      title: '弗一把',
      subtitle: '英雄联盟版 · 社区衍生项目',
      brandStatus: '品牌素材未获 Riot 或相关赛事官方授权，仅保留社区衍生说明与必要署名。',
      dataVersion: 'test-version',
      lastVerifiedAt: '2026-07-26',
      poolSizes: { easy: 12, normal: 20, total: 20 },
      sourceStatus: { playersWithSources: 20, playersWithoutSources: 0, totalSourceLinks: 40 },
      links: {
        source: 'https://example.com/source',
        upstream: 'https://example.com/upstream',
        license: 'https://example.com/license',
      },
    })),
  };
});

describe('Home page', () => {
  it('keeps the MVP navigation limited to single-player and search plus source links', async () => {
    renderAtRoute(<Home />, { route: '/', path: '/' });

    expect(screen.getByRole('link', { name: /单人模式/ })).toHaveAttribute('href', '/single');
    expect(screen.getByRole('link', { name: /查选手/ })).toHaveAttribute('href', '/search');
    expect(screen.queryByText('多人联机')).not.toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /完整对应源码/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /上游项目署名/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /AGPL-3.0 许可/ })).toBeInTheDocument();
  });
});
