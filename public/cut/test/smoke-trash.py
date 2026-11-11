import asyncio, pathlib, io, importlib.util
from PIL import Image
from playwright.async_api import async_playwright
root=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('inlinehelper',root/'test/smoke-inline.py')
helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
async def main():
  async with async_playwright() as p:
    browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
    ctx=await browser.new_context(viewport={'width':420,'height':933},device_scale_factor=1,is_mobile=True,has_touch=True,service_workers='block')
    page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    await page.set_content(helper.build_html(),wait_until='load',timeout=22000)
    await page.wait_for_timeout(1200)
    print('READY',await page.evaluate('!!window.__subehaTrash'),await page.evaluate('!!window.__subehaDirectTextActive'))
    assert await page.evaluate('!!window.__subehaTrash')
    await page.locator('.leap-head-help').click()
    assert await page.locator('#cut-jp-guide').is_visible()
    print('HELP',await page.locator('#cut-jp-guide').inner_text()[:150] if False else '日本語ガイドが開いた')
    await page.locator('#cut-jp-close').click()
    img=Image.new('RGB',(360,550),(53,87,120));buf=io.BytesIO();img.save(buf,format='PNG')
    await page.locator('#file-picker').set_input_files({'name':'sample.png','mimeType':'image/png','buffer':buf.getvalue()})
    await page.wait_for_timeout(650)
    print('CLIPS BEFORE', await page.evaluate('window.__subehaCut.state.project.clips.length'))
    card=page.locator('#cut-video-lane [data-clip-id]').first
    rect=await card.bounding_box();assert rect
    x=rect['x']+min(rect['width']/2,36);y=rect['y']+rect['height']/2
    await page.mouse.move(x,y);await page.mouse.down();await page.wait_for_timeout(600)
    assert await page.locator('#cut-trash-bin').is_visible(), '長押しでゴミ箱が表示されない'
    bin=await page.locator('#cut-trash-bin').bounding_box();assert bin
    cx=bin['x']+bin['width']/2;cy=bin['y']+bin['height']/2
    await page.mouse.move(cx,cy,steps=15);await page.wait_for_timeout(200)
    print('HOVER',await page.locator('#cut-trash-bin').get_attribute('class'))
    await page.mouse.up();await page.wait_for_timeout(350)
    n=await page.evaluate('window.__subehaCut.state.project.clips.length');print('CLIPS AFTER',n)
    assert n==0
    assert await page.locator('#cut-trash-undo').is_visible()
    await page.locator('#cut-trash-restore').click();await page.wait_for_timeout(350)
    assert await page.evaluate('window.__subehaCut.state.project.clips.length')==1
    print('UNDO RESTORED')
    await page.evaluate('''() => {let api=window.__subehaCut;api.state.project.texts.push({id:'trash-test-text',text:'これを捨てる',start:0,duration:4,size:60,x:.5,y:.5,color:'#ffffff'});api.state.selectedText='trash-test-text';api.save();api.draw();}''')
    await page.wait_for_timeout(350)
    print('TEXT BEFORE',await page.evaluate('window.__subehaCut.state.project.texts.length'))
    cv=await page.locator('#preview').bounding_box();
    x=cv['x']+cv['width']/2;y=cv['y']+cv['height']/2
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+3,y+18,steps=4)
    assert await page.locator('#cut-trash-bin').is_visible(),'文字ドラッグのゴミ箱が表示されない'
    bin=await page.locator('#cut-trash-bin').bounding_box();await page.mouse.move(bin['x']+bin['width']/2,bin['y']+bin['height']/2,steps=20)
    await page.mouse.up();await page.wait_for_timeout(200)
    n=await page.evaluate('window.__subehaCut.state.project.texts.length');print('TEXT AFTER',n);assert n==0
    await page.screenshot(path=str(root/'test/v15-trash.png'))
    print('PAGE ERRORS',errors[:6]);assert not errors
    await browser.close()
if __name__=='__main__':asyncio.run(main())
