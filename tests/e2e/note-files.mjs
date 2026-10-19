import assert from 'node:assert/strict';
import {harness} from './harness.mjs';
const h=await harness(),{page}=h;let failures=0;
async function check(name,fn){try{await fn();console.log('PASS '+name);}catch(e){failures++;console.error('FAIL '+name+': '+e.stack);}}
const file={src:'media/12345678-1234-4234-9234-123456789abc.bin',name:'离线资料.pdf',mime:'application/pdf',size:2048};
try{
 await check('Offline attachment module exports editor and read-only integration',async()=>{
  const names=await page.evaluate(async()=>{window.fileModule=await import('./note-files.js');const c=document.createElement('link');c.rel='stylesheet';c.href='note-files.css';document.head.append(c);return Object.keys(window.fileModule);});for(const name of ['NoteFiles','attachmentMarkup','wireReadonly'])assert.ok(names.includes(name),name);
 });
 await check('Picking a file captures its metadata and flushes it into the note',async()=>{
  await page.evaluate(async file=>{const {bridge}=await import('./bridge.js'),original=bridge.call.bind(bridge);bridge.call=(method,args)=>{if(method==='attachments.pickFile')return Promise.resolve(window.testFile);if(method==='attachments.openFile'){window.openedFile=args;return Promise.resolve({success:true});}return original(method,args);};window.testFile=file;document.body.classList.add('editing');const root=document.createElement('section');root.id='file-test-root';root.innerHTML='<div class="editor-body"></div><button id="insert-file">添加文件</button>';document.body.append(root);window.testEditor={ctx:{page:root},note:{attachments:[]},live:true,captures:0,flushes:0,capture(){this.captures++;},async flush(){this.flushes++;}};window.noteFiles=new window.fileModule.NoteFiles(window.testEditor);window.noteFiles.mount();},file);
  await page.locator('#insert-file').click();await page.getByRole('button',{name:'打开附件：离线资料.pdf',exact:true}).waitFor();const result=await page.evaluate(()=>({files:window.testEditor.note.attachments,captures:window.testEditor.captures,flushes:window.testEditor.flushes}));assert.deepEqual(result.files,[file]);assert.ok(result.captures>=1);assert.ok(result.flushes>=1);
 });
 await check('Opening delegates the private reference and never adds a binary URL to WebView',async()=>{
  await page.getByRole('button',{name:'打开附件：离线资料.pdf',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.openedFile),file);assert.equal(await page.locator('#file-test-root a[href],#file-test-root iframe,#file-test-root object').count(),0);
 });
 await check('Removal asks for confirmation and updates only the note attachment list',async()=>{
  await page.getByRole('button',{name:'附件选项：离线资料.pdf',exact:true}).click();await page.getByRole('button',{name:'移除附件',exact:true}).click();await page.getByRole('button',{name:'取消',exact:true}).click();assert.equal(await page.evaluate(()=>window.testEditor.note.attachments.length),1);
  await page.getByRole('button',{name:'附件选项：离线资料.pdf',exact:true}).click();await page.getByRole('button',{name:'移除附件',exact:true}).click();await page.getByRole('button',{name:'确认',exact:true}).click();await page.waitForFunction(()=>window.testEditor.note.attachments.length===0);
 });
 await check('Read-only cards reject unsafe sources and escape file names at narrow widths',async()=>{
  await page.evaluate(file=>{window.noteFiles.destroy();window.testEditor.live=false;const root=document.querySelector('#file-test-root');root.innerHTML=window.fileModule.attachmentMarkup([{...file,name:'<img src=x onerror=alert(1)>.pdf'}, {...file,src:'../../private.bin'},{...file,src:'https://example.invalid/x.bin'}],{readonly:true});window.stopReadonly=window.fileModule.wireReadonly(root,[{...file,name:'<img src=x onerror=alert(1)>.pdf'}]);},file);assert.equal(await page.locator('#file-test-root img').count(),0);assert.equal(await page.locator('#file-test-root [data-file-src]').count(),1);for(const width of [320,390]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await page.locator('#file-test-root [data-file-src]').click();assert.equal(await page.evaluate(()=>window.openedFile.name),'<img src=x onerror=alert(1)>.pdf');
 });
 await check('Real rich and Markdown editors retain attachment metadata after save and reopen',async()=>{
  await page.evaluate(()=>{window.stopReadonly?.();document.querySelector('#file-test-root').remove();document.body.classList.remove('editing');});
  for(const mode of ['rich','markdown']){const title='附件保存重开-'+mode;await page.evaluate(async({title,mode})=>{const {call}=await import('./bridge.js');await call('notes.save',{title,mode,content:'',plainText:'',tags:[],attachments:[]});},{title,mode});await page.getByRole('button',{name:'笔记',exact:true}).click();await page.getByRole('button',{name:'打开笔记：'+title,exact:true}).click();await page.getByRole('button',{name:'格式面板',exact:true}).click();await page.getByRole('button',{name:'添加文件附件',exact:true}).click();await page.getByRole('button',{name:'打开附件：离线资料.pdf',exact:true}).waitFor();await page.getByRole('button',{name:'立即保存',exact:true}).click();await page.getByRole('button',{name:'返回笔记',exact:true}).click();await page.getByRole('button',{name:'打开笔记：'+title,exact:true}).click();await page.getByRole('button',{name:'打开附件：离线资料.pdf',exact:true}).waitFor();const stored=await page.evaluate(async title=>{const {call}=await import('./bridge.js');const list=await call('notes.list',{search:title});return (await call('notes.get',{id:list.items[0].id})).attachments;},title);assert.deepEqual(stored,[file]);await page.getByRole('button',{name:'返回笔记',exact:true}).click();}
 });
 assert.deepEqual(h.errors,[]);
}finally{await h.close();}
if(failures)process.exitCode=1;
