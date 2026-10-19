import assert from 'node:assert/strict';
import {harness} from './harness.mjs';
const h=await harness(),{page}=h;let failures=0;
async function check(name,fn){try{await fn();console.log('PASS '+name);}catch(e){failures++;console.error('FAIL '+name+': '+e.stack);await page.screenshot({path:'.toolchain/organize-failure.png'});}}
async function home(){await page.getByRole('button',{name:'笔记',exact:true}).click();}
async function seed(title,content,mode='markdown'){
 return page.evaluate(async({title,content,mode})=>{const {call}=await import('./bridge.js');return call('notes.save',{title,content,plainText:content,mode,tags:[],pinned:false,favorite:false});},{title,content,mode});
}
try{
 await check('Card preview shows only first nonempty line and ellipsis',async()=>{
  await seed('摘要测试','\n第一行，保持简洁。\n后面这句不应出现在卡片。');await home();
  const preview=page.locator('.note-card').filter({hasText:'摘要测试'}).locator('.preview');assert.equal(await preview.innerText(),'第一行，保持简洁。');
  const css=await preview.evaluate(e=>({whiteSpace:getComputedStyle(e).whiteSpace,overflow:getComputedStyle(e).overflow,textOverflow:getComputedStyle(e).textOverflow}));assert.equal(css.whiteSpace,'nowrap');assert.equal(css.overflow,'hidden');assert.equal(css.textOverflow,'ellipsis');
 });
 await check('Delete directly from card; cancel is safe and undo restores',async()=>{
  const card=page.locator('.note-card').filter({hasText:'摘要测试'});await card.getByRole('button',{name:'笔记操作：摘要测试'}).click();await page.getByRole('button',{name:'移入回收站',exact:true}).click();await page.getByRole('button',{name:'取消',exact:true}).click();assert.equal(await card.count(),1);
  await card.getByRole('button',{name:'笔记操作：摘要测试'}).click();await page.getByRole('button',{name:'移入回收站',exact:true}).click();await page.getByRole('button',{name:'确认',exact:true}).click();await card.waitFor({state:'detached'});await page.getByRole('button',{name:'撤销删除',exact:true}).click();await card.waitFor();assert.equal(await page.locator('#note-title').count(),0);
 });
 await check('Trash opens full rich and Markdown content in read-only mode',async()=>{
  for(const mode of ['markdown','rich']){
   const n=await seed('回收站全文-'+mode,mode==='rich'?'<h1>纸上的标题</h1><p>后续完整正文</p>':'# 纸上的标题\n\n后续完整正文',mode);
   await page.evaluate(async id=>{const {call}=await import('./bridge.js');await call('notes.trash',{id});},n.id);
  }
  await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByRole('button',{name:/回收站/}).click();
  for(const mode of ['markdown','rich']){
   await page.getByRole('button',{name:'查看内容：回收站全文-'+mode,exact:true}).click();await page.locator('.trash-reader h1').filter({hasText:'纸上的标题'}).waitFor();assert.match(await page.locator('.trash-reader').innerText(),/后续完整正文/);assert.equal(await page.locator('[contenteditable="true"]').count(),0);await page.getByRole('button',{name:'返回回收站',exact:true}).click();
  }
 });
 await check('Copy note keeps content; sorting and layout preferences survive reload',async()=>{
  await home();const card=page.locator('.note-card').filter({hasText:'摘要测试'});await card.getByRole('button',{name:'笔记操作：摘要测试'}).click();await page.getByRole('button',{name:'复制笔记',exact:true}).click();await page.getByRole('button',{name:'打开笔记：摘要测试（副本）',exact:true}).waitFor();
  await page.getByLabel('笔记排序').selectOption('title');await page.getByRole('button',{name:'切换为网格视图',exact:true}).click();await page.reload();assert.equal(await page.getByLabel('笔记排序').inputValue(),'title');assert.equal(await page.locator('#notes-list.grid-view').count(),1);
 });
 await check('Long press selects a card once and system back leaves selection',async()=>{
  const card=page.getByRole('button',{name:'打开笔记：摘要测试',exact:true});await card.dispatchEvent('pointerdown',{clientX:100,clientY:100});await page.waitForTimeout(600);await card.dispatchEvent('pointerup');await card.dispatchEvent('click');assert.equal(await page.getByRole('checkbox',{name:'选择笔记：摘要测试',exact:true}).isChecked(),true);await page.evaluate(()=>window.PaperApp.flushAndBack());assert.equal(await page.locator('#selection-bar').isVisible(),false);
 });
 await check('Delayed card save never replaces another page after navigation',async()=>{
  await page.evaluate(()=>{const original=PaperNative.request;PaperNative.request=function(...args){if(args[1]==='notes.save')setTimeout(()=>original.apply(this,args),450);else original.apply(this,args);};});
  await page.locator('.note-card').filter({has:page.getByRole('button',{name:'打开笔记：摘要测试',exact:true})}).getByRole('button',{name:'笔记操作：摘要测试',exact:true}).click();await page.getByRole('button',{name:'复制笔记',exact:true}).click();await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByRole('button',{name:/备份所有内容/}).waitFor();await page.waitForTimeout(650);assert.equal(await page.getByRole('button',{name:/备份所有内容/}).count(),1);assert.equal(await page.locator('#nav [data-page="settings"].active').count(),1);await home();
  const extra=await page.evaluate(async()=>{const {call}=await import('./bridge.js');return (await call('notes.list',{search:'摘要测试（副本）'})).items;});if(extra.length>1)await page.evaluate(async id=>{const {call}=await import('./bridge.js');await call('notes.trash',{id});},extra.at(-1).id);await home();
 });
 await check('Batch selection can move and trash notes without opening editor',async()=>{
  await page.getByRole('button',{name:'批量整理',exact:true}).click();await page.getByRole('checkbox',{name:'选择笔记：摘要测试',exact:true}).check();await page.getByRole('checkbox',{name:'选择笔记：摘要测试（副本）',exact:true}).check();
  await page.evaluate(()=>{const original=PaperNative.request;let fail=true;PaperNative.request=function(id,method,json){if(fail&&method==='notes.batch'){fail=false;setTimeout(()=>PaperBridge.resolve(id,false,{message:'模拟存储失败，请重试'}),20);}else original.call(this,id,method,json);};});await page.getByRole('button',{name:'收藏所选笔记',exact:true}).click();await page.locator('#toast').filter({hasText:'模拟存储失败'}).waitFor();assert.equal(await page.getByRole('button',{name:'移动所选笔记',exact:true}).isEnabled(),true);
  await page.getByRole('button',{name:'移动所选笔记',exact:true}).click();await page.getByRole('button',{name:'新建文件夹',exact:true}).click();await page.getByLabel('新建文件夹',{exact:true}).fill('整理后的文件夹');await page.getByRole('button',{name:'保存',exact:true}).click();
  await page.getByLabel('筛选文件夹').selectOption({label:'整理后的文件夹'});await page.waitForFunction(()=>document.querySelectorAll('.note-card').length===2);
  await page.getByRole('button',{name:'批量整理',exact:true}).click();await page.getByRole('button',{name:'选择本页',exact:true}).click();await page.getByRole('button',{name:'删除所选笔记',exact:true}).click();await page.getByRole('button',{name:'确认',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.note-card').length===0);
 });
 await check('Review statistics and calendar operate offline and filter notes',async()=>{
  await seed('回顾测试','今天的记录');await home();await page.getByLabel('筛选文件夹').selectOption('');await page.getByRole('button',{name:'笔记回顾',exact:true}).click();await page.locator('#review-panel').waitFor();assert.match(await page.locator('#review-panel').innerText(),/记录天数/);await page.locator('[data-review-day]').first().click();await page.locator('#date-filter-clear').waitFor();await page.getByRole('button',{name:'清除日期筛选',exact:true}).click();
 });
 assert.deepEqual(h.errors,[]);await page.screenshot({path:'dist/纸间-1.1-首页.png',fullPage:true});
}finally{await h.close();}
if(failures)process.exitCode=1;
