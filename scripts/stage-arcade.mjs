import {readdir,readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// Add only the arcade's public dependency graph. Preserve the current public home,
// trade/general/theory and their data. Never export miharai/admin or private rooms.
const roots=['arcade','imoji-lab','brands/shikigami','products','research','works','contents','diagnosis','contact','tokusho'];
const singles=['miharai/index.html','miharai/data.json','assets/home-redesign.css','assets/teruteru-bot-turntable.svg','hitotsu-ore-choji.png','archive/neocities/fudasho-observation-091.html','archive/neocities/fudasho-kiln.js'];
const files=[...singles];
async function walk(dir){for(const d of await readdir(path.join(root,dir),{withFileTypes:true})){const name=path.posix.join(dir,d.name);if(d.isDirectory())await walk(name);else if(/\.(?:html|css|js|json|svg|png|txt)$/.test(name))files.push(name);}}
for(const dir of roots)await walk(dir);
for(const name of [...new Set(files)].sort()){
  const src=path.join(root,name),dest=path.join(root,'public',name);await mkdir(path.dirname(dest),{recursive:true});
  if(!name.endsWith('.html')){await copyFile(src,dest);continue;}
  let html=await readFile(src,'utf8');
  if(name==='archive/neocities/fudasho-observation-091.html')
    html=html.replace('</head>','<meta name="description" content="札所 観測窯。既存作品の保存版。"></head>');
  // A deployment can live at / or /subeha-portfolio/. Relative links support both.
  html=html.replace(/\b(href|src)="([^"\n]+)"/g,(all,attr,url)=>{
    if(/^(?:[a-z]+:|#|\/\/)/i.test(url))return all;
    let [local,fragment]=url.split('#');
    const resolved=local.startsWith('/')?local.slice(1):path.posix.normalize(path.posix.join(path.posix.dirname(name),local));
    let target=resolved;
    // The existing current home is public/index.html; don't republish the old home.
    if(target==='home.html'){target='index.html';fragment=undefined;}
    const rel=path.posix.relative(path.posix.dirname(name),target)||'./';
    return `${attr}="${rel.startsWith('.')?rel:'./'+rel}${local.endsWith('/')&&!rel.endsWith('/')?'/':''}${fragment?'#'+fragment:''}"`;
  });
  await writeFile(dest,html);
}
console.log(`Staged ${new Set(files).size} files; existing public home and data retained.`);
