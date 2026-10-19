// Generates documentation screenshots with fictional notes, without reading user data.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {harness} from '../tests/e2e/harness.mjs';
const h=await harness(),{page}=h;
try{
 await page.setViewportSize({width:390,height:900});
 await page.clock.setFixedTime(new Date('2026-01-16T12:00:00Z'));
 await page.evaluate(async()=>{
  const {call}=await import('./bridge.js');
  const folder=await call('folders.save',{name:'日常'});
  const c=document.createElement('canvas');c.width=900;c.height=1200;const ink=c.getContext('2d');ink.fillStyle='#fffdf7';ink.fillRect(0,0,c.width,c.height);ink.strokeStyle='#e8e0d3';ink.lineWidth=1;for(let y=240;y<1100;y+=80){ink.beginPath();ink.moveTo(75,y);ink.lineTo(825,y);ink.stroke();}ink.fillStyle='#4a4036';ink.font='52px KaiTi, serif';ink.fillText('把灵感，留在纸上。',90,180);ink.font='42px KaiTi, serif';ink.fillText('慢慢写，也慢慢想。',110,340);ink.fillText('今天想做的一件小事：',110,500);ink.fillStyle='#ad583e';ink.fillText('读书，散步，记录生活。',110,660);ink.strokeStyle='#ad583e';ink.lineWidth=5;ink.beginPath();ink.moveTo(110,680);ink.quadraticCurveTo(420,710,740,675);ink.stroke();const picture=await call('attachments.saveImage',{dataUrl:c.toDataURL('image/png')});
  await call('notes.save',{title:'在纸上，留一点灵感',mode:'rich',content:`<h2>一页手写，也是一段记录</h2><p>图片可以排版、裁剪，也可以继续添上笔迹。</p><p class="ql-align-center"><img src="${picture.src}" width="75%" alt="手写示例"></p>`,plainText:'一页手写，也是一段记录',tags:['灵感'],folderId:folder.id,pinned:false,favorite:false});
  await call('notes.save',{title:'把日子，写成喜欢的样子',mode:'rich',content:'<h1>慢慢记录，好好生活</h1><p>不必写得完整，也不必想好开头。</p><p>把今天的一点点<span style="color:#b66e4c">小确幸</span>，留在这页纸上。</p><h2>想留下的片刻</h2><ol><li data-list="bullet">清晨的一杯热茶</li><li data-list="bullet" class="ql-indent-1">以及窗边透进来的光</li><li data-list="checked">读完一本一直想读的书</li></ol>',plainText:'慢慢记录，好好生活\n不必写得完整，也不必想好开头。\n把今天的一点点小确幸，留在这页纸上。',tags:['生活','随手记'],folderId:folder.id,pinned:true,favorite:true,createdAt:new Date('2026-01-14T09:00:00Z').getTime()});
  await call('notes.save',{title:'一页读书笔记',mode:'markdown',content:'# 在阅读里，看见更多\n\n> 慢慢读，也慢慢想。\n\n## 今天的收获\n\n- 为喜欢的句子留个位置\n  - 记下它为什么打动自己\n- 也写下自己的想法\n\n| 章节 | 关键词 |\n| --- | --- |\n| 第一章 | 好奇心 |\n| 第二章 | 日常的发现 |',plainText:'在阅读里，看见更多\n慢慢读，也慢慢想。',tags:['阅读'],folderId:null,pinned:false,favorite:false,createdAt:new Date('2026-01-16T09:00:00Z').getTime()});
  for(const [title,completed] of [['读二十页喜欢的书',false],['给绿植浇水',false],['留十分钟，整理这一周',false],['去公园散步',true]])await call('todos.save',{title,completed});
 });
 await page.getByRole('button',{name:'笔记',exact:true}).click();
 await page.locator('.note-card').first().waitFor();
 await fs.mkdir('docs/images',{recursive:true});
 await page.screenshot({path:'docs/images/notes.png'});
 await page.getByRole('button',{name:'打开笔记：把日子，写成喜欢的样子',exact:true}).click();
 await page.locator('.ql-editor h1').waitFor();
 await page.getByRole('button',{name:'格式面板',exact:true}).click();
 await page.evaluate(()=>{window.scrollTo(0,0);document.querySelector('#editor-format-panel').scrollTop=0;});
 await page.screenshot({path:'docs/images/editor.png'});
 await page.getByRole('button',{name:'返回笔记',exact:true}).click();
 await page.getByRole('button',{name:'笔记回顾',exact:true}).click();
 await page.locator('#review-panel').scrollIntoViewIfNeeded();
 await page.evaluate(()=>window.scrollBy(0,140));
 await page.screenshot({path:'docs/images/review.png'});
 await page.getByRole('button',{name:'待办',exact:true}).click();
 await page.getByRole('button',{name:/已完成/}).click();
 await page.screenshot({path:'docs/images/todos.png'});
 await page.getByRole('button',{name:'笔记',exact:true}).click();await page.getByRole('button',{name:'打开笔记：在纸上，留一点灵感',exact:true}).click();await page.locator('.ql-editor img').click();await page.screenshot({path:'docs/images/image-layout.png'});await page.getByRole('button',{name:'继续手写',exact:true}).click();await page.getByRole('button',{name:'画笔',exact:true}).waitFor();await page.screenshot({path:'docs/images/handwriting.png'});await page.getByRole('button',{name:'关闭画布',exact:true}).click();
 assert.deepEqual(h.errors,[]);
 console.log('Generated six documentation screenshots from fictional sample data.');
}finally{await h.close();}
