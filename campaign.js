
(function(){
'use strict';
const W=window.UAWorld;if(!W)throw Error('World data is missing');
const $=id=>document.getElementById(id),F=W.factions,S=W.settlements,ARMORY=window.UAArmory,FORGE=window.UABattleForge,NOBLES=window.UANobles,CHARACTERS=window.UACampaignCharacters,CHAR_UI=window.UACharacterUI,BASE_SETTLEMENTS=S.map(site=>({prosperity:site.prosperity,garrison:site.garrison}));
const PRISONERS=window.UAPrisoners,WORKSHOPS=window.UACampaignWorkshops,NOBLE_HOUSES=window.UANobleHouses;
const CORRIDORS=window.UACorridors,PLACE_ROLES=window.UACampaignPlaceRoles;
const placeRoles=PLACE_ROLES.create({settlements:S,factions:F,tileAt:W.tileAt});
const KEY='ua-campaign-v1',VERSION=1,MAXPARTY=75,MAX_DEPLOYED=50,MAX_ACTIVE_WORLD_WARS=2;
const clamp=W.clamp,dist=(a,b,x,y)=>Math.hypot(a-x,b-y),esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const canvas=$('worldCanvas'),ctx=canvas.getContext('2d'),mini=$('minimap'),mctx=mini.getContext('2d');
let state=null,selected=null,selectedFaction=6,modalStack=[],focus=true,camera={x:3870,y:5320,zoom:.47},keys=new Set(),drag=null,last=0,lastHud=0,lastMini=0,lastSave=0,toastUntil=0,menuOpen=true,miniBase=null,view={w:900,h:600},inspectorDirty=true;
const mapPointers=new Map();
let mapPinch=null;
const TOWN_ENTRY_RANGE=155,LANDMARK_RANGE=145;
const OUTLAW_CAMP_NAMES=new Set(['Larkwood Camp','Fallen Banner Camp','Three Oaks Camp']);
const OUTLAW_CAMPS=W.landmarks.filter(place=>place.kind==='camp'&&OUTLAW_CAMP_NAMES.has(place.name));
const screens=['screenMenu','screenCreate','screenFactions','screenAtlas','screenOptions','screenPause','screenParty','screenCharacter','screenTown','screenLandmark','screenEncounter','screenAftermath','screenArmory'];
const settingsDefault={borders:true,labels:true,roads:true,minimap:true,follow:true};
const ITEMS={
 sword:{name:'Arming sword',slot:'weapon',price:180,icon:'⚔',rating:5},axe:{name:'Battle axe',slot:'weapon',price:220,icon:'🪓',rating:6},
 spear:{name:'Soldier spear',slot:'weapon',price:145,icon:'🔱',rating:4},bow:{name:'Hunting bow',slot:'weapon',price:260,icon:'🏹',rating:4},
 shortsword:{name:'Short sword',slot:'weapon',price:125,icon:'⚔',lootOnly:true},
 greatsword:{name:'Greatsword',slot:'weapon',price:325,icon:'⚔',lootOnly:true},
 pike:{name:'Long pike',slot:'weapon',price:185,icon:'🔱',lootOnly:true},
 lance:{name:'Cavalry lance',slot:'weapon',price:205,icon:'🔱',lootOnly:true},
 crossbow:{name:'Crossbow',slot:'weapon',price:310,icon:'🏹',lootOnly:true},
 javelin:{name:'Javelins',slot:'weapon',price:115,icon:'🔱',lootOnly:true},
 horsebow:{name:'Horse bow',slot:'weapon',price:275,icon:'🏹',lootOnly:true},
 paddedArmor:{name:'Padded coat',slot:'armor',price:95,icon:'🧥',rating:1},leatherArmor:{name:'Leather armor',slot:'armor',price:230,icon:'🥋',rating:2},
 mailArmor:{name:'Mail hauberk',slot:'armor',price:510,icon:'🛡',rating:4},plateArmor:{name:'Plate harness',slot:'armor',price:980,icon:'⚙',rating:6},
 buckler:{name:'Buckler',slot:'shield',price:90,icon:'🛡',rating:1},roundShield:{name:'Round shield',slot:'shield',price:125,icon:'🛡',rating:2},kiteShield:{name:'Kite shield',slot:'shield',price:270,icon:'🛡',rating:3},
 quiver:{name:'Leather quiver',slot:'quiver',price:85,icon:'🏹',rating:2},rockPouch:{name:'Throwing-stone pouch',slot:'quiver',price:70,icon:'🪨',rating:2},
 arrows:{name:'Arrows · 12',stack:true,price:24,icon:'➶'},stones:{name:'Throwing stones · 6',stack:true,price:18,icon:'●'},food:{name:'Provisions · 8',stack:true,price:28,icon:'🍞'},grain:{name:'Grain',stack:true,resource:true,price:8,icon:'🌾'},timber:{name:'Timber',stack:true,resource:true,price:13,icon:'🪵'},iron:{name:'Iron',stack:true,resource:true,price:20,icon:'⛏'},tools:{name:'Tools',stack:true,resource:true,price:25,icon:'🔧'},salt:{name:'Salt',stack:true,resource:true,price:15,icon:'🧂'}
};
const TRADE_RESOURCES=['grain','timber','iron','tools','salt'];
const FORGE_MATERIALS=['iron','timber','tools'];
const WORKSHOP_ITEMS=['sword','spear','axe'];
const WORKSHOP_STAKE={gold:220,materials:{iron:2,timber:2,tools:1}};
const FORGE_GEAR_SALVAGE={
 sword:{iron:2},axe:{iron:2,timber:1},spear:{iron:1,timber:2},bow:{timber:3},
 shortsword:{iron:1},greatsword:{iron:3},pike:{iron:1,timber:3},lance:{iron:1,timber:2},
 crossbow:{iron:1,timber:2},javelin:{iron:1,timber:1},horsebow:{timber:2},
 paddedArmor:{tools:1},leatherArmor:{tools:2},mailArmor:{iron:4},plateArmor:{iron:5,tools:1},
 buckler:{iron:1},roundShield:{timber:2},kiteShield:{timber:3,iron:1}
};
const BATTLE_LOOT={
 weapon:{sword:'sword',shortsword:'shortsword',greatsword:'greatsword',axe:'axe',spear:'spear',pike:'pike',lance:'lance',bow:'bow',crossbow:'crossbow',javelin:'javelin',horsebow:'horsebow'},
 armor:{padded:'paddedArmor',leather:'leatherArmor',mail:'mailArmor',plate:'plateArmor'},
 shield:{buckler:'buckler',round:'roundShield',kite:'kiteShield'}
};
const houseNames=[
 [['Mossmantle','Lady Elowen'],['Thornmere','Lord Branoc']],
 [['Rimehall','Jarl Sigrid'],['Stormwake','Jarl Torven']],
 [['Deepdelve','Thane Brunna'],['Flintvein','Thane Hadrik']],
 [['Veyr','Queen Alisande'],['Goldbridge','Lord Mathis']],
 [['Dawnshield','Emir Samir'],['Amberhawk','Lady Nura']],
 [['Saltwake','First Speaker Mara'],['Reedwater','Captain Iven']],
 [['Valecourt','King Edric'],['Redwillow','Lady Isolde']],
 [['Aurel','Empress Livia'],['Vellan','Marshal Severin']],
 [['Saffari','Sultan Idris'],['Moonwell','Lady Zahra']],
 [['Red Banner','Khan Temar'],['Sky Rein','Lady Oruna']]
];
const HOUSES=F.flatMap(f=>{
 const settlements=S.filter(site=>site.faction===f.id);
 const capital=settlements.find(site=>site.type==='capital');
 const stronghold=settlements.find(site=>site.type==='castle')||settlements.find(site=>site.type==='town');
 return houseNames[f.id].map(([name,leader],branch)=>({
  id:f.id*2+branch,faction:f.id,name:'House '+name,leader,seatId:(branch?stronghold:capital).id
 }));
});
const seatHouse=id=>HOUSES.find(house=>house.seatId===id);
function localHouse(site){
 const [ruling,landed]=HOUSES.filter(house=>house.faction===site.faction);
 const capital=S[ruling.seatId],keep=S[landed.seatId];
 return dist(site.x,site.y,keep.x,keep.y)<dist(site.x,site.y,capital.x,capital.y)?landed:ruling;
}
function houseFavor(house){return state?.player.houseFavor?.[house.id]||0}
function installFamilies(raw){
 const seed=typeof raw?.familySeed==='string'&&raw.familySeed&&raw.familySeed.length<=128?raw.familySeed:null;
 state.familySeed=seed||(raw?'legacy-'+state.player.origin+'-'+state.player.name:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
 state.legacyHouseLeaders=!!raw&&(!seed||raw.legacyHouseLeaders===true);
 const saved=new Map((Array.isArray(raw?.familyProfiles)?raw.familyProfiles:[]).filter(p=>typeof p?.id==='string').map(p=>[p.id,p]));
 const people=CHARACTERS.create({houses:HOUSES,factions:F,seed:state.familySeed,preserveLegacyLeaders:state.legacyHouseLeaders,savedProfiles:saved}).map(person=>{
  const profile=saved.get(person.id),name=typeof profile?.name==='string'?profile.name.trim().slice(0,48):'';
  const age=Number.isInteger(profile?.age)&&(person.role==='child'?profile.age>=1&&profile.age<18:profile.age>=18&&profile.age<=100)?profile.age:person.age;
  const fixedHead=state.legacyHouseLeaders&&person.role==='head';
  return {...person,name:fixedHead?person.name:name||person.name,age,
   appearance:CHARACTERS.normalizeAppearance(profile?.appearance||person.appearance||person)};
 });
 state.people=new Map(people.map(person=>[person.id,person]));
 state.families=new Map(HOUSES.map(house=>[house.id,people.filter(person=>person.houseId===house.id)]));
}
function houseFamily(houseId){return state?.families?.get(houseId)||[]}
function houseHead(houseId){return houseFamily(houseId).find(person=>person.role==='head')}
function houseLeader(house){return house&& (houseHead(house.id)?.name||house.leader)}
function campaignHours(){return (state.day-1)*24+state.hour}
function installNobles(saved,treasuries){
 state.nobleHouses=NOBLE_HOUSES.create(W,HOUSES,state.families,treasuries,state.day,resourceProduction);
 const holdings=new Map(state.nobleHouses.houses.map(house=>[house.houseId,house.holdings]));
 state.nobles=NOBLES.create(W,HOUSES,saved,campaignHours(),{families:state.families,
  strength:id=>NOBLE_HOUSES.strength(state.nobleHouses,id),holdings:id=>holdings.get(id)});
 state.noblePeople=new Map(state.nobles.map(noble=>[noble.personId,noble]));
 state.nobleParties=new Map(state.nobles.map(noble=>[noble.party.id,noble]));
 state.nobleDependents=new Map();
 for(const person of state.people.values()){
  if(state.noblePeople.has(person.id))continue;
  const escort=state.noblePeople.get(person.parentIds[1])||state.noblePeople.get(person.parentIds[0]);
  if(escort){
   state.nobleDependents.set(person.id,escort);
   (escort.dependents??=[]).push(person);
  }
 }
 state.parties.push(...state.nobles.map(noble=>noble.party));
}
function nobleByHouse(id){return state?.noblePeople?.get(houseHead(id)?.id)}
function nobleForPerson(id){return state?.noblePeople?.get(id)||state?.nobleDependents?.get(id)}
function nobleActivity(noble){
 const present=S[noble.siteId],destination=S[noble.destinationId];
 if(present)return (present.id===noble.homeId?'At ':'Visiting ')+present.name;
 if(!destination)return 'On the road';
 const activity={return:'Returning to ',inspection:'Inspecting the road to ',supplies:'Seeking supplies at ',patrol:'Patrolling toward '};
 return (activity[noble.purpose]||'Traveling to ')+destination.name+
  (noble.cargo?' with '+noble.cargo.quantity+' '+noble.cargo.resource:'');
}
function nobleRole(person){return person.role==='partner'?'Partner · Steward':person.relationLabel||'Household member'}
function nobleStopScore(noble,site){
 if(noble.circuit.purpose==='supplies'&&site.type==='village'&&noble.holdings.includes(site.id)){
  const {quantity}=nobleSupplyOffer(noble,site);
  return 90+quantity*55;
 }
 if(!['inspection','patrol'].includes(noble.circuit.purpose))return 0;
 return state.parties.reduce((danger,party)=>party.active&&party.kind==='bandit'&&dist(site.x,site.y,party.x,party.y)<910?danger+Math.min(65,party.strength*4):danger,0);
}
function nobleSupplyOffer(noble,site){
 const resource=TRADE_RESOURCES.includes(site.specialty)?site.specialty:'grain';
 const source=ensureMarket(site),target=ensureMarket(S[noble.homeId]);
 const surplus=source.stock[resource]-Math.ceil(source.capacity[resource]*.33);
 const shortfall=Math.ceil(target.capacity[resource]*.6)-target.stock[resource];
 return {resource,quantity:Math.max(0,Math.min(8,Math.floor(surplus),shortfall))};
}
function nobleArrival(noble,site){
 if(noble.circuit.purpose!=='supplies')return;
 if(site.id===noble.homeId&&noble.cargo){
  const market=ensureMarket(site),{resource,quantity}=noble.cargo;
  const delivered=Math.min(quantity,market.capacity[resource]-market.stock[resource]);
  if(delivered>0){
   market.stock[resource]+=delivered;noble.cargo.quantity-=delivered;
   if(!noble.cargo.quantity)noble.cargo=null;
   reportWorldEvent(site.x,site.y,partyName(noble.party)+' delivered '+delivered+' '+resource+' to '+site.name+'.');
  }
 }else if(!noble.cargo&&site.type==='village'&&noble.holdings.includes(site.id)){
  const offer=nobleSupplyOffer(noble,site);
  if(offer.quantity){ensureMarket(site).stock[offer.resource]-=offer.quantity;noble.cargo=offer}
 }
}
function nobleRoadReport({x,y}){
 const threats=state.parties.filter(p=>p.active&&p.kind==='bandit'&&dist(x,y,p.x,p.y)<1800);
 const nearest=threats.sort((a,b)=>dist(x,y,a.x,a.y)-dist(x,y,b.x,b.y))[0];
 if(!nearest)return 'My escort has seen no outlaws on these roads today.';
 const site=W.closestSettlement(nearest.x,nearest.y);
 return 'My escort saw an outlaw band of '+nearest.strength+(site?' near '+site.name:' nearby')+'.';
}
function nobleGreeting(houseId){
 return houseId%2===0?'Welcome, traveler. Tell me what news you bring from the roads.':
  'Welcome. I keep watch over these roads. Ask if you need a report.';
}
function forgeCategory(weapon){
 if(['sword','shortsword','greatsword'].includes(weapon))return 'sword';
 if(['spear','pike','lance'].includes(weapon))return 'spear';
 return weapon==='axe'?'axe':null;
}
function smithyBaseWeapon(loadout,category){
 if(category==='bow')return ['bow','horsebow'].includes(loadout.ranged)?loadout.ranged:null;
 return forgeCategory(loadout.weapon)===category?loadout.weapon:null;
}
function troopForgePreset(loadout,tier){
 const preset=loadout.weapon==='axe'?['recruit-axe','veteran-axe','heavy-axe'][tier]:
  loadout.weapon==='pike'?'pike-infantry':
  loadout.weapon==='lance'?'cavalry-lance':
  loadout.weapon==='greatsword'?'heavy-infantry':
  loadout.weapon==='spear'?(loadout.role==='horseArcher'?'horse-archer-sidearm':tier>0&&loadout.shield?'shield-spear':'recruit-spear'):
  forgeCategory(loadout.weapon)==='sword'?(loadout.role==='archer'?'archer-sidearm':['cavalry','horseArcher'].includes(loadout.role)?'cavalry-sword':
   tier===2?'veteran-sword':tier===1&&loadout.shield?'shield-infantry':'recruit-sidearm'):null;
 return preset?FORGE.getPreset(preset)?.build:null;
}
function kingdomLoadout(faction,tier,unitId){
 const key=ARMORY.designKey(faction,tier,unitId),player=state?.player;
 const design=player?.armory?.[key],loadout=ARMORY.getLoadout(faction,tier,design,unitId);
 const build=player?.forge?.troops?.[key]||(!design&&troopForgePreset(loadout,tier));
 const weapon=build&&FORGE.resolve(build,{baseWeapon:loadout.weapon});
 const rangedBase=smithyBaseWeapon(loadout,'bow');
 const preset=rangedBase==='horsebow'?'horsebow-mounted':tier===2?'veteran-warbow':'foot-warbow';
 const bowBuild=rangedBase&&(player?.forge?.rangedTroops?.[key]||(!design&&FORGE.getPreset(preset)?.build));
 const bow=bowBuild&&FORGE.resolve(bowBuild,{baseWeapon:rangedBase});
 if(weapon){
  loadout.stats=weapon.stats;
  if(loadout.ranged)loadout.sidearmName=weapon.name;
  else loadout.weaponName=weapon.name;
 }
 if(bow){loadout.weaponName=bow.name;loadout.rangedStats=bow.stats}
 return loadout;
}
const SHOP_ITEMS=['food','sword','axe','spear','bow','paddedArmor','leatherArmor','mailArmor','plateArmor','roundShield','kiteShield','quiver','rockPouch','arrows','stones',...TRADE_RESOURCES];
const ITEM_SLOT_LABELS={weapon:'Weapon',armor:'Armor',shield:'Shield',quiver:'Pouch / quiver'};
const PERKS={
 armsmaster:{name:'Armsmaster',icon:'⚔',description:'+10 hero combat skill in campaign battles.'},
 quartermaster:{name:'Quartermaster',icon:'🍞',description:'Reduce daily troop wages and food use by 15%.'},
 tactician:{name:'Tactician',icon:'🧭',description:'Troops receive battlefield orders 20% faster.'},
 trader:{name:'Silver Tongue',icon:'🪙',description:'Pay 10% less at settlement markets.'},
 fieldMedic:{name:'Field Medic',icon:'✚',description:'Rest restores 16 extra health and morale.'},
 outrider:{name:'Outrider',icon:'🏇',description:'Move 12% faster on the campaign map.'}
};
function notify(msg){const t=$('toast');t.textContent=msg;t.classList.remove('hidden');toastUntil=performance.now()+4200}
function log(message){if(!state)return;state.messages.unshift({day:state.day,text:message});state.messages.length=Math.min(12,state.messages.length)}
function showScreen(id){
 for(const s of screens)$(s).classList.toggle('hidden',s!==id);
 menuOpen=!!id;
 if(menuOpen){keys.clear();resetMapGesture()}
 if(state){
  if(menuOpen)stopWaiting();
  state.paused=menuOpen||state.pausedManual;
 }
}
function openModal(id){
 const active=screens.find(s=>!$(s).classList.contains('hidden'))||null;
 if(active===id)return;
 modalStack.push(active);
 showScreen(id);
}
function closeModal(){
 const previous=modalStack.length?modalStack.pop():state?'screenPause':'screenMenu';
 showScreen(previous);
}
function savedExists(){try{return !!localStorage.getItem(KEY)}catch(e){return false}}
function refreshContinue(){$('menuContinue').disabled=!savedExists()}
function rosterCount(){return state?state.player.roster.reduce((n,t)=>n+t.count,0):0}
function troopName(group){
 return ARMORY.getBranch(group.faction,group.tier,group.unitId)?.name||F[group.faction]?.troops[clamp(group.tier,0,2)]||'Unknown soldier';
}
const TROOP_WAGES=[2,4,7],PROMOTION_TRAINING=[2,3],PROMOTION_PRICE=[45,105];
function partyGroupStatus(group){
 const wounded=group.wounded,healthy=group.count-wounded,trainingNeeded=PROMOTION_TRAINING[group.tier]||0;
 let ready=0,closestTraining=0;
 if(trainingNeeded)for(const training of group.training.slice(0,healthy)){
  if(training>=trainingNeeded)ready++;
  else closestTraining=Math.max(closestTraining,training);
 }
 return {healthy,wounded,ready,trainingNeeded,closestTraining};
}
function addHealthyTroops(faction,tier,unitId,quantity){
 const roster=state.player.roster;
 let group=roster.find(g=>g.faction===faction&&g.tier===tier&&g.unitId===unitId);
 if(!group){group={faction,tier,unitId,count:0,wounded:0,training:[]};roster.push(group)}
 group.training.splice(group.count-group.wounded,0,...Array(quantity).fill(0));
 group.count+=quantity;
 return group;
}
function standingLabel(value){return value>=60?'Trusted':value>=25?'Respected':value<=-60?'Outlawed':value<=-25?'Unwelcome':'Neutral'}
function recruitmentTerms(site){
 const p=state.player,standing=Number(p.reputation[site.faction])||0,used=p.recruitment[site.id];
 const stock=Math.max(0,(standing>=40?6:4)-(used?.day===state.day?used.count:0));
 const access=standing>-60,available=Math.max(0,Math.min(stock,MAXPARTY-rosterCount()));
 const unit=Math.max(1,Math.round(45*clamp(1-standing*.004,.72,1.4)));
 return {count:available,available,max:access?Math.min(available,Math.floor(p.gold/unit)):0,unit,access,dailyWage:TROOP_WAGES[0]};
}
function retainerOffer(site,house=seatHouse(site.id)){
 if(!house)return null;
 const noble=nobleByHouse(house.id);
 const cost=95,count=Math.min(2,MAXPARTY-rosterCount());
 const reason=site.id!==house.seatId?'Retainers at '+S[house.seatId].name:
  noble&&noble.siteId!==site.id?houseLeader(house)+' is away':
  houseFavor(house)<16?'Requires 16 house favor':
  !recruitmentTerms(site).access?'Recruitment denied':
  state.player.retainerDays[house.id]===state.day?'Available again tomorrow':
  count===0?'Company full':state.player.gold<count*cost?'Not enough denars':'';
 const unitId=site.faction===6?'val-retainer':undefined;
 return {house,count,cost,reason,unitId,name:troopName({faction:site.faction,tier:1,unitId})};
}
function recruitRetainers(site,house){
 const offer=retainerOffer(site,house);
 if(!offer||offer.reason){notify(offer?.reason||'Retainers recruit at a house seat.');return false}
 const player=state.player;
 addHealthyTroops(site.faction,1,offer.unitId,offer.count);
 player.gold-=offer.count*offer.cost;
 player.retainerDays[offer.house.id]=state.day;
 log(offer.house.name+' supplied '+offer.count+' trained retainers.');
 notify(offer.count+' trained retainers joined.');
 return true;
}
function changeStanding(faction,amount){
 if(!Number.isInteger(faction)||faction<0||faction>=F.length)return;
 const rep=state.player.reputation;rep[faction]=clamp((Number(rep[faction])||0)+amount,-100,100);
}
function reportWorldEvent(x,y,message){
 if(dist(state.player.x,state.player.y,x,y)>2100)return;
 log(message);notify(message);
}
function restoreSettlementState(saved){for(let i=0;i<S.length;i++){const base=BASE_SETTLEMENTS[i],item=Array.isArray(saved)?saved[i]:null;S[i].prosperity=clamp(Number.isFinite(item?.prosperity)?item.prosperity:base.prosperity,0,100);S[i].garrison=Math.max(0,Math.round(Number.isFinite(item?.garrison)?item.garrison:base.garrison))}}
function preparePlayer(p){
 p.age=clamp(Math.round(Number(p.age)||26),18,75);
 p.appearance=CHARACTERS.normalizeAppearance(p.appearance);
 p.hp=Number.isFinite(p.hp)?clamp(Math.round(p.hp),5,100):100;
 p.stats={strength:5,agility:5,tactics:5,leadership:5,...(p.stats||{})};
 p.statPoints=Math.max(0,Number(p.statPoints)||0);
 p.perkPoints=Math.max(0,Number(p.perkPoints)||0);p.perks=Array.isArray(p.perks)?p.perks.filter(id=>PERKS[id]):[];
 p.perkPoints=Math.max(p.perkPoints,Math.floor((Number(p.level)||1)/3)-p.perks.length);
 p.morale=clamp(Number.isFinite(Number(p.morale))?Number(p.morale):65,0,100);p.reputation=Array.isArray(p.reputation)?Array.from({length:F.length},(_,i)=>clamp(Number(p.reputation[i])||0,-100,100)):Array(F.length).fill(0);
 p.activeContracts=Array.isArray(p.activeContracts)?p.activeContracts:[];
 p.armory=ARMORY.normalizeDesigns(p.armory);
 p.roster=p.roster.filter(g=>g&&Number.isInteger(g.faction)&&F[g.faction]&&Number.isInteger(g.tier)&&g.tier>=0&&g.tier<=2&&Number.isFinite(g.count)&&g.count>=1);
 for(const g of p.roster){
  g.count=Math.min(MAXPARTY,Math.floor(g.count));
  g.wounded=clamp(Math.floor(Number(g.wounded)||0),0,g.count);
  // Stable slot order: fit troops first, wounded troops after them.
  const training=Array.isArray(g.training)?g.training:[];
  g.training=Array.from({length:g.count},(_,slot)=>clamp(Math.floor(Number(training[slot])||0),0,PROMOTION_TRAINING[g.tier]||0));
  if(!ARMORY.getBranch(g.faction,g.tier,g.unitId))delete g.unitId;
 }
 p.recruitment=Object.fromEntries(S.flatMap(site=>{
  const offer=p.recruitment?.[site.id];
  return Number.isInteger(offer?.day)&&Number.isInteger(offer?.count)?[[site.id,{day:offer.day,count:clamp(offer.count,0,6)}]]:[];
 }));
 p.houseFavor=Object.fromEntries(HOUSES.map(h=>[h.id,clamp(Math.floor(Number(p.houseFavor?.[h.id])||0),0,100)]));
 p.retainerDays=Object.fromEntries(HOUSES.filter(h=>Number.isInteger(p.retainerDays?.[h.id])).map(h=>[h.id,p.retainerDays[h.id]]));
 p.prisoners=PRISONERS.normalize(p.prisoners);
 p.inventory={arrows:24,stones:0,food:0,grain:0,timber:0,iron:0,tools:0,salt:0,...(p.inventory||{})};
 p.equipment={weapon:'sword',armor:'paddedArmor',shield:'roundShield',quiver:'quiver',...(p.equipment||{})};
 p.forge=normalizeCampaignForge(p.forge);
 if(!p.forge.equipped&&!p.equipment.weapon)p.equipment.weapon='sword';
 for(const id of Object.keys(ITEMS))if(ITEMS[id].slot&&p.equipment[ITEMS[id].slot]===id)p.inventory[id]=Math.max(0,Number(p.inventory[id])||0);
 return p;
}
function grantItem(id,count=1){const inv=state.player.inventory;inv[id]=(Number(inv[id])||0)+count}
function grantXP(amount){
 const p=state.player;p.xp=(Number(p.xp)||0)+amount;let levels=0;
 while(p.xp>=p.level*125){p.xp-=p.level*125;p.level++;p.hp=100;p.statPoints=(p.statPoints||0)+1;if(p.level%3===0)p.perkPoints=(p.perkPoints||0)+1;levels++}
 if(levels)notify('Level up! Level '+p.level+' · '+levels+' stat point'+(levels===1?'':'s')+(p.perkPoints?' · perk point ready':'')+'.');
}
function troopPower(){return state.player.roster.reduce((n,g)=>n+g.count*(1+g.tier*.95),0)+state.player.level*1.8}
function saveGame(silent){
 if(!state)return false;
 try{
  const data={version:VERSION,player:state.player,day:state.day,hour:state.hour,
   parties:state.parties.filter(p=>p.kind!=='noble').map(p=>({id:p.id,x:p.x,y:p.y,tx:p.tx,ty:p.ty,strength:p.strength,active:p.active,kind:p.kind,faction:p.faction,targetPartyId:p.targetPartyId??null,cargo:p.cargo??null,tradeTargetId:p.tradeTargetId??null})),
   nobles:NOBLES.snapshot(state.nobles),nobleHouses:NOBLE_HOUSES.snapshot(state.nobleHouses),
   familySeed:state.familySeed,familyVersion:CHARACTERS.GENERATOR_VERSION,legacyHouseLeaders:state.legacyHouseLeaders,
   familyProfiles:[...state.families.values()].flat().map(({id,name,age,appearance})=>({id,name,age,appearance})),
   options:state.options,speed:1,zoom:camera.zoom,visitedLandmarks:state.visitedLandmarks||[],pendingBattleId:state.pendingBattleId||null,lastEncounter:state.lastEncounter,
   marketStocks:state.marketStocks||{},workshops:state.workshops,corridor:state.corridor,banditCamps:state.banditCamps,
   escortPartyId:state.escortPartyId,completedContracts:state.completedContracts||[],diplomacy:state.diplomacy,settlementProjects:state.settlementProjects||{},settlementState:S.map(site=>({prosperity:site.prosperity,garrison:site.garrison}))};
  const serialized=JSON.stringify(data),previous=localStorage.getItem(KEY);
  if(previous&&previous!==serialized){try{const older=localStorage.getItem(KEY+'-backup-1');if(older)localStorage.setItem(KEY+'-backup-2',older);localStorage.setItem(KEY+'-backup-1',previous)}catch(e){}}
  localStorage.setItem(KEY,serialized);
  if(!silent)notify('Campaign saved on this device.');
  return true;
 }catch(e){if(!silent)notify('Could not save. Allow local browser storage.');return false}
}
function resetView(){camera.x=state.player.x;camera.y=state.player.y;camera.zoom=clamp(camera.zoom,.12,1.9);focus=true;inspectorDirty=true}
function generateParties(){
 const parties=[],total=68;
 for(let i=0;i<total;i++){
  const kind=i<27?'bandit':i<48?'patrol':'caravan';
  const fid=(i*7+3)%10,capital=F[fid].capital;
  let x,y;
  if(i<3){const base=F[state.player.origin].capital;x=base[0]+(i-1)*440;y=base[1]+(i%2?520:-380)}
  else if(kind==='bandit'){x=350+W.hash(i,71)*(W.WIDTH-700);y=370+W.hash(i,66)*(W.HEIGHT-740)}
  else{x=capital[0]+(W.hash(i,82)-.5)*1300;y=capital[1]+(W.hash(i,91)-.5)*1300}
  const near=W.nearestWalk(clamp(Math.floor(x/W.TILE),0,W.COLS-1),clamp(Math.floor(y/W.TILE),0,W.ROWS-1));
  if(near){x=near.x*W.TILE+28;y=near.y*W.TILE+28}
  parties.push({id:i,kind,faction:kind==='bandit'?-1:fid,x,y,tx:x,ty:y,strength:kind==='bandit'?4+(i*13)%11:kind==='patrol'?22+(i*3)%25:9+(i*5)%16,active:true,path:[],pathIndex:0,cargo:null,tradeTargetId:null});
 }
 return parties;
}
function startCampaign(){
 modalStack=[];restoreSettlementState();
 const name=($('newName').value||'Wanderer').trim().slice(0,28)||'Wanderer';
 const origin=clamp(Number($('originSelect').value)||0,0,9);
 const background=$('backgroundSelect').value;
 const age=Number($('newAge').value),appearance=CHAR_UI?.readAppearance();
 const cap=F[origin].capital;
 // Spawn near each faction's gates and within immediate recruiting range.
 const x=cap[0]+45,y=cap[1]+45;
 const money=background==='merchant'?1250:background==='soldier'?650:900;
 const firstTroops=background==='soldier'?
  [{faction:origin,tier:0,count:5},{faction:origin,tier:1,count:3}]:
  [{faction:origin,tier:0,count:8}];
 state={version:VERSION,player:{name,origin,background,age,appearance,x,y,gold:money,food:background==='merchant'?28:22,hp:100,
   level:1,xp:0,renown:0,roster:firstTroops,quest:{id:0,progress:0,goal:3,done:false}},
   day:1,hour:8,waiting:false,waitSpeed:1,paused:false,pausedManual:false,path:[],pathIndex:0,targetSettlement:null,targetLandmark:null,
   corridor:CORRIDORS.normalize(null,1),banditCamps:restoreBanditCamps(null,1),escortPartyId:null,
   followPartyId:null,followRepath:0,visitedLandmarks:[],pendingBattleId:null,
   parties:[],options:{...settingsDefault},messages:[],unseen:[],lastEncounter:-100,marketStocks:{},workshops:{},completedContracts:[],diplomacy:createDiplomacy(),settlementProjects:{}};
  state.player=preparePlayer(state.player);
  state.parties=generateParties();installFamilies();installNobles();initializeMarkets();refreshBanditCamps(true);
  launchCorridor('patrol');launchCorridor('shipment');selected={type:'settlement',id:origin*8};
 camera.zoom=.47;resetView();$('game').classList.remove('hidden');showScreen(null);resize();
 log('Your story begins beneath the banners of '+F[origin].name+'.');
 log('Your first task: recruit three volunteers from a settlement.');
 refreshUI();saveGame(true);notify('Welcome to the continent of Asterra. Click anywhere to travel.');
}
function loadGame(){
 modalStack=[];
 try{
  const raw=JSON.parse(localStorage.getItem(KEY));if(!raw||raw.version!==VERSION||!raw.player)throw Error('Wrong save version');
   const p=raw.player;if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(p.gold)||!Array.isArray(p.roster))throw Error('Corrupt data');preparePlayer(p);
  p.x=clamp(p.x,0,W.WIDTH);p.y=clamp(p.y,0,W.HEIGHT);
  // Saved character locations survive the V4.1 geography rebuild.
  // If new water now covers an old saved position, reach the nearest land.
  if(!W.tileAt(p.x,p.y).walk){
   const land=W.nearestWalk(Math.floor(p.x/W.TILE),Math.floor(p.y/W.TILE));
   if(land){p.x=(land.x+.5)*W.TILE;p.y=(land.y+.5)*W.TILE}
  }
  state={version:VERSION,player:p,day:raw.day||1,hour:Number.isFinite(raw.hour)?raw.hour:8,waiting:false,waitSpeed:1,
   paused:false,pausedManual:false,path:[],pathIndex:0,targetSettlement:null,targetLandmark:null,
   corridor:CORRIDORS.normalize(raw.corridor,raw.day||1),banditCamps:restoreBanditCamps(raw.banditCamps,raw.day||1),escortPartyId:null,
   followPartyId:null,followRepath:0,visitedLandmarks:Array.isArray(raw.visitedLandmarks)?raw.visitedLandmarks:[],pendingBattleId:raw.pendingBattleId||null,
   parties:[],options:{...settingsDefault,...raw.options},
   messages:[],lastEncounter:Number.isFinite(raw.lastEncounter)?raw.lastEncounter:-100,marketStocks:raw.marketStocks&&typeof raw.marketStocks==='object'?raw.marketStocks:{},workshops:WORKSHOPS.normalize(raw.workshops,S,raw.day||1),completedContracts:Array.isArray(raw.completedContracts)?raw.completedContracts:[],diplomacy:normalizeDiplomacy(raw.diplomacy,raw.day||1),settlementProjects:raw.settlementProjects&&typeof raw.settlementProjects==='object'?raw.settlementProjects:{}};
  restoreSettlementState(raw.settlementState);state.parties=generateParties();initializeMarkets();
  if(Array.isArray(raw.parties))for(const saved of raw.parties){let a=state.parties.find(v=>v.id===saved.id);
    if(!a&&Number.isInteger(saved.id)&&saved.id>=68&&['bandit','patrol','caravan'].includes(saved.kind)&&
     (saved.kind==='bandit'?saved.faction===-1:Number.isInteger(saved.faction)&&saved.faction>=0&&saved.faction<F.length)&&
     Number.isFinite(saved.strength)&&typeof saved.active==='boolean'){
     a={id:saved.id,kind:saved.kind,faction:saved.faction,strength:saved.strength,active:saved.active,x:saved.x,y:saved.y,tx:saved.x,ty:saved.y,path:[],pathIndex:0};state.parties.push(a);
    }
    if(a&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)){
     Object.assign(a,saved);a.path=[];a.pathIndex=0;
     if(a.kind==='caravan'&&a.cargo){
      const cargo=a.cargo;
      if(!S[a.tradeTargetId]||!S[cargo.from]||!['food',...TRADE_RESOURCES].includes(cargo.resource)||
         !Number.isInteger(cargo.quantity)||cargo.quantity<1)a.cargo=null;
     }
     if(!W.tileAt(a.x,a.y).walk){
      const land=W.nearestWalk(Math.floor(a.x/W.TILE),Math.floor(a.y/W.TILE));
      if(land){a.x=(land.x+.5)*W.TILE;a.y=(land.y+.5)*W.TILE}
     }
    }}
  if(state.parties.some(p=>p.id===raw.escortPartyId&&p.active&&CORRIDORS.mission(state.corridor,p.id)?.kind==='shipment')){
   state.escortPartyId=raw.escortPartyId;state.followPartyId=raw.escortPartyId;
  }
  installFamilies(raw);
  installNobles(raw.nobles,raw.nobleHouses);
  refreshBanditCamps(true);
  if(!raw.corridor){launchCorridor('patrol');launchCorridor('shipment')}
  camera.zoom=clamp(raw.zoom||.47,.12,1.9);resetView();$('game').classList.remove('hidden');showScreen(null);resize();
  selected={type:'land'};log('Campaign resumed. Your journey continues.');refreshUI();
  if(!consumeBattleResult()){
   if(closeUnavailableBounties()){refreshUI();saveGame(true)}
   else notify('Campaign loaded.');
  }
  return true;
 }catch(e){notify('Could not load this campaign save.');return false}
}
function showMenu(){
 modalStack=[];
 if(state)saveGame(true);
 $('game').classList.add('hidden');showScreen('screenMenu');refreshContinue();selected=null;keys.clear();
}
function selectNew(){
 modalStack=[];
 $('newName').value='Wanderer';$('originSelect').value='6';$('backgroundSelect').value='wanderer';$('newAge').value='26';
 CHAR_UI?.showAppearance(CHARACTERS.normalizeAppearance());
 showScreen('screenCreate');
}
function resize(){
 const rect=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
 view.w=Math.max(1,rect.width);view.h=Math.max(1,rect.height);
 canvas.width=Math.ceil(view.w*dpr);canvas.height=Math.ceil(view.h*dpr);
 ctx.setTransform(dpr,0,0,dpr,0,0);
 const mr=mini.getBoundingClientRect();
 mini.width=Math.ceil(Math.max(1,mr.width)*dpr);mini.height=Math.ceil(Math.max(1,mr.height)*dpr);
 mctx.setTransform(dpr,0,0,dpr,0,0);lastMini=0;
}
function toWorld(x,y){return{x:camera.x+(x-view.w/2)/camera.zoom,y:camera.y+(y-view.h/2)/camera.zoom}}
function toScreen(x,y){return{x:(x-camera.x)*camera.zoom+view.w/2,y:(y-camera.y)*camera.zoom+view.h/2}}
function zoomAt(mult,sx=view.w/2,sy=view.h/2){
 const before=toWorld(sx,sy);camera.zoom=clamp(camera.zoom*mult,.115,1.9);
 camera.x=before.x-(sx-view.w/2)/camera.zoom;camera.y=before.y-(sy-view.h/2)/camera.zoom;
 camera.x=clamp(camera.x,0,W.WIDTH);camera.y=clamp(camera.y,0,W.HEIGHT);focus=false;lastMini=0;
}
function travelTo(x,y,targetId,landmarkId=null){
 if(!state||menuOpen)return;
 if(targetId!=null&&dist(state.player.x,state.player.y,x,y)<=TOWN_ENTRY_RANGE){arriveSettlement(targetId);return}
 if(landmarkId!=null&&dist(state.player.x,state.player.y,x,y)<=LANDMARK_RANGE){arriveLandmark(landmarkId);return}
 const route=W.findPath(state.player.x,state.player.y,x,y);
 if(!route.length){notify('No traversable route found.');return}
 stopWaiting();
 state.path=route;state.pathIndex=0;state.targetSettlement=targetId==null?null:targetId;
 state.followPartyId=null;state.escortPartyId=null;state.targetLandmark=landmarkId;
 focus=state.options.follow;
 if(state.pausedManual)notify('Route set. Resume time to travel.');
 else if(targetId!=null)notify('Traveling to '+S[targetId].name+' · '+PLACE_ROLES.get(placeRoles,targetId).title);
 else if(landmarkId!=null)notify('Traveling to '+W.landmarks[landmarkId].name+'.');
 else notify('Travel route set · '+Math.round(route.length*W.TILE/100)/10+' leagues approximately.');
 refreshUI();
}
function partyName(p){
 if(!p)return'Unknown travelers';
 if(p.kind==='noble')return state?.people?.get(p.personId)?.name||houseLeader(HOUSES[p.houseId])||'Noble escort';
 const mission=state&&CORRIDORS.mission(state.corridor,p.id);
 if(mission)return mission.kind==='patrol'?'Valecrown road patrol':'Duskford grain convoy';
 const camp=banditCampForParty(p.id);
 if(camp)return banditCampName(camp)+' raiders';
 return p.kind==='bandit'?'Outlaw Bandits':
  (F[p.faction]?.name||'Wandering')+' '+(p.kind==='patrol'?'Patrol':'Caravan');
}
function partyMapLabel(p){
 const mission=CORRIDORS.mission(state.corridor,p.id);
 if(mission)return mission.kind==='patrol'?'Valecrown patrol · '+p.strength:'Grain convoy · '+mission.quantity;
 return p.kind==='noble'?partyName(p)+' · '+p.strength:
  (p.kind==='bandit'?(banditCampForParty(p.id)?'Camp raiders ':'Bandits '):p.kind==='patrol'?'Patrol ':'Caravan ')+p.strength;
}
function followParty(id,escort=false){
 if(!state||menuOpen)return;
 const party=state.parties.find(p=>p.id===id&&p.active);
 if(!party){notify('That party is no longer on the roads.');return}
 stopWaiting();
 state.followPartyId=id;state.escortPartyId=escort?id:null;
 state.followRepath=0;state.targetSettlement=null;state.targetLandmark=null;state.path=[];state.pathIndex=0;
 selected={type:'party',id};focus=true;inspectorDirty=true;
 updateFollow(0);
 if(state.followPartyId===id)notify(state.pausedManual?'Resume time to follow '+partyName(party)+'.':(escort?'Escorting ':'Following ')+partyName(party)+'.');
 refreshUI();
}
function updateFollow(dt){
 if(!state||state.followPartyId==null)return;
 const party=state.parties.find(p=>p.id===state.followPartyId&&p.active);
 if(!party){
  const noble=state.nobleParties.get(state.followPartyId);
  const site=noble&&S[noble.siteId];
  state.followPartyId=null;state.escortPartyId=null;state.path=[];state.pathIndex=0;
  if(site){
   selected={type:'settlement',id:site.id};inspectorDirty=true;
   travelTo(site.x,site.y,site.id);
  }else notify('You lost the party you were following.');
  return;
 }
 const distance=dist(state.player.x,state.player.y,party.x,party.y);
 const escort=state.escortPartyId===party.id;
 if(distance<=143&&!escort){state.path=[];state.pathIndex=0;openEncounter(party);return}
 if(escort&&distance<=68){state.path=[];state.pathIndex=0;return}
 state.followRepath-=dt;
 if(state.followRepath>0&&state.pathIndex<state.path.length)return;
 // Aim a few route segments ahead: the target continues moving while
 // the player travels. Reroute periodically instead of only once.
 const lead=party.path.length?
  party.path[Math.min(party.path.length-1,party.pathIndex+3)]:party;
 let route=W.findPath(state.player.x,state.player.y,lead.x,lead.y);
 if(!route.length&&lead!==party)route=W.findPath(state.player.x,state.player.y,party.x,party.y);
 if(route.length){state.path=route;state.pathIndex=0}
 else if(state.pathIndex>=state.path.length){
  state.followPartyId=null;state.escortPartyId=null;state.path=[];state.pathIndex=0;inspectorDirty=true;
  notify('No traversable route to '+partyName(party)+'.');
 }
 state.followRepath=1.25;
}
function walkPlayer(dx,dy,dt){
 const p=state.player,mag=Math.hypot(dx,dy);if(mag<.0001)return false;
 const spd=147*W.walkingSpeed(p.x,p.y)*dt*(p.perks.includes('outrider')?1.12:1);
 const x=clamp(p.x+dx/mag*spd,15,W.WIDTH-15),y=clamp(p.y+dy/mag*spd,15,W.HEIGHT-15);
 if(!W.tileAt(x,y).walk)return false;
 const d=dist(p.x,p.y,x,y);p.x=x;p.y=y;advanceTime(d);
 return true;
}
function advanceTime(distance){
 advanceCampaignHours(distance/230);
}
function advanceCampaignHours(hours){
 state.hour+=hours;
 while(state.hour>=24){state.hour-=24;advanceDay();if(state.player.hp<100)state.player.hp=Math.min(100,state.player.hp+3)}
}
function createDiplomacy(){
 const relations=Array.from({length:F.length},()=>Array(F.length).fill(0));
 const tension=Array.from({length:F.length},()=>Array(F.length).fill(0));
 for(let a=0;a<F.length;a++)for(let b=a+1;b<F.length;b++){
  const value=22+Math.floor(W.hash(a+11,b+37)*19);
  relations[a][b]=relations[b][a]=value;
 }
 return {relations,tension,wars:[],alliances:[],history:[],truceUntil:{},lastIncidentByPair:{},nextIncidentDay:8};
}
function normalizeDiplomacy(raw,day){
 const base=createDiplomacy();
 if(!raw||!Array.isArray(raw.relations))return base;
 for(let a=0;a<F.length;a++)for(let b=a+1;b<F.length;b++){
  const value=Number(raw.relations[a]?.[b]),heat=Number(raw.tension?.[a]?.[b]);
  if(Number.isFinite(value))base.relations[a][b]=base.relations[b][a]=clamp(value,-100,100);
  if(Number.isFinite(heat))base.tension[a][b]=base.tension[b][a]=clamp(heat,0,100);
 }
 const validPairs=list=>(Array.isArray(list)?list:[]).filter(x=>x&&Number.isInteger(x.a)&&Number.isInteger(x.b)&&x.a>=0&&x.b>=0&&x.a<F.length&&x.b<F.length&&x.a!==x.b).map(x=>({...x,a:Math.min(x.a,x.b),b:Math.max(x.a,x.b)}));
 base.wars=validPairs(raw.wars).map(w=>({...w,startDay:clamp(Number.isFinite(w.startDay)?w.startDay:day,1,day),score:Number.isFinite(w.score)?w.score:0}));base.alliances=validPairs(raw.alliances);
 base.history=Array.isArray(raw.history)?raw.history.filter(x=>x&&Number.isFinite(x.day)&&typeof x.text==='string').slice(0,12):[];
 base.truceUntil=raw.truceUntil&&typeof raw.truceUntil==='object'?raw.truceUntil:{};
 base.lastIncidentByPair=raw.lastIncidentByPair&&typeof raw.lastIncidentByPair==='object'?raw.lastIncidentByPair:{};
 base.nextIncidentDay=Number.isFinite(raw.nextIncidentDay)?Math.max(8,raw.nextIncidentDay):base.nextIncidentDay;
 return base;
}function pairHas(list,a,b){const lo=Math.min(a,b),hi=Math.max(a,b);return list.some(x=>x.a===lo&&x.b===hi)}
function factionsAtWar(a,b){return !!state&&a!==b&&pairHas(state.diplomacy.wars,a,b)}
function factionsAllied(a,b){return !!state&&a!==b&&pairHas(state.diplomacy.alliances,a,b)}
function factionRelation(a,b){return a===b?100:state?.diplomacy?.relations?.[a]?.[b]??0}
function factionTension(a,b){return a===b?0:state?.diplomacy?.tension?.[a]?.[b]??0}
function setFactionTension(a,b,value){if(a===b)return;state.diplomacy.tension[a][b]=state.diplomacy.tension[b][a]=clamp(value,0,100)}
function setFactionRelation(a,b,value){if(a===b)return;state.diplomacy.relations[a][b]=state.diplomacy.relations[b][a]=clamp(value,-100,100)}
function recordDiplomacy(text){
 const d=state.diplomacy;d.history.unshift({day:state.day,text});d.history=d.history.slice(0,12);log('Day '+state.day+': '+text);
 if(state.day%3===0)notify(text);
}
function factionResourceTotal(faction,resource){
 return S.filter(site=>site.faction===faction).reduce((n,site)=>n+(state.marketStocks[site.id]?.stock?.[resource]||0),0);
}
function declareWar(a,b){
 const d=state.diplomacy,activeFor=id=>d.wars.filter(w=>w.a===id||w.b===id).length;
 if(factionsAtWar(a,b)||factionsAllied(a,b)||(d.truceUntil[pairKey(a,b)]||0)>state.day||activeFor(a)>=2||activeFor(b)>=2||d.wars.length>=MAX_ACTIVE_WORLD_WARS)return;
 d.wars.push({a:Math.min(a,b),b:Math.max(a,b),attacker:a,defender:b,startDay:state.day,score:0});
 setFactionRelation(a,b,-40);
 recordDiplomacy(F[a].name+' and '+F[b].name+' have declared war.');
 const allies=d.alliances.filter(pact=>pact.a===b||pact.b===b).map(pact=>pact.a===b?pact.b:pact.a);
 const ally=allies.find(id=>id!==a&&!factionsAtWar(id,a)&&!factionsAllied(id,a)&&
  (d.truceUntil[pairKey(id,a)]||0)<=state.day&&factionRelation(id,a)<38&&activeFor(id)<2);
 if(ally!==undefined&&d.wars.length<MAX_ACTIVE_WORLD_WARS&&activeFor(a)<2){
  d.wars.push({a:Math.min(ally,a),b:Math.max(ally,a),attacker:a,defender:ally,startDay:state.day,score:0,defensive:true});
  setFactionRelation(ally,a,-32);
  recordDiplomacy(F[ally].name+' honored its defensive pact and joined the war.');
 }
}
function pairKey(a,b){return Math.min(a,b)+':'+Math.max(a,b)}
const crossBorderRoads=new Set(W.roadLinks.map(([a,b])=>pairKey(S[a].faction,S[b].faction)));
function chooseDiplomaticIncident(d){
 let best=null,bestScore=-Infinity;
 for(let a=0;a<F.length;a++)for(let b=a+1;b<F.length;b++){
  const key=pairKey(a,b),last=Number(d.lastIncidentByPair[key])||0;
  if(pairHas(d.wars,a,b)||pairHas(d.alliances,a,b)||last>state.day-6||(d.truceUntil[key]||0)>state.day)continue;
  const sharedRoad=crossBorderRoads.has(key),heat=factionTension(a,b);
  const affinity=W.hash(a+61,b+271);
  const score=W.hash(state.day+21*a,41*b+713)+(sharedRoad?.7:0)+heat*.016+
   (affinity>.68?(factionRelation(a,b)-25)*.023:0);
  if(score>bestScore){bestScore=score;best={a,b,key,affinity}}
 }
 return best;
}
function diplomacyDay(){
 const d=state.diplomacy;
 for(const pact of [...d.alliances]){
  if(factionRelation(pact.a,pact.b)>20&&factionTension(pact.a,pact.b)<45)continue;
  d.alliances=d.alliances.filter(entry=>entry!==pact);
  recordDiplomacy(F[pact.a].name+' and '+F[pact.b].name+' ended their alliance.');
 }
 for(const war of [...d.wars]){
  const age=state.day-war.startDay;
  if(age>=8){setFactionRelation(war.a,war.b,factionRelation(war.a,war.b)+2);setFactionTension(war.a,war.b,factionTension(war.a,war.b)-1)}
  if(age>=11&&(factionRelation(war.a,war.b)>=-8||age>=22||Math.abs(war.score||0)>=4&&age>=14)){
   d.wars=d.wars.filter(w=>w!==war);d.truceUntil[pairKey(war.a,war.b)]=state.day+30;
   setFactionRelation(war.a,war.b,Math.max(-12,factionRelation(war.a,war.b)));
   setFactionTension(war.a,war.b,Math.max(0,factionTension(war.a,war.b)-25));
   recordDiplomacy(F[war.a].name+' and '+F[war.b].name+' signed a truce after '+age+' days of war.');
  }
 }
 if(state.day>=d.nextIncidentDay){
  const incident=chooseDiplomaticIncident(d);
  if(incident){
   const {a,b,key,affinity}=incident;
   const relation=factionRelation(a,b),heat=factionTension(a,b),shortage=Math.min(factionResourceTotal(a,'grain'),factionResourceTotal(b,'grain'))<30;
   const goodwill=W.hash(state.day,911)+affinity*.8>(shortage?1.2:.97);
   if(goodwill){
    setFactionRelation(a,b,relation+13);setFactionTension(a,b,heat-12);
    recordDiplomacy(F[a].name+' and '+F[b].name+' opened a shared trade compact.');
   }else{
    const strain=10+Math.floor(W.hash(state.day,127)*5)+(shortage?4:0);
    setFactionRelation(a,b,relation-strain);setFactionTension(a,b,heat+12+(shortage?8:0));
    recordDiplomacy((shortage?'Grain shortages worsened ':'A border dispute strained ')+F[a].name+' and '+F[b].name+' relations.');
   }
   d.lastIncidentByPair[key]=state.day;
   const nextRelation=factionRelation(a,b),nextHeat=factionTension(a,b);
   if(nextRelation>=54&&nextHeat<=24&&!pairHas(d.alliances,a,b)&&state.day>=21){
    d.alliances.push({a,b,formedDay:state.day});recordDiplomacy(F[a].name+' and '+F[b].name+' formed a defensive alliance.');
   }else if(nextRelation<=-18&&nextHeat>=42&&!factionsAtWar(a,b)&&state.day>=35)declareWar(a,b);
  }
  d.nextIncidentDay=state.day+2+Math.floor(W.hash(state.day,581)*2);
 }
}
function resourceProduction(site){
 const kind=W.tileAt(site.x,site.y).kind,r={grain:1,timber:0,iron:0,tools:0,salt:0};
 if(['grass','steppe','marsh','rainforest'].includes(kind))r.grain+=2;
 if(['forest','taiga','rainforest'].includes(kind))r.timber=3;
 if(['hills','mountain'].includes(kind))r.iron=2;
 if(['desert','scrub','marsh'].includes(kind))r.salt=2;
 if(site.type==='village'){
  if(site.specialty&&site.specialty!=='tools')r[site.specialty]+=4;
 }else if(site.type==='town'||site.type==='capital'){
  r.grain++;
  r.tools=site.marketTier==='hub'?2:1;
 }else if(site.type==='castle'){r.tools=1}
 const yieldFactor=clamp(.75+site.prosperity/200,.75,1.25);for(const key of ['grain','timber','iron','salt'])r[key]=Math.round(r[key]*yieldFactor);
 const role=PLACE_ROLES.get(placeRoles,site.id);
 for(const item of TRADE_RESOURCES)r[item]+=role?.productionBonus[item]||0;
 if(role?.identityKey==='smithing-town')r.tools++;
 return r;
}
function resourceCapacity(id,site){
 const base={grain:90,timber:70,iron:55,tools:42,salt:50}[id]||20;
 const scale=site.marketTier==='hub'?1.65:site.marketTier==='regional'?1.15:site.type==='castle'?.8:.7;
 const specialty=site.specialty===id&&site.type==='village'?.35:0;
 return Math.round(base*(scale+specialty))+(state.settlementProjects?.[site.id]?.granary&&id==='grain'?40:0);
}
function defaultMarketCapacity(id,site){
 if(TRADE_RESOURCES.includes(id))return resourceCapacity(id,site);
 const hub=site.marketTier==='hub';
 if(id==='food')return (hub?10:5)+Math.floor(site.prosperity/18);
 return (['arrows','stones'].includes(id)?3:2)+(hub?2:0);
}
function ensureMarket(site){
 state.marketStocks=state.marketStocks||{};
 let market=state.marketStocks[site.id];
 if(!market||typeof market!=='object')market=state.marketStocks[site.id]={stock:{},capacity:{},lastDay:state.day};
 market.stock=market.stock&&typeof market.stock==='object'?market.stock:{};
 market.capacity=market.capacity&&typeof market.capacity==='object'?market.capacity:{};
 let rates;
 for(const itemId of marketGoods(site)){
  const targetCapacity=defaultMarketCapacity(itemId,site);
  if(!Number.isFinite(market.stock[itemId])){
   if(TRADE_RESOURCES.includes(itemId)){
    rates??=resourceProduction(site);
    const initialShare=site.specialty===itemId&&site.type==='village'?.52:.34;
    market.stock[itemId]=Math.round(clamp(targetCapacity*initialShare+rates[itemId]*5+(site.prosperity-50)*.12,5,targetCapacity));
   }else if(itemId==='food')market.stock[itemId]=(site.marketTier==='hub'?6:3)+Math.floor(site.prosperity/24);
   else{
    const expensive=['mailArmor','plateArmor','kiteShield','bow'].includes(itemId);
    market.stock[itemId]=expensive?1+(site.prosperity>75?1:0):1;
   }
  }
  market.stock[itemId]=Math.max(0,market.stock[itemId]);
  market.capacity[itemId]=Math.max(market.stock[itemId],targetCapacity);
 }
 market.lastDay=Number.isFinite(market.lastDay)?market.lastDay:state.day;
 return market;
}
function initializeMarkets(){
 if(!state)return;
 for(const site of S){const market=ensureMarket(site);market.lastDay=state.day}
}
function advanceEconomy(){
 for(const site of S){
  const market=ensureMarket(site),stock=market.stock,rates=resourceProduction(site),granary=!!state.settlementProjects[site.id]?.granary;
  if(!Number.isFinite(stock.food))stock.food=0;
  const grainUse=site.id===CORRIDORS.PILOT.townId?rates.grain+4:site.type==='village'?1:2;
  const underWar=state.diplomacy.wars.some(w=>w.a===site.faction||w.b===site.faction);
  if(underWar&&['capital','castle'].includes(site.type)&&state.day%2===0)stock.grain=Math.max(0,stock.grain-1);
  if(underWar&&['capital','castle'].includes(site.type)&&state.day%3===0&&stock.iron>0)stock.iron=Math.max(0,stock.iron-1);
  for(const id of TRADE_RESOURCES){
   if(id==='tools'){
    const made=Math.min(rates.tools,market.capacity.tools-stock.tools,stock.iron,stock.timber);
    stock.iron-=made;stock.timber-=made;stock.tools+=made;
    continue;
   }
   stock[id]=clamp(stock[id]+rates[id],0,market.capacity[id]);
  }
  if(stock.grain>=grainUse){
   stock.grain-=grainUse;
   const normalOutput=granary?2:1;
   const saltPreservesExtra=stock.salt>0&&stock.food+normalOutput<market.capacity.food&&state.day%3===0;
   if(saltPreservesExtra)stock.salt--;
   stock.food=Math.min(market.capacity.food,stock.food+normalOutput+(saltPreservesExtra?1:0));
   site.prosperity=clamp(site.prosperity+.04,0,100);
  }else{
   stock.grain=0;site.prosperity=clamp(site.prosperity-.22,0,100);
   if(site.garrison>5&&state.day%5===0)site.garrison--;
  }
  for(const id of Object.keys(stock)){
   if(TRADE_RESOURCES.includes(id)||id==='food')continue;
   const cap=market.capacity[id]||defaultMarketCapacity(id,site),restock=['arrows','stones'].includes(id)&&state.day%2===0?1:state.day%4===0?1:0;
   stock[id]=Math.min(cap,stock[id]+restock);
  }
  if(state.workshops[site.id]){
   const demand=site.prosperity<20?0:site.marketTier==='hub'?2:1;
   WORKSHOPS.processDay(state.workshops,site.id,{day:state.day,market,prices:workshopPrices(site),demand});
  }
  if(site.id===CORRIDORS.PILOT.castleId&&stock.grain>=14&&stock.tools>=1){
   const deployed=state.parties.find(p=>p.id===state.corridor.patrol?.partyId&&p.active)?.strength||0;
   const openings=BASE_SETTLEMENTS[site.id].garrison-site.garrison-deployed;
   if(openings>0&&state.day%2===0){site.garrison+=Math.min(2,openings);stock.grain-=2;stock.tools--}
  }
  market.lastDay=state.day;
 }
}
function dailyWages(rawWageAdjustment=0){
 const p=state.player;
 const raw=p.roster.reduce((sum,g)=>sum+g.count*TROOP_WAGES[g.tier],rawWageAdjustment);
 return Math.max(0,Math.ceil(raw*(p.perks.includes('quartermaster')?.85:1)));
}
function dailyProvisions(){
 const baseNeed=Math.max(1,Math.ceil(rosterCount()/10));
 return Math.max(1,Math.ceil(baseNeed*(state.player.perks.includes('quartermaster')?.85:1)));
}
function advanceDay(){
 state.day++;advanceEconomy();
 state.nobleHouses=NOBLE_HOUSES.advance(state.nobleHouses,W,state.day,resourceProduction);
 for(const noble of state.nobles)noble.party.strength=NOBLE_HOUSES.strength(state.nobleHouses,noble.personId);
 diplomacyDay();consumeFood();refreshBanditCamps(true);replenishRoadParties();
 launchCorridor('patrol');launchCorridor('shipment');
}
function replenishRoadParties(){
 const limits={bandit:27,patrol:21,caravan:20};
 for(const [kind,limit] of Object.entries(limits)){
  if(state.parties.filter(p=>p.active&&p.kind===kind).length>=limit)continue;
  const id=nextRoadPartyId(),faction=(id*7+state.day*3)%F.length;
  let x,y;
  if(kind==='caravan'){
   const site=S[(id*13+state.day*5)%S.length];x=site.x+(W.hash(id,state.day+91)-.5)*520;y=site.y+(W.hash(id+7,state.day+27)-.5)*520;
  }else if(kind==='patrol'){
   const cap=F[faction].capital;x=cap[0]+(W.hash(id,82)-.5)*1000;y=cap[1]+(W.hash(id,91)-.5)*1000;
  }else{x=350+W.hash(id,state.day+71)*(W.WIDTH-700);y=370+W.hash(id,state.day+66)*(W.HEIGHT-740)}
  const near=W.nearestWalk(clamp(Math.floor(x/W.TILE),0,W.COLS-1),clamp(Math.floor(y/W.TILE),0,W.ROWS-1));
  if(near){x=near.x*W.TILE+28;y=near.y*W.TILE+28}
  state.parties.push({id,kind,faction:kind==='bandit'?-1:faction,x,y,tx:x,ty:y,
   strength:kind==='bandit'?4+(id*13)%11:kind==='patrol'?22+(id*3)%25:9+(id*5)%16,
   active:true,path:[],pathIndex:0,targetPartyId:null});
 }
}
function nextRoadPartyId(){
 return state.parties.reduce((n,p)=>Math.max(n,p.id),Math.max(67,state.corridor.lastPatrol?.partyId||0,state.corridor.lastShipment?.partyId||0))+1;
}
function corridorContext(){
 const {castleId,townId,villageId}=CORRIDORS.PILOT;
 const castle=S[castleId],market=ensureMarket(S[townId]);
 return {world:W,day:state.day,garrison:castle.garrison,castleGrain:ensureMarket(castle).stock.grain,
  grain:ensureMarket(S[villageId]).stock.grain,targetRoom:Math.max(0,market.capacity.grain-market.stock.grain)};
}
function launchCorridor(kind){
 const result=CORRIDORS.launch(state.corridor,kind,{...corridorContext(),partyId:nextRoadPartyId()});
 if(!result.ok)return result;
 state.corridor=result.state;
 S[CORRIDORS.PILOT.castleId].garrison+=result.garrisonDelta;
 ensureMarket(S[result.sourceSiteId]).stock.grain+=result.sourceGrainDelta;
 state.parties.push(result.party);inspectorDirty=true;
 return result;
}
function finishCorridor(partyId,event){
 const mission=CORRIDORS.mission(state.corridor,partyId);
 if(!mission)return false;
 const party=state.parties.find(p=>p.id===partyId),context=corridorContext();
 const result=CORRIDORS.settle(state.corridor,mission.kind,{...context,partyId,event,remaining:party?.strength||0});
 if(!result.ok)return false;
 state.corridor=result.state;
 if(party){party.path=[];party.pathIndex=0;party.targetPartyId=null}
 if(event==='checkpoint')return true;
 if(party){party.active=false;party.cargo=null;party.tradeTargetId=null}
 S[CORRIDORS.PILOT.castleId].garrison+=result.garrisonDelta;
 const town=S[CORRIDORS.PILOT.townId];
 ensureMarket(town).stock.grain+=result.targetGrainDelta;
 const message=corridorOutcome(mission.kind,mission.kind==='patrol'?state.corridor.lastPatrol:state.corridor.lastShipment);
 reportWorldEvent(party?.x??town.x,party?.y??town.y,message);
 if(state.escortPartyId===partyId){
  state.escortPartyId=null;state.followPartyId=null;state.path=[];state.pathIndex=0;
  if(result.event==='delivered'&&party&&dist(state.player.x,state.player.y,party.x,party.y)<=255){
   state.player.gold+=35;
   const house=localHouse(town);
   state.player.houseFavor[house.id]=Math.min(100,houseFavor(house)+4);
   log('Escort complete. Earned 35 denars and 4 '+house.name+' favor.');
   notify('Escort complete · +35 denars · +4 house favor');
  }
 }
 inspectorDirty=true;saveGame(true);
 return true;
}
function updateCorridorArrivals(){
 for(const kind of ['patrol','shipment']){
  const order=state.corridor[kind];if(!order)continue;
  const party=state.parties.find(p=>p.id===order.partyId&&p.active);
  if(!party){finishCorridor(order.partyId,kind==='patrol'?'defeated':'raided');continue}
  const {stage,destinationId}=CORRIDORS.mission(state.corridor,order.partyId),site=S[destinationId];
  if(dist(party.x,party.y,site.x,site.y)<=63){
   finishCorridor(party.id,kind==='shipment'?'delivered':stage==='outbound'?'checkpoint':'returned');
  }
 }
}
function corridorOutcome(kind,last){
 if(!last)return '';
 if(kind==='patrol')return last.event==='returned'?last.quantity+' guards returned to Valecrown'+(last.losses?' after losing '+last.losses:'')+'.':'Valecrown’s road patrol was defeated.';
 if(last.event==='raided')return 'Raiders stopped Duskford’s grain convoy. Redmarsh received no grain.';
 if(last.event==='diverted')return 'Redmarsh’s storehouse was full when the convoy arrived.';
 return 'Duskford delivered '+last.quantity+' grain to Redmarsh'+(last.losses?' and left '+last.losses+' unloaded':'')+'.';
}
function consumeFood(){
 const p=state.player,need=dailyProvisions();
 if(p.food>=need){p.food-=need;p.morale=clamp(p.morale+1,0,100)}
 else{p.food=0;p.hp=Math.max(5,p.hp-5);p.morale=clamp(p.morale-10,0,100);log('Your company ran out of food. Health and morale fell.')}
 const wage=dailyWages();
 if(p.gold>=wage){p.gold-=wage;p.morale=clamp(p.morale+1,0,100);log('Day '+state.day+': paid '+wage+' denars in troop wages.')}
 else{
  const paid=p.gold;p.gold=0;p.morale=clamp(p.morale-7-Math.ceil((wage-paid)/Math.max(1,wage)*5),0,100);
  log('Day '+state.day+': short on wages. Paid '+paid+' of '+wage+' denars; morale fell.');
  if(p.morale<18&&state.day%3===0){
   const deserter=p.roster.find(g=>g.count>g.wounded);
   if(deserter){
    deserter.training.splice(deserter.count-deserter.wounded-1,1);deserter.count--;
    p.roster=p.roster.filter(g=>g.count>0);p.morale=clamp(p.morale+4,0,100);
    log('A soldier deserted because morale collapsed.');
   }
  }
 }
 if(p.morale<25&&state.day%3===0)log('Morale is critical. Pay your troops and keep the company supplied.');
}
function stepTravel(dt){
 const p=state.player;
 const dx=(keys.has('d')||keys.has('ArrowRight')?1:0)-(keys.has('a')||keys.has('ArrowLeft')?1:0);
 const dy=(keys.has('s')||keys.has('ArrowDown')?1:0)-(keys.has('w')||keys.has('ArrowUp')?1:0);
 if(dx||dy){stopWaiting();state.path=[];state.pathIndex=0;state.targetSettlement=null;state.targetLandmark=null;state.followPartyId=null;state.escortPartyId=null;walkPlayer(dx,dy,dt);focus=state.options.follow;return}
 if(state.waiting)return;
 updateFollow(dt);
 if(state.paused)return;
 if(state.pathIndex>=state.path.length)return;
 let budget=148*W.walkingSpeed(p.x,p.y)*dt*(p.perks.includes('outrider')?1.12:1);
 let traversed=0;
 while(budget>0&&state.pathIndex<state.path.length){
  const next=state.path[state.pathIndex],d=dist(p.x,p.y,next.x,next.y);
  if(d<2){state.pathIndex++;continue}
  const delta=Math.min(d,budget),x=p.x+(next.x-p.x)/d*delta,y=p.y+(next.y-p.y)/d*delta;
  if(!W.tileAt(x,y).walk){state.path=[];state.pathIndex=0;notify('The road ahead is blocked.');break}
  p.x=x;p.y=y;traversed+=delta;budget-=delta;
  if(delta>=d-1)state.pathIndex++;else break;
 }
 if(traversed)advanceTime(traversed);
 if(state.targetSettlement!=null){
  const site=S[state.targetSettlement];
  if(dist(p.x,p.y,site.x,site.y)<=TOWN_ENTRY_RANGE){arriveSettlement(site.id);return}
 }
 if(state.targetLandmark!=null){
  const place=W.landmarks[state.targetLandmark];
  if(dist(p.x,p.y,place.x,place.y)<=LANDMARK_RANGE){arriveLandmark(place.id);return}
 }
 if(state.pathIndex>=state.path.length&&state.path.length){
  state.path=[];state.pathIndex=0;state.targetSettlement=null;state.targetLandmark=null;inspectorDirty=true;
 }
}
function arriveSettlement(id){
 state.path=[];state.pathIndex=0;state.targetSettlement=null;state.targetLandmark=null;state.followPartyId=null;state.escortPartyId=null;selected={type:'settlement',id};
 const site=S[id];log('Arrived at '+site.name+', '+F[site.faction].name+'.');
 if(state.player.quest?.id===1&&site.type==='capital'&&site.faction!==state.player.origin)completeQuest(1);
 for(const c of [...state.player.activeContracts])if(c.type==='courier'&&c.destinationId===id)completeContract(c.id);
 focus=true;inspectorDirty=true;showTown(id);refreshUI();saveGame(true);
}
function chooseCaravanTrade(p){
 const source=W.closestSettlement(p.x,p.y);
 if(!source||dist(p.x,p.y,source.x,source.y)>=135)return null;
 const sourceMarket=ensureMarket(source),candidates=[];
 for(const target of S){
  if(target.id===source.id||dist(source.x,source.y,target.x,target.y)>6200||factionsAtWar(source.faction,target.faction))continue;
  const targetMarket=ensureMarket(target);
  for(const resource of ['food',...TRADE_RESOURCES]){
   const cap=sourceMarket.capacity[resource],targetCap=targetMarket.capacity[resource];
   const specialist=source.type==='village'&&source.specialty===resource;
   const surplus=(sourceMarket.stock[resource]||0)-cap*(specialist?.5:.66);
   const smithing=resource==='iron'&&PLACE_ROLES.get(placeRoles,target.id)?.identityKey==='smithing-town';
   const shortage=targetCap*(smithing?.58:target.marketTier==='hub'?.51:.42)-(targetMarket.stock[resource]||0);
   if(surplus<(resource==='food'?1:4)||shortage<(resource==='food'?1:3))continue;
   const distance=dist(source.x,source.y,target.x,target.y);
   const score=Math.min(surplus,shortage)*2-distance/1350+(specialist&&target.marketTier==='hub'?4:0)+(smithing?4:0);
   candidates.push({source,target,resource,quantity:Math.min(resource==='grain'?10:6,Math.floor(surplus),Math.ceil(shortage)),score,distance});
  }
 }
 candidates.sort((a,b)=>b.score-a.score||a.distance-b.distance);
 const trade=candidates[0];if(!trade||trade.quantity<1)return null;
 const path=W.findPath(p.x,p.y,trade.target.x,trade.target.y);
 const end=path[path.length-1];
 if(!end||dist(end.x,end.y,trade.target.x,trade.target.y)>=135)return null;
 trade.path=path;
 trade.unitPrice=marketPrice(source,trade.resource);
 sourceMarket.stock[trade.resource]-=trade.quantity;
 return trade;
}function deliverCaravan(p){
 if(!p?.cargo||!Number.isInteger(p.tradeTargetId))return false;
 const destination=S[p.tradeTargetId];if(!destination||dist(p.x,p.y,destination.x,destination.y)>=135)return false;
 const market=ensureMarket(destination),id=p.cargo.resource;
 market.stock[id]=Math.min(market.capacity[id],market.stock[id]+p.cargo.quantity);
 if(Number.isInteger(p.cargo.from)&&S[p.cargo.from]&&S[p.cargo.from].faction!==destination.faction&&!factionsAtWar(S[p.cargo.from].faction,destination.faction)){
  const from=S[p.cargo.from].faction,to=destination.faction;
  setFactionRelation(from,to,factionRelation(from,to)+1);setFactionTension(from,to,factionTension(from,to)-2);
 }
 p.cargo=null;p.tradeTargetId=null;p.path=[];p.pathIndex=0;
 reportWorldEvent(destination.x,destination.y,'A caravan delivered supplies to '+destination.name+'.');
 return true;
}function nextPartyDestination(p){
 let dest;
 const mission=CORRIDORS.mission(state.corridor,p.id);
 if(mission){
  dest=S[mission.destinationId];
  if(mission.kind==='patrol'){
   const threat=state.parties.find(a=>a.active&&a.kind==='bandit'&&dist(p.x,p.y,a.x,a.y)<245);
   if(threat){dest=threat;p.targetPartyId=threat.id}
   else p.targetPartyId=null;
  }
  p.path=W.findPath(p.x,p.y,dest.x,dest.y);p.pathIndex=0;
  return;
 }
 if(p.kind==='bandit'){
  const camp=banditCampForParty(p.id);
  const prey=state.parties.filter(a=>a.active&&a.kind==='caravan'&&dist(p.x,p.y,a.x,a.y)<1450)
   .filter(a=>!camp||dist(camp.x,camp.y,a.x,a.y)<980)
   .sort((a,b)=>dist(p.x,p.y,a.x,a.y)-dist(p.x,p.y,b.x,b.y))[0];
  if(prey){dest=prey;p.targetPartyId=prey.id}
  else{p.targetPartyId=null;const angle=(p.id*2.399+state.day*.3)%6.28,center=camp||p;
   dest={x:clamp(center.x+Math.cos(angle)*720,270,W.WIDTH-270),y:clamp(center.y+Math.sin(angle)*680,260,W.HEIGHT-260)}}
 }else if(p.kind==='patrol'){
  const outlaws=state.parties.filter(a=>a.active&&a.kind==='bandit'&&dist(p.x,p.y,a.x,a.y)<2100)
   .sort((a,b)=>dist(p.x,p.y,a.x,a.y)-dist(p.x,p.y,b.x,b.y))[0];
  const realmEnemies=state.parties.filter(a=>a.active&&a.kind==='patrol'&&factionsAtWar(p.faction,a.faction)&&dist(p.x,p.y,a.x,a.y)<1900)
   .sort((a,b)=>dist(p.x,p.y,a.x,a.y)-dist(p.x,p.y,b.x,b.y))[0];
  const quarry=outlaws||realmEnemies;
  if(quarry){dest=quarry;p.targetPartyId=quarry.id}
  else{p.targetPartyId=null;const options=S.filter(s=>s.faction===p.faction);dest=options[(p.id*19+Math.floor(state.day*1.3)+p.strength)%options.length]}
 }else if(p.kind==='caravan'){
  p.targetPartyId=null;
  const savedDestination=S[p.tradeTargetId];
  if(savedDestination&&dist(p.x,p.y,savedDestination.x,savedDestination.y)>=135){
   const route=W.findPath(p.x,p.y,savedDestination.x,savedDestination.y);
   const end=route[route.length-1];
   if(end&&dist(end.x,end.y,savedDestination.x,savedDestination.y)<135){
    p.path=route;p.pathIndex=0;return;
   }
   const origin=S[p.cargo?.from];
   if(origin){
    const market=ensureMarket(origin),{resource,quantity}=p.cargo;
    if(market.capacity[resource])market.stock[resource]=Math.min(market.capacity[resource],market.stock[resource]+quantity);
   }
   p.cargo=null;
  }
  deliverCaravan(p);
  const trade=chooseCaravanTrade(p);
  if(trade){
   p.cargo={resource:trade.resource,quantity:trade.quantity,from:trade.source.id,unitPrice:trade.unitPrice};
   p.tradeTargetId=trade.target.id;p.path=trade.path;p.pathIndex=0;
   return;
  }
  const source=W.closestSettlement(p.x,p.y);
  const options=S.filter(s=>s.id!==source.id&&!factionsAtWar(s.faction,source.faction));
  if(dist(p.x,p.y,source.x,source.y)>=135)dest=source;
  else dest=options[(p.id*19+state.day+p.strength)%options.length];
  p.tradeTargetId=dest.id;
 }else{const options=S.filter(s=>s.faction===p.faction);dest=options[(p.id*19+Math.floor(state.day*1.3)+p.strength)%options.length];p.targetPartyId=null}
 p.path=W.findPath(p.x,p.y,dest.x,dest.y);p.pathIndex=0;
}
function resolveWorldClashes(){
 const parties=state.parties;
 let bandLost=false;
 for(const a of parties){
  if(!a.active||!['patrol','bandit'].includes(a.kind))continue;
  const target=parties.find(b=>b.id===a.targetPartyId&&b.active&&
   ((a.kind==='patrol'&&b.kind==='bandit')||(a.kind==='bandit'&&b.kind==='caravan')||
    (a.kind==='patrol'&&b.kind==='patrol'&&factionsAtWar(a.faction,b.faction))));
  if(!target||dist(a.x,a.y,target.x,target.y)>64)continue;
  if(a.kind==='patrol'&&target.kind==='patrol'){
   const war=state.diplomacy.wars.find(w=>w.a===Math.min(a.faction,target.faction)&&w.b===Math.max(a.faction,target.faction));
   const winner=a.strength>=target.strength? a:target,loser=winner===a?target:a;
   winner.strength=Math.max(5,winner.strength-Math.max(2,Math.ceil(loser.strength*.22)));loser.active=false;
   if(war)war.score=(war.score||0)+(winner.faction===war.attacker?1:-1);
   reportWorldEvent(a.x,a.y,F[winner.faction].name+' won a clash with '+F[loser.faction].name+' near '+W.closestSettlement(a.x,a.y).name+'.');
  }else{
   const patrol=a.kind==='patrol'?a:target,raider=a.kind==='bandit'?a:target;
   if(patrol.kind==='patrol'&&raider.kind==='bandit'){
    const patrolWins=patrol.strength>=raider.strength*.78;
    if(patrolWins){patrol.strength=Math.max(5,patrol.strength-Math.max(1,Math.ceil(raider.strength*.14)));raider.active=false;bandLost=true;
     reportWorldEvent(patrol.x,patrol.y,(F[patrol.faction]?.name||'A patrol')+' patrol scattered an outlaw band on the roads.')}
    else{raider.strength=Math.max(3,raider.strength-Math.ceil(patrol.strength*.16));patrol.active=false;
     reportWorldEvent(patrol.x,patrol.y,'Outlaws overwhelmed a patrol near '+W.closestSettlement(patrol.x,patrol.y).name+'.')}
   }else if(raider.kind==='bandit'&&target.kind==='caravan'){
    const shipment=CORRIDORS.mission(state.corridor,target.id);
    const patrol=shipment&&state.parties.find(p=>p.active&&p.id===state.corridor.patrol?.partyId&&dist(p.x,p.y,target.x,target.y)<430);
    const raidersWin=raider.strength>=target.strength*.48+(patrol?.strength||0)*.48;
    if(raidersWin){raider.strength=Math.min(28,raider.strength+Math.ceil(target.strength*.12));target.active=false;
     const cargo=target.cargo;
     target.cargo=null;target.tradeTargetId=null;
     reportWorldEvent(target.x,target.y,'Bandits raided a '+F[target.faction].name+' caravan'+
      (cargo?' and stole '+cargo.quantity+' '+ITEMS[cargo.resource].name.toLowerCase():'')+'.')}
    else{target.strength=Math.max(4,target.strength-Math.ceil(raider.strength*.12));raider.active=false;bandLost=true;
     reportWorldEvent(target.x,target.y,'A caravan guard detail repelled bandits on the road.')}
   }
  }
  a.path=[];target.path=[];a.targetPartyId=null;target.targetPartyId=null;
 }
 if(bandLost&&closeUnavailableBounties())saveGame(true);
}
function resolveNobleClashes(){
 const now=campaignHours();
 if(now<(state.nextNobleClashCheck||0))return;
 state.nextNobleClashCheck=now+.2;
 const bandits=state.parties.filter(p=>p.active&&p.kind==='bandit');
 let changed=false;
 for(const noble of state.nobles){
  const party=noble.party;
  if(!party.active||noble.recovering||noble.dependents?.length||!['patrol','inspection'].includes(noble.circuit.purpose))continue;
  const enemy=bandits.find(p=>p.active&&dist(p.x,p.y,party.x,party.y)<57);
  if(!enemy)continue;
  const wins=party.strength>=enemy.strength;
  const remaining=party.strength-Math.ceil(enemy.strength*(wins?.14:.36));
  state.nobleHouses=NOBLE_HOUSES.setStrength(state.nobleHouses,noble.personId,remaining);
  party.strength=NOBLE_HOUSES.strength(state.nobleHouses,noble.personId);
  if(wins)enemy.active=false;
  else NOBLES.sendHome(W,noble,now);
  reportWorldEvent(enemy.x,enemy.y,partyName(party)+(wins?' drove off outlaws near ':' retreated after meeting outlaws near ')+W.closestSettlement(enemy.x,enemy.y).name+'.');
  changed=true;
 }
 if(changed){closeUnavailableBounties();inspectorDirty=true;saveGame(true)}
}
function stepParties(dt){
 const parties=state.parties;
 const count=parties.length;
 if(!count)return;
 const activeById=new Map(parties.filter(p=>p.active&&p.kind!=='noble').map(p=>[p.id,p]));
 for(const p of activeById.values()){
  const movingTarget=activeById.get(p.targetPartyId);
  if(movingTarget&&p.path.length){
   const endpoint=p.path[p.path.length-1];
   if(dist(endpoint.x,endpoint.y,movingTarget.x,movingTarget.y)>310){p.path=[];p.pathIndex=0}
  }
 }

 // Limit route searches per frame, then continue from the next party.
 // An unreachable destination still costs a turn, so it cannot block others.
 let cursor=(state.partyRouteCursor??0)%count;
 let routesRequested=0;
 for(let checked=0;checked<count&&routesRequested<3;checked++){
  const party=parties[cursor];
  cursor=(cursor+1)%count;
  if(!activeById.has(party.id)||party.pathIndex<party.path.length)continue;
  nextPartyDestination(party);
  routesRequested++;
 }
 state.partyRouteCursor=cursor;

 for(const p of parties){
  if(!activeById.has(p.id)||p.pathIndex>=p.path.length)continue;
  let budget=(p.kind==='patrol'?78:p.kind==='caravan'?61:53)*dt;
  while(budget>0&&p.pathIndex<p.path.length){
   const n=p.path[p.pathIndex],d=dist(p.x,p.y,n.x,n.y);
   if(d<2){p.pathIndex++;continue}
   const step=Math.min(d,budget);p.x+=(n.x-p.x)/d*step;p.y+=(n.y-p.y)/d*step;budget-=step;
   if(step>=d-1)p.pathIndex++;else break;
  }
  if(p.kind==='caravan'&&!CORRIDORS.mission(state.corridor,p.id))deliverCaravan(p);
 }
 updateCorridorArrivals();
 if(NOBLES.step(W,state.nobles,campaignHours(),dt,{scoreStop:nobleStopScore,onArrival:nobleArrival}))inspectorDirty=true;
 const convoy=state.parties.find(p=>p.id===state.escortPartyId&&p.active);
 if(convoy&&!menuOpen&&(state.day+state.hour/24)-state.lastEncounter>.018){
  const threat=parties.find(p=>p.active&&p.kind==='bandit'&&p.targetPartyId===convoy.id&&
   dist(p.x,p.y,convoy.x,convoy.y)<265&&dist(p.x,p.y,state.player.x,state.player.y)<155);
  if(threat){openEncounter(threat);return}
 }
 resolveWorldClashes();
 resolveNobleClashes();
 updateCorridorArrivals();
 refreshBanditCamps(false);
 const close=parties.find(p=>p.active&&p.kind==='bandit'&&
  dist(state.player.x,state.player.y,p.x,p.y)<92);
 if(close&&(state.day+state.hour/24)-state.lastEncounter>.08&&!menuOpen){
  state.path=[];state.pathIndex=0;openEncounter(close);
 }
}
function questText(){
 const q=state.player.quest||{id:3};
 if(q.id===0)return'Recruit '+q.goal+' volunteers from any settlement ('+q.progress+'/'+q.goal+').';
 if(q.id===1)return'Visit the capital of another faction and learn about the wider world.';
 if(q.id===2)return'Defeat a bandit party on the roads. Your soldiers need a first victory.';
 return'Travel freely. Build your party, visit capitals, and explore all ten factions.';
}
function completeQuest(id){
 const p=state.player,q=p.quest;if(!q||q.id!==id)return;
 const rewards=[150,225,360],exp=[65,95,190];p.gold+=rewards[id];grantXP(exp[id]);p.renown+=id+1;
 q.id=id+1;q.progress=0;q.goal=3;
 log('Quest completed! Earned '+rewards[id]+' denars and '+exp[id]+' experience.');
 notify('Quest complete · +'+rewards[id]+' denars · +'+exp[id]+' XP');inspectorDirty=true;
}
function innTreatmentPreview(){
 const p=state.player,wounded=p.roster.reduce((sum,g)=>sum+g.wounded,0);
 return {wounded,treated:Math.min(3,wounded),heroHeal:Math.min(100-p.hp,32+(p.perks.includes('fieldMedic')?16:0)),price:20,wages:dailyWages(),provisions:dailyProvisions()};
}
function fieldRestPreview(){
 const p=state.player,provisions=2,hours=6,heroHeal=Math.min(100-p.hp,15+(p.perks.includes('fieldMedic')?16:0));
 const reason=!heroHeal?'Hero already at full health':
  p.fieldRestDay===state.day?'Camp again tomorrow':p.food<provisions?'Needs '+provisions+' provisions':'';
 return {provisions,hours,heroHeal,reason};
}
function fieldRest(){
 const preview=fieldRestPreview();
 if(preview.reason){notify(preview.reason);return false}
 const p=state.player;
 stopWaiting();
 p.food-=preview.provisions;p.hp+=preview.heroHeal;
 advanceCampaignHours(preview.hours);p.fieldRestDay=state.day;
 log('Camped in the field and recovered '+preview.heroHeal+' hero health.');
 notify('Camped for '+preview.hours+' hours · +'+preview.heroHeal+' hero health.');
 refreshUI();saveGame(true);return true;
}
function performSettlementAction(action,id,quantity=1){
 const site=S[id],p=state.player;
 if(!site)return;
 if(dist(p.x,p.y,site.x,site.y)>TOWN_ENTRY_RANGE){notify('Travel closer to enter '+site.name+'.');return}
 if(action==='recruit'){
  const terms=recruitmentTerms(site),number=Number(quantity);
  if(!terms.access){notify('The local authorities will not enlist you while your standing is outlawed.');return}
  if(!Number.isInteger(number)||number<1||number>terms.max){
   notify(!terms.available?(rosterCount()>=MAXPARTY?'Your party is full.':'More volunteers arrive tomorrow.'):'Choose an available quantity you can afford.');return;
  }
  const used=p.recruitment[id];
  p.recruitment[id]={day:state.day,count:(used?.day===state.day?used.count:0)+number};
  p.gold-=number*terms.unit;
  const group=addHealthyTroops(site.faction,0,undefined,number);
  log('Recruited '+number+' '+troopName(group)+' at '+site.name+'.');
  if(p.quest?.id===0){p.quest.progress+=number;if(p.quest.progress>=p.quest.goal)completeQuest(0)}
  notify(number+' volunteers joined your party.');
 }else if(action==='food'){
  const offer=townMarket(site.id).find(item=>item.id==='food');if(!offer||offer.stock<1){notify('This settlement has no provisions for sale.');return}
  if(p.gold<offer.price){notify('Not enough denars for provisions.');return}
  p.gold-=offer.price;state.marketStocks[site.id].stock.food--;p.food+=8;log('Bought eight provisions in '+site.name+' for '+offer.price+' denars.');notify('Purchased eight provisions.');
 }else if(action==='rest'){
  const recovery=innTreatmentPreview();
  if(p.gold<recovery.price){notify('An inn costs '+recovery.price+' denars.');return}
  p.gold-=recovery.price;p.hp+=recovery.heroHeal;
  p.morale=clamp(p.morale+3+(p.perks.includes('fieldMedic')?5:0),0,100);state.hour=8;advanceDay();
  let remaining=recovery.treated;
  for(const group of p.roster){
   const treated=Math.min(remaining,group.wounded);
   group.wounded-=treated;remaining-=treated;
   if(!remaining)break;
  }
  log('Rested at '+site.name+' and treated '+recovery.treated+' wounded troops.');
  notify('Rested until morning · '+recovery.treated+' troops recovered.');
 }else if(action==='granary'){buildGranary(id);return;
 }else if(action==='retainers'){
  if(!recruitRetainers(site))return;
 }else if(action==='rumors'){
  const report=townRumor(site);$('townNewsText').textContent=report;
  log('Rumor in '+site.name+': '+report);
  notify('Fresh rumors heard in '+site.name+'.');
 }else if(action==='visit'){
  arriveSettlement(id);return;
 }
 if(action!=='rumors'&&!$('screenTown').classList.contains('hidden'))showTown(id);
 inspectorDirty=true;
 refreshUI();saveGame(true);
}
function familyMemberMarkup(person,mode){
 const portrait=CHAR_UI?.portraitMarkup?.({...person.appearance,age:person.age},person.name+' portrait')||'';
 const noble=nobleForPerson(person.id);
 const parents=person.generation===1?person.parentIds.map(id=>state.people.get(id)?.name).filter(Boolean):[];
 const activity=noble?nobleActivity(noble):'At '+S[person.homeId].name;
 const detail=person.age>=18&&noble?noble.party.strength+' in retinue':noble?'With '+partyName(noble.party):null;
 const button=mode==='find'?'<button class="btn small house-family-find" type="button" data-family-find="'+esc(person.id)+
  '" aria-label="Find '+esc(person.name)+' on map">Find</button>':
  mode==='talk'?'<button class="btn small house-family-find" type="button" data-town-noble-act="speak" data-noble-person="'+esc(person.id)+
  '" aria-label="Speak to '+esc(person.name)+'">Speak</button>':'';
 return '<li class="house-family-member"><span class="house-family-portrait">'+portrait+'</span>'+
  '<div class="house-family-meta"><b>'+esc(person.name)+'</b><small>'+esc(nobleRole(person))+' · Age '+person.age+'</small>'+
  (parents.length?'<small>Parents · '+esc(parents.join(' and '))+'</small>':'')+
  '<small class="house-family-activity">'+esc(activity+(detail?' · '+detail:''))+'</small></div>'+button+'</li>';
}
function familyTreeMarkup(people,mode){
 const generations=[[-1,'Elders'],[0,'House head and siblings'],[1,'Children and cousins']];
 return '<div class="house-family-tree">'+generations.map(([generation,label])=>{
  const members=people.filter(person=>person.generation===generation);
  return members.length?'<section class="house-family-generation"><h4 class="house-family-generation-label">'+label+'</h4>'+
   '<ul class="house-family-members">'+members.map(person=>familyMemberMarkup(person,mode)).join('')+'</ul></section>':'';
 }).join('')+'</div>';
}
function personSite(person){
 const noble=nobleForPerson(person.id);
 return noble?noble.siteId:person.homeId;
}
function personDialogue(person,site,roads=false){
 const noble=nobleForPerson(person.id),house=HOUSES[person.houseId];
 let line;
 if(roads&&person.age>=18)line=nobleRoadReport(site);
 else if(person.age<18)line='I’m with '+(noble?partyName(noble.party):house.name)+'.';
 else if(person.role==='partner')line=noble?.cargo?'I’m bringing '+noble.cargo.quantity+' '+noble.cargo.resource+' back to '+S[person.homeId].name+'.':
  'I see to supplies from our holdings. Our goods travel back to '+S[person.homeId].name+'.';
 else if(person.role==='head')line=nobleGreeting(house.id);
 else line='My retinue numbers '+(noble?.party.strength||1)+'. '+nobleActivity(noble)+'.';
 return person.name+' says, “'+line+'”';
}
function renderTownPeople(site){
 const seated=seatHouse(site.id);
 const people=[...state.people.values()].filter(person=>personSite(person)===site.id);
 const presentHouseIds=new Set(people.map(person=>person.houseId));
 if(seated)presentHouseIds.add(seated.id);
 $('townPeople').hidden=!presentHouseIds.size;
 $('townPeopleHeading').textContent='People here';
 $('townPeopleDialogue').textContent='';
 $('townPeopleList').innerHTML=[...presentHouseIds].map(id=>{
  const house=HOUSES[id],noble=nobleByHouse(id),present=(noble?noble.siteId:house.seatId)===site.id;
  const lastSeen=S[noble?.lastSeenSiteId],offer=present?retainerOffer(site,house):null;
  const head=houseHead(id),activity=noble?nobleActivity(noble):'At '+site.name;
  const residents=people.filter(person=>person.houseId===id&&person.role!=='head');
  const button=(action,label)=>'<button type="button" class="btn" data-town-noble-act="'+action+
   '" data-noble-person="'+esc(head.id)+'">'+esc(label)+'</button>';
  const actions=present?button('speak','Speak')+button('roads','Ask about roads')+
   (offer.reason?'':button('retainers','Hire '+offer.count+' · '+offer.count*offer.cost+' denars')):'';
  const detail=present?(offer.reason||'Retainers available'):lastSeen?'Last seen at '+lastSeen.name:'Awaiting word';
  const portrait=head?(CHAR_UI?.portraitMarkup?.({...head.appearance,age:head.age},head.name+' portrait')||''):'';
  return '<article class="town-person"><div class="town-person-profile"><span class="town-person-portrait">'+portrait+
   '</span><div class="town-person-meta"><b>'+esc(houseLeader(house))+'</b><small>'+esc(house.name)+
   (head?' · Age '+head.age:'')+'</small><small class="town-person-status">'+esc(activity)+' · '+houseFavor(house)+'/16 favor</small>'+
   '<small>'+esc(detail)+'</small></div></div>'+(actions?'<div class="town-person-actions">'+actions+'</div>':'')+
   (residents.length?'<details class="house-family"><summary>Family here · '+residents.length+'</summary>'+
    familyTreeMarkup(residents,'talk')+'</details>':'')+'</article>';
 }).join('');
}
function townNobleAction(action,personId){
 const person=state?.people?.get(personId),site=S[state?.currentTownId],p=state?.player;
 if(!site||!p||!person||personSite(person)!==site.id||$('screenTown').classList.contains('hidden')||
    dist(p.x,p.y,site.x,site.y)>TOWN_ENTRY_RANGE)return;
 if(action==='retainers'&&person.role==='head'){
  if(recruitRetainers(site,HOUSES[person.houseId])){showTown(site.id);refreshUI();saveGame(true)}
  return;
 }
 if(action==='speak'||action==='roads'){
  const dialogue=$('townPeopleDialogue');
  dialogue.textContent=personDialogue(person,site,action==='roads');
  dialogue.scrollIntoView?.({block:'nearest'});
 }
}
function renderPrisoners(site=null){
 const section=$(site?'townPrisoners':'partyPrisoners'),list=$(site?'townPrisonerList':'partyPrisonerList');
 const prisoners=state.player.prisoners,count=PRISONERS.count(prisoners);
 section.hidden=!!site&&(site.type==='village'||!count);
 const summary='<p class="town-service-note"><b>'+count+' / '+PRISONERS.CAPACITY+'</b> prisoners</p>';
 if(!count){list.innerHTML=summary+'<p class="subtle">Surrendering enemies can be taken prisoner after a victory.</p>';return}
 const roles={infantry:'Infantry',archer:'Archer',cavalry:'Cavalry',horseArcher:'Horse archer'};
 const ranks=['Recruit','Trained','Veteran'];
 list.innerHTML=summary+prisoners.groups.map(group=>{
  const title=group.kind==='outlaw'?'Outlaws':F[group.faction].name+' soldiers';
  const descriptors=[ranks[group.tier],roles[group.role]].filter(Boolean).join(' · ');
  const action=site?(group.kind==='outlaw'?'handoff':'ransom'):'release';
  const choices=site||group.count===1?[group.count]:[1,group.count];
  const locality=site||W.closestSettlement(state.player.x,state.player.y);
  const buttons=choices.map(quantity=>{
   const quote=PRISONERS.quote(prisoners,action,group.id,quantity,locality);
   if(!quote.ok)return '<small class="subtle">'+esc(quote.reason)+'</small>';
   const standing=quote.standing?(quote.standing>0?'+':'')+quote.standing+' standing':'';
   const label=action==='release'?'Release '+quantity+(standing?' · '+standing:''):action==='ransom'?'Ransom · '+quote.gold+' denars':'Hand over · '+quote.gold+' denars';
   return '<button class="btn small secondary" type="button" data-captive-action="'+action+'" data-captive-id="'+esc(group.id)+'" data-captive-quantity="'+quantity+'" data-captive-count="'+quote.expectedCount+'">'+label+'</button>';
  }).join('');
  return '<article class="captive-row"><span class="captive-meta"><b>'+group.count+' × '+esc(title)+'</b>'+
   '<small>'+esc(descriptors)+'</small></span><span class="captive-actions">'+buttons+'</span></article>';
 }).join('')+(site?'':'<p class="subtle">Ransom soldiers in a town, or take outlaws to a garrison.</p>');
}
function handlePrisonerClick(event,atTown){
 const button=event.target.closest('[data-captive-action]');
 if(!button)return false;
 const p=state?.player,site=atTown?S[state?.currentTownId]:null;
 if(!p||button.disabled||(atTown?!site||!smithyIsOpen(site.id):$('screenParty').classList.contains('hidden')))return true;
 const action=button.dataset.captiveAction;
 if(atTown?(action!=='ransom'&&action!=='handoff'):action!=='release')return true;
 const quote=PRISONERS.apply(p.prisoners,action,button.dataset.captiveId,Number(button.dataset.captiveQuantity),
  site||W.closestSettlement(p.x,p.y),Number(button.dataset.captiveCount));
 if(!quote.ok){notify(quote.reason);renderPrisoners(site);return true}
 const previous={prisoners:p.prisoners,gold:p.gold,reputation:p.reputation.slice()};
 p.prisoners=quote.state;p.gold+=quote.gold;
 if(quote.standing)changeStanding(quote.standingFaction,quote.standing);
 if(!saveGame(true)){Object.assign(p,previous);notify('Could not save the prisoner decision.');return true}
 const result=action==='release'?'Released ':action==='ransom'?'Ransomed ':'Handed over ';
 const message=result+quote.quantity+(quote.quantity===1?' prisoner':' prisoners')+
  (quote.gold?' · +'+quote.gold+' denars':'')+(quote.standing?' · '+(quote.standing>0?'+':'')+quote.standing+' standing':'')+'.';
 log(message);notify(message);refreshUI();renderPrisoners(site);
 $(site?'townPrisonerNotice':'partyPrisonerNotice').textContent=message;
 return true;
}
function settlementRoleText(site){
 const role=PLACE_ROLES.get(placeRoles,site.id);
 if(site.type==='village'){
  const destination=site.id===CORRIDORS.PILOT.villageId?S[CORRIDORS.PILOT.townId].name:role.villageSupply.nearestMarketName;
  return role.villageSupply.resourceLabel+' for '+destination+' · '+localHouse(site).name;
 }
 if(site.type==='castle'){
  const neighbors=W.roadLinks.filter(link=>link.includes(site.id)).map(link=>S[link.find(id=>id!==site.id)]);
  const next=site.id===CORRIDORS.PILOT.castleId?S[CORRIDORS.PILOT.townId]:neighbors[0];
  return site.garrison+' defending'+(next?' · Road to '+next.name:'');
 }
 if(site.type==='capital')return localHouse(site).name+' · '+(site.marketTier==='hub'?'Major market':'Seat of the court');
 return role.tradeLabel+' · '+(site.marketTier==='hub'?'Major market':'Regional market');
}
function renderGreatHall(site){
 const house=seatHouse(site.id),noble=nobleByHouse(house?.id),estate=state.nobleHouses.houses.find(h=>h.houseId===house?.id);
 if(!house||!estate)return;
 $('townPeopleHeading').textContent='Great Hall';
 const area=estate.holdings.filter(id=>id!==site.id).map(id=>S[id].name);
 const market=ensureMarket(site);
 const lowest=TRADE_RESOURCES.reduce((a,b)=>market.stock[a]/market.capacity[a]<=market.stock[b]/market.capacity[b]?a:b);
 const problem=market.stock[lowest]<market.capacity[lowest]*.25?
  'The market is low on '+ITEMS[lowest].name.toLowerCase()+' · '+market.stock[lowest]+' in store.':
  'Stores are steady. The steward draws supplies from the house’s villages.';
 $('townPeopleList').insertAdjacentHTML('afterbegin','<article class="town-person"><b>'+esc(house.name)+'</b><p>'+
  esc(noble?nobleActivity(noble):'Court in session')+'</p><small>'+
  esc(area.length?'Holdings · '+area.join(', '):'The seat holds the capital city.')+'</small><p>'+esc(problem)+'</p></article>');
}
function renderCorridor(site){
 const pane=$('townCorridor'),{castleId,townId,villageId}=CORRIDORS.PILOT;
 if(![castleId,townId,villageId].includes(site.id)){pane.hidden=true;pane.innerHTML='';return}
 pane.hidden=false;
 const data=state.corridor,patrol=state.parties.find(p=>p.id===data.patrol?.partyId&&p.active);
 const convoy=state.parties.find(p=>p.id===data.shipment?.partyId&&p.active),stock=ensureMarket(S[townId]).stock.grain;
 const context=corridorContext(),patrolOffer=CORRIDORS.quote(data,'patrol',context),grainOffer=CORRIDORS.quote(data,'shipment',context);
 const patrolLine=patrol?patrol.strength+' guards '+(data.patrol.stage==='return'?'returning to Valecrown.':'on the road to Redmarsh.'):
  corridorOutcome('patrol',data.lastPatrol)||patrolOffer.reason||'Patrol available.';
 const grainLine=convoy?data.shipment.quantity+' grain on the road from Duskford.':
  corridorOutcome('shipment',data.lastShipment)||grainOffer.reason||'Convoy available.';
 const actions=site.id===castleId?(patrol?[{act:'followCorridor',id:patrol.id,label:'Follow the patrol'}]:
  [{act:'dispatchPatrol',label:patrolOffer.ok?'Dispatch '+patrolOffer.quantity+' guards':patrolOffer.reason,disabled:!patrolOffer.ok}]):
  convoy?[{act:'escortConvoy',id:convoy.id,label:'Escort the convoy',primary:true}]:
  site.id===villageId?[{act:'dispatchConvoy',label:grainOffer.ok?'Dispatch '+grainOffer.quantity+' grain':grainOffer.reason,disabled:!grainOffer.ok}]:[];
 pane.innerHTML='<div><b>Valecrown supply road</b><small>Duskford → Redmarsh · '+stock+' grain in Redmarsh'+(stock<12?' · Stock low':'')+
  '</small><small>'+esc(patrolLine)+'</small><small>'+esc(grainLine)+'</small></div><div class="town-corridor-actions">'+renderActions(actions)+'</div>';
}
function showTown(id){
 const site=S[id];if(!site)return;const f=F[site.faction];
 const alreadyInside=state.currentTownId===id&&!$('screenTown').classList.contains('hidden');
 const content=$('screenTown').querySelector('.town-content');
 const activePanel=content?.querySelector('[data-town-panel]:not([hidden])');
 const shop=$('townShop'),contracts=$('townContracts');
 const scrollPositions=alreadyInside?[activePanel,shop,contracts].map(element=>[element,element?.scrollTop||0]):[];
 state.currentTownId=id;
 renderTownPeople(site);
 const hasSmithy=!!smithyUI&&smithyAvailable(id);
 $('townTabSmithy').hidden=!hasSmithy;
 const marketLabel=site.marketTier==='hub'?'Major market':site.marketTier==='regional'?'Regional market':site.type==='castle'?'Castle':'Village';
 const siteLabel=site.type==='capital'?'Capital · '+marketLabel:marketLabel;
 const house=localHouse(site),specialty=ITEMS[site.specialty]?.name;
 const role=PLACE_ROLES.get(placeRoles,site.id);
 $('screenTown').dataset.settlementType=site.type;
 $('townIdentity').innerHTML='<b>'+esc(role.title)+'</b><small>'+esc(settlementRoleText(site))+'</small>';
 if(site.type==='capital')renderGreatHall(site);
 renderCorridor(site);
 $('townName').textContent=site.name;$('townFaction').textContent=siteLabel.toUpperCase()+' · '+f.name;
 const standing=Number(state.player.reputation[site.faction])||0;
 $('townDescription').textContent=house.name+' · '+(specialty?specialty+' production · ':'')+Math.round(site.prosperity)+' prosperity · '+standingLabel(standing)+' standing';
 const destinations=[
  {view:'market',icon:'🛒',name:'Visit the market',detail:workshopSite(site)?'Trade goods or manage a workshop.':'Trade for food, arms, and armor.'},
  {view:'inn',icon:'🍺',name:'Find the inn',detail:'Rest, heal, and recover the company.'},
  {view:'garrison',icon:'🛡',name:'Visit the garrison',detail:site.type!=='village'&&PRISONERS.count(state.player.prisoners)?'Recruit soldiers or handle prisoners.':'Recruit volunteers for your party.'},
  {view:'contracts',icon:'📜',name:'Read the contract board',detail:'Find work and earn coin and renown.'},
  {view:'news',icon:'🗞',name:'Ask around',detail:'Hear what travelers say about the roads.'}
 ];
 if(hasSmithy)destinations.splice(1,0,{view:'smithy',icon:'⚒',name:'Visit the smithy',detail:'Forge weapons, sell or salvage gear.'});
 const lead=site.type==='capital'?[{section:'townPeople',icon:'⚑',name:'Great Hall',detail:'Meet the ruling household.'},destinations[0]]:
  site.type==='castle'?[destinations.find(d=>d.view==='garrison'),{section:site.id===CORRIDORS.PILOT.castleId?'townCorridor':'townPeople',
   icon:'⚑',name:site.id===CORRIDORS.PILOT.castleId?'Check the supply road':'Meet the household',
   detail:site.id===CORRIDORS.PILOT.castleId?'Check the patrol and grain convoy.':"See where the house's people are."}]:
  site.type==='village'?[{view:'market',icon:'🛒',name:'Buy local '+role.villageSupply.resource,detail:'Open the village market.'},
   site.id===CORRIDORS.PILOT.villageId?{section:'townCorridor',icon:'➤',name:'Check grain convoy',detail:'See what is on the road.'}:destinations.find(d=>d.view==='garrison')]:
  [destinations[0],destinations.find(d=>d.view===(role.identityKey==='smithing-town'&&hasSmithy?'smithy':'inn'))];
 const serviceCard=d=>'<button class="town-activity-card" type="button" '+(d.section?'data-town-section="'+d.section:'data-town-view="'+d.view)+
  '" aria-label="'+esc(d.name+'. '+d.detail)+'"><span class="town-activity-icon" aria-hidden="true">'+d.icon+'</span><span><b>'+esc(d.name)+
  '</b><small>'+esc(d.detail)+'</small></span><span class="town-activity-arrow" aria-hidden="true">›</span></button>';
 $('townPriority').innerHTML=lead.map(serviceCard).join('');
 $('townServices').innerHTML=destinations.filter(d=>!lead.includes(d)).map(serviceCard).join('');
 const terms=recruitmentTerms(site),rest=innTreatmentPreview();
 $('townInnSummary').innerHTML=
  '<div class="town-service-stat"><b>'+state.player.hp+' → '+(state.player.hp+rest.heroHeal)+' / 100</b><small>Hero health before upkeep</small></div>'+
  '<div class="town-service-stat"><b>'+rest.treated+' of '+rest.wounded+'</b><small>Wounded ready by morning</small></div>'+
  '<div class="town-service-stat"><b>'+rest.price+' denars</b><small>Room and treatment</small></div>'+
  '<p class="town-service-note">Rest until morning. Daily upkeep is '+rest.wages+' denars and '+rest.provisions+' provisions.</p>';
 const granaryBuilt=!!state.settlementProjects[id]?.granary;
 $('townGarrisonSummary').innerHTML='<div class="town-service-stat"><b>'+site.garrison.toLocaleString()+'</b><small>Garrisoned defenders</small></div><div class="town-service-stat"><b>'+terms.available+'</b><small>Volunteers available</small></div><div class="town-service-stat"><b>'+rosterCount()+' / '+MAXPARTY+'</b><small>Company capacity</small></div>';
 const canRest=state.player.gold>=rest.price;
 $('townInnAction').innerHTML=renderActions([{act:'rest',id,primary:true,label:canRest?'Rest until morning · '+rest.price+' denars':'Rest requires '+rest.price+' denars',disabled:!canRest}]);
 const retainer=retainerOffer(site);
 const actions=[{act:'granary',id,label:granaryBuilt?'Granary built · +40 grain capacity':'+ Build a granary · 8 timber, 3 iron, 4 tools, 180 denars',disabled:granaryBuilt}];
 if(retainer){
  $('townGarrisonSummary').insertAdjacentHTML('beforeend','<p class="town-service-note"><b>'+esc(house.name)+'</b> · '+esc(houseLeader(house))+' · '+houseFavor(house)+' favor</p>');
  const wages=dailyWages(retainer.count*TROOP_WAGES[1])-dailyWages();
  actions.push({act:'retainers',id,disabled:!!retainer.reason,label:retainer.reason?'Trained retainers · '+retainer.reason:'Recruit '+retainer.count+' × '+retainer.name+' · '+retainer.count*retainer.cost+' denars · +'+wages+'/day'});
 }
 $('townGarrisonAction').innerHTML=renderQuantityAction('recruit',id)+renderActions(actions);
 $('townPrisonerNotice').textContent='';renderPrisoners(site);
 $('townNewsText').textContent=townRumor(site);
 $('townNewsAction').innerHTML=renderActions([{act:'rumors',id,primary:true,label:'Ask for fresh news'}]);
 const market=townMarket(id);
 $('townShop').innerHTML=market.map(item=>{
  const it=ITEMS[item.id],owned=item.id==='food'?state.player.food:state.player.inventory[item.id]||0;
  const resource=!!it.resource,quantity=resource?5:1,total=item.price*quantity;
  const stockLabel=resource?item.stock+' / '+item.capacity+' in stock':item.stock+' in stock';
  const buyDisabled=resource?item.stock<quantity||state.player.gold<total:item.stock<1||state.player.gold<item.price;
  const buyLabel=resource?'Buy 5 · '+total:item.id==='food'?'Buy provisions · '+item.price:'Buy · '+item.price;
  const sell=resource?'<button class="btn small secondary" data-sell-resource="'+item.id+'" '+(owned<1||item.stock>=item.capacity?'disabled':'')+'>Sell up to 5</button>':item.id==='food'?'<button class="btn small secondary" data-sell-food '+(owned<8||item.stock>=item.capacity?'disabled':'')+'>Sell 8 · '+marketSalePrice(site,'food')+'</button>':'';
  const itemDetail=it.slot?ITEM_SLOT_LABELS[it.slot]+' · '+owned+' owned':owned+(resource?' units owned':' owned');
  const favored=PLACE_ROLES.marketFactor(placeRoles,id,item.id,'sale')>1;
  return '<article class="shop-item'+(resource?' resource-item':'')+'"><span class="shop-icon">'+it.icon+'</span><span><b>'+esc(it.name)+'</b><small>'+esc(itemDetail)+' · '+stockLabel+(site.specialty===item.id?' · local specialty':favored?' · local demand':'')+'</small></span><span class="shop-actions"><button class="btn small" data-buy-item="'+item.id+'" '+(buyDisabled?'disabled':'')+'>'+buyLabel+'</button>'+sell+'</span></article>'
 }).join('');
 $('townWorkshopNotice').textContent='';renderWorkshop(site);
 $('townContracts').innerHTML=renderTownContracts(id);
 if(alreadyInside){for(const [element,position] of scrollPositions){if(element)element.scrollTop=position}}
 else{
  setTownView('overview');
  for(const panel of content?.querySelectorAll('[data-town-panel]')||[])panel.scrollTop=0;
  shop.scrollTop=0;contracts.scrollTop=0;
  openModal('screenTown');notify('Entered '+site.name+'.');
 }
}
function marketGoods(site){
 const kind=W.tileAt(site.x,site.y).kind;
 const basic=['food','sword','spear','paddedArmor','roundShield','quiver','rockPouch','arrows','stones'];
 const military=['food','sword','axe','spear','bow','paddedArmor','leatherArmor','mailArmor','plateArmor','roundShield','kiteShield','quiver','rockPouch','arrows','stones'];
 let available=site.type==='village'?basic:site.type==='castle'?military:SHOP_ITEMS.filter(id=>!TRADE_RESOURCES.includes(id));
 if(site.type==='village'&&['snow','tundra'].includes(kind))available=available.filter(id=>!['rockPouch','bow'].includes(id));
 const resources=site.specialty?[site.specialty,...TRADE_RESOURCES.filter(id=>id!==site.specialty)]:TRADE_RESOURCES;
 return ['food',...resources,...available.filter(id=>id!=='food')];
}
function marketPrice(site,itemId){
 const item=ITEMS[itemId],tile=W.tileAt(site.x,site.y),market=state.marketStocks?.[site.id];
 const typeFactor=site.type==='capital'?.88:site.type==='town'?.95:site.type==='castle'?.98:1.12;
 const prosperity=clamp(1.16-(site.prosperity||50)/260,.78,1.12);
 const climate=itemId==='food'&&['desert','scrub'].includes(tile.kind)?1.42:
   itemId==='food'&&['forest','grass','marsh'].includes(tile.kind)?.86:1;
 const standing=clamp(1-(state.player.reputation[site.faction]||0)*.001,.82,1.25);
 const trader=state.player.perks.includes('trader')?.90:1;
 const stock=market?.stock?.[itemId]||0,capacity=market?.capacity?.[itemId]||defaultMarketCapacity(itemId,site);
 const supply=clamp(1.55-(stock/Math.max(1,capacity))*.92,.68,1.65);
 const adjusted=Math.round(item.price*typeFactor*prosperity*climate*standing*trader*(item.resource||itemId==='food'?supply:1)*
  PLACE_ROLES.marketFactor(placeRoles,site.id,itemId));
 return clamp(adjusted,Math.max(1,Math.round(item.price*.65)),Math.max(1,Math.round(item.price*2)));
}
function marketSalePrice(site,itemId){
 return Math.max(1,Math.floor(marketPrice(site,itemId)*.68*PLACE_ROLES.marketFactor(placeRoles,site.id,itemId,'sale')));
}
function townMarket(id){
 const site=S[id];if(!site)return[];const market=ensureMarket(site);
 return marketGoods(site).map(itemId=>({id:itemId,stock:market.stock[itemId]||0,capacity:market.capacity[itemId]||defaultMarketCapacity(itemId,site),price:marketPrice(site,itemId)}));
}
function workshopSite(site){return site?.type==='town'||site?.type==='capital'}
function workshopPrices(site){
 return Object.fromEntries([...FORGE_MATERIALS,...WORKSHOP_ITEMS].map(id=>[id,marketPrice(site,id)]));
}
function workshopMaterials(materials){
 return FORGE_MATERIALS.filter(id=>materials[id]>0).map(id=>materials[id]+' '+id).join(', ');
}
function workshopCanFund(player,deposit){
 return player.gold>=deposit.gold&&FORGE_MATERIALS.every(id=>(player.inventory[id]||0)>=(deposit.materials[id]||0));
}
function workshopTroopGroups(item,stock){
 const choices=new Map(),p=state.player;
 for(const group of p.roster){
  const key=ARMORY.designKey(group.faction,group.tier,group.unitId);
  if(p.forge.troops[key]||!ARMORY.allowedWeapons(group.faction,group.tier,group.unitId).includes(item))continue;
  if(kingdomLoadout(group.faction,group.tier,group.unitId).weaponId===item)continue;
  if(!choices.has(key))choices.set(key,{key,group,count:0,label:troopName(group)});
  choices.get(key).count+=group.count;
 }
 return [...choices.values()].filter(choice=>choice.count<=stock);
}
function workshopButton(action,label,disabled=false,item='',quantity=0){
 return '<button type="button" class="btn small secondary" data-workshop-action="'+action+'"'+
  (item?' data-workshop-item="'+item+'" data-workshop-quantity="'+quantity+'"':'')+
  (disabled?' disabled':'')+'>'+esc(label)+'</button>';
}
function renderWorkshop(site){
 const section=$('townWorkshop'),list=$('townWorkshopList'),eligible=workshopSite(site);
 section.hidden=!eligible;if(!eligible)return;
 const p=state.player,workshop=state.workshops[site.id];
 if(!workshop){
  const cost=WORKSHOP_STAKE.gold+' denars, '+workshopMaterials(WORKSHOP_STAKE.materials);
  list.innerHTML='<div class="workshop-row"><span class="workshop-actions">'+
   workshopButton('fund','Fund smithy',!workshopCanFund(p,WORKSHOP_STAKE))+
   '</span><span class="workshop-meta"><small>Deposit '+esc(cost)+'</small></span></div>'+
   '<p class="subtle">Make weapons for the market or your company.</p>';
  return;
 }
 const recipeId=WORKSHOP_ITEMS.includes(workshop.recipeId)?workshop.recipeId:'sword';
 const options=WORKSHOP_ITEMS.map(id=>'<option value="'+id+'"'+(recipeId===id?' selected':'')+'>'+esc(ITEMS[id].name)+'</option>').join('');
 const quote=WORKSHOPS.quote(recipeId,workshopPrices(site));
 const remaining=workshopMaterials(workshop.materials)||'no materials reserved';
 const stock=ensureMarket(site).stock;
 const stockLine=FORGE_MATERIALS.filter(id=>quote.materials[id]>0).map(id=>stock[id]+' '+id).join(' · ');
 const statuses={no_funds:'Deposit more denars for materials and labor.',market_shortage:'Production is waiting for materials.',market_full:'The market has no room for more weapons.',
  no_demand:'The shop is waiting for buyers.',company_storage_full:'Pick up the finished weapons to make room.'};
 const status=statuses[workshop.blockedReason];
 const reason=status?'<p class="subtle">'+status+'</p>':'';
 const pickup=WORKSHOP_ITEMS.filter(id=>workshop.companyStock[id]>0).map(id=>{
  const quantity=workshop.companyStock[id],choices=workshopTroopGroups(id,quantity);
  const assign=choices.length?'<label class="workshop-meta" for="workshop-unit-'+id+'">Issue to a troop group</label>'+
   '<select id="workshop-unit-'+id+'">'+choices.map(c=>'<option value="'+esc(c.key)+'">'+esc(c.label)+' · '+c.count+' weapons</option>').join('')+'</select>'+
   workshopButton('issue','Issue weapons',false,id,quantity):'';
  return '<article class="workshop-row"><span class="workshop-meta"><b>'+quantity+' × '+esc(ITEMS[id].name)+'</b><small>Ready for pickup</small></span>'+
   '<div class="workshop-actions">'+workshopButton('collect','Collect '+quantity,false,id,quantity)+assign+'</div></article>';
 }).join('');
 list.innerHTML='<div class="workshop-row"><span class="workshop-meta"><b>'+workshop.treasury+' denars in the smithy</b><small>'+esc(remaining)+'</small></span><span class="workshop-actions">'+
  workshopButton('addGold','Deposit 120 denars',p.gold<120)+workshopButton('addMaterials','Deposit materials',!workshopCanFund(p,{gold:0,materials:WORKSHOP_STAKE.materials}))+'</span></div>'+
  '<p class="subtle">Material deposit · '+esc(workshopMaterials(WORKSHOP_STAKE.materials))+'</p>'+
  '<div class="workshop-row"><label class="workshop-meta" for="workshopRecipe">Make</label><select id="workshopRecipe">'+options+'</select></div>'+
  '<div class="workshop-row"><label class="workshop-meta" for="workshopOutput">Send to</label><select id="workshopOutput">'+
  '<option value="market"'+(workshop.output==='market'?' selected':'')+'>Town market</option><option value="company"'+(workshop.output==='company'?' selected':'')+'>Company pickup</option></select></div>'+
  '<p class="subtle">Per weapon · '+esc(workshopMaterials(quote.materials))+' · '+quote.labor+' denars labor'+
  (workshop.output==='market'?' · '+quote.ownerSharePerSale+' denar share before costs':'')+'<br>Local stock · '+esc(stockLine)+'</p>'+reason+
  '<div class="workshop-row"><span class="workshop-meta"><b>'+Math.min(workshop.earnings,workshop.treasury).toLocaleString()+' denars to collect</b><small>'+
  workshop.producedTotal+' made · '+workshop.soldTotal+' sold</small></span><span class="workshop-actions">'+
  workshopButton('earnings','Collect proceeds',Math.min(workshop.earnings,workshop.treasury)<1)+'</span></div>'+pickup;
}
function handleWorkshopAction(event){
 const button=event.target.closest?.('[data-workshop-action]');
 const control=event.type==='change'&&['workshopRecipe','workshopOutput'].includes(event.target.id);
 if(!button&&!control)return false;
 const p=state?.player,site=S[state?.currentTownId];
 if(!p||!workshopSite(site)||!smithyIsOpen(site.id)||button?.disabled)return true;
 const workshops=state.workshops,workshop=workshops[site.id];
 const before=workshop?JSON.parse(JSON.stringify(workshop)):null;
 const playerBefore={gold:p.gold,inventory:{...p.inventory},armory:{...p.armory}};
 const savePrevious=()=>{
  if(before)workshops[site.id]=before;
  else delete workshops[site.id];
  Object.assign(p,playerBefore);
 };
 let result,message='';
 const action=button?.dataset.workshopAction,item=button?.dataset.workshopItem,quantity=Number(button?.dataset.workshopQuantity);
 if(action==='fund'&&!workshop&&workshopCanFund(p,WORKSHOP_STAKE)){
  result=WORKSHOPS.fund(workshops,site.id,p,WORKSHOP_STAKE,state.day);
  if(result.valid)result=WORKSHOPS.setOrder(workshops,site.id,{recipeId:'sword',output:'market'});
  message='Smithy funded in '+site.name+'. Production starts the next campaign day.';
 }else if(!workshop)return true;
 else if(control){
  result=WORKSHOPS.setOrder(workshops,site.id,{recipeId:$('workshopRecipe').value,output:$('workshopOutput').value});
  message='Workshop order updated.';
 }else if(action==='addGold'||action==='addMaterials'){
  const deposit=action==='addGold'?{gold:120,materials:{}}:{gold:0,materials:WORKSHOP_STAKE.materials};
  if(!workshopCanFund(p,deposit))return true;
  result=WORKSHOPS.fund(workshops,site.id,p,deposit);
  message=action==='addGold'?'Deposited 120 denars.':'Deposited materials.';
 }else if(action==='earnings'){
  result=WORKSHOPS.collectEarnings(workshops,site.id,p);
  message=result.valid?'Collected '+result.amount.toLocaleString()+' denars from workshop sales.':'';
 }else if((action==='collect'||action==='issue')&&WORKSHOP_ITEMS.includes(item)&&workshop.companyStock[item]===quantity&&quantity>0){
  if(action==='collect'){
   result=WORKSHOPS.collect(workshops,site.id,p,item,quantity);
   message='Collected '+quantity+' × '+ITEMS[item].name+'.';
  }else{
   const key=$('workshop-unit-'+item)?.value;
   const choice=workshopTroopGroups(item,quantity).find(c=>c.key===key);
   if(!choice)return true;
   const group=choice.group,kit=ARMORY.normalizeDesign(group.faction,group.tier,{weaponId:item,style:'balanced',name:ITEMS[item].name},group.unitId);
   if(!kit)return true;
   result=WORKSHOPS.collect(workshops,site.id,p,item,choice.count);
   if(result.valid){p.inventory[item]-=choice.count;p.armory[key]=kit}
   message='Issued '+choice.count+' weapons to '+choice.label+'.';
  }
 }
 if(!result?.valid){
  savePrevious();renderWorkshop(site);notify('Review the workshop’s current funds, stock, and order.');return true;
 }
 if(!saveGame(true)){
  savePrevious();renderWorkshop(site);notify('Could not save the workshop change.');return true;
 }
 log(message);notify(message);refreshUI();renderWorkshop(site);$('townWorkshopNotice').textContent=message;
 if(control)$(event.target.id).focus();
 return true;
}
function buyItem(id){
 const it=ITEMS[id],p=state?.player,site=S[state?.currentTownId];if(!it||!p||!site)return;
 const market=ensureMarket(site),item=townMarket(site.id).find(v=>v.id===id);if(!item||item.stock<1){notify('The local market is sold out.');return}
 const quantity=it.resource?5:1,unitPrice=item.price,total=unitPrice*quantity;
 if(it.resource&&item.stock<quantity){notify('The market needs more stock before it can sell a bundle of '+quantity+'.');return}
 if(p.gold<total){notify('Not enough denars.');return}
 p.gold-=total;market.stock[id]-=quantity;
 if(state.workshops[site.id]&&WORKSHOP_ITEMS.includes(id))WORKSHOPS.recordPlayerPurchase(state.workshops,site.id,id,quantity);
 if(site.faction!==p.origin){setFactionRelation(p.origin,site.faction,factionRelation(p.origin,site.faction)+1);setFactionTension(p.origin,site.faction,factionTension(p.origin,site.faction)-1)}
 if(it.resource)grantItem(id,quantity);else if(id==='food')p.food+=8;else grantItem(id,id==='arrows'?12:id==='stones'?6:1);
 log('Bought '+(it.resource?quantity+' '+it.name.toLowerCase():it.name)+' in '+site.name+' for '+total+' denars.');
 refreshUI();saveGame(true);showTown(site.id);
}
function sellResource(id){
 const item=ITEMS[id],site=S[state?.currentTownId],p=state?.player;if(!item?.resource||!site||!p)return;
 const market=ensureMarket(site),owned=Number(p.inventory[id])||0,room=Math.max(0,market.capacity[id]-market.stock[id]);
 const quantity=Math.min(5,owned,room);if(!quantity){notify(owned?'This market has no room for more.':'You have none to sell.');return}
 const unit=marketSalePrice(site,id),total=unit*quantity;
 p.inventory[id]-=quantity;market.stock[id]+=quantity;p.gold+=total;if(site.faction!==p.origin){setFactionRelation(p.origin,site.faction,factionRelation(p.origin,site.faction)+1);setFactionTension(p.origin,site.faction,factionTension(p.origin,site.faction)-1)}
 log('Sold '+quantity+' '+item.name.toLowerCase()+' in '+site.name+' for '+total+' denars.');
 refreshUI();saveGame(true);showTown(site.id);
}
function sellFood(){
 const site=S[state?.currentTownId],p=state?.player;if(!site||!p)return;
 const market=ensureMarket(site),room=(market.capacity.food||defaultMarketCapacity('food',site))-market.stock.food;
 if(p.food<8||room<1){notify(p.food<8?'You need eight provisions to sell a bundle.':'This market has no room for more provisions.');return}
 const price=marketSalePrice(site,'food');
 p.food-=8;market.stock.food++;p.gold+=price;if(site.faction!==p.origin){setFactionRelation(p.origin,site.faction,factionRelation(p.origin,site.faction)+1);setFactionTension(p.origin,site.faction,factionTension(p.origin,site.faction)-1)}log('Sold eight provisions in '+site.name+' for '+price+' denars.');
 refreshUI();saveGame(true);showTown(site.id);
}
function normalizeCampaignForge(raw){
 const items=[],ids=new Set(),troops={},rangedTroops={};
 let nextId=Number.isInteger(raw?.nextId)&&raw.nextId>0&&raw.nextId<=999999999?raw.nextId:1;
 for(const item of Array.isArray(raw?.items)?raw.items:[]){
  if(typeof item?.id!=='string'||!/^forge:[1-9]\d{0,8}$/.test(item.id)||ids.has(item.id))continue;
  const build=FORGE.normalizeBuild(item.build);
  if(!build)continue;
  items.push({id:item.id,build});
  ids.add(item.id);nextId=Math.max(nextId,Number(item.id.slice(6))+1);
 }
 for(const faction of F){
  const slots=faction.troops.map((_,tier)=>({tier})).concat(ARMORY.branchSlots(faction.id));
  for(const {tier,unitId} of slots){
   const key=ARMORY.designKey(faction.id,tier,unitId),kit=ARMORY.getLoadout(faction.id,tier,null,unitId);
   const weapon=FORGE.normalizeBuild(raw?.troops?.[key]),bow=FORGE.normalizeBuild(raw?.rangedTroops?.[key]);
   if(weapon&&weapon.category!=='bow'&&smithyBaseWeapon(kit,weapon.category))troops[key]=weapon;
   if(bow?.category==='bow'&&smithyBaseWeapon(kit,'bow'))rangedTroops[key]=bow;
  }
 }
 return {items,troops,rangedTroops,equipped:ids.has(raw?.equipped)?raw.equipped:null,nextId};
}
function smithyAvailable(siteId){
 const site=S[siteId],p=state?.player;
 return !!(site&&p&&['capital','town','castle'].includes(site.type)&&state.currentTownId===site.id&&
  dist(p.x,p.y,site.x,site.y)<=TOWN_ENTRY_RANGE);
}
function smithyIsOpen(siteId){return smithyAvailable(siteId)&&!$('screenTown').classList.contains('hidden')}
function currentForgedWeapon(){
 const forge=state?.player?.forge;
 const item=forge?.items.find(item=>item.id===forge.equipped);
 return item?FORGE.resolve(item.build):null;
}
function smithyQuote(build,siteId){
 const weapon=FORGE.resolve(build),p=state?.player;
 if(!weapon||!p)return null;
 const materials=Object.fromEntries(FORGE_MATERIALS.map(id=>[id,weapon.cost[id]]));
 const gold=weapon.cost.gold;
 const fullGold=gold+Math.ceil(FORGE_MATERIALS.reduce((sum,id)=>sum+materials[id]*ITEMS[id].price,0)*1.5);
 const available=smithyAvailable(siteId);
 return {weapon,materials,gold,fullGold,
  canMaterials:available&&p.gold>=gold&&FORGE_MATERIALS.every(id=>(p.inventory[id]||0)>=materials[id]),
  canGold:available&&p.gold>=fullGold};
}
function commitSmithy(message,apply){
 const p=state.player,forge=p.forge;
 const before={gold:p.gold,inventory:{...p.inventory},equipment:{...p.equipment},armory:{...p.armory},
  forge:{...forge,items:forge.items.slice(),troops:{...forge.troops},rangedTroops:{...forge.rangedTroops}}};
 apply(p);
 if(!saveGame(true)){
  Object.assign(p,before);notify('Could not save the equipment change.');return false;
 }
 log(message);notify(message);inspectorDirty=true;refreshUI();
 return true;
}
function craftSmithyWeapon(siteId,build,payment){
 const quote=smithyQuote(build,siteId);
 if(!smithyIsOpen(siteId)||!quote||!(payment==='materials'?quote.canMaterials:payment==='gold'&&quote.canGold)){
  notify('The smithy cannot complete this order. Check your gold and materials.');return null;
 }
 const id='forge:'+state.player.forge.nextId,recipe=FORGE.normalizeBuild(build);
 const crafted=commitSmithy('Forged '+quote.weapon.name+'.',p=>{
  p.gold-=payment==='materials'?quote.gold:quote.fullGold;
  if(payment==='materials')for(const key of FORGE_MATERIALS)p.inventory[key]-=quote.materials[key];
  p.forge.nextId++;p.forge.items.push({id,build:recipe});
 });
 return crafted?id:null;
}
function smithyTroopChoices(category){
 const choices=new Map();
 for(const group of state.player.roster){
  const kit=ARMORY.getLoadout(group.faction,group.tier,null,group.unitId);
  if(!smithyBaseWeapon(kit,category))continue;
  const id=ARMORY.designKey(group.faction,group.tier,group.unitId);
  choices.set(id,{id,name:troopName(group)});
 }
 return [...choices.values()];
}
function smithyInventory(siteId){
 const p=state?.player;
 if(!p)return [];
 const available=smithyAvailable(siteId);
 const crafted=p.forge.items.map(({id,build})=>{
  const weapon=FORGE.resolve(build),equipped=p.forge.equipped===id;
  const salvage=Object.fromEntries(FORGE_MATERIALS.filter(key=>weapon.cost[key]>=2).map(key=>[key,Math.floor(weapon.cost[key]/2)]));
  const cost=smithyQuote(build,siteId);
  return {id,name:weapon.name,quantity:1,crafted:true,weapon,equipped,canEquip:!equipped,
   sellPrice:Math.floor(cost.fullGold*.42),salvage,troopChoices:available&&!equipped?smithyTroopChoices(weapon.category):[]};
 });
 const stock=Object.entries(FORGE_GEAR_SALVAGE).filter(([id])=>p.inventory[id]>=1).map(([id,salvage])=>{
  const item=ITEMS[id];
  return {id,name:item.name,quantity:p.inventory[id],crafted:false,equipped:false,canEquip:!item.lootOnly,
   sellPrice:Math.floor(item.price*.42),salvage,troopChoices:[]};
 });
 return crafted.concat(stock);
}
function equipSmithyWeapon(id){
 const p=state?.player;
 if(!p)return false;
 const forged=p.forge.items.find(item=>item.id===id);
 if(forged){
  if(p.forge.equipped===id)return false;
  const weapon=FORGE.resolve(forged.build);
  return commitSmithy('Equipped '+weapon.name+'.',p=>{
   if(p.equipment.weapon)grantItem(p.equipment.weapon);
   p.equipment.weapon=null;p.forge.equipped=id;
  });
 }
 const item=Object.hasOwn(ITEMS,id)?ITEMS[id]:null;
 if(!item?.slot||item.lootOnly||!(p.inventory[id]>=1))return false;
 return commitSmithy('Equipped '+item.name+'.',p=>{
  const slot=item.slot,old=p.equipment[slot];
  p.inventory[id]--;
  if(old)grantItem(old);
  p.equipment[slot]=id;
  if(slot==='weapon')p.forge.equipped=null;
 });
}
function removeSmithyGear(p,row){
 if(row.crafted)p.forge.items=p.forge.items.filter(item=>item.id!==row.id);
 else p.inventory[row.id]--;
}
function processSmithyGear(siteId,id,action){
 if(!smithyIsOpen(siteId)||!['sell','salvage'].includes(action))return false;
 const row=smithyInventory(siteId).find(item=>item.id===id&&!item.equipped);
 if(!row||action==='salvage'&&!Object.keys(row.salvage).length)return false;
 const gain=action==='sell'?row.sellPrice+' denars':Object.entries(row.salvage).map(([key,value])=>value+' '+key).join(', ');
 return commitSmithy((action==='sell'?'Sold ':'Salvaged ')+row.name+' for '+gain+'.',p=>{
  removeSmithyGear(p,row);
  if(action==='sell')p.gold+=row.sellPrice;
  else for(const [key,value] of Object.entries(row.salvage))grantItem(key,value);
 });
}
function assignSmithyWeapon(siteId,id,kitId){
 if(!smithyIsOpen(siteId))return false;
 const row=smithyInventory(siteId).find(item=>item.id===id&&item.crafted&&!item.equipped);
 const choice=row?.troopChoices.find(kit=>kit.id===kitId);
 if(!choice)return false;
 return commitSmithy('Assigned '+row.name+' to '+choice.name+'.',p=>{
  const patterns=row.weapon.category==='bow'?p.forge.rangedTroops:p.forge.troops;
  patterns[kitId]=p.forge.items.find(item=>item.id===id).build;
  delete p.armory[kitId];removeSmithyGear(p,row);
 });
}
function buildGranary(id){
 const site=S[id],p=state?.player;if(!site||!p)return;
 const project=state.settlementProjects[id]||{};
 if(project.granary){notify('This settlement already has a granary.');return}
 const cost={gold:180,timber:8,iron:3,tools:4};
 if(p.gold<cost.gold||p.inventory.timber<cost.timber||p.inventory.iron<cost.iron||p.inventory.tools<cost.tools){
  notify('A granary needs 180 denars, 8 timber, 3 iron and 4 tools.');return;
 }
 p.gold-=cost.gold;p.inventory.timber-=cost.timber;p.inventory.iron-=cost.iron;p.inventory.tools-=cost.tools;
 state.settlementProjects[id]={...project,granary:true};
 const market=ensureMarket(site);market.stock.grain=Math.min(market.capacity.grain,market.stock.grain+12);
 market.stock.food=Math.min(market.capacity.food||defaultMarketCapacity('food',site),market.stock.food+3);
 log('Built a granary in '+site.name+'. Grain stores now hold more and provisions reach the market faster.');
 notify('Granary built · larger grain stores and more provisions.');saveGame(true);showTown(id);
}function contractOffers(townId){
 const town=S[townId];if(!town)return[];const day=state.day;
 const destinations=S.filter(s=>s.id!==townId).sort((a,b)=>dist(town.x,town.y,a.x,a.y)-dist(town.x,town.y,b.x,b.y));
 const landmark=(W.landmarks||[]).filter(a=>!state.visitedLandmarks.includes(a.id)).sort((a,b)=>dist(town.x,town.y,a.x,a.y)-dist(town.x,town.y,b.x,b.y))[0]||W.landmarks?.[0];
 const target=state.parties.filter(p=>p.active&&p.kind==='bandit').sort((a,b)=>dist(town.x,town.y,a.x,a.y)-dist(town.x,town.y,b.x,b.y))[0];
 const destination=destinations[(townId*7+day)%Math.max(1,destinations.length)]||town;
 return[
  {id:'courier-'+townId+'-'+day,type:'courier',title:'Rider’s dispatch',description:'Carry a sealed message to '+destination.name+'.',destinationId:destination.id,reward:80+Math.round(dist(town.x,town.y,destination.x,destination.y)/45),xp:35,faction:destination.faction},
  {id:'survey-'+townId+'-'+day,type:'survey',title:'Survey the old roads',description:landmark?'Explore '+landmark.name+'.':'Explore any landmark.',landmarkId:landmark?.id??null,reward:75,xp:45,faction:town.faction},
  {id:'bounty-'+townId+'-'+day,type:'bounty',title:'Roadside bounty',description:target?'Defeat the outlaw band near '+W.closestSettlement(target.x,target.y).name+'.':'Defeat an outlaw party on the roads.',partyId:target?.id,reward:120+(target?.strength||6)*14,xp:55,faction:town.faction}
 ].map(offer=>({...offer,houseId:localHouse(town).id}));
}
function renderTownContracts(townId){
 const active=state.player.activeContracts,offers=contractOffers(townId),completed=new Set(state.completedContracts||[]);
 const current=active.map(c=>'<article class="contract-card active"><div><b>📜 '+esc(c.title)+'</b><small>'+esc(c.description)+' · Reward '+c.reward+' denars</small></div><button class="btn small" type="button" data-contract-cancel="'+esc(c.id)+'">Abandon</button></article>').join('');
 const board=offers.map(c=>{const claimed=completed.has(c.id),already=active.some(a=>a.id===c.id),full=active.length>=3;
  return '<article class="contract-card"><div><b>'+esc(c.title)+'</b><small>'+esc(c.description)+' · '+c.reward+' denars · +8 '+esc(HOUSES[c.houseId].name)+' favor</small></div><button class="btn small" data-contract-accept="'+esc(c.id)+'" '+(claimed||already||full?'disabled':'')+'>'+(claimed?'Claimed':already?'Accepted':full?'Party full':'Accept')+'</button></article>'
 }).join('');
 return '<div class="smallcaps">ACTIVE CONTRACTS · '+active.length+'/3</div>'+(current||'<p class="subtle">No contracts underway.</p>')+'<div class="smallcaps contract-board-title">AVAILABLE WORK</div>'+board;
}
function acceptContract(contractId,townId){
 const p=state.player;if(p.activeContracts.length>=3){notify('Your company can carry three contracts at a time.');return}
 const offer=contractOffers(townId).find(c=>c.id===contractId);
 if(!offer||(state.completedContracts||[]).includes(contractId)||p.activeContracts.some(c=>c.id===contractId))return;
 p.activeContracts.push(offer);log('Accepted contract: '+offer.title+'.');saveGame(true);refreshUI();showTown(townId);
}
function abandonContract(contractId){
 const active=state.player.activeContracts;
 const index=active.findIndex(contract=>contract.id===contractId);
 if(index<0)return;
 const [contract]=active.splice(index,1);
 log('Abandoned contract: '+contract.title+'.');
 showTown(state.currentTownId);refreshUI();saveGame(true);
 notify('Contract abandoned.');
}
function closeUnavailableBounties(){
 const p=state.player,active=p.activeContracts;
 const remaining=active.filter(contract=>contract.type!=='bounty'||contract.partyId==null||
  state.parties.some(party=>party.id===contract.partyId&&party.kind==='bandit'&&party.active));
 const count=active.length-remaining.length;
 if(!count)return false;
 p.activeContracts=remaining;
 const notice=count===1?'Bounty closed. The target is gone.':count+' bounties closed. Their targets are gone.';
 log(notice);notify(notice);return true;
}
function completeContract(contractId){
 const p=state.player,index=p.activeContracts.findIndex(c=>c.id===contractId);if(index<0)return;
 const c=p.activeContracts.splice(index,1)[0];p.gold+=c.reward;grantXP(c.xp);p.renown+=1;
 const issuingSite=S[Number(String(c.id).split('-')[1])];
 const house=HOUSES[c.houseId]||(issuingSite?localHouse(issuingSite):null);
 if(house)p.houseFavor[house.id]=Math.min(100,houseFavor(house)+8);
 if(Number.isInteger(c.faction)){changeStanding(c.faction,5);if(c.faction!==p.origin){setFactionRelation(p.origin,c.faction,factionRelation(p.origin,c.faction)+2);setFactionTension(p.origin,c.faction,factionTension(p.origin,c.faction)-2)}}
 state.completedContracts=state.completedContracts||[];state.completedContracts.push(c.id);
 log('Contract complete: '+c.title+'. +'+c.reward+' denars, +'+c.xp+' XP.');notify('Contract complete · '+c.title+' · +'+c.reward+' denars');
}
function equipItem(id){
 if(equipSmithyWeapon(id))showCharacter();
}
function improveStat(name){
 const p=state?.player;if(!p||!p.statPoints||!Object.prototype.hasOwnProperty.call(p.stats,name))return;
 p.stats[name]++;p.statPoints--;
 log('Improved '+name+'.');saveGame(true);refreshUI();showCharacter();
}
function learnPerk(id){
 const p=state?.player;if(!p||p.perkPoints<1||!PERKS[id]||p.perks.includes(id))return;
 p.perkPoints--;p.perks.push(id);log('Learned the '+PERKS[id].name+' perk.');
 notify('Perk learned · '+PERKS[id].name);saveGame(true);refreshUI();showCharacter();
}
function promotionOptions(index){
 const p=state.player,g=p.roster[index];
 if(!g||g.tier>=2)return [];
 const {ready,trainingNeeded}=partyGroupStatus(g),tier=g.tier+1,unitCost=PROMOTION_PRICE[g.tier];
 const max=Math.min(ready,Math.floor(p.gold/unitCost)),wageChange=TROOP_WAGES[tier]-TROOP_WAGES[g.tier];
 const reason=!ready?'Needs healthy troops with '+trainingNeeded+' training':!max?'Not enough denars':'';
 return ARMORY.promotionPaths(g.faction,g.tier,g.unitId).map(id=>{
  const loadout=kingdomLoadout(g.faction,tier,id);
  return {id,name:loadout.name,role:loadout.role,loadout,unitCost,wageChange,ready,max,trainingNeeded,reason};
 });
}
function upgradeRoster(index,quantity=1,optionId){
 const p=state.player,g=p.roster[index],options=promotionOptions(index);
 const option=options.find(o=>o.id===(optionId??options[0]?.id));
 const number=Number(quantity);
 if(!option||!Number.isInteger(number)||number<1||number>option.max){
  notify(option?.reason||'Choose an available promotion quantity.');return false;
 }
 const healthy=g.count-g.wounded;
 for(let slot=healthy-1,left=number;slot>=0&&left;slot--){
  if(g.training[slot]<option.trainingNeeded)continue;
  g.training.splice(slot,1);left--;
 }
 g.count-=number;
 addHealthyTroops(g.faction,g.tier+1,option.id==='standard'?undefined:option.id,number);
 p.roster=p.roster.filter(group=>group.count>0);
 p.gold-=number*option.unitCost;
 log('Promoted '+number+' troops into '+option.name+'.');
 notify('Promoted '+number+' · '+option.name);refreshUI();saveGame(true);return true;
}
function openEncounter(party){
 if(!state||!party?.active||menuOpen)return;
 state.followPartyId=null;state.path=[];state.pathIndex=0;state.targetSettlement=null;state.targetLandmark=null;
 if(party.kind!=='bandit')state.escortPartyId=null;
 selected={type:'party',id:party.id};inspectorDirty=true;
 const kind=party.kind;
 const noble=state.nobleParties.get(party.id);
 const mission=CORRIDORS.mission(state.corridor,party.id);
 $('encounterNobleDetails').hidden=!noble;
 $('encounterNobleRoads').hidden=!noble;
 const family=$('encounterTravelingFamily'),guests=noble?.dependents||[];
 family.hidden=!guests.length;
 $('encounterFamilyActions').innerHTML=guests.map(person=>'<button class="btn small" type="button" data-encounter-person="'+esc(person.id)+
  '" aria-label="Speak to '+esc(person.name)+'">'+esc(person.name)+'</button>').join('');
 for(const id of ['encounterRoster','encounterTrade','encounterDeploy','encounterFight'])$(id).hidden=!!noble;
 if(mission){$('encounterDeploy').hidden=true;$('encounterFight').hidden=true}
 $('encounterTalk').textContent=noble?'Speak':'💬 Speak to their leader';
 $('encounterName').textContent=partyName(party);
 if(noble){
  const house=HOUSES[noble.houseId],person=state.people.get(noble.personId);
  const guards=party.strength-1;
  $('encounterIntro').textContent=person.name+(guards?' rides with '+guards+(guards===1?' guard.':' guards.'):
   guests.length?' travels with family.':' rides alone.');
  $('encounterNobleRole').textContent=nobleRole(person)+' · '+house.name;
  $('encounterNobleStatus').textContent=nobleActivity(noble);
  $('encounterNobleFavor').textContent=houseFavor(house)+' / 16';
  $('encounterDialogue').textContent=guards?'The escort makes room for you to speak.':person.name+' stops to speak.';
  openModal('screenEncounter');
  return;
 }
 $('encounterIntro').textContent=kind==='bandit'?
  'Armed outlaws block your road. They eye your company and await your decision.':
  kind==='caravan'?'A merchant caravan slows. Its guards watch your approach.':
  'A column of soldiers halts beneath its banners. Their captain awaits you.';
 $('encounterOwnCount').textContent=rosterCount()+' troops · '+state.player.name;
 const healthyTroops=state.player.roster.reduce((n,g)=>n+g.count-g.wounded,0);
 $('encounterOwnDetail').textContent='Hero '+state.player.hp+'% · '+healthyTroops+' fit'+
  (healthyTroops>MAX_DEPLOYED?' · '+MAX_DEPLOYED+' field places':!healthyTroops?' · Hero only':'')+
  (state.player.hp<=35?' · Rest at an inn to heal.':'');
 $('encounterEnemyCount').textContent=party.strength+' '+(kind==='bandit'?'outlaws':kind==='caravan'?'travelers':'soldiers');
 $('encounterEnemyDetail').textContent=kind==='bandit'?'Hostile raiders':
  F[party.faction].name+' · '+(kind==='patrol'?'Guarding the realm':'Trading goods');
 $('encounterDialogue').innerHTML='<b>The party stops before you.</b><p>You can speak, trade, fight or leave. The choice is yours.</p>';
 $('encounterTrade').disabled=kind==='bandit';
 $('encounterTrade').textContent=kind==='caravan'?'🪙 Buy caravan provisions':'📜 Ask for news';
 if(mission?.kind==='shipment'){
  $('encounterIntro').textContent='Duskford’s grain convoy is carrying '+mission.quantity+' grain to Redmarsh.';
  $('encounterDialogue').textContent='Escort the convoy to Redmarsh. Help drive off raiders if they approach.';
  $('encounterTrade').textContent='Escort to Redmarsh';
 }else if(mission?.kind==='patrol')$('encounterIntro').textContent='Valecrown sent '+party.strength+' guards along the supply road.';
 openModal('screenEncounter');
}
function launchCampaignBattle(party,deploymentPlanner=false){
 if(!party?.active||!state)return;
 const troops=[];
 for(let groupIndex=0;groupIndex<state.player.roster.length;groupIndex++){
  const g=state.player.roster[groupIndex],n=Math.max(0,g.count-(g.wounded||0));
  const loadout=kingdomLoadout(g.faction,g.tier,g.unitId);
  for(let slot=0;slot<n&&troops.length<MAXPARTY;slot++)
   troops.push({groupIndex,slot,faction:g.faction,tier:g.tier,unitId:g.unitId,loadout});
 }
 const sessionId='battle-'+Date.now().toString(36)+'-'+Math.floor(Math.random()*1e7).toString(36);
  const tile=W.tileAt(state.player.x,state.player.y),battleSeed=Math.abs((party.id*31+Math.floor(state.player.x/90)*17+Math.floor(state.player.y/90)*13+state.day*7)%50);
  const session={status:'active',sessionId,partyId:party.id,kind:party.kind,
  faction:party.faction,enemyCount:Math.min(MAX_DEPLOYED,party.strength),
   playerName:state.player.name,heroHealth:state.player.hp,playerMorale:state.player.morale,level:state.player.level,troops,
   equipment:state.player.equipment,heroWeapon:currentForgedWeapon(),inventory:state.player.inventory,stats:state.player.stats,perks:state.player.perks,
   terrainKind:tile.kind,battleX:state.player.x,battleY:state.player.y,mapSeed:battleSeed,
   deploymentPool:true,deploymentPlanner};
 const previousBattle=state.pendingBattleId;
 try{localStorage.setItem('ua-campaign-battle-session-v1',JSON.stringify(session))}
 catch(e){notify('Could not open battle. Please allow local browser storage.');return}
 state.pendingBattleId=sessionId;
 state.lastEncounter=state.day+state.hour/24;
 state.followPartyId=null;state.path=[];state.pathIndex=0;
 if(!saveGame(true)){
  state.pendingBattleId=previousBattle;
  try{localStorage.removeItem('ua-campaign-battle-session-v1')}catch(e){}
  notify('Browser storage is needed for campaign battles.');return;
 }
 window.location.href='campaign-battle.html?campaign=1&v=4.20'+(deploymentPlanner?'&deploy=1':'');
}
function skirmish(id,deploymentPlanner=false){
 const party=state?.parties.find(p=>p.id===id&&p.active);
 if(!party||party.kind==='noble'||CORRIDORS.mission(state.corridor,id))return;
 if(dist(state.player.x,state.player.y,party.x,party.y)>155){followParty(id);return}
 launchCampaignBattle(party,deploymentPlanner);
}
function applyTroopBattleResult(result,session){
 const roster=state.player.roster,reported=new Map();
 const snapshot=session?.sessionId===result.sessionId&&Array.isArray(session?.troops)?session.troops:null;
 const eligible=new Map(),launched=snapshot&&new Map(snapshot.filter(Boolean).map(t=>[t.groupIndex+':'+t.slot,t]));
 // Without a matching legacy snapshot, the original launch order was limited to 50 fit slots.
 let remaining=launched?MAXPARTY:MAX_DEPLOYED;
 for(const [groupIndex,group] of roster.entries()){
  const count=Math.min(remaining,group.count-group.wounded);
  for(let slot=0;slot<count;slot++){
   const key=groupIndex+':'+slot;
   const source=launched?.get(key);
   if(!launched||(source&&source.faction===group.faction&&source.tier===group.tier&&source.unitId===group.unitId))
    eligible.set(key,group);
  }
  remaining-=count;
 }
 for(const fighter of result.entries){
  if(reported.size>=MAX_DEPLOYED)break;
  if(!Number.isInteger(fighter?.groupIndex)||!Number.isInteger(fighter.slot)||fighter.slot<0)continue;
  const key=fighter.groupIndex+':'+fighter.slot,group=eligible.get(key);
  if(!group||reported.has(key)||!['standing','escaped','incapacitated','killed','surrendered'].includes(fighter.result))continue;
  if((fighter.faction!=null&&fighter.faction!==group.faction)||(fighter.tier!=null&&fighter.tier!==group.tier)||
     (fighter.unitId!=null&&fighter.unitId!==group.unitId))continue;
  reported.set(key,fighter);
 }
 const casualties={killed:0,wounded:0,survivors:0,trained:0};
 for(const [groupIndex,group] of roster.entries()){
  const healthy=[],wounded=[],fitCount=group.count-group.wounded,threshold=PROMOTION_TRAINING[group.tier]||0;
  for(let slot=0;slot<fitCount;slot++){
   const fighter=reported.get(groupIndex+':'+slot),old=group.training[slot];
   if(!fighter){healthy.push(old);continue}
   if(fighter.result==='killed'||fighter.result==='surrendered'){casualties.killed++;continue}
   const engaged=fighter.engaged===true||(fighter.engaged==null&&result.winner==='friend');
   const earned=!engaged||result.winner==='retreat'?0:result.winner==='friend'&&fighter.result!=='escaped'?2:1;
   const training=Math.min(threshold,old+earned);
   if(training>old)casualties.trained++;
   if(fighter.result==='incapacitated'){wounded.push(training);casualties.wounded++}
   else{healthy.push(training);casualties.survivors++}
  }
  wounded.push(...group.training.slice(fitCount));
  group.training=healthy.concat(wounded);group.count=group.training.length;group.wounded=wounded.length;
 }
 state.player.roster=roster.filter(g=>g.count>0);
 return casualties;
}
function clearBattleRecords(){
 try{
  localStorage.removeItem('ua-campaign-battle-result-v1');
  localStorage.removeItem('ua-campaign-battle-session-v1');
 }catch(e){}
}
function collectBattleGear(result,party){
 const recovered=new Map();
 if(Array.isArray(result.enemyLoot)){
  for(const piece of result.enemyLoot.slice(0,3)){
   const id=BATTLE_LOOT[piece?.kind]?.[piece?.id];
   if(!Object.hasOwn(ITEMS,id)||piece.quantity!==1)continue;
   recovered.set(id,(recovered.get(id)||0)+1);
  }
 }else{
  // A battle left open on an older build still receives its original reward.
  const drops=['arrows','stones','sword','leatherArmor','buckler'];
  const id=drops[Math.abs((party?.id||0)*11+(party?.strength||5)+state.day)%drops.length];
  recovered.set(id,id==='arrows'?12:id==='stones'?6:1);
 }
 for(const [id,amount] of recovered)grantItem(id,amount);
 return [...recovered].map(([id,amount])=>ITEMS[id].name+(amount>1&&ITEMS[id].slot?' ×'+amount:''));
}
function consumeBattleResult(){
 if(!state?.pendingBattleId)return false;
 let result=null,session=null;
 try{result=JSON.parse(localStorage.getItem('ua-campaign-battle-result-v1')||'null')}catch(e){}
 try{session=JSON.parse(localStorage.getItem('ua-campaign-battle-session-v1')||'null')}catch(e){}
 if(!result||result.sessionId!==state.pendingBattleId)return false;
 if(result.cancelled===true&&session?.sessionId===result.sessionId&&session.deploymentPlanner===true){
  state.pendingBattleId=null;
  if(!saveGame(true)){
   state.pendingBattleId=result.sessionId;notify('Could not close deployment. Reload to retry.');return true;
  }
  clearBattleRecords();
  const party=state.parties.find(p=>p.id===session.partyId&&p.active);
  if(party&&dist(state.player.x,state.player.y,party.x,party.y)<=155)openEncounter(party);
  else notify('Deployment cancelled.');
  return true;
 }
 if(!['friend','foe','draw','retreat'].includes(result.winner)||!Array.isArray(result.entries)||
    !Number.isFinite(result.heroHp)||!Number.isFinite(result.heroMaxHp)||result.heroMaxHp<=0)return false;
 state.pendingBattleId=null;state.followPartyId=null;
 const p=state.player,party=state.parties.find(a=>a.id===result.partyId);
 if(party?.kind==='patrol'){
  changeStanding(party.faction,-18);
  if(party.faction!==p.origin&&!factionsAtWar(p.origin,party.faction)){setFactionRelation(p.origin,party.faction,factionRelation(p.origin,party.faction)-8);setFactionTension(p.origin,party.faction,factionTension(p.origin,party.faction)+18);recordDiplomacy('A clash with '+F[party.faction].name+' patrols strained relations with '+F[p.origin].name+'.')}
  const war=p.origin!==party.faction&&state.diplomacy.wars.find(w=>pairHas([w],p.origin,party.faction));
  if(war&&['friend','foe'].includes(result.winner)){
   const winner=result.winner==='friend'?p.origin:party.faction;
   war.score=(war.score||0)+(war.attacker===winner?1:-1);
  }
  log('Attacking a realm patrol damaged your standing with '+F[party.faction].name+'.');
 }else if(party?.kind==='caravan'){
  changeStanding(party.faction,-28);log('Raiding a merchant caravan damaged your standing with '+F[party.faction].name+'.');
 }
 const casualties=applyTroopBattleResult(result,session);
 p.hp=clamp(Math.round(100*result.heroHp/result.heroMaxHp),14,100);
 p.inventory.arrows=Math.max(0,(p.inventory.arrows||0)-Math.max(0,Number(result.heroAmmoSpent)||0));
 p.inventory.stones=Math.max(0,(p.inventory.stones||0)-Math.max(0,Number(result.stonesSpent)||0));
 let reason,captives=null;
 if(result.winner==='friend'){
   p.morale=clamp(p.morale+3-casualties.wounded*1.2-casualties.killed*3,0,100);
  if(party?.kind==='bandit'){
   const local=W.closestSettlement(p.x,p.y);if(local)changeStanding(local.faction,3);
  }
   const loot=65+(party?.strength||result.enemyInitial||5)*12;
  const exp=50+(party?.strength||result.enemyInitial||5)*8;
   p.gold+=loot;grantXP(exp);p.renown+=party?.kind==='bandit'?3:1;
  p.food+=party?.kind==='caravan'?5:1;
  if(party){
   party.active=false;
   if(party.cargo){
    const {resource,quantity}=party.cargo;
    if(resource==='food')p.food+=quantity*8;
    else if(ITEMS[resource]?.resource)grantItem(resource,quantity);
    log('Recovered the caravan’s '+ITEMS[resource].name.toLowerCase()+'.');
    party.cargo=null;party.tradeTargetId=null;
   }
  }
   const gear=collectBattleGear(result,party);
   captives=PRISONERS.capture(p.prisoners,result,party);
   p.prisoners=captives.state;
   reason='Victory. Recovered '+loot+' denars and earned '+exp+' experience.'+
    (gear.length?' Gear recovered: '+gear.join(', ')+'.':'');
  log(reason);
  if(p.quest?.id===2&&party?.kind==='bandit')completeQuest(2);
  for(const c of [...p.activeContracts])if(c.type==='bounty'&&party?.kind==='bandit'&&(c.partyId==null||c.partyId===party.id))completeContract(c.id);
 }else if(result.winner==='foe'||result.winner==='draw'){
  p.morale=clamp(p.morale-12-casualties.killed*3,0,100);
  const lost=Math.min(p.gold,Math.round(p.gold*.14));p.gold-=lost;
  const refuge=W.closestSettlement(p.x,p.y);
  if(refuge){p.x=refuge.x;p.y=refuge.y;resetView()}
  reason='Your party was defeated and retreated. '+lost+' denars lost.';
  log(reason);
 }else{p.morale=clamp(p.morale-3,0,100);reason='You withdrew. The enemy party remains on the roads.';log(reason)}
 if(party&&result.winner!=='friend'&&Number.isInteger(result.enemySurvivors)&&Number.isInteger(result.enemyInitial)){
  const losses=clamp(result.enemyInitial-result.enemySurvivors,0,party.strength);
  party.strength-=losses;
  party.active=party.strength>0;
 }
 closeUnavailableBounties();
 refreshBanditCamps(false);
 selected={type:'land'};inspectorDirty=true;state.lastEncounter=state.day+state.hour/24;
 $('aftermathTitle').textContent=result.winner==='friend'?'⚔ Victory':
  result.winner==='retreat'?'↩ Withdrawn from battle':'⚑ Battle lost';
 $('aftermathDetails').innerHTML='<b>'+esc(reason)+'</b><p>'+
  casualties.killed+' killed or captured · '+casualties.wounded+' incapacitated · '+
  casualties.survivors+' returned fit · '+casualties.trained+' gained training.</p><p>Hero health '+p.hp+'% · Company morale '+Math.round(p.morale)+
  '/100. Wounded troops recover at inns.</p>';
 if(captives&&(captives.captured||captives.overflow)){
  const secured=captives.captured?captives.captured+' taken prisoner. ':'';
  const released=captives.overflow?captives.overflow+' surrendered and were released.':'';
  $('aftermathDetails').insertAdjacentHTML('beforeend','<p>'+secured+released+'</p>');
 }
 const nearbyInn=aftermathInnSite();
 $('aftermathInn').classList.toggle('hidden',!nearbyInn);
 if(nearbyInn)$('aftermathInn').textContent='Visit the inn at '+nearbyInn.name;
 if(saveGame(true))clearBattleRecords();
 else notify('Battle result kept for retry. Browser storage is full or unavailable.');
 refreshUI();modalStack=[];showScreen('screenAftermath');
 return true;
}
function settlementGlyphRadius(site){
 if(site.type==='capital')return 24;
 if(site.marketTier==='hub')return 21;
 if(site.type==='castle')return 18;
 return site.type==='village'?11:15;
}
function settlementMapVisible(site,zoom){
 if(site.type==='capital'||site.marketTier==='hub')return true;
 return zoom>=(site.type==='village'?.20:.15);
}
function settlementLabelVisible(site,zoom){
 if(!state.options.labels)return false;
 if(site.type==='capital')return true;
 if(site.marketTier==='hub')return zoom>=.20;
 return zoom>=(site.type==='village'?.35:.26);
}
function chooseSelection(x,y){
 const local=toScreen(x,y);
 let hit=null,nearest=Infinity;
 function consider(type,entity,radius,labelOffset=0,label=''){
  const marker=toScreen(entity.x,entity.y);
  let distance=dist(local.x,local.y,marker.x,marker.y);
  if(label&&labelOffset){
   const labelY=marker.y+labelOffset*camera.zoom;
   const halfWidth=label.length*4.5*camera.zoom;
   const labelDistance=Math.hypot(Math.max(0,Math.abs(local.x-marker.x)-halfWidth),local.y-labelY);
   distance=Math.min(distance,labelDistance+6);
  }
  if(distance<=radius&&distance<nearest){hit={type,id:entity.id};nearest=distance}
 }
 for(const s of S){
  if(!settlementMapVisible(s,camera.zoom))continue;
  const glyph=settlementGlyphRadius(s);
  const hasLabel=settlementLabelVisible(s,camera.zoom);
  consider('settlement',s,Math.max(22,(glyph+7)*camera.zoom),glyph+21,hasLabel?s.name:'');
 }
 for(const p of state.parties)if(p.active){
  const label=camera.zoom>.38?partyMapLabel(p):'';
  consider('party',p,Math.max(21,16*camera.zoom),26,label);
 }
 if(camera.zoom>.23)for(const place of W.landmarks||[]){
  consider('landmark',place,Math.max(21,18*camera.zoom),31,camera.zoom>.51?place.name:'');
 }
 selected=hit||{type:'land',x,y};inspectorDirty=true;
 if(hit?.type==='settlement'){const site=S[hit.id];travelTo(site.x,site.y,site.id)}
 else if(hit?.type==='party')followParty(hit.id);
 else if(hit?.type==='landmark')exploreLandmark(hit.id);
 else travelTo(x,y,null);
}
function colorAlpha(hex,alpha){
 if(!/^#[0-9a-fA-F]{6}$/.test(hex))return'rgba(190,215,159,'+alpha+')';
 const n=parseInt(hex.slice(1),16);return'rgba('+(n>>16)+','+((n>>8)&255)+','+(n&255)+','+alpha+')';
}
function inView(x,y,pad=120){const a=toScreen(x,y);return a.x>-pad&&a.y>-pad&&a.x<view.w+pad&&a.y<view.h+pad}
function drawLand(){
 window.UAMapPainter.draw(ctx,W,camera,view,state.options);
}
function drawFlag(x,y,f){
 ctx.fillStyle='#151d1a';ctx.fillRect(x-1,y-35,3,42);
 ctx.fillStyle=f.color;ctx.beginPath();ctx.moveTo(x,y-33);ctx.lineTo(x+36,y-29);ctx.lineTo(x+23,y-18);ctx.lineTo(x,y-20);ctx.fill();
 ctx.strokeStyle='#f5e8cc';ctx.lineWidth=1.5;ctx.stroke();
}
function paintSettlementMarker(pen,site,r){
 const {x,y}=site;
 const capital=site.type==='capital',castle=site.type==='castle',village=site.type==='village',hub=site.marketTier==='hub';
 pen.fillStyle='#172b24ef';
 pen.beginPath();pen.arc(x,y,r+7,0,Math.PI*2);pen.fill();
 pen.lineWidth=hub?5:3;
 pen.strokeStyle=hub?'#eac781':F[site.faction].color;
 pen.stroke();
 pen.fillStyle=capital?'#f1dba2':castle?'#bcc2bb':village?'#d4b48f':'#ded2b4';
 if(capital||castle){
  pen.fillRect(x-r*.8,y-r*.4,r*1.6,r*1.15);
  for(let i=-1;i<=1;i++)pen.fillRect(x+i*r*.55-r*.17,y-r*.84,r*.34,r*.52);
  pen.fillStyle='#30413a';pen.fillRect(x-r*.22,y+r*.18,r*.44,r*.57);
 }else if(hub){
  pen.fillRect(x-r*.78,y-r*.14,r*1.56,r*.84);
  pen.fillStyle='#a96148';pen.fillRect(x-r*.94,y-r*.7,r*1.88,r*.62);
  pen.fillStyle='#f2d794';
  for(let i=-1;i<=1;i++)pen.fillRect(x+i*r*.55-r*.14,y-r*.70,r*.28,r*.62);
  pen.fillStyle='#624933';pen.fillRect(x-r*.56,y+r*.11,r*1.12,r*.26);
 }else{
  pen.beginPath();pen.moveTo(x-r,y+r*.06);pen.lineTo(x,y-r*.87);pen.lineTo(x+r,y+r*.06);pen.closePath();pen.fill();
  pen.fillRect(x-r*.61,y,r*1.22,r*.73);
  pen.fillStyle='#624933';pen.fillRect(x-r*.16,y+r*.30,r*.32,r*.43);
 }
}
function drawVillageSpecialty(site,r){
 const style=W.resourceStyles[site.specialty];
 if(!style||camera.zoom<.35)return;
 const x=site.x+r+12,y=site.y-r-10,badgeRadius=Math.max(11,6/camera.zoom);
 ctx.fillStyle='#172b24';ctx.strokeStyle=style.color;ctx.lineWidth=2/camera.zoom;
 ctx.beginPath();ctx.arc(x,y,badgeRadius,0,Math.PI*2);ctx.fill();ctx.stroke();
 ctx.fillStyle=style.color;ctx.font='bold '+Math.max(13,9/camera.zoom)+'px system-ui';
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(style.icon,x,y+.5/camera.zoom);
}
function drawLocations(){
 if(camera.zoom<.24){
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 44px Georgia,serif';
  for(const f of F){ctx.fillStyle=colorAlpha(f.color,.8);ctx.fillText(f.name.toUpperCase(),f.capital[0],f.capital[1]+360)}
 }
 for(const s of S){
  if(!settlementMapVisible(s,camera.zoom)||!inView(s.x,s.y,190))continue;
  const f=F[s.faction],r=settlementGlyphRadius(s);
  const isSel=selected?.type==='settlement'&&selected.id===s.id;
  if(isSel){ctx.beginPath();ctx.arc(s.x,s.y,r+19,0,6.283);ctx.strokeStyle='#ffe5a5';ctx.lineWidth=4;ctx.stroke()}
  paintSettlementMarker(ctx,s,r);
  if(s.type==='capital')drawFlag(s.x+r+3,s.y,f);
  if(s.type==='village')drawVillageSpecialty(s,r);
  if(settlementLabelVisible(s,camera.zoom)){
   const major=s.type==='capital'||s.marketTier==='hub';
   ctx.font=(major?'bold ':'600 ')+Math.max(major?23:19,(major?12:10)/camera.zoom)+'px Georgia,serif';
   ctx.textAlign='center';ctx.textBaseline='top';ctx.lineWidth=2/camera.zoom;ctx.strokeStyle='#0b1b17eb';
   ctx.strokeText(s.name,s.x,s.y+r+11);
   ctx.fillStyle=s.marketTier==='hub'?'#ffdc94':'#fff2d2';ctx.fillText(s.name,s.x,s.y+r+11);
  }
 }
 // Discoverable world locations add life between settlements.
 if(camera.zoom>.23)for(const place of W.landmarks||[]){
  if(!inView(place.x,place.y,110))continue;
  const explored=state.visitedLandmarks.includes(place.id);
  const outlaw=state.banditCamps[place.id]?.partyId!=null;
  ctx.fillStyle=outlaw?'#663d36':explored?'#53665bd9':'#4b3d2cf2';
  ctx.beginPath();ctx.arc(place.x,place.y,16,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=selected?.type==='landmark'&&selected.id===place.id?'#fff4ba':'#d5bc8ba8';
  ctx.lineWidth=3;ctx.stroke();
  ctx.fillStyle=explored?'#abb9a5':'#ffe4ad';
  ctx.font='bold 21px Georgia,serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(outlaw?'⚔':place.icon,place.x,place.y+1);
  if(camera.zoom>.51){
   ctx.textBaseline='top';ctx.font='bold 15px Georgia,serif';
   ctx.strokeStyle='#0b2118';ctx.lineWidth=4;ctx.strokeText(place.name,place.x,place.y+24);
   ctx.fillStyle='#f5e0b8';ctx.fillText(place.name,place.x,place.y+24);
  }
 }
}
function drawParties(){
 for(const p of state.parties)if(p.active&&inView(p.x,p.y,100)){
  const f=p.faction>=0?F[p.faction]:null,c=p.kind==='noble'?'#edce88':p.kind==='bandit'?'#d47d70':f.color;
  ctx.fillStyle='#0d1d18d9';ctx.beginPath();ctx.arc(p.x,p.y,15,0,6.283);ctx.fill();
  ctx.lineWidth=3;ctx.strokeStyle=c;ctx.stroke();
  if(state.followPartyId===p.id){
   ctx.strokeStyle='#ffe5a9';ctx.lineWidth=3.5;
   ctx.beginPath();ctx.arc(p.x,p.y,26,0,Math.PI*2);ctx.stroke();
  }
  ctx.fillStyle=c;
  if(p.kind==='bandit'){ctx.beginPath();ctx.moveTo(p.x,p.y-11);ctx.lineTo(p.x+10,p.y+10);ctx.lineTo(p.x-10,p.y+10);ctx.fill()}
  else if(p.kind==='noble'){
   ctx.beginPath();ctx.moveTo(p.x-10,p.y-6);ctx.lineTo(p.x-5,p.y-1);ctx.lineTo(p.x,p.y-9);
   ctx.lineTo(p.x+5,p.y-1);ctx.lineTo(p.x+10,p.y-6);ctx.lineTo(p.x+7,p.y+7);ctx.lineTo(p.x-7,p.y+7);ctx.closePath();ctx.fill();
  }
  else if(p.kind==='caravan'){ctx.fillRect(p.x-8,p.y-6,16,11);ctx.beginPath();ctx.arc(p.x-6,p.y+7,4,0,6.283);ctx.arc(p.x+6,p.y+7,4,0,6.283);ctx.fill()}
  else{ctx.beginPath();ctx.moveTo(p.x,p.y-11);ctx.lineTo(p.x+11,p.y);ctx.lineTo(p.x,p.y+11);ctx.lineTo(p.x-11,p.y);ctx.fill()}
  if(camera.zoom>.38){ctx.textAlign='center';ctx.textBaseline='top';ctx.font='bold 13px system-ui';ctx.strokeStyle='#071611';ctx.lineWidth=4;
   const label=partyMapLabel(p);
   ctx.strokeText(label,p.x,p.y+20);ctx.fillStyle='#f7ead0';ctx.fillText(label,p.x,p.y+20)}
 }
}
function drawPlayer(time){
 const p=state.player;
 if(state.path.length){ctx.strokeStyle='#fee5a5b5';ctx.lineWidth=5/camera.zoom;ctx.setLineDash([14/camera.zoom,10/camera.zoom]);ctx.beginPath();ctx.moveTo(p.x,p.y);
  for(let i=state.pathIndex;i<state.path.length;i++)ctx.lineTo(state.path[i].x,state.path[i].y);ctx.stroke();ctx.setLineDash([])}
 ctx.fillStyle='#0b1812dd';ctx.beginPath();ctx.ellipse(p.x,p.y+12,22,11,0,0,6.283);ctx.fill();
 ctx.beginPath();ctx.arc(p.x,p.y,21+Math.sin(time*.003)*2,0,6.283);ctx.fillStyle='#f0dfae30';ctx.fill();
 ctx.strokeStyle='#f9e5ad';ctx.lineWidth=3;ctx.stroke();
 ctx.fillStyle='#ead9b4';ctx.beginPath();ctx.arc(p.x,p.y-8,7.5,0,6.283);ctx.fill();
 ctx.fillStyle='#41664b';ctx.beginPath();ctx.moveTo(p.x-13,p.y+16);ctx.lineTo(p.x-8,p.y-2);ctx.lineTo(p.x+10,p.y-2);ctx.lineTo(p.x+15,p.y+16);ctx.closePath();ctx.fill();
 ctx.strokeStyle='#f1dba0';ctx.lineWidth=2;ctx.stroke();
 drawFlag(p.x+19,p.y+8,F[p.origin]);
 ctx.font='bold 18px Georgia,serif';ctx.textAlign='center';ctx.textBaseline='bottom';ctx.strokeStyle='#0b1914';ctx.lineWidth=5;
 ctx.strokeText(p.name,p.x,p.y-31);ctx.fillStyle='#ffe6ad';ctx.fillText(p.name,p.x,p.y-31);
}
function drawWorld(time){
 if(!state||$('game').classList.contains('hidden'))return;
 const ratio=Math.min(window.devicePixelRatio||1,2);
 ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,view.w,view.h);
 ctx.fillStyle='#182f30';ctx.fillRect(0,0,view.w,view.h);
 ctx.translate(view.w/2,view.h/2);ctx.scale(camera.zoom,camera.zoom);ctx.translate(-camera.x,-camera.y);
 drawLand();drawLocations();drawParties();drawPlayer(time);
}
function initMiniBase(){
 miniBase=window.UAMapPainter.mini(W);
}
function drawMini(){
 if(!state||!state.options.minimap)return;
 if(!miniBase)initMiniBase();
 const ratio=Math.min(window.devicePixelRatio||1,2),width=mini.width/ratio,height=mini.height/ratio;
 mctx.setTransform(ratio,0,0,ratio,0,0);mctx.clearRect(0,0,width,height);
 mctx.drawImage(miniBase,0,0,width,height);
 for(const f of F){const x=f.capital[0]/W.WIDTH*width,y=f.capital[1]/W.HEIGHT*height;
  mctx.fillStyle=f.color;mctx.beginPath();mctx.arc(x,y,3.1,0,6.283);mctx.fill()}
 const x=state.player.x/W.WIDTH*width,y=state.player.y/W.HEIGHT*height;
 mctx.fillStyle='#ffe49e';mctx.beginPath();mctx.arc(x,y,4.5,0,6.283);mctx.fill();
 mctx.strokeStyle='#fff5d0';mctx.lineWidth=1.5;mctx.stroke();
 const ow=view.w/camera.zoom/W.WIDTH*width,oh=view.h/camera.zoom/W.HEIGHT*height;
 mctx.strokeStyle='#f1e2bb';mctx.lineWidth=1;mctx.strokeRect(camera.x/W.WIDTH*width-ow/2,camera.y/W.HEIGHT*height-oh/2,ow,oh);
}
function currentRegion(){return F[W.tileAt(state.player.x,state.player.y).owner]||F[state.player.origin]}
function refreshUI(){
 if(!state)return;
 const p=state.player,region=currentRegion(),near=W.closestSettlement(p.x,p.y);
 const minutes=Math.floor(state.hour*60);
 $('hudDay').textContent='Day '+state.day+' · '+String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
 $('hudRegion').textContent=region.name;
 $('hudParty').textContent=rosterCount()+'/'+MAXPARTY;
 $('hudGold').textContent=p.gold.toLocaleString();
 $('hudFood').textContent=String(p.food);
 const traveling=hasTravelOrder(),running=state.waiting||traveling&&!state.pausedManual;
 const action=state.waiting?'Stop waiting':traveling?(state.pausedManual?'Resume travel':'Pause travel'):'Wait here';
 $('hudPause').textContent=(running?'⏸ ':'▶ ')+action;
 $('mobilePause').textContent=running?'Ⅱ':'▶';
 for(const id of ['hudPause','mobilePause']){
  $(id).setAttribute('aria-label',action);
  $(id).title=action;
 }
 for(const button of document.querySelectorAll('.speed-choice')){
  const active=state.waiting&&Number(button.dataset.speed)===state.waitSpeed;
  button.classList.toggle('selected',active);
  button.setAttribute('aria-pressed',String(active));
 }
 $('charName').textContent=p.name;$('charCulture').textContent='Level '+p.level+' · '+F[p.origin].name;
 $('charAvatar').textContent=F[p.origin].symbol;
 $('statGold').textContent=p.gold.toLocaleString();$('statFood').textContent=p.food;
 $('statRenown').textContent=p.renown;$('statParty').textContent=rosterCount();
 $('healthBar').style.width=p.hp+'%';$('healthLabel').textContent=p.hp+'/100';
 $('partyRoster').innerHTML=p.roster.map(g=>'<li><span>'+esc(troopName(g))+'<small> · '+F[g.faction].name+(g.wounded?' · '+g.wounded+' wounded':'')+'</small></span><b>'+g.count+'</b></li>').join('')||'<li>No soldiers</li>';
 $('statMorale').textContent=Math.round(p.morale);$('statMorale').title='Daily troop wages: '+dailyWages()+' denars. Morale falls when wages or food are short.';
 $('contractsText').innerHTML=p.activeContracts.length?p.activeContracts.map(c=>'<div class="contract-mini"><b>'+esc(c.title)+'</b><small>'+esc(c.description)+'</small></div>').join(''):'No contracts. Visit a town to find work.';
 $('questText').textContent=questText();
 $('logList').innerHTML=state.messages.slice(0,6).map(m=>'<li><b>Day '+m.day+':</b> '+esc(m.text)+'</li>').join('');
 $('mapCoordinates').textContent=near&&dist(p.x,p.y,near.x,near.y)<300?
  'Near '+near.name+' · '+region.name:region.name+' · '+Math.floor(p.x)+', '+Math.floor(p.y);
 $('travelText').textContent=state.waiting?'Waiting here · '+state.waitSpeed+'×':state.followPartyId!=null?
  (state.escortPartyId===state.followPartyId?'Escorting ':'Following ')+partyName(state.parties.find(p=>p.id===state.followPartyId))+' · updating route':
  state.path.length?(state.pausedManual?'Route ready · resume to travel':'Traveling · '+Math.max(0,state.path.length-state.pathIndex)+' route steps remaining'):
  'Tap to travel · Drag to pan · Pinch to zoom';
 $('minimapHolder').classList.toggle('hidden',!state.options.minimap);
 if(selected?.type==='party'&&state.followPartyId!=null)inspectorDirty=true;
 if(inspectorDirty)refreshInspector();
}
function restoreBanditCamps(raw,day){
 return Object.fromEntries(OUTLAW_CAMPS.map(place=>{
  const old=raw?.[place.id];
  return [place.id,{partyId:Number.isSafeInteger(old?.partyId)&&old.partyId>=68?old.partyId:null,
   nextDay:Number.isInteger(old?.nextDay)?clamp(old.nextDay,1,day+4):day}];
 }));
}
function banditCampForParty(id){
 return state&&OUTLAW_CAMPS.find(place=>state.banditCamps[place.id].partyId===id);
}
function banditCampName(place){return place.name.replace(/ Camp$/,'')}
function refreshBanditCamps(allowSpawn){
 for(const place of OUTLAW_CAMPS){
  const camp=state.banditCamps[place.id];
  if(camp.partyId!=null&&!state.parties.some(p=>p.id===camp.partyId&&p.active&&p.kind==='bandit')){
   camp.partyId=null;camp.nextDay=state.day+4;
   reportWorldEvent(place.x,place.y,place.name+' is quiet after its raiders were defeated.');
  }
  if(allowSpawn&&camp.partyId==null&&state.day>=camp.nextDay){
   const id=nextRoadPartyId();
   camp.partyId=id;
   state.parties.push({id,kind:'bandit',faction:-1,active:true,x:place.x,y:place.y,tx:place.x,ty:place.y,strength:8+place.id%6,
    path:[],pathIndex:0,targetPartyId:null,cargo:null,tradeTargetId:null});
  }
 }
}
function landmarkRole(place){
 if(OUTLAW_CAMP_NAMES.has(place.name)&&place.kind==='camp')return ['Bandit camp','This camp sends raiders after caravans on nearby roads.'];
 return {watchtower:['Watchtower','Survey the roads and locate outlaw parties.'],
  camp:['Roadside rest','Make camp here and recover while time passes.'],
  ford:['River ford','A shallow crossing gives you another way across the river.'],
  ruins:['Ruins','Search the remains for supplies and coin.'],
  grove:['Woodland grove','Search for local materials and food.'],
  shrine:['Shrine','Visit the shrine to lift the company’s morale.']}[place.kind];
}
function arriveLandmark(id){
 const place=W.landmarks[id];if(!place)return;
 state.path=[];state.pathIndex=0;state.targetSettlement=null;state.targetLandmark=null;
 state.followPartyId=null;state.escortPartyId=null;selected={type:'landmark',id};
 state.currentLandmarkId=id;inspectorDirty=true;renderLandmark(place);openModal('screenLandmark');
 refreshUI();
}
function exploreLandmark(id){
 const place=W.landmarks[id];if(!place||!state)return;
 travelTo(place.x,place.y,null,id);
}
function landmarkThreats(place,range){
 return state.parties.filter(p=>p.active&&p.kind==='bandit'&&dist(p.x,p.y,place.x,place.y)<range)
  .sort((a,b)=>dist(a.x,a.y,place.x,place.y)-dist(b.x,b.y,place.x,place.y));
}
function renderLandmark(place,scouted=false){
 const [role,description]=landmarkRole(place),visited=state.visitedLandmarks.includes(place.id);
 const camp=state.banditCamps[place.id],raiders=camp&&state.parties.find(p=>p.active&&p.id===camp.partyId);
 let detail='<p>'+esc(description)+'</p>',actions=[];
 if(camp){
  detail+='<p>'+esc(raiders?partyName(raiders)+' · '+raiders.strength+' on the roads.':'Camp cleared · quiet until at least day '+camp.nextDay+'.')+'</p>';
  if(raiders)actions.push({act:'trackOutlaws',id:raiders.id,primary:true,label:'Find the camp’s raiders'});
 }else if(place.kind==='watchtower'){
  actions.push({act:'scoutRoads',primary:true,label:'Scout the roads'});
  if(scouted){
   const sightings=landmarkThreats(place,2100),nearest=sightings[0];
   detail+='<p>'+esc(nearest?sightings.length+' outlaw '+(sightings.length===1?'party':'parties')+' in sight. Closest near '+W.closestSettlement(nearest.x,nearest.y).name+'.':
    'The roads within sight are clear of outlaws.')+'</p>';
   if(nearest)actions.push({act:'trackOutlaws',id:nearest.id,label:'Find closest outlaws'});
  }
 }else if(place.kind==='camp'){
  const rest=fieldRestPreview(),threat=landmarkThreats(place,235)[0];
  const reason=threat?'Outlaws nearby':rest.reason;
  actions.push({act:'restAtLandmark',primary:true,label:reason||'Camp · 2 provisions · 6 hours',disabled:!!reason});
 }else if(place.kind==='ford'&&W.fordCrossings.has(place.id)){
  actions.push({act:'crossFord',primary:true,label:'Cross to the other bank'});
 }
 if(!visited&&!raiders)actions.push({act:'searchLandmark',primary:!actions.length,label:place.kind==='shrine'?'Visit shrine':'Search this place'});
 if(visited)detail+='<p>You have already searched this site.</p>';
 $('landmarkName').textContent=place.name;$('landmarkType').textContent=role;
 $('landmarkDetail').innerHTML=detail;$('landmarkActions').innerHTML=renderActions(actions);
}
function searchLandmark(place){
 const id=place.id;
 if(state.visitedLandmarks.includes(id)){notify('Already explored this landmark.');return}
 state.visitedLandmarks.push(id);
 for(const c of [...state.player.activeContracts])if(c.type==='survey'&&(c.landmarkId==null||c.landmarkId===id))completeContract(c.id);
 const food=['camp','grove','ford'].includes(place.kind)?5:2;
 const gold=['ruins','watchtower','shrine'].includes(place.kind)?45:15;
 const biome=W.tileAt(place.x,place.y).kind,resource=['forest','taiga','rainforest'].includes(biome)?'timber':['mountain','hills'].includes(biome)?'iron':['desert','scrub'].includes(biome)?'salt':['steppe','grass','marsh'].includes(biome)?'grain':'tools',found=2+Math.floor(W.hash(id,state.day+71)*4);
 state.player.food+=food;state.player.gold+=gold;grantItem(resource,found);grantXP(20);
 if(place.kind==='shrine')state.player.morale=clamp(state.player.morale+8,0,100);
 log('Explored '+place.name+'. Found '+food+' provisions, '+found+' '+resource+', '+gold+' denars and gained 20 XP.');
 notify(place.name+' explored · +'+food+' food · +'+found+' '+resource+' · +'+gold+' denars · +20 XP');
 inspectorDirty=true;refreshUI();saveGame(true);renderLandmark(place);
}
function crossFord(place){
 const crossing=W.fordCrossings.get(place.id);if(!crossing)return;
 const p=state.player,first=crossing[0],last=crossing.at(-1);
 const directions=dist(p.x,p.y,first.x,first.y)<=dist(p.x,p.y,last.x,last.y)?crossing:[...crossing].reverse();
 const bank=directions[0],route=W.findPath(p.x,p.y,bank.x,bank.y);
 if(!route.length){notify('No route to the riverbank.');return}
 closeModal();
 state.path=[...route,...directions.slice(1)];state.pathIndex=0;
 focus=state.options.follow;inspectorDirty=true;refreshUI();
}
function renderActions(items){return items.map(a=>'<button class="btn'+(a.primary?' primary':'')+'" data-act="'+a.act+'"'+(a.id!==undefined?' data-id="'+a.id+'"':'')+(a.disabled?' disabled':'')+'>'+esc(a.label)+'</button>').join('')}
const smithyUI=window.UASmithyUI?.create({
 quote:smithyQuote,craft:craftSmithyWeapon,inventory:smithyInventory,equip:equipSmithyWeapon,
 process:processSmithyGear,assign:assignSmithyWeapon,resources:()=>state.player.inventory,refreshCharacter:showCharacter
});
function setTownView(name,focusTab=false){
 const tabs=[...document.querySelectorAll('.town-nav [data-town-view]:not([hidden])')],panels=[...document.querySelectorAll('[data-town-panel]')];
 if(!tabs.some(tab=>tab.dataset.townView===name))name='overview';
 for(const tab of tabs){const active=tab.dataset.townView===name;tab.setAttribute('aria-selected',active?'true':'false');tab.classList.toggle('is-active',active);tab.tabIndex=active?0:-1;if(active&&focusTab)tab.focus()}
 for(const panel of panels)panel.hidden=panel.dataset.townPanel!==name;
 if(name==='smithy')smithyUI?.showTown(state.currentTownId);
}
function townRumor(site){
 const {castleId,townId,villageId}=CORRIDORS.PILOT;
 const shipment=state.corridor.lastShipment,patrol=state.corridor.lastPatrol;
 if((site.id===townId||site.id===villageId)&&shipment&&state.day-shipment.day<=3){
  const stock=ensureMarket(S[townId]).stock.grain;
  return corridorOutcome('shipment',shipment)+' Redmarsh has '+stock+' grain in store.';
 }
 if(site.id===castleId&&patrol&&state.day-patrol.day<=3)return corridorOutcome('patrol',patrol);
 const nearby=state.parties.filter(p=>p.active&&dist(site.x,site.y,p.x,p.y)<1050)
  .sort((a,b)=>dist(site.x,site.y,a.x,a.y)-dist(site.x,site.y,b.x,b.y))[0];
 if(!nearby){const worldNews=state.diplomacy?.history?.[0];if(worldNews&&state.day-worldNews.day<=4)return 'Travelers bring word from the wider realm: '+worldNews.text;return 'The roads around '+site.name+' are quiet for now. Local traders are watching the weather and waiting for the next caravan.';}
 const nearest=W.closestSettlement(nearby.x,nearby.y)?.name||'the nearby roads';
 if(nearby.kind==='noble')return 'Travelers saw '+partyName(nearby)+' and their escort near '+nearest+'.';
 if(nearby.kind==='bandit')return 'Travelers warn that Outlaw Bandits were seen near '+nearest+'. Keep a watch on the road.';
 if(nearby.kind==='patrol')return (F[nearby.faction]?.name||'A local')+' patrol is moving near '+nearest+'.';
 return 'Merchants say a '+partyName(nearby).toLowerCase()+' passed near '+nearest+' recently.';
}
function refreshInspector(){
 if(!state||!selected){selected={type:'land'}}
 const box=$('inspectorContent');let html='';
 if(selected.type==='settlement'){
  const site=S[selected.id],f=F[site.faction],distance=Math.round(dist(state.player.x,state.player.y,site.x,site.y));
  const close=dist(state.player.x,state.player.y,site.x,site.y)<=TOWN_ENTRY_RANGE;
  const role=PLACE_ROLES.get(placeRoles,site.id);
  html='<div class="smallcaps">'+esc(role.title)+' · '+esc(f.name)+'</div><h2>'+esc(site.name)+'</h2><div class="banner-strip" style="background:'+f.color+'"></div>';
  html+='<p>'+esc(settlementRoleText(site))+'</p>';
  html+='<div class="smallcaps">'+(close?'YOU ARE AT THE GATES':'DISTANCE: '+distance+' MAP UNITS')+'</div>';
  if(close){const terms=recruitmentTerms(site);html+=renderActions([{act:'visit',id:site.id,label:'🏰 Enter settlement',primary:true},{act:'recruit',id:site.id,label:terms.access?'⚔ Recruit up to '+terms.count+' · '+terms.unit+' denars each':'⚔ Recruitment denied · outlawed',disabled:!terms.access||terms.count<1},{act:'food',id:site.id,label:'🍞 Buy provisions at local market'},{act:'rest',id:site.id,label:'🛌 Rest at an inn · 20 denars'},{act:'rumors',id:site.id,label:'📜 Ask for local rumors'}])}
  else html+=renderActions([{act:'travelSettlement',id:site.id,label:'➤ Travel to '+site.name,primary:true}]);
  html+='<p class="subtle">'+esc(role.overview)+'</p>';
 }else if(selected.type==='party'){
  const enemy=state.parties.find(p=>p.id===selected.id);
  if(!enemy||!enemy.active){selected={type:'land'};return refreshInspector()}
  const noble=state.nobleParties.get(enemy.id);
  const mission=CORRIDORS.mission(state.corridor,enemy.id);
  const label=partyName(enemy);
  html='<div class="smallcaps">'+(noble?'NOBLE ESCORT':'ROAMING PARTY')+'</div><h2>'+esc(label)+'</h2><div class="banner-strip" style="background:'+(noble?'#edce88':enemy.kind==='bandit'?'#c57966':F[enemy.faction].color)+'"></div>';
  html+='<p>Party size: <b>'+enemy.strength+'</b>. Distance: '+Math.round(dist(state.player.x,state.player.y,enemy.x,enemy.y))+' map units.</p>';
  if(noble)html+='<div class="eventbox"><b>'+esc(HOUSES[noble.houseId].name)+'</b><p>'+esc(nobleActivity(noble))+'</p>'+
   (noble.dependents?.length?'<p>With '+esc(noble.dependents.map(person=>person.name).join(', '))+'</p>':'')+'</div>';
  else if(mission)html+='<div class="eventbox"><b>'+esc(S[mission.originId].name)+' → '+esc(S[mission.destinationId].name)+'</b><p>'+
   (mission.kind==='shipment'?mission.quantity+' grain bound for Redmarsh.':'Castle guards protecting the supply road.')+'</p></div>';
  else html+='<div class="eventbox"><b>'+esc(enemy.kind==='bandit'?'Hostile raiders':'Traveling party')+'</b><p>'+
   (enemy.kind==='bandit'?'Bandits threaten the roads. Follow them to negotiate, flee, or enter a real battle.':
   (enemy.targetPartyId!=null?(enemy.kind==='patrol'?'Patrolling against nearby outlaws.':enemy.kind==='bandit'?'Hunting a merchant caravan.':'Moving between markets.'):
    'You can speak, trade or challenge this party after catching it.'))+'</p></div>';
  const nearby=dist(state.player.x,state.player.y,enemy.x,enemy.y)<=155;
  html+=renderActions([{act:'travelParty',id:enemy.id,
   label:state.followPartyId===enemy.id?'◎ Following · route updating':'➤ Follow moving party',primary:true},
   ...(mission?.kind==='shipment'?[{act:'escortConvoy',id:enemy.id,label:'Escort to Redmarsh'}]:[]),
   {act:'meetParty',id:enemy.id,label:'💬 Meet this party',disabled:!nearby}]);
 }else if(selected.type==='landmark'){
  const place=W.landmarks.find(a=>a.id===selected.id);
  if(!place){selected={type:'land'};return refreshInspector()}
  const d=Math.round(dist(state.player.x,state.player.y,place.x,place.y));
  const [role,description]=landmarkRole(place);
  html='<div class="smallcaps">'+esc(role)+' · '+esc(W.factions[place.faction]?.name||'Wilderness')+'</div>'+
   '<h2>'+esc(place.icon)+' '+esc(place.name)+'</h2>'+
   '<div class="banner-strip" style="background:#bda66f"></div>'+
   '<p>'+esc(description)+' · '+d+' map units</p>';
  const close=dist(state.player.x,state.player.y,place.x,place.y)<=LANDMARK_RANGE;
  html+=renderActions([{act:'travelLandmark',id:place.id,label:close?'Open '+role.toLowerCase():'➤ Travel to '+place.name,primary:true}]);
 }else{
  const p=state.player,land=W.tileAt(p.x,p.y),region=currentRegion();
  html='<div class="smallcaps">EXPLORING ASTERRA</div><h2>'+esc(region.name)+'</h2><div class="banner-strip" style="background:'+region.color+'"></div>';
  const biomeNames={taiga:'northern evergreen forest',tundra:'windy tundra',
   rainforest:'humid southern forest',scrub:'arid scrubland',
   steppe:'open grass steppe',desert:'sun-baked desert',
   forest:'temperate woodland',hills:'rolling highland',
   mountain:'mountain range',marsh:'wetland',river:'river crossing',
   snow:'snow-covered land',grass:'fertile grassland',sea:'coastal water'};
  html+='<p>'+esc(region.trait)+'. The landscape here is '+esc(biomeNames[land.kind]||land.kind)+
   ', shaped by a north-to-south climate and local rainfall.</p>';
  html+='<div class="eventbox"><b>Current objective</b><p>'+esc(questText())+'</p></div>';
  html+=renderActions([{act:'nearest',label:'➤ Find nearest settlement',primary:true},{act:'partyPanel',label:'⚔ Review your army'},{act:'factions',label:'🛡 Explore 10 factions'}]);
 }
 box.innerHTML=html;inspectorDirty=false;
}
// World Atlas is accessible before creating a character. It uses the exact
// live map renderer, not a separately illustrated or hand-edited map.
const atlasCanvas=$('atlasCanvas'),atlasCtx=atlasCanvas.getContext('2d');
let atlasView={w:940,h:570},atlasCam={x:W.WIDTH/2,y:W.HEIGHT/2,zoom:.07},atlasDrag=null;
function resetAtlas(){
 const rect=atlasCanvas.getBoundingClientRect();
 atlasView={w:Math.max(1,rect.width),h:Math.max(1,rect.height)};
 atlasCam.x=W.WIDTH/2;atlasCam.y=W.HEIGHT/2;
 atlasCam.zoom=Math.min(atlasView.w/W.WIDTH,atlasView.h/W.HEIGHT)*.94;
 drawAtlas();
}
function drawAtlas(){
 if($('screenAtlas').classList.contains('hidden'))return;
 const rect=atlasCanvas.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);
 atlasView={w:Math.max(1,rect.width),h:Math.max(1,rect.height)};
 const sw=Math.ceil(atlasView.w*dpr),sh=Math.ceil(atlasView.h*dpr);
 if(atlasCanvas.width!==sw||atlasCanvas.height!==sh){atlasCanvas.width=sw;atlasCanvas.height=sh}
 atlasCtx.setTransform(dpr,0,0,dpr,0,0);
 atlasCtx.clearRect(0,0,atlasView.w,atlasView.h);
 atlasCtx.fillStyle='#294c59';atlasCtx.fillRect(0,0,atlasView.w,atlasView.h);
 atlasCtx.translate(atlasView.w/2,atlasView.h/2);
 atlasCtx.scale(atlasCam.zoom,atlasCam.zoom);
 atlasCtx.translate(-atlasCam.x,-atlasCam.y);
 window.UAMapPainter.draw(atlasCtx,W,atlasCam,atlasView,{borders:true,roads:true});
 for(const site of S){
  if(site.type==='capital'||!settlementMapVisible(site,atlasCam.zoom))continue;
  const radius=Math.max(settlementGlyphRadius(site),site.marketTier==='hub'?3/atlasCam.zoom:0);
  paintSettlementMarker(atlasCtx,site,radius);
 }
 for(const f of F){
  const x=f.capital[0],y=f.capital[1];
  atlasCtx.fillStyle='#13241b';atlasCtx.beginPath();atlasCtx.arc(x,y,54,0,Math.PI*2);atlasCtx.fill();
  atlasCtx.strokeStyle=f.color;atlasCtx.lineWidth=14;atlasCtx.stroke();
  atlasCtx.fillStyle='#f3e0ab';atlasCtx.beginPath();atlasCtx.arc(x,y,18,0,Math.PI*2);atlasCtx.fill();
  atlasCtx.font='bold 153px Georgia,serif';atlasCtx.textAlign='center';atlasCtx.textBaseline='top';
  atlasCtx.lineWidth=15;atlasCtx.strokeStyle='#11231ddd';
  atlasCtx.strokeText(f.name,x,y+65);atlasCtx.fillStyle='#f6e7bf';atlasCtx.fillText(f.name,x,y+65);
 }
}
function atlasZoom(mult,clientX,clientY){
 const w=atlasView.w,h=atlasView.h;
 const x=clientX===undefined?w/2:clientX,y=clientY===undefined?h/2:clientY;
 const wx=atlasCam.x+(x-w/2)/atlasCam.zoom,wy=atlasCam.y+(y-h/2)/atlasCam.zoom;
 const minZoom=Math.min(w/W.WIDTH,h/W.HEIGHT)*.8;
 atlasCam.zoom=clamp(atlasCam.zoom*mult,minZoom,1.1);
 atlasCam.x=clamp(wx-(x-w/2)/atlasCam.zoom,0,W.WIDTH);
 atlasCam.y=clamp(wy-(y-h/2)/atlasCam.zoom,0,W.HEIGHT);
 drawAtlas();
}
function openAtlas(){
 openModal('screenAtlas');resetAtlas();
}
atlasCanvas.addEventListener('pointerdown',e=>{
 atlasCanvas.setPointerCapture(e.pointerId);
 atlasDrag={startX:e.clientX,startY:e.clientY,x:atlasCam.x,y:atlasCam.y};
});
atlasCanvas.addEventListener('pointermove',e=>{
 if(!atlasDrag)return;
 atlasCam.x=clamp(atlasDrag.x-(e.clientX-atlasDrag.startX)/atlasCam.zoom,0,W.WIDTH);
 atlasCam.y=clamp(atlasDrag.y-(e.clientY-atlasDrag.startY)/atlasCam.zoom,0,W.HEIGHT);
 drawAtlas();
});
atlasCanvas.addEventListener('pointerup',()=>atlasDrag=null);
atlasCanvas.addEventListener('pointercancel',()=>atlasDrag=null);
atlasCanvas.addEventListener('wheel',e=>{
 e.preventDefault();const r=atlasCanvas.getBoundingClientRect();
 atlasZoom(e.deltaY<0?1.18:1/1.18,e.clientX-r.left,e.clientY-r.top);
},{passive:false});
function factionDiplomacyLabel(id){
 if(!state?.diplomacy)return 'Peace · new campaigns begin here';
 const wars=state.diplomacy.wars.filter(w=>w.a===id||w.b===id).map(w=>F[w.a===id?w.b:w.a].name);
 const allies=state.diplomacy.alliances.filter(w=>w.a===id||w.b===id).map(w=>F[w.a===id?w.b:w.a].name);
 const heat=state.diplomacy.tension[id].reduce((n,value,index)=>n+(index===id?0:value),0)/Math.max(1,F.length-1);
 return wars.length?'At war with '+wars.join(', '):allies.length?'Allied with '+allies.join(', '):heat>=40?'In a rivalry':heat>=18?'Tense peace':'At peace';
}
function showFactionDetails(id){
 selectedFaction=id;const f=F[id],standing=state?.player.reputation[id]||0;
 document.querySelectorAll('[data-faction]').forEach(b=>b.classList.toggle('selected',Number(b.dataset.faction)===id));
 const relations=F.filter(other=>other.id!==id).map(other=>({other,value:factionRelation(id,other.id),war:factionsAtWar(id,other.id),ally:factionsAllied(id,other.id),tension:factionTension(id,other.id)}))
  .sort((a,b)=>b.value-a.value);
 const current=state?factionDiplomacyLabel(id):'Peace · new campaigns begin in peace';
 const recent=state?.diplomacy.history.slice(0,4)||[];
 const relationList=relations.map(r=>'<span class="diplomacy-chip '+(r.war?'war':r.ally?'ally':r.tension>=40?'rivalry':r.tension>=18?'tense':'peace')+'"><b>'+esc(r.other.name)+'</b> '+(r.war?'⚔ War':r.ally?'◆ Ally':r.tension>=40?'Rivalry':r.tension>=18?'Tense':'Peace')+' · '+r.value+'</span>').join('');
 const news=recent.length?recent.map(e=>'<li><b>Day '+e.day+'</b> · '+esc(e.text)+'</li>').join(''):'<li>Trade ties and border incidents will emerge as your campaign advances.</li>';
 const finances=new Map((state?.nobleHouses.houses||[]).map(house=>[house.houseId,house]));
 const houses=HOUSES.filter(h=>h.faction===id).map(h=>{
  const noble=nobleByHouse(h.id),family=houseFamily(h.id);
  const economy=finances.get(h.id);
  const retinueSize=economy?.retinues.reduce((sum,retinue)=>sum+retinue.strength,0);
  const holdings=economy?.holdings.filter(id=>id!==h.seatId).map(id=>{
   const site=S[id],resource=ITEMS[site.specialty]?.name;
   return '<li>'+esc(site.name+(resource?' · '+resource:''))+'</li>';
  }).join('');
  return '<article class="house-card"><b>'+esc(h.name)+'</b><small>'+esc(houseLeader(h))+' · '+esc(S[h.seatId].name)+'</small>'+
   (noble?'<small>'+esc(nobleActivity(noble))+'</small>':'')+
   (state?'<small>'+houseFavor(h)+' / 16 favor to recruit retainers</small>':'')+
   (economy?'<small>'+economy.treasury.toLocaleString()+' denars · '+retinueSize+' in household retinues</small>':'')+
   (holdings?'<details class="house-family"><summary>Holdings · '+(economy.holdings.length-1)+'</summary><ul>'+holdings+'</ul></details>':'')+
   (family.length?'<details class="house-family"><summary>Family · '+family.length+'</summary>'+familyTreeMarkup(family,'find')+'</details>':'')+'</article>';
 }).join('');
 const troops=f.troops.map((name,tier)=>'<div><small>Tier '+(tier+1)+'</small><b>'+esc(name)+'</b><small>'+esc(loadoutDescription(kingdomLoadout(id,tier)))+'</small></div>').join('');
 const branches=ARMORY.branchSlots(id).filter(slot=>slot.tier===1);
 const paths=branches.length?'<div class="smallcaps">VALDORIAN PROMOTION PATHS</div><div class="trooptree">'+
  branches.map(({name,tier,unitId})=>{
   const branch=ARMORY.getBranch(id,tier,unitId),veteran=ARMORY.getBranch(id,2,branch.next);
   return '<div><small>'+esc(unitId==='val-retainer'?'House recruitment':f.troops[0])+'</small><b>'+esc(name)+'</b><small>→ '+esc(veteran.name)+'</small></div>';
  }).join('')+'</div>':'';
 $('factionDetail').innerHTML='<h3><span style="color:'+f.color+'">'+esc(f.symbol)+'</span> '+esc(f.name)+'</h3>'+
  '<p>'+esc(f.culture)+'. '+esc(f.trait)+'.</p><div class="smallcaps">NOBLE HOUSES</div><div class="house-list">'+houses+'</div>'+
  '<div class="smallcaps">STANDARD TROOP LOADOUTS</div><div class="trooptree">'+troops+'</div>'+paths+
  '<div class="diplomacy-board"><b>Foreign affairs · '+esc(current)+'</b><div class="diplomacy-relations">'+relationList+
  '</div><details><summary>Recent world news</summary><ul>'+news+'</ul></details></div>'+
  '<p><b>Your standing:</b> '+standingLabel(standing)+' ('+(standing>0?'+':'')+standing+')</p>';
}
function openFactions(){
 $('factionGrid').innerHTML=F.map(f=>'<button class="faction-card" data-faction="'+f.id+'"><span class="faction-flag" style="background:'+f.color+'">'+esc(f.symbol)+'</span><span><strong>'+esc(f.name)+'</strong><small>'+esc(f.culture)+'</small><small>'+esc(f.trait)+'</small><small class="faction-peace">'+esc(factionDiplomacyLabel(f.id))+'</small></span></button>').join('');
 openModal('screenFactions');showFactionDetails(selectedFaction);
}
function findFamilyMember(id){
 const person=state?.people?.get(id);
 if(!person)return;
 const noble=nobleForPerson(id),party=noble?.party,site=S[personSite(person)];
 const position=party?.active?party:site;
 if(!position)return;
 modalStack=[];showScreen(null);
 selected=party?.active?{type:'party',id:party.id}:{type:'settlement',id:site.id};
 camera.x=position.x;camera.y=position.y;focus=false;lastMini=0;inspectorDirty=true;
 $('sidebar').classList.add('mobile-hide');$('inspector').classList.remove('mobile-hide');
 refreshInspector();refreshUI();
}
function quantityChoices(kind,id){
 if(kind==='promote')return promotionOptions(id).map(option=>({
  ...option,detail:loadoutDescription(option.loadout)||ARMORY.roles[option.role]?.label||option.role||''
 }));
 const site=S[id],terms=recruitmentTerms(site);
 const reason=!terms.access?'Recruitment denied while outlawed.':
  !terms.available?(rosterCount()>=MAXPARTY?'Your company is full.':'No volunteers are available.'):'You cannot afford a recruit.';
 return [{id:'volunteers',name:F[site.faction].troops[0],max:terms.max,unitCost:terms.unit,wageChange:terms.dailyWage,
  detail:loadoutDescription(kingdomLoadout(site.faction,0)),reason}];
}
function quantityQuote(choice,amount,action){
 const valid=Number.isInteger(amount)&&amount>=1&&amount<=choice.max;
 const total=valid?choice.unitCost*amount:0;
 const currentWages=dailyWages(),newWages=dailyWages(valid?choice.wageChange*amount:0);
 const wageDelta=newWages-currentWages;
 const detail=!choice.max?(choice.reason||'No troops are eligible.'):
  !valid?'Choose a whole number from 1 to '+choice.max+'.':
  'Wages '+(wageDelta>=0?'+':'')+wageDelta+' per day · '+newWages+' total';
 return {valid,detail,label:valid?action+' '+amount+' · '+total+' denars':action};
}
function renderQuantityAction(kind,id){
 const choices=quantityChoices(kind,id);
 if(!choices.length)return'';
 const choice=choices.find(option=>option.max>0)||choices[0];
 const count=choice.max>0?1:0,action=kind==='recruit'?'Recruit':'Promote';
 const quote=quantityQuote(choice,count,action);
 const key=kind+'-qty-'+id;
 const destSelect=choices.length>1?'<label for="'+key+'-path">Promotion destination<select id="'+key+'-path" data-quantity-choice>'+
  choices.map(option=>'<option value="'+esc(option.id)+'"'+(option.id===choice.id?' selected':'')+'>'+esc(option.name)+'</option>').join('')+'</select></label>':
  '<b class="quantity-title">'+(kind==='promote'?'Promote to ':'')+esc(choice.name)+'</b>';
 return '<div class="quantity-action" data-quantity-kind="'+kind+'" data-quantity-id="'+id+'" data-default-choice="'+esc(choice.id)+'">'+
  '<div>'+destSelect+'<small class="quantity-meta" data-quantity-details>'+esc(choice.detail)+'</small></div>'+
  '<div><label for="'+key+'">Quantity</label><div class="quantity-controls">'+
  '<button type="button" class="btn" data-quantity-step="-1" aria-label="Decrease quantity" disabled>−</button>'+
  '<input class="quantity-value" id="'+key+'" data-quantity-input type="number" inputmode="numeric" step="1" min="1" max="'+Math.max(1,choice.max)+'" value="'+count+'"'+(!choice.max?' disabled':'')+'>'+
  '<button type="button" class="btn" data-quantity-step="1" aria-label="Increase quantity"'+(choice.max<=1?' disabled':'')+'>+</button></div></div>'+
  '<output class="quantity-quote" data-quantity-quote aria-live="polite">'+esc(quote.detail)+'</output>'+
  '<button type="button" class="btn primary quantity-confirm" data-quantity-confirm'+(!quote.valid?' disabled':'')+'>'+esc(quote.label)+'</button></div>';
}
function quantityControls(panel){
 const {quantityKind:kind,quantityId,defaultChoice}=panel.dataset,id=Number(quantityId);
 const dropdown=panel.querySelector('[data-quantity-choice]');
 const choices=quantityChoices(kind,id);
 const choice=choices.find(option=>option.id===(dropdown?.value??defaultChoice))||choices[0];
 return {kind,id,choice,input:panel.querySelector('[data-quantity-input]'),action:kind==='recruit'?'Recruit':'Promote'};
}
function updateQuantityAction(panel,resetAmount=false){
 const {input,choice,action}=quantityControls(panel);
 if(!choice)return;
 const max=choice.max;
 input.max=String(Math.max(1,max));
 input.disabled=max<1;
 if(resetAmount)input.value=String(max>0?clamp(Math.floor(Number(input.value)||1),1,max):0);
 const amount=Number(input.value);
 const quote=quantityQuote(choice,amount,action);
 const confirm=panel.querySelector('[data-quantity-confirm]');
 confirm.disabled=!quote.valid;confirm.textContent=quote.label;
 panel.querySelector('[data-quantity-step="-1"]').disabled=max<1||amount<=1;
 panel.querySelector('[data-quantity-step="1"]').disabled=max<1||amount>=max;
 panel.querySelector('[data-quantity-details]').textContent=choice.detail;
 panel.querySelector('[data-quantity-quote]').textContent=quote.detail;
}
function companyStat(value,label){
 return '<div class="company-stat"><b>'+esc(value)+'</b><small>'+esc(label)+'</small></div>';
}
function showParty(){
 if(!state)return;
 const p=state.player,groups=p.roster.map(partyGroupStatus),recovery=fieldRestPreview();
 const healthy=groups.reduce((total,group)=>total+group.healthy,0);
 const wounded=groups.reduce((total,group)=>total+group.wounded,0);
 const readiness='<div class="company-summary">'+
  companyStat(healthy,'Battle ready')+companyStat(wounded,'Wounded')+
  companyStat(rosterCount()+' / '+MAXPARTY,'Company spaces')+companyStat(dailyWages()+' denars','Daily wages')+'</div>';
 const rest='<div class="quantity-action"><div><b class="quantity-title">Field rest</b><small class="quantity-meta">'+
  (recovery.reason?esc(recovery.reason):'Recover '+recovery.heroHeal+' hero health · '+recovery.hours+' hours · '+recovery.provisions+' provisions')+
  '</small></div><button type="button" class="btn quantity-confirm" data-field-rest'+(recovery.reason?' disabled':'')+'>Rest in the field</button></div>';
 const cards=p.roster.map((group,index)=>{
  const {healthy,wounded,ready,trainingNeeded,closestTraining}=groups[index];
  const pendingTraining=healthy>ready?' · Best progress '+closestTraining+' / '+trainingNeeded:'';
  const training=group.tier>=2?'Elite rank':ready+' ready to promote'+pendingTraining;
  const loadout=kingdomLoadout(group.faction,group.tier,group.unitId);
  return '<article class="eventbox company-roster-card" data-company-group="'+index+'"><header>'+
   '<b tabindex="-1" data-company-group-heading>'+group.count+' × '+esc(troopName(group))+'</b>'+
   '<small class="quantity-meta">'+healthy+' fit · '+wounded+' wounded</small></header>'+
   '<p>'+esc(loadoutDescription(loadout))+'</p><p>'+esc(training)+'</p>'+
   renderQuantityAction('promote',index)+
   '<div class="party-kit-actions"><button type="button" class="btn" data-edit-kit="'+index+'">⚒ Design weapon</button></div></article>';
 }).join('');
 $('partyModalContent').innerHTML=readiness+rest+(cards||'<p>No troops in your company.</p>');
 $('partyPrisonerNotice').textContent='';renderPrisoners();
 openModal('screenParty');
}
function loadoutDescription(loadout){
 if(!loadout)return '';
 return [ARMORY.roles[loadout.role].label,loadout.weaponName,loadout.sidearmName?loadout.sidearmName+' sidearm':'',
  loadout.armor+' armor',loadout.shield?loadout.shield+' shield':''].filter(Boolean).join(' · ');
}
function selectedArmorySlot(){
 const [tier,unitId]=$('armoryTier').value.split(':');
 return {faction:Number($('armoryFaction').value),tier:Number(tier),unitId};
}
function armoryDraft(){
 return {weaponId:$('armoryWeapon').value,style:$('armoryStyle').value,name:$('armoryName').value};
}
function previewArmory(){
 const {faction,tier,unitId}=selectedArmorySlot(),loadout=ARMORY.getLoadout(faction,tier,armoryDraft(),unitId);
 if(!loadout)return;
 const stats=loadout.stats;
 $('armoryPreview').innerHTML='<small>'+esc(loadout.name)+'</small><h3>'+esc(loadout.weaponName)+'</h3>'+
  '<p>'+esc(loadoutDescription(loadout))+'</p><dl><dt>Damage</dt><dd>'+Math.round(stats.weaponDamage*100)+
  '%</dd><dt>Attack speed</dt><dd>'+Math.round(stats.weaponSpeed*100)+'%</dd></dl>';
}
function loadArmorySlot(selection=$('armoryTier').value){
 const faction=Number($('armoryFaction').value);
 const slots=F[faction].troops.map((name,tier)=>({name,tier})).concat(ARMORY.branchSlots(faction));
 const value=({tier,unitId})=>String(tier)+(unitId?':'+unitId:'');
 $('armoryTier').innerHTML=slots.map(slot=>'<option value="'+value(slot)+'">'+esc(slot.name)+'</option>').join('');
 $('armoryTier').value=slots.some(slot=>value(slot)===String(selection))?String(selection):'0';
 const {tier,unitId}=selectedArmorySlot(),standard=ARMORY.getLoadout(faction,tier,null,unitId);
 const saved=state.player.armory[ARMORY.designKey(faction,tier,unitId)];
 $('armoryWeapon').innerHTML=ARMORY.allowedWeapons(faction,tier,unitId).map(id=>'<option value="'+id+'">'+esc(ARMORY.weapons[id].label)+'</option>').join('');
 $('armoryWeapon').value=saved?.weaponId||standard.weaponId;
 $('armoryStyle').value=saved?.style||'balanced';
 $('armoryName').value=saved?.name||'';
 const key=ARMORY.designKey(faction,tier,unitId);
 $('armoryReset').disabled=!saved&&!state.player.forge.troops[key]&&!state.player.forge.rangedTroops[key];
 previewArmory();
}
function openArmory(group=state?.player.roster[0]){
 if(!state)return;
 $('armoryFaction').innerHTML=F.map(f=>'<option value="'+f.id+'">'+esc(f.name)+'</option>').join('');
 $('armoryFaction').value=String(group?.faction??state.player.origin);
 $('armoryStyle').innerHTML=Object.entries(ARMORY.styles).map(([id,style])=>'<option value="'+id+'">'+style.label+'</option>').join('');
 loadArmorySlot(group?.unitId?group.tier+':'+group.unitId:String(group?.tier||0));
 openModal('screenArmory');
}
function generateWeapon(){
 const {faction,tier,unitId}=selectedArmorySlot();
 const options=ARMORY.allowedWeapons(faction,tier,unitId),styles=Object.keys(ARMORY.styles);
 const pick=list=>list[Math.floor(Math.random()*list.length)];
 const weapon=pick(options);
 $('armoryWeapon').value=weapon;
 $('armoryStyle').value=pick(styles);
 $('armoryName').value=pick(['Dawn','Iron','Storm','Ash','Silver'])+' '+ARMORY.weapons[weapon].label;
 previewArmory();
}
function assignWeapon(reset=false){
 const {faction,tier,unitId}=selectedArmorySlot(),key=ARMORY.designKey(faction,tier,unitId),player=state.player;
 const previous=player.armory[key],previousForge=player.forge.troops[key],previousBow=player.forge.rangedTroops[key];
 const design=ARMORY.normalizeDesign(faction,tier,armoryDraft(),unitId);
 if(reset)delete player.armory[key];
 else if(design)player.armory[key]=design;
 else return;
 delete player.forge.troops[key];
 delete player.forge.rangedTroops[key];
 if(!saveGame(true)){
  if(previous)player.armory[key]=previous;
  else delete player.armory[key];
  if(previousForge)player.forge.troops[key]=previousForge;
  if(previousBow)player.forge.rangedTroops[key]=previousBow;
  notify('Could not save the troop weapon.');return;
 }
 loadArmorySlot();
 notify(reset?'Standard weapon restored.':'Assigned '+design.name+' to '+troopName({faction,tier,unitId})+'.');
}
function showCharacter(){
 if(!state)return;const p=state.player,f=F[p.origin];
 const portrait=CHAR_UI?.portraitMarkup?.({...p.appearance,age:p.age},p.name+' portrait')||'<div class="hero-icon">'+esc(f.symbol)+'</div>';
 const stats=Object.entries({strength:'Strength',agility:'Agility',tactics:'Tactics',leadership:'Leadership'}).map(([key,label])=>'<div class="attribute"><b>'+label+'</b><strong>'+p.stats[key]+'</strong><button class="btn small" data-stat="'+key+'" '+(p.statPoints?'':'disabled')+'>＋</button></div>').join('');
 const forged=currentForgedWeapon();
 const usesBow=(forged?forged.category==='bow':p.equipment.weapon==='bow');
 const bowStatus=usesBow?(p.equipment.quiver!=='quiver'?'Equip an arrow quiver':p.inventory.arrows>0?p.inventory.arrows+' arrows':'Out of arrows'):'';
 const slots=Object.entries(ITEM_SLOT_LABELS).map(([key,label])=>{
  const item=key==='weapon'&&forged?{name:forged.name,icon:'⚒'}:ITEMS[p.equipment[key]];
  return '<div class="gear-slot"><small>'+label+'</small><b>'+(item?.icon||'—')+' '+esc(item?.name||'Empty')+'</b>'+
   (key==='weapon'&&bowStatus?'<small>'+esc(bowStatus)+'</small>':'')+'</div>';
 }).join('');
 const inventory=Object.entries({...p.inventory,food:p.food}).filter(([,count])=>count>0).map(([id,count])=>{
  const item=ITEMS[id];if(!item)return'';
  const equippable=item.slot&&!item.lootOnly;
  let detail=item.lootOnly?'Sell or salvage at a smithy':'';
  if(equippable){
   if(item.slot==='quiver')detail='Choose your ammo type';
   else if(!(item.slot==='weapon'&&forged)){
    const delta=item.rating-(ITEMS[p.equipment[item.slot]]?.rating||0);
    detail=delta>0?'Better by '+delta:delta<0?'Lower by '+Math.abs(delta):'Similar rating';
   }
  }
  return '<div class="inventory-item"><span>'+item.icon+' '+esc(item.name)+' <small>×'+count+
   (detail?' · '+esc(detail):'')+'</small></span>'+
   (equippable?'<button class="btn small" type="button" data-equip="'+id+'">Equip</button>':'')+'</div>';
 }).join('')||'<p class="subtle">Your pack is empty.</p>';
 const perkChoices=Object.entries(PERKS).map(([id,perk])=>'<article class="perk-card"><div><b>'+perk.icon+' '+esc(perk.name)+'</b><small>'+esc(perk.description)+'</small></div><button class="btn small" data-perk="'+id+'" '+(p.perkPoints<1||p.perks.includes(id)?'disabled':'')+'>'+(p.perks.includes(id)?'Learned':'Learn')+'</button></article>').join('');
 const learned=p.perks.length?p.perks.map(id=>'<span class="statuspill">'+PERKS[id].icon+' '+esc(PERKS[id].name)+'</span>').join(' '):'<p class="subtle">Choose a perk when you earn a perk point. One is granted every three levels.</p>';
 $('characterModalContent').innerHTML='<div class="hero-card">'+portrait+'<div class="hero-name">'+esc(p.name)+'</div><div class="hero-sub">Age '+p.age+' · '+esc(f.culture)+' · '+esc(p.background)+'</div><div class="statgrid"><div class="stat"><div class="stat-label">Level</div><div class="stat-value">'+p.level+'</div></div><div class="stat"><div class="stat-label">Experience</div><div class="stat-value">'+p.xp+'/'+(p.level*125)+'</div></div><div class="stat"><div class="stat-label">Renown</div><div class="stat-value">'+p.renown+'</div></div><div class="stat"><div class="stat-label">Health</div><div class="stat-value">'+p.hp+'%</div></div><div class="stat"><div class="stat-label">Company morale</div><div class="stat-value">'+Math.round(p.morale)+'/100</div></div></div></div><div class="section-caption">CHARACTER ATTRIBUTES · '+p.statPoints+' POINTS</div><div class="attributes">'+stats+'</div><div class="section-caption">PERKS · '+p.perkPoints+' POINTS · '+p.perks.length+' LEARNED</div><div class="perk-list">'+learned+perkChoices+'</div><div class="section-caption">EQUIPPED GEAR</div><div class="gear-slots">'+slots+'</div><div class="section-caption">INVENTORY</div><div class="inventory-list">'+inventory+'</div><p class="subtle">Gear ratings compare equipment within its slot. Bow attacks need arrows; a stone pouch enables manual rock throws.</p>';
 smithyUI?.showCharacter();
 openModal('screenCharacter');
}
function showOptions(){
 const o=state?state.options:settingsDefault;
 $('optBorders').checked=o.borders;$('optLabels').checked=o.labels;
 $('optRoads').checked=o.roads;$('optMinimap').checked=o.minimap;$('optFollow').checked=o.follow;
 openModal('screenOptions');
}
function saveOptions(){
 const changed={borders:$('optBorders').checked,labels:$('optLabels').checked,
  roads:$('optRoads').checked,minimap:$('optMinimap').checked,follow:$('optFollow').checked};
 Object.assign(settingsDefault,changed);
 try{localStorage.setItem('ua-settings-v1',JSON.stringify(settingsDefault))}catch(e){}
 if(state){state.options={...changed};saveGame(true);inspectorDirty=true}
 closeModal();refreshUI();
}
function validateSave(raw){
 return !!raw&&raw.version===VERSION&&raw.player&&typeof raw.player.name==='string'&&
  Number.isFinite(raw.player.x)&&Number.isFinite(raw.player.y)&&Number.isFinite(raw.player.gold)&&
  Number.isInteger(raw.player.origin)&&raw.player.origin>=0&&raw.player.origin<F.length&&
  Array.isArray(raw.player.roster)&&raw.player.roster.every(g=>g&&Number.isInteger(g.faction)&&g.faction>=0&&g.faction<F.length&&
   Number.isInteger(g.tier)&&g.tier>=0&&g.tier<=2&&Number.isFinite(g.count)&&g.count>=0);
}
function applySaveImport(raw,label){
 if(!validateSave(raw)){notify('That file is not a valid Untitled Armies campaign save.');return false}
 const previousState=state,previousSelection=selected,previousCamera={...camera},previousFocus=focus;
 const previousScreen=screens.find(id=>!$(id).classList.contains('hidden'))||null;
 const previousStack=modalStack;
 const wasGameHidden=$('game').classList.contains('hidden');
 const previousSettlements=S.map(site=>({prosperity:site.prosperity,garrison:site.garrison}));
 let previousSave,previousBackup;
 try{
  previousSave=localStorage.getItem(KEY);
  previousBackup=localStorage.getItem(KEY+'-backup-1');
  localStorage.setItem(KEY,JSON.stringify(raw));
 }catch(e){notify('Could not import the save. Check available device storage.');return false}
 if(!loadGame()){
  try{
   if(previousSave===null)localStorage.removeItem(KEY);
   else localStorage.setItem(KEY,previousSave);
  }catch(e){notify('Could not restore the saved file. Check available device storage.')}
  state=previousState;selected=previousSelection;camera=previousCamera;focus=previousFocus;
  modalStack=previousStack;restoreSettlementState(previousSettlements);
  $('game').classList.toggle('hidden',wasGameHidden);
  showScreen(previousScreen);resize();inspectorDirty=true;
  if(state)refreshUI();
  refreshContinue();
  return false;
 }
 if(previousSave){
  try{
   localStorage.setItem(KEY+'-backup-2',previousBackup||previousSave);
   localStorage.setItem(KEY+'-backup-1',previousSave);
  }catch(e){}
 }
 refreshContinue();notify(label+' loaded.');return true;
}
function exportSave(){
 if(state)saveGame(true);
 let raw;try{raw=localStorage.getItem(KEY)}catch(e){}
 if(!raw){notify('There is no campaign save to export yet.');return}
 const blob=new Blob([raw],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='untitled-armies-campaign.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 notify('Campaign save exported to your device.');
}
function restoreBackup(slot){
 let raw;try{raw=JSON.parse(localStorage.getItem(KEY+'-backup-'+slot)||'null')}catch(e){}
 if(!raw){notify(slot===1?'No previous save is available yet.':'No older backup is available yet.');return}
 applySaveImport(raw,'Backup');
}
function importSaveFile(){ $('importSaveFile').click() }
function readImportFile(file){
 if(!file)return;const reader=new FileReader();reader.onload=()=>{try{applySaveImport(JSON.parse(reader.result),'Campaign save')}catch(e){notify('Could not read that campaign save file.')}};
 reader.onerror=()=>notify('Could not read that file.');reader.readAsText(file);
}
function button(id,action){$(id).addEventListener('click',action)}
function lockLandscape(){try{if(screen.orientation?.lock)screen.orientation.lock('landscape').catch(()=>{})}catch(e){}}
function fullscreenActive(){return !!(document.fullscreenElement||document.webkitFullscreenElement)}
function syncFullscreen(){
 const active=fullscreenActive(),label=active?'Exit fullscreen':'Enter fullscreen';
 $('menuFullscreen').textContent=active?'↙ Exit fullscreen':'⛶ Fullscreen';
 $('mapFullscreen').textContent=active?'↙':'⛶';
 for(const id of ['menuFullscreen','mapFullscreen']){
  const control=$(id);
  control.setAttribute('aria-pressed',String(active));
  control.setAttribute('aria-label',label);
  control.title=label;
 }
}
async function toggleFullscreen(){
 try{
  if(fullscreenActive()){
   const stop=document.exitFullscreen||document.webkitExitFullscreen;
   if(!stop)throw Error('Fullscreen exit unavailable');
   await stop.call(document);
  }else{
   const root=document.documentElement;
   const start=root?.requestFullscreen||root?.webkitRequestFullscreen;
   if(!start)throw Error('Fullscreen unavailable');
   await start.call(root);
   if(fullscreenActive())lockLandscape();
  }
  syncFullscreen();
 }catch(e){notify('Fullscreen is unavailable here. Try opening the game in your browser.')}
}
function aftermathInnSite(){
 const player=state?.player;
 if(!player||(player.hp>35&&!player.roster.some(group=>group.wounded)))return null;
 const town=W.closestSettlement(player.x,player.y);
 return town&&dist(player.x,player.y,town.x,town.y)<=TOWN_ENTRY_RANGE?town:null;
}
function hasTravelOrder(){return state.followPartyId!=null||state.pathIndex<state.path.length}
function stopWaiting(){state.waiting=false;state.waitSpeed=1}
function setWaitSpeed(speed){
 if(!state||menuOpen||![1,2,4].includes(speed))return;
 state.path=[];state.pathIndex=0;state.targetSettlement=null;state.targetLandmark=null;state.followPartyId=null;state.escortPartyId=null;
 keys.clear();
 state.waiting=true;state.waitSpeed=speed;state.pausedManual=false;state.paused=false;
 refreshUI();
}
function togglePause(){
 if(!state||menuOpen)return;
 if(state.waiting)stopWaiting();
 else if(hasTravelOrder()){
  state.pausedManual=!state.pausedManual;
  state.paused=state.pausedManual;
 }else{setWaitSpeed(1);return}
 refreshUI();
}
button('encounterTalk',()=>{
 const p=state?.parties.find(x=>x.id===selected?.id);if(!p)return;
 const noble=state.nobleParties.get(p.id);
 if(noble){$('encounterDialogue').textContent=personDialogue(state.people.get(noble.personId),p);return}
 const line=p.kind==='bandit'?'The outlaw chief demands coin and threatens passing villagers.':
  p.kind==='caravan'?'The merchants seek a market in '+W.closestSettlement(p.x,p.y).name+'.':
  'The patrol captain warns of raiders and trouble at the border.';
 $('encounterDialogue').innerHTML='<b>'+esc(partyName(p))+'</b><p>'+esc(line)+'</p>';
});
button('encounterNobleRoads',()=>{
 const party=state?.parties.find(x=>x.id===selected?.id&&x.active&&x.kind==='noble');
 if(party)$('encounterDialogue').textContent=personDialogue(state.people.get(party.personId),party,true);
});
$('encounterFamilyActions').addEventListener('click',event=>{
 const action=event.target.closest('[data-encounter-person]');
 const noble=state?.nobleParties.get(selected?.id);
 const person=action&&noble?.dependents?.find(person=>person.id===action.dataset.encounterPerson);
 if(person)$('encounterDialogue').textContent=personDialogue(person,noble.party);
});
button('encounterTrade',()=>{
 const party=state?.parties.find(x=>x.id===selected?.id);if(!party||party.kind==='noble')return;
 if(CORRIDORS.mission(state.corridor,party.id)?.kind==='shipment'){startEscort(party.id);return}
 if(party.kind==='caravan'){
  if(party.cargo?.resource!=='food'||party.cargo.quantity<1){$('encounterDialogue').textContent='This caravan is not carrying provisions right now.';return}
  const price=Math.max(1,Math.round(party.cargo.unitPrice||30));
  if(state.player.gold<price){$('encounterDialogue').textContent='You need '+price+' denars.';return}
  state.player.gold-=price;state.player.food+=8;if(party.faction!==state.player.origin){setFactionRelation(state.player.origin,party.faction,factionRelation(state.player.origin,party.faction)+1);setFactionTension(state.player.origin,party.faction,factionTension(state.player.origin,party.faction)-1)}party.cargo.quantity--;
  if(party.cargo.quantity<=0){party.cargo=null;party.tradeTargetId=null;party.path=[];party.pathIndex=0}
  log('Purchased eight provisions from a traveling caravan for '+price+' denars.');
  $('encounterDialogue').textContent='Trade complete: +8 provisions, -'+price+' denars.';
  saveGame(true);refreshUI();
 }else $('encounterDialogue').textContent='The captain shares news of bandits on the road.';
});
button('encounterFight',()=>{if(selected?.id!=null)skirmish(selected.id)});
button('encounterDeploy',()=>{if(selected?.id!=null)skirmish(selected.id,true)});
function leaveEncounter(){
 state.lastEncounter=state.day+state.hour/24;state.followPartyId=state.escortPartyId;
 state.path=[];state.pathIndex=0;closeModal();notify('You leave the party behind.');
}
button('encounterLeave',leaveEncounter);
button('aftermathContinue',()=>{state.followPartyId=state.escortPartyId;showScreen(null);refreshUI()});
button('aftermathInn',()=>{
 const town=aftermathInnSite();
 if(!town)return;
 showScreen(null);showTown(town.id);setTownView('inn');
});
button('menuFullscreen',toggleFullscreen);
button('mapFullscreen',toggleFullscreen);
document.addEventListener('fullscreenchange',syncFullscreen);
document.addEventListener('webkitfullscreenchange',syncFullscreen);
button('menuNew',()=>{lockLandscape();selectNew()});button('menuContinue',()=>{lockLandscape();loadGame()});
button('menuFactions',openFactions);button('menuAtlas',openAtlas);button('menuOptions',showOptions);
button('createStart',()=>{lockLandscape();startCampaign()});button('createCancel',()=>showScreen('screenMenu'));
button('landmarkClose',closeModal);
$('landmarkActions').addEventListener('click',e=>{
 const action=e.target.closest('[data-act]'),place=W.landmarks[state?.currentLandmarkId];
 if(!action||action.disabled||!place||$('screenLandmark').classList.contains('hidden')||
  dist(state.player.x,state.player.y,place.x,place.y)>LANDMARK_RANGE)return;
 switch(action.dataset.act){
  case 'scoutRoads':renderLandmark(place,true);break;
  case 'restAtLandmark':if(!landmarkThreats(place,235).length&&fieldRest())renderLandmark(place);break;
  case 'crossFord':crossFord(place);break;
  case 'searchLandmark':{
   const camp=state.banditCamps[place.id];
   if(!camp?.partyId)searchLandmark(place);
   break;
  }
  case 'trackOutlaws':{
   const party=state.parties.find(p=>p.active&&p.kind==='bandit'&&p.id===Number(action.dataset.id));
   if(party){closeModal();followParty(party.id)}
   break;
  }
 }
});
button('atlasClose',closeModal);
button('atlasZoomIn',()=>atlasZoom(1.30));
button('atlasZoomOut',()=>atlasZoom(1/1.30));
button('atlasReset',resetAtlas);
button('factionsClose',closeModal);
button('optionsClose',closeModal);
button('optionsApply',saveOptions);
button('pauseResume',()=>{state.pausedManual=false;showScreen(null)});
button('pauseSave',()=>saveGame(false));button('pauseOptions',showOptions);
button('exportSave',exportSave);button('importSave',importSaveFile);button('restoreBackup',()=>restoreBackup(1));button('restoreOlderBackup',()=>restoreBackup(2));button('menuImport',importSaveFile);
$('importSaveFile').addEventListener('change',e=>{readImportFile(e.target.files?.[0]);e.target.value=''});
button('pauseMenu',showMenu);
button('btnMenu',()=>showScreen('screenPause'));
button('btnSave',()=>saveGame(false));
button('btnParty',showParty);button('btnCharacter',showCharacter);button('btnFactions',openFactions);
function toggleMapPanel(id){
 const phone=window.matchMedia('(max-width: 770px), (orientation: landscape) and (max-width: 1024px)').matches;
 if(phone){
  const opening=!$(id).classList.toggle('mobile-hide');
  if(opening)$(id==='sidebar'?'inspector':'sidebar').classList.add('mobile-hide');
 }else $(id).classList.toggle('desktop-hide');
}
button('btnSidebar',()=>toggleMapPanel('sidebar'));
button('btnInspect',()=>toggleMapPanel('inspector'));
button('partyClose',closeModal);
button('characterClose',closeModal);
button('townLeave',closeModal);
button('btnZoomIn',()=>zoomAt(1.32));
button('btnZoomOut',()=>zoomAt(1/1.32));
button('btnCenter',()=>{resetView();notify('Camera following your character.')});
button('btnOverview',()=>{focus=false;camera.x=W.WIDTH/2;camera.y=W.HEIGHT/2;camera.zoom=.115});
document.querySelectorAll('.speed-choice').forEach(b=>b.addEventListener('click',()=>setWaitSpeed(Number(b.dataset.speed))));
button('hudPause',togglePause);button('mobilePause',togglePause);
button('mapNearest',()=>{const s=W.closestSettlement(state.player.x,state.player.y);selected={type:'settlement',id:s.id};inspectorDirty=true;refreshInspector()});
button('mapDiscover',()=>{
 if(!state)return;
 const unseen=W.landmarks.filter(v=>!state.visitedLandmarks.includes(v.id));
 const pool=unseen.length?unseen:W.landmarks;
 const nearest=pool.reduce((a,b)=>dist(state.player.x,state.player.y,a.x,a.y)<dist(state.player.x,state.player.y,b.x,b.y)?a:b);
 selected={type:'landmark',id:nearest.id};inspectorDirty=true;refreshInspector();
 notify('Discovered on the map: '+nearest.name+'. Inspect the location to travel.');
});
button('mapFaction',openFactions);
button('modalParty',showParty);
button('modalCharacter',showCharacter);
button('modalArmory',()=>openArmory());
button('armoryClose',()=>{closeModal();if(!$('screenParty').classList.contains('hidden'))showParty()});
button('armoryGenerate',generateWeapon);
button('armorySave',()=>assignWeapon());
button('armoryReset',()=>assignWeapon(true));
$('armoryFaction').addEventListener('change',()=>loadArmorySlot(0));
$('armoryTier').addEventListener('change',()=>loadArmorySlot());
$('armoryWeapon').addEventListener('change',previewArmory);
$('armoryStyle').addEventListener('change',previewArmory);
$('armoryName').addEventListener('input',previewArmory);
$('factionGrid').addEventListener('click',e=>{const b=e.target.closest('[data-faction]');if(b)showFactionDetails(Number(b.dataset.faction))});
$('factionDetail').addEventListener('click',event=>{
 const button=event.target.closest('[data-family-find]');
 if(button)findFamilyMember(button.dataset.familyFind);
});
function handleQuantityClick(event){
 const button=event.target.closest('[data-quantity-step],[data-quantity-confirm]');
 if(!button)return false;
 const panel=button.closest('[data-quantity-kind]');
 if(!panel||button.disabled)return true;
 const {kind,id,choice,input}=quantityControls(panel);
 if(!choice||choice.max<1)return true;
 if(button.hasAttribute('data-quantity-step')){
  const next=(Math.floor(Number(input.value))||1)+Number(button.dataset.quantityStep);
  input.value=String(clamp(next,1,choice.max));
  updateQuantityAction(panel);
  return true;
 }
 const amount=Number(input.value);
 if(!Number.isInteger(amount)||amount<1||amount>choice.max){
  updateQuantityAction(panel);return true;
 }
 if(kind==='recruit')performSettlementAction('recruit',id,amount);
 else{
  const source=state.player.roster[id];
  if(upgradeRoster(id,amount,choice.id)){
   const roster=state.player.roster;
   const remaining=roster.indexOf(source);
   const promoted=remaining>=0?remaining:roster.findIndex(group=>
    group.faction===source.faction&&group.tier===source.tier+1&&(group.unitId||'standard')===choice.id
   );
   showParty();
   $('partyModalContent').querySelector('[data-company-group="'+promoted+'"] [data-company-group-heading]')?.focus();
  }
 }
 return true;
}
for(const root of [$('partyModalContent'),$('screenTown')]){
 root.addEventListener('input',event=>{
  if(!event.target.matches('[data-quantity-input]'))return;
  updateQuantityAction(event.target.closest('[data-quantity-kind]'));
 });
 root.addEventListener('change',event=>{
  if(!event.target.matches('[data-quantity-choice]'))return;
  updateQuantityAction(event.target.closest('[data-quantity-kind]'),true);
 });
}
$('partyModalContent').addEventListener('click',e=>{
 if(handleQuantityClick(e))return;
 if(e.target.closest('[data-field-rest]')){if(fieldRest())showParty();return}
 const edit=e.target.closest('[data-edit-kit]');
 if(edit)openArmory(state.player.roster[Number(edit.dataset.editKit)]);
});
$('partyPrisoners').addEventListener('click',e=>handlePrisonerClick(e,false));
$('characterModalContent').addEventListener('click',e=>{const equip=e.target.closest('[data-equip]'),stat=e.target.closest('[data-stat]'),perk=e.target.closest('[data-perk]');if(equip)equipItem(equip.dataset.equip);else if(stat)improveStat(stat.dataset.stat);else if(perk)learnPerk(perk.dataset.perk)});
function startEscort(id){
 if(CORRIDORS.mission(state.corridor,id)?.kind!=='shipment'||!state.parties.some(p=>p.id===id&&p.active))return;
 modalStack=[];showScreen(null);followParty(id,true);saveGame(true);
}
function runCorridorAction(site,button){
 const action=button.dataset.act,id=Number(button.dataset.id),{castleId,townId,villageId}=CORRIDORS.PILOT;
 if(action==='escortConvoy'&&[townId,villageId].includes(site.id)){startEscort(id);return}
 if(action==='followCorridor'&&site.id===castleId&&CORRIDORS.mission(state.corridor,id)?.kind==='patrol'){
  modalStack=[];showScreen(null);followParty(id);return;
 }
 const kind=action==='dispatchPatrol'&&site.id===castleId?'patrol':action==='dispatchConvoy'&&site.id===villageId?'shipment':null;
 if(!kind)return;
 const result=launchCorridor(kind);
 if(!result.ok){notify(result.reason);return}
 showTown(site.id);refreshUI();saveGame(true);
 notify(kind==='patrol'?'The Valecrown patrol has departed.':'Duskford’s grain convoy has departed.');
}
$('screenTown').addEventListener('click',e=>{
 if(handlePrisonerClick(e,true))return;
 if(handleWorkshopAction(e))return;
 const audience=e.target.closest('[data-town-noble-act]');
 if(audience){townNobleAction(audience.dataset.townNobleAct,audience.dataset.noblePerson);return}
 if(handleQuantityClick(e))return;
 const section=e.target.closest('button[data-town-section]');
 if(section){$(section.dataset.townSection)?.scrollIntoView({block:'start',behavior:'smooth'});return}
 const destination=e.target.closest('button[data-town-view]');
 if(destination){setTownView(destination.dataset.townView);return}
 const action=e.target.closest('[data-act]');
 if(action){
  const site=S[state?.currentTownId];
  if(action.closest('#townCorridor')&&site&&dist(state.player.x,state.player.y,site.x,site.y)<=TOWN_ENTRY_RANGE)runCorridorAction(site,action);
  else performSettlementAction(action.dataset.act,Number(action.dataset.id));
  return;
 }
 const item=e.target.closest('[data-buy-item]');if(item){buyItem(item.dataset.buyItem);return}
 const sold=e.target.closest('[data-sell-resource]');if(sold){sellResource(sold.dataset.sellResource);return}
 if(e.target.closest('[data-sell-food]')){sellFood();return}
 const abandoned=e.target.closest('[data-contract-cancel]');if(abandoned){abandonContract(abandoned.dataset.contractCancel);return}
 const contract=e.target.closest('[data-contract-accept]');if(contract)acceptContract(contract.dataset.contractAccept,state.currentTownId);
});
$('townWorkshop').addEventListener('change',handleWorkshopAction);
document.querySelector('.town-nav').addEventListener('keydown',e=>{
 const current=e.target.closest('[data-town-view]');if(!current)return;
 const tabs=[...document.querySelectorAll('.town-nav [data-town-view]:not([hidden])')],index=tabs.indexOf(current);let next=index;
 if(e.key==='ArrowRight')next=(index+1)%tabs.length;else if(e.key==='ArrowLeft')next=(index-1+tabs.length)%tabs.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=tabs.length-1;else return;
 e.preventDefault();setTownView(tabs[next].dataset.townView,true);
});
$('inspectorContent').addEventListener('click',e=>{
 const b=e.target.closest('[data-act]');if(!b||!state)return;
 const id=Number(b.dataset.id),act=b.dataset.act;
 if(act==='recruit'||act==='rest'){
  performSettlementAction('visit',id);
  if(state.currentTownId===id&&!$('screenTown').classList.contains('hidden'))setTownView(act==='recruit'?'garrison':'inn');
 }
 else if(['food','rumors','visit','granary'].includes(act))performSettlementAction(act,id);
 else if(act==='travelSettlement')travelTo(S[id].x,S[id].y,id);
 else if(act==='travelParty')followParty(id);
 else if(act==='escortConvoy')startEscort(id);
 else if(act==='meetParty'){const p=state.parties.find(v=>v.id===id);if(p)openEncounter(p)}
 else if(act==='travelLandmark')exploreLandmark(id);
 else if(act==='nearest'){const site=W.closestSettlement(state.player.x,state.player.y);selected={type:'settlement',id:site.id}}
 else if(act==='partyPanel')showParty();else if(act==='factions')openFactions();
 inspectorDirty=true;refreshUI();
});
function resetMapGesture(){
 mapPointers.clear();drag=null;mapPinch=null;
}
function mapPoint(event){
 const bounds=canvas.getBoundingClientRect();
 return {x:event.clientX-bounds.left,y:event.clientY-bounds.top};
}
function mapPinchBounds(){
 const [a,b]=mapPointers.values();
 return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.max(1,dist(a.x,a.y,b.x,b.y))};
}
function startMapDrag(point,moved){
 drag={...point,cx:camera.x,cy:camera.y,moved};
}
canvas.addEventListener('pointerdown',event=>{
 if(!state||menuOpen||event.button!==0||mapPointers.size>=2)return;
 const point=mapPoint(event);
 canvas.setPointerCapture(event.pointerId);
 mapPointers.set(event.pointerId,point);
 if(mapPointers.size===1){startMapDrag(point,false);return}
 const bounds=mapPinchBounds();
 mapPinch={distance:bounds.distance,zoom:camera.zoom,anchor:toWorld(bounds.x,bounds.y)};
 drag=null;focus=false;
});
canvas.addEventListener('pointermove',event=>{
 if(!mapPointers.has(event.pointerId))return;
 const point=mapPoint(event);
 mapPointers.set(event.pointerId,point);
 if(mapPinch){
  const bounds=mapPinchBounds();
  camera.zoom=clamp(mapPinch.zoom*bounds.distance/mapPinch.distance,.115,1.9);
  camera.x=clamp(mapPinch.anchor.x-(bounds.x-view.w/2)/camera.zoom,0,W.WIDTH);
  camera.y=clamp(mapPinch.anchor.y-(bounds.y-view.h/2)/camera.zoom,0,W.HEIGHT);
  lastMini=0;return;
 }
 if(!drag)return;
 const dx=point.x-drag.x,dy=point.y-drag.y;
 if(Math.hypot(dx,dy)>7)drag.moved=true;
 if(drag.moved){
  camera.x=clamp(drag.cx-dx/camera.zoom,0,W.WIDTH);
  camera.y=clamp(drag.cy-dy/camera.zoom,0,W.HEIGHT);
  focus=false;lastMini=0;
 }
});
function finishMapPointer(event){
 if(!mapPointers.delete(event.pointerId))return;
 if(mapPinch){
  mapPinch=null;
  startMapDrag(mapPointers.values().next().value,true);
  return;
 }
 const start=drag;
 drag=null;
 if(event.type!=='pointerup'||!start||start.moved||!state||menuOpen)return;
 const point=mapPoint(event);
 if(dist(point.x,point.y,start.x,start.y)>7)return;
 const position=toWorld(point.x,point.y);
 chooseSelection(clamp(position.x,0,W.WIDTH),clamp(position.y,0,W.HEIGHT));
 refreshUI();
}
canvas.addEventListener('pointerup',finishMapPointer);
canvas.addEventListener('pointercancel',finishMapPointer);
canvas.addEventListener('lostpointercapture',finishMapPointer);
canvas.addEventListener('wheel',e=>{if(!state)return;e.preventDefault();const r=canvas.getBoundingClientRect();zoomAt(e.deltaY<0?1.18:1/1.18,e.clientX-r.left,e.clientY-r.top)},{passive:false});
mini.addEventListener('click',e=>{if(!state)return;const r=mini.getBoundingClientRect();camera.x=clamp((e.clientX-r.left)/r.width*W.WIDTH,0,W.WIDTH);camera.y=clamp((e.clientY-r.top)/r.height*W.HEIGHT,0,W.HEIGHT);focus=false});
window.addEventListener('keydown',e=>{
 if(e.key==='Escape'){
  if(!$('screenMenu').classList.contains('hidden'))return;
  if(!$('screenCreate').classList.contains('hidden'))showScreen('screenMenu');
  else if(!$('screenPause').classList.contains('hidden'))showScreen(null);
  else if(!$('screenEncounter').classList.contains('hidden'))leaveEncounter();
  else if(!$('screenAftermath').classList.contains('hidden'))showScreen(null);
  else if(menuOpen)closeModal();
  else if(state)showScreen('screenPause');
  return;
 }
 if(!state||menuOpen||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
 const k=e.key.length===1?e.key.toLowerCase():e.key;
 if(k===' '&&['BUTTON','A'].includes(document.activeElement?.tagName))return;
 if(['ArrowRight','ArrowLeft','ArrowUp','ArrowDown',' ','w','a','s','d'].includes(k))e.preventDefault();
 keys.add(k);
 if(k===' '&&!e.repeat)togglePause();
 if(k==='p')showParty();if(k==='c')showCharacter();
 if(k==='f')openFactions();
 if(k==='+'||k==='=')zoomAt(1.3);if(k==='-')zoomAt(1/1.3);
});
window.addEventListener('keyup',e=>keys.delete(e.key.length===1?e.key.toLowerCase():e.key));
window.addEventListener('blur',()=>{keys.clear();resetMapGesture()});
window.addEventListener('beforeunload',()=>{if(state)saveGame(true)});
window.addEventListener('resize',()=>{
 resize();if(!$('screenAtlas').classList.contains('hidden'))drawAtlas();
});
if('ResizeObserver' in window)new ResizeObserver(resize).observe(canvas.parentElement);
const portraitMode=window.matchMedia?.('(orientation: portrait)');
function frame(now){
 const dt=Math.min(.075,Math.max(0,(now-last)/1000||.016));last=now;
 if(state&&!menuOpen){
  if(!state.paused&&!document.hidden&&!portraitMode?.matches){
   const beforeX=state.player.x,beforeY=state.player.y;
   stepTravel(dt);
   const moved=dist(beforeX,beforeY,state.player.x,state.player.y),normal=148*W.walkingSpeed(beforeX,beforeY)*dt;
   if(!state.paused&&state.waiting){
    const elapsed=dt*state.waitSpeed;
    advanceTime(148*elapsed);
    stepParties(elapsed);
   }else if(!state.paused&&moved>0)stepParties(dt*clamp(moved/Math.max(1,normal),0,1));
   else if(!state.paused&&state.escortPartyId!==null){advanceTime(148*dt);stepParties(dt)}
   if(focus&&(state.options.follow||state.followPartyId!=null)){const t=Math.min(1,dt*5);camera.x+=(state.player.x-camera.x)*t;camera.y+=(state.player.y-camera.y)*t}
  }
  drawWorld(now);
  if(now-lastHud>350){refreshUI();lastHud=now}
  if(now-lastMini>1300){drawMini();lastMini=now}
  if(now-lastSave>20000){saveGame(true);lastSave=now}
 }
 if(toastUntil&&now>toastUntil){$('toast').classList.add('hidden');toastUntil=0}
 requestAnimationFrame(frame);
}
function init(){
 try{
  const raw=JSON.parse(localStorage.getItem('ua-settings-v1')||'null');
  if(raw)for(const key of Object.keys(settingsDefault))
   if(typeof raw[key]==='boolean')settingsDefault[key]=raw[key];
 }catch(e){}
 const options=$('originSelect');options.innerHTML=F.map(f=>'<option value="'+f.id+'">'+esc(f.name)+'</option>').join('');
 options.value='6';
 $('game').classList.add('hidden');showScreen('screenMenu');refreshContinue();
 resize();requestAnimationFrame(frame);
 if(window.location?.search?.includes('battleReturn=1')){
  if(loadGame()&&window.history?.replaceState)
   window.history.replaceState({},'',window.location.pathname);
 }
}
init();
window.UACampaignDebug={getState:()=>state,getCamera:()=>camera,newCampaign:startCampaign,loadGame,saveGame,
 travelTo,advance:stepTravel,stepParties,world:W,showFactionDetails,refreshUI,performSettlementAction,upgradeRoster,skirmish,drawWorld,showScreen,zoomAt,market:townMarket,marketPrice,buyItem,sellResource,sellFood,buildGranary,advanceEconomy,diplomacyTick:diplomacyDay,advanceDay,showTown,factionDiplomacyLabel,chooseCaravanTrade,deliverCaravan};
})();


