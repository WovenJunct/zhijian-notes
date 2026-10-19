import {$,esc,icon,toast,error} from './ui.js';
import {prompt} from './dialogs.js';

const button=(label,text,attributes='')=>`<button type="button" aria-label="${label}" title="${label}" ${attributes}>${text}</button>`;
const format=(key,label,text)=>button(label,text,`data-format="${key}" data-edit`);
const insert=(key,label,text)=>button(label,text,`data-insert="${key}" data-edit`);
const headings=`<label>段落<select aria-label="段落样式" id="paragraph-style" data-edit><option value="">正文</option>${[1,2,3,4,5,6].map(n=>`<option value="${n}">标题 ${n}</option>`).join('')}</select></label>`;
const colors=[['','默认'],['#3c352d','墨黑'],['#b66e4c','陶土橙'],['#8d453e','砖红'],['#64735d','鼠尾草'],['#486b85','灰蓝'],['#735d83','雾紫']];
const highlights=[['','无高亮'],['#f5ddb4','暖黄'],['#ead1c6','浅陶'],['#dce5d4','浅绿'],['#dbe6ed','浅蓝']];
const options=items=>items.map(([value,label])=>`<option value="${value}">${label}</option>`).join('');

export function editorToolsMarkup(rich){
 return `<footer class="editor-dock"><div class="editor-toolbar" id="editor-toolbar" role="toolbar" aria-label="编辑工具">${rich?format('bold','加粗','<b>B</b>')+format('italic','斜体','<i>I</i>'):button('预览','预览','id="preview-toggle"')+insert('bold','插入加粗','<b>B</b>')}${button('格式面板','Aa','id="format-toggle" aria-expanded="false" aria-controls="editor-format-panel"')}${button('撤销','↶','data-command="undo" data-edit')}${button('重做','↷','data-command="redo" data-edit')}${button('插入图片',icon('image'),'id="insert-image" data-edit')}${button('立即保存',icon('checkSquare'),'id="retry-save"')}</div>
 <div id="editor-format-panel" class="editor-format-panel" aria-label="格式面板内容" hidden>
 <div class="format-group media-tools"><div class="format-grid">${button('插入手写','✎ 手写','id="insert-handwriting" data-edit')}${button('管理图片','图片管理','id="manage-images"')}${button('添加文件附件','＋ 附件','id="insert-file"')}</div></div>
 <div class="format-row">${headings}${rich?'<label>对齐<select aria-label="段落对齐" id="paragraph-align" data-edit><option value="">左对齐</option><option value="center">居中</option><option value="right">右对齐</option><option value="justify">两端对齐</option></select></label>':''}</div>
 <div class="format-group"><span class="format-caption">${rich?'文字':'语法'}</span><div class="format-grid">${rich?format('underline','下划线','<u>U</u>')+format('strike','删除线','<s>S</s>')+format('code','行内代码','&lt;/&gt;')+button('插入或编辑链接','链接','data-command="link" data-edit')+button('清除格式','清格式','data-command="clear" data-edit'):insert('italic','插入斜体','<i>斜体</i>')+insert('strike','插入删除线','<s>删除线</s>')+insert('inline-code','插入行内代码','行内代码')+button('插入链接','链接','data-command="link" data-edit')}</div></div>
 <div class="format-group"><span class="format-caption">段落与列表</span><div class="format-grid">${rich?format('header','标题格式','H₂')+format('bullet','项目列表','• 列表')+format('ordered','编号列表','1. 列表')+format('check','待选框列表','☑ 待选框')+format('blockquote','引用','❞ 引用')+format('code-block','代码段','代码块'):insert('heading','插入标题','H₂')+insert('list','插入列表','• 列表')+insert('ordered','插入编号列表','1. 列表')+insert('check','插入待选框','☑ 待选框')+insert('quote','插入引用','❞ 引用')+insert('code','插入代码块','代码块')}${button('增加缩进','→ 缩进','data-command="indent" data-edit')}${button('减少缩进','← 缩进','data-command="outdent" data-edit')}${!rich?insert('rule','插入分隔线','分隔线'):''}</div></div>
 ${rich?`<div class="format-row"><label>文字颜色<select aria-label="文字颜色" id="text-color" data-edit>${options(colors)}</select></label><label>高亮<select aria-label="高亮颜色" id="text-highlight" data-edit>${options(highlights)}</select></label></div><details class="table-tools"><summary>表格</summary><p>基础表格 · 先点选单元格，再操作行列</p><div class="format-grid">${button('插入表格','插入 2 × 2','data-table="insertTable" data-edit')}${button('在下方插入行','＋ 行','data-table="insertRowBelow" data-edit')}${button('在右侧插入列','＋ 列','data-table="insertColumnRight" data-edit')}${button('删除当前行','－ 行','data-table="deleteRow" data-edit')}${button('删除当前列','－ 列','data-table="deleteColumn" data-edit')}${button('删除表格','删除表格','data-table="deleteTable" data-edit')}</div></details>`:`<div class="format-group"><div class="format-grid">${insert('table','插入表格','插入表格')}</div></div>`}
 </div></footer>`;
}

