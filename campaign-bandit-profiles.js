(function(){
'use strict';

const VERSION=1;
const CAMP_LEVEL_MIN=1,CAMP_LEVEL_MAX=5,MAX_SOLDIERS=50;
const profiles=Object.freeze({
 woodland:Object.freeze({id:'woodland',name:'Timber Archers',mapLabel:'Timber',terrainLabel:'Woodland',
  tacticalSpecialties:['archers','flanking'],description:'Woodland outlaws use bows, light armor, and quick flanking attacks.',tactic:'loose',
  biomes:['forest','taiga','rainforest']}),
 roadside:Object.freeze({id:'roadside',name:'Road Robbers',mapLabel:'Road',terrainLabel:'Roadside',
  tacticalSpecialties:['mixed raiders','ambush'],description:'Road robbers mix shielded raiders with a few ranged fighters.',tactic:'ambush',
  biomes:['grass','scrub','desert']}),
 ridge:Object.freeze({id:'ridge',name:'Highland Deserters',mapLabel:'Highland',terrainLabel:'Highlands',
  tacticalSpecialties:['spears','shields','heavy armor'],description:'Highland deserters hold ground with spears, shields, and heavier armor.',tactic:'hold',
  biomes:['hills','mountain']}),
 marsh:Object.freeze({id:'marsh',name:'Marsh Runners',mapLabel:'Marsh',terrainLabel:'Marsh',
  tacticalSpecialties:['javelins','skirmishing'],description:'Marsh runners travel light and harry enemies with javelins.',tactic:'skirmish',
  biomes:['marsh']}),
 steppe:Object.freeze({id:'steppe',name:'Steppe Riders',mapLabel:'Steppe',terrainLabel:'Steppe',
  tacticalSpecialties:['mounted archers','cavalry','ride-by attacks'],description:'Steppe raiders rely on mounted archers and fast cavalry.',tactic:'ride-by',
  biomes:['steppe']})
});
const VALID_IDS=new Set(Object.keys(profiles));
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
function safeLevel(value){return Number.isFinite(value)?clamp(Math.floor(value),CAMP_LEVEL_MIN,CAMP_LEVEL_MAX):1}
function safeRoadTier(value){return Number.isFinite(value)?clamp(Math.floor(value),0,2):0}
function partySizeForLevel(baseStrength,level){
 const base=Number.isFinite(baseStrength)?Math.floor(baseStrength):6;
 return clamp(base+2*(safeLevel(level)-1),1,MAX_SOLDIERS);
}
function stableNumber(seed){
 const text=String(seed??0);let value=2166136261;
 for(let i=0;i<text.length;i++){value^=text.charCodeAt(i);value=Math.imul(value,16777619)}
 return value>>>0;
}
function roll(seed,slot,salt=0){
 let value=(stableNumber(seed)^Math.imul(slot+1,0x9e3779b1)^Math.imul(salt+1,0x85ebca6b))>>>0;
 value^=value>>>16;value=Math.imul(value,0x7feb352d);value^=value>>>15;value=Math.imul(value,0x846ca68b);value^=value>>>16;
 return (value>>>0)/4294967296;
}
function normalizedInput(input={}){
 return {terrainKind:typeof input.terrainKind==='string'?input.terrainKind.toLowerCase():'grass',
  roadTier:safeRoadTier(input.roadTier),approach:typeof input.approach==='string'?input.approach.toLowerCase():'',
  profileId:typeof input.profileId==='string'?input.profileId.toLowerCase():''};
}
function classify(input={}){
 const data=normalizedInput(input);
 if(VALID_IDS.has(data.profileId))return profiles[data.profileId];
 if(data.approach==='road'||data.approach==='roadside'||data.roadTier>=2)return profiles.roadside;
 if(data.terrainKind==='marsh')return profiles.marsh;
 if(data.terrainKind==='steppe')return profiles.steppe;
 if(['forest','taiga','rainforest'].includes(data.terrainKind))return profiles.woodland;
 if(['hills','mountain'].includes(data.terrainKind))return profiles.ridge;
 if(data.roadTier>0||data.approach==='road-edge')return profiles.roadside;
 return profiles.roadside;
}
function get(profileId){return VALID_IDS.has(String(profileId||'').toLowerCase())?profiles[String(profileId).toLowerCase()]:null}
function composition(profileId,level){
 if(profileId==='woodland')return {archer:clamp(.55+.025*(level-1),.55,.65),infantry:.45-.025*(level-1)};
 if(profileId==='roadside')return {infantry:.78,archer:.22};
 if(profileId==='ridge')return {infantry:.88,archer:.12};
 if(profileId==='marsh')return {infantry:.72,skirmisher:.28};
 const rider=.25+.05*(level-1);
 return {horseArcher:rider,cavalry:.12,infantry:1-rider-.12};
}
function roleSlots(profileId,level,count,seed){
 const weights=composition(profileId,level),entries=Object.entries(weights);
 const roles=entries.map(([role,weight])=>({role,count:Math.floor(weight*count),fraction:weight*count-Math.floor(weight*count)}));
 let remaining=count-roles.reduce((sum,item)=>sum+item.count,0);
 roles.sort((a,b)=>b.fraction-a.fraction||a.role.localeCompare(b.role));
 for(let i=0;i<remaining;i++)roles[i%roles.length].count++;
 const bag=[];for(const item of roles)for(let i=0;i<item.count;i++)bag.push(item.role);
 // Seeded Fisher-Yates makes the role mix stable without slot-order bias.
 for(let i=bag.length-1;i>0;i--){const j=Math.floor(roll(seed,i,17)*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]]}
 if(profileId==='steppe'&&count>0&&!bag.includes('horseArcher'))bag[0]='horseArcher';
 return bag;
}
function soldierTier(level,seed,slot){
 const chance=roll(seed,slot,31);
 if(level>=5&&chance<.34)return 2;
 if(level>=4&&chance<.20)return 2;
 if(level>=3&&chance<.10)return 2;
 if(level>=2&&chance<.22+(level-2)*.12)return 1;
 return 0;
}
function armorFor(level,seed,slot){
 const chance=roll(seed,slot,41);
 if(level>=5&&chance<.12)return'plate';
 if(level>=4&&chance<.67)return'mail';
 if(level>=3&&chance<.52)return'mail';
 if(level>=2&&chance<.72)return'leather';
 return level===1&&chance<.24?'leather':'padded';
}
function loadoutFor(profileId,level,role,slot,seed,tier){
 let weapon='shortsword',ranged=null,unitRole='infantry',horseArmor='none',shield=null;
 const chance=roll(seed,slot,53),armor=armorFor(level,seed,slot);
 if(profileId==='woodland'){
  if(role==='archer'){unitRole='archer';weapon='shortsword';ranged='bow'}
  else{weapon=chance<.53?'spear':'axe';shield=level>=2&&chance>.38?'buckler':null}
 }else if(profileId==='roadside'){
  if(role==='archer'){unitRole='archer';weapon='shortsword';ranged=level>=4&&chance<.36?'crossbow':'bow'}
  else{weapon=chance<.45?'axe':chance<.72?'spear':'shortsword';shield=chance<.22?'buckler':level>=3&&chance>.42?'round':null}
 }else if(profileId==='ridge'){
  if(role==='archer'){unitRole='archer';weapon='shortsword';ranged='bow'}
  else{weapon=level>=4&&chance<.27?'pike':'spear';shield=weapon==='pike'?null:level>=3&&chance<.77?'round':chance<.42?'buckler':null}
 }else if(profileId==='marsh'){
  if(role==='skirmisher'){weapon='shortsword';ranged='javelin';shield=null}
  else{weapon=chance<.55?'spear':'axe';shield=level>=3&&chance<.44?'buckler':null}
 }else if(profileId==='steppe'){
  if(role==='horseArcher'){unitRole='horseArcher';weapon='shortsword';ranged='horsebow';horseArmor=level>=4&&chance<.34?'mail':level>=2?'leather':'none'}
  else if(role==='cavalry'){unitRole='cavalry';weapon='lance';horseArmor=level>=5&&chance<.18?'mail':level>=3?'leather':'none'}
  else{weapon=chance<.52?'spear':'shortsword';shield=level>=3&&chance<.32?'round':null}
 }
 if(['archer','horseArcher'].includes(unitRole))shield=null;
 if(weapon==='pike'||['archer','horseArcher'].includes(unitRole))shield=null;
 const strength=clamp(level-1,0,4);
 const stats={
  hp:clamp(2.8+strength*.27+(tier===2?.18:tier===1?.08:0),2.2,4.5),
  skill:clamp(28+strength*10+tier*7+Math.round(roll(seed,slot,61)*7),20,88),
  discipline:clamp(32+strength*9+tier*6+Math.round(roll(seed,slot,67)*7),20,88),
  speed:clamp((unitRole==='horseArcher'?66:unitRole==='cavalry'?62:profileId==='marsh'?58:52)+strength*1.4,36,76),
  stamina:clamp(96+strength*3,80,110),
  weaponDamage:clamp(.94+strength*.025+tier*.015,.85,1.12),
  weaponSpeed:clamp(1+strength*.012,.88,1.10)
 };
 return {weapon,ranged,role:unitRole,armor,shield,horseArmor,stats};
}
function generate(input={}){
 const data=normalizedInput(input),profile=classify(data),level=safeLevel(input.campLevel);
 const partySize=Number.isFinite(input.partyStrength)?
  clamp(Math.floor(input.partyStrength),1,MAX_SOLDIERS):
  Number.isFinite(input.basePartyStrength)?partySizeForLevel(input.basePartyStrength,level):6+level*2;
 const seed=input.seed??(profile.id+'|'+level);
 const assignedRoles=roleSlots(profile.id,level,partySize,seed);
 const slots=assignedRoles.map((role,slot)=>{
  const tier=soldierTier(level,seed,slot),loadout=loadoutFor(profile.id,level,role,slot,seed,tier);
  return {faction:-1,tier,groupIndex:-1,slot,unitId:'outlaw-'+profile.id+'-'+role,loadout};
 });
 const compositionCounts={};for(const role of assignedRoles)compositionCounts[role]=(compositionCounts[role]||0)+1;
 return {version:VERSION,profileId:profile.id,profileName:profile.name,mapLabel:profile.mapLabel,terrainLabel:profile.terrainLabel,
  tacticalSpecialties:profile.tacticalSpecialties.slice(),description:profile.description,tactic:profile.tactic,
  campLevel:level,partySize,composition:compositionCounts,slots};
}

window.UACampaignBanditProfiles={VERSION,CAMP_LEVEL_MIN,CAMP_LEVEL_MAX,MAX_SOLDIERS,profiles,get,classify,partySizeForLevel,generate};
})();
