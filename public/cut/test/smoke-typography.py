import asyncio, io, importlib.util, json
from pathlib import Path
from PIL import Image
from playwright.async_api import async_playwright
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('inline',str(root/'test/smoke-inline.py'))
inline=importlib.util.module_from_spec(spec);spec.loader.exec_module(inline)

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
  context=await browser.new_context(viewport={'width':420,'height':933},device_scale_factor=1,is_mobile=True,has_touch=True,service_workers='block')
  page=await context.new_page();errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
  await page.set_content(inline.build_html(),wait_until='load',timeout=25000);await page.wait_for_timeout(1300)
  print('Ready',await page.evaluate('!!window.__subehaCut && !!window.__subehaDirectTextActive'))
  image=Image.new('RGB',(720,1280),(25,34,50));buf=io.BytesIO();image.save(buf,format='PNG')
  await page.locator('#file-picker').set_input_files({'name':'scene.png','mimeType':'image/png','buffer':buf.getvalue()});await page.wait_for_timeout(400)
  await page.evaluate('''() => {const api=window.__subehaCut,s=api.state;
   s.project.texts.push({id:'title-demo',text:'夢の編集を、指先で。\\n自由な文字組み',start:0,duration:5,size:72,x:.5,y:.53,color:'#ffffff',width:.7});
   s.selectedText='title-demo';api.save();api.draw();}''')
  await page.wait_for_timeout(350)
  frame=page.locator('#cut-direct-frame');print('frame visible',await frame.is_visible())
  # Editable width handle / named Japanese editor tabs
  rect=await page.locator('.cut-direct-width').bounding_box();cx=rect['x']+rect['width']/2;cy=rect['y']+rect['height']/2
  await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx-60,cy,steps=6);await page.mouse.up();await page.wait_for_timeout(250)
  changed=await page.evaluate("window.__subehaCut.state.project.texts.find(x=>x.id==='title-demo').width")
  print('width after finger handle',changed);assert changed<.7,changed
  await page.locator('#cut-direct-bar [data-do="edit"]').click();await page.wait_for_timeout(170)
  assert await page.locator('#cut-direct-sheet').is_visible()
  await page.locator('#cut-title-tabs [data-tab="layout"]').click()
  await page.locator('[data-title-range="letterSpacing"]').fill('7')
  await page.locator('[data-title-range="lineHeight"]').fill('1.8')
  await page.locator('#cut-title-tabs [data-tab="appearance"]').click()
  await page.locator('[data-title-range="outlineWidth"]').fill('0.22')
  await page.locator('[data-appearance="outlineColor"]').fill('#ff346a')
  await page.locator('#cut-title-tabs [data-tab="font"]').click()
  await page.locator('#cut-title-font-list button').nth(1).click()
  await page.wait_for_timeout(190)
  title=await page.evaluate("window.__subehaCut.state.project.texts.find(x=>x.id==='title-demo')")
  print('font,tracking,line height,stroke',title['fontFamily'],title['letterSpacing'],title['lineHeight'],title['outlineWidth'])
  assert title['fontFamily']=='serif' and title['letterSpacing']==7 and title['lineHeight']==1.8
  await page.locator('#cut-direct-close').click()
  # Double click/double tap text selection to edit
  canvas=await page.locator('#preview').bounding_box();x=canvas['x']+canvas['width']*.5;y=canvas['y']+canvas['height']*.53
  await page.mouse.click(x,y,click_count=2,delay=130)
  await page.wait_for_timeout(250)
  print('double-tap opens',await page.locator('#cut-direct-sheet').is_visible())
  if await page.locator('#cut-direct-sheet').is_visible():
   await page.locator('#cut-direct-input').fill('新しい文字\n指で編集中')
  # Also render individual cue with per-cue style from same pipeline
  await page.evaluate('''() => {const s=window.__subehaCut.state;s.project.captions=[{id:'cue-new',start:0,end:4,text:'字幕も自由に',style:{size:56,x:.5,y:.82,width:.55,letterSpacing:6,outlineWidth:.2,outlineColor:'#ed729b',align:'right'}}];window.__subehaCut.draw();}''')
  await page.screenshot(path=str(root/'test/v18-text-touch.png'))
  rendered=await page.evaluate('''() => {
  const canvas=document.querySelector('#preview');return {width:canvas.width,height:canvas.height,nonblank:!!canvas.getContext('2d').getImageData(360,680,1,1).data[3],font:window.__subehaCut.state.project.texts[0].fontFamily};
  }''')
  print('render',rendered,'errors',errors[:5]);assert not errors,errors
  await browser.close()

if __name__=='__main__':asyncio.run(main())
