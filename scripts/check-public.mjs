import fs from 'node:fs/promises';import path from 'node:path';
const root=path.resolve(process.argv[2]||'.'),problems=[];
const excluded=new Set(['.git','.private','.signing','.toolchain','.gradle','node_modules','build','dist','test-results','playwright-report','.idea']);
const textExtensions=new Set(['.md','.txt','.mjs','.js','.json','.html','.css','.xml','.gradle','.properties','.ps1','.bat','.java']);
let checked=0,images=0;
async function walk(dir){for(const item of await fs.readdir(dir,{withFileTypes:true})){
 if(excluded.has(item.name))continue;const file=path.join(dir,item.name),relative=path.relative(root,file).replaceAll(path.sep,'/');
 if(item.isSymbolicLink()){problems.push(relative+': symlinks are not part of the public snapshot');continue;}
 if(item.isDirectory()){await walk(file);continue;}
 if(/\.(?:jks|keystore|p12|pem|log|apk)$/i.test(item.name)||/^\.env(?:\.|$)/.test(item.name)||item.name==='local.properties'||item.name==='signing.properties'){problems.push(relative+': local/private file');continue;}
 if(item.name.endsWith('.png')){const data=await fs.readFile(file);for(let at=8;at+12<=data.length;){const size=data.readUInt32BE(at),type=data.toString('ascii',at+4,at+8);if(['tEXt','zTXt','iTXt','eXIf'].includes(type))problems.push(relative+': PNG contains metadata');at+=size+12;}images++;continue;}
 if(!textExtensions.has(path.extname(file))&&item.name!=='.gitignore')continue;
 let text=await fs.readFile(file,'utf8');checked++;
 // An intentionally invalid Windows ZIP entry in the traversal test is public test data.
 if(relative==='app/src/test/java/app/zhijian/notes/CoreTest.java')text=text.replaceAll(['C:','x'].join('/'),'');
 if(/\b[A-Z]:[\\/]|\/(?:Users|home)\//i.test(text))problems.push(relative+': absolute machine path');
 for(const value of [process.env.USERPROFILE,process.env.COMPUTERNAME])if(value&&value.length>=5&&text.toLowerCase().includes(value.toLowerCase()))problems.push(relative+': current machine identifier');
 if(path.extname(file)==='.md'){
  const links=[...text.matchAll(/!?\[[^\]]*\]\(([^\s)]+)\)/g)].map(m=>m[1]);links.push(...[...text.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m=>m[1]));
  for(const link of links){if(/^(?:[a-z]+:|#)/i.test(link))continue;const dest=path.resolve(path.dirname(file),decodeURIComponent(link.split('#')[0]));try{await fs.access(dest);}catch{problems.push(relative+': missing relative link '+link);}}
 }
}}
await walk(root);
if(problems.length){for(const issue of problems)console.error(issue);process.exitCode=1;}else console.log(`PASS public source checks: ${checked} text files, ${images} PNGs; no machine paths/private files or broken documentation links.`);
