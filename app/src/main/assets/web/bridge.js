export function createBridge(send){
 let serial=0;const requests=new Map();
 return {
  call(method,args={}){return new Promise((resolve,reject)=>{const id=String(++serial);requests.set(id,{resolve,reject});try{send(id,method,JSON.stringify(args));}catch(e){requests.delete(id);reject(e);}});},
  resolve(id,ok,payload){const p=requests.get(String(id));if(!p)return;requests.delete(String(id));if(ok)p.resolve(payload);else{const e=new Error(payload?.message||'操作未完成，请重试');e.code=payload?.code;p.reject(e);}}
 };
}
export const bridge=createBridge((...args)=>{if(!globalThis.PaperNative)throw Error('请在纸间安卓应用中打开');globalThis.PaperNative.request(...args);});
globalThis.PaperBridge=bridge;
export const call=(method,args)=>bridge.call(method,args);
