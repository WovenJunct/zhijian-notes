import assert from 'node:assert/strict';
import {harness} from './harness.mjs';
const h=await harness(),{page}=h;let failures=0;
async function check(name,fn){try{await fn();console.log('PASS '+name);}catch(e){failures++;console.error('FAIL '+name+': '+e.stack);}}
async function openNote(title,content='',mode='rich'){
 if(await page.getByRole('button',{name:'返回笔记',exact:true}).count()){await page.getByRole('button',{name:'返回笔记',exact:true}).click();await page.getByRole('button',{name:'新建笔记',exact:true}).waitFor();}
 const n=await page.evaluate(async({title,content,mode})=>{const {call}=await import('./bridge.js');return call('notes.save',{title,content,plainText:content,mode,tags:[],pinned:false,favorite:false});},{title,content,mode});
 await page.getByRole('button',{name:'笔记',exact:true}).click();await page.getByRole('button',{name:'打开笔记：'+title,exact:true}).click();await page.locator(mode==='rich'?'.ql-editor':'#markdown-input').waitFor();return n;
}
async function selectRich(index,length=0){await page.evaluate(({index,length})=>{const q=Quill.find(document.querySelector('#rich-editor'));q.focus();q.setSelection(index,length);},{index,length});}
async function formats(){return page.evaluate(()=>Quill.find(document.querySelector('#rich-editor')).getFormat());}
async function panel(){const b=page.getByRole('button',{name:'格式面板',exact:true});if(await b.getAttribute('aria-expanded')!=='true')await b.click();}
try{
 await check('Export nests child bullets under ordered parents including two-digit markers',async()=>{
  const result=await page.evaluate(async()=>{const {richToMarkdown,renderMarkdown}=await import('./content.js');const items=Array.from({length:10},(_,i)=>`<li data-list="ordered">Parent ${i+1}</li>${i===0||i===9?'<li data-list="bullet" class="ql-indent-1">Child</li>':''}`).join('');const md=richToMarkdown('<ol>'+items+'</ol>');const t=document.createElement('template');t.innerHTML=renderMarkdown(md);return {md,nested:t.content.querySelectorAll('ol>li>ul>li').length,parents:t.content.querySelector('ol')?.children.length};});assert.equal(result.nested,2,result.md);assert.equal(result.parents,10,result.md);
 });
 await check('Plain text keeps paragraph and line boundaries for summaries',async()=>{
  const actual=await page.evaluate(async()=>{const c=await import('./content.js');return {rich:c.plainText('<h2>标题</h2><p>第一段<br>第二行</p><p>第二段</p>','rich'),md:c.plainText('# 标题\n\n第一段\n\n第二段','markdown'),first:typeof c.firstLine==='function'?c.firstLine('\n\n 第一条非空行 \n后面的内容'):undefined};});
  assert.equal(actual.rich,'标题\n第一段\n第二行\n第二段');assert.equal(actual.md,'标题\n第一段\n第二段');assert.equal(actual.first,'第一条非空行');
 });
 await check('Sanitizer keeps controlled rich formatting and rejects arbitrary classes/styles/resources',async()=>{
  const html=await page.evaluate(async()=>{const {cleanRich}=await import('./content.js');return cleanRich('<p class="ql-align-center arbitrary" style="color: rgb(182, 110, 76); text-align: center; position:fixed; background-image:url(https://evil.test/x)"><span style="background-color: rgb(245, 221, 180)">保留颜色</span></p><ol><li class="ql-indent-2" data-list="checked">已完成</li></ol><a href="javascript:alert(1)">安全链接</a><img src="https://evil.test/x" onerror="alert(1)"><script>alert(1)</script>');});
  assert.match(html,/ql-align-center/);assert.match(html,/color: rgb\(182, 110, 76\)/);assert.match(html,/background-color: rgb\(245, 221, 180\)/);assert.match(html,/ql-indent-2/);assert.match(html,/data-list="checked"/);assert.doesNotMatch(html,/arbitrary|position|background-image|javascript:|onerror|<script|<img/);
 });
 await check('Rich headings, inline marks, colors, links and history work from mobile format panel',async()=>{
  await openNote('格式工具回归','<p>留下这一行文字</p>');await selectRich(0,8);await panel();
  for(const level of [1,2,3,4,5,6]){await page.getByLabel('段落样式',{exact:true}).selectOption(String(level));assert.equal((await formats()).header,level);}
  await page.getByLabel('段落样式',{exact:true}).selectOption('');assert.equal((await formats()).header,undefined);
  for(const [name,key] of [['下划线','underline'],['删除线','strike'],['行内代码','code']]){await page.getByRole('button',{name,exact:true}).click();assert.equal((await formats())[key],true);await page.getByRole('button',{name,exact:true}).click();}
  await page.getByLabel('文字颜色',{exact:true}).selectOption('#b66e4c');await page.getByLabel('高亮颜色',{exact:true}).selectOption('#f5ddb4');await page.getByLabel('段落对齐',{exact:true}).selectOption('center');
  await page.getByRole('button',{name:'插入或编辑链接',exact:true}).click();await page.getByLabel('链接地址',{exact:true}).fill('https://example.com/paper');await page.getByRole('button',{name:'保存',exact:true}).click();await page.locator('.ql-editor a[href="https://example.com/paper"]').waitFor();
  await page.getByRole('button',{name:'立即保存',exact:true}).click();await page.getByRole('button',{name:'返回笔记',exact:true}).click();await page.getByRole('button',{name:'打开笔记：格式工具回归',exact:true}).click();await page.locator('.ql-editor').waitFor();assert.equal(await page.locator('.ql-editor .ql-align-center').count(),1);assert.match(await page.locator('.ql-editor').innerHTML(),/color: rgb\(182, 110, 76\)/);assert.equal(await page.locator('.ql-editor a').getAttribute('href'),'https://example.com/paper');
  await selectRich(0,8);await panel();await page.getByRole('button',{name:'清除格式',exact:true}).click();assert.equal(await page.locator('.ql-editor a').count(),0);assert.equal((await formats()).color,undefined);await page.getByRole('button',{name:'撤销',exact:true}).click();assert.equal(await page.locator('.ql-editor a').count(),1);await page.getByRole('button',{name:'重做',exact:true}).click();assert.equal(await page.locator('.ql-editor a').count(),0);
 });
 await check('Nested mixed lists and checked items survive save/reopen and Markdown export',async()=>{
  await openNote('嵌套与待选框','<p>第一层</p><p>第二层</p><p>已完成</p>');await panel();
  await selectRich(0,3);await page.getByRole('button',{name:'项目列表',exact:true}).click();
  await selectRich(4,3);await page.getByRole('button',{name:'编号列表',exact:true}).click();await page.getByRole('button',{name:'增加缩进',exact:true}).click();
  await selectRich(8,3);await page.getByRole('button',{name:'待选框列表',exact:true}).click();await page.getByRole('button',{name:'增加缩进',exact:true}).click();await page.locator('.ql-editor li[data-list="unchecked"] .ql-ui').click();
  await page.getByRole('button',{name:'立即保存',exact:true}).click();
  const saved=await page.evaluate(async()=>{const {call}=await import('./bridge.js');const {richToMarkdown}=await import('./content.js');const list=await call('notes.list',{search:'嵌套与待选框'});const note=await call('notes.get',{id:list.items[0].id});return {html:note.content,md:richToMarkdown(note.content)};});
  assert.match(saved.md,/- 第一层/);assert.match(saved.md,/\n {2,}1\. 第二层/);assert.match(saved.md,/\n {2,}- \[x\] 已完成/);
  await page.getByRole('button',{name:'返回笔记',exact:true}).click();await page.getByRole('button',{name:'打开笔记：嵌套与待选框',exact:true}).click();await page.locator('.ql-editor').waitFor();assert.equal(await page.locator('.ql-editor li.ql-indent-1').count(),2);assert.equal(await page.locator('.ql-editor li[data-list="checked"]').count(),1);
  await selectRich(4,3);await panel();await page.getByRole('button',{name:'减少缩进',exact:true}).click();assert.equal((await formats()).indent,undefined);
 });
 await check('Rich basic tables support row/column changes and save round-trip',async()=>{
  await openNote('本地表格');await selectRich(0);await panel();await page.locator('details.table-tools > summary').click();await page.getByRole('button',{name:'插入表格',exact:true}).click();assert.equal(await page.locator('.ql-editor table tr').count(),2);assert.equal(await page.locator('.ql-editor table tr').first().locator('td').count(),2);
  await page.locator('.ql-editor table td').first().click();await page.keyboard.type('单元格');await panel();await page.getByRole('button',{name:'在下方插入行',exact:true}).click();await page.getByRole('button',{name:'在右侧插入列',exact:true}).click();assert.equal(await page.locator('.ql-editor table tr').count(),3);assert.equal(await page.locator('.ql-editor table tr').first().locator('td').count(),3);await page.getByRole('button',{name:'立即保存',exact:true}).click();
  await page.getByRole('button',{name:'返回笔记',exact:true}).click();await page.getByRole('button',{name:'打开笔记：本地表格',exact:true}).click();await page.locator('.ql-editor table').waitFor();assert.match(await page.locator('.ql-editor table').innerText(),/单元格/);assert.equal(await page.locator('.ql-editor table tr').count(),3);assert.equal(await page.locator('.ql-editor table tr').first().locator('td').count(),3);
 });
 await check('Markdown syntax insertion, source history and read-only preview preserve source',async()=>{
  await openNote('Markdown工具回归','选中文字','markdown');const input=page.getByLabel('Markdown 正文',{exact:true});await input.evaluate(e=>e.setSelectionRange(0,4));await panel();await page.getByRole('button',{name:'插入斜体',exact:true}).click();assert.equal(await input.inputValue(),'*选中文字*');await page.getByRole('button',{name:'撤销',exact:true}).click();assert.equal(await input.inputValue(),'选中文字');await page.getByRole('button',{name:'重做',exact:true}).click();assert.equal(await input.inputValue(),'*选中文字*');
  await input.fill('标题');await input.evaluate(e=>e.setSelectionRange(0,2));await page.getByLabel('段落样式',{exact:true}).selectOption('6');assert.equal(await input.inputValue(),'###### 标题');
  await input.fill('第一层\n第二层');await input.evaluate(e=>e.setSelectionRange(4,7));await page.getByRole('button',{name:'插入待选框',exact:true}).click();await page.getByRole('button',{name:'增加缩进',exact:true}).click();assert.equal(await input.inputValue(),'第一层\n  - [ ] 第二层');
  await input.fill('段落');await input.evaluate(e=>e.setSelectionRange(2,2));await page.getByRole('button',{name:'插入表格',exact:true}).click();await page.getByRole('button',{name:'插入分隔线',exact:true}).click();const source=await input.inputValue();assert.match(source,/\| --- \| --- \|/);assert.match(source,/\n---\n/);await page.getByRole('button',{name:'预览',exact:true}).click();assert.equal(await input.isVisible(),false);assert.equal(await page.locator('#markdown-preview table').count(),1);assert.equal(await page.locator('#markdown-preview hr').count(),1);assert.equal(await page.locator('#markdown-preview [contenteditable="true"]').count(),0);await page.getByRole('button',{name:'编辑',exact:true}).click();assert.equal(await input.inputValue(),source);
 });
 await check('Format panels fit narrow phones without horizontal page overflow',async()=>{
  for(const mode of ['rich','markdown']){await openNote('窄屏-'+mode,'',mode);await panel();for(const width of [320,360,412]){await page.setViewportSize({width,height:844});const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));assert.ok(size.scroll<=size.width,`${mode} at ${width}: ${size.scroll}`);}}
 });
 assert.deepEqual(h.errors,[],'JavaScript runtime errors');
}finally{await h.close();}
if(failures)process.exitCode=1;
