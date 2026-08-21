#!/usr/bin/env python3
import argparse
import json
import math
import subprocess
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 720, 1280, 30
FONT_REG = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
FONT_BOLD = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'


def font(path, size):
    return ImageFont.truetype(path, size=size, index=2 if 'SansCJK' in path else 0)


F_SMALL = font(FONT_REG, 22)
F_META = font(FONT_REG, 18)
F_TITLE = font(FONT_BOLD, 43)
F_CAPTION = font(FONT_BOLD, 50)
F_SCENE = font(FONT_BOLD, 32)
F_BIG = font(FONT_BOLD, 74)


def ffprobe_duration(path: Path) -> float:
    p = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', str(path)],
        capture_output=True,
        text=True,
        check=True,
    )
    return float(p.stdout.strip())


def load_rms(audio: Path, duration: float, fps: int):
    p = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', str(audio), '-ac', '1', '-ar', '16000', '-f', 's16le', '-'],
        capture_output=True,
        check=True,
    )
    import array

    samples = array.array('h')
    samples.frombytes(p.stdout)
    sr = 16000
    nframes = int(math.ceil(duration * fps))
    out = []
    for i in range(nframes):
        s0 = int(i / fps * sr)
        s1 = min(len(samples), int((i + 1) / fps * sr))
        if s1 <= s0:
            out.append(0.0)
            continue
        acc = 0.0
        for x in samples[s0:s1]:
            acc += float(x) * float(x)
        rms = math.sqrt(acc / (s1 - s0)) / 32768.0
        out.append(rms)
    peak = max(out) if out else 1.0
    return [min(1.0, (v / peak) ** 0.62) if peak > 0 else 0.0 for v in out]


def rounded(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def text_center(draw, xy, text, ft, fill, stroke=0, stroke_fill=None, anchor='mm'):
    draw.multiline_text(
        xy,
        text,
        font=ft,
        fill=fill,
        anchor=anchor,
        align='center',
        spacing=8,
        stroke_width=stroke,
        stroke_fill=stroke_fill,
    )


def lerp(a, b, t):
    return a + (b - a) * t


def scene_for(job, t):
    for scene in job['scenes']:
        if scene['startMs'] / 1000 <= t < scene['endMs'] / 1000:
            return scene
    return job['scenes'][-1]


def caption_for(job, t):
    ms = t * 1000
    for caption in job['captions']:
        if caption['startMs'] <= ms < caption['endMs']:
            return caption
    return None


def draw_grid(draw, offset, alpha=22):
    for x in range(-40, W + 80, 48):
        xx = x + int(offset % 48)
        draw.line((xx, 0, xx, H), fill=(255, 255, 255, alpha), width=1)
    for y in range(-40, H + 80, 48):
        yy = y + int((offset * 0.65) % 48)
        draw.line((0, yy, W, yy), fill=(255, 255, 255, alpha), width=1)


def draw_caffeine(draw, t, level):
    bob = math.sin(t * 2.4) * 8
    rounded(draw, (185, 455 + bob, 535, 690 + bob), 36, (229, 221, 208, 255), outline=(255, 255, 255, 115), width=2)
    rounded(draw, (500, 505 + bob, 600, 625 + bob), 46, None, outline=(229, 221, 208, 255), width=18)
    draw.ellipse((212, 433 + bob, 508, 503 + bob), fill=(52, 33, 25, 255), outline=(247, 236, 221, 150), width=4)
    for i in range(3):
        points = []
        for k in range(24):
            yy = 420 - k * 9
            xx = 280 + i * 80 + math.sin(t * 2 + i + k * 0.35) * (8 + level * 8)
            points.append((xx, yy + bob))
        draw.line(points, fill=(255, 255, 255, 110), width=5)
    text_center(draw, (360, 790), 'CAFFEINE', F_BIG, (245, 241, 233, 245))
    text_center(draw, (360, 850), 'signal / stimulant', F_META, (245, 241, 233, 145))


def draw_tobacco(draw, t, level):
    y = 625
    rounded(draw, (135, y, 555, y + 64), 28, (238, 229, 210, 255))
    rounded(draw, (500, y, 570, y + 64), 8, (181, 92, 54, 255))
    rounded(draw, (125, y, 150, y + 64), 10, (245, 145, 79, 255))
    for i in range(4):
        points = []
        for k in range(32):
            yy = y - 10 - k * 12
            xx = 135 + math.sin(k * 0.45 + t * 1.7 + i) * (15 + i * 8) + i * 10
            points.append((xx, yy))
        draw.line(points, fill=(235, 235, 235, 80 + i * 22), width=4)
    text_center(draw, (360, 810), 'TOBACCO', F_BIG, (245, 241, 233, 245))
    text_center(draw, (360, 870), 'speaker quote / not medical advice', F_META, (245, 241, 233, 145))


def draw_pressure(draw, t, level):
    cx, cy = 360, 610
    radius = 160
    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=(18, 24, 32, 255), outline=(241, 242, 244, 170), width=8)
    for i in range(13):
        angle = math.radians(200 + i * (140 / 12))
        x1 = cx + math.cos(angle) * (radius - 18)
        y1 = cy + math.sin(angle) * (radius - 18)
        x2 = cx + math.cos(angle) * (radius - 42)
        y2 = cy + math.sin(angle) * (radius - 42)
        draw.line((x1, y1, x2, y2), fill=(235, 235, 235, 160), width=4)
    angle = math.radians(330 - level * 70)
    x2 = cx + math.cos(angle) * 110
    y2 = cy + math.sin(angle) * 110
    draw.line((cx, cy, x2, y2), fill=(255, 113, 108, 255), width=10)
    draw.ellipse((cx - 14, cy - 14, cx + 14, cy + 14), fill=(255, 113, 108, 255))
    for k in range(3):
        yy = 835 + k * 54 + math.sin(t * 4 + k) * 4
        draw.line((325, yy, 360, yy + 28, 395, yy), fill=(157, 220, 207, 220), width=8, joint='curve')
    text_center(draw, (360, 1030), 'DOWN / DOWN', F_SCENE, (157, 220, 207, 230))


