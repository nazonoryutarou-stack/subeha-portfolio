const status = document.getElementById('status');

const fmt = (seconds) => {
  if (!Number.isFinite(Number(seconds))) return '';
  const total = Math.max(0, Number(seconds));
  const minutes = Math.floor(total / 60);
  const rest = Math.round(total - minutes * 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
};

window.addEventListener('vrm-studio-source-progress', (event) => {
  if (!status) return;
  const detail = event.detail || {};
  const loaded = Number(detail.loaded || 0);
  const total = Number(detail.total || 0);
  if (detail.phase === 'hash' && total > 0) {
    const percent = Math.max(0, Math.min(100, Math.round(loaded / total * 100)));
    status.textContent = `元音声を確認中（SHA-256） ${percent}%`;
  } else if (detail.phase === 'hash-done') {
    status.textContent = '元音声のSHA-256確認完了。';
  }
});

window.addEventListener('vrm-studio-transcription-progress', (event) => {
  if (!status) return;
  const detail = event.detail || {};
  const count = Number(detail.count || 0);
  const index = Number(detail.index || 0);
  const range = Number.isFinite(Number(detail.startSeconds)) && Number.isFinite(Number(detail.endSeconds))
    ? ` ${fmt(detail.startSeconds)}–${fmt(detail.endSeconds)}`
    : '';

  if (detail.phase === 'prepare') {
    status.textContent = '長尺音声を解析用チャンクへ準備中…';
  } else if (detail.phase === 'encode') {
    status.textContent = `長尺音声をWAV変換中 ${index + 1}/${count}${range}`;
  } else if (detail.phase === 'upload') {
    status.textContent = `字幕＋話者解析中 ${index + 1}/${Math.max(1, count)}${range}`;
  } else if (detail.phase === 'chunk-done') {
    status.textContent = `話者解析完了 ${index}/${count}。次の区間へ…`;
  } else if (detail.phase === 'done') {
    status.textContent = count > 1 ? `全 ${count} チャンクの字幕・話者解析を結合しました。` : '字幕・話者解析を完了しました。';
  }
});

window.addEventListener('vrm-studio-visual-progress', (event) => {
  if (!status) return;
  const detail = event.detail || {};
  const count = Math.max(1, Number(detail.count || 1));
  const index = Number(detail.index || 0);
  if (detail.phase === 'batch') {
    status.textContent = `発話内容を映像分析中 ${index + 1}/${count}`;
  } else if (detail.phase === 'done') {
    status.textContent = count > 1 ? `全 ${count} 区間の映像候補分析を結合しました。` : '映像候補分析を完了しました。';
  }
});
