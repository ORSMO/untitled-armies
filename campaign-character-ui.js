(function(){
'use strict';

const characters=window.UACampaignCharacters;
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,char=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[char]);
const byId=id=>document.getElementById(id);
const options=characters.appearanceCatalog;
const controls={skin:byId('newSkin'),hair:byId('newHair'),hairStyle:byId('newHairStyle')};
const age=byId('newAge'),portrait=byId('createPortrait'),ageLabel=byId('createPortraitAge');
let initialized=false;

function ageValue(value){
 const number=String(value??'').trim()===''?26:Number(value);
 return Math.min(75,Math.max(18,Number.isFinite(number)?Math.round(number):26));
}
function colorFor(kind,id,fallback){
 const color=options[kind].find(option=>option.id===id)?.color;
 return typeof color==='string'&&/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(color)?color:fallback;
}
function portraitMarkup(appearance,label='Character portrait'){
 const value=characters.normalizeAppearance(appearance);
 const style=options.hairStyle.find(option=>option.id===value.hairStyle)?.id||'short';
 const ageStyle=Number(appearance?.age)>=52?' appearance-older':
  Number(appearance?.age)>=1&&Number(appearance?.age)<18?' appearance-child':'';
 const skin=colorFor('skin',value.skin,'#b88763'),hair=colorFor('hair',value.hair,'#2d221f');
 return '<span role="img" aria-label="'+escapeHTML(label)+'" class="appearance-portrait appearance-'+escapeHTML(style)+ageStyle+
  '" style="--portrait-skin:'+skin+';--portrait-hair:'+hair+'">'+
  '<span class="portrait-cloak"></span><span class="portrait-tail"></span><span class="portrait-neck"></span>'+
  '<span class="portrait-ear left"></span><span class="portrait-ear right"></span><span class="portrait-face"></span>'+
  '<span class="portrait-hair"></span><span class="portrait-eye left"></span><span class="portrait-eye right"></span>'+
  '<span class="portrait-nose"></span><span class="portrait-mouth"></span><span class="portrait-clasp"></span></span>';
}
function readAppearance(){
 const current={skin:controls.skin.value,hair:controls.hair.value,hairStyle:controls.hairStyle.value};
 return {...characters.normalizeAppearance(current),age:ageValue(age.value)};
}
function refresh(){
 const appearance=readAppearance();
 portrait.innerHTML=portraitMarkup(appearance,'Preview of your character');
 ageLabel.textContent='Age '+appearance.age;
}
function showAppearance(appearance){
 const value=characters.normalizeAppearance(appearance);
 for(const [key,control] of Object.entries(controls))control.value=value[key];
 age.value=String(ageValue(appearance?.age));
 refresh();
}
function init(){
 if(initialized)return;
 initialized=true;
 for(const [key,control] of Object.entries(controls)){
  control.innerHTML=options[key].map(option=>'<option value="'+escapeHTML(option.id)+'">'+escapeHTML(option.label)+'</option>').join('');
  control.addEventListener('change',refresh);
 }
 age.addEventListener('input',refresh);
 age.addEventListener('change',()=>{age.value=String(ageValue(age.value));refresh()});
 byId('randomizeAppearance').addEventListener('click',()=>{
  const seed=(Date.now()^Math.floor(Math.random()*0xffffffff))>>>0;
  showAppearance({...characters.randomAppearance(seed),age:ageValue(age.value)});
 });
 showAppearance();
}

window.UACharacterUI={init,readAppearance,showAppearance,portraitMarkup};
init();
})();
