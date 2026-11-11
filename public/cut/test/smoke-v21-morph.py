import asyncio,importlib.util,json,struct,io,wave,math
from pathlib import Path
from playwright.async_api import async_playwright
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('inline',str(root/'test/smoke-inline.py'))
inline=importlib.util.module_from_spec(spec);spec.loader.exec_module(inline)
def vrm():
 doc={'asset':{'version':'2.0'},'buffers':[{'byteLength':80}],
 'bufferViews':[{'buffer':0,'byteOffset':0,'byteLength':36},{'buffer':0,'byteOffset':36,'byteLength':6},{'buffer':0,'byteOffset':44,'byteLength':36}],
 'accessors':[{'bufferView':0,'componentType':5126,'type':'VEC3','count':3},{'bufferView':1,'componentType':5123,'type':'SCALAR','count':3},{'bufferView':2,'componentType':5126,'type':'VEC3','count':3}],
 'meshes':[{'primitives':[{'attributes':{'POSITION':0},'indices':1,'targets':[{'POSITION':2}]}]}],
 'nodes':[{'mesh':0}],'scenes':[{'nodes':[0]}],'scene':0,
 'extensions':{'VRMC_vrm':{'meta':{'name':'test','authors':['test'],'allowPoliticalOrReligiousUsage':True},'expressions':{'preset':{'aa':{'morphTargetBinds':[{'node':0,'index':0,'weight':1}]}}}}}}
 text=json.dumps(doc,separators=(',',':')).encode();text+=b' '*((-len(text))%4)
 base=struct.pack('<9f',0,0,0,1,0,0,0,1,0)+struct.pack('<3H',0,1,2)+b'\0\0'
 morph=struct.pack('<9f',0,0,0,.35,0,0,0,-.8,0)
 body=base+morph
 assert len(body)==80
 size=12+8+len(text)+8+len(body)
 return struct.pack('<III',0x46546c67,2,size)+struct.pack('<II',len(text),0x4e4f534a)+text+struct.pack('<II',len(body),0x004e4942)+body
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
  context=await b.new_context(viewport={'width':420,'height':933},is_mobile=True,has_touch=True)
  page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.set_content(inline.build_html(),wait_until='load',timeout=30000);await page.wait_for_timeout(800)
  await page.evaluate('window.__subehaCGOpen()')
  await page.locator('#cg-obj-picker').set_input_files({'name':'morph.vrm','mimeType':'application/octet-stream','buffer':vrm()})
  await page.wait_for_function('window.__subehaCut.state.project.cgScenes.length===1',timeout=15000)
  await page.wait_for_timeout(1200)
  data=await page.evaluate('''() => {const a=window.__subehaCut,s=a.state.project.cgScenes[0],r=window.__subehaCGAPI.getRenderer();const one=r.render(s,s.modelAssetId,0,720,1280,{mouthOpen:0})?.toDataURL()||'';const two=r.render(s,s.modelAssetId,0,720,1280,{mouthOpen:1})?.toDataURL()||'';return {backend:r.backend||'WebGL',oneLength:one.length,twoLength:two.length,changed:one!==two,scene:s.id};}''')
  print('MORPH RENDER',data)
  assert data['oneLength']>1000 and data['twoLength']>1000 and data['changed'],data
  # Audio-to-morph render path: silence first half, tone in the second half.
  buf=io.BytesIO()
  with wave.open(buf,'wb') as w:
   w.setnchannels(1);w.setsampwidth(2);w.setframerate(16000)
   samples=[0 if i<8000 else int(math.sin(i*2*math.pi*250/16000)*19000) for i in range(16000)]
   w.writeframes(b''.join(struct.pack('<h',x) for x in samples))
  await page.locator('#pro-audio-picker').set_input_files({'name':'lip.wav','mimeType':'audio/wav','buffer':buf.getvalue()})
  await page.wait_for_function('window.__subehaCut.state.project.audioTracks.length===1',timeout=9000)
  await page.evaluate('''() => {const a=window.__subehaCut,s=a.state.project.cgScenes[0];s.motion='static';s.lipEnabled=true;window.__subehaLinkVoiceToCG(a.state.project.audioTracks[0].assetId);}''')
  await page.wait_for_timeout(450)
  frames=await page.evaluate('''() => {const a=window.__subehaCut;a.state.current=.12;a.draw();const one=a.canvas.toDataURL();a.state.current=.72;a.draw();const two=a.canvas.toDataURL();return {different:one!==two,one:one.length,two:two.length};}''')
  print('WAV-DRIVEN 3D PREVIEW',frames)
  assert frames['one']>2000 and frames['different'],frames
  assert not errors,errors
  await b.close()
if __name__=='__main__':asyncio.run(main())
