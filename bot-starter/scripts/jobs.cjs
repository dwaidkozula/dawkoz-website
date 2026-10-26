const {loadSettings}=require('../src/config'),{Store}=require('../src/store');
let store;try{const {settings,client}=loadSettings();store=new Store(settings,client);const [action,id]=process.argv.slice(2);
if(action){if(!['--retry','--delivered'].includes(action)||!/^[a-f0-9-]{36}$/.test(id||''))throw new Error();
 const result=store.db.prepare("UPDATE jobs SET status=?,next=0 WHERE id=? AND status IN ('failed','unknown')").run(action==='--retry'?'pending':'manual_delivered',id);
 console.log(result.changes?'Zaktualizowano po ręcznej decyzji operatora.':'Brak takiej pozycji failed/unknown.');
}else console.log(JSON.stringify(store.db.prepare('SELECT id,status,message_id AS messageId FROM jobs ORDER BY id LIMIT 100').all(),null,2));
}catch{console.error('Błąd. Użycie: npm run jobs [-- --retry ID | -- --delivered ID]. Przed ponowieniem sprawdź czat, aby uniknąć duplikatu.');process.exitCode=1;}finally{store?.close();}
