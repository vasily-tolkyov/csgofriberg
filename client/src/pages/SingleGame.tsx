import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RotateCcw, Lightbulb, Target, X, Home } from 'lucide-react';
import Page from '../components/Page';
import GuessBoard from '../components/GuessBoard';
import GuessInputBar from '../components/GuessInputBar';
import AnswerOverlay from '../components/AnswerOverlay';
import { apiErrorCode, errMsg } from '../api/client';
import { GuessRow, PlayerProfile, exitSingleGame, giveUpSingleGame, startSingleGame, submitGuess } from '../api/lol';
import { useConfirm } from '../components/ConfirmDialog';
import { toast } from '../components/Toast';
import { useTranslation } from 'react-i18next';
import { AVAILABLE_DIFFICULTIES } from '../config/difficulties';
import { difficultyIcon, difficultyLabel } from '../utils/difficulty';
import { setStoredSingleDifficulty } from '../store/singleDifficulty';

export default function SingleGame() {
  const { t } = useTranslation();
  const { difficulty = 'easy' } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const isValidDifficulty = AVAILABLE_DIFFICULTIES.some((item) => item.key === difficulty);
  const [gameId, setGameId] = useState<string | null>(null);
  const [maxGuesses, setMaxGuesses] = useState(8);
  const [guesses, setGuesses] = useState<GuessRow[]>([]);
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [answer, setAnswer] = useState<PlayerProfile | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [starting, setStarting] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const gameIdRef = useRef<string | null>(null);
  const boardEndRef = useRef<HTMLDivElement>(null);
  const busy = starting || revealing || leaving;

  useEffect(() => {
    if (!isValidDifficulty) {
      navigate('/single', { replace: true });
      return;
    }
    setStoredSingleDifficulty(difficulty);
  }, [difficulty, isValidDifficulty, navigate]);

  const setCurrentGameId = (id: string | null) => {
    gameIdRef.current = id;
    setGameId(id);
  };

  const hydrateSession = useCallback((session: Awaited<ReturnType<typeof startSingleGame>>) => {
    setCurrentGameId(session.gameId);
    setGuesses(session.guesses);
    setMaxGuesses(session.maxGuesses);
    setStatus('playing');
    setAnswer(null);
    setShowOverlay(false);
    setInputMessage(session.guesses.length ? t('game.resumeHint', { count: session.guesses.length }) : '');
  }, [t]);

  const start = useCallback(async (replace = true) => {
    setStartError(null);
    setStarting(true);
    setInputMessage('');
    try {
      const previous = gameIdRef.current;
      if (replace && previous) {
        setCurrentGameId(null);
        setGuesses([]);
        await exitSingleGame(previous);
      }
      const session = await startSingleGame(difficulty);
      hydrateSession(session);
    } catch (error) {
      setStartError(errMsg(error));
    } finally {
      setStarting(false);
    }
  }, [difficulty, hydrateSession]);

  useEffect(() => {
    if (!isValidDifficulty) return;
    void start(false);
  }, [isValidDifficulty, start]);

  useEffect(() => {
    if (!inputFocused || !window.matchMedia('(max-width: 640px)').matches) return;
    let frame = 0;
    const keepLatestVisible = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        boardEndRef.current?.scrollIntoView({ block: 'end' });
      });
    };
    keepLatestVisible();
    window.visualViewport?.addEventListener('resize', keepLatestVisible);
    return () => {
      window.cancelAnimationFrame(frame);
      window.visualViewport?.removeEventListener('resize', keepLatestVisible);
    };
  }, [guesses.length, inputFocused]);

  if (!isValidDifficulty) return null;

  const leave = async () => {
    if (busy) return;
    const isGameActive = Boolean(gameIdRef.current) && status === 'playing';
    if (isGameActive && !await confirm({
      title: t('game.leaveTitle'),
      message: t('game.leaveMessage'),
      confirmLabel: t('game.leaveConfirm'),
      tone: 'danger',
    })) return;

    const id = gameIdRef.current;
    setLeaving(true);
    setCurrentGameId(null);
    try {
      if (id && isGameActive) await exitSingleGame(id);
    } catch (error) {
      toast.error(errMsg(error));
    }
    navigate('/');
  };

  const restart = async () => {
    if (busy) return;
    const isGameActive = Boolean(gameIdRef.current) && status === 'playing';
    if (isGameActive && !await confirm({
      title: t('game.restartTitle'),
      message: t('game.restartMessage'),
      confirmLabel: t('game.restart'),
      tone: 'danger',
    })) return;
    await start(true);
  };

  const guess = async (playerId: string) => {
    if (!gameId || status !== 'playing' || busy) return false;
    try {
      const result = await submitGuess(gameId, playerId);
      const feedback = result.feedback;
      if (feedback) setGuesses((current) => [...current, feedback]);
      setStatus(result.status);
      setInputMessage('');
      if (result.answer) {
        setAnswer(result.answer);
        setShowOverlay(true);
      }
      return true;
    } catch (error) {
      if (['DUPLICATE_GUESS', 'ALREADY_GUESSED'].includes(apiErrorCode(error) ?? '')) {
        setInputMessage(t('game.duplicateGuess'));
        return false;
      }
      toast.error(errMsg(error));
      return false;
    }
  };

  const reveal = async () => {
    if (!gameId || status !== 'playing' || busy) return;
    if (!await confirm({
      title: t('game.revealTitle'),
      message: t('game.revealMessage'),
      confirmLabel: t('game.reveal'),
      tone: 'danger',
    })) return;

    setRevealing(true);
    try {
      const result = await giveUpSingleGame(gameId);
      setStatus('lost');
      setInputMessage(t('game.giveUpResult'));
      if (result.answer) {
        setAnswer(result.answer);
        setShowOverlay(true);
      }
    } catch (error) {
      toast.error(errMsg(error));
    } finally {
      setRevealing(false);
    }
  };

  const finished = status !== 'playing';
  const difficultyLabelText = difficultyLabel(t, difficulty);
  const DifficultyIcon = difficultyIcon(difficulty);
  const busyStatus = starting
    ? t('game.starting')
    : revealing
      ? t('game.revealing')
      : leaving
        ? t('game.leaving')
        : null;

  return (
    <Page
      className={`game-page single-game-page${inputFocused ? ' keyboard-active' : ''}`}
      title={t('game.singleMode', { difficulty: difficultyLabelText })}
      icon={<DifficultyIcon size={17} />}
      actions={(
        <>
          <button className="btn btn-ghost btn-sm" aria-label={t('game.restart')} onClick={() => void restart()} disabled={busy}>
            <RotateCcw size={15} />
            <span className="btn-text">{starting ? t('game.starting') : t('game.restart')}</span>
          </button>
          <button className="btn btn-ghost btn-sm" aria-label={t('common.home')} onClick={() => void leave()} disabled={busy}>
            <Home size={15} />
            <span className="btn-text">{leaving ? t('game.leaving') : t('common.home')}</span>
          </button>
          <button className="btn btn-warning btn-sm" aria-label={t('game.reveal')} onClick={() => void reveal()} disabled={finished || busy}>
            <Lightbulb size={15} />
            <span className="btn-text">{revealing ? t('game.revealing') : t('game.reveal')}</span>
          </button>
        </>
      )}
      showHome={false}
      statusBar={(
        <>
          <Target size={14} />
          <span
            className="guess-progress"
            role="img"
            aria-label={t('game.guesses', { current: guesses.length, max: maxGuesses })}
            title={t('game.guesses', { current: guesses.length, max: maxGuesses })}
          >
            {Array.from({ length: maxGuesses }, (_, index) => (
              <i key={index} className={index < guesses.length ? 'used' : ''} />
            ))}
          </span>
          <span style={{ color: 'var(--border)' }}>|</span>
          {busyStatus
            ?? (finished
              ? status === 'won'
                ? t('game.congratulations')
                : t('game.ended')
              : t('game.hint'))}
        </>
      )}
      dock={finished ? (
        <div className="input-bar" style={{ justifyContent: 'center' }}>
          <button className="btn" onClick={() => void restart()} disabled={busy}>
            <RotateCcw size={15} />
            {starting ? t('game.starting') : t('game.again')}
          </button>
          <button className="btn btn-danger" onClick={() => void leave()} disabled={busy}>
            <X size={15} />
            {leaving ? t('game.leaving') : t('game.back')}
          </button>
        </div>
      ) : (
        <>
          <div className="guess-progress-dock" aria-hidden="true">
            <span className="guess-progress">
              {Array.from({ length: maxGuesses }, (_, index) => (
                <i key={index} className={index < guesses.length ? 'used' : ''} />
              ))}
            </span>
          </div>
          <GuessInputBar
            onPick={(player) => guess(player.id)}
            onFocusChange={setInputFocused}
            disabled={busy || !gameId}
            statusText={inputMessage}
          />
        </>
      )}
    >
      {guesses.length ? (
        <div className="single-game-board">
          <GuessBoard guesses={guesses} />
          <div ref={boardEndRef} className="guess-board-end" aria-hidden="true" />
        </div>
      ) : startError ? (
        <div className="game-empty">
          <Target size={32} strokeWidth={1.5} />
          <p className="game-empty-title">{t('game.startFailedTitle')}</p>
          <p>{startError}</p>
          <div className="game-empty-actions">
            <button className="btn" onClick={() => void start(false)} disabled={busy}>
              {starting ? t('game.starting') : t('game.startRetry')}
            </button>
            <button className="btn btn-ghost" onClick={() => navigate('/single')} disabled={busy}>
              {t('game.backToLobby')}
            </button>
          </div>
        </div>
      ) : busy ? (
        <div className="game-empty">
          <div className="spinner" />
          <p>{busyStatus}</p>
        </div>
      ) : (
        <div className="game-empty">
          <Target size={32} strokeWidth={1.5} />
          <p>{t('game.startHint')}</p>
          <p className="game-empty-sub">
            {difficulty === 'easy' ? t('game.easyHint') : t('game.normalHint')}
          </p>
          <div className="guess-legend" aria-label={t('rules.feedbackLabel')}>
            <span><i className="legend-correct" />{t('rules.greenTitle')}</span>
            <span><i className="legend-close" />{t('rules.yellowTitle')}</span>
            <span><i className="legend-wrong" />{t('rules.grayTitle')}</span>
            <span><i className="legend-arrow">↑</i>{t('rules.arrowTitle')}</span>
          </div>
        </div>
      )}
      {showOverlay ? (
        <AnswerOverlay
          title={status === 'won' ? t('game.congratulations') : t('game.correctAnswer')}
          answer={answer}
          tone={status === 'won' ? 'win' : 'lose'}
          onClose={busy ? undefined : () => setShowOverlay(false)}
          extra={<p className="muted">{status === 'won' ? t('game.usedGuesses', { count: guesses.length }) : t('game.missed')}</p>}
          actions={(
            <>
              <button className="btn" onClick={() => void restart()} disabled={busy}>
                <RotateCcw size={15} />
                {starting ? t('game.starting') : t('game.again')}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowOverlay(false)} disabled={busy}>
                {t('game.viewGame')}
              </button>
            </>
          )}
        />
      ) : null}
    </Page>
  );
}