def draw_survive(draw, t, level):
    base = 640
    points = []
    for x in range(70, 650, 8):
        phase = x / 80 + t * 2.2
        y = base + math.sin(phase) * 10
        if 330 < x < 405:
            y += math.sin((x - 330) / 75 * math.pi * 4) * (90 + level * 70)
        points.append((x, y))
    draw.line(points, fill=(255, 116, 126, 240), width=7)
    pulse = 1 + 0.06 * math.sin(t * 5)
    radius = int(78 * pulse)
    draw.ellipse((360 - radius, 425 - radius, 360 + radius, 425 + radius), outline=(255, 116, 126, 190), width=8)
    text_center(draw, (360, 425), '♥', font(FONT_BOLD, 110), (255, 116, 126, 245))
    text_center(draw, (360, 805), '生きていこうかな', F_BIG, (245, 241, 233, 245))
    text_center(draw, (360, 875), 'broadcast archive', F_META, (245, 241, 233, 145))


def render_frame(job, t, level):
    scene = scene_for(job, t)
    palette = {
        'caffeine': ((22, 18, 16), (65, 45, 34)),
        'tobacco': ((15, 17, 20), (47, 53, 61)),
        'pressure': ((10, 17, 24), (30, 58, 70)),
        'survive': ((23, 10, 16), (64, 20, 31)),
    }
    a, b = palette.get(scene['kind'], ((14, 14, 18), (35, 35, 42)))
    img = Image.new('RGBA', (W, H), (0, 0, 0, 255))
    pix = img.load()
    for y in range(H):
        q = y / (H - 1)
        q2 = max(0, min(1, q + math.sin(t * 0.5) * 0.025))
        color = tuple(int(lerp(a[i], b[i], q2)) for i in range(3)) + (255,)
        for x in range(W):
            pix[x, y] = color

    overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, 'RGBA')
    draw_grid(draw, t * 18, 16)

    draw.text((38, 32), 'SUBEHA / AUTO-CUT V1', font=F_META, fill=(255, 255, 255, 135))
    draw.text((W - 38, 32), job.get('sourceLabel', 'GRAVITY ARCHIVE'), font=F_META, fill=(255, 255, 255, 105), anchor='ra')

    rounded(draw, (34, 72, W - 34, 196), 26, (0, 0, 0, 74), outline=(255, 255, 255, 32), width=2)
    text_center(draw, (W / 2, 113), job['title'], F_TITLE, (255, 255, 255, 245))
    draw.multiline_text((W / 2, 171), job.get('hook', ''), font=F_META, fill=(255, 255, 255, 150), anchor='mm', align='center')

    if scene['kind'] == 'caffeine':
        draw_caffeine(draw, t, level)
    elif scene['kind'] == 'tobacco':
        draw_tobacco(draw, t, level)
    elif scene['kind'] == 'pressure':
        draw_pressure(draw, t, level)
    elif scene['kind'] == 'survive':
        draw_survive(draw, t, level)

    meter_x0, meter_x1, meter_y = 72, 648, 950
    for i in range(56):
        h = 4 + 34 * (0.22 + 0.78 * level) * abs(math.sin(i * 0.71 + t * 7.4))
        x = meter_x0 + i * (meter_x1 - meter_x0) / 55
        draw.line((x, meter_y - h / 2, x, meter_y + h / 2), fill=(255, 255, 255, 75), width=3)

    caption = caption_for(job, t)
    if caption:
        rounded(draw, (34, 1000, W - 34, 1194), 30, (0, 0, 0, 175), outline=(255, 255, 255, 38), width=2)
        text_center(draw, (W / 2, 1090), caption['text'], F_CAPTION, (255, 255, 255, 255), stroke=4, stroke_fill=(0, 0, 0, 240))

    draw.text((36, 1218), job.get('disclaimer', ''), font=F_SMALL, fill=(255, 255, 255, 110))
    duration = job['durationMs'] / 1000
    progress = max(0, min(1, t / duration))
    draw.rounded_rectangle((36, 1250, W - 36, 1258), radius=4, fill=(255, 255, 255, 35))
    draw.rounded_rectangle((36, 1250, 36 + (W - 72) * progress, 1258), radius=4, fill=(255, 255, 255, 180))

    return Image.alpha_composite(img, overlay).convert('RGB')


