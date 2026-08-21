import {getProject, visualReferenceAt} from './app/project-state.js';

const stage = document.getElementById('stage');
const sourceCanvas = document.getElementById('c');
const seek = document.getElementById('seek');
const play = document.getElementById('play');
const status = document.getElementById('status');

const imageCache = new Map();
let lastSeekValue = null;
let anchorMs = 0;
let anchorPerf = performance.now();
let activeId = null;
let warnedUnsafeId = null;

const setStatus = (message) => {
  if (status) status.textContent = message;
};

const currentTimeMs = () => {
  const duration = Number(getProject().source.durationMs || 0);
  if (!duration || !seek) return 0;
  const value = Number(seek.value || 0);
  if (value !== lastSeekValue) {
    lastSeekValue = value;
    anchorMs = value / 1000 * duration;
    anchorPerf = performance.now();
  }
  const playing = play?.textContent === '一時停止';
  if (!playing) return anchorMs;
  return Math.min(duration, anchorMs + (performance.now() - anchorPerf));
};

const loadImage = (ref) => {
  const src = ref?.thumbnailUrl || ref?.url;
  if (!src) return null;
  if (imageCache.has(src)) return imageCache.get(src);
  const record = {image: new Image(), ready: false, safeForCanvas: false, error: false};
  if (!src.startsWith('data:') && !src.startsWith('blob:')) record.image.crossOrigin = 'anonymous';
  record.image.onload = () => {
    record.ready = true;
    if (src.startsWith('data:') || src.startsWith('blob:')) {
      record.safeForCanvas = true;
      return;
    }
    try {
      const test = document.createElement('canvas');
      test.width = 2;
      test.height = 2;
      const ctx = test.getContext('2d');
      ctx.drawImage(record.image, 0, 0, 2, 2);
      test.toDataURL('image/png');
      record.safeForCanvas = true;
    } catch {
      record.safeForCanvas = false;
    }
  };
  record.image.onerror = () => { record.error = true; };
  record.image.src = src;
  imageCache.set(src, record);
  return record;
};

const drawCover = (ctx, image, x, y, width, height) => {
  const iw = image.naturalWidth || image.width || 1;
  const ih = image.naturalHeight || image.height || 1;
  const scale = Math.max(width / iw, height / ih);
  const sw = width / scale;
  const sh = height / scale;
  const sx = Math.max(0, (iw - sw) / 2);
  const sy = Math.max(0, (ih - sh) / 2);
  ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
};

if (stage && sourceCanvas) {
  const preview = document.createElement('div');
  preview.id = 'visualReferencePreview';
  Object.assign(preview.style, {
    position: 'absolute',
    zIndex: '3',
    display: 'none',
    overflow: 'hidden',
    borderRadius: '10px',
    boxShadow: '0 8px 30px rgba(0,0,0,.4)',
    pointerEvents: 'none',
    background: '#111',
  });
  const previewImage = document.createElement('img');
  previewImage.alt = '';
  Object.assign(previewImage.style, {width: '100%', height: '100%', objectFit: 'cover', display: 'block'});
  preview.appendChild(previewImage);
  stage.appendChild(preview);

  const positionPreview = () => {
    const stageRect = stage.getBoundingClientRect();
    const canvasRect = sourceCanvas.getBoundingClientRect();
    const width = canvasRect.width * 0.38;
    const height = Math.min(canvasRect.height * 0.32, width * 1.1);
    preview.style.left = `${canvasRect.right - stageRect.left - width - canvasRect.width * 0.055}px`;
    preview.style.top = `${canvasRect.top - stageRect.top + canvasRect.height * 0.13}px`;
    preview.style.width = `${width}px`;
    preview.style.height = `${height}px`;
  };
  new ResizeObserver(positionPreview).observe(sourceCanvas);
  positionPreview();

  const updatePreview = () => {
    const ref = visualReferenceAt(currentTimeMs());
    if (!ref) {
      activeId = null;
      preview.style.display = 'none';
      return;
    }
    const src = ref.thumbnailUrl || ref.url;
    if (!src) {
      preview.style.display = 'none';
      return;
    }
    if (activeId !== ref.id) {
      activeId = ref.id;
      previewImage.src = src;
      previewImage.alt = ref.title || ref.query || ref.prompt || 'visual reference';
    }
    preview.style.display = 'block';
    positionPreview();
    loadImage(ref);
  };

  setInterval(updatePreview, 60);
  window.addEventListener('vrm-studio-project-changed', updatePreview);

  const nativeCapture = sourceCanvas.captureStream?.bind(sourceCanvas);
  if (nativeCapture) {
    sourceCanvas.captureStream = (fps = 30) => {
      const composite = document.createElement('canvas');
      composite.width = sourceCanvas.width;
      composite.height = sourceCanvas.height;
      const ctx = composite.getContext('2d', {alpha: false});
      let running = true;

      const syncSize = () => {
        if (composite.width !== sourceCanvas.width || composite.height !== sourceCanvas.height) {
          composite.width = sourceCanvas.width;
          composite.height = sourceCanvas.height;
        }
      };

      const draw = () => {
        if (!running) return;
        syncSize();
        ctx.drawImage(sourceCanvas, 0, 0, composite.width, composite.height);
        const ref = visualReferenceAt(currentTimeMs());
        if (ref) {
          const record = loadImage(ref);
          if (record?.ready && record.safeForCanvas) {
            const w = composite.width * 0.38;
            const h = Math.min(composite.height * 0.32, w * 1.1);
            const x = composite.width - w - composite.width * 0.055;
            const y = composite.height * 0.13;
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,.5)';
            ctx.shadowBlur = Math.max(8, composite.width * 0.018);
            drawCover(ctx, record.image, x, y, w, h);
            ctx.restore();
          } else if (record?.ready && !record.safeForCanvas && warnedUnsafeId !== ref.id) {
            warnedUnsafeId = ref.id;
            setStatus('この検索画像は配信元CORS制限のためプレビューのみ。録画へ焼くには安全な取得経路が必要です。');
          }
        }
        requestAnimationFrame(draw);
      };
      requestAnimationFrame(draw);

      const stream = composite.captureStream(fps);
      for (const track of stream.getVideoTracks()) {
        track.addEventListener('ended', () => { running = false; }, {once: true});
      }
      return stream;
    };
  }
}
