/* DeepDream v21.1 ── 実ブラウザ3連続メモリ試験

   エンジンには手を入れず、既存の「夢を見る」ボタンを実際に3回押す。
   各回の終了後に tf.memory() を採取し、モデルを保持したまま
   テンソル数 / GPUバイト数が同じ値へ戻るかを見る。
*/

const $ = (id) => document.getElementById(id);
const testBtn = $('selftest');
const runBtn = $('run');
const resetBtn = $('reset');
const statusEl = $('status');
const logEl = $('diagnostics');
const dropEl = $('drop');

const PASS_TIMEOUT_MS = 30 * 60 * 1000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const mb = (n) => Number.isFinite(n) ? `${(n / 1048576).toFixed(1)}MB` : 'n/a';

function append(line = '') {
  logEl.textContent += (logEl.textContent ? '\n' : '') + line;
  logEl.scrollTop = logEl.scrollHeight;
}

function snapshot() {
  const m = tf.memory();
  return {
    numTensors: m.numTensors,
    numBytes: m.numBytes,
    numBytesInGPU: Number.isFinite(m.numBytesInGPU) ? m.numBytesInGPU : null,
    unreliable: Boolean(m.unreliable),
    reasons: Array.isArray(m.reasons) ? m.reasons.slice() : [],
    backend: tf.getBackend(),
  };
}

function formatMemory(m) {
  return `tensor=${m.numTensors} / JS=${mb(m.numBytes)} / GPU=${m.numBytesInGPU == null ? 'n/a' : mb(m.numBytesInGPU)} / backend=${m.backend}`;
}

async function settleMemory() {
  try { await tf.nextFrame(); } catch {}
  await sleep(250);
  try { await tf.nextFrame(); } catch {}
}

async function waitForOneRun() {
  const startedAt = performance.now();
  let sawBusy = runBtn.disabled;

  while (performance.now() - startedAt < PASS_TIMEOUT_MS) {
    if (runBtn.disabled) sawBusy = true;
    if (sawBusy && !runBtn.disabled) return;

    const text = statusEl.textContent || '';
    if (!sawBusy && text.includes('先に画像を選んでください')) {
      throw new Error('画像が読み込まれていません');
    }
    await sleep(80);
  }
  throw new Error('1回の変換が30分以内に終了しませんでした');
}

function allEqual(values) {
  return values.length > 0 && values.every((v) => v === values[0]);
}

async function runPass(index) {
  append(`${index}回目: 実行中…`);
  const t0 = performance.now();
  runBtn.click();
  await waitForOneRun();
  await settleMemory();

  const statusText = statusEl.textContent || '';
  if (statusText.includes('エラー')) throw new Error(statusText);
  if (statusText.includes('停止')) throw new Error(`変換が停止しました: ${statusText}`);

  const mem = snapshot();
  const sec = ((performance.now() - t0) / 1000).toFixed(1);
  append(`${index}回目: ${sec}秒 / ${formatMemory(mem)}`);
  if (mem.unreliable && mem.reasons.length) append(`  tf.memory注記: ${mem.reasons.join(' / ')}`);
  return mem;
}

if (testBtn) {
  testBtn.addEventListener('click', async () => {
    if (typeof tf === 'undefined') {
      logEl.textContent = 'FAIL: TensorFlow.js が読み込まれていません。';
      return;
    }
    if (!dropEl.classList.contains('hidden')) {
      logEl.textContent = '先に画像を1枚読み込んでください。';
      return;
    }
    if (runBtn.disabled || testBtn.disabled) return;

    testBtn.disabled = true;
    logEl.textContent = '';

    try {
      append('DeepDream v21.1 実ブラウザ3連続メモリ試験');
      append(`画像: ${$('stage').width}×${$('stage').height}`);
      append(`重さ: ${document.querySelector('[data-preset].active')?.textContent || '?'}`);
      append(`幻覚アセット: ${document.querySelector('[data-asset].active')?.textContent || '?'}`);

      /* 何度か夢を見た後でも、同じ条件から測れるよう原画へ戻す。 */
      resetBtn.click();
      await settleMemory();
      const baseline = snapshot();
      append(`開始前: ${formatMemory(baseline)}`);
      append('');

      const records = [];
      for (let i = 1; i <= 3; i += 1) records.push(await runPass(i));

      const tensorStable = allEqual(records.map((m) => m.numTensors));
      const bytesStable = allEqual(records.map((m) => m.numBytes));
      const gpuValues = records.map((m) => m.numBytesInGPU);
      const gpuAvailable = gpuValues.every((v) => v != null);
      const gpuStable = gpuAvailable ? allEqual(gpuValues) : true;

      append('');
      append(`テンソル数: ${tensorStable ? '一致' : '不一致'} (${records.map((m) => m.numTensors).join(' → ')})`);
      append(`Tensor bytes: ${bytesStable ? '一致' : '不一致'} (${records.map((m) => mb(m.numBytes)).join(' → ')})`);
      append(gpuAvailable
        ? `GPU bytes: ${gpuStable ? '一致' : '不一致'} (${gpuValues.map(mb).join(' → ')})`
        : 'GPU bytes: このブラウザでは取得不可');

      const pass = tensorStable && bytesStable && gpuStable;
      append('');
      append(pass
        ? 'PASS: 3回ともメモリが同じ値へ戻りました。再変換の捨て漏れは再現していません。'
        : 'CHECK: 回ごとのメモリ値が一致しません。ログを残して原因を追います。');
      statusEl.textContent = `${pass ? '3回メモリ試験 PASS' : '3回メモリ試験 CHECK'} ｜ 2026-08-23 v21.1`;
    } catch (e) {
      append('');
      append(`FAIL: ${e?.message || e}`);
      statusEl.textContent = `3回メモリ試験 FAIL ｜ 2026-08-23 v21.1`;
      console.error('DeepDream v21.1 self-test failed', e);
    } finally {
      testBtn.disabled = false;
    }
  });
}
