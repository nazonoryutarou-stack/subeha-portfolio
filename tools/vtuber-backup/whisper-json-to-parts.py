#!/usr/bin/env python3
import argparse, json, math, re, struct, unicodedata, wave
from pathlib import Path

CONTROL_RE = re.compile(r'^(?:\[_.*\]|<\|.*\|>)$')

def is_control(text):
    s=text.strip()
    return bool(s) and bool(CONTROL_RE.match(s))

def is_punctuation(text):
    s=text.strip()
    return bool(s) and all(unicodedata.category(ch).startswith(("P","S")) for ch in s)

def num(v):
    return float(v) if isinstance(v,(int,float)) and not isinstance(v,bool) else None

def percentile(values, q):
    if not values:
        return 0.0
    xs=sorted(values)
    pos=(len(xs)-1)*q
    lo=int(math.floor(pos)); hi=int(math.ceil(pos))
    if lo==hi:
        return xs[lo]
    frac=pos-lo
    return xs[lo]*(1-frac)+xs[hi]*frac

def load_rms_db(path, frame_ms=20):
    if path is None:
        return None
    with wave.open(str(path),"rb") as w:
        if w.getnchannels()!=1 or w.getsampwidth()!=2:
            raise SystemExit("audio must be mono PCM16 WAV")
        sr=w.getframerate()
        data=w.readframes(w.getnframes())
    n=sr*frame_ms//1000
    vals=struct.unpack("<%dh"%(len(data)//2),data)
    out=[]
    for i in range(0,len(vals)-n+1,n):
        chunk=vals[i:i+n]
        ss=sum(x*x for x in chunk)/len(chunk)
        rms=math.sqrt(ss)/32768.0
        out.append(20*math.log10(rms+1e-9))
    return {"db":out,"frame_ms":frame_ms,"noise":percentile(out,0.25)}

def lexical_tokens(seg):
    out=[]
    for ti,tok in enumerate(seg.get("tokens") or []):
        if not isinstance(tok,dict):
            continue
        text=str(tok.get("text","")).strip()
        if not text or is_control(text):
            continue
        off=tok.get("offsets")
        start=num(off.get("from")) if isinstance(off,dict) else None
        end=num(off.get("to")) if isinstance(off,dict) else None
        out.append({"text":text,"token_index":ti,"start":start,"end":end,"p":num(tok.get("p"))})
    return out

def timing_quality(tokens):
    core=[t for t in tokens if not is_punctuation(t["text"])]
    if not core:
        return 1.0
    good=sum(1 for t in core if t["start"] is not None and t["end"] is not None and t["end"]>t["start"])
    return good/len(core)

def fallback_bounds(seg, audio):
    start=int(seg["offsets"]["from"]); end=int(seg["offsets"]["to"])
    if not audio:
        return start,end
    fm=audio["frame_ms"]; db=audio["db"]
    i0=max(0,start//fm); i1=min(len(db),int(math.ceil(end/fm)))
    if i1<=i0:
        return start,end
    threshold=audio["noise"]+10.0
    active=[i for i in range(i0,i1) if db[i]>threshold]
    if len(active)<3:
        return start,end
    a=max(start,active[0]*fm)
    b=min(end,(active[-1]+1)*fm)
    if b-a<300:
        return start,end
    return a,b

def retime_segment(seg,tokens,audio,si):
    start,end=fallback_bounds(seg,audio)
    lexical=[t for t in tokens if not is_punctuation(t["text"])]
    if not lexical:
        return []

    punct_after={}
    lexical_index=-1
    for t in tokens:
        if is_punctuation(t["text"]):
            if lexical_index>=0:
                punct_after[lexical_index]=punct_after.get(lexical_index,"")+t["text"]
        else:
            lexical_index+=1

    weights=[max(1,len(t["text"])) for t in lexical]
    total=sum(weights)
    acc=0
    rows=[]
    for j,(t,w) in enumerate(zip(lexical,weights)):
        s=start+(end-start)*acc/total
        acc+=w
        e=start+(end-start)*acc/total
        rows.append({
            "type":"part",
            "text":t["text"]+punct_after.get(j,""),
            "start_ms":int(round(s)),
            "end_ms":max(int(round(s))+1,int(round(e))),
            "probability":t["p"],
            "source":"whisper.cpp",
            "timing_mode":"segment-retimed",
            "segment_index":si,
            "token_index":t["token_index"],
        })
    return rows

def direct_segment(tokens,si):
    rows=[]
    for t in tokens:
        if t["start"] is None or t["end"] is None or t["end"]<=t["start"] or t["start"]<0:
            continue
        start_ms=int(round(t["start"]))
        end_ms=int(round(t["end"]))
        if is_punctuation(t["text"]) and rows and start_ms<=rows[-1]["end_ms"]+250:
            rows[-1]["text"]+=t["text"]
            rows[-1]["end_ms"]=max(rows[-1]["end_ms"],end_ms)
            continue
        rows.append({
            "type":"part",
            "text":t["text"],
            "start_ms":start_ms,
            "end_ms":end_ms,
            "probability":t["p"],
            "source":"whisper.cpp",
            "timing_mode":"token",
            "segment_index":si,
            "token_index":t["token_index"],
        })
    return rows

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("input",type=Path)
    ap.add_argument("output",type=Path)
    ap.add_argument("--audio",type=Path,default=None)
    ap.add_argument("--min-token-quality",type=float,default=0.70)
    a=ap.parse_args()

    doc=json.loads(a.input.read_text(encoding="utf-8"))
    tx=doc.get("transcription")
    if not isinstance(tx,list):
        raise SystemExit("input has no transcription[] array")

    audio=load_rms_db(a.audio) if a.audio else None
    rows=[]; retimed=0; direct=0; qualities=[]

    for si,seg in enumerate(tx):
        tokens=lexical_tokens(seg)
        if not tokens:
            continue
        quality=timing_quality(tokens)
        qualities.append(quality)
        if quality<a.min_token_quality:
            rows.extend(retime_segment(seg,tokens,audio,si))
            retimed+=1
        else:
            rows.extend(direct_segment(tokens,si))
            direct+=1

    if not rows:
        raise SystemExit("no subtitle parts produced")

    rows.sort(key=lambda r:(r["start_ms"],r["end_ms"],r["segment_index"],r["token_index"]))
    for i,row in enumerate(rows):
        nxt=rows[i+1]["start_ms"] if i+1<len(rows) else row["end_ms"]
        row["next_start_ms"]=max(row["start_ms"]+1,nxt)

    a.output.parent.mkdir(parents=True,exist_ok=True)
    with a.output.open("w",encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row,ensure_ascii=False,separators=(",",":"))+"\n")

    print(json.dumps({
        "parts":len(rows),
        "duration_ms":max(r["end_ms"] for r in rows),
        "segments_direct":direct,
        "segments_retimed":retimed,
        "segment_token_quality":[round(x,3) for x in qualities],
        "audio_fallback":bool(audio),
        "output":str(a.output),
    },ensure_ascii=False))

if __name__=="__main__":
    main()
