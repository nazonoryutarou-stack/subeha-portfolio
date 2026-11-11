import asyncio,io,sys
from pathlib import Path
from PIL import Image
from playwright.async_api import async_playwright
sys.path.insert(0,str(Path(__file__).parent))
from importlib.machinery import SourceFileLoader
# Reuse module helper without executing its main
import importlib.util
spec=importlib.util.spec_from_file_location("smoke_inline",str(Path(__file__).parent/"smoke-inline.py"))
smoke_inline=importlib.util.module_from_spec(spec);spec.loader.exec_module(smoke_inline)
root=Path(__file__).resolve().parents[1]
async def run():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader'])
  ctx=await browser.new_context(viewport={'width':420,'height':933},is_mobile=True,has_touch=True,service_workers='block');page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.set_content(smoke_inline.build_html(),wait_until='load');await page.wait_for_timeout(750)
  img=Image.new('RGB',(600,600),(70,55,85));buf=io.BytesIO();img.save(buf,'PNG');await page.locator('#file-picker').set_input_files({'name':'image.png','mimeType':'image/png','buffer':buf.getvalue()});await page.wait_for_timeout(380)
  await page.evaluate('''() => {const p=window.__subehaCut.state.project;p.captions=[{id:'cue',start:0,end:4,text:'指で動かす字幕',style:{size:56,x:.5,y:.77,background:true}}];window.__subehaCut.save();window.__subehaCut.draw();}''');await page.wait_for_timeout(150)
  rect=await page.locator('#preview').bounding_box();x=rect['x']+rect['width']*.5;y=rect['y']+rect['height']*.77
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+45,y-50,steps=6);await page.mouse.up();await page.wait_for_timeout(130)
  print('cue after drag',await page.evaluate('window.__subehaCut.state.project.captions[0].style'))
  # test handle resizing
  handle=page.locator('.cut-direct-resize');assert await handle.is_visible()
  box=await handle.bounding_box();await page.mouse.move(box['x']+16,box['y']+16);await page.mouse.down();await page.mouse.move(box['x']+50,box['y']+45,steps=8);await page.mouse.up();await page.wait_for_timeout(200)
  print('cue after resize',await page.evaluate('window.__subehaCut.state.project.captions[0].style'))
  await page.locator('[data-do=edit]').click();await page.locator('#cut-direct-input').fill('色と位置を直接変更');await page.locator('[data-color="#ff526d"]').click();await page.wait_for_timeout(120)
  print('cue edited',await page.evaluate('window.__subehaCut.state.project.captions[0]'))
  await page.screenshot(path=str(root/'test/v14-caption-direct.png'))
  print('errs',errors)
  await browser.close()
asyncio.run(run())
