import asyncio,io,importlib.util
from pathlib import Path
from PIL import Image
from playwright.async_api import async_playwright
root=Path(__file__).resolve().parents[1];spec=importlib.util.spec_from_file_location('inline',str(root/'test/smoke-inline.py'));inline=importlib.util.module_from_spec(spec);spec.loader.exec_module(inline)
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  c=await b.new_context(viewport={'width':420,'height':933},is_mobile=True,has_touch=True);page=await c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.set_content(inline.build_html());await page.wait_for_timeout(750)
  data=io.BytesIO();Image.new('RGB',(300,500),(60,90,150)).save(data,'PNG')
  await page.locator('#file-picker').set_input_files({'name':'base.png','mimeType':'image/png','buffer':data.getvalue()});await page.wait_for_timeout(300)
  extra=io.BytesIO();Image.new('RGB',(150,100),(210,140,45)).save(extra,'PNG');
  await page.locator('#pro-overlay-picker').set_input_files({'name':'layer.png','mimeType':'image/png','buffer':extra.getvalue()});await page.wait_for_timeout(450)
  print('overlays',await page.evaluate('window.__subehaCut.state.project.overlays.length'))
  r=await page.locator('#preview').bounding_box();x=r['x']+r['width']*.5;y=r['y']+r['height']*.5
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+48,y-40,steps=6);await page.mouse.up();await page.wait_for_timeout(130)
  print('overlay after drag',await page.evaluate('({x:window.__subehaCut.state.project.overlays[0].x,y:window.__subehaCut.state.project.overlays[0].y})'))
  await page.evaluate('window.__subehaFXOpen("effects")');await page.locator('[data-add-fx=bloom]').click();await page.wait_for_timeout(250)
  await page.locator('[data-fx-input]').first.fill('0.85');await page.locator('[data-key]').first.click();await page.wait_for_timeout(200)
  print('stack',await page.evaluate('window.__subehaCut.state.project.clips[0].fxStack'))
  await page.screenshot(path=str(root/'test/v14-effects-stack.png'))
  print('page errors',errors);await b.close()
asyncio.run(main())
