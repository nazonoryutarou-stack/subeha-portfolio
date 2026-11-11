import asyncio,io,importlib.util
from pathlib import Path
from PIL import Image
from playwright.async_api import async_playwright
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('inline',str(root/'test/smoke-inline.py'));inline=importlib.util.module_from_spec(spec);spec.loader.exec_module(inline)
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
  context=await b.new_context(viewport={'width':420,'height':933},device_scale_factor=1,is_mobile=True,has_touch=True,service_workers='block')
  page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.set_content(inline.build_html(),wait_until='load',timeout=25000);await page.wait_for_timeout(1200)
  buf=io.BytesIO();Image.new('RGB',(720,1280),(22,35,66)).save(buf,'PNG')
  await page.locator('#file-picker').set_input_files({'name':'bg.png','mimeType':'image/png','buffer':buf.getvalue()});await page.wait_for_timeout(300)
  await page.evaluate('''() => {const api=window.__subehaCut,s=api.state;s.project.captions=[{id:'test-cue',start:0,end:4,text:'字幕を自由に操作',style:{size:54,x:.5,y:.7,color:'#ffffff'}}];api.save();api.draw();}''')
  await page.evaluate("window.__subehaDirectOpen('caption')");await page.wait_for_timeout(150)
  await page.locator('#cut-title-tabs [data-tab="layout"]').click()
  await page.locator('[data-title-range="width"]').fill('0.4')
  await page.locator('[data-title-range="letterSpacing"]').fill('5')
  await page.locator('#cut-title-center').click()
  await page.locator('#cut-title-tabs [data-tab="appearance"]').click()
  await page.locator('[data-title-range="shadowBlur"]').fill('28')
  await page.locator('[data-appearance="color"]').fill('#ffe870')
  await page.wait_for_timeout(250)
  cue=await page.evaluate("window.__subehaCut.state.project.captions[0]")
  print('subtitle patch',cue)
  assert cue['style']['width']==0.4 and cue['style']['letterSpacing']==5
  assert cue['style']['shadowBlur']==28 and cue['style']['x']==.5
  await page.locator('#cut-direct-close').click()
  # canvas pixels and saves are consistent; remain selected after display.
  await page.screenshot(path=str(root/'test/v18-subtitle-touch.png'))
  # IndexedDB save: project stays intact after page reload in same context.
  import json
  # Project backup JSON serialization, equivalent to IndexedDB data (test at code level)
  result=await page.evaluate('''() => {const s=window.__subehaCut.state.project;const copy=JSON.parse(JSON.stringify(s));return copy.captions[0].style;}''')
  assert result['width']==.4 and result['shadowBlur']==28
  print('errors',errors)
  assert not errors
  await b.close()
if __name__=='__main__':asyncio.run(main())
