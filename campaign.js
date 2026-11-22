
(function(){
'use strict';
const W=window.UAWorld;if(!W)throw Error('World data is missing');
const $=id=>document.getElementById(id),F=W.factions,S=W.settlements,BASE_SETTLEMENTS=S.map(site=>({prosperity:site.prosperity,garrison:site.garrison}));
const KEY='ua-campaign-v1',VERSION=1,MAXPARTY=75,MAX_ACTIVE_WORLD_WARS=2;
const clamp=W.clamp,dist=(a,b,x,y)=>Math.hypot(a-x,b-y),esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const canvas=$('worldCanvas'),ctx=canvas.getContext('2d'),mini=$('minimap'),mctx=mini.getContext('2d');
let state=null,selected=null,selectedFaction=6,modalStack=[],focus=true,camera={x:3870,y:5320,zoom:.47},keys=new Set(),drag=null,last=0,lastHud=0,lastMini=0,lastSave=0,toastUntil=0,menuOpen=true,miniBase=null,view={w:900,h:600},inspectorDirty=true;
const screens=['screenMenu','screenCreate','screenFactions','screenAtlas','screenOptions','screenPause','screenParty','screenCharacter','screenTown','screenEncounter','screenAftermath'];
const settingsDefault={borders:true,labels:true,roads:true,minimap:true,follow:true};
const ITEMS={
 sword:{name:'Arming sword',slot:'weapon',price:180,icon:'⚔',rating:5},axe:{name:'Battle axe',slot:'weapon',price:220,icon:'🪓',rating:6},
 spear:{name:'Soldier spear',slot:'weapon',price:145,icon:'🔱',rating:4},bow:{name:'Hunting bow',slot:'weapon',price:260,icon:'🏹',rating:4},
 paddedArmor:{name:'Padded coat',slot:'armor',price:95,icon:'🧥',rating:1},leatherArmor:{name:'Leather armor',slot:'armor',price:230,icon:'🥋',rating:2},
 mailArmor:{name:'Mail hauberk',slot:'armor',price:510,icon:'🛡',rating:4},plateArmor:{name:'Plate harness',slot:'armor',price:980,icon:'⚙',rating:6},
 buckler:{name:'Buckler',slot:'shield',price:90,icon:'🛡',rating:1},roundShield:{name:'Round shield',slot:'shield',price:125,icon:'🛡',rating:2},kiteShield:{name:'Kite shield',slot:'shield',price:270,icon:'🛡',rating:3},
 quiver:{name:'Leather quiver',slot:'quiver',price:85,icon:'🏹',rating:2},rockPouch:{name:'Throwing-stone pouch',slot:'quiver',price:70,icon:'🪨',rating:2},
 arrows:{name:'Arrows · 12',stack:true,price:24,icon:'➶'},stones:{name:'Throwing stones · 6',stack:true,price:18,icon:'●'},food:{name:'Provisions · 8',stack:true,price:28,icon:'🍞'},grain:{name:'Grain',stack:true,resource:true,price:8,icon:'🌾'},timber:{name:'Timber',stack:true,resource:true,price:13,icon:'🪵'},iron:{name:'Iron',stack:true,resource:true,price:20,icon:'⛏'},tools:{name:'Tools',stack:true,resource:true,price:25,icon:'🔧'},salt:{name:'Salt',stack:true,resource:true,price:15,icon:'🧂'}
};
const TRADE_RESOURCES=['grain','timber','iron','tools','salt'];
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
 if(state)state.paused=menuOpen||state.pausedManual;
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
function troopName(group){return F[group.faction]?.troops[clamp(group.tier,0,2)]||'Unknown soldier'}
function standingLabel(value){return value>=60?'Trusted':value>=25?'Respected':value<=-60?'Outlawed':value<=-25?'Unwelcome':'Neutral'}
function recruitmentTerms(site){
 const standing=Number(state.player.reputation[site.faction])||0;
 return {count:Math.min(standing>=40?6:4,MAXPARTY-rosterCount()),unit:Math.max(1,Math.round(45*clamp(1-standing*.004,.72,1.4))),access:standing>-60};
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
 p.stats={strength:5,agility:5,tactics:5,leadership:5,...(p.stats||{})};
 p.statPoints=Math.max(0,Number(p.statPoints)||0);
 p.perkPoints=Math.max(0,Number(p.perkPoints)||0);p.perks=Array.isArray(p.perks)?p.perks.filter(id=>PERKS[id]):[];
 p.perkPoints=Math.max(p.perkPoints,Math.floor((Number(p.level)||1)/3)-p.perks.length);
 p.morale=clamp(Number.isFinite(Number(p.morale))?Number(p.morale):65,0,100);p.reputation=Array.isArray(p.reputation)?Array.from({length:F.length},(_,i)=>clamp(Number(p.reputation[i])||0,-100,100)):Array(F.length).fill(0);
 p.activeContracts=Array.isArray(p.activeContracts)?p.activeContracts:[];
 p.inventory={arrows:24,stones:0,food:0,grain:0,timber:0,iron:0,tools:0,salt:0,...(p.inventory||{})};
 p.equipment={weapon:'sword',armor:'paddedArmor',shield:'roundShield',quiver:'quiver',...(p.equipment||{})};
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
   parties:state.parties.map(p=>({id:p.id,x:p.x,y:p.y,tx:p.tx,ty:p.ty,strength:p.strength,active:p.active,kind:p.kind,faction:p.faction,targetPartyId:p.targetPartyId??null,cargo:p.cargo??null,tradeTargetId:p.tradeTargetId??null})),
   options:state.options,speed:state.speed,zoom:camera.zoom,visitedLandmarks:state.visitedLandmarks||[],pendingBattleId:state.pendingBattleId||null,
   marketStocks:state.marketStocks||{},completedContracts:state.completedContracts||[],diplomacy:state.diplomacy,settlementProjects:state.settlementProjects||{},settlementState:S.map(site=>({prosperity:site.prosperity,garrison:site.garrison}))};
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
 const cap=F[origin].capital;
 // Spawn near each faction's gates and within immediate recruiting range.
 const x=cap[0]+45,y=cap[1]+45;
 const money=background==='merchant'?1250:background==='soldier'?650:900;
 const firstTroops=background==='soldier'?
  [{faction:origin,tier:0,count:5},{faction:origin,tier:1,count:3}]:
  [{faction:origin,tier:0,count:8}];
 state={version:VERSION,player:{name,origin,background,x,y,gold:money,food:background==='merchant'?28:22,hp:100,
   level:1,xp:0,renown:0,roster:firstTroops,quest:{id:0,progress:0,goal:3,done:false}},
   day:1,hour:8,speed:1,paused:false,pausedManual:false,path:[],pathIndex:0,targetSettlement:null,
   followPartyId:null,followRepath:0,visitedLandmarks:[],pendingBattleId:null,
   parties:[],options:{...settingsDefault},messages:[],unseen:[],lastEncounter:-100,marketStocks:{},completedContracts:[],diplomacy:createDiplomacy(),settlementProjects:{}};
  state.player=preparePlayer(state.player);
  state.parties=generateParties();initializeMarkets();selected={type:'settlement',id:origin*8};
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
  state={version:VERSION,player:p,day:raw.day||1,hour:raw.hour||8,speed:[1,2,4].includes(raw.speed)?raw.speed:1,
   paused:false,pausedManual:false,path:[],pathIndex:0,targetSettlement:null,
   followPartyId:null,followRepath:0,visitedLandmarks:Array.isArray(raw.visitedLandmarks)?raw.visitedLandmarks:[],pendingBattleId:raw.pendingBattleId||null,
   parties:[],options:{...settingsDefault,...raw.options},
   messages:[],lastEncounter:-100,marketStocks:raw.marketStocks&&typeof raw.marketStocks==='object'?raw.marketStocks:{},completedContracts:Array.isArray(raw.completedContracts)?raw.completedContracts:[],diplomacy:normalizeDiplomacy(raw.diplomacy),settlementProjects:raw.settlementProjects&&typeof raw.settlementProjects==='object'?raw.settlementProjects:{}};
  restoreSettlementState(raw.settlementState);state.parties=generateParties();initializeMarkets();
  if(Array.isArray(raw.parties))for(const saved of raw.parties){let a=state.parties.find(v=>v.id===saved.id);
    if(!a&&Number.isInteger(saved.id)&&saved.id>=68&&['bandit','patrol','caravan'].includes(saved.kind)&&
     (saved.kind==='bandit'?saved.faction===-1:Number.isInteger(saved.faction)&&saved.faction>=0&&saved.faction<F.length)&&
     Number.isFinite(saved.strength)&&typeof saved.active==='boolean'){
     a={id:saved.id,kind:saved.kind,faction:saved.faction,strength:saved.strength,active:saved.active,x:saved.x,y:saved.y,tx:saved.x,ty:saved.y,path:[],pathIndex:0};state.parties.push(a);
    }
    if(a&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)){
     Object.assign(a,saved);a.path=[];a.pathIndex=0;
     if(!W.tileAt(a.x,a.y).walk){
      const land=W.nearestWalk(Math.floor(a.x/W.TILE),Math.floor(a.y/W.TILE));
      if(land){a.x=(land.x+.5)*W.TILE;a.y=(land.y+.5)*W.TILE}
     }
    }}
  camera.zoom=clamp(raw.zoom||.47,.12,1.9);resetView();$('game').classList.remove('hidden');showScreen(null);resize();
  selected={type:'land'};log('Campaign resumed. Your journey continues.');refreshUI();if(!consumeBattleResult())notify('Campaign loaded.');return true;
 }catch(e){notify('Could not load this campaign save.');return false}
}
function showMenu(){
 modalStack=[];
 if(state)saveGame(true);
 $('game').classList.add('hidden');showScreen('screenMenu');refreshContinue();selected=null;keys.clear();
}
function selectNew(){
 modalStack=[];
 $('newName').value='Wanderer';$('originSelect').value='6';$('backgroundSelect').value='wanderer';showScreen('screenCreate')
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
function travelTo(x,y,targetId){
 if(!state||state.paused)return;
 const route=W.findPath(state.player.x,state.player.y,x,y);
 if(!route.length){notify('No traversable route found.');return}
 state.path=route;state.pathIndex=0;state.targetSettlement=targetId==null?null:targetId;
 state.followPartyId=null;
 state.pausedManual=false;state.paused=false;focus=state.options.follow;
 if(targetId!=null)notify('Traveling to '+S[targetId].name+'.');
 else notify('Travel route set · '+Math.round(route.length*W.TILE/100)/10+' leagues approximately.');
 refreshUI();
}
function partyName(p){
 if(!p)return'Unknown travelers';
 return p.kind==='bandit'?'Outlaw Bandits':
  (F[p.faction]?.name||'Wandering')+' '+(p.kind==='patrol'?'Patrol':'Caravan');
}
function followParty(id){
 if(!state||state.paused)return;
 const party=state.parties.find(p=>p.id===id&&p.active);
 if(!party){notify('That party is no longer on the roads.');return}
 state.followPartyId=id;
 state.followRepath=0;state.targetSettlement=null;
 selected={type:'party',id};focus=true;inspectorDirty=true;
 updateFollow(0);
 if(!state.paused)notify('Following '+partyName(party)+'. Your route adjusts as they move.');
 refreshUI();
}
function updateFollow(dt){
 if(!state||state.followPartyId==null)return;
 const party=state.parties.find(p=>p.id===state.followPartyId&&p.active);
 if(!party){state.followPartyId=null;state.path=[];state.pathIndex=0;notify('You lost the party you were following.');return}
 const distance=dist(state.player.x,state.player.y,party.x,party.y);
 if(distance<=143){state.path=[];state.pathIndex=0;openEncounter(party);return}
 state.followRepath-=dt*state.speed;
 if(state.followRepath>0&&state.pathIndex<state.path.length)return;
 // Aim a few route segments ahead: the target continues moving while
 // the player travels. Reroute periodically instead of only once.
 const lead=party.path.length?
  party.path[Math.min(party.path.length-1,party.pathIndex+3)]:party;
 const route=W.findPath(state.player.x,state.player.y,lead.x,lead.y);
 if(route.length){state.path=route;state.pathIndex=0}
 state.followRepath=1.25;
}
function walkPlayer(dx,dy,dt){
 const p=state.player,mag=Math.hypot(dx,dy);if(mag<.0001)return false;
 const spd=147*W.walkingSpeed(p.x,p.y)*dt*state.speed*(p.perks.includes('outrider')?1.12:1);
 const x=clamp(p.x+dx/mag*spd,15,W.WIDTH-15),y=clamp(p.y+dy/mag*spd,15,W.HEIGHT-15);
 if(!W.tileAt(x,y).walk)return false;
 const d=dist(p.x,p.y,x,y);p.x=x;p.y=y;advanceTime(d);
 if(state.targetSettlement!=null&&dist(p.x,p.y,S[state.targetSettlement].x,S[state.targetSettlement].y)<130)
  arriveSettlement(state.targetSettlement);
 return true;
}
function advanceTime(distance){
 state.hour+=distance/230;
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
function normalizeDiplomacy(raw){
 const base=createDiplomacy();
 if(!raw||!Array.isArray(raw.relations))return base;
 for(let a=0;a<F.length;a++)for(let b=a+1;b<F.length;b++){
  const value=Number(raw.relations[a]?.[b]),heat=Number(raw.tension?.[a]?.[b]);
  if(Number.isFinite(value))base.relations[a][b]=base.relations[b][a]=clamp(value,-100,100);
  if(Number.isFinite(heat))base.tension[a][b]=base.tension[b][a]=clamp(heat,0,100);
 }
 const validPairs=list=>(Array.isArray(list)?list:[]).filter(x=>x&&Number.isInteger(x.a)&&Number.isInteger(x.b)&&x.a>=0&&x.b>=0&&x.a<F.length&&x.b<F.length&&x.a!==x.b).map(x=>({...x,a:Math.min(x.a,x.b),b:Math.max(x.a,x.b)}));
 base.wars=validPairs(raw.wars).map(w=>({...w,startDay:Number.isFinite(w.startDay)?Math.max(1,w.startDay):Math.max(1,state?.day||1),score:Number.isFinite(w.score)?w.score:0}));base.alliances=validPairs(raw.alliances);
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
 const pact=d.alliances.find(x=>x.a===b||x.b===b),ally=pact?(pact.a===b?pact.b:pact.a):-1;
 if(ally>=0&&d.wars.length<MAX_ACTIVE_WORLD_WARS&&!factionsAtWar(ally,a)&&!factionsAllied(ally,a)&&factionRelation(ally,a)<38&&activeFor(ally)<2){
  d.wars.push({a:Math.min(ally,a),b:Math.max(ally,a),attacker:a,defender:ally,startDay:state.day,score:0,defensive:true});
  setFactionRelation(ally,a,-32);
  recordDiplomacy(F[ally].name+' honored its defensive pact and joined the war.');
 }
}
function pairKey(a,b){return Math.min(a,b)+':'+Math.max(a,b)}
function diplomacyDay(){
 const d=state.diplomacy;
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
  const pairs=[];
  for(let a=0;a<F.length;a++)for(let b=a+1;b<F.length;b++){
   const key=pairKey(a,b),last=Number(d.lastIncidentByPair[key])||0;
   if(!pairHas(d.wars,a,b)&&!pairHas(d.alliances,a,b)&&last<=state.day-6&&(d.truceUntil[key]||0)<=state.day)pairs.push([a,b]);
  }
  if(pairs.length){
   const index=Math.floor(W.hash(state.day,713)*pairs.length),[a,b]=pairs[index],key=pairKey(a,b);
   const relation=factionRelation(a,b),heat=factionTension(a,b),shortage=Math.min(factionResourceTotal(a,'grain'),factionResourceTotal(b,'grain'))<30;
   const goodwill=W.hash(state.day,911)>.76;
   if(goodwill){
    setFactionRelation(a,b,relation+10);setFactionTension(a,b,heat-12);
    recordDiplomacy(F[a].name+' and '+F[b].name+' opened a shared trade compact.');
   }else{
    const strain=7+Math.floor(W.hash(state.day,127)*5)+(shortage?4:0);
    setFactionRelation(a,b,relation-strain);setFactionTension(a,b,heat+9+(shortage?8:0));
    recordDiplomacy((shortage?'Grain shortages worsened ':'A border dispute strained ')+F[a].name+' and '+F[b].name+' relations.');
   }
   d.lastIncidentByPair[key]=state.day;
   const nextRelation=factionRelation(a,b),nextHeat=factionTension(a,b);
   if(nextRelation>=54&&nextHeat<=24&&!pairHas(d.alliances,a,b)&&state.day>=21){
    d.alliances.push({a,b,formedDay:state.day});recordDiplomacy(F[a].name+' and '+F[b].name+' formed a defensive alliance.');
   }else if(nextRelation<=-18&&nextHeat>=42&&!factionsAtWar(a,b)&&state.day>=35)declareWar(a,b);
  }
  d.nextIncidentDay=state.day+4+Math.floor(W.hash(state.day,581)*4);
 }
}
function resourceProduction(site){
 const kind=W.tileAt(site.x,site.y).kind,r={grain:1,timber:0,iron:0,tools:0,salt:0};
 if(['grass','steppe','marsh','rainforest'].includes(kind))r.grain+=2;
 if(['forest','taiga','rainforest'].includes(kind))r.timber=3;
 if(['hills','mountain'].includes(kind))r.iron=2;
 if(['desert','scrub','marsh'].includes(kind))r.salt=2;
 if(site.type==='village'){
  const specialty=Object.keys(r).filter(k=>k!=='tools').sort((a,b)=>r[b]-r[a])[0];
  if(r[specialty]>0)r[specialty]+=2;
 }else if(site.type==='town'||site.type==='capital'){
  r.grain++;for(const key of ['timber','iron','salt'])if(r[key])r[key]++;
  r.tools=1;
 }else if(site.type==='castle'){r.iron=kind==='mountain'||kind==='hills'?3:1;r.tools=1}
 const yieldFactor=clamp(.75+site.prosperity/200,.75,1.25);for(const key of ['grain','timber','iron','salt'])r[key]=Math.round(r[key]*yieldFactor);
 return r;
}
function resourceCapacity(id,site){
 const base={grain:90,timber:70,iron:55,tools:42,salt:50}[id]||20;
 return base+(state.settlementProjects?.[site.id]?.granary&&id==='grain'?40:0);
}
function defaultMarketCapacity(id,site){
 if(TRADE_RESOURCES.includes(id))return resourceCapacity(id,site);
 if(id==='food')return 5+Math.floor(site.prosperity/18);
 return ['arrows','stones'].includes(id)?3:2;
}
function ensureMarket(site){
 state.marketStocks=state.marketStocks||{};
 let market=state.marketStocks[site.id];
 if(!market||typeof market!=='object')market=state.marketStocks[site.id]={stock:{},capacity:{},lastDay:state.day};
 market.stock=market.stock&&typeof market.stock==='object'?market.stock:{};
 market.capacity=market.capacity&&typeof market.capacity==='object'?market.capacity:{};
 for(const itemId of marketGoods(site)){
  if(!Number.isFinite(market.stock[itemId])){
   if(TRADE_RESOURCES.includes(itemId)){
    const rate=resourceProduction(site)[itemId],capacity=resourceCapacity(itemId,site);
    market.stock[itemId]=Math.round(clamp(capacity*.34+rate*5+(site.prosperity-50)*.12,5,capacity));
   }else if(itemId==='food')market.stock[itemId]=3+Math.floor(site.prosperity/24);
   else{
    const expensive=['mailArmor','plateArmor','kiteShield','bow'].includes(itemId);
    market.stock[itemId]=expensive?1+(site.prosperity>75?1:0):1;
   }
  }
  market.capacity[itemId]=Math.max(market.stock[itemId],market.capacity[itemId]||defaultMarketCapacity(itemId,site));
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
  const grainUse=site.type==='capital'?2:site.type==='town'?2:site.type==='castle'?2:1;
  const underWar=state.diplomacy.wars.some(w=>w.a===site.faction||w.b===site.faction);
  if(underWar&&['capital','castle'].includes(site.type)&&state.day%2===0)stock.grain=Math.max(0,stock.grain-1);
  if(underWar&&['capital','castle'].includes(site.type)&&state.day%3===0&&stock.iron>0)stock.iron=Math.max(0,stock.iron-1);
  for(const id of TRADE_RESOURCES){
   if(id==='tools'){
    if(['town','capital','castle'].includes(site.type)&&stock.iron>=2&&stock.timber>=2){stock.iron--;stock.timber--;stock.tools=Math.min(resourceCapacity(id,site),stock.tools+1)}
    continue;
   }
   stock[id]=clamp(stock[id]+rates[id],0,resourceCapacity(id,site));
  }
  if(stock.grain>=grainUse){
   stock.grain-=grainUse;
   stock.food=Math.min(market.capacity.food||defaultMarketCapacity('food',site),stock.food+(granary?2:1));
   site.prosperity=clamp(site.prosperity+.04,0,100);
  }else{
   stock.grain=0;site.prosperity=clamp(site.prosperity-.22,0,100);
   if(site.garrison>5&&state.day%5===0)site.garrison--;
  }
  for(const id of TRADE_RESOURCES)stock[id]=Math.min(resourceCapacity(id,site),stock[id]);
  for(const id of Object.keys(stock)){
   if(TRADE_RESOURCES.includes(id)||id==='food')continue;
   const cap=market.capacity[id]||defaultMarketCapacity(id,site),restock=['arrows','stones'].includes(id)&&state.day%2===0?1:state.day%4===0?1:0;
   stock[id]=Math.min(cap,stock[id]+restock);
  }
  market.lastDay=state.day;
 }
}
function dailyWages(){
 const p=state.player,rate=[2,4,7];
 const raw=p.roster.reduce((sum,g)=>sum+g.count*rate[clamp(g.tier,0,2)],0);
 return Math.max(0,Math.ceil(raw*(p.perks.includes('quartermaster')?.85:1)));
}
function advanceDay(){state.day++;advanceEconomy();diplomacyDay();consumeFood();replenishRoadParties()}
function replenishRoadParties(){
 const limits={bandit:27,patrol:21,caravan:20};
 for(const [kind,limit] of Object.entries(limits)){
  if(state.parties.filter(p=>p.active&&p.kind===kind).length>=limit)continue;
  const id=state.parties.reduce((n,p)=>Math.max(n,p.id),-1)+1,faction=(id*7+state.day*3)%F.length;
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
function consumeFood(){
 const p=state.player,baseNeed=Math.max(1,Math.ceil(rosterCount()/10));
 const need=Math.max(1,Math.ceil(baseNeed*(p.perks.includes('quartermaster')?.85:1)));
 if(p.food>=need){p.food-=need;p.morale=clamp(p.morale+1,0,100)}
 else{p.food=0;p.hp=Math.max(5,p.hp-5);p.morale=clamp(p.morale-10,0,100);log('Your company ran out of food. Health and morale fell.')}
 const wage=dailyWages();
 if(p.gold>=wage){p.gold-=wage;p.morale=clamp(p.morale+1,0,100);log('Day '+state.day+': paid '+wage+' denars in troop wages.')}
 else{
  const paid=p.gold;p.gold=0;p.morale=clamp(p.morale-7-Math.ceil((wage-paid)/Math.max(1,wage)*5),0,100);
  log('Day '+state.day+': short on wages. Paid '+paid+' of '+wage+' denars; morale fell.');
  if(p.morale<18&&state.day%3===0){const deserter=p.roster.find(g=>g.count>(g.wounded||0));if(deserter){deserter.count--;deserter.wounded=Math.min(deserter.wounded||0,deserter.count);p.roster=p.roster.filter(g=>g.count>0);p.morale=clamp(p.morale+4,0,100);log('A soldier deserted because morale collapsed.')}}
 }
 if(p.morale<25&&state.day%3===0)log('Morale is critical. Pay your troops and keep the company supplied.');
}
function stepTravel(dt){
 const p=state.player;
 const dx=(keys.has('d')||keys.has('ArrowRight')?1:0)-(keys.has('a')||keys.has('ArrowLeft')?1:0);
 const dy=(keys.has('s')||keys.has('ArrowDown')?1:0)-(keys.has('w')||keys.has('ArrowUp')?1:0);
 if(dx||dy){state.path=[];state.pathIndex=0;state.targetSettlement=null;state.followPartyId=null;walkPlayer(dx,dy,dt);focus=state.options.follow;return}
 updateFollow(dt);
 if(state.paused)return;
 if(state.pathIndex>=state.path.length)return;
 let budget=148*W.walkingSpeed(p.x,p.y)*dt*state.speed*(p.perks.includes('outrider')?1.12:1);
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
  if(dist(p.x,p.y,site.x,site.y)<135)arriveSettlement(site.id);
 }
 if(state.pathIndex>=state.path.length&&state.path.length){
  state.path=[];state.pathIndex=0;state.targetSettlement=null;inspectorDirty=true;
 }
}
function arriveSettlement(id){
 state.path=[];state.pathIndex=0;state.targetSettlement=null;selected={type:'settlement',id};
 const site=S[id];log('Arrived at '+site.name+', '+F[site.faction].name+'.');
 if(state.player.quest?.id===1&&site.type==='capital'&&site.faction!==state.player.origin)completeQuest(1);
 for(const c of [...state.player.activeContracts])if(c.type==='courier'&&c.destinationId===id)completeContract(c.id);
 focus=true;inspectorDirty=true;notify('Arrived at '+site.name+'. Visit, recruit or resupply.');
}
function chooseCaravanTrade(p){
 const source=W.closestSettlement(p.x,p.y);if(!source)return null;
 const sourceMarket=ensureMarket(source),candidates=[];
 for(const target of S){
  if(target.id===source.id||dist(source.x,source.y,target.x,target.y)>6200||factionsAtWar(source.faction,target.faction))continue;
  const targetMarket=ensureMarket(target);
  for(const resource of ['food',...TRADE_RESOURCES]){
   const cap=resource==='food'?(sourceMarket.capacity.food||defaultMarketCapacity('food',source)):resourceCapacity(resource,source),targetCap=resource==='food'?(targetMarket.capacity.food||defaultMarketCapacity('food',target)):resourceCapacity(resource,target);
   const surplus=(sourceMarket.stock[resource]||0)-cap*.66;
   const shortage=targetCap*.42-(targetMarket.stock[resource]||0);
   if(surplus<4||shortage<3)continue;
   const distance=dist(source.x,source.y,target.x,target.y),score=Math.min(surplus,shortage)*2-distance/1600;
   candidates.push({source,target,resource,quantity:Math.min(resource==='grain'?10:6,Math.floor(surplus),Math.ceil(shortage)),score,distance});
  }
 }
 candidates.sort((a,b)=>b.score-a.score||a.distance-b.distance);
 const trade=candidates[0];if(!trade||trade.quantity<1)return null;
 sourceMarket.stock[trade.resource]-=trade.quantity;
 return trade;
}function deliverCaravan(p){
 if(!p?.cargo||!Number.isInteger(p.tradeTargetId))return false;
 const destination=S[p.tradeTargetId];if(!destination||dist(p.x,p.y,destination.x,destination.y)>=135)return false;
 const market=ensureMarket(destination),id=p.cargo.resource,capacity=resourceCapacity(id,destination);
 market.stock[id]=Math.min(id==='food'?(market.capacity.food||defaultMarketCapacity('food',destination)):capacity,(market.stock[id]||0)+p.cargo.quantity);
 if(Number.isInteger(p.cargo.from)&&S[p.cargo.from]&&S[p.cargo.from].faction!==destination.faction&&!factionsAtWar(S[p.cargo.from].faction,destination.faction)){
  const from=S[p.cargo.from].faction,to=destination.faction;
  setFactionRelation(from,to,factionRelation(from,to)+1);setFactionTension(from,to,factionTension(from,to)-2);
 }
 p.cargo=null;p.tradeTargetId=null;p.path=[];p.pathIndex=0;
 reportWorldEvent(destination.x,destination.y,'A caravan delivered supplies to '+destination.name+'.');
 return true;
}function nextPartyDestination(p){
 let dest;
 if(p.kind==='bandit'){
  const prey=state.parties.filter(a=>a.active&&a.kind==='caravan'&&dist(p.x,p.y,a.x,a.y)<1450)
   .sort((a,b)=>dist(p.x,p.y,a.x,a.y)-dist(p.x,p.y,b.x,b.y))[0];
  if(prey){dest=prey;p.targetPartyId=prey.id}
  else{p.targetPartyId=null;const angle=(p.id*2.399+state.day*.3)%6.28;dest={x:clamp(p.x+Math.cos(angle)*720,270,W.WIDTH-270),y:clamp(p.y+Math.sin(angle)*680,260,W.HEIGHT-260)}}
 }else if(p.kind==='patrol'){
  const outlaws=state.parties.filter(a=>a.active&&a.kind==='bandit'&&dist(p.x,p.y,a.x,a.y)<2100)
   .sort((a,b)=>dist(p.x,p.y,a.x,a.y)-dist(p.x,p.y,b.x,b.y))[0];
  const realmEnemies=state.parties.filter(a=>a.active&&a.kind==='patrol'&&factionsAtWar(p.faction,a.faction)&&dist(p.x,p.y,a.x,a.y)<1900)
   .sort((a,b)=>dist(p.x,p.y,a.x,a.y)-dist(p.x,p.y,b.x,b.y))[0];
  const quarry=outlaws||realmEnemies;
  if(quarry){dest=quarry;p.targetPartyId=quarry.id}
  else{p.targetPartyId=null;const options=S.filter(s=>s.faction===p.faction);dest=options[(p.id*19+Math.floor(state.day*1.3)+p.strength)%options.length]}
 }else if(p.kind==='caravan'){
  const trade=chooseCaravanTrade(p);
  if(trade){p.cargo={resource:trade.resource,quantity:trade.quantity,from:trade.source.id,unitPrice:marketPrice(trade.source,trade.resource)};p.tradeTargetId=trade.target.id;dest=trade.target}
  else{const source=W.closestSettlement(p.x,p.y),options=S.filter(s=>s.id!==source?.id);dest=options[(p.id*19+Math.floor(state.day*1.3)+p.strength)%options.length];p.cargo=null;p.tradeTargetId=dest.id}
  p.targetPartyId=null;
 }else{const options=S.filter(s=>s.faction===p.faction);dest=options[(p.id*19+Math.floor(state.day*1.3)+p.strength)%options.length];p.targetPartyId=null}
 p.path=W.findPath(p.x,p.y,dest.x,dest.y);p.pathIndex=0;
}
function resolveWorldClashes(){
 const parties=state.parties;
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
    if(patrolWins){patrol.strength=Math.max(5,patrol.strength-Math.max(1,Math.ceil(raider.strength*.14)));raider.active=false;
     reportWorldEvent(patrol.x,patrol.y,(F[patrol.faction]?.name||'A patrol')+' patrol scattered an outlaw band on the roads.')}
    else{raider.strength=Math.max(3,raider.strength-Math.ceil(patrol.strength*.16));patrol.active=false;
     reportWorldEvent(patrol.x,patrol.y,'Outlaws overwhelmed a patrol near '+W.closestSettlement(patrol.x,patrol.y).name+'.')}
   }else if(raider.kind==='bandit'&&target.kind==='caravan'){
    const raidersWin=raider.strength>=target.strength*.48;
    if(raidersWin){raider.strength=Math.min(28,raider.strength+Math.ceil(target.strength*.12));target.active=false;
     const destination=state.marketStocks[W.closestSettlement(target.x,target.y)?.id];
     if(destination)destination.stock.grain=Math.max(0,(destination.stock.grain||0)-5);
     reportWorldEvent(target.x,target.y,'Bandits raided a '+F[target.faction].name+' caravan; nearby grain supplies were lost.')}
    else{target.strength=Math.max(4,target.strength-Math.ceil(raider.strength*.12));raider.active=false;
     reportWorldEvent(target.x,target.y,'A caravan guard detail repelled bandits on the road.')}
   }
  }
  a.path=[];target.path=[];a.targetPartyId=null;target.targetPartyId=null;
 }
}function stepParties(dt){
 // Stagger pathfinding so dozens of NPC parties cannot block the first frame.
 let routingBudget=3;
 for(const p of state.parties){
  if(!p.active)continue;
  const movingTarget=state.parties.find(a=>a.id===p.targetPartyId&&a.active);
  if(movingTarget&&p.path.length){
   const endpoint=p.path[p.path.length-1];
   if(dist(endpoint.x,endpoint.y,movingTarget.x,movingTarget.y)>310){p.path=[];p.pathIndex=0}
  }
  if(!p.path.length||p.pathIndex>=p.path.length){
   if(routingBudget<=0)continue;
   routingBudget--;nextPartyDestination(p);
  }
  if(!p.path.length)continue;
  let budget=(p.kind==='patrol'?78:p.kind==='caravan'?61:53)*dt*state.speed;
  while(budget>0&&p.pathIndex<p.path.length){
   const n=p.path[p.pathIndex],d=dist(p.x,p.y,n.x,n.y);
   if(d<2){p.pathIndex++;continue}
   const step=Math.min(d,budget);p.x+=(n.x-p.x)/d*step;p.y+=(n.y-p.y)/d*step;budget-=step;
   if(step>=d-1)p.pathIndex++;else break;
  }
  if(p.kind==='caravan')deliverCaravan(p);
 }
 resolveWorldClashes();
 const close=state.parties.find(p=>p.active&&p.kind==='bandit'&&
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
function performSettlementAction(action,id){
 const site=S[id],p=state.player;
 if(!site)return;
 if(dist(p.x,p.y,site.x,site.y)>155){notify('Travel closer to enter '+site.name+'.');return}
 if(action==='recruit'){
  const terms=recruitmentTerms(site),number=terms.count,cost=number*terms.unit;
  if(!terms.access){notify('The local authorities will not enlist you while your standing is outlawed.');return}
  if(number<=0){notify('Your party has reached its current limit.');return}
  if(p.gold<cost){notify('Not enough denars to recruit volunteers.');return}
  p.gold-=cost;let group=p.roster.find(g=>g.faction===site.faction&&g.tier===0);
  if(!group){group={faction:site.faction,tier:0,count:0};p.roster.push(group)}
  group.count+=number;log('Recruited '+number+' '+F[site.faction].troops[0]+' at '+site.name+'.');
  if(p.quest?.id===0){p.quest.progress+=number;if(p.quest.progress>=p.quest.goal)completeQuest(0)}
  notify(number+' volunteers joined your party.');
 }else if(action==='food'){
  const offer=townMarket(site.id).find(item=>item.id==='food');if(!offer||offer.stock<1){notify('This settlement has no provisions for sale.');return}
  if(p.gold<offer.price){notify('Not enough denars for provisions.');return}
  p.gold-=offer.price;state.marketStocks[site.id].stock.food--;p.food+=8;log('Bought eight provisions in '+site.name+' for '+offer.price+' denars.');notify('Purchased eight provisions.');
 }else if(action==='rest'){
  if(p.gold<20){notify('An inn costs 20 denars.');return}
  p.gold-=20;p.hp=Math.min(100,p.hp+32+(p.perks.includes('fieldMedic')?16:0));p.morale=clamp(p.morale+3+(p.perks.includes('fieldMedic')?5:0),0,100);state.hour=8;advanceDay();
  for(const group of p.roster)if(group.wounded)group.wounded=Math.max(0,group.wounded-3);
  log('Rested at '+site.name+'.');notify('Rested, healed and started a new day.');
 }else if(action==='granary'){buildGranary(id);return;
 }else if(action==='rumors'){
  const report=townRumor(site);$('townNewsText').textContent=report;
  log('Rumor in '+site.name+': '+report);
  notify('Fresh rumors heard in '+site.name+'.');
 }else if(action==='visit'){
  log('Visited '+site.name+'. Garrison: '+site.garrison+'. Prosperity: '+site.prosperity+'.');
   showTown(id);saveGame(true);return;
 }
 refreshUI();saveGame(true);
}
function showTown(id){
 const site=S[id];if(!site)return;const f=F[site.faction];
 state.currentTownId=id;
 $('townName').textContent=site.name;$('townFaction').textContent=site.type.toUpperCase()+' · '+f.name;
 const standing=Number(state.player.reputation[site.faction])||0;
 $('townDescription').textContent=f.culture+' · '+site.prosperity+' prosperity · Garrison '+site.garrison+'. Your standing: '+standingLabel(standing)+' ('+(standing>0?'+':'')+standing+'). Morale '+Math.round(state.player.morale)+' · Daily wages '+dailyWages()+'. The road and world stand still while you are inside.';
 const destinations=[
  {view:'market',icon:'🛒',name:'Visit the market',detail:'Trade for food, arms, and armor.'},
  {view:'inn',icon:'🍺',name:'Find the inn',detail:'Rest, heal, and recover the company.'},
  {view:'garrison',icon:'🛡',name:'Visit the garrison',detail:'Recruit volunteers for your party.'},
  {view:'contracts',icon:'📜',name:'Read the contract board',detail:'Find work and earn coin and renown.'},
  {view:'news',icon:'🗞',name:'Ask around',detail:'Hear what travelers say about the roads.'}
 ];
 $('townServices').innerHTML=destinations.map(d=>'<button class="town-activity-card" type="button" data-town-view="'+d.view+'" aria-label="'+esc(d.name+'. '+d.detail)+'"><span class="town-activity-icon" aria-hidden="true">'+d.icon+'</span><span><b>'+esc(d.name)+'</b><small>'+esc(d.detail)+'</small></span><span class="town-activity-arrow" aria-hidden="true">›</span></button>').join('');
 const terms=recruitmentTerms(site),canRecruit=terms.access&&terms.count>0;
 const wounded=state.player.roster.reduce((sum,group)=>sum+(group.wounded||0),0);
 $('townInnSummary').innerHTML='<div class="town-service-stat"><b>'+state.player.hp+' / 100</b><small>Hero health</small></div><div class="town-service-stat"><b>'+Math.round(state.player.morale)+' / 100</b><small>Company morale</small></div><div class="town-service-stat"><b>'+wounded+'</b><small>Wounded soldiers</small></div><p class="town-service-note">A night at the inn costs 20 denars, restores health and morale, treats up to 3 wounded soldiers per troop group, and advances the campaign to morning. Food and wages may be due.</p>';
 const granaryBuilt=!!state.settlementProjects[id]?.granary;
 $('townGarrisonSummary').innerHTML='<div class="town-service-stat"><b>'+site.garrison.toLocaleString()+'</b><small>Garrisoned defenders</small></div><div class="town-service-stat"><b>'+terms.count+'</b><small>Volunteers available</small></div><div class="town-service-stat"><b>'+rosterCount()+' / '+MAXPARTY+'</b><small>Company capacity</small></div><p class="town-service-note">Local '+esc(F[site.faction].troops[0])+' cost '+terms.unit+' denars each. Your standing here is '+esc(standingLabel(standing).toLowerCase())+'. '+(granaryBuilt?'Granary built · grain capacity +40 and extra provisions each day.':'Build a granary to add 40 grain capacity and extra provisions each day.')+'</p>';
 $('townInnAction').innerHTML=renderActions([{act:'rest',id,primary:true,label:'Rest at the inn · 20 denars'}]);
 $('townGarrisonAction').innerHTML=renderActions([{act:'recruit',id,primary:true,label:!terms.access?'Recruitment unavailable · standing outlawed':terms.count>0?'Recruit '+terms.count+' '+F[site.faction].troops[0]+' · '+(terms.count*terms.unit)+' denars':'No volunteers available',disabled:!canRecruit},{act:'granary',id,label:granaryBuilt?'Granary built · +40 grain capacity':'+ Build a granary · 8 timber, 3 iron, 4 tools, 180 denars',disabled:granaryBuilt}]);
 $('townNewsText').textContent=townRumor(site);
 $('townNewsAction').innerHTML=renderActions([{act:'rumors',id,primary:true,label:'Ask for fresh news'}]);
 const market=townMarket(id);
 $('townShop').innerHTML=market.map(item=>{
  const it=ITEMS[item.id],owned=item.id==='food'?state.player.food:state.player.inventory[item.id]||0;
  const resource=!!it.resource,quantity=resource?5:1,total=item.price*quantity;
  const stockLabel=resource?item.stock+' / '+item.capacity+' in stock':item.stock+' in stock';
  const buyDisabled=resource?item.stock<quantity||state.player.gold<total:item.stock<1||state.player.gold<item.price;
  const buyLabel=resource?'Buy 5 · '+total:item.id==='food'?'Buy provisions · '+item.price:'Buy · '+item.price;
  const sell=resource?'<button class="btn small secondary" data-sell-resource="'+item.id+'" '+(owned<1||item.stock>=item.capacity?'disabled':'')+'>Sell up to 5</button>':item.id==='food'?'<button class="btn small secondary" data-sell-food '+(owned<8||item.stock>=item.capacity?'disabled':'')+'>Sell 8 · '+Math.max(1,Math.floor(item.price*.68))+'</button>':'';
  const itemDetail=it.slot?ITEM_SLOT_LABELS[it.slot]+' · '+owned+' owned':owned+(resource?' units owned':' owned');
  return '<article class="shop-item'+(resource?' resource-item':'')+'"><span class="shop-icon">'+it.icon+'</span><span><b>'+esc(it.name)+'</b><small>'+esc(itemDetail)+' · '+stockLabel+(resource?' · local supply':'')+'</small></span><span class="shop-actions"><button class="btn small" data-buy-item="'+item.id+'" '+(buyDisabled?'disabled':'')+'>'+buyLabel+'</button>'+sell+'</span></article>'
 }).join('');
 $('townContracts').innerHTML=renderTownContracts(id);
 setTownView('overview');
 openModal('screenTown');notify('Entered '+site.name+'. Campaign time is paused.');
}
function marketGoods(site){
 const kind=W.tileAt(site.x,site.y).kind;
 const basic=['food','sword','spear','paddedArmor','roundShield','quiver','rockPouch','arrows','stones'];
 const military=['sword','axe','spear','bow','paddedArmor','leatherArmor','mailArmor','plateArmor','roundShield','kiteShield','quiver','rockPouch','arrows','stones'];
 let available=site.type==='village'?basic:site.type==='castle'?military:SHOP_ITEMS.filter(id=>!TRADE_RESOURCES.includes(id));
 if(kind==='desert'||kind==='scrub')available=available.filter(id=>id!=='food'||site.type!=='village');
 if(site.type==='village'&&['snow','tundra'].includes(kind))available=available.filter(id=>!['rockPouch','bow'].includes(id));
 const localResources=TRADE_RESOURCES;
 return [...new Set([...available,...localResources])];
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
 const adjusted=Math.round(item.price*typeFactor*prosperity*climate*standing*trader*(item.resource||itemId==='food'?supply:1));
 return clamp(adjusted,Math.max(1,Math.round(item.price*.65)),Math.max(1,Math.round(item.price*2)));
}
function townMarket(id){
 const site=S[id];if(!site)return[];const market=ensureMarket(site);
 return marketGoods(site).map(itemId=>({id:itemId,stock:market.stock[itemId]||0,capacity:market.capacity[itemId]||defaultMarketCapacity(itemId,site),price:marketPrice(site,itemId)}));
}
function buyItem(id){
 const it=ITEMS[id],p=state?.player,site=S[state?.currentTownId];if(!it||!p||!site)return;
 const market=ensureMarket(site),item=townMarket(site.id).find(v=>v.id===id);if(!item||item.stock<1){notify('The local market is sold out.');return}
 const quantity=it.resource?5:1,unitPrice=item.price,total=unitPrice*quantity;
 if(it.resource&&item.stock<quantity){notify('The market needs more stock before it can sell a bundle of '+quantity+'.');return}
 if(p.gold<total){notify('Not enough denars.');return}
 p.gold-=total;market.stock[id]-=quantity;
 if(site.faction!==p.origin){setFactionRelation(p.origin,site.faction,factionRelation(p.origin,site.faction)+1);setFactionTension(p.origin,site.faction,factionTension(p.origin,site.faction)-1)}
 if(it.resource)grantItem(id,quantity);else if(id==='food')p.food+=8;else grantItem(id,id==='arrows'?12:id==='stones'?6:1);
 log('Bought '+(it.resource?quantity+' '+it.name.toLowerCase():it.name)+' in '+site.name+' for '+total+' denars.');
 refreshUI();saveGame(true);showTown(site.id);
}
function sellResource(id){
 const item=ITEMS[id],site=S[state?.currentTownId],p=state?.player;if(!item?.resource||!site||!p)return;
 const market=ensureMarket(site),owned=Number(p.inventory[id])||0,room=Math.max(0,resourceCapacity(id,site)-(market.stock[id]||0));
 const quantity=Math.min(5,owned,room);if(!quantity){notify(owned?'This market has no room for more.':'You have none to sell.');return}
 const unit=Math.max(1,Math.floor(marketPrice(site,id)*.68)),total=unit*quantity;
 p.inventory[id]-=quantity;market.stock[id]+=quantity;p.gold+=total;if(site.faction!==p.origin){setFactionRelation(p.origin,site.faction,factionRelation(p.origin,site.faction)+1);setFactionTension(p.origin,site.faction,factionTension(p.origin,site.faction)-1)}
 log('Sold '+quantity+' '+item.name.toLowerCase()+' in '+site.name+' for '+total+' denars.');
 refreshUI();saveGame(true);showTown(site.id);
}
function sellFood(){
 const site=S[state?.currentTownId],p=state?.player;if(!site||!p)return;
 const market=ensureMarket(site),room=(market.capacity.food||defaultMarketCapacity('food',site))-market.stock.food;
 if(p.food<8||room<1){notify(p.food<8?'You need eight provisions to sell a bundle.':'This market has no room for more provisions.');return}
 const price=Math.max(1,Math.floor(marketPrice(site,'food')*.68));
 p.food-=8;market.stock.food++;p.gold+=price;if(site.faction!==p.origin){setFactionRelation(p.origin,site.faction,factionRelation(p.origin,site.faction)+1);setFactionTension(p.origin,site.faction,factionTension(p.origin,site.faction)-1)}log('Sold eight provisions in '+site.name+' for '+price+' denars.');
 refreshUI();saveGame(true);showTown(site.id);
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
 const market=ensureMarket(site);market.capacity.grain=resourceCapacity('grain',site);market.stock.grain=Math.min(market.capacity.grain,market.stock.grain+12);
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
 ];
}
function renderTownContracts(townId){
 const active=state.player.activeContracts,offers=contractOffers(townId),completed=new Set(state.completedContracts||[]);
 const current=active.map(c=>'<article class="contract-card active"><div><b>📜 '+esc(c.title)+'</b><small>'+esc(c.description)+' · Reward '+c.reward+' denars</small></div><span>ACTIVE</span></article>').join('');
 const board=offers.map(c=>{const claimed=completed.has(c.id),already=active.some(a=>a.id===c.id),full=active.length>=3;
  return '<article class="contract-card"><div><b>'+esc(c.title)+'</b><small>'+esc(c.description)+' · '+c.reward+' denars · '+c.xp+' XP</small></div><button class="btn small" data-contract-accept="'+esc(c.id)+'" '+(claimed||already||full?'disabled':'')+'>'+(claimed?'Claimed':already?'Accepted':full?'Party full':'Accept')+'</button></article>'
 }).join('');
 return '<div class="smallcaps">ACTIVE CONTRACTS · '+active.length+'/3</div>'+(current||'<p class="subtle">No contracts underway.</p>')+'<div class="smallcaps contract-board-title">AVAILABLE WORK</div>'+board;
}
function acceptContract(contractId,townId){
 const p=state.player;if(p.activeContracts.length>=3){notify('Your company can carry three contracts at a time.');return}
 const offer=contractOffers(townId).find(c=>c.id===contractId);
 if(!offer||(state.completedContracts||[]).includes(contractId)||p.activeContracts.some(c=>c.id===contractId))return;
 p.activeContracts.push(offer);log('Accepted contract: '+offer.title+'.');saveGame(true);refreshUI();showTown(townId);
}
function completeContract(contractId){
 const p=state.player,index=p.activeContracts.findIndex(c=>c.id===contractId);if(index<0)return;
 const c=p.activeContracts.splice(index,1)[0];p.gold+=c.reward;grantXP(c.xp);p.renown+=1;
 if(Number.isInteger(c.faction)){changeStanding(c.faction,5);if(c.faction!==p.origin){setFactionRelation(p.origin,c.faction,factionRelation(p.origin,c.faction)+2);setFactionTension(p.origin,c.faction,factionTension(p.origin,c.faction)-2)}}
 state.completedContracts=state.completedContracts||[];state.completedContracts.push(c.id);
 log('Contract complete: '+c.title+'. +'+c.reward+' denars, +'+c.xp+' XP.');notify('Contract complete · '+c.title+' · +'+c.reward+' denars');
}
function equipItem(id){
 const item=ITEMS[id],p=state?.player;if(!item?.slot||!p)return;
 if((p.inventory[id]||0)<1){notify('You do not have that item.');return}
 const slot=item.slot,old=p.equipment[slot];p.inventory[id]--;
 if(old)grantItem(old,1);p.equipment[slot]=id;
 log('Equipped '+item.name+'.');refreshUI();saveGame(true);showCharacter();
}
function improveStat(name){
 const p=state?.player;if(!p||!p.statPoints||!Object.prototype.hasOwnProperty.call(p.stats,name))return;
 p.stats[name]++;p.statPoints--;if(name==='strength')p.maxHp=(p.maxHp||100)+2;
 log('Improved '+name+'.');saveGame(true);refreshUI();showCharacter();
}
function learnPerk(id){
 const p=state?.player;if(!p||p.perkPoints<1||!PERKS[id]||p.perks.includes(id))return;
 p.perkPoints--;p.perks.push(id);log('Learned the '+PERKS[id].name+' perk.');
 notify('Perk learned · '+PERKS[id].name);saveGame(true);refreshUI();showCharacter();
}
function upgradeRoster(index){
 const p=state.player,g=p.roster[index];if(!g||g.count<1||g.tier>=2)return;
 const cost=g.count*(g.tier===0?75:135);
 if(p.gold<cost){notify('Training and equipment cost '+cost+' denars.');return}
 p.gold-=cost;g.tier++;p.renown++;log('Promoted '+g.count+' troops into '+troopName(g)+'.');
 notify('Troops upgraded along their faction template.');refreshUI();saveGame(true);
}
function openEncounter(party){
 if(!state||!party?.active||menuOpen)return;
 state.followPartyId=null;state.path=[];state.pathIndex=0;state.targetSettlement=null;
 selected={type:'party',id:party.id};inspectorDirty=true;
 const kind=party.kind;
 $('encounterName').textContent=partyName(party);
 $('encounterIntro').textContent=kind==='bandit'?
  'Armed outlaws block your road. They eye your company and await your decision.':
  kind==='caravan'?'A merchant caravan slows. Its guards watch your approach.':
  'A column of soldiers halts beneath its banners. Their captain awaits you.';
 $('encounterOwnCount').textContent=rosterCount()+' troops · '+state.player.name;
 $('encounterOwnDetail').textContent='Health '+state.player.hp+'% · '+Math.min(50,state.player.roster.reduce((n,g)=>n+g.count-(g.wounded||0),0))+
  ' available combatants (maximum 50 deployed)';
 $('encounterEnemyCount').textContent=party.strength+' '+(kind==='bandit'?'outlaws':kind==='caravan'?'travelers':'soldiers');
 $('encounterEnemyDetail').textContent=kind==='bandit'?'Hostile raiders':
  F[party.faction].name+' · '+(kind==='patrol'?'Guarding the realm':'Trading goods');
 $('encounterDialogue').innerHTML='<b>The party stops before you.</b><p>You can speak, trade, fight or leave. The choice is yours.</p>';
 $('encounterTrade').disabled=kind==='bandit';
 $('encounterTrade').textContent=kind==='caravan'?'🪙 Buy caravan provisions':'📜 Ask for news';
 openModal('screenEncounter');
}
function launchCampaignBattle(party){
 if(!party?.active||!state)return;
 const troops=[];
 for(let groupIndex=0;groupIndex<state.player.roster.length;groupIndex++){
  const g=state.player.roster[groupIndex],n=Math.max(0,g.count-(g.wounded||0));
  for(let slot=0;slot<n&&troops.length<50;slot++)
   troops.push({groupIndex,slot,faction:g.faction,tier:g.tier});
 }
 const sessionId='battle-'+Date.now().toString(36)+'-'+Math.floor(Math.random()*1e7).toString(36);
  const tile=W.tileAt(state.player.x,state.player.y),battleSeed=Math.abs((party.id*31+Math.floor(state.player.x/90)*17+Math.floor(state.player.y/90)*13+state.day*7)%50);
  const session={status:'active',sessionId,partyId:party.id,kind:party.kind,
  faction:party.faction,enemyCount:Math.min(50,party.strength),
   playerName:state.player.name,heroHealth:state.player.hp,playerMorale:state.player.morale,level:state.player.level,troops,
   equipment:state.player.equipment,inventory:state.player.inventory,stats:state.player.stats,perks:state.player.perks,
   terrainKind:tile.kind,battleX:state.player.x,battleY:state.player.y,mapSeed:battleSeed,
  reserveCount:Math.max(0,state.player.roster.reduce((n,g)=>n+g.count-(g.wounded||0),0)-troops.length)};
 state.pendingBattleId=sessionId;
 state.lastEncounter=state.day+state.hour/24;
 state.followPartyId=null;state.path=[];state.pathIndex=0;
 if(!saveGame(true)){notify('Browser storage is needed for campaign battles.');return}
 try{localStorage.setItem('ua-campaign-battle-session-v1',JSON.stringify(session))}
 catch(e){notify('Could not open battle. Please allow local browser storage.');return}
 window.location.href='campaign-battle.html?campaign=1';
}
function skirmish(id){
 const party=state?.parties.find(p=>p.id===id&&p.active);
 if(!party)return;
 if(dist(state.player.x,state.player.y,party.x,party.y)>155){followParty(id);return}
 launchCampaignBattle(party);
}
function consumeBattleResult(){
 if(!state?.pendingBattleId)return false;
 let result=null;
 try{result=JSON.parse(localStorage.getItem('ua-campaign-battle-result-v1')||'null')}catch(e){}
 if(!result||result.sessionId!==state.pendingBattleId)return false;
 try{
  localStorage.removeItem('ua-campaign-battle-result-v1');
  localStorage.removeItem('ua-campaign-battle-session-v1');
 }catch(e){}
 state.pendingBattleId=null;state.followPartyId=null;
 const p=state.player,party=state.parties.find(a=>a.id===result.partyId);
 if(party?.kind==='patrol'){
  changeStanding(party.faction,-18);
  if(party.faction!==p.origin&&!factionsAtWar(p.origin,party.faction)){setFactionRelation(p.origin,party.faction,factionRelation(p.origin,party.faction)-8);setFactionTension(p.origin,party.faction,factionTension(p.origin,party.faction)+18);recordDiplomacy('A clash with '+F[party.faction].name+' patrols strained relations with '+F[p.origin].name+'.')}
  const war=state.diplomacy.wars.find(w=>(w.a===p.origin||w.b===p.origin)&&(w.a===party.faction||w.b===party.faction));if(war&&result.winner==='friend')war.score=(war.score||0)+(war.attacker===p.origin?1:-1);
  log('Attacking a realm patrol damaged your standing with '+F[party.faction].name+'.');
 }else if(party?.kind==='caravan'){
  changeStanding(party.faction,-28);log('Raiding a merchant caravan damaged your standing with '+F[party.faction].name+'.');
 }
 const casualties={killed:0,wounded:0,survivors:0};
 for(const fighter of result.entries||[]){
  const group=p.roster[fighter.groupIndex];if(!group)continue;
  if(fighter.result==='killed'||fighter.result==='surrendered'){
   group.count=Math.max(0,group.count-1);casualties.killed++;
  }else if(fighter.result==='incapacitated'){
   group.wounded=Math.min(group.count,(group.wounded||0)+1);casualties.wounded++;
  }else casualties.survivors++;
 }
 p.roster=p.roster.filter(g=>g.count>0);
 p.hp=Math.max(14,Math.round(100*Math.max(0,result.heroHp)/Math.max(1,result.heroMaxHp)));
  p.inventory.arrows=Math.max(0,(p.inventory.arrows||0)-(result.heroAmmoSpent||0));
  p.inventory.stones=Math.max(0,(p.inventory.stones||0)-(result.stonesSpent||0));
 let reason;
 if(result.winner==='friend'){
   p.morale=clamp(p.morale+3-casualties.wounded*1.2-casualties.killed*3,0,100);
  if(party?.kind==='bandit'){
   const local=W.closestSettlement(p.x,p.y);if(local)changeStanding(local.faction,3);
  }
   const loot=65+(party?.strength||result.enemyInitial||5)*12;
  const exp=50+(party?.strength||result.enemyInitial||5)*8;
   p.gold+=loot;grantXP(exp);p.renown+=party?.kind==='bandit'?3:1;
  p.food+=party?.kind==='caravan'?5:1;
  if(party)party.active=false;
   const drops=['arrows','stones','sword','leatherArmor','buckler'];
   const drop=drops[Math.abs((party?.id||0)*11+(party?.strength||5)+state.day)%drops.length];grantItem(drop,drop==='arrows'?12:drop==='stones'?6:1);
   reason='Victory. You recovered '+loot+' denars, '+exp+' experience and '+ITEMS[drop].name+'.';
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
 selected={type:'land'};inspectorDirty=true;state.lastEncounter=state.day+state.hour/24;
 $('aftermathTitle').textContent=result.winner==='friend'?'⚔ Victory':
  result.winner==='retreat'?'↩ Withdrawn from battle':'⚑ Battle lost';
 $('aftermathDetails').innerHTML='<b>'+esc(reason)+'</b><p>'+
  casualties.killed+' killed or captured · '+casualties.wounded+' incapacitated · '+
  casualties.survivors+' returned from battle. Hero health '+p.hp+'% · Company morale '+Math.round(p.morale)+
  '/100. Wounded troops recover at inns.</p>';
 saveGame(true);refreshUI();modalStack=[];showScreen('screenAftermath');
 return true;
}
function chooseSelection(x,y){
 const local=toScreen(x,y),allow=28;
 let site=null,sd=allow;
 for(const s of S){
  const p=toScreen(s.x,s.y),d=dist(local.x,local.y,p.x,p.y);
  if(d<sd){sd=d;site=s}
 }
 if(site){
  selected={type:'settlement',id:site.id};inspectorDirty=true;
  if(dist(state.player.x,state.player.y,site.x,site.y)>155)travelTo(site.x,site.y,site.id);
  else showTown(site.id);
  return;
 }
 let party=null,pd=19;
 for(const p of state.parties)if(p.active){
  const m=toScreen(p.x,p.y),d=dist(m.x,m.y,local.x,local.y);
  if(d<pd){pd=d;party=p}
 }
 if(party){selected={type:'party',id:party.id};inspectorDirty=true;followParty(party.id);return}
  let landmark=null,ld=22;
 for(const place of W.landmarks||[]){
  const v=toScreen(place.x,place.y),d=dist(local.x,local.y,v.x,v.y);
  if(d<ld){ld=d;landmark=place}
 }
 if(landmark){
  selected={type:'landmark',id:landmark.id};inspectorDirty=true;
  if(dist(state.player.x,state.player.y,landmark.x,landmark.y)>145){travelTo(landmark.x,landmark.y,null);notify('Traveling to '+landmark.name+'.');}
  else exploreLandmark(landmark.id);
  return;
 }
 selected={type:'land',x,y};inspectorDirty=true;travelTo(x,y,null);
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
function drawLocations(){
 if(camera.zoom<.24){
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 44px Georgia,serif';
  for(const f of F){ctx.fillStyle=colorAlpha(f.color,.8);ctx.fillText(f.name.toUpperCase(),f.capital[0],f.capital[1]+360)}
 }
 for(const s of S){
  if(s.type==='village'&&camera.zoom<.20)continue;
  if(!inView(s.x,s.y,190))continue;
  const f=F[s.faction],r=s.type==='capital'?22:s.type==='castle'?16:s.type==='town'?14:9;
  const isSel=selected?.type==='settlement'&&selected.id===s.id;
  if(isSel){ctx.beginPath();ctx.arc(s.x,s.y,r+19,0,6.283);ctx.strokeStyle='#ffe5a5';ctx.lineWidth=4;ctx.stroke()}
  ctx.fillStyle='#172b24d9';ctx.beginPath();ctx.arc(s.x,s.y,r+7,0,6.283);ctx.fill();
  ctx.strokeStyle=colorAlpha(f.color,.95);ctx.lineWidth=4;ctx.stroke();
  ctx.fillStyle=s.type==='village'?'#dac6a6':'#ded2b4';
  if(s.type==='village'){
   ctx.beginPath();ctx.moveTo(s.x-r,s.y);ctx.lineTo(s.x,s.y-r*.9);ctx.lineTo(s.x+r,s.y);ctx.closePath();ctx.fill();
   ctx.fillRect(s.x-r*.63,s.y,r*1.26,r*.69);
  }else{
   ctx.fillRect(s.x-r*.78,s.y-r*.53,r*1.56,r*1.23);
   for(let i=-1;i<=1;i++)ctx.fillRect(s.x+i*r*.62-r*.22,s.y-r*.93,r*.44,r*.57);
   ctx.fillStyle='#30413a';ctx.fillRect(s.x-r*.16,s.y,r*.32,r*.69);
  }
  if(s.type==='capital')drawFlag(s.x+r+3,s.y,f);
  if(state.options.labels&&(camera.zoom>.17||s.type==='capital')){
   ctx.font=(s.type==='capital'?'bold 22px':'600 17px')+' Georgia,serif';
   ctx.textAlign='center';ctx.textBaseline='top';ctx.lineWidth=5;ctx.strokeStyle='#0b1b17eb';ctx.strokeText(s.name,s.x,s.y+r+12);
   ctx.fillStyle='#fff2d2';ctx.fillText(s.name,s.x,s.y+r+12);
  }
 }
 // Discoverable world locations add life between settlements.
 if(camera.zoom>.23)for(const place of W.landmarks||[]){
  if(!inView(place.x,place.y,110))continue;
  const explored=state.visitedLandmarks.includes(place.id);
  ctx.fillStyle=explored?'#53665bd9':'#4b3d2cf2';
  ctx.beginPath();ctx.arc(place.x,place.y,16,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=selected?.type==='landmark'&&selected.id===place.id?'#fff4ba':'#d5bc8ba8';
  ctx.lineWidth=3;ctx.stroke();
  ctx.fillStyle=explored?'#abb9a5':'#ffe4ad';
  ctx.font='bold 21px Georgia,serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(place.icon,place.x,place.y+1);
  if(camera.zoom>.51){
   ctx.textBaseline='top';ctx.font='bold 15px Georgia,serif';
   ctx.strokeStyle='#0b2118';ctx.lineWidth=4;ctx.strokeText(place.name,place.x,place.y+24);
   ctx.fillStyle='#f5e0b8';ctx.fillText(place.name,place.x,place.y+24);
  }
 }
}
function drawParties(){
 for(const p of state.parties)if(p.active&&inView(p.x,p.y,100)){
  const f=p.faction>=0?F[p.faction]:null,c=p.kind==='bandit'?'#d47d70':f.color;
  ctx.fillStyle='#0d1d18d9';ctx.beginPath();ctx.arc(p.x,p.y,15,0,6.283);ctx.fill();
  ctx.lineWidth=3;ctx.strokeStyle=c;ctx.stroke();
  if(state.followPartyId===p.id){
   ctx.strokeStyle='#ffe5a9';ctx.lineWidth=3.5;
   ctx.beginPath();ctx.arc(p.x,p.y,26,0,Math.PI*2);ctx.stroke();
  }
  ctx.fillStyle=c;
  if(p.kind==='bandit'){ctx.beginPath();ctx.moveTo(p.x,p.y-11);ctx.lineTo(p.x+10,p.y+10);ctx.lineTo(p.x-10,p.y+10);ctx.fill()}
  else if(p.kind==='caravan'){ctx.fillRect(p.x-8,p.y-6,16,11);ctx.beginPath();ctx.arc(p.x-6,p.y+7,4,0,6.283);ctx.arc(p.x+6,p.y+7,4,0,6.283);ctx.fill()}
  else{ctx.beginPath();ctx.moveTo(p.x,p.y-11);ctx.lineTo(p.x+11,p.y);ctx.lineTo(p.x,p.y+11);ctx.lineTo(p.x-11,p.y);ctx.fill()}
  if(camera.zoom>.38){ctx.textAlign='center';ctx.textBaseline='top';ctx.font='bold 13px system-ui';ctx.strokeStyle='#071611';ctx.lineWidth=4;
   const label=(p.kind==='bandit'?'Bandits ':p.kind==='patrol'?'Patrol ':'Caravan ')+p.strength;
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
 $('hudDay').textContent='Day '+state.day+' · '+String(Math.floor(state.hour)).padStart(2,'0')+':00';
 $('hudRegion').textContent=region.name;
 $('hudParty').textContent=rosterCount()+'/'+MAXPARTY;
 $('hudGold').textContent=p.gold.toLocaleString();
 $('hudFood').textContent=String(p.food);
  $('hudPause').textContent=state.pausedManual?'▶ Resume':'⏸ Pause';
  $('mobilePause').textContent=state.pausedManual?'▶':'Ⅱ';
  document.querySelectorAll('.speed-choice').forEach(b=>b.classList.toggle('selected',Number(b.dataset.speed)===state.speed));
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
 $('travelText').textContent=state.followPartyId!=null?
  'Following '+partyName(state.parties.find(p=>p.id===state.followPartyId))+' · updating route':
  state.path.length?'Traveling · '+Math.max(0,state.path.length-state.pathIndex)+' route steps remaining':
  'Click to travel · WASD to walk · Drag to pan · Scroll to zoom';
 $('minimapHolder').classList.toggle('hidden',!state.options.minimap);
 if(selected?.type==='party'&&state.followPartyId!=null)inspectorDirty=true;
 if(inspectorDirty)refreshInspector();
}
function exploreLandmark(id){
 const place=W.landmarks.find(v=>v.id===id);if(!place||!state)return;
 if(dist(state.player.x,state.player.y,place.x,place.y)>145){
  travelTo(place.x,place.y,null);return;
 }
 if(state.visitedLandmarks.includes(id)){notify('Already explored this landmark.');return}
 state.visitedLandmarks.push(id);
 for(const c of [...state.player.activeContracts])if(c.type==='survey'&&(c.landmarkId==null||c.landmarkId===id))completeContract(c.id);
 const food=['camp','grove','ford'].includes(place.kind)?5:2;
 const gold=['ruins','watchtower','shrine'].includes(place.kind)?45:15;
 const biome=W.tileAt(place.x,place.y).kind,resource=['forest','taiga','rainforest'].includes(biome)?'timber':['mountain','hills'].includes(biome)?'iron':['desert','scrub'].includes(biome)?'salt':['steppe','grass','marsh'].includes(biome)?'grain':'tools',found=2+Math.floor(W.hash(id,state.day+71)*4);
 state.player.food+=food;state.player.gold+=gold;grantItem(resource,found);grantXP(20);
 log('Explored '+place.name+'. Found '+food+' provisions, '+found+' '+resource+', '+gold+' denars and gained 20 XP.');
 notify(place.name+' explored · +'+food+' food · +'+found+' '+resource+' · +'+gold+' denars · +20 XP');
 inspectorDirty=true;refreshUI();saveGame(true);
}
function renderActions(items){return items.map(a=>'<button class="btn'+(a.primary?' primary':'')+'" data-act="'+a.act+'"'+(a.id!==undefined?' data-id="'+a.id+'"':'')+(a.disabled?' disabled':'')+'>'+esc(a.label)+'</button>').join('')}
function setTownView(name,focusTab=false){
 const tabs=[...document.querySelectorAll('.town-nav [data-town-view]')],panels=[...document.querySelectorAll('[data-town-panel]')];
 if(!tabs.some(tab=>tab.dataset.townView===name))name='overview';
 for(const tab of tabs){const active=tab.dataset.townView===name;tab.setAttribute('aria-selected',active?'true':'false');tab.tabIndex=active?0:-1;if(active&&focusTab)tab.focus()}
 for(const panel of panels)panel.hidden=panel.dataset.townPanel!==name;
 const modal=$('screenTown')?.querySelector('.town-modal');if(modal)modal.dataset.townView=name;
}
function townRumor(site){
 const nearby=state.parties.filter(p=>p.active&&dist(site.x,site.y,p.x,p.y)<1050)
  .sort((a,b)=>dist(site.x,site.y,a.x,a.y)-dist(site.x,site.y,b.x,b.y))[0];
 if(!nearby){const worldNews=state.diplomacy?.history?.[0];if(worldNews&&state.day-worldNews.day<=4)return 'Travelers bring word from the wider realm: '+worldNews.text;return 'The roads around '+site.name+' are quiet for now. Local traders are watching the weather and waiting for the next caravan.';}
 const nearest=W.closestSettlement(nearby.x,nearby.y)?.name||'the nearby roads';
 if(nearby.kind==='bandit')return 'Travelers warn that Outlaw Bandits were seen near '+nearest+'. Keep a watch on the road.';
 if(nearby.kind==='patrol')return (F[nearby.faction]?.name||'A local')+' patrol is moving near '+nearest+'.';
 return 'Merchants say a '+partyName(nearby).toLowerCase()+' passed near '+nearest+' recently.';
}
function refreshInspector(){
 if(!state||!selected){selected={type:'land'}}
 const box=$('inspectorContent');let html='';
 if(selected.type==='settlement'){
  const site=S[selected.id],f=F[site.faction],distance=Math.round(dist(state.player.x,state.player.y,site.x,site.y));
  const close=distance<=155;
  html='<div class="smallcaps">'+site.type.toUpperCase()+' · '+esc(f.name)+'</div><h2>'+esc(site.name)+'</h2><div class="banner-strip" style="background:'+f.color+'"></div>';
  html+='<p>'+esc(f.culture)+'. Population '+(site.prosperity*120).toLocaleString()+' · garrison '+site.garrison+'.</p>';
  html+='<div class="eventbox"><b>'+esc(f.symbol)+' '+esc(f.motto)+'</b><p>'+esc(f.trait)+'.</p></div>';
  html+='<div class="smallcaps">'+(close?'YOU ARE AT THE GATES':'DISTANCE: '+distance+' MAP UNITS')+'</div>';
  if(close){const terms=recruitmentTerms(site);html+=renderActions([{act:'visit',id:site.id,label:'🏰 Enter settlement',primary:true},{act:'recruit',id:site.id,label:terms.access?'⚔ Recruit up to '+terms.count+' · '+terms.unit+' denars each':'⚔ Recruitment denied · outlawed',disabled:!terms.access||terms.count<1},{act:'food',id:site.id,label:'🍞 Buy provisions at local market'},{act:'rest',id:site.id,label:'🛌 Rest at an inn · 20 denars'},{act:'rumors',id:site.id,label:'📜 Ask for local rumors'}])}
  else html+=renderActions([{act:'travelSettlement',id:site.id,label:'➤ Travel to '+site.name,primary:true}]);
  html+='<p class="subtle">Faction troop progression: '+f.troops.map(esc).join(' → ')+'.</p>';
 }else if(selected.type==='party'){
  const enemy=state.parties.find(p=>p.id===selected.id);
  if(!enemy||!enemy.active){selected={type:'land'};return refreshInspector()}
  const label=enemy.kind==='bandit'?'Outlaw Bandits':enemy.kind==='patrol'?F[enemy.faction].name+' Patrol':F[enemy.faction].name+' Caravan';
  html='<div class="smallcaps">ROAMING PARTY</div><h2>'+esc(label)+'</h2><div class="banner-strip" style="background:'+(enemy.kind==='bandit'?'#c57966':F[enemy.faction].color)+'"></div>';
  html+='<p>Party size: <b>'+enemy.strength+'</b>. Distance: '+Math.round(dist(state.player.x,state.player.y,enemy.x,enemy.y))+' map units.</p>';
  html+='<div class="eventbox"><b>'+esc(enemy.kind==='bandit'?'Hostile raiders':'Traveling party')+'</b><p>'+
   (enemy.kind==='bandit'?'Bandits threaten the roads. Follow them to negotiate, flee, or enter a real battle.':
   (enemy.targetPartyId!=null?(enemy.kind==='patrol'?'Patrolling against nearby outlaws.':enemy.kind==='bandit'?'Hunting a merchant caravan.':'Moving between markets.'):
    'You can speak, trade or challenge this party after catching it.'))+'</p></div>';
  const nearby=dist(state.player.x,state.player.y,enemy.x,enemy.y)<=155;
  html+=renderActions([{act:'travelParty',id:enemy.id,
   label:state.followPartyId===enemy.id?'◎ Following · route updating':'➤ Follow moving party',primary:true},
   {act:'meetParty',id:enemy.id,label:'💬 Meet this party',disabled:!nearby}]);
 }else if(selected.type==='landmark'){
  const place=W.landmarks.find(a=>a.id===selected.id);
  if(!place){selected={type:'land'};return refreshInspector()}
  const d=Math.round(dist(state.player.x,state.player.y,place.x,place.y));
  const visited=state.visitedLandmarks.includes(place.id);
  html='<div class="smallcaps">LANDMARK · '+esc(W.factions[place.faction]?.name||'Wilderness')+'</div>'+
   '<h2>'+esc(place.icon)+' '+esc(place.name)+'</h2>'+
   '<div class="banner-strip" style="background:#bda66f"></div>'+
   '<p>Scattered through the countryside are old ruins, waystations and hidden places. Distance: '+d+' map units.</p>'+
   '<div class="eventbox"><b>'+(visited?'Already explored':'Unexplored destination')+
   '</b><p>'+(visited?'Your company remembers the discoveries made here.':
   'Travel here to explore this location, gather supplies or recover something valuable.')+'</p></div>';
  html+=renderActions([{act:d<=145?'exploreLandmark':'travelLandmark',id:place.id,
   label:d<=145?'⚑ Explore this location':'➤ Travel to '+place.name,
   primary:true,disabled:d<=145&&visited}]);
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
 $('factionDetail').innerHTML='<h3><span style="color:'+f.color+'">'+esc(f.symbol)+'</span> '+esc(f.name)+'</h3><p>'+esc(f.culture)+'. '+esc(f.trait)+'.</p><p><em>'+esc(f.motto)+'</em></p><div class="smallcaps">FACTION TROOP TREE · PRESET UPGRADES</div><div class="trooptree">'+f.troops.map((n,i)=>'<div><small>Tier '+(i+1)+'</small>'+esc(n)+'</div>').join('')+'</div><p class="subtle">Capital: '+esc(f.cities[0])+' · 8 settlements. Faction troops use these upgrades unless you eventually found your own faction.</p><div class="diplomacy-board"><b>Foreign affairs · '+esc(current)+'</b><div class="diplomacy-relations">'+relationList+'</div><details><summary>Recent world news</summary><ul>'+news+'</ul></details></div><p><b>Your standing:</b> '+standingLabel(standing)+' ('+(standing>0?'+':'')+standing+') · <b>Recruiting:</b> '+(standing<=-60?'denied':standing>=40?'up to six volunteers at a discount':'available')+'. Contracts improve standing and trusted travelers pay less.</p>';
}
function openFactions(){
 $('factionGrid').innerHTML=F.map(f=>'<button class="faction-card" data-faction="'+f.id+'"><span class="faction-flag" style="background:'+f.color+'">'+esc(f.symbol)+'</span><span><strong>'+esc(f.name)+'</strong><small>'+esc(f.culture)+'</small><small>'+esc(f.trait)+'</small><small class="faction-peace">'+esc(factionDiplomacyLabel(f.id))+'</small></span></button>').join('');
 openModal('screenFactions');showFactionDetails(selectedFaction);
}
function showParty(){
 if(!state)return;
 const p=state.player;
 $('partyModalContent').innerHTML='<p>Your party has '+rosterCount()+' of '+MAXPARTY+' available spaces. Soldiers follow their original faction troop upgrade tree.</p>'+p.roster.map((g,i)=>{
  const upgrade=g.tier<2?' · Upgrade cost '+(g.count*(g.tier===0?75:135))+' denars':' · Elite tier';
  return '<div class="eventbox"><b>'+g.count+' × '+esc(troopName(g))+'</b><p>'+esc(F[g.faction].name)+upgrade+'</p>'+(g.tier<2?'<button class="btn" data-upgrade="'+i+'">⬆ Promote to '+esc(F[g.faction].troops[g.tier+1])+'</button>':'')+'</div>';
 }).join('')+'<p class="subtle">Custom equipment and creating new troop trees unlock when founding your own faction. That campaign feature is planned, not available yet.</p>';
 openModal('screenParty');
}
function showCharacter(){
 if(!state)return;const p=state.player,f=F[p.origin];
 const stats=Object.entries({strength:'Strength',agility:'Agility',tactics:'Tactics',leadership:'Leadership'}).map(([key,label])=>'<div class="attribute"><b>'+label+'</b><strong>'+p.stats[key]+'</strong><button class="btn small" data-stat="'+key+'" '+(p.statPoints?'':'disabled')+'>＋</button></div>').join('');
 const slots=Object.entries(ITEM_SLOT_LABELS).map(([key,label])=>'<div class="gear-slot"><small>'+label+'</small><b>'+(ITEMS[p.equipment[key]]?.icon||'—')+' '+esc(ITEMS[p.equipment[key]]?.name||'Empty')+'</b></div>').join('');
 const inventory=Object.entries({...p.inventory,food:p.food}).filter(([,count])=>count>0).map(([id,count])=>{const it=ITEMS[id];if(!it)return'';let comparison='';if(it.slot){const delta=it.rating-(ITEMS[p.equipment[it.slot]]?.rating||0);comparison=it.slot==='quiver'?'Choose your ammo type':(delta>0?'Better by '+delta:delta<0?'Lower by '+Math.abs(delta):'Similar rating');}return '<div class="inventory-item"><span>'+it.icon+' '+esc(it.name)+' <small>×'+count+(comparison?' · '+comparison:'')+'</small></span>'+(it.slot?'<button class="btn small" data-equip="'+id+'">Equip</button>':'')+'</div>'}).join('')||'<p class="subtle">Your pack is empty.</p>';
 const perkChoices=Object.entries(PERKS).map(([id,perk])=>'<article class="perk-card"><div><b>'+perk.icon+' '+esc(perk.name)+'</b><small>'+esc(perk.description)+'</small></div><button class="btn small" data-perk="'+id+'" '+(p.perkPoints<1||p.perks.includes(id)?'disabled':'')+'>'+(p.perks.includes(id)?'Learned':'Learn')+'</button></article>').join('');
 const learned=p.perks.length?p.perks.map(id=>'<span class="statuspill">'+PERKS[id].icon+' '+esc(PERKS[id].name)+'</span>').join(' '):'<p class="subtle">Choose a perk when you earn a perk point. One is granted every three levels.</p>';
 $('characterModalContent').innerHTML='<div class="hero-card"><div class="hero-icon">'+esc(f.symbol)+'</div><div class="hero-name">'+esc(p.name)+'</div><div class="hero-sub">'+esc(f.culture)+' · '+esc(p.background)+'</div><div class="statgrid"><div class="stat"><div class="stat-label">Level</div><div class="stat-value">'+p.level+'</div></div><div class="stat"><div class="stat-label">Experience</div><div class="stat-value">'+p.xp+'/'+(p.level*125)+'</div></div><div class="stat"><div class="stat-label">Renown</div><div class="stat-value">'+p.renown+'</div></div><div class="stat"><div class="stat-label">Health</div><div class="stat-value">'+p.hp+'%</div></div><div class="stat"><div class="stat-label">Company morale</div><div class="stat-value">'+Math.round(p.morale)+'/100</div></div></div></div><div class="section-caption">CHARACTER ATTRIBUTES · '+p.statPoints+' POINTS</div><div class="attributes">'+stats+'</div><div class="section-caption">PERKS · '+p.perkPoints+' POINTS · '+p.perks.length+' LEARNED</div><div class="perk-list">'+learned+perkChoices+'</div><div class="section-caption">EQUIPPED GEAR</div><div class="gear-slots">'+slots+'</div><div class="section-caption">INVENTORY</div><div class="inventory-list">'+inventory+'</div><p class="subtle">Gear ratings compare equipment within its slot. Bow attacks need arrows; a stone pouch enables manual rock throws.</p>';
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
  Array.isArray(raw.player.roster)&&raw.player.roster.every(g=>Number.isInteger(g.faction)&&g.faction>=0&&g.faction<F.length&&
   Number.isInteger(g.tier)&&g.tier>=0&&g.tier<=2&&Number.isFinite(g.count)&&g.count>=0);
}
function applySaveImport(raw,label){
 if(!validateSave(raw)){notify('That file is not a valid Untitled Armies campaign save.');return false}
 try{
  const previous=localStorage.getItem(KEY);if(previous){localStorage.setItem(KEY+'-backup-2',localStorage.getItem(KEY+'-backup-1')||previous);localStorage.setItem(KEY+'-backup-1',previous)}
  localStorage.setItem(KEY,JSON.stringify(raw));
  if(!loadGame())return false;
  refreshContinue();notify(label+' loaded.');return true;
 }catch(e){notify('Could not import the save. Check available device storage.');return false}
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
function setSpeed(value){if(!state)return;state.speed=[1,2,4].includes(value)?value:1;state.pausedManual=false;state.paused=menuOpen;refreshUI();saveGame(true)}
function togglePause(){if(!state)return;state.pausedManual=!state.pausedManual;state.paused=menuOpen||state.pausedManual;refreshUI()}
button('encounterTalk',()=>{
 const p=state?.parties.find(x=>x.id===selected?.id);if(!p)return;
 const line=p.kind==='bandit'?'The outlaw chief demands coin and threatens passing villagers.':
  p.kind==='caravan'?'The merchants seek a market in '+W.closestSettlement(p.x,p.y).name+'.':
  'The patrol captain warns of raiders and trouble at the border.';
 $('encounterDialogue').innerHTML='<b>'+esc(partyName(p))+'</b><p>'+esc(line)+'</p>';
});
button('encounterTrade',()=>{
 const party=state?.parties.find(x=>x.id===selected?.id);if(!party)return;
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
button('encounterLeave',()=>{
 state.lastEncounter=state.day+state.hour/24;state.followPartyId=null;
 state.path=[];state.pathIndex=0;closeModal();notify('You leave the party behind.');
});
button('aftermathContinue',()=>{showScreen(null);refreshUI()});
button('menuNew',()=>{lockLandscape();selectNew()});button('menuContinue',()=>{lockLandscape();loadGame()});
button('menuFactions',openFactions);button('menuAtlas',openAtlas);button('menuOptions',showOptions);
button('createStart',()=>{lockLandscape();startCampaign()});button('createCancel',()=>showScreen('screenMenu'));
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
button('btnSidebar',()=>$('sidebar').classList.toggle('mobile-hide'));
button('btnInspect',()=>$('inspector').classList.toggle('mobile-hide'));
button('partyClose',closeModal);
button('characterClose',closeModal);
button('townLeave',closeModal);
button('btnZoomIn',()=>zoomAt(1.32));
button('btnZoomOut',()=>zoomAt(1/1.32));
button('btnCenter',()=>{resetView();notify('Camera following your character.')});
button('btnOverview',()=>{focus=false;camera.x=W.WIDTH/2;camera.y=W.HEIGHT/2;camera.zoom=.115});
document.querySelectorAll('.speed-choice').forEach(b=>b.addEventListener('click',()=>setSpeed(Number(b.dataset.speed))));
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
$('factionGrid').addEventListener('click',e=>{const b=e.target.closest('[data-faction]');if(b)showFactionDetails(Number(b.dataset.faction))});
$('partyModalContent').addEventListener('click',e=>{const b=e.target.closest('[data-upgrade]');if(b){upgradeRoster(Number(b.dataset.upgrade));showParty()}});
$('characterModalContent').addEventListener('click',e=>{const equip=e.target.closest('[data-equip]'),stat=e.target.closest('[data-stat]'),perk=e.target.closest('[data-perk]');if(equip)equipItem(equip.dataset.equip);else if(stat)improveStat(stat.dataset.stat);else if(perk)learnPerk(perk.dataset.perk)});
$('screenTown').addEventListener('click',e=>{
 const destination=e.target.closest('[data-town-view]');
 if(destination){setTownView(destination.dataset.townView);return}
 const action=e.target.closest('[data-act]');if(action){performSettlementAction(action.dataset.act,Number(action.dataset.id));return}
 const item=e.target.closest('[data-buy-item]');if(item){buyItem(item.dataset.buyItem);return}
 const sold=e.target.closest('[data-sell-resource]');if(sold){sellResource(sold.dataset.sellResource);return}
 if(e.target.closest('[data-sell-food]')){sellFood();return}
 const contract=e.target.closest('[data-contract-accept]');if(contract)acceptContract(contract.dataset.contractAccept,state.currentTownId);
});
document.querySelector('.town-nav').addEventListener('keydown',e=>{
 const current=e.target.closest('[data-town-view]');if(!current)return;
 const tabs=[...document.querySelectorAll('.town-nav [data-town-view]')],index=tabs.indexOf(current);let next=index;
 if(e.key==='ArrowRight')next=(index+1)%tabs.length;else if(e.key==='ArrowLeft')next=(index-1+tabs.length)%tabs.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=tabs.length-1;else return;
 e.preventDefault();setTownView(tabs[next].dataset.townView,true);
});
$('inspectorContent').addEventListener('click',e=>{
 const b=e.target.closest('[data-act]');if(!b||!state)return;
 const id=Number(b.dataset.id),act=b.dataset.act;
 if(['recruit','food','rest','rumors','visit','granary'].includes(act))performSettlementAction(act,id);
 else if(act==='travelSettlement')travelTo(S[id].x,S[id].y,id);
 else if(act==='travelParty')followParty(id);
 else if(act==='meetParty'){const p=state.parties.find(v=>v.id===id);if(p)openEncounter(p)}
 else if(act==='travelLandmark'){const p=W.landmarks.find(v=>v.id===id);if(p)travelTo(p.x,p.y,null)}
 else if(act==='exploreLandmark')exploreLandmark(id);
 else if(act==='nearest'){const site=W.closestSettlement(state.player.x,state.player.y);selected={type:'settlement',id:site.id}}
 else if(act==='partyPanel')showParty();else if(act==='factions')openFactions();
 inspectorDirty=true;refreshUI();
});
canvas.addEventListener('pointerdown',e=>{
 if(!state||state.paused)return;
 canvas.setPointerCapture(e.pointerId);
 drag={x:e.clientX,y:e.clientY,cx:camera.x,cy:camera.y,moved:false};
});
canvas.addEventListener('pointermove',e=>{
 if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
 if(Math.hypot(dx,dy)>7)drag.moved=true;
 if(drag.moved){camera.x=clamp(drag.cx-dx/camera.zoom,0,W.WIDTH);camera.y=clamp(drag.cy-dy/camera.zoom,0,W.HEIGHT);focus=false}
});
canvas.addEventListener('pointerup',e=>{
 if(!drag||!state||state.paused){drag=null;return}
 const moved=drag.moved;drag=null;
 if(!moved){const r=canvas.getBoundingClientRect();const p=toWorld(e.clientX-r.left,e.clientY-r.top);chooseSelection(clamp(p.x,0,W.WIDTH),clamp(p.y,0,W.HEIGHT));refreshUI()}
});
canvas.addEventListener('pointercancel',()=>drag=null);
canvas.addEventListener('wheel',e=>{if(!state)return;e.preventDefault();const r=canvas.getBoundingClientRect();zoomAt(e.deltaY<0?1.18:1/1.18,e.clientX-r.left,e.clientY-r.top)},{passive:false});
mini.addEventListener('click',e=>{if(!state)return;const r=mini.getBoundingClientRect();camera.x=clamp((e.clientX-r.left)/r.width*W.WIDTH,0,W.WIDTH);camera.y=clamp((e.clientY-r.top)/r.height*W.HEIGHT,0,W.HEIGHT);focus=false});
window.addEventListener('keydown',e=>{
 if(e.key==='Escape'){
  if($('screenCreate').classList.contains('hidden')===false)showScreen('screenMenu');
  else if(menuOpen)closeModal();
  else if(state)showScreen('screenPause');
  return;
 }
 if(!state||menuOpen||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
 const k=e.key.length===1?e.key.toLowerCase():e.key;
 if(['ArrowRight','ArrowLeft','ArrowUp','ArrowDown',' ','w','a','s','d'].includes(k))e.preventDefault();
 keys.add(k);
 if(k===' '){state.pausedManual=!state.pausedManual;state.paused=state.pausedManual;refreshUI()}
 if(k==='p')showParty();if(k==='c')showCharacter();
 if(k==='f')openFactions();
 if(k==='+'||k==='=')zoomAt(1.3);if(k==='-')zoomAt(1/1.3);
});
window.addEventListener('keyup',e=>keys.delete(e.key.length===1?e.key.toLowerCase():e.key));
window.addEventListener('blur',()=>keys.clear());
window.addEventListener('beforeunload',()=>{if(state)saveGame(true)});
window.addEventListener('resize',()=>{
 resize();if(!$('screenAtlas').classList.contains('hidden'))drawAtlas();
});
if('ResizeObserver' in window)new ResizeObserver(resize).observe(canvas.parentElement);
function frame(now){
 const dt=Math.min(.075,Math.max(0,(now-last)/1000||.016));last=now;
 if(state&&!menuOpen){
  if(!state.paused){
   const beforeX=state.player.x,beforeY=state.player.y;
   stepTravel(dt);
   const moved=dist(beforeX,beforeY,state.player.x,state.player.y),normal=148*W.walkingSpeed(beforeX,beforeY)*dt*state.speed;
   if(!state.paused&&moved>0)stepParties(dt*clamp(moved/Math.max(1,normal),0,1));
   if((focus&&state.options.follow)||state.followPartyId!=null){const t=Math.min(1,dt*5);camera.x+=(state.player.x-camera.x)*t;camera.y+=(state.player.y-camera.y)*t}
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


