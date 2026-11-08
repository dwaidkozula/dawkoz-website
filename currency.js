'use strict';
const {prices}=require('./commercial/currency-prices.json');
const supported=['PLN','EUR','USD'];
function resolveCurrency(value){return supported.includes(value)?value:'PLN';}
// Handles amounts emitted by the eleven existing locale catalogs (e.g.
// 1,990 PLN, 1.990 PLN, 1 990 zł and 1,49 zł). No rates or network requests.
function plnMinorUnits(amount){
 let number=amount.replace(/[\s\u00a0\u202f]/g,'');
 const last=Math.max(number.lastIndexOf(','),number.lastIndexOf('.'));
 if(last>=0&&number.length-last-1<=2)number=number.slice(0,last).replace(/[.,]/g,'')+'.'+number.slice(last+1);
 else number=number.replace(/[.,]/g,'');
 const parts=number.split('.');
 return Number(parts[0])*100+Number((parts[1]||'').padEnd(2,'0'));
}
function formatMoney(minor,currency,locale){return new Intl.NumberFormat(locale==='no'?'nb':locale,{maximumFractionDigits:2,minimumFractionDigits:0,useGrouping:'always'}).format(minor/100).replace(/[\u00a0\u202f]/g,' ')+' '+currency;}
function priceText(text,currency,locale){
 if(currency==='PLN')return text;
 return text.replace(/(?<![\p{L}\p{N}.,])((?:\d{1,3}(?:[ \u00a0\u202f.,]\d{3})+|\d+)(?:[.,]\d{1,2})?)[ \u00a0\u202f]*(?:PLN|zł)(?![\p{L}\p{N}_])/gu,(original,amount)=>{
  const minor=plnMinorUnits(amount),entry=prices[String(minor)];
  // Preserve an explicitly labelled PLN amount if a new price has not yet
  // received a foreign tariff. Coverage tests flag such incomplete releases.
  return entry?formatMoney(entry[currency],currency,locale):original;
 });
}
function currencyHref(page,locale,currency,hash=''){
 const params=new URLSearchParams({lang:locale,currency});
 return `${page==='index.html'?'/':'/'+page}?${params}${hash}`;
}
function currencyPicker(locale,currency,labels,escape){
 return `<div class="currency-picker" role="group" aria-labelledby="currency-label"><span id="currency-label">${escape(labels.currency)}</span><div>${supported.map(code=>`<a href="${escape(currencyHref('index.html',locale,code,'#offer'))}" data-currency="${code}"${code===currency?' aria-current="true"':''}>${code}</a>`).join('')}</div><p>${escape(labels.currencyNote)}</p></div>`;
}
module.exports={resolveCurrency,priceText,formatMoney,plnMinorUnits,currencyHref,currencyPicker};
