import assert from 'node:assert/strict';
import {harness} from './harness.mjs';

const h=await harness(),{page}=h;let failures=0;
async function check(name,fn){try{await fn();console.log('PASS '+name);}catch(e){failures++;console.error('FAIL '+name+': '+e.stack);await page.evaluate(()=>window.workshop?.destroyCanvas());}}
async function open(options={}){
 await page.evaluate(options=>{window.canvasSaved=null;window.canvasResult=null;window.canvasPromise=window.workshop.openCanvas({...options,onSave:async value=>{window.canvasSaved=value;if(window.canvasFail)throw Error('保存失败测试');if(window.canvasWait)await new Promise(resolve=>window.canvasRelease=resolve);}}).then(result=>window.canvasResult=result);},options);
 await page.locator('.canvas-workshop').waitFor();
 await page.getByRole('button',{name:'保存图片',exact:true}).waitFor();
}
async function draw(x=.3,y=.35,x2=.65,y2=.6){const b=await page.locator('.cw-canvas').boundingBox();await page.mouse.move(b.x+b.width*x,b.y+b.height*y);await page.mouse.down();await page.mouse.move(b.x+b.width*x2,b.y+b.height*y2,{steps:12});await page.mouse.up();}
async function pixels(){return page.locator('.cw-canvas').evaluate(c=>c.toDataURL());}
async function button(name){await page.getByRole('button',{name,exact:true}).click();if(['撤销','重做'].includes(name))await page.waitForFunction(()=>document.querySelector('.canvas-workshop')?.getAttribute('aria-busy')==='false');}
try{
 await check('Canvas API loads as an offline module',async()=>{
  const exports=await page.evaluate(async()=>{const link=document.createElement('link');link.rel='stylesheet';link.href='canvas-workshop.css';document.head.append(link);window.workshop=await import('./canvas-workshop.js');return Object.keys(window.workshop);});
  for(const name of ['openCanvas','isCanvasOpen','requestCanvasClose','destroyCanvas'])assert.ok(exports.includes(name),name);
 });
 await check('Preview controls do not dirty a blank page or trap Android back',async()=>{
  await open({handwriting:true});await button('放大');await button('适合窗口');await button('移动画布');
  await page.evaluate(()=>window.workshop.requestCanvasClose());assert.equal(await page.evaluate(()=>window.canvasResult),false);assert.equal(await page.locator('.canvas-workshop').count(),0);
 });
 await check('Ink, undo, redo and discard confirmation preserve a drawing',async()=>{
  await open({handwriting:true});const before=await pixels();await draw();const after=await pixels();assert.ok(after!==before,'A stroke must change pixels');await button('撤销');assert.ok(await pixels()===before,'Undo must restore the previous pixels');await button('重做');assert.ok(await pixels()===after,'Redo must restore the stroke');
  await page.evaluate(()=>{window.workshop.requestCanvasClose();});await page.getByRole('button',{name:'继续编辑',exact:true}).waitFor();await button('继续编辑');assert.equal(await pixels(),after);await button('关闭画布');await button('放弃更改');assert.equal(await page.evaluate(()=>window.canvasResult),false);
 });
 await check('Save failure leaves pixels available, and pending save blocks close',async()=>{
  await open({handwriting:true});await draw();const drawn=await pixels();await page.evaluate(()=>window.canvasFail=true);await button('保存图片');await page.getByText('保存失败测试',{exact:true}).waitFor();assert.equal(await pixels(),drawn);assert.equal(await page.evaluate(()=>window.workshop.isCanvasOpen()),true);
  await page.evaluate(()=>{window.canvasFail=false;window.canvasWait=true;});await button('保存图片');await page.waitForFunction(()=>!!window.canvasRelease);await page.evaluate(()=>window.workshop.requestCanvasClose());assert.equal(await page.evaluate(()=>window.workshop.isCanvasOpen()),true);await page.evaluate(()=>{window.canvasWait=false;window.canvasRelease();});await page.locator('.canvas-workshop').waitFor({state:'detached'});assert.equal(await page.evaluate(()=>window.canvasResult),true);assert.match(await page.evaluate(()=>window.canvasSaved.dataUrl),/^data:image\/png;base64,/);
 });
 await check('Annotation eraser never erases the original photograph',async()=>{
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=400;c.height=240;const x=c.getContext('2d');x.fillStyle='#a4c8e2';x.fillRect(0,0,400,240);x.fillStyle='#e8b34e';x.fillRect(0,0,100,80);return c.toDataURL().split(',')[1];});await page.route('**/media/canvas-fixture.png',route=>route.fulfill({contentType:'image/png',body:Buffer.from(png,'base64')}));
  await open({src:'media/canvas-fixture.png'});const original=await pixels();await button('橡皮');await draw();assert.equal(await pixels(),original);assert.equal(await page.getByRole('button',{name:'撤销',exact:true}).isDisabled(),true);await button('画笔');await draw();assert.notEqual(await pixels(),original);await button('清空标注');await button('确认清空');assert.equal(await pixels(),original);await button('关闭画布');await button('放弃更改');
 });
 await check('Rotate, flip and drag crop change PNG dimensions with undo support',async()=>{
  await open({src:'media/canvas-fixture.png'});await button('顺时针旋转');assert.deepEqual(await page.locator('.cw-canvas').evaluate(c=>[c.width,c.height]),[240,400]);await button('水平翻转');await button('垂直翻转');await button('裁剪');const b=await page.locator('.cw-canvas').boundingBox();await page.mouse.move(b.x+b.width*.2,b.y+b.height*.2);await page.mouse.down();await page.mouse.move(b.x+b.width*.8,b.y+b.height*.8,{steps:8});await page.mouse.up();await button('应用裁剪');const size=await page.locator('.cw-canvas').evaluate(c=>[c.width,c.height]);assert.ok(size[0]<240&&size[1]<400,size.join('x'));await button('撤销');assert.deepEqual(await page.locator('.cw-canvas').evaluate(c=>[c.width,c.height]),[240,400]);await button('保存图片');await page.locator('.canvas-workshop').waitFor({state:'detached'});
 });
 await check('Crop cancellation, clear cancellation and empty eraser do not dirty a page',async()=>{
  await open({handwriting:true});await button('裁剪');await button('取消裁剪');await button('清空标注');await button('继续编辑');await button('橡皮');await draw();await page.evaluate(()=>window.workshop.requestCanvasClose());assert.equal(await page.locator('.canvas-workshop').count(),0);
 });
 await check('Handwriting reopens as a protected PNG base and exports without source metadata',async()=>{
  await open({handwriting:true});await draw();await button('保存图片');await page.locator('.canvas-workshop').waitFor({state:'detached'});const dataUrl=await page.evaluate(()=>window.canvasSaved.dataUrl),bytes=Buffer.from(dataUrl.split(',')[1],'base64'),chunks=[];for(let offset=8;offset<bytes.length;){const size=bytes.readUInt32BE(offset);chunks.push(bytes.toString('ascii',offset+4,offset+8));offset+=size+12;}assert.ok(chunks.includes('IHDR'));assert.ok(chunks.includes('IDAT'));assert.ok(!chunks.some(type=>['eXIf','tEXt','iTXt','zTXt'].includes(type)));
  await page.route('**/media/canvas-handwriting.png',route=>route.fulfill({contentType:'image/png',body:bytes}));await open({src:'media/canvas-handwriting.png',handwriting:true});await page.getByText('已有笔迹已合并为底图；可继续书写，橡皮仅擦除新增笔迹',{exact:true}).waitFor();const before=await pixels();await button('橡皮');await draw();assert.equal(await pixels(),before);await button('画笔');await draw(.2,.6,.7,.7);assert.notEqual(await pixels(),before);await button('关闭画布');await button('放弃更改');
 });
 await check('Oversized local images are bounded before editing',async()=>{
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=4000;c.height=3000;c.getContext('2d').fillRect(0,0,4000,3000);return c.toDataURL().split(',')[1];});await page.route('**/media/canvas-large.png',route=>route.fulfill({contentType:'image/png',body:Buffer.from(png,'base64')}));await open({src:'media/canvas-large.png'});const [w,h]=await page.locator('.cw-canvas').evaluate(c=>[c.width,c.height]);assert.ok(w<=2048&&h<=2048);assert.ok(w*h<=2097152+4000);assert.ok(Math.abs(w/h-4/3)<.005);await button('关闭画布');assert.equal(await page.evaluate(()=>window.canvasResult),false);
 });
 await check('Local JPEG and WebP open, and GIF clearly describes its static conversion',async()=>{
  for(const type of ['jpeg','webp']){const data=await page.evaluate(type=>{const c=document.createElement('canvas');c.width=120;c.height=80;c.getContext('2d').fillRect(0,0,120,80);return c.toDataURL('image/'+type).split(',')[1];},type);await page.route('**/media/canvas-format.'+type,route=>route.fulfill({contentType:'image/'+type,body:Buffer.from(data,'base64')}));await open({src:'media/canvas-format.'+type});assert.deepEqual(await page.locator('.cw-canvas').evaluate(c=>[c.width,c.height]),[120,80]);await button('关闭画布');}
  await page.route('**/media/canvas-format.gif',route=>route.fulfill({contentType:'image/gif',body:Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==','base64')}));await open({src:'media/canvas-format.gif'});await page.getByText('GIF 使用第一帧保存为静态 PNG；橡皮仅擦除新增标注',{exact:true}).waitFor();await button('关闭画布');
 });
 await check('Canvas tools fit 320px and destroy settles an outstanding session',async()=>{
  await open({handwriting:true});for(const width of [320,390]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const b=await page.getByRole('button',{name:'保存图片',exact:true}).boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width);}
  await draw();if(process.env.PAPER_CANVAS_SCREENSHOT)await page.screenshot({path:process.env.PAPER_CANVAS_SCREENSHOT});
  await page.evaluate(()=>window.workshop.destroyCanvas());assert.equal(await page.evaluate(()=>window.canvasResult),false);assert.equal(await page.evaluate(()=>window.workshop.isCanvasOpen()),false);
 });
 await check('Destroy immediately settles a canvas whose image is still loading',async()=>{
  let request;await page.route('**/media/canvas-slow.png',route=>{request=route;});try{await page.evaluate(()=>{window.slowResult='pending';window.workshop.openCanvas({src:'media/canvas-slow.png',onSave:async()=>{}}).then(value=>window.slowResult=value);});await page.locator('.canvas-workshop').waitFor();await page.evaluate(()=>window.workshop.destroyCanvas());await page.waitForFunction(()=>window.slowResult===false,null,{timeout:1500});}finally{if(request)await request.abort();await page.unroute('**/media/canvas-slow.png');}
 });
 assert.deepEqual(h.errors,[],'JavaScript runtime errors');
}finally{await h.close();}
if(failures)process.exitCode=1;
