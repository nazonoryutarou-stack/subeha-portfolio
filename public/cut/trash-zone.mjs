/* Shared touch-friendly drag-to-trash workflow. Undo uses the editor's project history. */
import {insideDropZone,removeProjectItem,JP_TYPES} from './trash-core.mjs';
export function installTrashZone(api){
  if(window.__subehaTrash)return window.__subehaTrash;
  const bin=document.createElement('div');bin.id='cut-trash-bin';bin.setAttribute('role','status');
  bin.setAttribute('aria-live','polite');
  bin.innerHTML='<span class="cut-trash-icon" aria-hidden="true">▤</span><strong>ここへ入れて削除</strong><small>指を離すと削除 · 元に戻せます</small>';
  const ghost=document.createElement('div');ghost.id='cut-trash-ghost';ghost.setAttribute('aria-hidden','true');
  const undo=document.createElement('div');undo.id='cut-trash-undo';undo.hidden=true;
  undo.innerHTML='<span>ゴミ箱へ移動しました</span><button type="button" id="cut-trash-restore">元に戻す</button>';
  document.body.append(bin,ghost,undo);
  let item=null,hover=false,undoTimer=0;
  function deactivate(){item=null;hover=false;bin.classList.remove('active','over');ghost.classList.remove('active');document.body.classList.remove('cut-discarding');}
  function begin(kind,id,e){if(!api||api.state.recording||!JP_TYPES[kind]||!id)return false;
    if(item&&(item.kind!==kind||item.id!==id))deactivate();
    item={kind,id};bin.classList.add('active');ghost.textContent='✥ '+JP_TYPES[kind];ghost.classList.add('active');
    document.body.classList.add('cut-discarding');move(e);return true;
  }
  function move(e){if(!item||!e)return false;
    const x=Number(e.clientX),y=Number(e.clientY);if(!Number.isFinite(x)||!Number.isFinite(y))return false;
    ghost.style.left=(x+13)+'px';ghost.style.top=(y-21)+'px';
    hover=insideDropZone({x,y},bin.getBoundingClientRect());
    bin.classList.toggle('over',hover);return hover;
  }
  function finish(e){if(!item)return false;
    const armed={...item};const hit=move(e);deactivate();if(!hit)return false;
    const previous=removeProjectItem(api.state.project,armed.kind,armed.id);if(!previous)return false;
    if(armed.kind==='clip'){
      if(api.state.selectedClip===armed.id)api.state.selectedClip=api.state.project.clips[previous.index]?.id||api.state.project.clips[previous.index-1]?.id||null;
      api.state.current=Math.min(api.state.current,api.duration?.(api.state.project.clips)??0);
    }
    if(armed.kind==='text'&&api.state.selectedText===armed.id)api.state.selectedText=null;
    if(armed.kind==='layer')window.__subehaSelectLayer?.(null);
    api.save();api.refreshAll();api.draw();
    if(undoTimer)clearTimeout(undoTimer);
    undo.hidden=false;undoTimer=setTimeout(()=>{undo.hidden=true;},8500);
    navigator.vibrate?.(20);
    return true;
  }
  function cancel(){deactivate();}
  undo.querySelector('button').onclick=()=>{clearTimeout(undoTimer);undo.hidden=true;api.undo();api.toast?.('削除を元に戻しました');};
  window.addEventListener('blur',cancel);
  window.__subehaTrash={begin,move,finish,cancel,active:()=>!!item,bin};
  return window.__subehaTrash;
}
