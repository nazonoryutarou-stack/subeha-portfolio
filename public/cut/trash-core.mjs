/* Project-level deletion and hit testing. No media blobs are removed. */
export const TYPES=Object.freeze({clip:'clips',layer:'overlays',audio:'audioTracks',text:'texts',caption:'captions',cg:'cgScenes'});
export const JP_TYPES=Object.freeze({clip:'動画・写真',layer:'重ねた素材',audio:'音声',text:'文字',caption:'字幕',cg:'3D映像'});
export function insideDropZone(point,rect,margin=14){
  return !!point && !!rect && Number.isFinite(point.x)&&Number.isFinite(point.y) && point.x>=rect.left-margin && point.x<=rect.right+margin && point.y>=rect.top-margin && point.y<=rect.bottom+margin;
}
export function removeProjectItem(project,kind,id){
  const key=TYPES[kind];if(!key||typeof id!=='string'||!Array.isArray(project[key]))return null;
  const index=project[key].findIndex(item=>item.id===id);
  if(index<0)return null;
  const [removed]=project[key].splice(index,1);
  return {kind,index,removed};
}
