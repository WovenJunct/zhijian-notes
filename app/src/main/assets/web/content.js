import {esc} from './ui.js';
if(globalThis.Quill){const BaseLink=globalThis.Quill.import('formats/link');class NoteLink extends BaseLink{static sanitize(url){return /^paper-note:[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(url)?url:super.sanitize(url);}}globalThis.Quill.register(NoteLink,true);}
const media=/^media\/[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp|gif)$/;
export function cleanRich(input){
 const clean=globalThis.DOMPurify.sanitize(input,{ALLOWED_TAGS:['p','br','h1','h2','h3','h4','h5','h6','strong','b','em','i','u','s','blockquote','pre','code','ol','ul','li','a','img','span','div','table','thead','tbody','tr','th','td','hr'],ALLOWED_ATTR:['href','src','alt','title','class','style','data-list','data-language','data-row','start','width'],ALLOW_DATA_ATTR:false,ADD_URI_SAFE_ATTR:['width','data-list','data-language','data-row','start'],ALLOWED_URI_REGEXP:/^(?:https?:\/\/|paper-note:[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$|media\/[a-zA-Z0-9_-]+\.(?:png|jpg|jpeg|webp|gif)$)/i});
 const t=document.createElement('template');t.innerHTML=clean;
 for(const el of t.content.querySelectorAll('*')){
  if(el.hasAttribute('width')&&(el.tagName!=='IMG'||! /^(?:[1-9]\d?|100)%$/.test(el.getAttribute('width'))))el.removeAttribute('width');
  if(el.classList.contains('ql-ui')){el.remove();continue;}
  const classes=[...el.classList].filter(c=>/^ql-align-(center|right|justify)$/.test(c)||/^ql-indent-[1-8]$/.test(c)||(el.tagName==='DIV'&&/^ql-code-block(-container)?$/.test(c)));
  el.removeAttribute('class');if(classes.length)el.className=classes.join(' ');
  const style=el.style,values=[];
  for(const key of ['color','background-color']){const value=style.getPropertyValue(key);if(safeColor(value))values.push([key,value]);}
  if(['left','center','right','justify'].includes(style.textAlign))values.push(['text-align',style.textAlign]);
  el.removeAttribute('style');for(const [key,value] of values)el.style.setProperty(key,value);
  if(el.hasAttribute('data-list')&&(el.tagName!=='LI'||!['ordered','bullet','checked','unchecked'].includes(el.getAttribute('data-list'))))el.removeAttribute('data-list');
  if(el.hasAttribute('data-language')&&(!el.classList.contains('ql-code-block')||!/^[\w+-]{1,30}$/.test(el.getAttribute('data-language'))))el.removeAttribute('data-language');
  if(el.hasAttribute('data-row')&&(el.tagName!=='TD'||! /^[\w-]{1,80}$/.test(el.getAttribute('data-row'))))el.removeAttribute('data-row');
  if(el.hasAttribute('start')&&(el.tagName!=='OL'||! /^\d{1,6}$/.test(el.getAttribute('start'))))el.removeAttribute('start');
 }
 for(const image of t.content.querySelectorAll('img')){const src=(image.getAttribute('src')||'').replace(/^https:\/\/paper\.local\//,'');if(!media.test(src))image.replaceWith(document.createTextNode('[外部图片未加载]'));else image.setAttribute('src',src);}
 for(const a of t.content.querySelectorAll('a')){if(!/^https?:\/\//i.test(a.getAttribute('href')||'')&&!/^paper-note:[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(a.getAttribute('href')||''))a.removeAttribute('href');else a.setAttribute('rel','noopener noreferrer');}
 return t.innerHTML;
}
function safeColor(value){if(/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value))return true;const rgb=value.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);return !!rgb&&rgb.slice(1).every(v=>Number(v)<=255);}
let markdown;
function parser(){if(!markdown){markdown=globalThis.markdownit({html:false,breaks:true,linkify:false,typographer:false});const original=markdown.renderer.rules.image;markdown.renderer.rules.image=(tokens,index,options,env,self)=>{const src=tokens[index].attrGet('src')||'';return media.test(src)?original(tokens,index,options,env,self):`<span class="external-image">[外部图片：${esc(tokens[index].content||src)}]</span>`;};}return markdown;}
export const renderMarkdown=value=>cleanRich(parser().render(value||''));
export function richToMarkdown(value){
 const service=new globalThis.TurndownService({headingStyle:'atx',codeBlockStyle:'fenced',bulletListMarker:'-'});
 service.addRule('local-image',{filter:'img',replacement:(content,node)=>{const src=node.getAttribute('src')||'';return media.test(src)?`![${(node.getAttribute('alt')||'图片').replace(/[\[\]]/g,'')}](${src})`:'';}});
 service.addRule('strike',{filter:['s','del'],replacement:content=>'~~'+content+'~~'});
 service.addRule('quill-code',{filter:node=>node.nodeName==='DIV'&&node.classList.contains('ql-code-block-container'),replacement:(content,node)=>{const lines=[...node.querySelectorAll('.ql-code-block')].map(n=>n.textContent);return '\n\n```\n'+(lines.length?lines.join('\n'):node.textContent)+'\n```\n\n';}});
 service.addRule('quill-list',{filter:node=>['OL','UL'].includes(node.nodeName)&&[...node.children].some(n=>n.hasAttribute('data-list')),replacement:(content,node)=>{
  const counters=[],widths=[];
  const rows=[...node.children].filter(n=>n.nodeName==='LI').map(li=>{
   const depth=Number([...li.classList].find(c=>/^ql-indent-[1-8]$/.test(c))?.slice(10)||0),type=li.getAttribute('data-list')||(node.nodeName==='OL'?'ordered':'bullet');counters.length=widths.length=depth+1;
   let marker='-';if(type==='ordered')marker=String(counters[depth]=(counters[depth]||0)+1)+'.';else{counters[depth]=0;if(type==='checked'||type==='unchecked')marker+=' ['+(type==='checked'?'x':' ')+']';}
   let indent=0;for(let parent=0;parent<depth;parent++)indent+=widths[parent]||2;widths[depth]=marker.length+1;
   const text=service.turndown(li.innerHTML).trim();return ' '.repeat(indent)+marker+' '+text.replace(/\n/g,'\n'+' '.repeat(indent+widths[depth]));
  });return '\n\n'+rows.join('\n')+'\n\n';
 }});
 service.addRule('table',{filter:'table',replacement:(content,node)=>{const rows=[...node.querySelectorAll('tr')].map(tr=>[...tr.children].map(td=>service.turndown(td.innerHTML).replace(/\|/g,'\\|').replace(/\n/g,'<br>')));if(!rows.length)return '';const width=Math.max(...rows.map(r=>r.length)),row=r=>'| '+Array.from({length:width},(_,i)=>r[i]||'').join(' | ')+' |';return '\n\n'+[row(rows[0]),row(Array(width).fill('---')),...rows.slice(1).map(row)].join('\n')+'\n\n';}});
 return service.turndown(cleanRich(value));
}
export function plainText(value,mode){
 const t=document.createElement('template');t.innerHTML=mode==='rich'?cleanRich(value):renderMarkdown(value);
 const blocks=new Set(['P','DIV','H1','H2','H3','H4','H5','H6','BLOCKQUOTE','PRE','OL','UL','LI','TABLE','THEAD','TBODY','TR','HR']);
 function read(node){if(node.nodeType===Node.TEXT_NODE)return node.textContent;if(node.nodeType!==Node.ELEMENT_NODE&&node.nodeType!==Node.DOCUMENT_FRAGMENT_NODE)return '';if(node.nodeName==='BR')return '\n';if(node.nodeName==='IMG')return node.getAttribute('alt')||'';const text=[...node.childNodes].map(read).join(node.nodeName==='TR'?'\t':'');return blocks.has(node.nodeName)?'\n'+text+'\n':text;}
 return read(t.content).replace(/\u00a0/g,' ').replace(/[ \t]*\n[ \t]*/g,'\n').replace(/\n+/g,'\n').trim();
}
export const firstLine=value=>String(value||'').split(/\r?\n/).map(s=>s.trim()).find(Boolean)||'';
