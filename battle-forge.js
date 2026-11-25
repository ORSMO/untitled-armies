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
 finishes:[
  {id:'quick',name:'Quick',damage:.96,handling:1.08,weight:.94,cost:{gold:3,iron:0,timber:0,tools:0}},
  {id:'balanced',name:'Balanced',damage:1,handling:1,weight:1,cost:{gold:5,iron:1,timber:0,tools:0}},
  {id:'heavy',name:'Heavy',damage:1.1,handling:.91,weight:1.1,cost:{gold:8,iron:2,timber:0,tools:1}}
 ]
};
const baseCosts={sword:{gold:8,iron:2,timber:0,tools:1},spear:{gold:6,iron:1,timber:1,tools:1}};
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
 {id:'horse-archer-sidearm',name:'Horse archer’s spear',role:'horseArcher',unit:'Horse archer',baseWeapon:'spear',build:{category:'spear',head:'leaf',shaft:'short',butt:'plain',finish:'quick'}}
];
const categories=['sword','spear'];
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
 let reach=base.profile.reach,damageModifier=1,handlingModifier=1,weight=base.profile.weight;
 const cost={...baseCosts[build.category]},components=[];
 for(const [slot,id] of Object.entries(build)){
  if(slot==='category'||slot==='finish'||slot==='name')continue;
  const part=category.parts[slot].find(item=>item.id===id);
  if(!part)return null;
  reach+=part.reach||0;
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
 reach=Math.round(clamp(reach,28,104));weight=Number(clamp(weight,.9,4.2).toFixed(2));
 const names=components.map(part=>part.name);
 const name=build.name||base.name+' · '+names.join(' / ')+' · '+finish.name;
 const id='forge-v1-'+build.category+'-'+baseWeapon+'-'+components.map(part=>part.id).join('-')+'-'+build.finish;
 const profile={category:build.category,baseWeapon,reach,damage:base.profile.damage*damageModifier,handling:handlingModifier,baseHandling:base.profile.handling,weight};
 const stats={weaponDamage:damageModifier,weaponSpeed:handlingModifier,weaponReach:reach,weaponWeight:weight};
 return {id,name,category:build.category,baseWeapon,build,parts:Object.fromEntries(components.map(part=>[part.slot,part.id])),components,finish:build.finish,profile,stats,cost};
}
function quote(input,options={}){
 const resolved=resolve(input,options);
 return resolved?{valid:true,build:resolved.build,id:resolved.id,name:resolved.name,profile:resolved.profile,stats:resolved.stats,cost:resolved.cost}: {valid:false,build:null,id:null,name:'',profile:null,stats:null,cost:null};
}
function clamp(value,min,max){return Math.max(min,Math.min(max,value))}
window.UABattleForge={version:1,catalog,presets:listPresets(),categories:categories.slice(),defaultBuild,normalizeBuild,resolve,quote,getPreset,listPresets,resolvePreset};
})();
