#!/usr/bin/env python3
import argparse
import json
import re
from pathlib import Path

SENTENCE_RE = re.compile(r'(?<=[。！？!?])\s+|\n+')


def load_profile(path: Path):
    return json.loads(path.read_text(encoding='utf-8'))


def normalize(text: str) -> str:
    return re.sub(r'\s+', ' ', text).strip()


def split_sentences(text: str):
    parts = [normalize(p) for p in SENTENCE_RE.split(text)]
    return [p for p in parts if p]


def score_window(text: str, profile: dict):
    score = 0.0
    reasons = []
    for term, weight in profile.get('positive', {}).items():
        count = text.count(term)
        if count:
            score += weight * min(count, 2)
            reasons.append(f'+{weight} {term}')
    for term, weight in profile.get('privacyPenalty', {}).items():
        count = text.count(term)
        if count:
            score -= weight * min(count, 2)
            reasons.append(f'-{weight} privacy:{term}')

    length = len(text)
    lo = profile.get('preferredMinChars', 55)
    hi = profile.get('preferredMaxChars', 260)
    if lo <= length <= hi:
        score += 4
        reasons.append('+4 preferred-length')
    elif length < lo:
        score -= (lo - length) / 20
    else:
        score -= (length - hi) / 45

    # Strong self-contained endings are useful for Shorts.
    if re.search(r'(破門|辞めました|なりました|するな|なんですよ|なんです)$', text):
        score += 4
        reasons.append('+4 punchline-ending')

    # Long anonymous consultations are poor default public material.
    if text.count('さん') >= 4:
        score -= 4
        reasons.append('-4 many-person-references')

    return round(score, 2), reasons


def generate_candidates(sentences, profile):
    candidates = []
    for size in profile.get('windowSentences', [2, 3, 4, 5]):
        for i in range(0, max(0, len(sentences) - size + 1)):
            chunk = normalize(' '.join(sentences[i:i + size]))
            if not chunk:
                continue
            score, reasons = score_window(chunk, profile)
            candidates.append({
                'startSentence': i,
                'endSentence': i + size - 1,
                'score': score,
                'chars': len(chunk),
                'text': chunk,
                'reasons': reasons,
                'requiresAlignment': True,
            })
    # Remove near-duplicates by contained text, keep higher score.
    candidates.sort(key=lambda x: (-x['score'], x['chars']))
    kept = []
    for cand in candidates:
        duplicate = False
        for other in kept:
            a = cand['text']
            b = other['text']
            if a in b or b in a:
                duplicate = True
                break
        if not duplicate:
            kept.append(cand)
    return kept


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('transcript')
    ap.add_argument('--profile', default=str(Path(__file__).with_name('highlight-profile.json')))
    ap.add_argument('--top', type=int, default=12)
    ap.add_argument('--output')
    args = ap.parse_args()

    transcript = Path(args.transcript).read_text(encoding='utf-8', errors='replace')
    profile = load_profile(Path(args.profile))
    sentences = split_sentences(transcript)
    candidates = generate_candidates(sentences, profile)[:args.top]
    result = {
        'source': str(Path(args.transcript)),
        'sentenceCount': len(sentences),
        'candidateCount': len(candidates),
        'rule': '面白さは編集判断。時刻は別工程のASR/forced alignmentで確定する。',
        'candidates': candidates,
    }
    payload = json.dumps(result, ensure_ascii=False, indent=2)
    if args.output:
        Path(args.output).write_text(payload, encoding='utf-8')
    print(payload)


if __name__ == '__main__':
    main()
