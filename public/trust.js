document.addEventListener('DOMContentLoaded',()=>{
  const strip=document.querySelector('.trust-strip');
  if(!strip)return;
  const proof=document.createElement('section');
  proof.className='proof-stats';
  proof.innerHTML=`
    <div class="proof-stat"><strong>100%</strong><span>POZYTYWNYCH OPINII*</span><small>*na podstawie dotychczasowych realizacji</small></div>
    <div class="proof-stat"><strong>1500+</strong><span>ADRESÓW OBJĘTYCH SYSTEMEM</span><small>realne działające wdrożenie</small></div>
    <div class="proof-stat"><strong>24/7</strong><span>GOTOWOŚĆ SYSTEMU</span><small>automatyczne przyjmowanie zgłoszeń</small></div>`;
  strip.insertAdjacentElement('afterend',proof);
});