import asyncio, os, pathlib
from playwright.async_api import async_playwright
root=pathlib.Path(__file__).resolve().parents[1]
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--disable-web-security'])
  ctx=await browser.new_context(viewport={'width':420,'height':933},device_scale_factor=2,is_mobile=True,has_touch=True,service_workers='block')
  page=await ctx.new_page()
  errors=[];page.on('pageerror',lambda error: errors.append(str(error)))
  async def intercept(route):
   path=route.request.url.split('/cut/',1)[-1].split('?',1)[0]
   if path=='' or path=='cut/':path='index.html'
   file=(root/path).resolve()
   if not file.is_relative_to(root) or not file.is_file():await route.fulfill(status=404,body='not found');return
   mime='text/javascript' if file.suffix=='.mjs' or file.suffix=='.js' else 'text/css' if file.suffix=='.css' else 'text/html' if file.suffix=='.html' else 'application/octet-stream'
   await route.fulfill(status=200,body=file.read_bytes(),content_type=mime)
  await page.route('**/cut/**',intercept)
  try:
   await page.goto('https://subeha.example/cut/',wait_until='domcontentloaded',timeout=12000)
   await page.wait_for_timeout(1300)
   print('loaded',await page.title(), 'ready',await page.evaluate('!!window.__subehaDirectTextActive'),'fx',await page.evaluate('typeof window.__subehaFXOpen'), 'errs',errors[:3])
   await page.screenshot(path=str(root/'test/smoke-v14-empty.png'))
  except Exception as e: print('browser failed',repr(e), 'errors',errors[:5])
  await browser.close()
asyncio.run(main())
