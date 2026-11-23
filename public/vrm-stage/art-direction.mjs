/* Workspace navigation and two art-direction studies. No framework or network dependencies. */
const WORKSPACES = Object.freeze(['pose', 'face', 'scene', 'material']);
const SKINS = Object.freeze(['console', 'gallery']);
const KEY = 'vrm-stage-art-direction-v1';

function loadPreferences(){
 try {
  const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
  return saved && typeof saved === 'object' ? saved : {};
 } catch { return {}; }
}
function savePreferences(){
 try { localStorage.setItem(KEY, JSON.stringify({
  workspace:document.querySelector('.work-area')?.dataset.workspace,
  skin:document.body.dataset.skin
 })); } catch { /* Private browsing/storage disabled: choices stay in this tab. */ }
}
function bootArtDirection(){
 const panel = document.querySelector('.work-area');
 const selector = document.getElementById('visual-skin');
 const buttons = [...document.querySelectorAll('[data-workspace-button]')];
 if(!panel || !selector || buttons.length !== 4)return;

 const preferences = loadPreferences();
 const chooseWorkspace = workspace => {
  if(!WORKSPACES.includes(workspace))return;
  panel.dataset.workspace = workspace;
  for(const button of buttons){
   const active = button.dataset.workspaceButton === workspace;
   button.setAttribute('aria-pressed',String(active));
   button.classList.toggle('current',active);
  }
  savePreferences();
 };
 const chooseSkin = skin => {
  if(!SKINS.includes(skin))return;
  document.body.dataset.skin = skin;
  selector.value = skin;
  savePreferences();
 };
 buttons.forEach(button=>button.addEventListener('click',()=>chooseWorkspace(button.dataset.workspaceButton)));
 selector.addEventListener('change',()=>chooseSkin(selector.value));
 chooseSkin(SKINS.includes(preferences.skin)?preferences.skin:'console');
 chooseWorkspace(WORKSPACES.includes(preferences.workspace)?preferences.workspace:'pose');

 const header = document.querySelector('.apphead');
 if(header){
  const updateHeaderHeight = () => document.documentElement.style.setProperty('--apphead-height', Math.ceil(header.getBoundingClientRect().height)+'px');
  updateHeaderHeight();
  if(typeof ResizeObserver!=='undefined'){
   const observer = new ResizeObserver(updateHeaderHeight);
   observer.observe(header);
  }else window.addEventListener('resize',updateHeaderHeight,{passive:true});
 }
}
bootArtDirection();
