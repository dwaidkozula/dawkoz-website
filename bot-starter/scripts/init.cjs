const fs=require('node:fs');
for(const [from,to] of [['.env.example','.env'],['config/client.example.json','config/client.json']]){if(!fs.existsSync(to)){fs.copyFileSync(from,to);console.log('Utworzono '+to);}else console.log('Zachowano istniejący '+to);}
