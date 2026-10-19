// Local-only, flattened PNG editing. The base image and new ink stay separate
// until export, so erasing an annotation never removes the original image.
const MAX_SIDE=2048,MAX_PIXELS=2097152,MAX_STATES=8,MAX_HISTORY_CHARS=12*1024*1024;
const COLORS=[['墨黑','#39362f'],['陶红','#ad583e'],['苔绿','#63785e'],['海蓝','#3e7192'],['金黄','#c69632'],['纸白','#fffdf7']];
let active=null;
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
function canvas(width,height){const c=document.createElement('canvas');c.width=width;c.height=height;return c;}
function image(src,signal){return new Promise((resolve,reject)=>{
 const img=new Image(),settle=(fn,value)=>{signal?.removeEventListener('abort',abort);img.onload=img.onerror=null;fn(value);},abort=()=>{img.removeAttribute('src');settle(reject,Error('画布已关闭'));};
 img.onload=()=>settle(resolve,img);img.onerror=()=>settle(reject,Error('图片读取失败，请重试'));if(signal?.aborted){abort();return;}signal?.addEventListener('abort',abort,{once:true});img.src=src;
});}
function button(action,label,extra=''){return `<button type="button" data-cw="${action}" aria-label="${label}" ${extra}>${label}</button>`;}
function ui(handwriting){return `
 <header class="cw-top"><button type="button" data-cw="close" class="cw-close" aria-label="关闭画布">‹ <span>返回</span></button><div class="cw-heading"><h2 id="cw-title">${handwriting?'手写纸页':'图片编辑'}</h2><span class="cw-status" aria-live="polite">正在准备画布…</span></div><button type="button" data-cw="save" class="cw-save" aria-label="保存图片" disabled>保存</button></header>
 <p class="cw-description">${handwriting?'用指尖或触控笔，记下一页灵感。保存后作为图片插入笔记。':'调整图片或添加标注；保存后生成一张新图片。'}</p>
 <div class="cw-tools" role="toolbar" aria-label="绘画工具">
  ${button('pen','画笔','aria-pressed="true"')}${button('eraser','橡皮','aria-pressed="false"')}${button('pan','移动画布','aria-pressed="false"')}
  <span class="cw-divider"></span>${button('undo','撤销','disabled')}${button('redo','重做','disabled')}${button('clear','清空标注')}
 </div>
 <div class="cw-brush-tools"><div class="cw-colors" role="group" aria-label="画笔颜色">${COLORS.map(([label,color],i)=>`<button type="button" data-color="${color}" style="--swatch:${color}" aria-label="${label}" aria-pressed="${i===0}"><span></span></button>`).join('')}</div><label class="cw-width">粗细 <input type="range" min="2" max="40" value="6" aria-label="画笔粗细"><output>6</output></label></div>
 <div class="cw-stage" aria-label="画布预览，可用画笔书写或选择移动画布" tabindex="0"><div class="cw-paper"><canvas class="cw-canvas" aria-label="图片画布"></canvas><div class="cw-crop-box" role="group" aria-label="裁剪选区，方向键移动，按住 Shift 调整大小" tabindex="0" hidden>${['nw','ne','sw','se'].map((corner,i)=>`<button type="button" class="cw-handle cw-${corner}" data-handle="${corner}" aria-label="调整${['左上','右上','左下','右下'][i]}裁剪角"></button>`).join('')}<span class="cw-crop-size"></span></div></div><div class="cw-loading" role="status">正在准备画布…</div></div>
 <div class="cw-crop-actions" hidden><span>拖动框内移动 · 拖动四角调整</span>${button('crop-cancel','取消裁剪')}${button('crop-apply','应用裁剪','disabled')}</div>
 <div class="cw-tools cw-image-tools" role="toolbar" aria-label="图片调整">${button('crop','裁剪')}${button('rotate','顺时针旋转')}${button('flip-x','水平翻转')}${button('flip-y','垂直翻转')}</div>
 <footer class="cw-bottom"><div class="cw-zoom">${button('zoom-out','缩小')}<output class="cw-zoom-value" aria-label="当前缩放">100%</output>${button('zoom-in','放大')}${button('fit','适合窗口')}</div><p class="cw-hint">橡皮仅擦除本次新增标注</p></footer>
 <div class="cw-notice" role="status" hidden></div><div class="cw-confirm-shade" hidden></div>`;}

