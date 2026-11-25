(function(){
'use strict';

// The forge is intentionally data-only: the campaign UI owns inventory changes,
// while the battle engine consumes the resolved tactical profile.
const catalog={
 sword:{
  id:'sword',name:'Sword',baseWeapon:'sword',
  baseProfile:{reach:36,damage:1,handling:1,weight:1.55},
  baseWeapons:{
   shortsword:{name:'Short sword',profile:{reach:31,damage:.91,handling:.83,weight:1}},
   sword:{name:'Arming sword',profile:{reach:36,damage:1,handling:1,weight:1.55}},
   greatsword:{name:'Greatsword',profile:{reach:47,damage:1.25,handling:1.24,weight:3.35}}
  },
  parts:{
   blade:[
    {id:'short',name:'Short blade',reach:-3,damage:.92,handling:1.08,weight:-.18,cost:{gold:2,iron:1}},
    {id:'arming',name:'Arming blade',reach:0,damage:1,handling:1,weight:0,cost:{gold:3,iron:2}},
    {id:'long',name:'Long blade',reach:3,damage:1.03,handling:.96,weight:.12,cost:{gold:4,iron:3}},
    {id:'broad',name:'Broad blade',reach:1,damage:1.1,handling:.91,weight:.28,cost:{gold:5,iron:3}}
   ],
   guard:[
    {id:'plain',name:'Plain guard',reach:0,damage:0,handling:1.02,weight:-.08,cost:{gold:1,iron:1}},
    {id:'cross',name:'Cross guard',reach:0,damage:1.02,handling:1,weight:.08,cost:{gold:2,iron:1}},
    {id:'swept',name:'Swept guard',reach:0,damage:1.04,handling:.97,weight:.18,cost:{gold:3,iron:2}},
    {id:'ring',name:'Ring guard',reach:0,damage:1.06,handling:.93,weight:.24,cost:{gold:4,iron:2}}
   ],
   grip:[
    {id:'cord',name:'Cord grip',reach:0,damage:0,handling:1.06,weight:-.08,cost:{gold:1,timber:1}},
    {id:'leather',name:'Leather wrap',reach:0,damage:1.04,handling:1.03,weight:0,cost:{gold:2,timber:1}},
    {id:'ribbed',name:'Ribbed grip',reach:0,damage:1.06,handling:1,weight:.06,cost:{gold:2,timber:1,tools:1}},
    {id:'long',name:'Long grip',reach:1,damage:1.08,handling:.96,weight:.16,cost:{gold:3,timber:2,tools:1}}
   ],
   pommel:[
    {id:'small',name:'Small pommel',reach:0,damage:.97,handling:1.04,weight:-.08,cost:{gold:1,iron:1}},
    {id:'round',name:'Round pommel',reach:0,damage:1,handling:1,weight:0,cost:{gold:2,iron:1}},
    {id:'weighted',name:'Weighted pommel',reach:0,damage:1.04,handling:.96,weight:.2,cost:{gold:3,iron:2}},
    {id:'counterweight',name:'Counterweight pommel',reach:0,damage:1.03,handling:1.04,weight:.12,cost:{gold:4,iron:2,tools:1}}
   ]
  }
 },
 spear:{
  id:'spear',name:'Spear',baseWeapon:'spear',
  baseProfile:{reach:65,damage:1.02,handling:1.04,weight:2},
  baseWeapons:{
   spear:{name:'Infantry spear',profile:{reach:65,damage:1.02,handling:1.04,weight:2}},
   pike:{name:'Long pike',profile:{reach:89,damage:1.13,handling:1.28,weight:3.7}},
   lance:{name:'Cavalry lance',profile:{reach:56,damage:1.23,handling:1.24,weight:2.5}}
  },
  parts:{
   head:[
    {id:'leaf',name:'Leaf head',reach:0,damage:1.02,handling:1,weight:0,cost:{gold:2,iron:1}},
    {id:'narrow',name:'Narrow point',reach:0,damage:1.08,handling:1.02,weight:-.06,cost:{gold:3,iron:2}},
    {id:'broad',name:'Broad head',reach:0,damage:1.1,handling:.94,weight:.16,cost:{gold:4,iron:2}},
    {id:'winged',name:'Winged head',reach:1,damage:1.12,handling:.96,weight:.2,cost:{gold:5,iron:3,tools:1}}
   ],
   shaft:[
    {id:'short',name:'Short ash shaft',reach:-7,damage:0,handling:1.08,weight:-.24,cost:{gold:1,timber:1}},
    {id:'standard',name:'Ash shaft',reach:0,damage:0,handling:1,weight:0,cost:{gold:2,timber:2}},
    {id:'long',name:'Long ash shaft',reach:7,damage:0,handling:.94,weight:.2,cost:{gold:3,timber:3,tools:1}},
    {id:'reinforced',name:'Reinforced shaft',reach:3,damage:1.05,handling:.96,weight:.28,cost:{gold:4,timber:2,iron:1,tools:1}}
   ],
   butt:[
    {id:'plain',name:'Plain butt',reach:0,damage:0,handling:1.02,weight:-.06,cost:{gold:1}},
    {id:'ferrule',name:'Iron ferrule',reach:0,damage:1.03,handling:1,weight:.05,cost:{gold:2,iron:1}},
    {id:'weighted',name:'Weighted butt',reach:0,damage:1.08,handling:.94,weight:.2,cost:{gold:3,iron:1}},
    {id:'capped',name:'Steel cap',reach:0,damage:1.05,handling:.96,weight:.14,cost:{gold:4,iron:2,tools:1}}
   ]
  }
 },
 axe:{
  id:'axe',name:'Axe',baseWeapon:'axe',
  baseProfile:{reach:43,damage:1.38,handling:1.38,weight:3.8},
  baseWeapons:{
   axe:{name:'Battle axe',profile:{reach:43,damage:1.38,handling:1.38,weight:3.8}}
  },
  parts:{
   head:[
    {id:'hatchet',name:'Hatchet head',reach:-5,damage:.93,handling:1.12,weight:-.4,cost:{gold:2,iron:1}},
    {id:'bearded',name:'Bearded head',reach:0,damage:1,handling:1,weight:0,cost:{gold:3,iron:2}},
    {id:'broad',name:'Broad head',reach:1,damage:1.08,handling:.94,weight:.24,cost:{gold:4,iron:2}},
    {id:'crescent',name:'Crescent head',reach:2,damage:1.13,handling:.89,weight:.42,cost:{gold:6,iron:3,tools:1}}
   ],
   haft:[
    {id:'short',name:'Short haft',reach:-3,damage:.97,handling:1.08,weight:-.18,cost:{gold:1,timber:1}},
    {id:'standard',name:'Hickory haft',reach:0,damage:1,handling:1,weight:0,cost:{gold:2,timber:2}},
    {id:'long',name:'Long haft',reach:4,damage:1.02,handling:.94,weight:.2,cost:{gold:3,timber:3,tools:1}},
    {id:'reinforced',name:'Reinforced haft',reach:2,damage:1.06,handling:.93,weight:.3,cost:{gold:4,timber:2,iron:1,tools:1}}
   ],
   grip:[
    {id:'cord',name:'Cord grip',reach:0,damage:.96,handling:1.08,weight:-.08,cost:{gold:1,timber:1}},
    {id:'leather',name:'Leather wrap',reach:0,damage:1,handling:1.03,weight:0,cost:{gold:2,timber:1}},
    {id:'twohand',name:'Two-hand wrap',reach:0,damage:1.06,handling:.98,weight:.1,cost:{gold:3,timber:2,tools:1}},
    {id:'strapped',name:'Strapped grip',reach:0,damage:1.03,handling:1.05,weight:.08,cost:{gold:4,timber:1,iron:1,tools:1}}
   ]
  }
 },
 bow:{
  id:'bow',name:'Bow',baseWeapon:'bow',
  baseProfile:{range:1005,ideal:645,damage:1.28,draw:.62,reload:.64,weight:1.1,speed:520},
  baseWeapons:{
   bow:{name:'War bow',profile:{range:1005,ideal:645,damage:1.28,draw:.62,reload:.64,weight:1.1,speed:520,ammo:18,momentum:48,stamina:5,loft:46,twoHand:true}},
   horsebow:{name:'Compact horse bow',profile:{range:710,ideal:420,damage:1.02,draw:.43,reload:.52,weight:.65,speed:475,ammo:24,momentum:39,stamina:3.6,loft:53,twoHand:true}}
  },
  parts:{
   limbs:[
    {id:'compact',name:'Compact limbs',range:-35,ideal:-20,damage:.93,handling:1.08,weight:-.12,cost:{gold:2,timber:1}},
    {id:'balanced',name:'Balanced limbs',range:0,ideal:0,damage:1,handling:1,weight:0,cost:{gold:3,timber:2,tools:1}},
    {id:'long',name:'Long limbs',range:70,ideal:45,damage:1.04,handling:.93,weight:.18,cost:{gold:4,timber:3,tools:1}},
    {id:'war',name:'War limbs',range:45,ideal:30,damage:1.1,handling:.88,weight:.3,cost:{gold:6,timber:3,tools:2}}
   ],
   grip:[
    {id:'light',name:'Light grip',range:-10,ideal:-5,damage:.97,handling:1.07,weight:-.08,cost:{gold:1,timber:1}},
    {id:'ergonomic',name:'Ergonomic grip',range:0,ideal:0,damage:1.02,handling:1.03,weight:0,cost:{gold:2,timber:1}},
    {id:'reinforced',name:'Reinforced grip',range:12,ideal:8,damage:1.05,handling:.96,weight:.12,cost:{gold:3,timber:2,tools:1}},
    {id:'precision',name:'Precision grip',range:0,ideal:18,damage:1.04,handling:1,weight:.06,cost:{gold:4,timber:1,iron:1,tools:1}}
   ],
   string:[
    {id:'linen',name:'Linen string',range:-15,ideal:-5,damage:.96,handling:1.05,weight:-.02,cost:{gold:1,timber:1}},
    {id:'silk',name:'Silk string',range:20,ideal:10,damage:1.02,handling:1,weight:.02,cost:{gold:3,timber:1}},
    {id:'waxed',name:'Waxed string',range:10,ideal:0,damage:1,handling:1.08,weight:.04,cost:{gold:3,timber:1,tools:1}},
    {id:'braided',name:'Braided war string',range:35,ideal:20,damage:1.08,handling:.9,weight:.12,cost:{gold:5,timber:2,tools:1}}
   ]
  }
 },
 finishes:[
  {id:'quick',name:'Quick',damage:.96,handling:1.08,weight:.94,cost:{gold:3,iron:0,timber:0,tools:0}},
  {id:'balanced',name:'Balanced',damage:1,handling:1,weight:1,cost:{gold:5,iron:1,timber:0,tools:0}},
  {id:'heavy',name:'Heavy',damage:1.1,handling:.91,weight:1.1,cost:{gold:8,iron:2,timber:0,tools:1}}
 ]
};
const baseCosts={
 sword:{gold:8,iron:2,timber:0,tools:1},
 spear:{gold:6,iron:1,timber:1,tools:1},
 axe:{gold:10,iron:3,timber:2,tools:1},
 bow:{gold:11,iron:0,timber:3,tools:1}
};
const presets=[
 {id:'recruit-sidearm',name:'Recruit’s sidearm',role:'infantry',unit:'Recruit infantry',baseWeapon:'sword',build:{category:'sword',blade:'short',guard:'plain',grip:'cord',pommel:'small',finish:'quick'}},
 {id:'shield-infantry',name:'Shield infantry sword',role:'infantry',unit:'Shield infantry',baseWeapon:'sword',build:{category:'sword',blade:'arming',guard:'cross',grip:'leather',pommel:'round',finish:'balanced'}},
 {id:'veteran-sword',name:'Veteran arming sword',role:'infantry',unit:'Veteran infantry',baseWeapon:'sword',build:{category:'sword',blade:'long',guard:'swept',grip:'ribbed',pommel:'counterweight',finish:'balanced'}},
 {id:'heavy-infantry',name:'Heavy infantry cleaver',role:'infantry',unit:'Heavy infantry',baseWeapon:'greatsword',build:{category:'sword',blade:'broad',guard:'ring',grip:'long',pommel:'weighted',finish:'heavy'}},
 {id:'archer-sidearm',name:'Archer’s short sword',role:'archer',unit:'Archer',baseWeapon:'shortsword',build:{category:'sword',blade:'short',guard:'plain',grip:'leather',pommel:'small',finish:'quick'}},
 {id:'cavalry-sword',name:'Cavalry arming sword',role:'cavalry',unit:'Cavalry',baseWeapon:'sword',build:{category:'sword',blade:'long',guard:'swept',grip:'leather',pommel:'counterweight',finish:'quick'}},
 {id:'recruit-spear',name:'Recruit’s spear',role:'infantry',unit:'Spear infantry',baseWeapon:'spear',build:{category:'spear',head:'leaf',shaft:'standard',butt:'plain',finish:'balanced'}},
 {id:'shield-spear',name:'Shieldwall spear',role:'infantry',unit:'Shield spearman',baseWeapon:'spear',build:{category:'spear',head:'narrow',shaft:'short',butt:'ferrule',finish:'quick'}},
 {id:'pike-infantry',name:'Long pike',role:'infantry',unit:'Pikeman',baseWeapon:'pike',build:{category:'spear',head:'narrow',shaft:'long',butt:'capped',finish:'heavy'}},
 {id:'cavalry-lance',name:'Cavalry spear',role:'cavalry',unit:'Cavalry lancer',baseWeapon:'lance',build:{category:'spear',head:'broad',shaft:'long',butt:'weighted',finish:'heavy'}},
 {id:'horse-archer-sidearm',name:'Horse archer’s spear',role:'horseArcher',unit:'Horse archer',baseWeapon:'spear',build:{category:'spear',head:'leaf',shaft:'short',butt:'plain',finish:'quick'}},
 {id:'recruit-axe',name:'Recruit’s hand axe',role:'infantry',unit:'Axe infantry',baseWeapon:'axe',build:{category:'axe',head:'hatchet',haft:'short',grip:'cord',finish:'quick'}},
 {id:'veteran-axe',name:'Veteran battle axe',role:'infantry',unit:'Veteran axe infantry',baseWeapon:'axe',build:{category:'axe',head:'broad',haft:'reinforced',grip:'strapped',finish:'balanced'}},
 {id:'heavy-axe',name:'Heavy crescent axe',role:'infantry',unit:'Heavy axe infantry',baseWeapon:'axe',build:{category:'axe',head:'crescent',haft:'long',grip:'twohand',finish:'heavy'}},
 {id:'foot-warbow',name:'Foot archer’s war bow',role:'archer',unit:'Foot archer',baseWeapon:'bow',build:{category:'bow',limbs:'long',grip:'ergonomic',string:'silk',finish:'balanced'}},
 {id:'veteran-warbow',name:'Veteran war bow',role:'archer',unit:'Veteran archer',baseWeapon:'bow',build:{category:'bow',limbs:'war',grip:'reinforced',string:'braided',finish:'heavy'}},
 {id:'light-archer-bow',name:'Light archer’s bow',role:'archer',unit:'Light archer',baseWeapon:'bow',build:{category:'bow',limbs:'compact',grip:'light',string:'waxed',finish:'quick'}},
 {id:'horsebow-mounted',name:'Mounted archer’s bow',role:'horseArcher',unit:'Horse archer',baseWeapon:'horsebow',build:{category:'bow',limbs:'compact',grip:'light',string:'waxed',finish:'quick'}}
];
const categories=['sword','spear','axe','bow'];
const finishById=Object.fromEntries(catalog.finishes.map(item=>[item.id,item]));
const presetById=Object.fromEntries(presets.map(item=>[item.id,item]));
function copy(value){return JSON.parse(JSON.stringify(value))}
function validId(list,id){return typeof id==='string'&&list.some(item=>item.id===id)}
function normalizeBuild(input){
 if(!input||typeof input!=='object'||!categories.includes(input.category))return null;
 const category=catalog[input.category],parts={};
 for(const [slot,options] of Object.entries(category.parts)){
  if(!validId(options,input[slot]))return null;
  parts[slot]=input[slot];
 }
 if(!validId(catalog.finishes,input.finish))return null;
 const build={category:input.category,...parts,finish:input.finish};
 if(typeof input.name==='string'){
  const name=input.name.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,32);
  if(name)build.name=name;
 }
 return build;
}
function defaultBuild(category){
 if(!categories.includes(category))return null;
 const parts=catalog[category].parts,result={category};
 for(const [slot,options] of Object.entries(parts))result[slot]=options[0].id;
 result.finish='balanced';
 return result;
}
function getPreset(id){
 if(typeof id!=='string'||!Object.prototype.hasOwnProperty.call(presetById,id))return null;
 const preset=copy(presetById[id]),build=normalizeBuild({...preset.build,name:preset.name});
 return {...preset,build};
}
function listPresets(){return presets.map(({id,name,role,unit,baseWeapon})=>({id,name,role,unit,baseWeapon}))}
function resolvePreset(id){
 const preset=getPreset(id);
 return preset?resolve(preset.build,{baseWeapon:preset.baseWeapon}):null;
}
function resolve(input,options={}){
 const build=normalizeBuild(input);
 if(!build)return null;
 const category=catalog[build.category],finish=finishById[build.finish];
 const requestedBase=typeof options==='string'?options:options?.baseWeapon;
 const baseWeapon=requestedBase||category.baseWeapon;
 if(typeof baseWeapon!=='string'||!Object.prototype.hasOwnProperty.call(category.baseWeapons,baseWeapon))return null;
 const base=category.baseWeapons[baseWeapon];
 const ranged=build.category==='bow';
 let measure=ranged?base.profile.range:base.profile.reach,idealDelta=0;
 let damageModifier=1,handlingModifier=1,weight=base.profile.weight;
 const cost={...baseCosts[build.category]},components=[];
 for(const [slot,id] of Object.entries(build)){
  if(slot==='category'||slot==='finish'||slot==='name')continue;
  const part=category.parts[slot].find(item=>item.id===id);
  if(!part)return null;
  measure+=ranged?(part.range||0):(part.reach||0);
  if(ranged)idealDelta+=part.ideal||0;
  damageModifier*=part.damage||1;
  handlingModifier*=part.handling||1;
  weight+=part.weight||0;
  components.push({slot,id:part.id,name:part.name});
  for(const key of Object.keys(cost))cost[key]+=part.cost?.[key]||0;
 }
 damageModifier*=finish.damage;handlingModifier*=finish.handling;weight*=finish.weight;
 for(const key of Object.keys(cost))cost[key]+=finish.cost?.[key]||0;
 // Keep engine-facing multipliers in the range its stat normalizer accepts.
 damageModifier=clamp(damageModifier,.86,1.14);handlingModifier=clamp(handlingModifier,.86,1.14);
 measure=Math.round(clamp(measure,ranged?300:28,ranged?1300:104));
 const minWeight=ranged?0.4:0.9,maxWeight=build.category==='axe'?5.2:4.2;
 weight=Number(clamp(weight,minWeight,maxWeight).toFixed(2));
 const names=components.map(part=>part.name);
 const name=build.name||base.name+' · '+names.join(' / ')+' · '+finish.name;
 const id='forge-v1-'+build.category+'-'+baseWeapon+'-'+components.map(part=>part.id).join('-')+'-'+build.finish;
 const profile={...base.profile,category:build.category,baseWeapon,damage:base.profile.damage*damageModifier,handling:handlingModifier,baseHandling:base.profile.handling||1,weight};
 const stats={weaponReach:measure,weaponWeight:weight};
 if(ranged){
  const ideal=Math.round(clamp(base.profile.ideal+idealDelta,160,measure*.92));
  profile.range=measure;profile.ideal=ideal;
  profile.draw=Number((base.profile.draw/handlingModifier).toFixed(3));
  profile.reload=Number((base.profile.reload/handlingModifier).toFixed(3));
  stats.rangedDamage=damageModifier;stats.rangedRange=measure;stats.rangedIdeal=ideal;
  stats.rangedDraw=profile.draw;stats.rangedReload=profile.reload;stats.rangedWeight=weight;
 }else{
  profile.reach=measure;stats.weaponDamage=damageModifier;stats.weaponSpeed=handlingModifier;
 }
 return {id,name,category:build.category,baseWeapon,build,parts:Object.fromEntries(components.map(part=>[part.slot,part.id])),components,finish:build.finish,profile,stats,cost};
}
function quote(input,options={}){
 const resolved=resolve(input,options);
 return resolved?{valid:true,build:resolved.build,id:resolved.id,name:resolved.name,profile:resolved.profile,stats:resolved.stats,cost:resolved.cost}: {valid:false,build:null,id:null,name:'',profile:null,stats:null,cost:null};
}
function clamp(value,min,max){return Math.max(min,Math.min(max,value))}
window.UABattleForge={version:1,catalog,presets:listPresets(),categories:categories.slice(),defaultBuild,normalizeBuild,resolve,quote,getPreset,listPresets,resolvePreset};
})();
