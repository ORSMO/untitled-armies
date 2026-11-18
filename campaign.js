
(function(){
'use strict';
const W=window.UAWorld;if(!W)throw Error('World data is missing');
const $=id=>document.getElementById(id),F=W.factions,S=W.settlements;
const KEY='ua-campaign-v1',VERSION=1,MAXPARTY=75;
const clamp=W.clamp,dist=(a,b,x,y)=>Math.hypot(a-x,b-y),esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const canvas=$('worldCanvas'),ctx=canvas.getContext('2d'),mini=$('minimap'),mctx=mini.getContext('2d');
let state=null,selected=null,selectedFaction=6,modalStack=[],focus=true,camera={x:3870,y:5320,zoom:.47},keys=new Set(),drag=null,last=0,lastHud=0,lastMini=0,lastSave=0,toastUntil=0,menuOpen=true,miniBase=null,view={w:900,h:600},inspectorDirty=true;
const screens=['screenMenu','screenCreate','screenFactions','screenAtlas','screenOptions','screenPause','screenParty','screenCharacter','screenEncounter','screenAftermath'];
const settingsDefault={borders:true,labels:true,roads:true,minimap:true,follow:true};
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
function troopPower(){return state.player.roster.reduce((n,g)=>n+g.count*(1+g.tier*.95),0)+state.player.level*1.8}
function saveGame(silent){
 if(!state)return false;
 try{
  const data={version:VERSION,player:state.player,day:state.day,hour:state.hour,
   parties:state.parties.map(p=>({id:p.id,x:p.x,y:p.y,tx:p.tx,ty:p.ty,strength:p.strength,active:p.active,kind:p.kind,faction:p.faction})),
   options:state.options,speed:state.speed,zoom:camera.zoom};
  localStorage.setItem(KEY,JSON.stringify(data));
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
  parties.push({id:i,kind,faction:kind==='bandit'?-1:fid,x,y,tx:x,ty:y,strength:kind==='bandit'?4+(i*13)%11:kind==='patrol'?22+(i*3)%25:9+(i*5)%16,active:true,path:[],pathIndex:0});
 }
 return parties;
}
function startCampaign(){
 modalStack=[];
 try{localStorage.removeItem('ua-battle-pending-v1');localStorage.removeItem('ua-battle-result-v1')}catch(e){}
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
   parties:[],options:{...settingsDefault},messages:[],unseen:[],lastEncounter:-100};
 state.parties=generateParties();selected={type:'settlement',id:origin*8};
 camera.zoom=.47;resetView();$('game').classList.remove('hidden');showScreen(null);resize();
 log('Your story begins beneath the banners of '+F[origin].name+'.');
 log('Your first task: recruit three volunteers from a settlement.');
 refreshUI();saveGame(true);notify('Welcome to the continent of Asterra. Click anywhere to travel.');
}
function loadGame(){
 modalStack=[];
 try{
  const raw=JSON.parse(localStorage.getItem(KEY));if(!raw||raw.version!==VERSION||!raw.player)throw Error('Wrong save version');
  const p=raw.player;if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(p.gold)||!Array.isArray(p.roster))throw Error('Corrupt data');
  p.x=clamp(p.x,0,W.WIDTH);p.y=clamp(p.y,0,W.HEIGHT);
  // Saved character locations survive the V4.1 geography rebuild.
  // If new water now covers an old saved position, reach the nearest land.
  if(!W.tileAt(p.x,p.y).walk){
   const land=W.nearestWalk(Math.floor(p.x/W.TILE),Math.floor(p.y/W.TILE));
   if(land){p.x=(land.x+.5)*W.TILE;p.y=(land.y+.5)*W.TILE}
  }
  state={version:VERSION,player:p,day:raw.day||1,hour:raw.hour||8,speed:[1,2,4].includes(raw.speed)?raw.speed:1,
   paused:false,pausedManual:false,path:[],pathIndex:0,targetSettlement:null,parties:[],options:{...settingsDefault,...raw.options},
   messages:[],lastEncounter:-100};
  state.parties=generateParties();
  if(Array.isArray(raw.parties))for(const saved of raw.parties){const a=state.parties.find(v=>v.id===saved.id);
    if(a&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)){
     Object.assign(a,saved);a.path=[];a.pathIndex=0;
     if(!W.tileAt(a.x,a.y).walk){
      const land=W.nearestWalk(Math.floor(a.x/W.TILE),Math.floor(a.y/W.TILE));
      if(land){a.x=(land.x+.5)*W.TILE;a.y=(land.y+.5)*W.TILE}
     }
    }}
  camera.zoom=clamp(raw.zoom||.47,.12,1.9);resetView();$('game').classList.remove('hidden');showScreen(null);resize();
  selected={type:'land'};log('Campaign resumed. Your journey continues.');
  const returned=settleCampaignBattle();
  refreshUI();if(!returned)notify('Campaign loaded.');return true;
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
 clearPursuit(true);
 const route=W.findPath(state.player.x,state.player.y,x,y);
 if(!route.length){notify('No traversable route found.');return}
 state.path=route;state.pathIndex=0;state.targetSettlement=targetId==null?null:targetId;
 state.pausedManual=false;state.paused=false;focus=state.options.follow;
 if(targetId!=null)notify('Traveling to '+S[targetId].name+'.');
 else notify('Travel route set · '+Math.round(route.length*W.TILE/100)/10+' leagues approximately.');
 refreshUI();
}
function walkPlayer(dx,dy,dt){
 const p=state.player,mag=Math.hypot(dx,dy);if(mag<.0001)return false;
 const spd=147*W.walkingSpeed(p.x,p.y)*dt*state.speed;
 const x=clamp(p.x+dx/mag*spd,15,W.WIDTH-15),y=clamp(p.y+dy/mag*spd,15,W.HEIGHT-15);
 if(!W.tileAt(x,y).walk)return false;
 const d=dist(p.x,p.y,x,y);p.x=x;p.y=y;advanceTime(d);
 if(state.targetSettlement!=null&&dist(p.x,p.y,S[state.targetSettlement].x,S[state.targetSettlement].y)<130)
  arriveSettlement(state.targetSettlement);
 return true;
}
function advanceTime(distance){
 state.hour+=distance/230;
 while(state.hour>=24){state.hour-=24;state.day++;consumeFood();if(state.player.hp<100)state.player.hp=Math.min(100,state.player.hp+3)}
}
function consumeFood(){
 const need=Math.max(1,Math.ceil(rosterCount()/12));
 if(state.player.food>=need)state.player.food-=need;
 else{state.player.food=0;state.player.hp=Math.max(5,state.player.hp-8);log('Your party went hungry. Morale and health are falling.')}
 if(state.day%3===0)log('Day '+state.day+': your troop wages and supplies require attention.');
}
function stepTravel(dt){
 const p=state.player;
 if(state.pursuitId!=null){
  const target=partyById(state.pursuitId);
  if(!target){clearPursuit(true);notify('The tracked party has disappeared.')}
  else{
   const gap=dist(p.x,p.y,target.x,target.y);
   if(state.pursuitMode!=='escort'&&gap<122){openEncounter(target.id);return}
   if(state.pursuitMode==='escort'&&gap<170){
    state.path=[];state.pathIndex=0;state.pursuitAge=1.5;
   }else{
    state.pursuitAge=(state.pursuitAge||0)+dt;
    if(state.pursuitAge>1.0||!state.path.length){
     const moved=dist(target.x,target.y,state.pursuitLastX??Infinity,state.pursuitLastY??Infinity);
     if(moved>36||!state.path.length){
      const route=W.findPath(p.x,p.y,target.x,target.y);
      if(route.length){state.path=route;state.pathIndex=0}
      state.pursuitLastX=target.x;state.pursuitLastY=target.y;
     }
     state.pursuitAge=0;
    }
   }
  }
 }
 const dx=(keys.has('d')||keys.has('ArrowRight')?1:0)-(keys.has('a')||keys.has('ArrowLeft')?1:0);
 const dy=(keys.has('s')||keys.has('ArrowDown')?1:0)-(keys.has('w')||keys.has('ArrowUp')?1:0);
 if(dx||dy){clearPursuit(true);state.path=[];state.pathIndex=0;state.targetSettlement=null;walkPlayer(dx,dy,dt);focus=state.options.follow;return}
 if(state.pathIndex>=state.path.length)return;
 let budget=148*W.walkingSpeed(p.x,p.y)*dt*state.speed;
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
 clearPursuit(true);state.path=[];state.pathIndex=0;state.targetSettlement=null;selected={type:'settlement',id};
 const site=S[id];log('Arrived at '+site.name+', '+F[site.faction].name+'.');
 if(state.player.quest?.id===1&&site.type==='capital'&&site.faction!==state.player.origin)completeQuest(1);
 focus=true;inspectorDirty=true;notify('Arrived at '+site.name+'. Visit, recruit or resupply.');
}
function nextPartyDestination(p){
 let dest;
 if(p.kind==='bandit'){const angle=(p.id*2.399+state.day*.3)%6.28;dest={x:clamp(p.x+Math.cos(angle)*720,270,W.WIDTH-270),y:clamp(p.y+Math.sin(angle)*680,260,W.HEIGHT-260)}}
 else{const options=S.filter(s=>p.kind==='caravan'||s.faction===p.faction);
 dest=options[(p.id*19+Math.floor(state.day*1.3)+p.strength)%options.length]}
 p.path=W.findPath(p.x,p.y,dest.x,dest.y);p.pathIndex=0;
}
function stepParties(dt){
 // Stagger pathfinding so dozens of NPC parties cannot block the first frame.
 let routingBudget=3;
 for(const p of state.parties){
  if(!p.active)continue;
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
 }
 const close=state.parties.find(p=>p.active&&p.kind==='bandit'&&
  dist(state.player.x,state.player.y,p.x,p.y)<96);
 if(close&&(state.day+state.hour/24)-state.lastEncounter>.07&&
  state.pursuitMode!=='escort'&&!menuOpen)openEncounter(close.id);
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
 const rewards=[150,225,360],exp=[65,95,190];p.gold+=rewards[id];p.xp+=exp[id];p.renown+=id+1;
 q.id=id+1;q.progress=0;q.goal=3;
 while(p.xp>=p.level*125){p.xp-=p.level*125;p.level++;p.hp=100;notify('Level up! You are now level '+p.level+'.')}
 log('Quest completed! Earned '+rewards[id]+' denars and '+exp[id]+' experience.');
 notify('Quest complete · +'+rewards[id]+' denars · +'+exp[id]+' XP');inspectorDirty=true;
}
function performSettlementAction(action,id){
 const site=S[id],p=state.player;
 if(!site)return;
 if(dist(p.x,p.y,site.x,site.y)>155){notify('Travel closer to enter '+site.name+'.');return}
 if(action==='recruit'){
  const available=MAXPARTY-rosterCount(),number=Math.min(4,available),cost=number*45;
  if(number<=0){notify('Your party has reached its current limit.');return}
  if(p.gold<cost){notify('Not enough denars to recruit volunteers.');return}
  p.gold-=cost;let group=p.roster.find(g=>g.faction===site.faction&&g.tier===0);
  if(!group){group={faction:site.faction,tier:0,count:0};p.roster.push(group)}
  group.count+=number;log('Recruited '+number+' '+F[site.faction].troops[0]+' at '+site.name+'.');
  if(p.quest?.id===0){p.quest.progress+=number;if(p.quest.progress>=p.quest.goal)completeQuest(0)}
  notify(number+' volunteers joined your party.');
 }else if(action==='food'){
  if(p.gold<35){notify('Not enough denars for provisions.');return}
  p.gold-=35;p.food+=12;log('Bought 12 provisions in '+site.name+'.');notify('Purchased provisions.');
 }else if(action==='rest'){
  if(p.gold<20){notify('An inn costs 20 denars.');return}
  p.gold-=20;p.hp=Math.min(100,p.hp+32);state.hour=8;state.day++;consumeFood();
  log('Rested at '+site.name+'.');notify('Rested, healed and started a new day.');
 }else if(action==='rumors'){
  log('Rumor: scouts report bandits on roads near '+site.name+'.');
  notify('Villagers warn you about raiders and distant wars.');
 }else if(action==='visit'){
  log('Visited '+site.name+'. Garrison: '+site.garrison+'. Prosperity: '+site.prosperity+'.');
  notify('You walk through the gates of '+site.name+'.');
 }
 refreshUI();saveGame(true);
}
function upgradeRoster(index){
 const p=state.player,g=p.roster[index];if(!g||g.count<1||g.tier>=2)return;
 const cost=g.count*(g.tier===0?75:135);
 if(p.gold<cost){notify('Training and equipment cost '+cost+' denars.');return}
 p.gold-=cost;g.tier++;p.renown++;log('Promoted '+g.count+' troops into '+troopName(g)+'.');
 notify('Troops upgraded along their faction template.');refreshUI();saveGame(true);
}
// Living-world landmarks; stable IDs and deterministic positions let old
// saves keep their discovered sites even after the map changes.
const landmarkTypes=[
 {kind:'ruins',icon:'⌂',suffix:'Forgotten Ruins',summary:'Crumbling foundations conceal history, danger and abandoned valuables.'},
 {kind:'watchtower',icon:'♜',suffix:'Frontier Watch',summary:'A lonely outpost overlooking trails and approaching armies.'},
 {kind:'wayhouse',icon:'⌘',suffix:'Wayside Inn',summary:'Caravans and wanderers can rest and obtain provisions here.'},
 {kind:'shrine',icon:'✦',suffix:'Ancient Shrine',summary:'Travelers leave offerings for safe journeys and a little hope.'},
 {kind:'huntercamp',icon:'⚑',suffix:'Hunter Camp',summary:'Trackers and woodcutters share the news of the surrounding countryside.'}
];
const landmarks=[];
for(const faction of F){
 for(let j=0;j<5;j++){
  const type=landmarkTypes[j],origin=faction.capital;
  let chosen=null;
  for(let n=0;n<250;n++){
   const angle=W.hash(faction.id*19+j*67+n,21)*Math.PI*2;
   const radius=450+W.hash(faction.id*23+j*31+n,37)*1550;
   const x=clamp(origin[0]+Math.cos(angle)*radius,120,W.WIDTH-120),
    y=clamp(origin[1]+Math.sin(angle)*radius,120,W.HEIGHT-120);
   const tile=W.tileAt(x,y);
   if(!tile.walk||tile.owner!==faction.id||
      ['sea','river','mountain','snow','marsh'].includes(tile.kind))continue;
   if(S.some(site=>Math.hypot(site.x-x,site.y-y)<220))continue;
   if(landmarks.some(l=>Math.hypot(l.x-x,l.y-y)<210))continue;
   chosen={x,y};break;
  }
  if(chosen)landmarks.push({id:faction.id*5+j,faction:faction.id,
   kind:type.kind,icon:type.icon,name:faction.cities[(j+2)%8]+' '+type.suffix,
   description:type.summary,...chosen});
 }
}
function partyById(id){return state?.parties.find(p=>p.id===id&&p.active)||null}
function partyTitle(p){
 if(!p)return'Unknown travelers';
 return p.kind==='bandit'?'Outlaw Bandits':F[p.faction].name+
  (p.kind==='caravan'?' Merchant Caravan':' Border Patrol');
}
function clearPursuit(silent=false){
 if(!state)return;
 const had=state.pursuitId!=null;
 state.pursuitId=null;state.pursuitMode=null;state.pursuitAge=0;
 state.path=[];state.pathIndex=0;state.targetSettlement=null;
 $('trackingBadge').classList.add('hidden');
 if(had&&!silent)notify('Stopped following the moving party.');
 inspectorDirty=true;
}
function trackParty(id,escort=false){
 if(!state||state.paused)return false;
 const p=partyById(id);if(!p){notify('That party has left the map.');return false}
 state.pursuitId=id;state.pursuitMode=escort?'escort':'intercept';
 state.pursuitAge=99;state.pursuitLastX=null;state.pursuitLastY=null;
 state.path=[];state.pathIndex=0;state.targetSettlement=null;
 selected={type:'party',id};focus=state.options.follow;
 $('trackingBadge').classList.remove('hidden');
 $('trackingLabel').textContent=(escort?'◎ Escorting ':'◎ Pursuing ')+partyTitle(p);
 inspectorDirty=true;
 notify((escort?'Following':'Pursuing')+' '+partyTitle(p)+'. The route follows their movement.');
 return true;
}
function openEncounter(id){
 if(!state||menuOpen)return;
 const p=partyById(id);if(!p)return;
 if(Math.hypot(state.player.x-p.x,state.player.y-p.y)>155)return;
 clearPursuit(true);
 state.encounterId=id;selected={type:'party',id};
 state.lastEncounter=state.day+state.hour/24;
 log('Encountered '+partyTitle(p)+' on the road.');
 const title=partyTitle(p),color=p.faction>=0?F[p.faction].color:'#b97969',
  character=p.kind==='bandit'?'☠':p.kind==='caravan'?'⚖':'⚔';
 $('encounterTitle').textContent=title;
 $('encounterContent').innerHTML=
  '<div class="encounter-banner" style="--encounter-color:'+color+'"><span class="encounter-portrait">'+character+'</span>'+
  '<strong>'+esc(title)+'</strong><p>'+
  esc(p.kind==='bandit'?'Armed outlaws halt your column. Their leader demands that you turn back or hand over your valuables.':
      p.kind==='caravan'?'A caravan master welcomes you beneath a traveling banner. Merchants share stories of road conditions and distant markets.':
      'A patrol commander challenges you to identify yourself. These soldiers carry the colors of their kingdom.')+
  '</p></div>'+
  '<div class="encounter-stats"><div>THEIR STRENGTH<strong>'+p.strength+'</strong></div>'+
  '<div>YOUR SOLDIERS<strong>'+rosterCount()+'</strong></div>'+
  '<div>REGION<strong>'+esc(F[W.tileAt(p.x,p.y).owner]?.name||'Wilderness')+'</strong></div></div>';
 const options=p.kind==='bandit'?
  [{act:'fight',text:'⚔ Draw your sword — Lead the battle',primary:true},
   {act:'bribe',text:'🪙 Pay 85 denars to pass unharmed'+(state.player.gold<85?' (not enough gold)':''),disabled:state.player.gold<85},
   {act:'leave',text:'↩ Withdraw and avoid their camp'}]:
  p.kind==='caravan'?
  [{act:'trade',text:'🍞 Buy 15 provisions for 50 denars',primary:true,disabled:state.player.gold<50},
   {act:'ask',text:'📜 Ask about local roads and rumors'},
   {act:'escort',text:'◎ Follow this caravan on its travels'},
   {act:'leave',text:'↩ Continue your own journey'}]:
  [{act:'ask',text:'📜 Ask about wars and border dangers',primary:true},
   {act:'escort',text:'◎ Travel alongside this patrol'},
   {act:'leave',text:'↩ Take your leave'}];
 $('encounterActions').innerHTML=options.map(o=>
  '<button type="button" class="btn'+(o.primary?' primary':'')+'" data-encounter-act="'+o.act+'"'+(o.disabled?' disabled':'')+'>'+esc(o.text)+'</button>').join('');
 showScreen('screenEncounter');
}
function closeEncounter(){
 if(!state)return;
 state.encounterId=null;
 showScreen(null);inspectorDirty=true;refreshUI();
}
function handleEncounterAction(act){
 if(!state||state.encounterId==null)return;
 const p=partyById(state.encounterId);
 if(!p){closeEncounter();return}
 if(act==='fight'){beginTacticalBattle(p.id);return}
 if(act==='leave'){closeEncounter();notify('You leave the encounter without a fight.');return}
 if(act==='bribe'){
  if(p.kind!=='bandit'||state.player.gold<85){notify('You cannot afford the passage payment.');return}
  state.player.gold-=85;log('Paid 85 denars to '+partyTitle(p)+' for safe passage.');
  closeEncounter();saveGame(true);return;
 }
 if(act==='trade'){
  if(p.kind!=='caravan'||state.player.gold<50){notify('You do not have enough denars.');return}
  state.player.gold-=50;state.player.food+=15;
  log('Bought 15 provisions from a passing merchant caravan.');closeEncounter();saveGame(true);return;
 }
 if(act==='ask'){
  const region=F[W.tileAt(p.x,p.y).owner],name=region?.name||'the frontier';
  const wars=W.wars.filter(pair=>pair.includes(p.faction)).map(pair=>
   F[pair[0]===p.faction?pair[1]:pair[0]].name);
  const msg=p.kind==='patrol'?
   (wars.length?'We are at war with '+wars.join(' and ')+'. Keep to guarded roads.':
    'Our borders are quiet, but the roads are not.'):
   'The safest roads follow established crossings. Avoid isolated ruins at night.';
  $('encounterContent').innerHTML+='<div class="eventbox"><b>News from '+esc(name)+'</b><p>'+esc(msg)+'</p></div>';
  return;
 }
 if(act==='escort'){
  const id=p.id;closeEncounter();trackParty(id,true);
  return;
 }
}
function beginTacticalBattle(id){
 const p=partyById(id);
 if(!p||p.kind!=='bandit')return;
 if(!state||dist(state.player.x,state.player.y,p.x,p.y)>170){notify('Approach the outlaws first.');return}
 const biome=W.tileAt(p.x,p.y).kind;
 const terrain=['hills','mountain','snow'].includes(biome)?'ridge':
  ['forest','taiga','rainforest'].includes(biome)?'forest':
  biome==='marsh'?'mud':biome==='river'?'river':
  biome==='desert'?'rocks':'plain';
 const idToken='battle-'+Date.now()+'-'+Math.floor(Math.random()*1e7);
 const payload={version:1,id:idToken,partyId:id,
  enemyName:partyTitle(p),strength:p.strength,
  playerName:state.player.name,playerHp:state.player.hp,
  terrain,roster:state.player.roster.map(g=>({faction:g.faction,tier:g.tier,count:g.count}))};
 if(!payload.roster.some(g=>g.count>0)){notify('Recruit soldiers before entering a battle.');return}
 try{
  if(!saveGame(true))throw Error('Save failed');
  localStorage.setItem('ua-battle-pending-v1',JSON.stringify(payload));
  localStorage.removeItem('ua-battle-result-v1');
  window.location.href='battle.html?campaign=1';
 }catch(e){notify('Could not prepare the campaign battle. Browser storage must be available.')}
}
function settleCampaignBattle(){
 if(!state)return false;
 let result,pending;
 try{
  result=JSON.parse(localStorage.getItem('ua-battle-result-v1')||'null');
  pending=JSON.parse(localStorage.getItem('ua-battle-pending-v1')||'null');
 }catch(e){return false}
 if(!result||!pending||result.version!==1||result.id!==pending.id||
   result.partyId!==pending.partyId||!Array.isArray(result.troops))return false;
 const me=state.player,originalCount=rosterCount();
 const tally=new Map();
 for(const r of result.troops){
  if(!Number.isInteger(r.group)||r.group<0||r.group>=me.roster.length)continue;
  const t=tally.get(r.group)||{count:0,wounded:0,killed:0};
  if(r.result==='killed'||r.result==='surrendered')t.killed++;
  else{t.count++;if(r.result==='incapacitated'||r.hp<r.maxHp*.5)t.wounded++}
  tally.set(r.group,t);
 }
 me.roster=me.roster.map((g,i)=>({...g,count:Math.min(g.count,tally.get(i)?.count||0),
   wounded:Math.min(tally.get(i)?.wounded||0,tally.get(i)?.count||0)})).filter(g=>g.count>0);
 const lost=Math.max(0,originalCount-rosterCount()),wounded=me.roster.reduce((n,g)=>n+(g.wounded||0),0);
 const party=partyById(result.partyId),won=result.winner==='friend';
 let reward=0,exp=0;
 if(won){
  reward=65+(pending.strength||8)*12;
  exp=42+(pending.strength||8)*7;
  me.gold+=reward;me.xp+=exp;me.renown+=3;
  if(party)party.active=false;
  if(me.quest?.id===2)completeQuest(2);
  log('Won a real tactical battle! '+lost+' soldiers lost, '+wounded+' wounded, '+reward+' denars recovered.');
 }else{
  const stolen=Math.min(me.gold,Math.floor(me.gold*.15));me.gold-=stolen;
  if(party)party.strength=Math.max(2,(result.enemyRemaining|0)||2);
  log((result.winner==='retreat'?'Retreated from':'Lost')+' the battlefield: '+lost+' lost and '+wounded+' wounded.');
  if(result.winner==='foe'){
   const safe=W.closestSettlement(me.x,me.y);me.x=safe.x;me.y=safe.y;resetView();
  }
 }
 if(result.hero){
  const ratio=Number(result.hero.hp)/Math.max(1,Number(result.hero.maxHp)||5);
  me.hp=clamp(Math.round(100*ratio),result.hero.fallen?10:12,100);
 }
 while(me.xp>=me.level*125){me.xp-=me.level*125;me.level++;me.hp=100;log('You reached level '+me.level+'.')}
 state.path=[];state.pathIndex=0;state.pursuitId=null;state.pursuitMode=null;
 state.encounterId=null;state.lastEncounter=state.day+state.hour/24;
 selected={type:'land'};inspectorDirty=true;
 const title=won?'Victory on the battlefield':result.winner==='retreat'?'Your army withdrew':'Defeat on the battlefield';
 $('aftermathTitle').textContent=title;
 $('aftermathContent').innerHTML=
  '<div class="encounter-stats"><div>STILL WITH YOU<strong>'+rosterCount()+'</strong></div>'+
  '<div>FALLEN / CAPTURED<strong>'+lost+'</strong></div>'+
  '<div>WOUNDED<strong>'+wounded+'</strong></div></div>'+
  '<div class="eventbox"><b>'+esc(title)+'</b><p>'+
  (won?'You fought alongside your men and recovered '+reward+' denars and '+exp+' experience.':
   'Your surviving soldiers return to the campaign. Regroup and replenish your supplies.')+
  '</p><p>Your health: '+me.hp+'/100 · Battle duration: '+Math.round(result.seconds)+' seconds.</p></div>';
 try{localStorage.removeItem('ua-battle-pending-v1');localStorage.removeItem('ua-battle-result-v1')}catch(e){}
 saveGame(true);refreshUI();showScreen('screenAftermath');
 return true;
}
function skirmish(id){
 const p=partyById(id);
 if(p&&dist(state.player.x,state.player.y,p.x,p.y)<=155)openEncounter(id);
 else trackParty(id);
}
function chooseSelection(x,y){
 const local=toScreen(x,y),allow=28;
 let site=null,sd=allow;
 for(const s of S){
  const p=toScreen(s.x,s.y),d=dist(local.x,local.y,p.x,p.y);
  if(d<sd){sd=d;site=s}
 }
 if(site){selected={type:'settlement',id:site.id};inspectorDirty=true;return}
 let party=null,pd=19;
 for(const p of state.parties)if(p.active){
  const m=toScreen(p.x,p.y),d=dist(m.x,m.y,local.x,local.y);
  if(d<pd){pd=d;party=p}
 }
 if(party){selected={type:'party',id:party.id};trackParty(party.id);inspectorDirty=true;return}
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
}
function drawParties(){
 for(const p of state.parties)if(p.active&&inView(p.x,p.y,100)){
  const f=p.faction>=0?F[p.faction]:null,c=p.kind==='bandit'?'#d47d70':f.color;
  ctx.fillStyle='#0d1d18d9';ctx.beginPath();ctx.arc(p.x,p.y,15,0,6.283);ctx.fill();
  ctx.lineWidth=3;ctx.strokeStyle=c;ctx.stroke();
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
 $('hudSpeed').textContent=state.speed+'×';
 $('hudPause').textContent=state.pausedManual?'▶ Resume':'⏸ Pause';
 $('charName').textContent=p.name;$('charCulture').textContent='Level '+p.level+' · '+F[p.origin].name;
 $('charAvatar').textContent=F[p.origin].symbol;
 $('statGold').textContent=p.gold.toLocaleString();$('statFood').textContent=p.food;
 $('statRenown').textContent=p.renown;$('statParty').textContent=rosterCount();
 $('healthBar').style.width=p.hp+'%';$('healthLabel').textContent=p.hp+'/100';
 $('partyRoster').innerHTML=p.roster.map(g=>'<li><span>'+esc(troopName(g))+'<small> · '+F[g.faction].name+'</small></span><b>'+g.count+'</b></li>').join('')||'<li>No soldiers</li>';
 $('questText').textContent=questText();
 $('logList').innerHTML=state.messages.slice(0,6).map(m=>'<li><b>Day '+m.day+':</b> '+esc(m.text)+'</li>').join('');
 $('mapCoordinates').textContent=near&&dist(p.x,p.y,near.x,near.y)<300?
  'Near '+near.name+' · '+region.name:region.name+' · '+Math.floor(p.x)+', '+Math.floor(p.y);
 $('travelText').textContent=state.pursuitId!=null?
  ('Tracking '+partyTitle(partyById(state.pursuitId))+' · '+Math.round(dist(p.x,p.y,
   partyById(state.pursuitId)?.x??p.x,partyById(state.pursuitId)?.y??p.y))+' units'):
  state.path.length?'Traveling · '+Math.max(0,state.path.length-state.pathIndex)+' route steps remaining':
  'Click to travel · WASD to walk · Drag to pan · Scroll to zoom';
 $('minimapHolder').classList.toggle('hidden',!state.options.minimap);
 if(inspectorDirty)refreshInspector();
}
function renderActions(items){return items.map(a=>'<button class="btn'+(a.primary?' primary':'')+'" data-act="'+a.act+'"'+(a.id!==undefined?' data-id="'+a.id+'"':'')+(a.disabled?' disabled':'')+'>'+esc(a.label)+'</button>').join('')}
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
  if(close)html+=renderActions([{act:'visit',id:site.id,label:'🏰 Enter settlement',primary:true},{act:'recruit',id:site.id,label:'⚔ Recruit 4 volunteers · 180 denars'},{act:'food',id:site.id,label:'🍞 Buy 12 provisions · 35 denars'},{act:'rest',id:site.id,label:'🛌 Rest at an inn · 20 denars'},{act:'rumors',id:site.id,label:'📜 Ask for local rumors'}]);
  else html+=renderActions([{act:'travelSettlement',id:site.id,label:'➤ Travel to '+site.name,primary:true}]);
  html+='<p class="subtle">Faction troop progression: '+f.troops.map(esc).join(' → ')+'.</p>';
 }else if(selected.type==='party'){
  const enemy=state.parties.find(p=>p.id===selected.id);
  if(!enemy||!enemy.active){selected={type:'land'};return refreshInspector()}
  const label=enemy.kind==='bandit'?'Outlaw Bandits':enemy.kind==='patrol'?F[enemy.faction].name+' Patrol':F[enemy.faction].name+' Caravan';
  html='<div class="smallcaps">ROAMING PARTY</div><h2>'+esc(label)+'</h2><div class="banner-strip" style="background:'+(enemy.kind==='bandit'?'#c57966':F[enemy.faction].color)+'"></div>';
  html+='<p>Party size: <b>'+enemy.strength+'</b>. Distance: '+Math.round(dist(state.player.x,state.player.y,enemy.x,enemy.y))+' map units.</p>';
  html+='<div class="eventbox"><b>'+esc(enemy.kind==='bandit'?'Hostile raiders':'Traveling party')+'</b><p>'+
   (enemy.kind==='bandit'?'Intercept the outlaws to negotiate or fight personally in a full tactical battle.':
    'Meet these travelers for conversation, trade or escort.')+'</p></div>';
  html+=renderActions([{act:'travelParty',id:enemy.id,label:'◎ Follow moving party',primary:true},
   {act:'stopTrack',label:'✕ Stop tracking',disabled:state.pursuitId!==enemy.id},
   {act:'meetParty',id:enemy.id,label:'⚑ Interact with this party',
     disabled:dist(state.player.x,state.player.y,enemy.x,enemy.y)>155}]);
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
function showFactionDetails(id){
 selectedFaction=id;const f=F[id];
 const enemies=W.wars.filter(pair=>pair.includes(id)).map(pair=>F[pair[0]===id?pair[1]:pair[0]].name);
 document.querySelectorAll('[data-faction]').forEach(b=>b.classList.toggle('selected',Number(b.dataset.faction)===id));
 $('factionDetail').innerHTML='<h3><span style="color:'+f.color+'">'+esc(f.symbol)+'</span> '+esc(f.name)+'</h3><p>'+esc(f.culture)+'. '+esc(f.trait)+'.</p><p><em>'+esc(f.motto)+'</em></p><div class="smallcaps">FACTION TROOP TREE · PRESET UPGRADES</div><div class="trooptree">'+f.troops.map((n,i)=>'<div><small>Tier '+(i+1)+'</small>'+esc(n)+'</div>').join('')+'</div><p class="subtle">Capital: '+esc(f.cities[0])+' · 8 settlements. Faction troops use these upgrades unless you eventually found your own faction.</p>'+
 '<p><b>Current wars:</b> '+(enemies.length?enemies.map(esc).join(', '):'No declared wars')+'.</p>';
}
function openFactions(){
 $('factionGrid').innerHTML=F.map(f=>'<button class="faction-card" data-faction="'+f.id+'"><span class="faction-flag" style="background:'+f.color+'">'+esc(f.symbol)+'</span><span><strong>'+esc(f.name)+'</strong><small>'+esc(f.culture)+'</small><small>'+esc(f.trait)+'</small></span></button>').join('');
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
 $('characterModalContent').innerHTML='<div class="hero-card"><div class="hero-icon">'+esc(f.symbol)+'</div><div class="hero-name">'+esc(p.name)+'</div><div class="hero-sub">'+esc(f.culture)+' · '+esc(p.background)+'</div><div class="statgrid"><div class="stat"><div class="stat-label">Level</div><div class="stat-value">'+p.level+'</div></div><div class="stat"><div class="stat-label">Experience</div><div class="stat-value">'+p.xp+'/'+(p.level*125)+'</div></div><div class="stat"><div class="stat-label">Renown</div><div class="stat-value">'+p.renown+'</div></div><div class="stat"><div class="stat-label">Health</div><div class="stat-value">'+p.hp+'%</div></div></div></div><p>Recruit faction soldiers, gain renown through quests and skirmishes, and travel between the ten kingdoms. A full character-equipment system will follow in later campaign development.</p>';
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
function button(id,action){$(id).addEventListener('click',action)}
button('menuNew',selectNew);button('menuContinue',loadGame);
button('menuFactions',openFactions);button('menuAtlas',openAtlas);button('menuOptions',showOptions);
button('createStart',startCampaign);button('createCancel',()=>showScreen('screenMenu'));
button('atlasClose',closeModal);
button('atlasZoomIn',()=>atlasZoom(1.30));
button('atlasZoomOut',()=>atlasZoom(1/1.30));
button('atlasReset',resetAtlas);
button('factionsClose',closeModal);
button('optionsClose',closeModal);
button('optionsApply',saveOptions);
button('pauseResume',()=>{state.pausedManual=false;showScreen(null)});
button('pauseSave',()=>saveGame(false));button('pauseOptions',showOptions);
button('pauseMenu',showMenu);
button('btnMenu',()=>showScreen('screenPause'));
button('btnSave',()=>saveGame(false));
button('btnParty',showParty);button('btnCharacter',showCharacter);button('btnFactions',openFactions);
button('btnSidebar',()=>$('sidebar').classList.toggle('mobile-hide'));
button('btnInspect',()=>$('inspector').classList.toggle('mobile-hide'));
button('partyClose',closeModal);
button('aftermathContinue',()=>{showScreen(null);inspectorDirty=true;refreshUI()});
button('trackingCancel',()=>clearPursuit());
$('encounterActions').addEventListener('click',e=>{
 const target=e.target.closest('[data-encounter-act]');
 if(target&&!target.disabled)handleEncounterAction(target.dataset.encounterAct);
});
button('characterClose',closeModal);
button('btnZoomIn',()=>zoomAt(1.32));
button('btnZoomOut',()=>zoomAt(1/1.32));
button('btnCenter',()=>{resetView();notify('Camera following your character.')});
button('btnOverview',()=>{focus=false;camera.x=W.WIDTH/2;camera.y=W.HEIGHT/2;camera.zoom=.115});
button('btnSpeed',()=>{state.speed=state.speed===1?2:state.speed===2?4:1;refreshUI()});
button('hudPause',()=>{state.pausedManual=!state.pausedManual;state.paused=state.pausedManual;refreshUI()});
button('mapNearest',()=>{const s=W.closestSettlement(state.player.x,state.player.y);selected={type:'settlement',id:s.id};inspectorDirty=true;refreshInspector()});
button('mapFaction',openFactions);
button('modalParty',showParty);
button('modalCharacter',showCharacter);
$('factionGrid').addEventListener('click',e=>{const b=e.target.closest('[data-faction]');if(b)showFactionDetails(Number(b.dataset.faction))});
$('partyModalContent').addEventListener('click',e=>{const b=e.target.closest('[data-upgrade]');if(b){upgradeRoster(Number(b.dataset.upgrade));showParty()}});
$('inspectorContent').addEventListener('click',e=>{
 const b=e.target.closest('[data-act]');if(!b||!state)return;
 const id=Number(b.dataset.id),act=b.dataset.act;
 if(['recruit','food','rest','rumors','visit'].includes(act))performSettlementAction(act,id);
 else if(act==='travelSettlement')travelTo(S[id].x,S[id].y,id);
 else if(act==='travelParty')trackParty(id);
 else if(act==='stopTrack')clearPursuit();
 else if(act==='meetParty'||act==='attackParty')openEncounter(id);
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
   stepTravel(dt);stepParties(dt);
   if(focus&&state.options.follow){
    const moving=partyById(state.pursuitId);
    const gap=moving?Math.hypot(state.player.x-moving.x,state.player.y-moving.y):Infinity;
    const midpoint=moving&&gap<800?.42:0;
    const tx=state.player.x+(moving?moving.x-state.player.x:0)*midpoint;
    const ty=state.player.y+(moving?moving.y-state.player.y:0)*midpoint;
    const blend=Math.min(1,dt*5);
    camera.x+=(tx-camera.x)*blend;camera.y+=(ty-camera.y)*blend;
   }
  }
  drawWorld(now);
  if(now-lastHud>350){
   if(selected?.type==='party'||selected?.type==='poi')inspectorDirty=true;
   refreshUI();lastHud=now;
  }
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
 try{if(localStorage.getItem('ua-battle-result-v1')&&savedExists())loadGame()}catch(e){}
}
init();
window.UACampaignDebug={getState:()=>state,getCamera:()=>camera,newCampaign:startCampaign,loadGame,saveGame,
 travelTo,advance:stepTravel,stepParties,world:W,landmarks,showFactionDetails,refreshUI,
 performSettlementAction,upgradeRoster,skirmish,drawWorld,showScreen,zoomAt,
 trackParty,clearPursuit,openEncounter,closeEncounter,handleEncounterAction,beginTacticalBattle,settleCampaignBattle};
})();
