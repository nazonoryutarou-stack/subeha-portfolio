import asyncio, importlib.util, io, math, struct, wave, json
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
  await page.locator('#voice-close').click()
  await page.evaluate('window.__subehaCGOpen()')
  await page.locator('#cg-obj-picker').set_input_files({'name':'licence-test.vrm','mimeType':'application/octet-stream','buffer':vrm()})
  await page.wait_for_timeout(450)
  num=await page.evaluate('window.__subehaCut.state.project.cgScenes.length')
  assert num==1, ('CG scenes',num)
  rights=await page.evaluate('window.__subehaCut.state.project.cgScenes[0].modelRights')
  assert rights['religious']=='不可', rights
  assert '宗教・政治用途：不可' in await page.locator('#pro-content').inner_text()
  await page.screenshot(path=str(root/'test/v20-vrm.png'))
  await page.evaluate('window.__subehaStockOpen()')
  await page.locator('#stock-kind').select_option('vrm')
  await page.locator('#stock-form button[type=submit]').click()
  assert await page.locator('#stock-catalog-links a').count()>=1
  assert 'VRoid' in await page.locator('#stock-catalog-links').inner_text()
  await page.screenshot(path=str(root/'test/v20-library.png'))
  print('PASS mocked voice synthesis, timeline import & credit, religious restriction, VRM metadata, library')
  print('JS ERRORS',errors[:6]);assert not errors,errors
  await browser.close()
if __name__=='__main__':asyncio.run(main())
