'use strict';
const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs');
const path=require('node:path');
class Store {
 constructor(settings,client){
  this.settings=settings;this.client=client;
  fs.mkdirSync(settings.dataDir,{recursive:true,mode:0o700});
  this.db=new DatabaseSync(path.join(settings.dataDir,'bot.sqlite'));
  this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
   CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY,v TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS calls(id TEXT PRIMARY KEY,period TEXT NOT NULL,reserved INTEGER NOT NULL,billed INTEGER,final INTEGER NOT NULL DEFAULT 0,created INTEGER NOT NULL,state TEXT NOT NULL,xml TEXT);
   CREATE TABLE IF NOT EXISTS turns(nonce TEXT PRIMARY KEY,call_id TEXT NOT NULL,status TEXT NOT NULL,xml TEXT);
   CREATE TABLE IF NOT EXISTS tickets(id TEXT PRIMARY KEY,call_id TEXT UNIQUE NOT NULL,created INTEGER NOT NULL,payload TEXT);
   CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,status TEXT NOT NULL,next INTEGER NOT NULL DEFAULT 0,message_id INTEGER);`);
  const old=this.db.prepare('SELECT v FROM meta WHERE k=?').get('client');
  if(old && old.v!==settings.clientFingerprint){this.db.close();throw new Error('Baza jest przypisana do innej firmy. Użyj osobnego DATA_DIR.');}
  this.db.prepare('INSERT OR IGNORE INTO meta VALUES(?,?)').run('client',settings.clientFingerprint);
 }
 transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const v=fn();this.db.exec('COMMIT');return v;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 get(id){const row=this.db.prepare('SELECT * FROM calls WHERE id=?').get(id);return row?{...row,state:JSON.parse(row.state)}:null;}
 reserve(id,now=Date.now()){
  return this.transaction(()=>{
   const old=this.get(id);if(old)return {existing:old};
   const s=this.settings,c=this.client,period=String(s.periodStart);
   if(now<s.periodStart||now>=s.periodEnd)return {denied:'period'};
   if(this.db.prepare('SELECT COUNT(*) AS n FROM calls WHERE final=0').get().n>=c.maxConcurrentCalls)return {denied:'concurrency'};
   const used=this.db.prepare('SELECT COALESCE(SUM(COALESCE(billed,reserved)),0) AS n FROM calls WHERE period=?').get(period).n;
   const reserved=Math.ceil(c.maxCallSeconds/60);
   if(used+reserved>c.monthlyMinutes)return {denied:'quota'};
   const state={phase:'fields',index:0,values:{},turn:0,started:now};
   this.db.prepare('INSERT INTO calls(id,period,reserved,created,state) VALUES(?,?,?,?,?)').run(id,period,reserved,now,JSON.stringify(state));
   return {call:this.get(id)};
  });
 }
 save(id,state,xml){this.db.prepare('UPDATE calls SET state=?,xml=? WHERE id=?').run(JSON.stringify(state),xml,id);}
 nonce(id,nonce){this.db.prepare("INSERT INTO turns(nonce,call_id,status) VALUES(?,?,'ready')").run(nonce,id);}
 claim(id,nonce){return this.transaction(()=>{const r=this.db.prepare('SELECT * FROM turns WHERE nonce=? AND call_id=?').get(nonce,id);if(!r)return {invalid:true};if(r.status!=='ready')return {cached:r.xml||null};this.db.prepare("UPDATE turns SET status='working' WHERE nonce=?").run(nonce);return {claimed:true};});}
 completeTurn(id,nonce,state,xml,ticket){this.transaction(()=>{
  this.save(id,state,xml);this.db.prepare("UPDATE turns SET status='done',xml=? WHERE nonce=? AND call_id=?").run(xml,nonce,id);
  if(ticket){this.db.prepare('INSERT OR IGNORE INTO tickets VALUES(?,?,?,?)').run(ticket.id,id,Date.now(),JSON.stringify(ticket));this.db.prepare("INSERT OR IGNORE INTO jobs(id,status) VALUES(?,'pending')").run(ticket.id);}
 });}
 finalize(id,duration){return this.transaction(()=>{const row=this.get(id);if(!row||row.final)return false;
  this.db.prepare('UPDATE calls SET billed=?,final=1 WHERE id=?').run(Math.ceil(duration/60),id);return true;});}
 ticketForJob(){return this.transaction(()=>{
  const row=this.db.prepare("SELECT j.id,t.payload FROM jobs j JOIN tickets t ON t.id=j.id WHERE j.status IN ('pending','retry') AND j.next<=? AND t.payload IS NOT NULL ORDER BY t.created LIMIT 1").get(Date.now());
  if(!row)return null;this.db.prepare("UPDATE jobs SET status='sending' WHERE id=?").run(row.id);return JSON.parse(row.payload);
 });}
 jobResult(id,result){this.db.prepare('UPDATE jobs SET status=?,next=?,message_id=? WHERE id=?').run(result.status,Date.now()+(result.retryAfterSeconds||60)*1000,result.messageId||null,id);}
 status(){const period=String(this.settings.periodStart);return {mode:this.settings.mode,periodStart:new Date(this.settings.periodStart).toISOString(),periodEnd:new Date(this.settings.periodEnd).toISOString(),minutesUsedOrReserved:this.db.prepare('SELECT COALESCE(SUM(COALESCE(billed,reserved)),0) AS n FROM calls WHERE period=?').get(period).n,monthlyMinutes:this.client.monthlyMinutes,activeOrAwaitingCallback:this.db.prepare('SELECT COUNT(*) AS n FROM calls WHERE final=0').get().n,jobs:this.db.prepare('SELECT status,COUNT(*) AS count FROM jobs GROUP BY status').all()};}
 cleanup(now=Date.now()){
  const before=now-this.client.contentRetentionDays*86400000;
  this.transaction(()=>{this.db.prepare('UPDATE tickets SET payload=NULL WHERE created<?').run(before);
   for(const row of this.db.prepare('SELECT id,state FROM calls WHERE created<?').all(before)){
    const state=JSON.parse(row.state);state.values={};state.phase='expired';this.save(row.id,state,null);
    this.db.prepare('DELETE FROM turns WHERE call_id=?').run(row.id);
   }
   this.db.prepare("UPDATE jobs SET status='expired' WHERE id IN (SELECT id FROM tickets WHERE payload IS NULL) AND status NOT IN ('delivered','expired')").run();
   const metadataBefore=now-400*86400000;
   this.db.prepare('DELETE FROM jobs WHERE id IN (SELECT t.id FROM tickets t JOIN calls c ON c.id=t.call_id WHERE c.final=1 AND c.created<?)').run(metadataBefore);
   this.db.prepare('DELETE FROM tickets WHERE call_id IN (SELECT id FROM calls WHERE final=1 AND created<?)').run(metadataBefore);
   this.db.prepare('DELETE FROM calls WHERE final=1 AND created<?').run(metadataBefore);
  });
 }
 close(){this.db.close();}
}
module.exports={Store};
