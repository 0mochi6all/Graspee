// アプリ全体で使う日本語ラベル。Android版と文言を一致させる
export const QUICK_TAGS = ['仕事', '会議', '移動', '家庭', '人間関係', '睡眠不足', 'その他'];

export const TAB_LABELS = {
  home: 'ホーム',
  records: '記録',
  analysis: '分析',
  advice: 'アドバイス',
  settings: '設定',
  sensor: 'センサー',
} as const;

export type TabRoute = keyof typeof TAB_LABELS;
