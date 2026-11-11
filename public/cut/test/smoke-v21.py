import asyncio, importlib.util, io, math, struct, wave, json, zipfile
from pathlib import Path
from PIL import Image
from playwright.async_api import async_playwright
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('inline', str(root/'test/smoke-inline.py'))
inline=importlib.util.module_from_spec(spec);spec.loader.exec_module(inline)

def sound():
 b=io.BytesIO()
 with wave.open(b,'wb') as w:
  w.setnchannels(1);w.setsampwidth(2);w.setframerate(24000)
  data=b''.join(struct.pack('<h',int(math.sin(i*2*math.pi*440/24000)*8000)) for i in range(24000))
  w.writeframes(data)
 return b.getvalue()
def vrm():
 j={'asset':{'version':'2.0'},'buffers':[{'byteLength':44}],
 'bufferViews':[{'buffer':0,'byteOffset':0,'byteLength':36},{'buffer':0,'byteOffset':36,'byteLength':6}],
 'accessors':[{'bufferView':0,'componentType':5126,'type':'VEC3','count':3},{'bufferView':1,'componentType':5123,'type':'SCALAR','count':3}],
 'meshes':[{'primitives':[{'attributes':{'POSITION':0},'indices':1}]}],
 'nodes':[{'mesh':0}],'scenes':[{'nodes':[0]}],'scene':0,
 'extensions':{'VRMC_vrm':{'meta':{'name':'テスト用VRM','authors':['example'], 'commercialUsage':'personalProfit','allowPoliticalOrReligiousUsage':False}}}}
 text=json.dumps(j,ensure_ascii=False,separators=(',',':')).encode();text+=b' ' * ((4-len(text)%4)%4)
 binary=struct.pack('<9f',0,0,0,1,0,0,0,1,0)+struct.pack('<3H',0,1,2)+b'\0\0'
 size=12+8+len(text)+8+len(binary)
 return struct.pack('<III',0x46546c67,2,size)+struct.pack('<II',len(text),0x4e4f534a)+text+struct.pack('<II',len(binary),0x004e4942)+binary

