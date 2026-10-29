import http from 'node:http';
import {mkdir,readFile,writeFile,rename,readdir} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import app from './app.mjs';
const root=path.resolve(process.env.DATA_DIR||'./data');
await mkdir(root,{recursive:true});
const keyPath=key=>{if(!/^(posts|photos)\/[a-f0-9-]{36}$/.test(key))throw Error('Invalid storage key');return path.join(root,key)};
const bucket={
 async put(key,value){let target=keyPath(key);await mkdir(path.dirname(target),{recursive:true});let tmp=target+'.'+randomUUID()+'.tmp';await writeFile(tmp,typeof value==='string'?value:Buffer.from(value));await rename(tmp,target)},
 async get(key){try{let bytes=await readFile(keyPath(key));return {body:bytes,json:async()=>JSON.parse(bytes.toString('utf8'))}}catch(e){if(e.code==='ENOENT')return null;throw e}},
 async list({prefix,limit=200}){if(prefix!=='posts/')throw Error('Invalid prefix');let files;try{files=await readdir(path.join(root,'posts'))}catch(e){if(e.code==='ENOENT')return {objects:[]};throw e}let objects=files.filter(x=>/^[a-f0-9-]{36}$/.test(x)).sort().map(x=>({key:'posts/'+x}));return {objects:objects.slice(0,limit),truncated:objects.length>limit}}
};
const server=http.createServer(async(req,res)=>{try{
 if(req.url==='/healthz'){res.writeHead(200,{'Content-Type':'application/json'});return res.end('{"status":"ok"}')}
 const host=req.headers.host;if(!host){res.writeHead(400);return res.end('Missing Host')}
 const proto=req.headers['x-forwarded-proto']==='https'?'https':'http';
 const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>4000000){res.writeHead(413,{'Content-Type':'application/json'});res.end('{"error":"上传内容过大"}');return}chunks.push(chunk)}
 const headers=new Headers();for(const [key,value]of Object.entries(req.headers)){if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(', '):value)}
 const request=new Request(proto+'://'+host+req.url,{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});
 const response=await app.fetch(request,{BUCKET:bucket});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(req.method==='HEAD'?undefined:Buffer.from(await response.arrayBuffer()));
 }catch(e){console.error('Request failed:',e.message);if(!res.headersSent)res.writeHead(500,{'Content-Type':'application/json'});res.end('{"error":"服务暂时不可用"}')}
});
server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Cocktail Studio ready; storage: '+root));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
