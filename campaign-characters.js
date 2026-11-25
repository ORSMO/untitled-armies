(function(){
'use strict';

const GENERATOR_VERSION=1;
const appearanceCatalog={
 skin:[
  {id:'fair',label:'Fair',color:'#f1d7c0'},
  {id:'light',label:'Light',color:'#dfb995'},
  {id:'olive',label:'Olive',color:'#c9946d'},
  {id:'brown',label:'Brown',color:'#9b684c'},
  {id:'deep',label:'Deep',color:'#684536'}
 ],
 hair:[
  {id:'black',label:'Black',color:'#211d20'},
  {id:'dark-brown',label:'Dark brown',color:'#38251d'},
  {id:'chestnut',label:'Chestnut',color:'#68402b'},
  {id:'auburn',label:'Auburn',color:'#8b422d'},
  {id:'red',label:'Copper red',color:'#b85d32'},
  {id:'blond',label:'Blond',color:'#d3b66f'},
  {id:'silver',label:'Silver',color:'#b9b8ad'},
  {id:'white',label:'White',color:'#e4dfce'}
 ],
 hairStyle:[
  {id:'short',label:'Short'},
  {id:'long',label:'Long'},
  {id:'braided',label:'Braided'},
  {id:'tied-back',label:'Tied back'},
  {id:'wavy',label:'Wavy'},
  {id:'shaved',label:'Shaved'},
  {id:'coiled',label:'Coiled'},
  {id:'ponytail',label:'Ponytail'}
 ]
};
for(const options of Object.values(appearanceCatalog)){
 for(const option of options)Object.freeze(option);
 Object.freeze(options);
}
Object.freeze(appearanceCatalog);

const defaultAppearance=Object.freeze({skin:'olive',hair:'chestnut',hairStyle:'tied-back'});
const nameProfiles=[
 {match:['woodland','marcher','verdant'],heads:['Alder','Bren','Corin','Dain','Eryn','Fenn','Garran','Linden','Merrick','Orin','Ronan','Tamsin'],partners:['Alys','Brynn','Celandine','Elowen','Iria','Liora','Maren','Nerys','Rowan','Sable','Talia','Wren'],children:['Ash','Briar','Celyn','Dara','Eira','Fern','Hollis','Ivo','Lark','Mira','Perrin','Syl']},
 {match:['northern','sea jarls','skeldic','fjord'],heads:['Arne','Bjorn','Eirik','Gunnar','Haldor','Ivar','Kjell','Leif','Ragnar','Sten','Torsten','Ulf'],partners:['Asta','Brynja','Eydis','Freydis','Gudrun','Helga','Inga','Liv','Runa','Sigrid','Thyra','Yrsa'],children:['Ari','Astrid','Dag','Edda','Erik','Freya','Hakon','Idun','Kari','Njal','Sven','Tove']},
 {match:['mountain','stronghold','ironhold','clan'],heads:['Borin','Dorrik','Eldran','Fergus','Grom','Hadrik','Keld','Orik','Rurik','Thane','Torren','Varric'],partners:['Alda','Brunna','Dagna','Eira','Freya','Hilda','Kara','Morna','Runa','Sella','Thora','Ylva'],children:['Bera','Dori','Edda','Gerd','Hedda','Kori','Mina','Nori','Orren','Runa','Tova','Vig']},
 {match:['feudal','veyr','old feudal','crown'],heads:['Alaric','Bastien','Cedric','Edric','Gawen','Lucan','Mathis','Osmund','Renard','Roland','Theodore','Tristan'],partners:['Adela','Alisande','Beatrix','Cecily','Elise','Isolde','Maud','Odette','Rosamund','Sabine','Ysabel','Yvette'],children:['Aveline','Crispin','Emmeline','Giles','Hugh','Julian','Linette','Miles','Nicolette','Piers','Simon','Vivian']},
 {match:['eastern sun','sunspire','dawn','eastern court'],heads:['Adil','Amir','Bashir','Darian','Farid','Hakim','Jamal','Kamil','Nasir','Rafi','Samir','Zayd'],partners:['Amina','Dalia','Farah','Jamila','Layla','Nadia','Nura','Rania','Safiya','Salma','Yasmin','Zahra'],children:['Ari','Dima','Hadi','Iman','Karim','Lina','Mina','Nabil','Rami','Sami','Tariq','Zara']},
 {match:['merchant','tideborn','western merchant','coastal','league'],heads:['Brennan','Cai','Dorian','Evan','Iven','Jory','Marek','Milo','Nolan','Perrin','Tavian','Willem'],partners:['Anwen','Bela','Carys','Elin','Iona','Kessa','Mara','Nella','Oona','Rhea','Sera','Tilda'],children:['Alden','Beck','Coral','Della','Fia','Kit','Lio','Nessa','Pip','Reed','Tess','Willa']},
 {match:['western hill','valdoria','hill kingdom'],heads:['Alwyn','Bram','Edric','Hadrian','Loras','Merek','Oswin','Roderic','Tavian','Ulric','Wystan','Yorick'],partners:['Aveline','Briony','Elara','Gwen','Isolde','Jocelyn','Lysandra','Mirelle','Nerissa','Odilia','Sabine','Thea'],children:['Alin','Bryn','Celia','Davin','Eloise','Harlan','Iris','Lysa','Maren','Orrin','Pella','Tobin']},
 {match:['imperial','aurelian','heartland'],heads:['Aelius','Cassian','Cato','Decian','Julius','Lucius','Marcell','Octavian','Quint','Severin','Tiber','Valen'],partners:['Aelia','Aurelia','Claudia','Daria','Livia','Lucia','Marcella','Octavia','Sabina','Talia','Valeria','Vesta'],children:['Arius','Cato','Cira','Felix','Julia','Luca','Nia','Remy','Silas','Tessa','Vera','Vitus']},
 {match:['southern oasis','saffron','sultanate','desert'],heads:['Azim','Faris','Idris','Khalid','Malik','Nadir','Omar','Qadir','Rashid','Tahir','Yusuf','Zafir'],partners:['Amara','Aziza','Dima','Hana','Leila','Maha','Nahla','Rima','Samira','Soraya','Yara','Zahira'],children:['Ayan','Bari','Dara','Eli','Faris','Hadi','Laleh','Mina','Rafi','Sami','Tala','Zayn']},
 {match:['eastern horse','steppe','khanate','nomadic'],heads:['Altan','Batu','Chagatai','Erden','Jochi','Khasar','Mergen','Orda','Temar','Toghan','Ulan','Yul'],partners:['Alma','Bolormaa','Enkhe','Naran','Odval','Oruna','Saran','Sukh','Tsetseg','Ulaa','Yelena','Zaya'],children:['Ari','Boro','Chuluun','Davaa','Erke','Gala','Kulan','Munkh','Nima','Saruul','Temu','Ujin']}
];
const fallbackNames={heads:['Aren','Belen','Cyran','Darian','Elric','Faron','Galen','Hale','Isen','Joren','Kellan','Lorin'],partners:['Arielle','Brenna','Cira','Dessa','Eryn','Fara','Galia','Hessa','Ilyra','Jessa','Kira','Lena'],children:['Aven','Bryn','Cora','Dain','Eli','Fenn','Gala','Hollis','Iri','Jory','Kest','Lio']};

function hash(value){
 let h=2166136261;
 for(const char of String(value)){h^=char.charCodeAt(0);h=Math.imul(h,16777619)}
 return h>>>0;
}
function randomFor(seed,key){
 let a=hash(String(seed)+'|'+String(key));
 return function(){
  a=(a+0x6D2B79F5)|0;
  let t=a;
  t=Math.imul(t^(t>>>15),t|1);
  t^=t+Math.imul(t^(t>>>7),t|61);
  return ((t^(t>>>14))>>>0)/4294967296;
 };
}
function pick(list,rng){return list[Math.floor(rng()*list.length)]}
function integer(min,max,rng){return min+Math.floor(rng()*(max-min+1))}
function seedKey(seed){return seed==null?'asterra-family-v1':String(seed)}
function resolveNames(faction){
 const description=((faction?.culture||'')+' '+(faction?.name||'')).toLowerCase();
 return nameProfiles.find(profile=>profile.match.some(keyword=>description.includes(keyword)))||fallbackNames;
}
function normalizedValue(value,catalog,fallback){
 const id=typeof value==='string'?value:value?.id;
 return catalog.some(item=>item.id===id)?id:fallback;
}
function normalizeAppearance(input){
 const value=input&&typeof input==='object'?input:{};
 return {
  skin:normalizedValue(value.skin,appearanceCatalog.skin,defaultAppearance.skin),
  hair:normalizedValue(value.hair,appearanceCatalog.hair,defaultAppearance.hair),
  hairStyle:normalizedValue(value.hairStyle,appearanceCatalog.hairStyle,defaultAppearance.hairStyle)
 };
}
function randomAppearance(seed){
 const key=seedKey(seed),rng=randomFor(key,'appearance');
 return {
  skin:pick(appearanceCatalog.skin,rng).id,
  hair:pick(appearanceCatalog.hair,rng).id,
  hairStyle:pick(appearanceCatalog.hairStyle,rng).id
 };
}
function fullName(given,family){return family?given+' '+family:given}
function create(config={}){
 const houses=Array.isArray(config.houses)?config.houses:[],factions=Array.isArray(config.factions)?config.factions:[];
 const seed=seedKey(config.seed),preserveLegacyLeaders=config.preserveLegacyLeaders===true;
 const records=[],seen=new Set();
 for(const house of houses){
  if(!house||!Number.isInteger(house.id)||seen.has(house.id)||!Number.isInteger(house.faction)||
     !Number.isInteger(house.seatId)||!factions.some(faction=>faction?.id===house.faction))continue;
  seen.add(house.id);
  const faction=factions.find(item=>item.id===house.faction),names=resolveNames(faction);
  const family=String(house.name||'').replace(/^house\s+/i,'').trim();
  const prefix='house:'+house.id+':';
  const headId='person-'+house.id+'-head',partnerId='person-'+house.id+'-partner';
  const headAge=integer(30,64,randomFor(seed,prefix+'head-age'));
  const partnerAge=integer(Math.max(24,headAge-12),Math.min(66,headAge+12),randomFor(seed,prefix+'partner-age'));
  const maxChildAge=Math.min(17,headAge-16,partnerAge-16);
  const olderAge=integer(4,maxChildAge,randomFor(seed,prefix+'child-1-age'));
  const youngerAge=integer(1,olderAge-1,randomFor(seed,prefix+'child-2-age'));
  const headGiven=pick(names.heads,randomFor(seed,prefix+'head-name'));
  const legacyLeader=preserveLegacyLeaders?String(house.leader||'').trim():'';
  const usedNames=new Set(legacyLeader?legacyLeader.split(/\s+/):[headGiven]);
  const takeName=(pool,role)=>{
   const name=pick(pool.filter(candidate=>!usedNames.has(candidate)),randomFor(seed,prefix+role+'-name'));
   usedNames.add(name);
   return name;
  };
  const partnerGiven=takeName(names.partners,'partner');
  const childOneGiven=takeName(names.children,'child-1');
  const childTwoGiven=takeName(names.children,'child-2');
  const base={origin:house.faction,houseId:house.id,homeId:house.seatId};
  const headAppearance=randomAppearance(seed+'|'+house.id+'|head');
  const partnerAppearance=randomAppearance(seed+'|'+house.id+'|partner');
  const childOneAppearance=randomAppearance(seed+'|'+house.id+'|child-1');
  const childTwoAppearance=randomAppearance(seed+'|'+house.id+'|child-2');
  records.push(
   {id:headId,name:legacyLeader||fullName(headGiven,family),age:headAge,...headAppearance,role:'head',parentIds:[],partnerId,...base},
   {id:partnerId,name:fullName(partnerGiven,family),age:partnerAge,...partnerAppearance,role:'partner',parentIds:[],partnerId:headId,...base},
   {id:'person-'+house.id+'-child-1',name:fullName(childOneGiven,family),age:olderAge,...childOneAppearance,role:'child',birthOrder:1,parentIds:[headId,partnerId],partnerId:null,...base},
   {id:'person-'+house.id+'-child-2',name:fullName(childTwoGiven,family),age:youngerAge,...childTwoAppearance,role:'child',birthOrder:2,parentIds:[headId,partnerId],partnerId:null,...base}
  );
 }
 return records;
}

window.UACampaignCharacters={GENERATOR_VERSION,appearanceCatalog,normalizeAppearance,randomAppearance,create};
})();