export class EditorTools {
 constructor(editor){this.editor=editor;this.source=$('#markdown-input');this.history=[];this.historyIndex=-1;this.lastTyped=0;}
 mount(){
  $('#format-toggle').onclick=()=>{const panel=$('#editor-format-panel'),show=panel.hidden;panel.hidden=!show;$('#format-toggle').setAttribute('aria-expanded',String(show));};
  for(const b of document.querySelectorAll('.editor-dock button'))b.onmousedown=e=>e.preventDefault();
  for(const b of document.querySelectorAll('[data-format]'))b.onclick=()=>this.richFormat(b.dataset.format);
  for(const b of document.querySelectorAll('[data-insert]'))b.onclick=()=>this.markdownInsert(b.dataset.insert);
  for(const b of document.querySelectorAll('[data-command]'))b.onclick=()=>this.command(b.dataset.command).catch(error);
  for(const b of document.querySelectorAll('[data-table]'))b.onclick=()=>this.table(b.dataset.table);
  $('#paragraph-style').onchange=e=>{if(this.editor.quill)this.richChange(q=>q.format('header',Number(e.target.value)||false,'user'));else this.lines(s=>s.replace(/^(\s*)#{1,6}\s+/,'$1').replace(/^(\s*)(.*)$/,(_,space,text)=>space+(e.target.value?'#'.repeat(Number(e.target.value))+' ':'')+text));};
  if(this.editor.quill){
   $('#paragraph-align').onchange=e=>this.richChange(q=>q.format('align',e.target.value||false,'user'));
   $('#text-color').onchange=e=>this.richChange(q=>q.format('color',e.target.value||false,'user'));
   $('#text-highlight').onchange=e=>this.richChange(q=>q.format('background',e.target.value||false,'user'));
   this.editor.quill.on('selection-change',()=>this.sync());this.editor.quill.on('text-change',()=>this.sync());this.sync();
  }else{
   this.recordSource();this.source.addEventListener('keydown',e=>{if(e.isComposing||this.editor.composing)return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();this.undo(e.shiftKey);}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();this.undo(true);}else if(e.key==='Tab'){e.preventDefault();this.indent(e.shiftKey);}});
  }
 }
 focusRich(){const q=this.editor.quill,range=this.editor.range||q.getSelection()||{index:Math.max(0,q.getLength()-1),length:0};q.focus({preventScroll:true});const index=Math.min(range.index,q.getLength()-1),length=Math.min(range.length,q.getLength()-index);q.setSelection(index,length,'silent');this.editor.range={index,length};return q;}
 richChange(change){if(this.editor.composing)return;const q=this.focusRich();q.history.cutoff();change(q);q.history.cutoff();this.editor.range=q.getSelection()||this.editor.range;this.editor.capture();this.sync();}
 richFormat(key){this.richChange(q=>{const f=q.getFormat();if(key==='header')q.format('header',f.header?false:2,'user');else if(['bullet','ordered','check'].includes(key)){const value=key==='check'?'unchecked':key;q.format('list',f.list===value||(key==='check'&&f.list==='checked')?false:value,'user');}else q.format(key,!f[key],'user');});}
 sync(){
  const q=this.editor.quill;if(!q||!this.editor.live)return;const range=q.getSelection()||this.editor.range||{index:0,length:0},f=q.getFormat(range.index,range.length);
  for(const b of document.querySelectorAll('[data-format]')){const key=b.dataset.format,active=key==='header'?!!f.header:key==='check'?['checked','unchecked'].includes(f.list):['bullet','ordered'].includes(key)?f.list===key:!!f[key];b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));}
  $('#paragraph-style').value=String(f.header||'');$('#paragraph-align').value=f.align||'';this.setColor($('#text-color'),f.color);this.setColor($('#text-highlight'),f.background);
  document.querySelector('[data-command="undo"]').disabled=q.history.stack.undo.length===0;document.querySelector('[data-command="redo"]').disabled=q.history.stack.redo.length===0;
 }
 setColor(select,color){const sample=document.createElement('span');sample.style.color=color||'';const match=[...select.options].find(o=>{const test=document.createElement('span');test.style.color=o.value;return test.style.color===sample.style.color;});select.value=match?.value||'';}
 async command(key){
  if(key==='link')return this.link();if(key==='undo'||key==='redo'){if(this.editor.quill){const q=this.focusRich();q.history[key]();this.editor.capture();this.sync();}else this.undo(key==='redo');return;}
  if(key==='indent'||key==='outdent'){if(this.editor.quill)this.richChange(q=>q.format('indent',key==='indent'?'+1':'-1','user'));else this.indent(key==='outdent');return;}
  if(key==='clear')this.richChange(q=>{const r=q.getSelection();q.removeFormat(r.index,r.length,'user');q.formatLine(r.index,r.length,{header:false,list:false,indent:false,align:false,blockquote:false,'code-block':false},'user');if(!r.length)for(const k of ['bold','italic','underline','strike','code','link','color','background'])q.format(k,false,'user');});
 }
 table(action){
  this.richChange(q=>{const table=q.getModule('table');if(!table)return;if(action==='insertTable'){if(table.getTable()[0]){toast('已在表格中，请先移到表格外');return;}table.insertTable(2,2);}else{if(!table.getTable()[0]){toast('请先点选一个表格单元格');return;}table[action]();}});
 }
 async link(){
  let range,current='';if(this.editor.quill){const q=this.focusRich();range={...q.getSelection()};current=q.getFormat().link||'';if(current&&!range.length){let at=0,start=null,end=null;for(const op of q.getContents().ops){const length=typeof op.insert==='string'?op.insert.length:1;if(op.attributes?.link===current){if(start===null)start=at;end=at+length;}else if(start!==null){if(range.index>=start&&range.index<=end)break;start=end=null;}at+=length;}if(start!==null&&range.index>=start&&range.index<=end)range={index:start,length:end-start};}}
  else range={start:this.source.selectionStart,end:this.source.selectionEnd};
  const value=await prompt('链接地址',current||'https://','填写 https:// 地址；清空可移除链接');if(value===null||!this.editor.live)return;const url=value.trim();if(url&&!/^https?:\/\/[^\s]+$/i.test(url)){toast('请输入完整的 http:// 或 https:// 地址');return;}
  if(this.editor.quill){this.editor.range=range;this.richChange(q=>{if(!range.length&&url){q.insertText(range.index,url,{link:url},'user');q.setSelection(range.index+url.length,0,'silent');}else q.formatText(range.index,range.length,'link',url||false,'user');});}
  else{this.source.setSelectionRange(range.start,range.end);if(url)this.editor.insertMarkdown('[',`](${url})`);}
 }
 snapshot(){return {value:this.source.value,start:this.source.selectionStart,end:this.source.selectionEnd};}
 recordSource(typing=false){
  if(!this.source||this.editor.composing)return;const next=this.snapshot(),previous=this.history[this.historyIndex];if(previous?.value===next.value){previous.start=next.start;previous.end=next.end;return;}
  const now=Date.now(),merge=typing&&this.lastTyped&&now-this.lastTyped<650&&this.historyIndex===this.history.length-1&&this.historyIndex>0;this.history=this.history.slice(0,this.historyIndex+1);if(merge)this.history[this.historyIndex]=next;else{this.history.push(next);if(this.history.length>60)this.history.shift();this.historyIndex=this.history.length-1;}this.lastTyped=typing?now:0;this.syncSource();
 }
 syncSource(){const preview=this.source.hidden;for(const el of document.querySelectorAll('.editor-dock [data-edit]'))el.disabled=preview;document.querySelector('[data-command="undo"]').disabled=preview||this.historyIndex<=0;document.querySelector('[data-command="redo"]').disabled=preview||this.historyIndex>=this.history.length-1;}
 undo(redo=false){if(this.source.hidden||this.editor.composing)return;const index=this.historyIndex+(redo?1:-1);if(index<0||index>=this.history.length)return;this.historyIndex=index;const value=this.history[index];this.source.value=value.value;this.source.focus({preventScroll:true});this.source.setSelectionRange(value.start,value.end);this.lastTyped=0;this.editor.resizeTextarea();this.editor.capture();this.syncSource();}
 beforeSourceEdit(){this.recordSource();this.lastTyped=0;}
 lines(change){
  const input=this.source;if(input.hidden||this.editor.composing)return;this.beforeSourceEdit();const a=input.selectionStart,b=input.selectionEnd,start=input.value.lastIndexOf('\n',a-1)+1,last=b>a&&input.value[b-1]==='\n'?b-1:b;let end=input.value.indexOf('\n',last);if(end<0)end=input.value.length;const text=input.value.slice(start,end).split('\n').map(change).join('\n');input.setRangeText(text,start,end,'select');input.focus({preventScroll:true});this.editor.resizeTextarea();this.recordSource();this.editor.capture();
 }
 indent(outdent=false){this.lines(line=>outdent?line.replace(/^(?: {1,2}|\t)/,''):'  '+line);}
 markdownInsert(type){
  if(this.source.hidden)return;
  const wraps={bold:['**','**'],italic:['*','*'],strike:['~~','~~'],'inline-code':['`','`'],code:['\n\n```\n','\n```\n\n'],table:['\n\n| 标题 | 标题 |\n| --- | --- |\n| 内容 | 内容 |\n\n',''],rule:['\n\n---\n\n','']};
  if(wraps[type])return this.editor.insertMarkdown(...wraps[type]);
  if(type==='heading'){this.lines(s=>'## '+s.replace(/^#{1,6}\s+/,''));return;}
  if(type==='quote'){this.lines(s=>'> '+s);return;}
  const marker=type==='ordered'?'1. ':type==='check'?'- [ ] ':'- ';this.lines(line=>line.replace(/^(\s*)(?:(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?)?(.*)$/,(_,space,text)=>space+marker+text));
 }
}
