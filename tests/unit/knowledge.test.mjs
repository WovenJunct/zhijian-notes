import test from 'node:test';
import assert from 'node:assert/strict';
import {builtinTemplates,templatePayload} from '../../app/src/main/assets/web/note-knowledge.js';
test('all built-in templates offer usable rich and Markdown content',()=>{
 assert.ok(builtinTemplates.length>=5);assert.equal(new Set(builtinTemplates.map(t=>t.id)).size,builtinTemplates.length);
 for(const template of builtinTemplates)for(const mode of ['rich','markdown']){const value=templatePayload(template,mode,'folder');assert.equal(value.mode,mode);assert.equal(value.folderId,'folder');assert.ok(value.content.length>30);assert.ok(value.title);assert.deepEqual(value.tags,[]);assert.equal(value.isTemplate,false);}
});
test('creating a note from a custom template copies content without identity or history',()=>{
 const custom={id:'template-id',isTemplate:true,title:'复盘',mode:'markdown',content:'## 保留文字\n![](media/template.png)',tags:['旧标签'],_history:[{content:'旧内容'}],favorite:true,attachments:[{src:'media/template.bin',name:'说明.pdf',mime:'application/pdf',size:42}]};
 const value=templatePayload(custom,'markdown',null);assert.equal(value.content,custom.content);assert.equal(value.title,'复盘');assert.equal(value.folderId,null);assert.equal(value.favorite,false);assert.equal(value.id,undefined);assert.equal(value._history,undefined);assert.equal(custom.isTemplate,true);assert.deepEqual(value.attachments,custom.attachments);value.attachments[0].name='已复制';assert.equal(custom.attachments[0].name,'说明.pdf');
});
