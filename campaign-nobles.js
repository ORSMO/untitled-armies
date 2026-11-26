(function(){
'use strict';

const circuits=[
 {houseId:12,purpose:'visit',stopType:'town',firstDelay:1.75,stopDelay:5,homeDelay:15,speed:80,strength:24},
 {houseId:13,purpose:'inspection',stopType:'village',firstDelay:3.25,stopDelay:3.5,homeDelay:17,speed:74,strength:18}
];
const circuitByHouse=new Map(circuits.map(circuit=>[circuit.houseId,circuit]));
const MAX_ROAMING_PER_REALM=3;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

function settlement(world,id){
 if(!Number.isInteger(id))return null;
 return world.getSettlement?.(id)||world.settlements.find(site=>site.id===id)||null;
}

function friendlySite(world,record,id){
 const site=settlement(world,id);
 return site?.faction===record.party.faction?site:null;
}

function availableStops(world,record,circuit,excluded,scoreStop){
 const home=settlement(world,record.homeId);
 const priority=site=>Number(site.type===circuit.stopType)*175+
  Number(record.holdings.includes(site.id))*100+(scoreStop?.(record,site)||0)-distance(home,site)*.17;
 return world.settlements
  .filter(site=>site.faction===record.party.faction&&site.id!==record.homeId&&!excluded.has(site.id))
  .sort((a,b)=>circuit.pilot?Number(b.type===circuit.stopType)-Number(a.type===circuit.stopType)||
   distance(home,a)-distance(home,b)||a.id-b.id:priority(b)-priority(a)||a.id-b.id);
}

function routeTo(world,position,site){
 const route=world.findPath(position.x,position.y,site.x,site.y);
 if(!Array.isArray(route)||route.length===0||
    route.some(point=>!Number.isFinite(point?.x)||!Number.isFinite(point?.y)))return null;
 const end=route[route.length-1];
 // The world planner returns tile centers. Complete the last few units to the gate.
 if(distance(end,site)>(world.TILE||56))return null;
 const path=route.map(point=>({x:point.x,y:point.y}));
 if(distance(end,site)>.001)path.push({x:site.x,y:site.y});
 return path;
}

function park(record,site,purpose,nextMoveAt){
 record.siteId=site.id;
 record.destinationId=null;
 record.lastSeenSiteId=site.id;
 record.purpose=purpose;
 record.nextMoveAt=nextMoveAt;
 const party=record.party;
 party.x=party.tx=site.x;
 party.y=party.ty=site.y;
 party.active=false;
 party.path=[];
 party.pathIndex=0;
}

function depart(record,site,purpose,path,nowHours){
 record.siteId=null;
 record.destinationId=site.id;
 record.purpose=purpose;
 record.nextMoveAt=nowHours;
 const party=record.party;
 party.tx=site.x;
 party.ty=site.y;
 party.path=path;
 party.pathIndex=0;
 party.active=true;
}

function storedPosition(world,party){
 if(!Number.isFinite(party?.x)||!Number.isFinite(party?.y))return null;
 if(party.x<0||party.y<0||party.x>=world.WIDTH||party.y>=world.HEIGHT)return null;
 const accessible=world.stablePosition?.(party.x,party.y);
 if(accessible)return accessible;
 if(world.tileAt?.(party.x,party.y)?.walk===false)return null;
 return {x:party.x,y:party.y};
}

function restoreRecord(world,record,circuit,saved,nowHours,excluded){
 const home=settlement(world,record.homeId);
 const preferred=friendlySite(world,record,saved?.circuitSiteId);
 const stops=availableStops(world,record,circuit,excluded);
 record.circuitSiteId=preferred&&preferred.id!==home.id&&!excluded.has(preferred.id)?
  preferred.id:stops[0]?.id??null;

 const savedSite=friendlySite(world,record,saved?.siteId);
 if(savedSite){
  const delay=savedSite.id===home.id?circuit.homeDelay:circuit.stopDelay;
  const next=Number.isFinite(saved.nextMoveAt)?
   Math.max(nowHours,Math.min(nowHours+delay+8,saved.nextMoveAt)):nowHours+delay;
  if(savedSite.id!==home.id&&!excluded.has(savedSite.id))record.circuitSiteId=savedSite.id;
  park(record,savedSite,savedSite.id===home.id?'home':circuit.purpose,next);
  return;
 }

 const destination=friendlySite(world,record,saved?.destinationId);
 const lastSeen=friendlySite(world,record,saved?.lastSeenSiteId)||home;
 const position=storedPosition(world,saved?.party);
 if(saved?.siteId===null&&destination&&position){
  const path=routeTo(world,position,destination);
  if(path){
   record.lastSeenSiteId=lastSeen.id;
   record.party.x=position.x;
   record.party.y=position.y;
   record.recovering=saved.recovering===true&&destination.id===home.id;
   if(destination.id!==home.id&&!excluded.has(destination.id))record.circuitSiteId=destination.id;
   depart(record,destination,destination.id===home.id?'return':circuit.purpose,path,nowHours);
   return;
  }
  const back=routeTo(world,position,lastSeen);
  if(back){
   record.lastSeenSiteId=lastSeen.id;
   record.party.x=position.x;
   record.party.y=position.y;
   depart(record,lastSeen,lastSeen.id===home.id?'return':circuit.purpose,back,nowHours);
   return;
  }
 }

 // Missing or unusable save data starts a clean circuit at the house seat.
 park(record,home,'home',nowHours+circuit.firstDelay);
}

function memberCircuit(house,person,index){
 const pilot=person.role==='head'&&circuitByHouse.get(house.id);
 if(pilot)return {...pilot,pilot:true};
 const purpose=person.role==='head'?'visit':person.role==='partner'?'supplies':
  person.generation===-1?'visit':index%2?'inspection':'patrol';
 const stopType=purpose==='visit'?'town':purpose==='patrol'?'castle':'village';
 return {purpose,stopType,firstDelay:2+(house.id*13+index*7)%25,stopDelay:3+index%4,homeDelay:11+(house.id+index*3)%10,
  speed:73+index%7,strength:12};
}
function create(world,houses,saved,nowHours=0,options={}){
 const records=[],taken=new Set();
 const now=Number.isFinite(nowHours)?nowHours:0;
 const previous=Array.isArray(saved)?saved.filter(Boolean):[];
 const members=options.families?houses.flatMap(house=>(options.families.get(house.id)||[]).map((person,index)=>({house,person,index})).filter(row=>row.person.age>=18)):
  circuits.flatMap(circuit=>{
   const house=houses.find(candidate=>candidate.id===circuit.houseId);
   return house?[{house,person:{id:'person-'+house.id+'-head',role:'head'},index:0}]:[];
  });
 for(const {house,person,index} of members){
  const circuit=memberCircuit(house,person,index);
  const home=settlement(world,house?.seatId);
  if(!house||!home||home.faction!==house.faction)continue;
  const id=person.role==='head'?-100-house.id:-1000-house.id*32-index;
  const record={
   houseId:house.id,personId:person.id,homeId:home.id,siteId:home.id,destinationId:null,lastSeenSiteId:home.id,
   purpose:'home',circuitSiteId:null,nextMoveAt:now+circuit.firstDelay,circuit,holdings:options.holdings?.(house.id)||[],cargo:null,
   party:{
    id,kind:'noble',houseId:house.id,personId:person.id,faction:house.faction,
    x:home.x,y:home.y,tx:home.x,ty:home.y,strength:options.strength?.(person.id)||circuit.strength,
    active:false,path:[],pathIndex:0
   }
  };
  const savedRecord=previous.find(entry=>entry.personId===person.id||
   (!entry.personId&&entry.houseId===house.id&&person.role==='head'));
  const cargo=savedRecord?.cargo;
  if(circuit.purpose==='supplies'&&['grain','iron','timber','salt','tools'].includes(cargo?.resource)&&
   Number.isInteger(cargo.quantity)&&cargo.quantity>0&&cargo.quantity<=8)record.cargo={resource:cargo.resource,quantity:cargo.quantity};
  restoreRecord(world,record,circuit,savedRecord,now,circuit.pilot?taken:new Set());
  if(circuit.pilot&&record.circuitSiteId!==null)taken.add(record.circuitSiteId);
  records.push(record);
 }
 return records;
}

function startScheduledLeg(world,records,record,circuit,nowHours,scoreStop){
 if(nowHours<record.nextMoveAt)return false;
 const home=settlement(world,record.homeId),party=record.party;
 if(record.siteId!==home.id){
  const path=routeTo(world,party,home);
  if(path){depart(record,home,'return',path,nowHours);return true}
 }else{
  const taken=new Set(records.filter(other=>other!==record&&
   (circuit.pilot?other.circuit.pilot:other.party.active)).map(other=>circuit.pilot?other.circuitSiteId:other.destinationId));
  const stops=availableStops(world,record,circuit,taken,scoreStop);
  const known=stops.findIndex(site=>site.id===record.circuitSiteId);
  if(circuit.pilot&&known>0)stops.unshift(...stops.splice(known,1));
  for(const site of stops){
   const path=routeTo(world,party,site);
   if(!path)continue;
   record.circuitSiteId=site.id;
   depart(record,site,circuit.purpose,path,nowHours);
   return true;
  }
 }
 // A blocked road should not trigger another full path search every frame.
 record.nextMoveAt=nowHours+2;
 return false;
}

function advanceEscort(party,distanceBudget){
 while(distanceBudget>0&&party.pathIndex<party.path.length){
  const waypoint=party.path[party.pathIndex];
  const gap=distance(party,waypoint);
  if(gap<=distanceBudget){
   party.x=waypoint.x;
   party.y=waypoint.y;
   party.pathIndex++;
   distanceBudget-=gap;
  }else{
   party.x+=(waypoint.x-party.x)/gap*distanceBudget;
   party.y+=(waypoint.y-party.y)/gap*distanceBudget;
   return;
  }
 }
}

function step(world,records,nowHours,dt,{scoreStop,onArrival}={}){
 if(!Number.isFinite(nowHours)||!Number.isFinite(dt)||dt<0)return false;
 let changed=false;
 const activeByRealm=new Map();
 for(const record of records){
  const circuit=record.circuit;
  const party=record.party;
  if(!party.active)continue;
  advanceEscort(party,circuit.speed*dt);
  if(party.pathIndex>=party.path.length){
   const destination=settlement(world,record.destinationId);
   if(destination){
    const home=destination.id===record.homeId;
    const recovery=record.recovering?8:0;
    park(record,destination,home?'home':circuit.purpose,nowHours+(home?circuit.homeDelay+recovery:circuit.stopDelay));
    record.recovering=false;
    onArrival?.(record,destination);
    changed=true;
   }
  }
  if(party.active)activeByRealm.set(party.faction,(activeByRealm.get(party.faction)||0)+1);
 }
 let next=null;
 for(const record of records){
  if(record.siteId===null||record.nextMoveAt>nowHours||
   (activeByRealm.get(record.party.faction)||0)>=MAX_ROAMING_PER_REALM)continue;
  if(!next||record.nextMoveAt<next.nextMoveAt)next=record;
 }
 // Route searches share one departure per tick across all houses.
 if(next&&startScheduledLeg(world,records,next,next.circuit,nowHours,scoreStop))changed=true;
 return changed;
}

function snapshot(records){
 return records.map(record=>({
  houseId:record.houseId,personId:record.personId,homeId:record.homeId,siteId:record.siteId,
  destinationId:record.destinationId,lastSeenSiteId:record.lastSeenSiteId,
  purpose:record.purpose,circuitSiteId:record.circuitSiteId,nextMoveAt:record.nextMoveAt,cargo:record.cargo,recovering:!!record.recovering,
  party:{x:record.party.x,y:record.party.y}
 }));
}

function sendHome(world,record,nowHours){
 const home=settlement(world,record.homeId);
 if(!home)return;
 const path=routeTo(world,record.party,home);
 if(path){
  depart(record,home,'return',path,nowHours);
  record.recovering=true;
 }else park(record,home,'home',nowHours+record.circuit.homeDelay+8);
}

window.UANobles={create,step,snapshot,sendHome};
})();
