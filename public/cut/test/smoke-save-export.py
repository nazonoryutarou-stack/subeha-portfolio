import asyncio,pathlib,io,importlib.util,zipfile,json,subprocess,os
from PIL import Image
from playwright.async_api import async_playwright,TimeoutError as PWTimeout
root=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('inline_source',root/'test/smoke-inline.py')
helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
  ctx=await browser.new_context(viewport={'width':420,'height':933},is_mobile=True,has_touch=True,accept_downloads=True,service_workers='block')
  page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.set_content(helper.build_html(),wait_until='load',timeout=30000)
  await page.wait_for_timeout(750)
  assert await page.locator('#save-indicator').count()==1
  assert await page.locator('#export-cancel').count()==1
  print('STATUS INITIAL',await page.locator('#save-indicator').inner_text())
  im=Image.new('RGB',(260,420),(175,36,24));buffer=io.BytesIO();im.save(buffer,format='PNG')
  print('BEFORE IMPORT',flush=True)
  await page.locator('#file-picker').set_input_files({'name':'my-scene.png','mimeType':'image/png','buffer':buffer.getvalue()})
  print('IMPORTED',flush=True)
  await page.wait_for_timeout(500)
  await page.evaluate('''() => {const a=window.__subehaCut;a.state.project.clips[0].filterStack=[{id:'f01',type:'monochrome',enabled:true,amount:1},{id:'f02',type:'invert',enabled:true,amount:.7}];a.save();a.draw();}''')
  print('FILTER SAVED',flush=True)
  # Top save must download media-inclusive .subecut, NOT the legacy JSON metadata only.
  print('ABOUT TO SAVE',flush=True)
  assert await page.locator('#project-save').is_visible(), 'save button hidden'
  print('BUTTON', await page.locator('#project-save').evaluate('(e)=>({rect:e.getBoundingClientRect().toJSON(),html:e.outerHTML})'),flush=True)
  async with page.expect_download(timeout=12000) as event: await page.evaluate('document.getElementById("project-save").click()')
  download=await event.value;dest=root/'test/v17-backup.subecut';await download.save_as(str(dest))
  print('PROJECT BACKUP',download.suggested_filename,dest.stat().st_size)
  assert download.suggested_filename.endswith('.subecut')
  with zipfile.ZipFile(dest) as z:
   assert 'project.json' in z.namelist()
   manifest=json.loads(z.read('project.json'))
   assert len(manifest['assets'])==1,manifest['assets']
   media_path=manifest['assets'][0]['path']
   assert z.read(media_path)==buffer.getvalue()
   assert len(manifest['project']['clips'][0]['filterStack'])==2
  # Restore after deliberately removing the filter stack: project data and source media must return.
  await page.evaluate('''() => {const a=window.__subehaCut;a.state.project.clips[0].filterStack=[];a.save();}''')
  page.on('dialog',lambda dialog: asyncio.create_task(dialog.accept()))
  await page.locator('#pro-project-picker').set_input_files({'name':'backup.subecut','mimeType':'application/zip','buffer':dest.read_bytes()})
  await page.wait_for_timeout(700)
  restored=await page.evaluate('window.__subehaCut.state.project.clips[0]?.filterStack?.length')
  print('RESTORED STACK',restored)
  assert restored==2,'saved project did not restore the filter stack'
  # Stress stop: the in-progress UI should enable a cancel action and never download a partial file.
  await page.evaluate('document.getElementById("export-open").click()')
  await page.evaluate('document.getElementById("export-secondary").click()')
  await page.wait_for_timeout(400)
  assert not await page.locator('#export-progress').evaluate('(e)=>e.hidden'),errors[:5]
  await page.evaluate('document.getElementById("export-cancel").click()')
  await page.wait_for_timeout(700)
  assert await page.locator('#export-progress').evaluate('(e)=>e.hidden'),'progress never dismissed'
  assert not await page.evaluate('window.__subehaCut.state.recording'),'recording remains active after cancel'
  print('CANCEL OK')
  # Then export a short scene, so session cleanup and restart must work.
  await page.evaluate('''() => {const a=window.__subehaCut;a.state.project.clips[0].end=1.5;a.save();a.seek(0);}''')
  async with page.expect_download(timeout=18000) as event:
   await page.evaluate('document.getElementById("export-secondary").click()')
  result=await event.value;movie=root/('test/v17-export.'+result.suggested_filename.split('.')[-1]);await result.save_as(str(movie))
  print('VIDEO',result.suggested_filename,movie.stat().st_size)
  await page.wait_for_timeout(450)
  report=await page.locator('#export-last-report').inner_text();print('REPORT',report)
  assert '映像' in report and '音声' in report and '保存' in report
  assert movie.stat().st_size>2000
  await page.screenshot(path=str(root/'test/v17-export-ui.png'))
  assert not errors,errors[:7]
  print('BROWSER OK')
  await browser.close()
if __name__=='__main__':asyncio.run(main())
