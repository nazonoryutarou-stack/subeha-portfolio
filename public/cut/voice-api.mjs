/** VOICEVOX-compatible HTTP client; no bundled engine, voices or third-party API keys. */
export const VOICEVOX_DEFAULT='http://127.0.0.1:50021';
export const PROHIBITED_RELIGIOUS=new Set(['ずんだもん','東北ずん子','東北きりたん','東北イタコ','四国めたん','九州そら','中国うさぎ','中部つるぎ','あんこもん']);
export const VOICE_LICENSE_URL='https://www.zunko.jp/con_ongen_kiyaku.html';
export const AQUESTALK_LICENSE_URL='https://atpw.a-quest.com/howto.html';
export function validateEngineURL(value){
 let u;try{u=new URL(String(value||'').trim());}catch{throw Error('音声エンジンのURLが不正です');}
 if(u.username||u.password||u.search||u.hash)throw Error('認証情報や検索文字列のないURLを指定してください');
 if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)))throw Error('HTTPSまたは自分の端末のlocalhostを指定してください');
 return u.origin+u.pathname.replace(/\/+$/,'');
}
export function voiceTermsFor(name,purpose='general'){
 const n=String(name||'').trim();if(purpose==='religious'&&PROHIBITED_RELIGIOUS.has(n))return {allowed:false,reason:`${n}の音声は宗教活動・政治活動への利用が禁止されています。`,credit:`VOICEVOX:${n}`};
 return {allowed:true,reason:'声の種類によって利用規約が異なります。公開・商用利用前に個別に確認してください。',credit:`VOICEVOX:${n||'音声'}`};
}
export function flattenSpeakers(data){if(!Array.isArray(data))throw Error('話者一覧を取得できません');return data.flatMap(s=>(s.styles||[]).filter(st=>Number.isInteger(st.id)).map(st=>({name:String(s.name||''),style:String(st.name||''),id:st.id,uuid:String(s.speaker_uuid||'')}))).slice(0,250);}
function route(base,path,params={}){const u=new URL(validateEngineURL(base)+path);for(const [k,v] of Object.entries(params))u.searchParams.set(k,String(v));return u.toString();}
export async function getVoiceSpeakers(base=VOICEVOX_DEFAULT,{request=fetch,signal}={}){
 const res=await request(route(base,'/speakers'),{signal});if(!res.ok)throw Error('音声エンジンに接続できません（'+res.status+'）');return flattenSpeakers(await res.json());
}
export async function synthesizeVoice({base=VOICEVOX_DEFAULT,text,speakerId,speed=1,pitch=0,intonation=1,purpose='general',speakerName='',request=fetch,signal}={}){
 text=String(text||'').trim();if(!text||text.length>1000)throw Error('台本は1〜1000文字で入力してください');
 if(!Number.isInteger(Number(speakerId))||Number(speakerId)<0)throw Error('音声を選択してください');
 const terms=voiceTermsFor(speakerName,purpose);if(!terms.allowed)throw Error(terms.reason);
 const r=await request(route(base,'/audio_query',{speaker:speakerId,text}),{method:'POST',signal});
 if(!r.ok)throw Error('台本を音声データに変換できません（'+r.status+'）');
 const query=await r.json();if(!query||typeof query!=='object'||Array.isArray(query))throw Error('音声の設定が壊れています');
 query.speedScale=Math.min(2,Math.max(.5,Number(speed)||1));query.pitchScale=Math.min(.15,Math.max(-.15,Number(pitch)||0));query.intonationScale=Math.min(2,Math.max(.1,Number(intonation)||1));
 const out=await request(route(base,'/synthesis',{speaker:speakerId}),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(query),signal});
 if(!out.ok)throw Error('音声を生成できません（'+out.status+'）');
 const blob=await out.blob();if(blob.size<44||blob.size>30*1024*1024)throw Error('音声ファイルのサイズが不正です');
 const head=new Uint8Array(await blob.slice(0,12).arrayBuffer());
 const marker=(start,len)=>String.fromCharCode(...head.subarray(start,start+len));
 if(marker(0,4)!=='RIFF'||marker(8,4)!=='WAVE')throw Error('音声エンジンがWAV以外を返しました');
 return {blob:new Blob([blob],{type:'audio/wav'}),credit:terms.credit,licenseUrl:VOICE_LICENSE_URL,speakerName};
}
