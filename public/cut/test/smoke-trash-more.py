import asyncio, pathlib, io, importlib.util, wave, math, struct
from PIL import Image
from playwright.async_api import async_playwright
root=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('inlinehelper',root/'test/smoke-inline.py')
helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
async def drag_to_bin(page,css,hold=.55):
 el=page.locator(css).first
 rect=await el.bounding_box();assert rect,css
 x=rect['x']+min(rect['width']/2,35);y=rect['y']+rect['height']/2
 print('TARGET',css,round(x),round(y),await page.evaluate('([x,y]) => document.elementFromPoint(x,y)?.outerHTML.slice(0,180)',[x,y]));await page.mouse.move(x,y);await page.mouse.down();await page.wait_for_timeout(hold*1000)
 if hold==0:await page.mouse.move(x+15,y,steps=3)
 print('AFTER HOLD',await page.evaluate('({active:window.__subehaTrash?.active(),bin:document.querySelector("#cut-trash-bin")?.className})'));assert await page.locator('#cut-trash-bin').is_visible(),f'bin not visible for {css}'
 bin=await page.locator('#cut-trash-bin').bounding_box();await page.mouse.move(bin['x']+bin['width']/2,bin['y']+bin['height']/2,steps=14)
 await page.mouse.up();await page.wait_for_timeout(150)
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
  ctx=await browser.new_context(viewport={'width':420,'height':933},device_scale_factor=1,is_mobile=True,has_touch=True,service_workers='block')
  page=await ctx.new_page();errors=[];page.on('pageerror',lambda e: errors.append(str(e)))
  await page.set_content(helper.build_html(),wait_until='load',timeout=22000);await page.wait_for_timeout(1000)
  img=Image.new('RGB',(300,450),(45,140,122));b=io.BytesIO();img.save(b,format='PNG');png=b.getvalue()
  await page.locator('#file-picker').set_input_files({'name':'background.png','mimeType':'image/png','buffer':png});await page.wait_for_timeout(500)
  for name,kind,key in [('文字','text','texts'),('字幕','caption','captions'),('3D映像','cg','cgScenes')]:
   js={'text':"{id:'del-t',start:0,duration:4,text:'字幕の練習',x:.5,y:.4,size:50,color:'#ffffff'}",'caption':"{id:'del-cap',start:0,end:4,text:'これは字幕'}",'cg':"{id:'del-cg',start:0,duration:4,name:'立体文字'}"}[kind]
   await page.evaluate(f'''() => {{let a=window.__subehaCut;a.state.project.{key}||=[];a.state.project.{key}.push({js});a.save();a.refreshAll();}}''')
   await page.wait_for_timeout(180)
   css={'text':'#cut-caption-lane [data-text-id]','caption':'#cut-caption-lane [data-caption-id]','cg':'#cut-overlay-lane [data-cg-id]'}[kind]
   before=await page.evaluate(f'window.__subehaCut.state.project.{key}.length')
   await drag_to_bin(page,css)
   after=await page.evaluate(f'window.__subehaCut.state.project.{key}.length')
   print('DROP',name,before,'->',after);assert after==before-1
  await page.locator('#pro-overlay-picker').set_input_files({'name':'foreground.png','mimeType':'image/png','buffer':png});await page.wait_for_timeout(500)
  print('OVERLAYS',await page.evaluate('window.__subehaCut.state.project.overlays.length'))
  await drag_to_bin(page,'#cut-overlay-lane [data-layer-id]',0)
  assert await page.evaluate('window.__subehaCut.state.project.overlays.length')==0
  # WAV: enough samples for media metadata and waveform parser.
  buf=io.BytesIO()
  with wave.open(buf,'wb') as wav:
   wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(12000)
   wav.writeframes(b''.join(struct.pack('<h',int(2800*math.sin(2*math.pi*440*i/12000))) for i in range(6000)))
  await page.locator('#pro-audio-picker').set_input_files({'name':'narration.wav','mimeType':'audio/wav','buffer':buf.getvalue()})
  await page.wait_for_timeout(600)
  print('AUDIO',await page.evaluate('window.__subehaCut.state.project.audioTracks.length'))
  await drag_to_bin(page,'#cut-audio-lane [data-audio-id]',0)
  assert await page.evaluate('window.__subehaCut.state.project.audioTracks.length')==0
  print('JAPANESE',await page.locator('.leap-toolstrip').inner_text())
  assert '素材を重ねる' in (await page.locator('.leap-toolstrip').inner_text())
  print('ERRORS',errors[:3]);assert not errors
  await browser.close()
if __name__=='__main__':asyncio.run(main())
