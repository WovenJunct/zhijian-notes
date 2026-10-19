import test from 'node:test';import assert from 'node:assert/strict';
import {createBridge} from '../../app/src/main/assets/web/bridge.js';
test('out of order responses match the original requests',async()=>{const req=[];const b=createBridge((...x)=>req.push(x));const a=b.call('a',{}),c=b.call('b',{});b.resolve(req[1][0],true,{value:'B'});b.resolve(req[0][0],true,{value:'A'});assert.equal((await a).value,'A');assert.equal((await c).value,'B');});
test('a rejected native command is an actionable error',async()=>{let id;const b=createBridge(x=>id=x);const p=b.call('save',{});b.resolve(id,false,{code:'IO',message:'空间不足'});await assert.rejects(p,/空间不足/);b.resolve('unknown',true,{});});
