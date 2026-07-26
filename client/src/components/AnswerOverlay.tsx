import { ReactNode, useEffect } from 'react';
import { Globe, Calendar, Shield, Trophy, Swords, Users } from 'lucide-react';
import ModalPortal from './ModalPortal';
import { useTranslation } from 'react-i18next';

export interface AnswerInfo {
  id?: string;
  nickname: string;
  aliases?: string[];
  teamIdentity: string;
  nationalityRegion: string;
  age?: number | null;
  role: string;
  msiTitles?: number | null;
  msiAppearances?: number | null;
  worldsTitles?: number | null;
  worldsAppearances?: number | null;
}

function formatValue(value: number | string | null | undefined) {
  return value ?? '-';
}

/** 选手信息表(答案卡片/查询结果共用) */
export function PlayerInfoTable({ answer }: { answer: AnswerInfo }) {
  const { t } = useTranslation();
  const rows: [ReactNode, string, ReactNode][] = [
    [<Shield size={14} key="team" />, t('player.teamIdentity'), answer.teamIdentity || '-'],
    [<Globe size={14} key="region" />, t('player.nationalityRegion'), answer.nationalityRegion],
    [<Calendar size={14} key="age" />, t('player.age'), answer.age ?? '-'],
    [<Swords size={14} key="role" />, t('player.role'), answer.role || '-'],
    [<Trophy size={14} key="msiTitles" />, t('player.msiTitles'), formatValue(answer.msiTitles)],
    [<Users size={14} key="msiApps" />, t('player.msiAppearances'), formatValue(answer.msiAppearances)],
    [<Trophy size={14} key="worldsTitles" />, t('player.worldsTitles'), formatValue(answer.worldsTitles)],
    [<Users size={14} key="worldsApps" />, t('player.worldsAppearances'), formatValue(answer.worldsAppearances)],
  ];
  return (
    <>
      <table className="player-info-table">
        <tbody>
          {rows.map(([icon, label, value]) => (
            <tr key={label}>
              <td className="label">
                {icon}
                {label}
              </td>
              <td className="value">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {answer.aliases?.length ? (
        <div className="player-aliases" aria-label={t('player.aliases')}>
          <strong>{t('player.aliases')}</strong>
          <div className="player-alias-list">
            {answer.aliases.map((alias) => (
              <span key={alias} className="player-alias-chip">
                {alias}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

interface Props {
  title: string;
  answer: AnswerInfo | null;
  extra?: ReactNode;
  actions: ReactNode;
  onClose?: () => void;
  /** 胜负配色:win 绿色调头部,lose 中性 */
  tone?: 'win' | 'lose';
}

/** 结算/答案遮罩卡片 */
export default function AnswerOverlay({ title, answer, extra, actions, onClose, tone }: Props) {
  useEffect(() => {
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <ModalPortal>
      <div
        className="overlay"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose?.();
        }}
      >
        <div
          className={`overlay-card${tone ? ` overlay-card-${tone}` : ''}`}
          role="dialog"
          aria-modal="true"
        >
          <h2>{title}</h2>
          {extra}
          {answer && (
            <>
              <p className="answer-name">{answer.nickname}</p>
              <PlayerInfoTable answer={answer} />
            </>
          )}
          <div className="btns">{actions}</div>
        </div>
      </div>
    </ModalPortal>
  );
}
