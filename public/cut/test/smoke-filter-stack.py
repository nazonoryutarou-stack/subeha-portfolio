import asyncio, pathlib,io,importlib.util
from PIL import Image
from playwright.async_api import async_playwright
root=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('smoke_inline',root/'test/smoke-inline.py');helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
  ctx=await browser.new_context(viewport={'width':420,'height':933},device_scale_factor=1,is_mobile=True,has_touch=True,service_workers='block')
  page=await ctx.new_page();errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
  await page.set_content(helper.build_html(),wait_until='load',timeout=25000);await page.wait_for_timeout(850)
  print('ready:',await page.evaluate('typeof window.__subehaFXOpen'))
  assert await page.evaluate('typeof window.__subehaFXOpen')=='function',errors
  img=Image.new('RGB',(400,650),(230,30,20));b=io.BytesIO();img.save(b,format='PNG')
  await page.locator('#file-picker').set_input_files({'name':'test-red.png','mimeType':'image/png','buffer':b.getvalue()});await page.wait_for_timeout(700)
  await page.evaluate("window.__subehaCut.seek(.5);window.__subehaCut.draw()")
  def getter(): return "(()=>{const c=document.querySelector('#preview'),g=c.getContext('2d');return Array.from(g.getImageData(c.width/2,c.height/2,1,1).data).slice(0,3)})()"
  before=await page.evaluate(getter());print('PIXEL before:',before)
  await page.evaluate('window.__subehaFXOpen("filters")');await page.wait_for_timeout(250)
  assert await page.locator('#cut-fx-lab').is_visible()
  assert await page.locator('[data-new-filter=monochrome]').is_visible()
  await page.locator('[data-new-filter=monochrome]').click();await page.wait_for_timeout(150)
  await page.locator('[data-filter-amount]').last.fill('1');await page.locator('[data-filter-amount]').last.dispatch_event('change')
  await page.locator('[data-new-filter=invert]').click();await page.wait_for_timeout(150)
  await page.locator('[data-filter-amount]').last.fill('1');await page.locator('[data-filter-amount]').last.dispatch_event('change')
  await page.wait_for_timeout(250)
  stack=await page.evaluate('window.__subehaCut.state.project.clips[0].filterStack');print('STACK:',stack)
  assert len(stack)==2
  assert stack[0]['type']=='monochrome' and stack[1]['type']=='invert'
  assert stack[0]['amount']==1 and stack[1]['amount']==1
  await page.evaluate('window.__subehaCut.draw()');await page.wait_for_timeout(100)
  after=await page.evaluate(getter());print('PIXEL after:',after)
  assert max(after)-min(after)<6,f'not grayscale: {after}'
  assert before!=after,f'filter drawing had no effect: {before} {after}'
  # Compare: hold (pointer down), verify original; release verifies filtered return.
  btn=page.locator('#cut-fx-compare');rect=await btn.bounding_box();cx=rect['x']+rect['width']/2;cy=rect['y']+rect['height']/2
  await page.mouse.move(cx,cy);await page.mouse.down();await page.wait_for_timeout(150)
  compare=await page.evaluate(getter());print('PIXEL compare:',compare)
  assert compare==before,f'preview A/B did not restore original {compare} vs {before}'
  await page.mouse.up();await page.wait_for_timeout(180)
  assert await page.evaluate(getter())==after,'released A/B did not restore filtered view'
  # Enabled toggle and reorder
  await page.locator('[data-toggle-filter]').first.click();await page.wait_for_timeout(100)
  assert await page.evaluate('window.__subehaCut.state.project.clips[0].filterStack[0].enabled') is False
  await page.locator('[data-up-filter]').last.click();await page.wait_for_timeout(150)
  assert await page.evaluate('window.__subehaCut.state.project.clips[0].filterStack[0].type')=='invert'
  # Demonstrate copy to other clip then undo
  await page.locator('#cut-fx-close').click()
  await page.locator('#cut-video-lane [data-clip-id]').first.click();await page.wait_for_timeout(250)
  await page.locator('#leap-toolstrip button[aria-label="複製"]').click();await page.wait_for_timeout(180)
  await page.evaluate("window.__subehaFXOpen('filters')")
  await page.locator('#cut-filters-copy').click();await page.wait_for_timeout(160)
  a=await page.evaluate('window.__subehaCut.state.project.clips.map(c=>c.filterStack.length)');print('COPIED:',a)
  assert len(a)==2 and a==[2,2]
  await page.screenshot(path=str(root/'test/v16-filter-stack.png'))
  assert not errors,errors[:8]
  print('BROWSER OK; error count:',len(errors))
  await browser.close()
if __name__=='__main__':asyncio.run(main())
