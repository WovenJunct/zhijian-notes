import {createRequire} from 'node:module';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PAPER_NODE_MODULES?path.join(process.env.PAPER_NODE_MODULES,'playwright'):'playwright');

export async function harness(){
 const root=path.resolve('app/src/main/assets/web');
 const images=new Map([['/media/test.png',await fs.readFile('docs/images/icon.png')],['/media/33333333-3333-3333-3333-333333333333.bin',Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF')]]);
 const server=http.createServer(async(req,res)=>{
  try{const url=new URL(req.url,'http://localhost');if(images.has(url.pathname)){res.setHeader('Content-Type','image/png');res.end(images.get(url.pathname));return;}const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep))throw Error();const data=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html; charset=utf-8');res.end(data);}catch{res.writeHead(404).end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.PAPER_CHROME?{executablePath:process.env.PAPER_CHROME}:{})});
 const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(5000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('paperSaveImage',dataUrl=>{if(!/^data:image\/png;base64,/.test(dataUrl))throw Error('PNG required');const src='media/'+crypto.randomUUID()+'.png';images.set('/'+src,Buffer.from(dataUrl.split(',')[1],'base64'));return {src};});
 await page.addInitScript(()=>{
  const store=JSON.parse(sessionStorage.getItem('paper-test')||'{"notes":[],"todos":[],"folders":[],"preferences":{}}');store.preferences||={};
  const summary=n=>{const value={...n,preview:n.preview??n.plainText??''};delete value._history;return value;};
  const sameVersion=(a,b)=>a.title===b.title&&a.content===b.content&&JSON.stringify(a.attachments||[])===JSON.stringify(b.attachments||[]);
  const checkpoint=n=>{const history=[...(n._history||[])];if(history[0]&&sameVersion(history[0],n))return history;const version={id:crypto.randomUUID(),title:n.title,content:n.content,mode:n.mode,attachments:JSON.parse(JSON.stringify(n.attachments||[])),updatedAt:n.updatedAt,capturedAt:Date.now()};const values=[version,...history].slice(0,12);while(new TextEncoder().encode(JSON.stringify(values)).length>1536*1024)values.pop();if(!values.length)throw Error('当前正文过大，无法保存历史版本');return values;};
  window.PaperNative={draft(){return true;},request(id,method,json){setTimeout(async()=>{try{
   const a=JSON.parse(json),[kind,op]=method.split('.');let result={};const rows=store[kind];
   if(method==='app.info')result={version:'1.1.0',lastBackup:0,preferences:store.preferences};
   else if(method==='app.takeLaunch')result={};
   else if(method==='reminders.status')result={enabled:true,permission:true};
   else if(method==='reminders.requestPermission')result={enabled:true,permission:true};
   else if(method==='app.preferences'){Object.assign(store.preferences,a);result=store.preferences;}
   else if(method==='tags.list')result={items:[...new Set(store.notes.filter(n=>!n.deletedAt).flatMap(n=>n.tags||[]))]};
   else if(method==='trash.list')result={items:['notes','todos'].flatMap(k=>store[k].filter(n=>n.deletedAt).map(n=>({...summary(n),type:k})))};
   else if(method==='trash.empty'){store.notes=store.notes.filter(n=>!n.deletedAt);store.todos=store.todos.filter(n=>!n.deletedAt);}
   else if(method==='notes.overview'){
    const notes=store.notes.filter(n=>!n.deletedAt),dates={};for(const n of notes){const d=new Date(n.createdAt),key=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');dates[key]=(dates[key]||0)+1;}
    result={total:notes.length,favorites:notes.filter(n=>n.favorite).length,words:notes.reduce((s,n)=>s+(n.plainText||'').replace(/\s/g,'').length,0),days:Object.keys(dates).length,dates,randomId:notes.length?notes[Math.floor(Math.random()*notes.length)].id:null};
   }else if(method==='notes.batch'){
    for(const id of a.ids){const n=store.notes.find(n=>n.id===id);if(!n)throw Error('记录不存在');if(a.action==='trash')n.deletedAt=Date.now();else if(a.action==='restore')n.deletedAt=null;else if(a.action==='move')n.folderId=a.folderId||null;else if(a.action==='favorite')n.favorite=true;}result={count:a.ids.length};
   }else if(method==='notes.history'){const note=store.notes.find(n=>n.id===a.id);if(!note)throw Error('记录不存在');result={items:note._history||[]};
   }else if(method==='notes.checkpoint'){const note=store.notes.find(n=>n.id===a.id);if(!note)throw Error('记录不存在');note._history=checkpoint(note);result={items:note._history};
   }else if(method==='notes.restoreVersion'){const note=store.notes.find(n=>n.id===a.id),version=note?._history?.find(v=>v.id===a.versionId);if(!version)throw Error('历史版本不存在');const history=checkpoint(note);Object.assign(note,{title:version.title,content:version.content,attachments:JSON.parse(JSON.stringify(version.attachments||[])),plainText:version.content,updatedAt:Date.now(),_history:history});result=note;
   }else if(op==='list'){
    let items=rows.filter(n=>!!n.deletedAt===!!a.trash);
    if(kind==='notes')items=items.filter(n=>(!a.search||(n.title+'\n'+n.plainText+'\n'+n.tags.join(',')).toLowerCase().includes(a.search.toLowerCase()))&&(!a.favorite||n.favorite)&&(!a.folderId||(a.folderId==='__unfiled'?!n.folderId:n.folderId===a.folderId))&&(!a.tag||n.tags.includes(a.tag))&&(!a.mode||a.mode===n.mode)&&(!a.from||n.createdAt>=a.from)&&(!a.to||n.createdAt<a.to));
    items.sort((x,y)=>Number(!!y.pinned)-Number(!!x.pinned)||(a.sort==='title'?x.title.localeCompare(y.title,'zh-CN'):a.sort==='created'?y.createdAt-x.createdAt:a.sort==='oldest'?x.createdAt-y.createdAt:y.updatedAt-x.updatedAt)||x.id.localeCompare(y.id));
    result={items:items.slice(a.offset||0,(a.offset||0)+(a.limit||50)).map(summary),total:items.length};
   }else if(op==='get'){result=rows.find(n=>n.id===a.id);if(!result)throw Error('记录不存在');}
   else if(op==='save'){
    const old=rows.find(n=>n.id===a.id);result={...a,id:a.id||crypto.randomUUID(),title:a.title||'',tags:a.tags||[],folderId:a.folderId||null,pinned:!!a.pinned,favorite:!!a.favorite,createdAt:old?.createdAt||a.createdAt||Date.now(),updatedAt:Date.now(),deletedAt:old?.deletedAt||null};if(kind==='notes'){result._history=old?._history||[];if(old&&!sameVersion(old,result)&&(!result._history.length||Date.now()-result._history[0].capturedAt>=60000))result._history=checkpoint(old);}if(old)rows.splice(rows.indexOf(old),1,result);else rows.push(result);
   }else if(op==='trash'||op==='restore'){const item=rows.find(n=>n.id===a.id);if(!item)throw Error('记录不存在');item.deletedAt=op==='trash'?Date.now():null;}
   else if(op==='delete'){if(kind==='folders')store.notes.forEach(n=>{if(n.folderId===a.id)n.folderId=null;});store[kind]=rows.filter(n=>n.id!==a.id);}
   else if(method==='attachments.pick')result={src:'media/test.png'};
   else if(method==='attachments.pickFile')result={src:'media/33333333-3333-3333-3333-333333333333.bin',name:'阅读资料.pdf',mime:'application/pdf',size:48};
   else if(method==='attachments.openFile'){window.__openedAttachment=JSON.parse(JSON.stringify(a));result={success:true};}
   else if(method==='attachments.saveImage')result=await window.paperSaveImage(a.dataUrl);
   else if(method==='markdown.export'||method==='backup.export')result={success:true};
   else throw Error('Unsupported mock command: '+method);
   sessionStorage.setItem('paper-test',JSON.stringify(store));window.PaperBridge.resolve(id,true,JSON.parse(JSON.stringify(result)));
  }catch(e){window.PaperBridge.resolve(id,false,{message:e.message});}},5);}};
 });
 await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.getByRole('button',{name:'新建笔记',exact:true}).waitFor();
 return {page,errors,async close(){await browser.close();await new Promise(r=>server.close(r));}};
}
