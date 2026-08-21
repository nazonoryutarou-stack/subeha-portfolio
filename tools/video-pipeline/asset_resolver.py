#!/usr/bin/env python3
import argparse
import json
import os
import re
import urllib.parse
import urllib.request
from pathlib import Path

USER_AGENT = 'subeha-video-pipeline/1.0'


def request_json(url, headers=None):
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT, **(headers or {})})
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode('utf-8'))


def search_pexels(query, key, per_page=8):
    url = 'https://api.pexels.com/videos/search?' + urllib.parse.urlencode({'query': query, 'per_page': per_page})
    data = request_json(url, {'Authorization': key})
    out = []
    for video in data.get('videos', []):
        files = sorted(
            video.get('video_files', []),
            key=lambda item: (
                0 if (item.get('height') or 0) >= (item.get('width') or 0) else 1,
                abs((item.get('height') or 1280) - 1280),
            ),
        )
        if not files:
            continue
        file = files[0]
        out.append({
            'provider': 'pexels',
            'query': query,
            'assetUrl': file.get('link'),
            'sourcePage': video.get('url'),
            'width': file.get('width'),
            'height': file.get('height'),
            'license': 'Pexels License',
        })
    return out


def search_pixabay(query, key, per_page=8):
    url = 'https://pixabay.com/api/videos/?' + urllib.parse.urlencode({'key': key, 'q': query, 'per_page': per_page, 'safesearch': 'true'})
    data = request_json(url)
    out = []
    for hit in data.get('hits', []):
        variants = hit.get('videos', {})
        video = variants.get('medium') or variants.get('small') or variants.get('large') or {}
        if not video.get('url'):
            continue
        out.append({
            'provider': 'pixabay',
            'query': query,
            'assetUrl': video.get('url'),
            'sourcePage': hit.get('pageURL'),
            'width': video.get('width'),
            'height': video.get('height'),
            'license': 'Pixabay Content License',
        })
    return out


def safe_name(text):
    return re.sub(r'[^A-Za-z0-9._-]+', '_', text).strip('_') or 'asset'


def download(url, path):
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    with urllib.request.urlopen(req, timeout=90) as response, open(path, 'wb') as f:
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            f.write(chunk)


def resolve_one(item, download_dir=None):
    query = item['query']
    local = item.get('local')
    if local and Path(local).exists():
        return {
            'id': item['id'],
            'provider': 'local',
            'query': query,
            'path': str(Path(local).resolve()),
            'license': item.get('license', 'user-provided'),
        }

    candidates = []
    pexels_key = os.getenv('PEXELS_API_KEY')
    pixabay_key = os.getenv('PIXABAY_API_KEY')
    if pexels_key:
        try:
            candidates.extend(search_pexels(query, pexels_key))
        except Exception as exc:
            candidates.append({'provider': 'pexels', 'error': str(exc), 'query': query})
    if not [c for c in candidates if c.get('assetUrl')] and pixabay_key:
        try:
            candidates.extend(search_pixabay(query, pixabay_key))
        except Exception as exc:
            candidates.append({'provider': 'pixabay', 'error': str(exc), 'query': query})

    usable = [c for c in candidates if c.get('assetUrl')]
    if usable:
        chosen = usable[0]
        result = {'id': item['id'], **chosen}
        if download_dir:
            Path(download_dir).mkdir(parents=True, exist_ok=True)
            ext = Path(urllib.parse.urlparse(chosen['assetUrl']).path).suffix or '.mp4'
            target = Path(download_dir) / f"{safe_name(item['id'])}{ext}"
            download(chosen['assetUrl'], target)
            result['path'] = str(target.resolve())
        return result

    # Deterministic fallback. Renderer knows how to draw these scene kinds itself.
    return {
        'id': item['id'],
        'provider': 'procedural',
        'query': query,
        'kind': item.get('fallbackKind', 'abstract'),
        'license': 'original-code-generated',
        'reason': 'no local asset or configured stock API result',
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('plan')
    ap.add_argument('--output', required=True)
    ap.add_argument('--download-dir')
    args = ap.parse_args()

    plan = json.loads(Path(args.plan).read_text(encoding='utf-8'))
    resolved = [resolve_one(item, args.download_dir) for item in plan['assets']]
    result = {
        'version': 1,
        'policy': ['local', 'pexels', 'pixabay', 'procedural'],
        'assets': resolved,
    }
    Path(args.output).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
