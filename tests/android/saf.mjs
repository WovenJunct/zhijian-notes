import {createRequire} from 'node:module';import path from 'node:path';import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const require=createRequire(import.meta.url),{_android}=require(process.env.PAPER_NODE_MODULES?path.join(process.env.PAPER_NODE_MODULES,'playwright'):'playwright');
import {adb,args,port,serial} from './device-config.mjs';const shell=(...a)=>execFileSync(adb,[...args,'shell',...a],{encoding:'utf8'});
function ui(){shell('uiautomator','dump','/sdcard/paper-ui.xml');return shell('cat','/sdcard/paper-ui.xml');}
async function tapNode(predicate){for(let attempt=0;attempt<12;attempt++){const nodes=ui().match(/<node[^>]+>/g)||[],node=nodes.find(predicate);if(node){const m=node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);assert.ok(m);shell('input','tap',String(Math.floor((+m[1]+ +m[3])/2)),String(Math.floor((+m[2]+ +m[4])/2)));return;}await new Promise(r=>setTimeout(r,250));}throw Error('Expected system file picker control not found');}
async function pullZip(source,destination){const stage=destination+'.part-'+Date.now();try{execFileSync(adb,[...args,'pull',source,stage],{stdio:'pipe'});const bytes=await fs.readFile(stage);assert.ok(bytes.length>100&&bytes.readUInt32LE(0)===0x04034b50,'System export must contain a nonempty ZIP');await fs.copyFile(stage,destination);}finally{await fs.rm(stage,{force:true});}}
shell('am','force-stop','app.zhijian.notes');shell('am','start','-W','-n','app.zhijian.notes/.MainActivity');
const devices=await _android.devices({port,omitDriverInstall:true});const device=devices.find(d=>d.serial()===serial);
try{
 let view;for(let i=0;i<30;i++){view=device.webViews().find(v=>v.pkg()==='app.zhijian.notes');if(view)break;await new Promise(r=>setTimeout(r,300));}assert.ok(view);const page=await view.page();page.setDefaultTimeout(12000);await page.getByRole('button',{name:'设置',exact:true}).click();
 const before=await page.evaluate(async()=>{const {call}=await import('./bridge.js');return (await call('app.info')).lastBackup;});
 await page.getByRole('button',{name:/备份所有内容/}).click();await tapNode(n=>n.includes('resource-id="android:id/button1"')&&n.includes('enabled="true"'));
 await page.waitForFunction(async last=>{const {call}=await import('./bridge.js');return (await call('app.info')).lastBackup>last;},before);console.log('PASS real Android system file picker saves ZIP backup');
 const files=shell('ls','/sdcard/Download').split(/\r?\n/).filter(n=>n.startsWith('纸间备份-')&&n.endsWith('.zip'));assert.ok(files.length);const backup=files.at(-1);await pullZip('/sdcard/Download/'+backup,'.toolchain/native-backup.zip');
 const originalCount=await page.evaluate(async()=>{const {call}=await import('./bridge.js');return (await call('notes.list',{})).total;});
 await page.getByRole('button',{name:/从备份恢复/}).click();await page.getByRole('button',{name:'确认',exact:true}).click();await tapNode(n=>n.includes('text="'+backup+'"'));
 await page.locator('#toast').filter({hasText:/恢复完成/}).waitFor();const afterCount=await page.evaluate(async()=>{const {call}=await import('./bridge.js');return (await call('notes.list',{})).total;});assert.equal(afterCount,originalCount);console.log('PASS real Android system picker restores without duplicating notes');
 await page.getByRole('button',{name:/导出 Markdown/}).click();await tapNode(n=>n.includes('resource-id="android:id/button1"')&&n.includes('enabled="true"'));await page.locator('#toast').filter({hasText:/Markdown 与图片已导出/}).waitFor();const exports=shell('ls','/sdcard/Download').split(/\r?\n/).filter(n=>n.startsWith('纸间Markdown-')&&n.endsWith('.zip'));assert.ok(exports.length);await pullZip('/sdcard/Download/'+exports.at(-1),'.toolchain/native-markdown.zip');console.log('PASS real Android Markdown ZIP export');
}finally{await device.close();}
