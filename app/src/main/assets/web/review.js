import {call} from './bridge.js';import {$,icon,error,toast} from './ui.js';
const dateKey=date=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
export async function renderReview(ctx,onDate){
 const slot=$('#review-slot');if(!slot)return;if(slot.childElementCount){slot.replaceChildren();return;}
 const generation=ctx.generation,stats=await call('notes.overview');if(ctx.generation!==generation)return;let month=new Date();month=new Date(month.getFullYear(),month.getMonth(),1);
 function draw(){
  const year=month.getFullYear(),m=month.getMonth(),start=(month.getDay()+6)%7,count=new Date(year,m+1,0).getDate();let days='';
  for(let i=0;i<start;i++)days+='<span></span>';
  for(let day=1;day<=count;day++){const key=dateKey(new Date(year,m,day)),n=stats.dates[key]||0;days+=`<button class="calendar-day ${n?'has-notes':''} ${key===dateKey(new Date())?'today':''}" ${n?`data-review-day="${key}"`:''} aria-label="${key}，${n} 条笔记" ${n?'':'disabled'}><span>${day}</span><small>${n||'·'}</small></button>`;}
  slot.innerHTML=`<section id="review-panel" class="review-panel"><div class="review-heading"><h2>把写过的日子，翻一翻</h2><button class="icon-button" id="review-close" aria-label="关闭笔记回顾">${icon('x')}</button></div><div class="review-stats"><div><strong>${stats.total}</strong><small>页笔记</small></div><div><strong>${Number(stats.words).toLocaleString('zh-CN')}</strong><small>累计字数</small></div><div><strong>${stats.days}</strong><small>记录天数</small></div></div><div class="calendar-heading"><button class="icon-button" id="month-prev" aria-label="上个月">${icon('back')}</button><strong>${year} 年 ${m+1} 月</strong><button class="icon-button" id="month-next" aria-label="下个月">${icon('chevron')}</button><button class="text-button" id="review-today">今天</button></div><div class="calendar-grid">${['一','二','三','四','五','六','日'].map(d=>`<small class="weekday">${d}</small>`).join('')}${days}</div><div class="review-footer"><small>按创建日期回顾 · 不含回收站</small><button class="text-button" id="random-note">${icon('book')}随机翻一页</button></div></section>`;
  $('#review-close').onclick=()=>slot.replaceChildren();$('#month-prev').onclick=()=>{month=new Date(year,m-1,1);draw();};$('#month-next').onclick=()=>{month=new Date(year,m+1,1);draw();};$('#review-today').onclick=()=>{const now=new Date();month=new Date(now.getFullYear(),now.getMonth(),1);draw();};
  slot.querySelectorAll('[data-review-day]').forEach(b=>b.onclick=()=>onDate(b.dataset.reviewDay).catch(error));
  $('#random-note').onclick=async()=>{try{const fresh=await call('notes.overview');if(fresh.randomId)await ctx.openNote(fresh.randomId);else toast('写下第一条笔记后，再来翻一翻。');}catch(e){error(e);}};
 }draw();
}
