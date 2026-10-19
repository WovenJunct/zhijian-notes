import {call} from './bridge.js';
import {esc,icon,error} from './ui.js';
import {choose,confirm} from './dialogs.js';

const SOURCE=/^media\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.bin$/i;
function files(items){return Array.isArray(items)?items.filter(item=>item&&SOURCE.test(item.src)&&typeof item.name==='string'&&item.name.length>0&&item.name.length<=240&&typeof item.mime==='string'&&item.mime.length<=120&&Number.isSafeInteger(item.size)&&item.size>=0&&item.size<=20*1024*1024):[];}
function sizeLabel(size){return size<1024?size+' B':size<1024*1024?(size/1024).toFixed(size<10240?1:0)+' KB':(size/(1024*1024)).toFixed(1)+' MB';}
export function attachmentMarkup(items,{readonly=true}={}){
 const list=files(items);if(!list.length)return '';
 return `<section class="note-attachments" aria-label="笔记附件"><div class="note-files-heading">附件 <span>${list.length}</span></div><div class="note-files-list">${list.map(file=>`<div class="note-file-card"><button type="button" class="note-file-open" data-file-src="${esc(file.src)}" aria-label="打开附件：${esc(file.name)}"><span class="note-file-badge" aria-hidden="true">${file.mime==='application/pdf'?'PDF':esc((file.name.split('.').pop()||'FILE').slice(0,5).toUpperCase())}</span><span class="note-file-description"><strong>${esc(file.name)}</strong><small>${sizeLabel(file.size)} · ${file.mime==='application/pdf'?'PDF 文档':'本地文件'}</small></span></button>${readonly?'':`<button type="button" class="note-file-menu" data-file-menu="${esc(file.src)}" aria-label="附件选项：${esc(file.name)}">${icon('more')}</button>`}</div>`).join('')}</div></section>`;
}
/** Returns a cleanup function. Read-only views expose only the system open action. */
export function wireReadonly(root,items){
 const abort=new AbortController();root.addEventListener('click',event=>{const target=event.target.closest('[data-file-src]');if(!target||!root.contains(target))return;const file=files(items).find(item=>item.src===target.dataset.fileSrc);if(file)call('attachments.openFile',file).catch(error);},{signal:abort.signal});return ()=>abort.abort();
}
export class NoteFiles{
 constructor(editor){this.editor=editor;this.destroyed=false;this.busy=false;}
 mount(){
  const root=this.editor.ctx.page,body=root.querySelector('.editor-body');if(!body)return;
  this.host=document.createElement('div');this.host.className='note-files-host';body.after(this.host);this.abort=new AbortController();
  root.querySelector('#insert-file')?.addEventListener('click',()=>this.add().catch(error),{signal:this.abort.signal});
  this.host.addEventListener('click',event=>{const el=event.target.closest('[data-file-src],[data-file-menu]');if(!el)return;const file=files(this.editor.note.attachments).find(item=>item.src===(el.dataset.fileSrc||el.dataset.fileMenu));if(!file)return;if(el.dataset.fileSrc)call('attachments.openFile',file).catch(error);else this.menu(file).catch(error);},{signal:this.abort.signal});this.render();
 }
 render(){if(this.host)this.host.innerHTML=attachmentMarkup(this.editor.note.attachments,{readonly:false});}
 async add(){
  if(this.busy||this.destroyed||!this.editor.live)return;this.busy=true;const button=this.editor.ctx.page.querySelector('#insert-file');if(button)button.disabled=true;
  try{if(files(this.editor.note.attachments).length>=50)throw Error('每条笔记最多添加 50 个附件');await this.editor.flush();const selected=await call('attachments.pickFile');if(!selected?.src||this.destroyed||!this.editor.live)return;if(!files([selected]).length)throw Error('附件信息无效，请重新选择');const current=files(this.editor.note.attachments);if(current.some(file=>file.src===selected.src))return;this.editor.note.attachments=[...current,selected];this.editor.capture();this.render();await this.editor.flush();}
  finally{this.busy=false;if(button?.isConnected)button.disabled=false;}
 }
 async menu(file){
  const action=await choose(file.name,[{label:'打开附件',value:'open',icon:'folder'},{label:'移除附件',value:'remove',icon:'trash',danger:true}]);if(this.destroyed||!this.editor.live)return;
  if(action==='open')await call('attachments.openFile',file);
  else if(action==='remove'&&await confirm('移除这个附件？','附件将从这条笔记中移除。')){if(this.destroyed||!this.editor.live)return;this.editor.note.attachments=files(this.editor.note.attachments).filter(item=>item.src!==file.src);this.editor.capture();this.render();await this.editor.flush();}
 }
 destroy(){this.destroyed=true;this.abort?.abort();this.host?.remove();}
}
