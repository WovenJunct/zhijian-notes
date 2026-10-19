import {call} from './bridge.js';
import {$,esc,error} from './ui.js';
import {confirm} from './dialogs.js';

export async function reminderStatus(){
 try{return await call('reminders.status');}catch{return {enabled:false,permission:false,unavailable:true};}
}

function localValue(time,withTime=false){
 if(!time)return '';const date=new Date(time);if(!Number.isFinite(date.getTime()))return '';
 const pad=n=>String(n).padStart(2,'0');
 const day=`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
 return withTime?`${day}T${pad(date.getHours())}:${pad(date.getMinutes())}`:day;
}

export async function editReminder(todo){
 let state=await reminderStatus(),value=null;
 const future=Number(todo.reminderAt)>Date.now();
 const decision=confirm('日期与提醒','日期可以单独保存。通知由手机系统安排，系统可能稍有延迟。');
 const content=$('#dialog-inner'),fields=document.createElement('div');fields.style.cssText='display:grid;gap:16px';
 fields.innerHTML=`<label style="display:grid;gap:8px;font-size:14px">到期日期（可不填）<input class="text-input" id="todo-due-date" type="date" aria-label="到期日期" value="${esc(localValue(todo.dueAt))}"></label><label style="display:flex;align-items:center;gap:10px;font-size:14px"><input id="todo-reminder-enabled" type="checkbox" aria-label="启用通知提醒" ${future?'checked':''}>通知提醒</label><label id="todo-reminder-time-label" style="display:grid;gap:8px;font-size:14px">提醒时间<input class="text-input" id="todo-reminder-time" type="datetime-local" aria-label="提醒时间" value="${esc(future?localValue(todo.reminderAt,true):'')}"></label><div><p id="todo-reminder-permission" class="dialog-description" style="margin:0 0 8px" role="status"></p><button type="button" id="todo-reminder-permit" class="secondary">允许通知</button></div><p id="todo-reminder-error" role="alert" style="font-size:13px;line-height:1.7;color:var(--danger);margin:0"></p>${todo.reminderAt&&!future?'<p class="dialog-description" style="margin:0">原提醒时间已过，可以设置新的提醒。</p>':''}<button id="todo-reminder-clear" type="button" class="secondary">移除提醒</button>`;
 content.insertBefore(fields,content.querySelector('.dialog-actions'));
 const due=$('#todo-due-date'),enabled=$('#todo-reminder-enabled'),time=$('#todo-reminder-time'),notice=$('#todo-reminder-permission'),permit=$('#todo-reminder-permit'),validation=$('#todo-reminder-error');
 const updateFields=()=>{time.disabled=!enabled.checked;$('#todo-reminder-time-label').style.opacity=enabled.checked?'1':'.55';};
 const paintStatus=()=>{notice.textContent=state.enabled?'已允许通知；系统省电设置可能影响到达时间。':state.unavailable?'当前环境无法读取通知设置，仍可保存日期。':'尚未开启通知；日期仍可保存，通知提醒需允许通知。';permit.hidden=!!state.enabled||!!state.unavailable;permit.textContent=state.permission?'打开通知设置':'允许通知';};
 const refresh=async()=>{state=await reminderStatus();if($('#todo-reminder-permission')===notice)paintStatus();};
 enabled.onchange=()=>{validation.textContent='';updateFields();if(enabled.checked&&!time.value){time.value=localValue(Date.now()+3600000,true);time.focus();}};
 $('#todo-reminder-clear').onclick=()=>{enabled.checked=false;time.value='';validation.textContent='';updateFields();};
 permit.onclick=async()=>{permit.disabled=true;try{await call('reminders.requestPermission');await refresh();}catch(e){error(e);}finally{permit.disabled=false;}};
 const validate=e=>{
  const dueAt=due.value?new Date(due.value+'T00:00:00').getTime():0,reminderAt=enabled.checked&&time.value?new Date(time.value).getTime():0;
  let message='';
  if(due.value&&!Number.isFinite(dueAt))message='请填写有效的到期日期。';
  else if(enabled.checked&&(!Number.isFinite(reminderAt)||reminderAt<=Date.now()))message='提醒时间请选择未来的日期和时间。';
  if(message){e.preventDefault();e.stopImmediatePropagation();validation.textContent=message;return;}
  value={dueAt,reminderAt:enabled.checked?reminderAt:0};
 };
 $('#confirm-action').addEventListener('click',validate,true);
 window.addEventListener('focus',refresh);const onVisibility=()=>{if(!document.hidden)refresh();};document.addEventListener('visibilitychange',onVisibility);
 updateFields();paintStatus();
 try{return await decision?value:null;}finally{window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',onVisibility);}
}
