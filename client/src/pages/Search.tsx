import { useState } from 'react';
import { Search as SearchIcon, CircleDot } from 'lucide-react';
import Page from '../components/Page';
import GuessInputBar from '../components/GuessInputBar';
import { PlayerInfoTable } from '../components/AnswerOverlay';
import { searchPlayers, type PlayerProfile } from '../api/lol';
import { apiErrorCode, errMsg } from '../api/client';
import { toast } from '../components/Toast';
import { useTranslation } from 'react-i18next';

export default function Search() {
  const { t } = useTranslation();
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [statusText, setStatusText] = useState('');

  const lookup = async (nickname: string) => {
    try {
      const results = await searchPlayers(nickname);
      const exact =
        results.find((item) => item.nickname.toLocaleLowerCase() === nickname.toLocaleLowerCase()) ??
        results[0] ??
        null;
      setPlayer(exact);
      setStatusText(exact ? t('search.loaded', { name: exact.nickname }) : t('search.emptyResult'));
      return true;
    } catch (error) {
      setStatusText('');
      if (apiErrorCode(error) === 'PLAYER_NOT_FOUND') {
        setPlayer(null);
        return false;
      }
      toast.error(errMsg(error));
      return false;
    }
  };

  return (
    <Page
      title={t('search.title')}
      icon={<SearchIcon size={17} />}
      dock={(
        <GuessInputBar
          onPick={(suggestion) => lookup(suggestion.nickname)}
          placeholder={t('search.placeholder')}
          buttonText={t('search.button')}
          statusText={statusText}
        />
      )}
    >
      <div className="player-search-content">
        {player ? (
          <div className="card search-result-card">
            <h3>
              <CircleDot size={15} color={player.active ? '#5f9d62' : '#9aa3b2'} />
              {player.nickname}
              <span className="muted search-result-subtitle">
                {player.teamIdentity}
                {player.age != null ? ` · ${t('search.age', { age: player.age })}` : ''}
              </span>
            </h3>
            <PlayerInfoTable answer={player} />
          </div>
        ) : (
          <div className="search-empty-state">
            <SearchIcon size={32} strokeWidth={1.5} />
            <p>{t('search.empty')}</p>
            <p>{t('search.fuzzy')}</p>
          </div>
        )}
      </div>
    </Page>
  );
}
