'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {loadSettings}=require('./config');
const {Store}=require('./store');
const {createEngine}=require('./engine');
const {createProviders}=require('./providers');
function signature(token,url,params){let data=url;for(const key of [...params.keys()].sort())data+=key+params.get(key);return crypto.createHmac('sha1',token).update(data).digest('base64');}
function authenticated(settings,url,params,provided){
 if([...params.keys()].some((key,i,all)=>all.indexOf(key)!==i))return false;
 const expected=signature(settings.twilioAuthToken,settings.publicBaseUrl+url,params);
 return typeof provided==='string'&&provided.length===expected.length&&crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(provided))&&params.get('AccountSid')===settings.twilioAccountSid&&params.get('To')===settings.twilioPhoneNumber&&/^CA[0-9a-f]{32}$/i.test(params.get('CallSid')||'');
}
function start({settings,client},options={}){
 const store=options.store||new Store(settings,client),providers=options.providers||createProviders(settings,client),engine=createEngine(settings,client,store,providers);
 store.db.prepare("UPDATE jobs SET status='unknown' WHERE status='sending'").run();
 let processing=false;
 async function jobs(){if(processing||settings.mode!=='live')return;processing=true;try{const ticket=store.ticketForJob();if(ticket){let result;try{result=await providers.deliver(ticket);}catch{result={status:'unknown'};}store.jobResult(ticket.id,result);}}finally{processing=false;}}
 const timer=setInterval(()=>{jobs().catch(()=>console.error('OUTBOX_ERROR'));},2000);timer.unref();
 const retention=setInterval(()=>{try{store.cleanup();}catch{console.error('CLEANUP_ERROR');}},3600000);retention.unref();store.cleanup();
 function send(res,status,body,type='text/plain; charset=utf-8'){res.writeHead(status,{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"});res.end(body);}
 const server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://localhost');
   if(req.method==='GET'&&url.pathname==='/healthz')return send(res,200,'{"ok":true}','application/json');
   if(settings.mode==='demo'&&req.method==='GET'&&['/demo','/demo.js','/demo.css'].includes(url.pathname)){
    const name=url.pathname==='/demo'?'demo.html':url.pathname.slice(1);return send(res,200,fs.readFileSync(path.join(__dirname,name)),name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8');
   }
   if(req.method!=='POST')return send(res,404,'Nie znaleziono.');
   const demo=settings.mode==='demo'&&url.pathname==='/demo/turn';
   if(!demo&&!(settings.mode==='live'&&['/voice/incoming','/voice/turn','/voice/status'].includes(url.pathname)))return send(res,404,'Nie znaleziono.');
   if(demo&&(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host||'')||req.headers.origin!==`http://${req.headers.host}`))return send(res,403,'Nieprawidłowe pochodzenie.');
   if(!String(req.headers['content-type']||'').startsWith('application/x-www-form-urlencoded'))return send(res,415,'Wymagany formularz.');
   let bytes=0;const chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>16384){send(res,413,'Za duże żądanie.');return;}chunks.push(chunk);}
   const params=new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
   if(demo){
    const id=params.get('id')||'CA'+crypto.randomBytes(16).toString('hex');if(!/^CA[a-f0-9]{32}$/.test(id))return send(res,400,'Nieprawidłowe ID.');
    const result=params.has('nonce')?await engine.turn(id,params.get('nonce'),(params.get('text')||'').slice(0,1000)):await engine.incoming(id);
    const nonce=result.xml.match(/nonce=([a-f0-9]+)/)?.[1];if(result.done||!nonce)store.finalize(id,1);
    return send(res,200,JSON.stringify({id,nonce,text:result.text,done:result.done||!nonce,ticketId:result.ticketId}),'application/json');
   }
   if(!authenticated(settings,req.url,params,req.headers['x-twilio-signature']))return send(res,403,'Nieprawidłowy podpis.');
   const id=params.get('CallSid');
   if(url.pathname==='/voice/status'){
    const duration=params.get('CallDuration'),final=['completed','busy','failed','no-answer','canceled'].includes(params.get('CallStatus'));
    if(final&&/^\d{1,5}$/.test(duration||'')&&Number(duration)<=86400)store.finalize(id,Number(duration));
    return send(res,200,'OK');
   }
   if(settings.liveTestOnly&&!settings.allowedCallers.includes(params.get('From')))return send(res,200,'<Response><Reject reason="busy"/></Response>','application/xml');
   const result=url.pathname==='/voice/incoming'?await engine.incoming(id):await engine.turn(id,url.searchParams.get('nonce'),(params.get('SpeechResult')||'').slice(0,1000));
   send(res,200,result.xml,'application/xml; charset=utf-8');
  }catch{if(!res.headersSent)send(res,500,'Błąd techniczny.');console.error('REQUEST_FAILED');}
 });
 server.requestTimeout=15000;server.headersTimeout=10000;
 server.listen(settings.port,settings.mode==='demo'?'127.0.0.1':'0.0.0.0',()=>console.log(`Bot listening on ${server.address().port} (${settings.mode})`));
 server.on('close',()=>{clearInterval(timer);clearInterval(retention);store.close();});
 return {server,store,engine};
}
if(require.main===module){try{start(loadSettings());}catch(e){console.error(e.code==='CONFIG_INVALID'?e.message:'Nie udało się uruchomić bota. Sprawdź konfigurację i dysk.');process.exitCode=1;}}
module.exports={signature,authenticated,start};
