import asyncio,pathlib,io,importlib.util
from PIL import Image
from playwright.async_api import async_playwright
root=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('ihelper',root/'test/smoke-inline.py')
helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
  ctx=await browser.new_context(viewport={'width':420,'height':933},device_scale_factor=1,is_mobile=True,has_touch=True,service_workers='block')
  page=await ctx.new_page();errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
  await page.set_content(helper.build_html(),wait_until='load',timeout=22000);await page.wait_for_timeout(1100)
  img=Image.new('RGB',(300,400),(26,50,122));b=io.BytesIO();img.save(b,format='PNG')
  await page.locator('#file-picker').set_input_files({'name':'touch-test.png','mimeType':'image/png','buffer':b.getvalue()});await page.wait_for_timeout(650)
  r=await page.locator('#cut-video-lane [data-clip-id]').first.bounding_box()
  x=r['x']+min(r['width']/2,35);y=r['y']+r['height']/2
  await page.evaluate('''() => {window.__touchLog=[];for(const t of ['pointerdown','pointermove','pointerup','pointercancel'])document.addEventListener(t,e=>{window.__touchLog.push([t,Math.round(e.clientX),Math.round(e.clientY),e.pointerType,window.__subehaTrash?.active(),document.querySelector('#cut-trash-bin')?.className])},true)}''')
  cdp=await ctx.new_cdp_session(page)
  await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':3}]})
  await page.wait_for_timeout(650)
  visible=await page.locator('#cut-trash-bin').is_visible();print('TOUCH HOLD BIN:',visible)
  assert visible,'real touch hold failed'
  tr=await page.locator('#cut-trash-bin').bounding_box();tx=tr['x']+tr['width']/2;ty=tr['y']+tr['height']/2
  for step in range(1,13):
   xx=x+(tx-x)*step/12;yy=y+(ty-y)*step/12
   await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':xx,'y':yy,'id':3}]})
   await asyncio.sleep(.027)
  await page.screenshot(path=str(root/'test/v15-trash-drag.png'))
  await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
  await page.wait_for_timeout(380)
  val=await page.evaluate('window.__subehaCut.state.project.clips.length');print('TOUCH DELETE CLIPS:',val)
  if val!=0:print('page errors',errs,'TOUCH LOG',await page.evaluate('window.__touchLog.slice(-25)'),'bin',await page.evaluate('document.querySelector("#cut-trash-bin").className'))
  assert val==0
  await page.screenshot(path=str(root/'test/v15-touch-delete.png'))
  await page.locator('#cut-trash-restore').click();await page.wait_for_timeout(200)
  assert await page.evaluate('window.__subehaCut.state.project.clips.length')==1
  print('TOUCH UNDO OK; ERRORS',errs[:5]);assert not errs
  await browser.close()
if __name__=='__main__':asyncio.run(main())
