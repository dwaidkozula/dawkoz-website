'use strict';
const crypto=require('node:crypto');
const esc=s=>String(s).replace(/[<>&"']/g,ch=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[ch]));
const reject=()=> '<?xml version="1.0" encoding="UTF-8"?><Response><Reject reason="busy"/></Response>';
const stop=(client,text)=>`<?xml version="1.0" encoding="UTF-8"?><Response><Say language="${esc(client.language)}" voice="${esc(client.voice)}">${esc(text)}</Say><Hangup/></Response>`;
function offlineParse(text,field,phase,client){
 const normalized=text.toLowerCase().trim();
 if(/człowiek|pracownik/.test(normalized))return {intent:'human'};
 if(phase==='confirm')return {intent:/^(tak|potwierdzam|zgadza się)[.! ]*$/.test(normalized)?'confirm':/^(nie|popraw)[.! ]*$/.test(normalized)?'deny':'repeat'};
 const f=client.faq.findIndex(item=>item.question.toLowerCase()===normalized);if(f>=0)return {intent:'faq',faqIndex:f};
 return text.trim()?{intent:'value',value:text.trim().slice(0,field.maxLength)}:{intent:'repeat'};
}
function createEngine(settings,client,store,providers){
 function question(state){if(state.phase==='confirm')return client.fields.map(f=>`${f.label}: ${state.values[f.key]||'nie podano'}`).join('. ')+'. Czy potwierdzasz zgłoszenie? Powiedz tak albo nie.';return client.fields[state.index].question;}
 function gather(id,state,prefix=''){
  const nonce=crypto.randomBytes(24).toString('hex');store.nonce(id,nonce);
  const url=`${settings.publicBaseUrl}/voice/turn?nonce=${nonce}`;
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Gather input="speech" language="${esc(client.language)}" speechTimeout="auto" timeout="5" actionOnEmptyResult="true" method="POST" action="${esc(url)}"><Say language="${esc(client.language)}" voice="${esc(client.voice)}">${esc(prefix+question(state))}</Say></Gather><Hangup/></Response>`;
 }
 async function incoming(id){
  const result=store.reserve(id);if(result.denied)return {xml:reject(),text:'Odrzucono: '+result.denied};
  if(result.existing)return {xml:result.existing.xml||reject(),text:'Ponowione żądanie'};
  const state=result.call.state;
  if(settings.mode==='live')try{await providers.setCallTimeLimit(id,client.maxCallSeconds);}catch{state.phase='failed';const xml=reject();store.save(id,state,xml);return {xml,text:'Odrzucono: limit operatora'};}
  const xml=gather(id,state,client.greeting+' ');store.save(id,state,xml);
  return {xml,text:client.greeting+' '+question(state)};
 }
 async function turn(id,nonce,text){
  const claim=store.claim(id,nonce);if(!claim.claimed)return {xml:claim.cached||stop(client,'Rozmowa nie jest już aktywna.'),text:'Powtórzone lub nieaktualne żądanie.'};
  const call=store.get(id);if(!call)return {xml:reject(),text:'Brak rozmowy'};
  const state=call.state;state.turn++;
  let message='',ticket=null;
  if(call.final||['done','failed','expired'].includes(state.phase)||Date.now()-state.started>=client.maxCallSeconds*1000||state.turn>client.maxTurns){state.phase='done';message='Kończę rozmowę. Skontaktuj się bezpośrednio z firmą.';}
  else try{
   const field=state.phase==='fields'?client.fields[state.index]:null;
   const parsed=text.trim()?(settings.mode==='demo'?offlineParse(text,field,state.phase,client):await providers.parseTurn({text,field,phase:state.phase,values:state.values})):{intent:'repeat'};
   if(parsed.intent==='human'){state.phase='done';message='Ten bot nie przełącza rozmowy. Proszę skontaktować się bezpośrednio z firmą. Zgłoszenie nie zostało wysłane.';}
   else if(parsed.intent==='faq'){message=client.faq[parsed.faqIndex].answer+' ';}
   else if(state.phase==='confirm'&&parsed.intent==='confirm'){
    state.phase='done';ticket={id:crypto.randomUUID(),createdAt:new Date().toISOString(),fields:state.values};
    message='Zapisano zgłoszenie do przekazania zespołowi. Nie jest to potwierdzenie terminu ani wykonania usługi. Dziękuję.';
   }else if(state.phase==='confirm'&&parsed.intent==='deny'){state.phase='fields';state.index=0;state.values={};message='Zbierzmy dane ponownie. ';}
   else if(state.phase==='fields'&&parsed.intent==='value'){
    const value=String(parsed.value||'').trim();if(!value||value.length>field.maxLength)message='Proszę podać krótszą odpowiedź. ';
    else{state.values[field.key]=value;state.index++;if(state.index===client.fields.length)state.phase='confirm';}
   }else message='Proszę powtórzyć odpowiedź. ';
  }catch{state.phase='failed';message='Wystąpił problem techniczny. Zgłoszenie nie zostało wysłane. Proszę skontaktować się bezpośrednio z firmą.';}
  const terminal=['done','failed'].includes(state.phase);
  const responseText=terminal?message:message+question(state);
  const xml=terminal?stop(client,message):gather(id,state,message);
  store.completeTurn(id,nonce,state,xml,ticket);
  return {xml,text:responseText,ticketId:ticket?.id,done:terminal};
 }
 return {incoming,turn};
}
module.exports={createEngine,offlineParse,reject};
