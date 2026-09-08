import * as THREE from './vendor/three.module.min.js';

// The original canvas concrete/paper/sign technique, now seeded and shared.
// Wear lives in small textures; it doesn't create another mesh for every stain.
export function random(seed = 404) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const cache = new Map();
export function canvasMap(key, w, h, draw) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 2; cache.set(key, t); return t;
}
export function surface(kind, bg, seed = 4) {
  const map = canvasMap(kind + bg, 256, 256, (g, w, h) => {
    const r = random(seed); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    if (kind === 'tile' || kind === 'brick' || kind === 'floor') {
      const tw = kind === 'brick' ? 64 : 32, th = kind === 'brick' ? 24 : 32;
      g.fillStyle = '#33332b'; g.fillRect(0, 0, w, h);
      for (let y = -th; y < h; y += th) for (let x = -tw; x < w; x += tw) {
        const xx = x + (kind === 'brick' && (y / th) % 2 ? tw / 2 : 0);
        g.fillStyle = bg; g.fillRect(xx + 1, y + 1, tw - 2, th - 2);
        g.fillStyle = `rgba(${r() > .4 ? '16,13,10' : '220,219,192'},${r() * .24})`;
        g.fillRect(xx + 1, y + 1, tw - 2, th - 2);
        if (r() < .04) { g.fillStyle = '#656158'; g.fillRect(xx + 2, y + 3, tw - 5, th - 5); }
      }
    }
    if (kind === 'wood') for (let i = 0; i < 220; i++) {
      g.strokeStyle = `rgba(${i % 3 ? '2,1,0' : '179,139,90'},${.03 + r() * .17})`;
      const x = r() * w; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + r()*8, 70, x-r()*10, 185, x, h); g.stroke();
      if (i % 35 === 0) { g.fillStyle = '#100e0b'; g.fillRect(i, 0, 2, h); }
    }
    if (kind === 'shutter' || kind === 'roof') for (let y = 0; y < h; y += kind === 'roof' ? 16 : 10) {
      g.fillStyle = '#15191766'; g.fillRect(0, y, w, 2);
      g.fillStyle = '#dadbc62a'; g.fillRect(0, y + 2, w, 2);
    }
    for (let i = 0; i < 2200; i++) {
      g.fillStyle = `rgba(${r() > .5 ? '15,12,9' : '219,214,194'},${.018+r()*.10})`;
      g.fillRect(r()*w, r()*h, .4+r()*4, .4+r()*2);
    }
    // Rain starts at joints; rust runs down rather than being evenly sprinkled.
    for (let i = 0; i < 16; i++) {
      const x = r()*w, y = r()*h*.42, len = 15+r()*175;
      const stain = g.createLinearGradient(x,y,x,y+len);
      stain.addColorStop(0, kind === 'metal' || kind === 'shutter' ? '#5b2c1678' : '#181b1470'); stain.addColorStop(1,'#24261b00');
      g.fillStyle = stain; g.fillRect(x,y,2+r()*16,len);
    }
    if (kind === 'concrete' || kind === 'plaster') {
      g.fillStyle = '#777467'; g.fillRect(166, 34, 64, 81);
      g.strokeStyle = '#24262165'; g.lineWidth = .8;
      for (let i = 0; i < 6; i++) {
        let x = r()*w,y = r()*h; g.beginPath(); g.moveTo(x,y);
        for (let k=0;k<6;k++) {x += r()*22-10; y+=r()*25; g.lineTo(x,y);} g.stroke();
      }
    }
    const damp = g.createLinearGradient(0, 180, 0, 256); damp.addColorStop(0,'#171b1600'); damp.addColorStop(1,'#151b1870');
    g.fillStyle = damp; g.fillRect(0,180,256,76);
  });
  return new THREE.MeshLambertMaterial({ map, color: 0xffffff });
}
export function sign(text, { bg = '#28231b', fg = '#d0c4a0', sub = '', vertical = false, faded = false } = {}) {
  return canvasMap(JSON.stringify([text,bg,fg,sub,vertical,faded]), vertical ? 256 : 768, vertical ? 768 : 256, (g,w,h) => {
    const r = random(text.charCodeAt(0)); g.fillStyle=bg; g.fillRect(0,0,w,h);
    g.strokeStyle='#ded1aa33'; g.lineWidth=2; g.strokeRect(12,12,w-24,h-24);
    g.fillStyle=fg; g.textAlign='center'; g.textBaseline='middle';
    if (vertical) {
      g.font=`700 ${Math.min(135,560/text.length)}px "Yu Mincho", "Noto Serif CJK JP", serif`;
      [...text].forEach((c,i)=>g.fillText(c,w/2,90+i*(h-150)/text.length));
    } else {
      g.font=`700 ${Math.min(110,640/Math.max(text.length,1))}px "Yu Mincho", "Noto Serif CJK JP", serif`;
      g.fillText(text,w/2,sub?109:126,w-65);
      if(sub) {g.font='26px "Noto Sans CJK JP", sans-serif';g.fillText(sub,w/2,205,w-60);}
    }
    for(let i=0;i<450;i++) {g.fillStyle=`rgba(14,12,8,${r()*(faded?.7:.3)})`;g.fillRect(r()*w,r()*h,2+r()*24,1+r()*4);}
    if(faded){g.fillStyle=bg+'b0';g.fillRect(w*.34,32,w*.18,h-64);}
    g.fillStyle='#15140d88';for(const x of [18,w-18])for(const y of [18,h-18])g.fillRect(x-3,y-3,6,6);
  });
}
export const shadowMap = () => canvasMap('contact-shadow',64,64,(g,w,h)=>{
  const a=g.createRadialGradient(32,32,0,32,32,32);a.addColorStop(0,'#000000ab');a.addColorStop(.5,'#00000065');a.addColorStop(1,'#00000000');g.fillStyle=a;g.fillRect(0,0,w,h);
});

