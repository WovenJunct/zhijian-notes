import {chooseNewTemplate} from './note-knowledge.js';
import {call} from './bridge.js';
import {$,esc,icon,empty,day,error,toast} from './ui.js';
import {choose,prompt,confirm} from './dialogs.js';
import {renderReview} from './review.js';
export const filters={search:'',folderId:'',tag:'',favorite:false,sort:'updated',mode:'',from:0,to:0};
let layout='list',preferencesLoaded=false;
const firstLine=value=>String(value||'').split(/\r?\n/).map(s=>s.trim()).find(Boolean)||'';

export async function pickFolder(title='放入文件夹'){
 const {items}=await call('folders.list',{limit:200});
 let id=await choose(title,[{label:'未分类',value:''},...items.map(f=>({label:f.name,value:f.id,icon:'folder'})),{label:'新建文件夹',value:'__new',icon:'plus'}]);
 if(id==='__new'){const name=await prompt('新建文件夹');if(!name?.trim())return null;id=(await call('folders.save',{name:name.trim()})).id;}
 return id;
}
export async function renderNotes(ctx){
 const generation=ctx.generation;
 if(!preferencesLoaded){const info=await call('app.info');filters.sort=info.preferences?.sort||'updated';layout=info.preferences?.layout||'list';preferencesLoaded=true;}
 const [folders,tags]=await Promise.all([call('folders.list',{limit:200}),call('tags.list')]);if(generation!==ctx.generation)return;
 let request=0,timer,selecting=false,selected=new Set(),rows=new Map(),busy=false;
 ctx.page.innerHTML=`<header class="page-header"><div><div class="eyebrow">YOUR PRIVATE NOTEBOOK</div><h1>纸间</h1><p class="subtitle">把片刻，留在纸间。</p></div><div class="header-seal" aria-hidden="true">随手记</div></header>
 <label class="search">${icon('search')}<input id="note-search" aria-label="搜索笔记" placeholder="寻找一页笔记……" value="${esc(filters.search)}" autocomplete="off"></label>
 <div class="filter-bar"><div class="filter-scroll"><button class="chip ${!filters.favorite?'active':''}" data-filter="all">全部笔记</button><button class="chip ${filters.favorite?'active':''}" data-filter="favorites">收藏</button><button class="chip ${filters.tag?'active':''}" id="tag-filter">${filters.tag?'# '+esc(filters.tag):'标签'}</button></div><button class="icon-button" id="manage-folders" aria-label="管理文件夹">${icon('folder')}</button></div>
 <div class="library-tools"><select class="filter-select" id="folder-filter" aria-label="筛选文件夹"><option value="">所有文件夹</option><option value="__unfiled">未分类</option>${folders.items.map(f=>`<option value="${f.id}">${esc(f.name)}</option>`).join('')}</select><select class="filter-select" id="note-sort" aria-label="笔记排序"><option value="updated">最近编辑</option><option value="created">最新创建</option><option value="oldest">最早创建</option><option value="title">标题排序</option></select><button class="icon-button" id="view-toggle" aria-label="切换为${layout==='list'?'网格':'列表'}视图">${icon(layout==='list'?'grid':'list')}</button><button class="icon-button" id="select-mode" aria-label="批量整理">${icon('checkSquare')}</button></div>
 <div class="library-summary"><span id="note-total"></span><select class="type-filter" id="mode-filter" aria-label="笔记类型"><option value="">全部类型</option><option value="rich">图文</option><option value="markdown">Markdown</option></select><button class="text-button" id="open-review">${icon('calendar')}笔记回顾</button></div>
 <div id="date-filter" ${filters.from?'':'hidden'}><span id="date-filter-label"></span><button class="text-button" id="date-filter-clear" aria-label="清除日期筛选">${icon('x')}清除日期</button></div><div id="review-slot"></div>
 <div class="selection-bar" id="selection-bar" hidden><div class="selection-heading"><strong id="selected-total">已选 0 项</strong><button class="text-button" id="select-page">选择本页</button><button class="text-button" id="selection-cancel">完成</button></div><div class="selection-actions"><button id="selection-move" aria-label="移动所选笔记">${icon('folder')}移动</button><button id="selection-favorite" aria-label="收藏所选笔记">${icon('star')}收藏</button><button id="selection-export" aria-label="导出所选笔记">${icon('download')}导出</button><button class="danger" id="selection-trash" aria-label="删除所选笔记">${icon('trash')}删除</button></div></div>
 <div class="notes-list ${layout}-view" id="notes-list"></div><div class="page-footnote">纸短情长 · 慢慢写</div><button class="fab" id="new-note" aria-label="新建笔记">${icon('plus')}</button>`;
 $('#folder-filter').value=filters.folderId;$('#note-sort').value=filters.sort;$('#mode-filter').value=filters.mode;
 if(filters.from)$('#date-filter-label').textContent=new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'long',day:'numeric'}).format(new Date(filters.from));
 function selectionUI(){
  $('#selection-bar').hidden=!selecting;$('#new-note').hidden=selecting;$('#selected-total').textContent=`已选 ${selected.size} 项`;
  for(const b of ctx.page.querySelectorAll('.selection-actions button'))b.disabled=busy||!selected.size;
  for(const card of ctx.page.querySelectorAll('.note-card')){const id=card.dataset.id;card.classList.toggle('selected',selected.has(id));card.querySelector('.card-select').hidden=!selecting;card.querySelector('input').checked=selected.has(id);card.querySelector('.card-menu').hidden=selecting;}
 }
 function beginSelection(id){selecting=true;if(id)selected.add(id);selectionUI();ctx.back=()=>{selecting=false;selected.clear();ctx.back=null;selectionUI();};}
 async function load(append=false){
  const serial=++request,list=$('#notes-list');if(generation!==ctx.generation||!list)return;const offset=append?list.querySelectorAll('.note-card').length:0;
  const result=await call('notes.list',{...filters,offset,limit:50});if(generation!==ctx.generation||serial!==request)return;
  if(!append){rows.clear();selected.clear();}for(const n of result.items)rows.set(n.id,n);
  $('#note-total').textContent=result.total+' 页笔记';const html=result.items.map(n=>`<article class="note-card ${n.pinned?'pinned':''}" data-id="${n.id}"><button class="card-open" data-note="${n.id}" aria-label="打开笔记：${esc(n.title||'无标题笔记')}"><div class="card-top"><h3>${esc(n.title||'无标题笔记')}</h3><div class="card-status">${n.pinned?icon('pin'):''}${n.favorite?icon('star'):''}</div></div><p class="preview">${esc(firstLine(n.preview)||'这一页，等你慢慢写。')}</p><div class="card-footer"><span class="mode-label">${n.mode==='markdown'?'M↓':'Aa'}</span>${(n.tags||[]).slice(0,2).map(t=>`<span class="tiny-tag">${esc(t)}</span>`).join('')}<span class="note-date">${day(filters.sort==='created'||filters.sort==='oldest'?n.createdAt:n.updatedAt)}</span></div></button><button class="card-menu icon-button" aria-label="笔记操作：${esc(n.title||'无标题笔记')}" data-menu="${n.id}">${icon('more')}</button><label class="card-select" hidden><input type="checkbox" aria-label="选择笔记：${esc(n.title||'无标题笔记')}" data-select="${n.id}"></label></article>`).join('');
  $('#load-more')?.remove();if(append)list.insertAdjacentHTML('beforeend',html);else list.innerHTML=html||empty(filters.search||filters.folderId||filters.favorite||filters.tag||filters.from||filters.mode?'没有找到这一页':'第一笔，从这里开始',filters.search?'换个关键词试试。':'点右下角的 ＋，写下想记住的事。');
  if(offset+result.items.length<result.total){list.insertAdjacentHTML('beforeend','<button id="load-more" class="secondary wide-button">继续翻页</button>');$('#load-more').onclick=()=>load(true).catch(error);}
  for(const b of list.querySelectorAll('[data-note]')){
   let hold,x,y,held=false;
   b.onclick=()=>{if(held){held=false;return;}if(selecting){selected.has(b.dataset.note)?selected.delete(b.dataset.note):selected.add(b.dataset.note);selectionUI();}else ctx.openNote(b.dataset.note).catch(error);};
   b.onpointerdown=e=>{held=false;x=e.clientX;y=e.clientY;hold=setTimeout(()=>{held=true;beginSelection(b.dataset.note);},550);};b.onpointermove=e=>{if(Math.abs(e.clientX-x)+Math.abs(e.clientY-y)>12)clearTimeout(hold);};b.onpointerup=b.onpointercancel=b.onpointerleave=()=>clearTimeout(hold);b.oncontextmenu=e=>{e.preventDefault();clearTimeout(hold);held=true;beginSelection(b.dataset.note);};
  }
  list.querySelectorAll('[data-menu]').forEach(b=>b.onclick=()=>cardMenu(rows.get(b.dataset.menu)).catch(error));
  list.querySelectorAll('[data-select]').forEach(b=>b.onchange=()=>{b.checked?selected.add(b.dataset.select):selected.delete(b.dataset.select);selectionUI();});selectionUI();
 }
 async function undoTrash(ids){await call('notes.batch',{ids,action:'restore'});if(generation===ctx.generation)await load();else await ctx.refreshNotes?.();toast('已撤销删除');}
 async function trash(ids){
  if(!await confirm(ids.length===1?'移入回收站？':`将 ${ids.length} 条笔记移入回收站？`,'可以在设置中的回收站查看和恢复。'))return;
  await call('notes.batch',{ids,action:'trash'});if(generation===ctx.generation){selecting=false;ctx.back=null;await load();}toast(ids.length===1?'已移入回收站':`已移动 ${ids.length} 条笔记到回收站`,{label:'撤销删除',run:()=>undoTrash(ids)});
 }
 async function cardMenu(summary){
  if(!summary||busy)return;const action=await choose(summary.title||'无标题笔记',[{label:'重命名',value:'rename',icon:'pen'},{label:summary.pinned?'取消置顶':'置顶笔记',value:'pin',icon:'pin'},{label:summary.favorite?'取消收藏':'收藏笔记',value:'favorite',icon:'star'},{label:'移动到文件夹',value:'move',icon:'folder'},{label:'复制笔记',value:'duplicate',icon:'copy'},{label:'导出 Markdown',value:'export',icon:'download'},{label:'移入回收站',value:'trash',icon:'trash',danger:true}]);
  if(!action)return;if(action==='trash')return trash([summary.id]);if(action==='export')return ctx.exportNotes([summary.id]);
  const note=await call('notes.get',{id:summary.id});if(generation!==ctx.generation)return;if(action==='rename'){const value=await prompt('重命名笔记',note.title);if(value===null)return;note.title=value;}
  else if(action==='pin')note.pinned=!note.pinned;else if(action==='favorite')note.favorite=!note.favorite;
  else if(action==='move'){const folder=await pickFolder();if(folder===null)return;note.folderId=folder||null;}
  else if(action==='duplicate'){delete note.id;delete note._draftToken;note.title=(note.title||'无标题笔记')+'（副本）';note.pinned=false;}
  await call('notes.save',note);if(generation===ctx.generation)await renderNotes(ctx);toast(action==='duplicate'?'已复制笔记':'已更新');
 }
 async function bulk(action){if(busy||!selected.size)return;const ids=[...selected];if(action==='trash')return trash(ids);if(action==='export')return ctx.exportNotes(ids);let folder;if(action==='move'){folder=await pickFolder('移动所选笔记');if(folder===null)return;}
  const selectionBar=$('#selection-bar');busy=true;selectionUI();try{await call('notes.batch',{ids,action,folderId:folder||''});if(generation===ctx.generation){selecting=false;ctx.back=null;await renderNotes(ctx);}toast('已整理所选笔记');}finally{busy=false;if(generation===ctx.generation&&$('#selection-bar')===selectionBar)selectionUI();}}
 $('#note-search').oninput=e=>{filters.search=e.target.value;clearTimeout(timer);timer=setTimeout(()=>load().catch(error),180);};$('#folder-filter').onchange=e=>{filters.folderId=e.target.value;load().catch(error);};$('#mode-filter').onchange=e=>{filters.mode=e.target.value;load().catch(error);};
 $('#note-sort').onchange=async e=>{filters.sort=e.target.value;try{await call('app.preferences',{sort:filters.sort});await load();}catch(err){error(err);}};
 $('#view-toggle').onclick=async()=>{layout=layout==='list'?'grid':'list';try{await call('app.preferences',{layout});if(generation!==ctx.generation)return;$('#notes-list').className=`notes-list ${layout}-view`;$('#view-toggle').innerHTML=icon(layout==='list'?'grid':'list');$('#view-toggle').setAttribute('aria-label','切换为'+(layout==='list'?'网格':'列表')+'视图');}catch(err){error(err);}};
 $('#select-mode').onclick=()=>beginSelection();$('#selection-cancel').onclick=()=>ctx.back?.();$('#select-page').onclick=()=>{for(const id of rows.keys())selected.add(id);selectionUI();};for(const action of ['move','favorite','export','trash'])$('#selection-'+action).onclick=()=>bulk(action).catch(error);
 for(const b of ctx.page.querySelectorAll('[data-filter]'))b.onclick=()=>{filters.favorite=b.dataset.filter==='favorites';ctx.page.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));load().catch(error);};
 $('#tag-filter').onclick=async()=>{const value=await choose('按标签查看',[{label:'所有标签',value:''},...tags.items.map(t=>({label:t,value:t,icon:'tag'}))]);if(value===null)return;filters.tag=value;$('#tag-filter').textContent=value?'# '+value:'标签';$('#tag-filter').classList.toggle('active',!!value);load().catch(error);};
 $('#date-filter-clear').onclick=()=>{filters.from=filters.to=0;$('#date-filter').hidden=true;load().catch(error);};
 $('#open-review').onclick=()=>renderReview(ctx,async date=>{const from=new Date(date+'T00:00:00'),to=new Date(from);to.setDate(to.getDate()+1);filters.from=from.getTime();filters.to=to.getTime();$('#date-filter-label').textContent=date;$('#date-filter').hidden=false;await load();}).catch(error);
 $('#new-note').onclick=async()=>{const mode=await choose('写下新的一页',[{label:'图文笔记',detail:'轻松排版，插入照片，随手记录',icon:'pen',value:'rich'},{label:'Markdown',detail:'代码、列表与表格，专注写作',icon:'code',value:'markdown'},{label:'从模板新建',detail:'会议、阅读、复盘与我的模板',icon:'copy',value:'template'}]);if(!mode)return;try{if(mode==='template'){await chooseNewTemplate(ctx,filters.folderId&&filters.folderId!=='__unfiled'?filters.folderId:null);return;}const n=await call('notes.save',{title:'',content:'',plainText:'',mode,tags:[],folderId:filters.folderId&&filters.folderId!=='__unfiled'?filters.folderId:null,pinned:false,favorite:false});await ctx.openNote(n.id);}catch(e){error(e);}};
 $('#manage-folders').onclick=()=>manageFolders(ctx).catch(error);await load();
}
async function manageFolders(ctx){const generation=ctx.generation;const {items}=await call('folders.list',{limit:200});const action=await choose('管理文件夹',[{label:'新建文件夹',icon:'plus',value:'new'},...items.map(f=>({label:f.name,icon:'folder',value:f.id}))]);if(action===null)return;if(action==='new'){const name=await prompt('新建文件夹');if(name?.trim())await call('folders.save',{name:name.trim()});}else{const folder=items.find(f=>f.id===action);const op=await choose(folder.name,[{label:'重命名',value:'rename',icon:'pen'},{label:'删除文件夹',detail:'其中的笔记会移到「未分类」',value:'delete',icon:'trash',danger:true}]);if(op==='rename'){const name=await prompt('重命名文件夹',folder.name);if(name?.trim())await call('folders.save',{...folder,name:name.trim()});}else if(op==='delete'&&await confirm('删除文件夹？','其中的笔记会保留，并移到未分类。',true)){await call('folders.delete',{id:folder.id});if(filters.folderId===folder.id)filters.folderId='';toast('文件夹已删除，笔记已保留');}}if(generation===ctx.generation)await renderNotes(ctx);}
