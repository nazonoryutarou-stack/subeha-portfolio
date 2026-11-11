import asyncio,base64,io,importlib.util
from pathlib import Path
from PIL import Image
from playwright.async_api import async_playwright
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('inline',str(root/'test/smoke-inline.py'))
inline=importlib.util.module_from_spec(spec);spec.loader.exec_module(inline)
async def main():
 image=Image.new('RGB',(320,540),(45,75,135));buf=io.BytesIO();image.save(buf,'PNG');png=buf.getvalue()
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
  context=await browser.new_context(viewport={'width':420,'height':933},device_scale_factor=1,is_mobile=True,has_touch=True,service_workers='block')
  page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  async def route_api(route):
   await route.fulfill(json={'results':[{'id':'stock-77','title':'Starry Nature','license':'cc0','url':'https://example.org/downloads/nature.png','thumbnail':'https://example.org/downloads/nature.png','foreign_landing_url':'https://example.org/photo/nature','creator':'Open photographer'}]},headers={'Access-Control-Allow-Origin':'*'})
  async def route_png(route): await route.fulfill(body=png,content_type='image/png',headers={'Access-Control-Allow-Origin':'*'})
  await page.route('https://api.openverse.org/**',route_api)
  await page.route('https://example.org/downloads/nature.png',route_png)
  await page.set_content(inline.build_html(),wait_until='load',timeout=25000);await page.wait_for_timeout(900)
  await page.evaluate('window.__subehaStockOpen()')
  await page.locator('#stock-results .stock-card').first.wait_for(timeout=10000)
  print('card',await page.locator('.stock-card').count())
  assert await page.locator('.stock-card').count()==1
  assert 'CC0' in await page.locator('.stock-by').inner_text()
  await page.locator('#stock-confirm').check()
  await page.locator('.stock-add').first.click();await page.wait_for_timeout(1250)
  state=await page.evaluate('''() => ({clipCount:window.__subehaCut.state.project.clips.length,credits:window.__subehaCut.state.project.stockCredits||[],names:[...window.__subehaCut.state.assets.values()].map(v=>v.name)})''')
  print('state after import',state)
  assert state['clipCount']==1
  assert len(state['credits'])==1 and state['credits'][0]['license']=='CC0'
  assert state['credits'][0]['source']=='https://example.org/photo/nature'
  await page.evaluate('window.__subehaStockOpen()');await page.wait_for_timeout(200)
  await page.screenshot(path=str(root/'test/stock-library-v19.png'))
  assert not errors,errors
  await browser.close()
if __name__=='__main__':asyncio.run(main())
