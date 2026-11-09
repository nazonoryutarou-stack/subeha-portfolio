/* Browser recorder settings. Frame rate and bitrate are requests, not hardware guarantees. */
export const EXPORT_PRESETS=Object.freeze({
  compact:{label:'軽量',fps:24,videoBitsPerSecond:1800000},
  standard:{label:'標準',fps:30,videoBitsPerSecond:4500000},
  high:{label:'高画質',fps:30,videoBitsPerSecond:9000000},
  smooth:{label:'滑らか',fps:60,videoBitsPerSecond:9000000}
});
export const RECORDER_TYPES=Object.freeze([
 'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
 'video/mp4',
 'video/webm;codecs=vp9,opus',
 'video/webm;codecs=vp8,opus',
 'video/webm'
]);
export function normalizeExportSettings(value={}){
 const key=value&&typeof value==='object'?value.preset:null;
 const preset=Object.hasOwn(EXPORT_PRESETS,key)?key:'standard';
 return {preset,...EXPORT_PRESETS[preset],format:['auto','mp4','webm'].includes(value?.format)?value.format:'auto',audioBitsPerSecond:128000};
}
export function supportedRecorderType(recorder,format='auto'){
 if(!recorder||typeof recorder.isTypeSupported!=='function')return null;
 const preferred=format==='webm'?[...RECORDER_TYPES].reverse():RECORDER_TYPES;
 return preferred.find(t=>recorder.isTypeSupported(t))||null;
}
export function estimateBytes(seconds,settings){
 const s=normalizeExportSettings(settings);
 return Math.max(0,Number(seconds)||0)*(s.videoBitsPerSecond+s.audioBitsPerSecond)/8;
}
export function exportWarnings({seconds,clips=[],assets=[],fps=30}){
 const warnings=[];
 if(seconds>180)warnings.push('3分を超える動画はモバイルブラウザで書き出しが停止する恐れがあります');
 if(clips.some(c=>c.reverse))warnings.push('逆再生クリップは端末によりコマ落ち・重複フレームが起こります');
 if(clips.some(c=>c.transitionIn?.type&&c.transitionIn.type!=='none'))warnings.push('場面転換は2本同時デコードのため低速端末ではコマ落ちが起こります');
 if(fps===60)warnings.push('60fpsは要求値です。MediaRecorderが実際に60fpsを出力する保証はありません');
 if(assets.some(a=>a.type==='video'&&a.width*a.height>3840*2160))warnings.push('8K等の高解像度素材はメモリ不足の恐れがあります');
 return warnings;
}