def validate_job(job, audio_duration):
    errors = []
    duration = job['durationMs'] / 1000
    if abs(audio_duration - duration) > 0.08:
        errors.append(f'audio duration mismatch: audio={audio_duration:.3f}s job={duration:.3f}s')
    previous_end = -1
    for i, caption in enumerate(job['captions']):
        if not (0 <= caption['startMs'] < caption['endMs'] <= job['durationMs'] + 1):
            errors.append(f'caption[{i}] invalid range')
        if caption['startMs'] < previous_end:
            errors.append(f'caption[{i}] overlaps previous caption')
        previous_end = caption['endMs']
    return errors


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--job', required=True)
    parser.add_argument('--audio', default=None)
    parser.add_argument('--output', required=True)
    parser.add_argument('--qc-dir', default=None)
    args = parser.parse_args()

    job_path = Path(args.job).resolve()
    job = json.loads(job_path.read_text(encoding='utf-8'))
    audio = Path(args.audio or job['audio'])
    if not audio.is_absolute():
        audio = (job_path.parent / audio).resolve()
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    qc_dir = Path(args.qc_dir or output.parent / 'qc').resolve()
    qc_dir.mkdir(parents=True, exist_ok=True)

    audio_duration = ffprobe_duration(audio)
    errors = validate_job(job, audio_duration)
    if errors:
        print('\n'.join('ERROR: ' + error for error in errors), file=sys.stderr)
        sys.exit(2)

    duration = job['durationMs'] / 1000
    frame_count = round(duration * FPS)
    rms = load_rms(audio, duration, FPS)

    command = [
        'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
        '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
        '-i', str(audio), '-map', '0:v:0', '-map', '1:a:0', '-t', f'{duration:.3f}',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', str(output),
    ]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)

    qc_times = job.get('qcTimesSec', [0.5, duration / 2, max(0, duration - 0.5)])
    written = set()
    for i in range(frame_count):
        t = i / FPS
        level = rms[min(i, len(rms) - 1)] if rms else 0
        frame = render_frame(job, t, level)
        assert process.stdin is not None
        process.stdin.write(frame.tobytes())
        for q in qc_times:
            key = f'{q:.2f}'
            if key not in written and abs(t - q) <= 0.5 / FPS:
                frame.save(qc_dir / f'qc_{q:05.2f}s.png')
                written.add(key)

    assert process.stdin is not None
    process.stdin.close()
    return_code = process.wait()
    if return_code != 0:
        raise SystemExit(return_code)

    output_duration = ffprobe_duration(output)
    report = {
        'status': 'pass' if abs(output_duration - duration) < 0.12 else 'fail',
        'output': str(output),
        'videoDurationSec': round(output_duration, 3),
        'audioDurationSec': round(audio_duration, 3),
        'jobDurationSec': round(duration, 3),
        'fps': FPS,
        'frames': frame_count,
        'captions': len(job['captions']),
        'captionTimingSource': job.get('captionTimingSource', 'unknown'),
        'assets': [
            {'kind': scene['kind'], 'source': 'procedural', 'license': 'original-code-generated'}
            for scene in job['scenes']
        ],
        'qcFrames': sorted(path.name for path in qc_dir.glob('qc_*.png')),
    }
    (output.parent / 'qc-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    (output.parent / 'asset-manifest.json').write_text(json.dumps(report['assets'], ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
