import { useState } from 'react';
import {
  setNotificationsEnabled,
  setSamplingInterval,
  setThreshold,
  useSettings,
} from '../../data/settings';
import {
  notificationPermission,
  requestNotificationPermission,
} from '../../work/notifier';
import { runSamplingTick } from '../../work/samplingLoop';

const INTERVAL_OPTIONS = [15, 30, 60];

export function SettingsScreen() {
  const settings = useSettings();
  const [permission, setPermission] = useState(notificationPermission());
  const [sampling, setSampling] = useState(false);

  const toggleNotifications = async (enabled: boolean) => {
    if (enabled) {
      const granted = await requestNotificationPermission();
      setPermission(notificationPermission());
      setNotificationsEnabled(granted);
    } else {
      setNotificationsEnabled(false);
    }
  };

  const sampleNow = async () => {
    setSampling(true);
    try {
      await runSamplingTick();
    } finally {
      setSampling(false);
    }
  };

  return (
    <div className="screen settings">
      <h2 className="section-title">設定</h2>

      <div className="card">
        <div className="card-title">通知の閾値: {settings.stressThreshold}</div>
        <div className="muted">この値を超えるとストレスアラートが通知されます</div>
        <input
          type="range"
          min={30}
          max={95}
          step={5}
          value={settings.stressThreshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          className="slider"
        />
      </div>

      <div className="card">
        <div className="card-title">サンプリング間隔</div>
        <div style={{ height: 8 }} />
        <div className="chip-row">
          {INTERVAL_OPTIONS.map((minutes) => (
            <button
              key={minutes}
              className={`chip${settings.samplingIntervalMinutes === minutes ? ' selected' : ''}`}
              onClick={() => setSamplingInterval(minutes)}
            >
              {minutes}分
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="row-between">
          <div>
            <div className="card-title">通知</div>
            <div className="muted">閾値を超えたときにブラウザ通知でお知らせします</div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.notificationsEnabled}
              onChange={(e) => void toggleNotifications(e.target.checked)}
            />
            <span className="switch-track" />
          </label>
        </div>
        {settings.notificationsEnabled && permission === 'denied' && (
          <div className="warn-text">
            ブラウザの通知許可がブロックされています。アドレスバーのサイト設定から許可してください。
          </div>
        )}
        {permission === 'unsupported' && (
          <div className="warn-text">このブラウザは通知に対応していません。</div>
        )}
      </div>

      <div className="card">
        <div className="card-title">動作確認</div>
        <div className="muted">今すぐ1回サンプリングして記録します（開発用）</div>
        <div style={{ height: 8 }} />
        <button className="btn outlined" onClick={() => void sampleNow()} disabled={sampling}>
          {sampling ? '取得中…' : '今すぐサンプル'}
        </button>
      </div>

      <p className="muted footnote">
        データ源: モック（開発用）。データはこのブラウザ内（IndexedDB）にのみ保存されます。
        タブを閉じている間はサンプリングが停止します（Webの仕様）。
      </p>
    </div>
  );
}
