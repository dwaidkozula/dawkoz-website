const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {renderPage,languages}=require('../i18n');
const {priceText,plnMinorUnits,resolveCurrency}=require('../currency');
const home=fs.readFileSync(require('node:path').join(__dirname,'../public/index.html'),'utf8');

test('fixed currency prices parse localized PLN amounts without changing quantities or scripts',()=>{
 for(const input of ['1 990','1,990','1.990','1\u00a0990'])assert.equal(plnMinorUnits(input),199000,input);
 for(const input of ['1,49','1.49'])assert.equal(plnMinorUnits(input),149,input);
 assert.equal(priceText('AI 2,49 zł/min, SMS 0,69 zł, prace 160 zł, limit 0 zł. 200 minut i 50 SMS.','EUR','pl'),'AI 0,59 EUR/min, SMS 0,17 EUR, prace 39 EUR, limit 0 EUR. 200 minut i 50 SMS.');
 assert.equal(priceText('from 1,990 PLN','USD','en'),'from 509 USD');
});

test('every language offers all currencies and converts every displayed public price consistently',()=>{
 for(const {code} of languages)for(const currency of ['PLN','EUR','USD']){
  const html=renderPage(home,code,'index.html',currency);
  assert.equal((html.match(/data-currency=/g)||[]).length,3,code+currency);
  assert.ok(html.includes(`data-currency="${currency}" aria-current="true"`));
  assert.ok(html.includes(`lang=${code}&amp;currency=EUR#offer`));
  const text=html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g,'').replace(/<[^>]*>/g,' ');
  if(currency==='PLN')assert.ok(text.includes(code==='pl'?'699 zł':'699 PLN'));
  else{
   assert.doesNotMatch(text,/\d[ \u00a0\u202f]*(?:PLN|zł)/u,code+currency);
   assert.match(text,new RegExp(currency==='EUR'?'165 EUR':'179 USD'));
  }
  assert.match(html,/200/);assert.match(html,/250/);
 }
});

test('currency persists through language and legal navigation while canonical URLs remain stable',()=>{
 const html=renderPage(home,'en','index.html','USD');
 assert.match(html,/href="\/\?lang=de&amp;currency=USD" hreflang="de"/);
 assert.match(html,/href="\/polityka-prywatnosci.html\?lang=en&amp;currency=USD"/);
 assert.match(html,/rel="canonical" href="https:\/\/dawkoz.com\/\?lang=en"/);
 const legal=renderPage(fs.readFileSync(require('node:path').join(__dirname,'../public/polityka-prywatnosci.html'),'utf8'),'de','polityka-prywatnosci.html','EUR');
 assert.match(legal,/href="\/\?lang=de&amp;currency=EUR"/);
 assert.doesNotMatch(legal,/class="currency-picker"/);
});

test('invalid currency input falls back to unchanged PLN without reflection',()=>{
 for(const value of [undefined,null,'eur','BTC','constructor','__proto__','<img src=x onerror=alert(1)>']){
  assert.equal(resolveCurrency(value),'PLN');
  assert.equal(renderPage(home,'pl','index.html',value),renderPage(home,'pl','index.html','PLN'));
 }
});