/** Opens a separate modal. Resolves true only after the awaited save succeeds. */
export async function openCanvas({src=null,handwriting=false,onSave}={}){
 if(active)return false;
 const dialog=document.createElement('dialog');dialog.className='canvas-workshop';dialog.setAttribute('aria-labelledby','cw-title');dialog.innerHTML=ui(handwriting);
 const s={dialog,handwriting,onSave,base:canvas(1,1),ink:canvas(1,1),tool:'pen',color:COLORS[0][1],width:6,scale:1,offsetX:0,offsetY:0,history:[],index:-1,serial:0,ready:false,busy:false,closed:false,cropMode:false,crop:null,gesture:null,confirmation:null,previousFocus:document.activeElement,previousOverflow:document.body.style.overflow};
 s.done=new Promise(resolve=>s.resolve=resolve);s.$=selector=>dialog.querySelector(selector);s.display=s.$('.cw-canvas');s.stage=s.$('.cw-stage');s.paper=s.$('.cw-paper');s.cropBox=s.$('.cw-crop-box');active=s;
 document.body.append(dialog);document.body.style.overflow='hidden';dialog.showModal();bind(s);
 initialize(s,src);return s.done;
}
async function initialize(s,src){
 const handwriting=s.handwriting;
 try{
  let width=1200,height=1600,source=null;
  if(src){
   const url=new URL(src,document.baseURI);
   if(url.origin!==location.origin||url.search||url.hash||!/(?:^|\/)media\/[a-zA-Z0-9_.-]+\.(?:png|jpe?g|webp|gif)$/i.test(url.pathname))throw Error('只能编辑笔记中的本地图片');
   s.staticGif=/\.gif$/i.test(url.pathname);
   source=await image(url.href,s.abort.signal);width=source.naturalWidth;height=source.naturalHeight;
   if(!width||!height)throw Error('图片尺寸无效');
  }
  if(active!==s)return;
  const ratio=Math.min(1,MAX_SIDE/Math.max(width,height),Math.sqrt(MAX_PIXELS/(width*height)));
  width=Math.max(1,Math.floor(width*ratio));height=Math.max(1,Math.floor(height*ratio));
  s.base.width=s.ink.width=width;s.base.height=s.ink.height=height;
  if(source)s.base.getContext('2d').drawImage(source,0,0,width,height);
  s.basePng=s.base.toDataURL('image/png');s.ready=true;record(s);render(s);fit(s);update(s);s.$('.cw-loading').hidden=true;
  if(src&&handwriting)s.$('.cw-hint').textContent='已有笔迹已合并为底图；可继续书写，橡皮仅擦除新增笔迹';
  else if(s.staticGif)s.$('.cw-hint').textContent='GIF 使用第一帧保存为静态 PNG；橡皮仅擦除新增标注';
  s.resize=new ResizeObserver(()=>{if(active===s&&s.ready)fit(s);});s.resize.observe(s.stage);
  s.$('[data-cw="pen"]').focus();
 }catch(e){if(active===s){notify(s,e.message||'画布打开失败');s.$('.cw-loading').textContent=e.message||'画布打开失败';s.$('.cw-status').textContent='无法打开图片';s.$('[data-cw="close"]').focus();}}
}
export function isCanvasOpen(){return !!active;}
/** Native Android back uses this promise; saving cannot be interrupted. */
export async function requestCanvasClose(){
 const s=active;if(!s)return true;if(s.busy)return false;
 if(s.confirmation){s.confirmation(false);return false;}
 finishGesture(s);
 if(dirty(s)&&!await ask(s,'放弃未保存的更改？','关闭后，本次绘画和图片调整将不会保存。','放弃更改'))return false;
 if(active===s)finish(s,false);return true;
}
/** Owner destruction always settles the session and releases canvas memory. */
export function destroyCanvas(){if(active)finish(active,false);}
function finish(s,saved){
 if(s.closed)return;s.closed=true;s.confirmation?.(false);s.resize?.disconnect();clearTimeout(s.noticeTimer);s.abort.abort();s.dialog.close();s.dialog.remove();s.history.length=0;
 for(const c of [s.base,s.ink,s.display])c.width=c.height=1;
 document.body.style.overflow=s.previousOverflow;if(active===s)active=null;s.resolve(saved);if(s.previousFocus?.isConnected)s.previousFocus.focus({preventScroll:true});
}
function dirty(s){return s.history[s.index]?.id!==0&&s.index>=0;}
function snapshot(s){return {base:s.basePng,ink:s.ink.toDataURL('image/png'),width:s.base.width,height:s.base.height,id:s.serial++};}
function record(s){
 const entry=snapshot(s),prior=s.history[s.index];
 if(prior&&prior.base===entry.base&&prior.ink===entry.ink&&prior.width===entry.width&&prior.height===entry.height)return false;
 s.history.splice(s.index+1);s.history.push(entry);s.index=s.history.length-1;
 const size=()=>[...new Set(s.history.flatMap(entry=>[entry.base,entry.ink]))].reduce((n,str)=>n+str.length,0);
 while(s.history.length>1&&(s.history.length>MAX_STATES||size()>MAX_HISTORY_CHARS)){s.history.shift();s.index--;}
 update(s);return true;
}
async function restore(s,index){
 if(index<0||index>=s.history.length)return;finishGesture(s);s.busy=true;update(s);
 try{const entry=s.history[index],[base,ink]=await Promise.all([image(entry.base),image(entry.ink)]);if(active!==s)return;
  s.base.width=s.ink.width=entry.width;s.base.height=s.ink.height=entry.height;s.base.getContext('2d').drawImage(base,0,0);s.ink.getContext('2d').drawImage(ink,0,0);s.basePng=entry.base;s.index=index;leaveCrop(s);render(s);fit(s);
 }catch{notify(s,'无法恢复这一步，请重试');}finally{if(active===s){s.busy=false;update(s);}}
}
function composite(s,ctx){
 ctx.clearRect(0,0,s.base.width,s.base.height);
 if(s.handwriting){ctx.fillStyle='#fcfaf5';ctx.fillRect(0,0,s.base.width,s.base.height);}
 ctx.drawImage(s.base,0,0);ctx.drawImage(s.ink,0,0);
}
function render(s){
 if(s.display.width!==s.base.width||s.display.height!==s.base.height){s.display.width=s.base.width;s.display.height=s.base.height;s.paper.style.width=s.base.width+'px';s.paper.style.height=s.base.height+'px';}
 composite(s,s.display.getContext('2d'));
}
function update(s){
 const locked=!s.ready||s.busy||!!s.confirmation;
 s.dialog.setAttribute('aria-busy',String(s.busy));
 s.dialog.querySelectorAll('[data-cw],.cw-colors button,input[type="range"]').forEach(el=>{el.disabled=locked;});
 s.$('[data-cw="close"]').disabled=s.busy;
 s.$('[data-cw="save"]').disabled=locked||s.cropMode;
 s.$('[data-cw="save"]').textContent=s.busy?'处理中…':'保存';
 s.$('[data-cw="undo"]').disabled=locked||s.index<=0||s.cropMode;
 s.$('[data-cw="redo"]').disabled=locked||s.index>=s.history.length-1||s.cropMode;
 s.$('[data-cw="crop-apply"]').disabled=locked||!s.crop||s.crop.w<8||s.crop.h<8;
 s.$('.cw-status').textContent=s.ready?`${s.base.width} × ${s.base.height} · ${dirty(s)?'未保存':'可开始编辑'}`:'正在准备画布…';
 ['pen','eraser','pan','crop'].forEach(tool=>s.$(`[data-cw="${tool}"]`).setAttribute('aria-pressed',String(s.cropMode?tool==='crop':tool===s.tool)));
 s.stage.dataset.tool=s.cropMode?'crop':s.tool;
 s.$('.cw-crop-actions').hidden=!s.cropMode;s.$('.cw-image-tools').hidden=s.cropMode;
}
function fit(s){
 if(!s.ready||!s.stage.clientWidth||!s.stage.clientHeight)return;
 s.scale=Math.min((s.stage.clientWidth-36)/s.base.width,(s.stage.clientHeight-36)/s.base.height,2);
 s.offsetX=(s.stage.clientWidth-s.base.width*s.scale)/2;s.offsetY=(s.stage.clientHeight-s.base.height*s.scale)/2;view(s);
}
function view(s){s.paper.style.transform=`translate(${s.offsetX}px,${s.offsetY}px) scale(${s.scale})`;s.cropBox.style.setProperty('--crop-inverse',String(1/s.scale));s.$('.cw-zoom-value').value=Math.round(s.scale*100)+'%';}
function zoom(s,factor){
 const scale=clamp(s.scale*factor,.04,6),cx=s.stage.clientWidth/2,cy=s.stage.clientHeight/2;
 s.offsetX=cx-(cx-s.offsetX)*scale/s.scale;s.offsetY=cy-(cy-s.offsetY)*scale/s.scale;s.scale=scale;view(s);
}
function point(s,event){const r=s.display.getBoundingClientRect();return {x:clamp((event.clientX-r.left)/s.scale,0,s.base.width),y:clamp((event.clientY-r.top)/s.scale,0,s.base.height)};}
function inside(s,event){const r=s.display.getBoundingClientRect();return event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom;}
function pressure(event){return event.pointerType==='pen'&&event.pressure>0?clamp(event.pressure,.15,1)*1.5:1;}
function paint(s,from,to,event){
 const ctx=s.ink.getContext('2d'),width=(s.tool==='eraser'?Math.max(20,s.width*3):s.width)*pressure(event);
 ctx.globalCompositeOperation=s.tool==='eraser'?'destination-out':'source-over';ctx.fillStyle=s.color;ctx.strokeStyle=s.color;ctx.lineWidth=width;ctx.lineCap=ctx.lineJoin='round';
 if(!from){ctx.beginPath();ctx.arc(to.x,to.y,width/2,0,2*Math.PI);ctx.fill();}
 else{ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();}
 ctx.globalCompositeOperation='source-over';
}
function finishGesture(s){
 const g=s.gesture;if(!g)return;s.gesture=null;
 if(g.type==='draw'){render(s);record(s);}
 try{if(s.stage.hasPointerCapture(g.id))s.stage.releasePointerCapture(g.id);}catch{}
}
function pointerDown(s,event){
 if(!s.ready||s.busy||s.confirmation||s.gesture||event.button!==0)return;
 if(!s.cropMode&&s.tool!=='pan'&&!inside(s,event))return;
 event.preventDefault();s.stage.setPointerCapture(event.pointerId);const p=point(s,event);
 if(s.cropMode){const handle=event.target.closest('[data-handle]')?.dataset.handle,move=!handle&&event.target.closest('.cw-crop-box');s.gesture={id:event.pointerId,type:'crop',start:p,handle,move,original:s.crop?{...s.crop}:null};if(!handle&&!move)s.crop={x:p.x,y:p.y,w:0,h:0};drawCrop(s);}
 else if(s.tool==='pan')s.gesture={id:event.pointerId,type:'pan',x:event.clientX,y:event.clientY,offsetX:s.offsetX,offsetY:s.offsetY};
 else{s.gesture={id:event.pointerId,type:'draw',last:p};paint(s,null,p,event);render(s);}
}
function pointerMove(s,event){
 const g=s.gesture;if(!g||g.id!==event.pointerId)return;event.preventDefault();
 if(g.type==='pan'){s.offsetX=g.offsetX+event.clientX-g.x;s.offsetY=g.offsetY+event.clientY-g.y;view(s);return;}
 if(g.type==='crop'){
  const p=point(s,event),start=g.start,rect=g.original;
  if(g.move&&rect)s.crop={...rect,x:clamp(rect.x+p.x-start.x,0,s.base.width-rect.w),y:clamp(rect.y+p.y-start.y,0,s.base.height-rect.h)};
  else if(g.handle&&rect){let x1=rect.x,y1=rect.y,x2=rect.x+rect.w,y2=rect.y+rect.h;if(g.handle.includes('w'))x1=p.x;else x2=p.x;if(g.handle.includes('n'))y1=p.y;else y2=p.y;s.crop={x:Math.min(x1,x2),y:Math.min(y1,y2),w:Math.abs(x2-x1),h:Math.abs(y2-y1)};}
  else s.crop={x:Math.min(start.x,p.x),y:Math.min(start.y,p.y),w:Math.abs(start.x-p.x),h:Math.abs(start.y-p.y)};
  drawCrop(s);return;
 }
 const events=event.getCoalescedEvents?.()||[event];for(const sample of events.length?events:[event]){const p=point(s,sample);paint(s,g.last,p,sample);g.last=p;}render(s);
}
function drawCrop(s){
 const r=s.crop;s.cropBox.hidden=!r||r.w<1||r.h<1;
 if(r){Object.assign(s.cropBox.style,{left:r.x+'px',top:r.y+'px',width:r.w+'px',height:r.h+'px','--crop-inverse':String(1/s.scale)});s.$('.cw-crop-size').textContent=`${Math.round(r.w)} × ${Math.round(r.h)}`;}
 update(s);
}
function leaveCrop(s){s.cropMode=false;s.crop=null;s.cropBox.hidden=true;update(s);}
function transform(s,width,height,draw){
 finishGesture(s);for(const name of ['base','ink']){const next=canvas(width,height);draw(next.getContext('2d'),s[name]);s[name].width=s[name].height=1;s[name]=next;}
 s.basePng=s.base.toDataURL('image/png');record(s);render(s);fit(s);update(s);
}
function crop(s){
 const r=s.crop;if(!r||r.w<8||r.h<8)return;
 const x=Math.floor(r.x),y=Math.floor(r.y),w=Math.min(s.base.width-x,Math.round(r.w)),h=Math.min(s.base.height-y,Math.round(r.h));leaveCrop(s);
 transform(s,w,h,(ctx,layer)=>ctx.drawImage(layer,x,y,w,h,0,0,w,h));
}
async function save(s){
 if(!s.ready||s.busy||s.cropMode||s.confirmation)return;finishGesture(s);
 if(typeof s.onSave!=='function'){notify(s,'未连接图片保存功能');return;}
 s.busy=true;update(s);
 try{render(s);await s.onSave({dataUrl:s.display.toDataURL('image/png')});if(active===s)finish(s,true);}
 catch(e){if(active===s){s.busy=false;update(s);notify(s,e?.message||'保存未完成，请重试');}}
}
function notify(s,message){const el=s.$('.cw-notice');el.textContent=message;el.hidden=false;clearTimeout(s.noticeTimer);s.noticeTimer=setTimeout(()=>el.hidden=true,4500);}
function ask(s,title,message,accept){
 if(s.confirmation)return Promise.resolve(false);
 const shade=s.$('.cw-confirm-shade'),focus=document.activeElement;shade.replaceChildren();const box=document.createElement('section');box.className='cw-confirm';box.setAttribute('role','alertdialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-labelledby','cw-confirm-title');box.setAttribute('aria-describedby','cw-confirm-text');
 const heading=document.createElement('h3');heading.id='cw-confirm-title';heading.textContent=title;const text=document.createElement('p');text.id='cw-confirm-text';text.textContent=message;const actions=document.createElement('div');actions.className='cw-confirm-actions';const cancel=document.createElement('button');cancel.type='button';cancel.textContent='继续编辑';const yes=document.createElement('button');yes.type='button';yes.textContent=accept;yes.className='cw-confirm-yes';actions.append(cancel,yes);box.append(heading,text,actions);shade.append(box);shade.hidden=false;
 return new Promise(resolve=>{s.confirmation=value=>{s.confirmation=null;shade.hidden=true;shade.replaceChildren();update(s);if(focus?.isConnected)focus.focus({preventScroll:true});resolve(value);};cancel.onclick=()=>s.confirmation?.(false);yes.onclick=()=>s.confirmation?.(true);update(s);cancel.focus();});
}
function bind(s){
 s.abort=new AbortController();const options={signal:s.abort.signal};
 s.dialog.addEventListener('cancel',event=>{event.preventDefault();requestCanvasClose();},options);
 s.dialog.addEventListener('keydown',event=>{
  if(s.confirmation&&event.key==='Tab'){const buttons=s.$('.cw-confirm').querySelectorAll('button');event.preventDefault();(document.activeElement===buttons[0]?buttons[1]:buttons[0]).focus();return;}
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();if(!s.busy&&!s.cropMode&&!s.confirmation)restore(s,s.index+(event.shiftKey?1:-1));}
 },options);
 s.dialog.addEventListener('click',async event=>{
  const el=event.target.closest('[data-cw]');if(!el||el.disabled)return;const action=el.dataset.cw;
  if(action==='close'){await requestCanvasClose();return;}if(!s.ready||s.busy||s.confirmation)return;
  finishGesture(s);
  if(['pen','eraser','pan'].includes(action)){leaveCrop(s);s.tool=action;update(s);}
  else if(action==='undo'||action==='redo')await restore(s,s.index+(action==='undo'?-1:1));
  else if(action==='clear'){if(await ask(s,'清空新增标注？',s.handwriting?'本次新增的笔迹会被清空，已有底图会保留。':'只清空新增标注，原始图片会保留。','确认清空')){if(active!==s)return;s.ink.getContext('2d').clearRect(0,0,s.ink.width,s.ink.height);record(s);render(s);}}
  else if(action==='crop'){s.cropMode=true;s.crop=null;drawCrop(s);notify(s,'在图片上拖动，选择要保留的矩形区域');}
  else if(action==='crop-cancel')leaveCrop(s);
  else if(action==='crop-apply')crop(s);
  else if(action==='rotate'){const w=s.base.width,h=s.base.height;transform(s,h,w,(ctx,layer)=>{ctx.translate(h,0);ctx.rotate(Math.PI/2);ctx.drawImage(layer,0,0);});}
  else if(action==='flip-x'||action==='flip-y'){const w=s.base.width,h=s.base.height;transform(s,w,h,(ctx,layer)=>{ctx.translate(action==='flip-x'?w:0,action==='flip-y'?h:0);ctx.scale(action==='flip-x'?-1:1,action==='flip-y'?-1:1);ctx.drawImage(layer,0,0);});}
  else if(action==='zoom-in'||action==='zoom-out')zoom(s,action==='zoom-in'?1.3:1/1.3);
  else if(action==='fit')fit(s);
  else if(action==='save')await save(s);
 },options);
 s.$('.cw-colors').addEventListener('click',event=>{const el=event.target.closest('[data-color]');if(!el||s.busy||s.confirmation)return;s.color=el.dataset.color;s.dialog.querySelectorAll('[data-color]').forEach(b=>b.setAttribute('aria-pressed',String(b===el)));},options);
 s.$('input[type="range"]').addEventListener('input',event=>{s.width=Number(event.target.value);s.$('.cw-width output').value=s.width;},options);
 s.stage.addEventListener('pointerdown',event=>pointerDown(s,event),options);s.stage.addEventListener('pointermove',event=>pointerMove(s,event),options);
 for(const type of ['pointerup','pointercancel','lostpointercapture'])s.stage.addEventListener(type,event=>{if(s.gesture?.id===event.pointerId)finishGesture(s);},options);
 s.stage.addEventListener('wheel',event=>{if(!s.ready||s.busy||s.confirmation)return;event.preventDefault();zoom(s,event.deltaY<0?1.12:1/1.12);},{...options,passive:false});
 s.cropBox.addEventListener('keydown',event=>{
  if(!s.crop||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)||s.busy||s.confirmation)return;event.preventDefault();
  const r=s.crop,delta=event.key==='ArrowLeft'||event.key==='ArrowUp'?-1:1,horizontal=event.key==='ArrowLeft'||event.key==='ArrowRight',step=Math.max(1,Math.round((horizontal?s.base.width:s.base.height)/100)),handle=event.target.dataset.handle;
  if(handle){let x1=r.x,y1=r.y,x2=r.x+r.w,y2=r.y+r.h;if(horizontal){if(handle.includes('w'))x1=clamp(x1+delta*step,0,x2-8);else x2=clamp(x2+delta*step,x1+8,s.base.width);}else{if(handle.includes('n'))y1=clamp(y1+delta*step,0,y2-8);else y2=clamp(y2+delta*step,y1+8,s.base.height);}s.crop={x:x1,y:y1,w:x2-x1,h:y2-y1};}
  else if(event.shiftKey){const key=horizontal?'w':'h';r[key]=clamp(r[key]+delta*step,8,(horizontal?s.base.width-r.x:s.base.height-r.y));}
  else{const key=horizontal?'x':'y';r[key]=clamp(r[key]+delta*step,0,horizontal?s.base.width-r.w:s.base.height-r.h);}drawCrop(s);
 },options);
}
