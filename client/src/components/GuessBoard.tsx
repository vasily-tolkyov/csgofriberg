import { GuessAttribute, GuessColumnKey, GuessRow } from '../api/lol';
import { useTranslation } from 'react-i18next';

const COLUMN_KEYS: GuessColumnKey[] = [
  'teamIdentity',
  'nationalityRegion',
  'age',
  'role',
  'msiTitles',
  'msiAppearances',
  'worldsTitles',
  'worldsAppearances',
];

type Translate = (key: string) => string;

function feedbackText(level: GuessAttribute['level'], t: Translate) {
  if (level === 'correct') return t('guess.feedback.correct');
  if (level === 'close') return t('guess.feedback.close');
  return t('guess.feedback.wrong');
}

function cellValue(attr: GuessAttribute): string {
  if (typeof attr.value === 'boolean') return attr.value ? '是' : '否';
  if (attr.value === undefined || attr.value === null || attr.value === '') return '—';
  return String(attr.value);
}

function hintText(attr: GuessAttribute, t: Translate) {
  if (attr.hint === 'higher') return t('guess.hint.higher');
  if (attr.hint === 'lower') return t('guess.hint.lower');
  return '';
}

function GuessCell({ attr, label }: { attr: GuessAttribute; label: string }) {
  const { t } = useTranslation();
  const toneText = feedbackText(attr.level, t);
  const hint = hintText(attr, t);
  const value = cellValue(attr);

  return (
    <td
      className={attr.level}
      data-label={label}
      aria-label={hint ? `${label}：${value}，${toneText}，${hint}` : `${label}：${value}，${toneText}`}
    >
      <span className="guess-cell-value">{value}</span>
      {attr.hint ? (
        <span className="guess-cell-meta" aria-hidden="true">
          <span className="guess-hint">{attr.hint === 'higher' ? '↑' : '↓'}</span>
        </span>
      ) : null}
    </td>
  );
}

export default function GuessBoard({ guesses }: { guesses: GuessRow[] }) {
  const { t } = useTranslation();
  const columns = [
    t('guess.columns.nickname'),
    t('guess.columns.teamIdentity'),
    t('guess.columns.nationalityRegion'),
    t('guess.columns.age'),
    t('guess.columns.role'),
    t('guess.columns.msiTitles'),
    t('guess.columns.msiAppearances'),
    t('guess.columns.worldsTitles'),
    t('guess.columns.worldsAppearances'),
  ];

  return (
    <>
      <div className="game-table-wrap guess-board-desktop">
        <table className="game-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {guesses.map((guess, index) => (
              <tr
                key={`${guess.playerId}-${index}`}
                className={`${index === guesses.length - 1 ? 'row-latest' : ''} ${guess.correct ? 'row-correct' : ''}`}
              >
                <td
                  className={`name ${guess.correct ? 'correct' : ''}`}
                  data-label={columns[0]}
                  aria-label={`${columns[0]}：${guess.nickname}，${guess.correct ? t('guess.feedback.correct') : t('guess.feedback.wrong')}`}
                >
                  <span className="guess-cell-value">{guess.nickname}</span>
                </td>
                {COLUMN_KEYS.map((key, columnIndex) => (
                  <GuessCell key={`${key}-${columnIndex}`} attr={guess.attributes[key]} label={columns[columnIndex + 1]} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="guess-board-mobile" aria-label={t('guess.mobileBoard')}>
        {guesses.map((guess, index) => (
          <article
            key={`mobile-${guess.playerId}-${index}`}
            className={`guess-mobile-card${guess.correct ? ' guess-mobile-card-correct' : ''}`}
            aria-label={`${guess.nickname} ${guess.correct ? t('guess.feedback.correct') : t('guess.mobileGuess')}`}
          >
            <header className="guess-mobile-header">
              <strong>{guess.nickname}</strong>
              {guess.correct ? <span className="guess-mobile-correct-dot" aria-hidden="true" /> : null}
            </header>
            <dl className="guess-mobile-grid">
              {COLUMN_KEYS.map((key, columnIndex) => {
                const attr = guess.attributes[key];
                const hint = hintText(attr, t);
                const value = cellValue(attr);
                return (
                  <div
                    key={`mobile-${key}-${columnIndex}`}
                    className={`guess-mobile-field ${attr.level}`}
                    aria-label={hint ? `${columns[columnIndex + 1]}：${value}，${feedbackText(attr.level, t)}，${hint}` : `${columns[columnIndex + 1]}：${value}，${feedbackText(attr.level, t)}`}
                  >
                    <dt>{columns[columnIndex + 1]}</dt>
                    <dd>
                      <span>{value}</span>
                      {attr.hint ? (
                        <span className="guess-mobile-meta" aria-hidden="true">
                          <span className="guess-hint">{attr.hint === 'higher' ? '↑' : '↓'}</span>
                        </span>
                      ) : null}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </article>
        ))}
      </div>
    </>
  );
}
