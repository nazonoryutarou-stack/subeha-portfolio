#!/usr/bin/env python3
import argparse, json, re, unicodedata
from pathlib import Path

SPECIAL_RE = re.compile(r"^<\\|.*\\|>$")

def is_punctuation(text):
    s=text.strip()
    return bool(s) and all(unicodedata.category(ch).startswith(("P","S")) for ch in s)

def num(v):
    return float(v) if isinstance(v,(int,float)) and not isinstance(v,bool) else None

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("input",type=Path); ap.add_argument("output",type=Path)
    a=ap.parse_args()
    doc=json.loads(a.input.read_text(encoding="utf-8"))
    tx=doc.get("transcription")
    if not isinstance(tx,list): raise SystemExit("input has no transcription[] array")
    rows=[]; skipped=0; attached=0
    for si,seg in enumerate(tx):
        toks=seg.get("tokens") if isinstance(seg,dict) else None
        if not isinstance(toks,list): continue
        for ti,tok in enumerate(toks):
            if not isinstance(tok,dict): continue
            text=str(tok.get("text","")).strip()
            if not text: continue
            if SPECIAL_RE.match(text): skipped+=1; continue
            off=tok.get("offsets")
            start=num(off.get("from")) if isinstance(off,dict) else None
            end=num(off.get("to")) if isinstance(off,dict) else None
            if start is None or end is None or end<=start or start<0:
                # whisper.cpp full JSON emits control/timestamp tokens too.
                # They do not carry real token offsets and must never become subtitle text.
                skipped += 1
                continue
            start_ms=int(round(start)); end_ms=int(round(end)); p=num(tok.get("p"))
            if rows and is_punctuation(text) and start_ms<=rows[-1]["end_ms"]+250:
                rows[-1]["text"]+=text; rows[-1]["end_ms"]=max(rows[-1]["end_ms"],end_ms); continue
            rows.append({"type":"part","text":text,"start_ms":start_ms,"end_ms":end_ms,
                         "probability":p,"source":"whisper.cpp","timing_mode":"token",
                         "segment_index":si,"token_index":ti})
    if not rows: raise SystemExit("no timed tokens found")
    rows.sort(key=lambda r:(r["start_ms"],r["end_ms"],r["segment_index"],r["token_index"]))
    for i,r in enumerate(rows):
        nxt=rows[i+1]["start_ms"] if i+1<len(rows) else r["end_ms"]
        r["next_start_ms"]=max(r["start_ms"]+1,nxt)
    a.output.parent.mkdir(parents=True,exist_ok=True)
    with a.output.open("w",encoding="utf-8") as f:
        for r in rows: f.write(json.dumps(r,ensure_ascii=False,separators=(",",":"))+"\\n")
    print(json.dumps({"parts":len(rows),"duration_ms":max(r["end_ms"] for r in rows),
                      "skipped_special":skipped,"untimed_skipped":skipped,
                      "output":str(a.output)},ensure_ascii=False))
if __name__=="__main__": main()
