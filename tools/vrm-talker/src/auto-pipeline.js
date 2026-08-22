import {getProject, isSourceVerificationPending} from './app/project-state.js';

const panel = document.getElementById('panel');
const audioInput = document.getElementById('audioFile');
const status = document.getElementById('status');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const setStatus = (message) => { if (status) status.textContent = message; };

const waitFor = async (predicate, {timeoutMs = 120000, intervalMs = 150} = {}) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = predicate();
    if (value) return value;
    await sleep(intervalMs);
  }
  throw new Error('処理待機がタイムアウトしました。');
};

if (panel && audioInput) {
  const section = document.createElement('section');
  section.className = 'studio-tools';
  section.innerHTML = `
    <h2>AUTO PIPELINE / FREE LOCAL</h2>
    <label class="check"><input id="autoAnalyze" type="checkbox" checked> 音声選択後に字幕＋話者解析まで自動実行</label>
    <label class="check"><input id="autoVisual" type="checkbox" checked> 解析後に画像挿入候補までローカル選定</label>
    <div class="small">解析は端末内で実行し、音声・字幕を有料AI APIへ送りません。初回だけWhisper等のモデルをダウンロードします。Androidでは安定性優先でWASMを使います。</div>
  `;
  panel.insertBefore(section, panel.firstChild);

  const autoAnalyze = document.getElementById('autoAnalyze');
  const autoVisual = document.getElementById('autoVisual');
  let runId = 0;

  audioInput.addEventListener('change', async () => {
    const file = audioInput.files?.[0];
    if (!file) return;
    const ownRun = ++runId;
    const restoringProject = isSourceVerificationPending();

    try {
      setStatus(restoringProject ? '保存済みproject.jsonと元音声を照合中…' : '音声をプロジェクトへ登録中…');
      await waitFor(
        () => !isSourceVerificationPending() && getProject().source.sha256 && getProject().source.name === file.name,
        {timeoutMs: 180000},
      );
      if (ownRun !== runId) return;

      if (restoringProject) {
        const project = getProject();
        setStatus(`プロジェクト復元完了：字幕 ${project.captions.length} / 画像 ${project.visualReferences.length} / 本人 ${project.avatar.speaker || '未指定'}`);
        return;
      }

      if (!autoAnalyze?.checked) return;
      const analyze = await waitFor(() => document.getElementById('studioAnalyze'));
      setStatus('自動パイプライン: 完全無料のローカル字幕＋話者解析を開始します。初回はモデル読込に時間がかかります。');
      analyze.click();

      await waitFor(() => analyze.disabled === true, {timeoutMs: 3000});
      await waitFor(() => analyze.disabled === false, {timeoutMs: 60 * 60 * 1000, intervalMs: 500});
      if (ownRun !== runId) return;

      const project = getProject();
      if (!project.captions.length) {
        setStatus('自動パイプライン: ローカル字幕解析が完了しなかったため画像選定へ進みません。');
        return;
      }

      if (project.speakerTurns.length && !project.avatar.speaker) {
        setStatus('字幕＋話者解析は完了しました。本人話者が未確定なので、口パクと画像選定を停止しています。本人話者を選択してください。');
        return;
      }

      if (!autoVisual?.checked) return;
      const visual = await waitFor(() => document.getElementById('visualSuggest'));
      setStatus('自動パイプライン: 本人発話だけを基準に画像挿入候補を端末内で選定します。');
      visual.click();
      await waitFor(() => visual.disabled === true, {timeoutMs: 3000});
      await waitFor(() => visual.disabled === false, {timeoutMs: 5 * 60 * 1000, intervalMs: 250});
      if (ownRun !== runId) return;
      setStatus(`自動パイプライン完了：字幕 ${getProject().captions.length} / 画像候補 ${getProject().visualCues.length} / API課金 0円`);
    } catch (error) {
      console.error(error);
      if (ownRun === runId) setStatus(`自動パイプライン停止：${error instanceof Error ? error.message : String(error)}`);
    }
  });
}
