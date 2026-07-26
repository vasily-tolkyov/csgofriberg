import { type ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Gamepad2, Scale, ExternalLink, Database, Code2, GitFork } from 'lucide-react';
import MenuCard from '../components/MenuCard';
import GameRules from '../components/GameRules';
import ThemeToggle from '../components/ThemeToggle';
import { fetchMeta, type AppMeta } from '../api/lol';
import { useTranslation } from 'react-i18next';

const defaultMeta: AppMeta = {
  title: '弗一把',
  subtitle: '英雄联盟版 · 社区衍生项目',
  brandStatus: '“弗一把”名称沿用尚待原作者许可；公开上线前未获许可时将改用“召一把”。',
  dataVersion: 'local-sample',
  lastVerifiedAt: '2026-07-26',
  poolSizes: { easy: 12, normal: 20, total: 20 },
  sourceStatus: { playersWithSources: 20, playersWithoutSources: 0, totalSourceLinks: 40 },
  links: {
    source: 'https://github.com/vasily-tolkyov/csgofriberg',
    upstream: 'https://github.com/shnlfriberg/csgofriberg',
    license: 'https://www.gnu.org/licenses/agpl-3.0.html',
  },
};

export default function Home() {
  const { t } = useTranslation();
  const [meta, setMeta] = useState<AppMeta>(defaultMeta);

  useEffect(() => {
    document.title = `${t('common.brand')} - ${t('home.subtitle')}`;
    void fetchMeta().then(setMeta).catch(() => undefined);
  }, [t]);

  return (
    <div className="page home-page">
      <a className="skip-link" href="#main-content">
        {t('common.skipToContent')}
      </a>
      <div className="header-bar">
        <span className="title">{t('common.brand')}</span>
        <span className="btns">
          <ThemeToggle />
        </span>
      </div>
      <main className="page-scroll" id="main-content">
        <div className="home-hero">
          <span className="hero-kicker">LEAGUE OF LEGENDS // COMMUNITY EDITION</span>
          <h1>{meta.title}</h1>
          <p className="hero-subtitle">{meta.subtitle}</p>
          <GameRules />
          <p className="muted home-brand-status">{meta.brandStatus}</p>
        </div>

        <div className="menu-grid menu-grid-dual">
          <MenuCard
            to="/single"
            icon={<Gamepad2 size={22} />}
            label={t('home.singleMode')}
            description={t('home.singleModeDescription')}
            color="#74e38f"
          />
          <MenuCard
            to="/search"
            icon={<Search size={22} />}
            label={t('home.search')}
            description={t('home.searchDescription')}
            color="#65a8ff"
          />
        </div>

        <section className="home-meta-grid" aria-label={t('home.projectInfo')}>
          <article className="card home-meta-card">
            <h3>
              <Scale size={16} />
              {t('home.projectInfo')}
            </h3>
            <p>{t('home.projectSummary')}</p>
            <p className="muted">{t('home.projectDisclaimer')}</p>
            <p className="muted home-riot-disclaimer" lang="en">
              {t('home.riotDisclaimer')}
            </p>
          </article>

          <article className="card home-meta-card">
            <h3>
              <Database size={16} />
              {t('home.dataSources')}
            </h3>
            <p>{t('home.dataSourcesSummary')}</p>
            <p className="muted">
              {t('home.dataStatus', {
                easy: meta.poolSizes.easy,
                normal: meta.poolSizes.normal,
                verified: meta.lastVerifiedAt ?? t('home.notVerified'),
                sourced: meta.sourceStatus.playersWithSources,
                total: meta.poolSizes.total,
              })}
            </p>
            <div className="home-link-list">
              <LinkItem
                href="https://competitiveops.riotgames.com/en-US/league-of-legends"
                label={t('home.riotGcd')}
                icon={<ExternalLink size={16} />}
              />
              <LinkItem
                href="https://lol.fandom.com/wiki/Leaguepedia:Copyrights"
                label={t('home.leaguepedia')}
                icon={<ExternalLink size={16} />}
              />
              <LinkItem
                href="https://lol.timsevenhuysen.com/matchdata/"
                label={t('home.oraclesElixir')}
                icon={<ExternalLink size={16} />}
              />
            </div>
          </article>

          <article className="card home-meta-card">
            <h3>
              <ExternalLink size={16} />
              {t('home.links')}
            </h3>
            <div className="home-link-list">
              <LinkItem href={meta.links.source} label={t('home.sourceCode')} icon={<Code2 size={16} />} />
              <LinkItem href={meta.links.upstream} label={t('home.upstreamAttribution')} icon={<GitFork size={16} />} />
              <LinkItem href={meta.links.license} label={t('home.agplLicense')} icon={<Scale size={16} />} />
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}

function LinkItem({ href, label, icon }: { href: string; label: string; icon: ReactNode }) {
  return (
    <a
      href={href}
      className="btn btn-ghost home-link-item"
      target="_blank"
      rel="noopener noreferrer"
    >
      {icon}
      <span>{label}</span>
    </a>
  );
}
