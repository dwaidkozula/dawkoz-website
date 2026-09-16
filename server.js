const http = require('http');
const fs = require('fs');
const path = require('path');
const port = process.env.PORT || 3000;
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
http.createServer((req,res)=>{
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';
  const file = path.join(__dirname,'public',urlPath);
  if (!file.startsWith(path.join(__dirname,'public'))) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});return res.end('404');}
    let output=data;
    if(urlPath==='/index.html') output=Buffer.from(data.toString('utf8').replace('</body>','<script src="/pricing.js?v=20260916-3"></script><script src="/trust.js?v=20260917-1"></script></body>'));
    res.writeHead(200,{
      'Content-Type':types[path.extname(file)]||'application/octet-stream',
      'Cache-Control':'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma':'no-cache',
      'Expires':'0'
    });
    res.end(output);
  });
}).listen(port,'0.0.0.0',()=>console.log(`DAWKOZ website listening on ${port}`));
