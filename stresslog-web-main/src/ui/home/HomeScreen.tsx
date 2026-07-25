import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { recordManualMoment } from '../../data/stressRepository';
import { analyze } from '../../domain/contextAnalyzer';
import { levelOf, LEVEL_COLOR, type StressLevel } from '../../domain/stressLevel';
import { suggest } from '../../domain/suggestionEngine';
import { QUICK_TAGS } from '../../strings';
import { hourFractionOf, startOfDay } from '../../util/dates';
import { DotTimeline } from '../common/DotTimeline';
import { StressGauge } from '../common/StressGauge';

const STATE_MESSAGE: Record<StressLevel, string> = {
  LOW: '落ち着いています',
  MID: 'やや落ち着いています',
  HIGH: 'ストレスが高まっています',
};

export function HomeScreen() {
  const [showDialog, setShowDialog] = useState(false);

  const latest = useLiveQuery(() => db.stressReadings.orderBy('timestamp').last(), []);
  const moments = useLiveQuery(
    () => db.stressMoments.orderBy('timestamp').reverse().toArray(),
    [],
  );

  const score = latest?.stressScore ?? null;
  const level = levelOf(score ?? 0);
  const todayStart = startOfDay(Date.now());
  const todayMoments = (moments ?? []).filter((m) => m.timestamp >= todayStart);
  const latestInsight = moments ? analyze(moments)[0]?.message ?? null : null;

  const saveMoment = (note: string, tags: string[]) => {
    void recordManualMoment(score ?? 50, note.trim() === '' ? null : note, tags, null);
    setShowDialog(false);
  };

  return (
    <div className="screen home">
      <div className="card center-col gauge-card">
        <div className="card-title self-start">現在のストレスレベル</div>
        {score !== null && latest ? (
          <>
            <StressGauge score={score} />
            <div className="state-message" style={{ color: LEVEL_COLOR[level] }}>
              {STATE_MESSAGE[level]}
            </div>
            <div className="muted center-text">{suggest(score, latest.timestamp)}</div>
          </>
        ) : (
          <div className="loading-text">データを取得中です…（学習中）</div>
        )}
      </div>

      <div className="card">
        <div className="card-title">今日の記録</div>
        <div className="muted">{todayMoments.length}回のストレス反応を検知</div>
        <div style={{ height: 8 }} />
        <DotTimeline
          dots={todayMoments.map((m) => ({
            hourFraction: hourFractionOf(m.timestamp),
            level: levelOf(m.stressScore),
          }))}
        />
      </div>

      {latestInsight && (
        <div className="card card-secondary">
          <div className="insight-row">
            <span className="insight-icon">🤖</span>
            <div>
              <div className="card-title">直近のアドバイス</div>
              <div style={{ height: 4 }} />
              <div>{latestInsight}</div>
            </div>
          </div>
        </div>
      )}

      <button className="fab" onClick={() => setShowDialog(true)} aria-label="今ストレスを感じた">
        ＋
      </button>

      {showDialog && (
        <ManualMomentDialog onDismiss={() => setShowDialog(false)} onSave={saveMoment} />
      )}
    </div>
  );
}

function ManualMomentDialog({
  onDismiss,
  onSave,
}: {
  onDismiss: () => void;
  onSave: (note: string, tags: string[]) => void;
}) {
  const [note, setNote] = useState('');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  return (
    <div className="dialog-backdrop" onClick={onDismiss}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-title">ストレスの瞬間を記録</div>
        <input
          className="text-field"
          type="text"
          placeholder="何があったか（任意）"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="chip-row">
          {QUICK_TAGS.map((tag) => (
            <button
              key={tag}
              className={`chip${selectedTags.has(tag) ? ' selected' : ''}`}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
        <div className="dialog-actions">
          <button className="btn outlined" onClick={onDismiss}>
            キャンセル
          </button>
          <button className="btn" onClick={() => onSave(note, [...selectedTags])}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