async def main():
 with io.BytesIO() as b:
  Image.new('RGB',(350,540),(12,44,65)).save(b,'PNG');png=b.getvalue()
 wav=sound()
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
  context=await browser.new_context(viewport={'width':420,'height':933},is_mobile=True,has_touch=True,service_workers='block')
  page=await context.new_page();errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
  async def api(route):
   u=route.request.url
   if '/speakers' in u: await route.fulfill(json=[{'name':'ずんだもん','styles':[{'name':'ノーマル','id':3}]},{'name':'テスト声','styles':[{'name':'通常','id':30}]}],headers={'Access-Control-Allow-Origin':'*'})
   elif '/audio_query' in u:await route.fulfill(json={'speedScale':1,'pitchScale':0},headers={'Access-Control-Allow-Origin':'*'})
   elif '/synthesis' in u:await route.fulfill(body=wav,content_type='audio/wav',headers={'Access-Control-Allow-Origin':'*'})
   else:await route.fulfill(status=404)
  await page.route('https://voice.test/**',api)
  await page.set_content(inline.build_html(),wait_until='load',timeout=30000)
  await page.wait_for_timeout(1000)
  await page.locator('#file-picker').set_input_files({'name':'base.png','mimeType':'image/png','buffer':png})
  await page.wait_for_timeout(550)
  assert await page.evaluate('window.__subehaCut.state.project.clips.length')==1
  await page.evaluate('window.__subehaVoiceOpen()')
  await page.locator('#voice-endpoint').fill('https://voice.test')
  await page.locator('#voice-connect').click()
  await page.wait_for_function("document.querySelectorAll('#voice-style option').length>1",timeout=10000)
  await page.locator('#voice-style').select_option('3')
  await page.locator('#voice-purpose').select_option('religious')
  await page.locator('#voice-script').fill('ここは宗教団体の紹介です')
  await page.locator('#voice-generate').click();await page.wait_for_timeout(130)
  assert '禁止' in await page.locator('#voice-status').inner_text()
  await page.locator('#voice-purpose').select_option('general')
  await page.locator('#voice-generate').click()
  await page.wait_for_function("document.querySelector('#voice-append')?.disabled===false || document.querySelector('#voice-status')?.textContent.includes('失敗')",timeout=18000)
  assert not await page.locator('#voice-append').is_disabled(),await page.locator('#voice-status').inner_text()
  await page.screenshot(path=str(root/'test/v20-voice.png'))
  await page.locator('#voice-append').click();await page.wait_for_timeout(400)
  state=await page.evaluate('''() => ({tracks:window.__subehaCut.state.project.audioTracks.length,credits:window.__subehaCut.state.project.voiceCredits||[]})''')
  assert state['tracks']>=1,state
  assert state['credits'] and state['credits'][0]['credit']=='VOICEVOX:ずんだもん',state
  caption_info=await page.evaluate('''() => ({cues:window.__subehaCut.state.project.captions,track:window.__subehaCut.state.project.audioTracks[0]})''')
  assert caption_info['cues'], 'generated voice should add editable captions'
  assert caption_info['cues'][0]['start'] >= caption_info['track']['start']
  assert caption_info['cues'][0]['end'] <= caption_info['track']['start']+caption_info['track']['duration']
  print('CAPTIONS',caption_info['cues'])
  await page.locator('#voice-close').click()
  await page.evaluate('window.__subehaCGOpen()')
  await page.locator('#cg-obj-picker').set_input_files({'name':'licence-test.vrm','mimeType':'application/octet-stream','buffer':vrm()})
  await page.wait_for_timeout(450)
  num=await page.evaluate('window.__subehaCut.state.project.cgScenes.length')
  assert num==1, ('CG scenes',num)
  rights=await page.evaluate('window.__subehaCut.state.project.cgScenes[0].modelRights')
  assert rights['religious']=='不可', rights
  assert '宗教・政治用途：不可' in await page.locator('#pro-content').inner_text()
  link=await page.evaluate('''() => {const a=window.__subehaCut;return {supported:window.__subehaLinkVoiceToCG(a.state.project.audioTracks[0].assetId),scene:a.state.project.cgScenes[0]};}''')
  assert not link['supported'], 'fixture has no morph target so UI must not claim working lip sync'
  assert link['scene']['lipEnabled'] and link['scene']['lipSyncAssetId']
  await page.locator('#cg-touch').click()
  print('TOUCH ACTIVE',await page.evaluate('window.__subehaCGTouchActive'), 'CANVAS',await page.evaluate('document.querySelector("#preview").getBoundingClientRect().toJSON()'))
  before=await page.evaluate('window.__subehaCut.state.project.cgScenes[0].x')
  await page.evaluate('''() => {const c=document.querySelector('#preview');const r=c.getBoundingClientRect(),x=r.left+r.width*.45,y=r.top+r.height*.45;const evt=(type,dx)=>c.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:14,isPrimary:true,pointerType:'touch',clientX:x+dx,clientY:y}));evt('pointerdown',0);evt('pointermove',70);evt('pointerup',70);}''')
  moved=await page.evaluate('window.__subehaCut.state.project.cgScenes[0].x')
  print('TOUCH AFTER',await page.evaluate('window.__subehaCGTouchActive'),'MOVED',moved,'EVENTS',await page.evaluate('[window.__subehaCGDown,window.__subehaCGMove]'))
  assert moved>before, f'CG should be movable with a finger: {before} -> {moved}'
  print('3D TOUCH',before,moved)
  # DevTools dispatches genuine touch input rather than synthetic PointerEvents.
  cdp=await context.new_cdp_session(page)
  await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':180,'y':230,'id':1}]})
  await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':230,'y':230,'id':1}]})
  await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
  await page.wait_for_timeout(100)
  afterTouch=await page.evaluate('window.__subehaCut.state.project.cgScenes[0].x')
  assert afterTouch>moved, 'Real touch gesture should move the 3D scene'
  print('REAL TOUCH',moved,afterTouch)
  # Project archive must preserve the narration media, editable subtitle cues, and VRM audio link.
  async with page.expect_download(timeout=20000) as dl:
   await page.evaluate('window.__subehaArchiveSave()')
  archive=await dl.value;archive_path=root/'test/v21-project.subecut';await archive.save_as(archive_path)
  with zipfile.ZipFile(archive_path) as z:
   manifest=json.loads(z.read('project.json'))
   assert manifest['project']['captions'], 'Subtitles lost in archive'
   assert manifest['project']['cgScenes'][0]['lipSyncAssetId'], 'Lip-sync link lost in archive'
   assert any(x['type']=='model' for x in manifest['assets'])
   assert any(x['type']=='audio' for x in manifest['assets'])
  print('ARCHIVE',archive_path.stat().st_size,len(manifest['assets']))
  ids_before=await page.evaluate('''() => ({voice:window.__subehaCut.state.project.audioTracks[0].assetId,model:window.__subehaCut.state.project.cgScenes[0].modelAssetId})''')
  await page.evaluate('window.confirm=()=>true')
  await page.locator('#pro-project-picker').set_input_files(str(archive_path))
  await page.wait_for_function('''(old) => window.__subehaCut.state.project.audioTracks[0]?.assetId!==old''',arg=ids_before['voice'],timeout=14000)
  ids_after=await page.evaluate('''() => ({voice:window.__subehaCut.state.project.audioTracks[0].assetId,model:window.__subehaCut.state.project.cgScenes[0].modelAssetId,lip:window.__subehaCut.state.project.cgScenes[0].lipSyncAssetId,cues:window.__subehaCut.state.project.captions.length})''')
  assert ids_after['voice']!=ids_before['voice'] and ids_after['model']!=ids_before['model']
  assert ids_after['lip']==ids_after['voice'], 'Restored lip sync must refer to restored WAV asset'
  assert ids_after['cues']>=1
  print('RESTORED',ids_after)
  await page.screenshot(path=str(root/'test/v21-editor.png'),full_page=True)
  await page.evaluate('''() => {const a=window.__subehaCut;a.state.project.clips[0].end=1.25;a.state.project.cgScenes[0].duration=1.25;a.save();a.seek(0);}''')
  async with page.expect_download(timeout=22000) as result:
   await page.locator('#export-secondary').evaluate('(el)=>el.click()')
  output=await result.value;target=root/'test/v21-export.mp4' if output.suggested_filename.endswith('.mp4') else root/'test/v21-export.webm'
  await output.save_as(target)
  assert target.stat().st_size>3000,'Rendered file was too small'
  print('RENDERED',target.name,target.stat().st_size)
  await page.screenshot(path=str(root/'test/v20-vrm.png'))
  await page.evaluate('window.__subehaStockOpen()')
  await page.locator('#stock-kind').select_option('vrm')
  await page.locator('#stock-form button[type=submit]').click()
  assert await page.locator('#stock-catalog-links a').count()>=1
  assert 'VRoid' in await page.locator('#stock-catalog-links').inner_text()
  await page.screenshot(path=str(root/'test/v20-library.png'))
  print('PASS mocked narration synthesis + editable captions + 3D link + direct drag + license checks')
  print('JS ERRORS',errors[:6]);assert not errors,errors
  await browser.close()
if __name__=='__main__':asyncio.run(main())
