import test from 'node:test';
import assert from 'node:assert/strict';
import {SaveSession} from '../../app/src/main/assets/web/save-session.js';

test('an older acknowledgement cannot mark later edits as saved', async()=>{
  let done; const writes=[];
  const s=new SaveSession(async value=>{writes.push(value); if(writes.length===1) await new Promise(r=>done=r); return value;});
  s.change({id:'one',content:'第一版'}); const saving=s.flush();
  await new Promise(r=>setTimeout(r,0)); s.change({id:'one',content:'第二版'}); done(); await saving;
  assert.equal(writes.at(-1).content,'第二版'); assert.equal(s.dirty,false);
});
test('save failure keeps the newest draft for a retry',async()=>{
  let fail=true; const s=new SaveSession(async value=>{if(fail)throw Error('disk full');return value;});
  s.change({id:'one',content:'不能丢'}); await assert.rejects(s.flush(),/disk full/);
  assert.equal(s.dirty,true); assert.equal(s.value.content,'不能丢'); fail=false; await s.flush(); assert.equal(s.dirty,false);
});
test('parallel flush requests serialize writes and retain the final edit',async()=>{
  let active=0,max=0;const stored=[];
  const s=new SaveSession(async v=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,5));stored.push(v.content);active--;return v;});
  s.change({id:'one',content:'A'}); const a=s.flush();s.change({id:'one',content:'B'});const b=s.flush();await Promise.all([a,b]);
  assert.equal(max,1);assert.equal(stored.at(-1),'B');
});
