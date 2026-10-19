export class SaveSession {
 constructor(write,onState=()=>{}){this.write=write;this.onState=onState;this.dirty=false;this.value=null;this.revision=0;this.saved=0;this.pending=null;}
 change(value){this.value=structuredCloneSafe(value);this.revision++;this.dirty=true;this.onState('dirty');}
 async flush(){
  if(this.pending)return this.pending;
  this.pending=(async()=>{while(this.saved<this.revision){const revision=this.revision,value=structuredCloneSafe(this.value);this.onState('saving');try{await this.write(value);this.saved=revision;this.dirty=this.saved<this.revision;}catch(e){this.dirty=true;this.onState('error');throw e;}}this.onState('saved');})();
  try{return await this.pending;}finally{this.pending=null;}
 }
}
function structuredCloneSafe(value){return JSON.parse(JSON.stringify(value));}
