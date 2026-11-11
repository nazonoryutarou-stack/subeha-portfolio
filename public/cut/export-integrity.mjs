/* Inspect encoded output instead of trusting MediaRecorder's requested MIME.
 * This is a lightweight signature check, NOT full codec validation or transcoding.
 */
const letters = data => new TextDecoder('latin1').decode(data);
const EBML = [0x1a,0x45,0xdf,0xa3];
const formatFromBytes = bytes => {
 if(bytes.length >= 8 && letters(bytes.subarray(4,8)) === 'ftyp') return 'mp4';
 if(bytes.length >= 4 && EBML.every((b,i)=>bytes[i]===b))return 'webm';
 return null;
};
export function sniffEncodedBytes(firstBytes, extraBytes=new Uint8Array(), requestedMime=''){
 const first=firstBytes instanceof Uint8Array?firstBytes:new Uint8Array(firstBytes||[]);
 const end=extraBytes instanceof Uint8Array?extraBytes:new Uint8Array(extraBytes||[]);
 const container=formatFromBytes(first);
 const claimed=String(requestedMime).toLowerCase().includes('webm')?'webm':'mp4';
 const chosen=container||claimed;
 const text=(letters(first)+' '+letters(end));
 const matches=(keys)=>keys.some(k=>text.includes(k));
 let video='不明',audio='不明';
 if(matches(['avc1','avc3','V_MPEG4/ISO/AVC']))video='H.264';
 else if(matches(['hvc1','hev1','V_MPEGH/ISO/HEVC']))video='HEVC';
 else if(matches(['vp09','V_VP9','VP90']))video='VP9';
 else if(matches(['vp08','V_VP8','VP80']))video='VP8';
 else if(matches(['av01','V_AV1']))video='AV1';
 if(matches(['mp4a','A_AAC']))audio='AAC';
 else if(matches(['Opus','A_OPUS']))audio='Opus';
 else if(matches(['vorbis','A_VORBIS']))audio='Vorbis';
 return {
   container:chosen,detectedContainer:container,video,audio,extension:chosen,
   universallyCompatible:container==='mp4'&&video==='H.264'&&(audio==='AAC'||audio==='不明'),
   mimeMismatch:!!container&&container!==claimed,
 };
}
export async function inspectEncodedBlob(blob,recorderMime=''){
 if(!blob||typeof blob.slice!=='function')throw new Error('書き出したファイルがありません');
 const window=256*1024;
 const start=new Uint8Array(await blob.slice(0,Math.min(blob.size,window)).arrayBuffer());
 const end=blob.size>window?new Uint8Array(await blob.slice(Math.max(window,blob.size-window),blob.size).arrayBuffer()):new Uint8Array();
 return sniffEncodedBytes(start,end,recorderMime||blob.type);
}
export function exportNotice(info,requestedFormat='auto'){
 if(info.detectedContainer===null)return '動画の内部形式を確認できませんでした。再生できるか保存後に確かめてください。';
 if(info.container==='mp4'&&!info.universallyCompatible)return `MP4ファイルの中身は映像 ${info.video}／音声 ${info.audio}。端末やSNSによっては再生できません。`;
 if(info.container==='webm'&&requestedFormat==='mp4')return 'この端末ではMP4を書き出せずWebMで保存しました。';
 if(info.container==='webm')return 'WebM形式で保存しました。対応していないアプリでは再生できない場合があります。';
 return '動画の保存が完了しました。';
}
