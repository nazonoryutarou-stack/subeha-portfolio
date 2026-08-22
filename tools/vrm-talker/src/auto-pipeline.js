import {apiBaseIsConfigured, checkApiHealth} from './api/client.js';
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
    <h2>AUTO PIPELINE</h2>
    <label class="check"><input id="autoAnalyze" type="checkbox" checked> 音声選択後に字幕＋話者解析まで自動実行</label>
    <label class="check"><input id="autoVisual" type="checkbox" checked> 解析後に画像挿入候補まで自動選定</label>
    <div class="small">画像生成は課金を伴うため自動実行しません。生成候補は確認後に実行します。</div>
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

      // 保存済みプロジェクトの復元では既存字幕・画像を壊さない。
      // 正しい元音声とのSHA一致だけ確認して、そのまま編集再開する。
      if (restoringProject) {
        const project = getProject();
        setStatus(`プロジェクト復元完了：字幕 ${project.captions.length} / 画像 ${project.visualReferences.length} / 本人 ${project.avatar.speaker || '未指定'}`);
        return;
      }

      if (!autoAnalyze?.checked) return;
      if (!apiBaseIsConfigured()) {
        setStatus('音声を読み込みました。自動AI解析には先にWorker API URLを設定してください。');
        return;
      }

      const health = await checkApiHealth();
      if (!health?.ok) throw new Error('Worker health check failed');
      if (!health?.openaiConfigured) throw new Error('WorkerにOPENAI_API_KEYが設定されていません。');
      if (ownRun !== runId) return;

      const analyze = await waitFor(() => document.getElementById('studioAnalyze'));
      setStatus('自動パイプライン: 字幕＋話者解析を開始します。');
      analyze.click();

      await waitFor(() => analyze.disabled === true, {timeoutMs: 3000});
      await waitFor(() => analyze.disabled === false, {timeoutMs: 30 * 60 * 1000, intervalMs: 300});
      if (ownRun !== runId) return;

      const project = getProject();
      if (!project.captions.length) {
        setStatus('自動パイプライン: 字幕解析が完了しなかったため画像選定へ進みません。');
        return;
      }

      if (project.speakerTurns.length && !project.avatar.speaker) {
        setStatus('字幕解析完了。本人話者を選択すると口パクゲートが有効になります。画像候補は続けて選定します。');
      }

      if (!autoVisual?.checked) return;
      const visual = await waitFor(() => document.getElementById('visualSuggest'));
      setStatus('自動パイプライン: 発話内容から画像挿入候補を選定します。');
      visual.click();
      await waitFor(() => visual.disabled === true, {timeoutMs: 3000});
      await waitFor(() => visual.disabled === false, {timeoutMs: 5 * 60 * 1000, intervalMs: 250});
      if (ownRun !== runId) return;
      setStatus(`自動パイプライン完了：字幕 ${getProject().captions.length} / 画像候補 ${getProject().visualCues.length}`);
    } catch (error) {
      console.error(error);
      if (ownRun === runId) setStatus(`自動パイプライン停止：${error instanceof Error ? error.message : String(error)}`);
    }
  });
}