// Exact sample and bit geometry from /imoji-lab/app.html v0.8. No invented glyphs.
export function readingCard(revealed = false) {
  return canvasMap('reading-'+revealed,320,420,(g,w,h)=>{
    const r=random(91);g.fillStyle='#0d0c09';g.fillRect(0,0,w,h);
    for(let i=0;i<1400;i++){g.fillStyle=`rgba(185,164,110,${r()*.065})`;g.fillRect(r()*w,r()*h,1+r()*9,1);}
    g.strokeStyle='#bd964b';g.fillStyle='#bd964b';g.lineWidth=3;g.lineCap='round';
    if(revealed){g.font='25px serif';g.textAlign='center';g.fillText('ポコペン',160,198);return;}
    const spell=[...'シト、シュウライ'];let raw=spell.length.toString(2).padStart(4,'0');
    for(const c of spell) raw+=(c==='、'?96:c.codePointAt(0)-0x30A0).toString(2).padStart(7,'0');
    raw=raw.padEnd(78,'0');let hash=2166136261>>>0;
    for(const b of new TextEncoder().encode('ポコペン')) {hash^=b;hash=Math.imul(hash,16777619)>>>0;}
    let key='';for(let i=0;i<78;i++){hash^=hash<<13;hash^=hash>>>17;hash^=hash<<5;hash>>>=0;key+=((hash>>>(i%31))&1);}
    const cipher=[...raw].map((b,i)=>b===key[i]?'0':'1').join('');
    const bone=parseInt(cipher.slice(0,6),2);g.save();g.translate(32,38);g.scale(.8,.95);
    const line=(x,y,X,Y)=>{g.beginPath();g.moveTo(x,y);g.lineTo(X,Y);g.stroke();};
    if(bone&32)line(160,42,160,278);else {g.beginPath();g.moveTo(160,42);g.quadraticCurveTo(142,110,160,160);g.quadraticCurveTo(178,220,160,278);g.stroke();}
    if(bone&16)line(142,48,142,270);if(bone&8)line(178,48,178,270);
    if(bone&4)line(125,92,195,92);if(bone&2)line(125,220,195,220);if(bone&1)line(128,160,192,160);
    for(let i=0;i<18;i++){
      const v=parseInt(cipher.slice(6+i*4,10+i*4),2),s=v&2?1:-1,y=48+i*224/17,len=v&8?112:70;
      g.beginPath();g.moveTo(160+s*14,y);
      if(v&4)g.quadraticCurveTo(160+s*len*.56,y-18,160+s*len,y);else g.lineTo(160+s*len,y);g.stroke();
      if(v&1){g.beginPath();g.arc(160+s*(len+8),y,3,0,Math.PI*2);g.fill();}
    }
    g.restore();g.font='18px serif';g.textAlign='center';g.fillText('読み札',160,383);
  });
}
export const textureCount = () => cache.size;
