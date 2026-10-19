import assert from 'node:assert/strict';
import {harness} from './harness.mjs';

const h=await harness(),{page}=h;
const title='日期与提醒测试';
async function record(){return page.evaluate(title=>JSON.parse(sessionStorage.getItem('paper-test')).todos.find(todo=>todo.title===title),title);}
async function openDates(){await page.getByRole('button',{name:'待办选项：'+title,exact:true}).click();await page.getByRole('button',{name:'日期与提醒',exact:true}).click();await page.getByLabel('到期日期',{exact:true}).waitFor();}
try{
 await page.evaluate(()=>{
  window.testReminderEnabled=false;window.testReminderRequests=0;
  const request=window.PaperNative.request.bind(window.PaperNative);
  window.PaperNative.request=(id,method,json)=>{
   if(method==='reminders.status')window.PaperBridge.resolve(id,true,{enabled:window.testReminderEnabled,permission:window.testReminderEnabled});
   else if(method==='reminders.requestPermission'){window.testReminderRequests++;window.PaperBridge.resolve(id,true,{enabled:window.testReminderEnabled,permission:window.testReminderEnabled});}
   else request(id,method,json);
  };
 });
 await page.getByRole('button',{name:'待办',exact:true}).click();
 await page.getByLabel('新的待办事项',{exact:true}).fill(title);await page.getByRole('button',{name:'添加待办',exact:true}).click();
 await page.getByRole('checkbox',{name:'完成：'+title,exact:true}).waitFor();assert.ok(!(await record()).reminderAt);
 console.log('PASS new todos do not create automatic reminders');

 await openDates();await page.getByLabel('到期日期',{exact:true}).fill('2000-01-01');
 await page.getByRole('button',{name:'确认',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#todo-list').textContent.includes('已逾期'));
 const dueAt=(await record()).dueAt;assert.ok(dueAt>0);assert.equal((await record()).reminderAt,0);
 console.log('PASS due dates save independently and display overdue state');

 await openDates();await page.getByLabel('启用通知提醒',{exact:true}).check();await page.getByLabel('提醒时间',{exact:true}).fill('2000-01-01T01:00');
 await page.getByRole('button',{name:'确认',exact:true}).click();assert.match(await page.locator('#todo-reminder-error').innerText(),/未来/);assert.ok(await page.locator('#dialog').evaluate(dialog=>dialog.open));
 const future=await page.evaluate(()=>{const date=new Date(Date.now()+7200000),pad=n=>String(n).padStart(2,'0');return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;});
 await page.getByLabel('提醒时间',{exact:true}).fill(future);await page.getByRole('button',{name:'确认',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#todo-list').textContent.includes('提醒待开启通知'));
 assert.ok((await record()).reminderAt>Date.now());assert.equal((await record()).dueAt,dueAt);
 console.log('PASS past reminders are rejected and denied notification permission does not discard dates');

 await openDates();await page.getByRole('button',{name:'允许通知',exact:true}).click();assert.equal(await page.evaluate(()=>window.testReminderRequests),1);
 await page.evaluate(()=>{window.testReminderEnabled=true;window.dispatchEvent(new Event('focus'));});
 await page.waitForFunction(()=>document.querySelector('#todo-reminder-permission').textContent.includes('已允许通知'));
 await page.getByRole('button',{name:'移除提醒',exact:true}).click();assert.equal(await page.getByLabel('启用通知提醒',{exact:true}).isChecked(),false);
 await page.getByRole('button',{name:'确认',exact:true}).click();await page.waitForFunction(title=>JSON.parse(sessionStorage.getItem('paper-test')).todos.find(todo=>todo.title===title)?.reminderAt===0,title);
 assert.equal((await record()).reminderAt,0);assert.equal((await record()).dueAt,dueAt);
 console.log('PASS notification settings refresh on return and reminders can be removed without changing the date');

 await page.getByRole('checkbox',{name:'完成：'+title,exact:true}).check();
 await page.waitForFunction(title=>JSON.parse(sessionStorage.getItem('paper-test')).todos.find(todo=>todo.title===title)?.completed,title);
 await page.locator('#completed-toggle').click();
 await page.getByRole('checkbox',{name:'取消完成：'+title,exact:true}).waitFor();assert.equal((await record()).completed,true);assert.equal((await record()).dueAt,dueAt);
 for(const width of [320,390,412]){await page.setViewportSize({width,height:844});await openDates();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.ok(await page.locator('#dialog').evaluate(dialog=>dialog.scrollWidth<=dialog.clientWidth+1));await page.getByRole('button',{name:'取消',exact:true}).click();}
 console.log('PASS completion preserves dates and the date editor fits narrow screens');
 assert.deepEqual(h.errors,[]);
}finally{await h.close();}
