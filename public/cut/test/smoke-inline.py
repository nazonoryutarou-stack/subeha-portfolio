import asyncio,base64, pathlib,re, html as htmlmod, json, io
from PIL import Image
from playwright.async_api import async_playwright
root=pathlib.Path(__file__).resolve().parents[1]
cache={}

def inline_module(path):
 path=path.resolve()
 if path in cache:return cache[path]
 code=path.read_text()
 def replace(m):
  target=(path.parent/m.group(2)).resolve()
  if not target.is_relative_to(root):raise Exception('out of root '+str(target))
  return m.group(1)+"'"+inline_module(target)+"'"
 code=re.sub(r"(from\s+|import\s*)['\"](\./[^'\"]+\.mjs)['\"]",replace,code)
 url='data:text/javascript;base64,'+base64.b64encode(code.encode()).decode()
 cache[path]=url
 return url

def build_html():
 content=(root/'index.html').read_text()
 content=re.sub(r'<link[^>]+rel="manifest"[^>]*>', '',content)
 def link(m):return '<style>'+ (root/m.group(1)).read_text()+'</style>'
 content=re.sub(r'<link rel="stylesheet" href="\./([\w-]+\.css)">',link,content)
 def script(m):return '<script type="module" src="'+inline_module(root/m.group(1))+'"></script>'
 content=re.sub(r'<script type="module" src="\./([\w-]+\.mjs)"></script>',script,content)
 return content

async def main():
 content=build_html();print('HTML length',len(content),'modules',len(cache))
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
  ctx=await browser.new_context(viewport={'width':420,'height':933},device_scale_factor=1,is_mobile=True,has_touch=True,service_workers='block')
  page=await ctx.new_page();errors=[];page.on('pageerror',lambda error: errors.append(str(error)))
  await page.set_content(content,wait_until='load',timeout=22000)
  await page.wait_for_timeout(1200)
  print('ready',await page.evaluate('!!window.__subehaCut'), 'direct',await page.evaluate('!!window.__subehaDirectTextActive'), 'fx',await page.evaluate('typeof window.__subehaFXOpen'))
  if not await page.evaluate('!!window.__subehaCut'):print('errors',errors[:4]);await browser.close();return
  img=Image.new('RGB',(400,600),(35,82,135));b=io.BytesIO();img.save(b,format='PNG')
  await page.locator('#file-picker').set_input_files({'name':'scene.png','mimeType':'image/png','buffer':b.getvalue()})
  await page.wait_for_timeout(650)
  await page.evaluate('''() => {window.__subehaCut.state.project.texts.push({id:'newtext',text:'ドラッグして編集',start:0,duration:4,size:56,x:.5,y:.5,color:'#ffffff'}); window.__subehaCut.state.selectedText='newtext'; window.__subehaCut.save();window.__subehaCut.draw();}''')
  await page.wait_for_timeout(350)
  await page.screenshot(path=str(root/'test/v14-direct-preview.png'))
  selected=await page.evaluate("document.querySelector('#cut-direct-frame').hidden")
  r=await page.locator('#preview').bounding_box();print('frame hidden',selected, 'canvas rect',r)
  cx=r['x']+r['width']*.5;cy=r['y']+r['height']*.5
  await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx+60,cy-45,steps=8);await page.mouse.up();await page.wait_for_timeout(200)
  val=await page.evaluate("({x:window.__subehaCut.state.project.texts[0].x,y:window.__subehaCut.state.project.texts[0].y})")
  print('Dragged text to',val)
  await page.evaluate('window.__subehaFXOpen("looks")');await page.wait_for_timeout(300)
  print('fx open',await page.locator('#cut-fx-lab').is_visible())
  await page.locator('[data-look=analog]').click();await page.wait_for_timeout(300)
  print('grade',await page.evaluate('window.__subehaCut.state.project.clips[0].grade'),'stack',await page.evaluate('window.__subehaCut.state.project.clips[0].fxStack.length'))
  await page.screenshot(path=str(root/'test/v14-fx-lab.png'))
  print('errors',errors[:8]);await browser.close()
if __name__ == "__main__":
 asyncio.run(main())
