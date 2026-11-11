import asyncio,sys,io,importlib.util
from pathlib import Path
from PIL import Image
from playwright.async_api import async_playwright
root=Path(__file__).resolve().parents[1];spec=importlib.util.spec_from_file_location('inline',str(root/'test/smoke-inline.py'));inline=importlib.util.module_from_spec(spec);spec.loader.exec_module(inline)
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);c=await b.new_context(viewport={'width':420,'height':933},is_mobile=True,has_touch=True);page=await c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.set_content(inline.build_html());await page.wait_for_timeout(950)
  png=io.BytesIO();Image.new('RGB',(360,640),(35,50,80)).save(png,'PNG')
  await page.locator('#file-picker').set_input_files({'name':'base.png','mimeType':'image/png','buffer':png.getvalue()});await page.wait_for_timeout(340)
  await page.evaluate('''() => {const s=window.__subehaCut.state;s.project.texts=[{id:'touch',text:'PINCH',start:0,duration:3,x:.5,y:.5,size:90,color:'#fff'}];s.selectedText='touch';window.__subehaCut.save();window.__subehaCut.draw();}''');await page.wait_for_timeout(180)
  r=await page.locator('#preview').bounding_box();x=r['x']+r['width']*.5;y=r['y']+r['height']*.5
  cdp=await c.new_cdp_session(page)
  def pt(i,px,py):return {'x':px,'y':py,'id':i}
  await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[pt(1,x-20,y)]});await page.wait_for_timeout(50)
  await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[pt(1,x-20,y),pt(2,x+20,y)]});await page.wait_for_timeout(50)
  for i in range(6):
   await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[pt(1,x-20-i*3,y),pt(2,x+20+i*3,y-6-i*2)]});await page.wait_for_timeout(20)
  await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[pt(1,x-35,y)]});
  await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});await page.wait_for_timeout(200)
  print('pinch result:',await page.evaluate('window.__subehaCut.state.project.texts[0]'))
  print('errors',errors[:3]);await b.close()
asyncio.run(main())
