(function(){
'use strict';

const ROLE_KEYS=['infantry','archer','cavalry','horseArcher'];
const ROUTE_BUDGET=10;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const finite=value=>Number.isFinite(value);
const point=value=>value&&finite(value.x)&&finite(value.y)?{x:value.x,y:value.y}:null;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const dot=(a,b)=>a.x*b.x+a.y*b.y;
function safeSample(field,p){
 try{const sample=field?.sample?.(p.x,p.y);return sample&&typeof sample==='object'?sample:{}}catch(e){return{}}
}
function valueAt(sample,key,fallback=0){return finite(sample?.[key])?sample[key]:fallback}
function teamForward(team){return team==='foe'||team==='enemy'?-1:1}
function roleCount(group){
 if(finite(group?.count))return Math.max(0,Math.floor(group.count));
 if(Array.isArray(group?.troops))return group.troops.filter(troop=>troop&&!troop.dead&&!troop.routed).length;
 return 0;
}
function activeGroups(groups){
 const active={};
 for(const key of ROLE_KEYS){const group=groups?.[key],count=roleCount(group),center=point(group?.center);
  if(count>0&&center)active[key]={...group,count,center};
 }
 return active;
}
function postureFor(phase,intent){
 const p=String(phase||'').toLowerCase(),i=String(intent||'').toLowerCase();
 if(p==='withdraw'||['withdraw','retreat','disengage'].includes(i))return'retreat';
 if(['hold','protect'].includes(p)||['defend','protect','hold'].includes(i))return'defend';
 if(p==='press')return'press';
 if(p==='skirmish'||i==='skirmish')return'skirmish';
 if(p==='flank'||i==='flank')return'flank';
 if(p==='reinforce')return'reinforce';
 return'attack';
}
function routeValue(routing,from,to,role,clearance){
 try{
  const result=routing?.route?.(from,to,{role,clearance});
  if(!result||!Array.isArray(result.waypoints))return null;
  return result;
 }catch(e){return null}
}
function shotClear(routing,from,to){
 try{return routing?.clearShot?.(from,to)===true}catch(e){return false}
}
function availableWidth(routing,p,heading){
 try{
  const value=routing?.areaWidth?.(p,heading);
  if(finite(value))return value;
  if(finite(value?.width))return value.width;
  if(finite(value?.minWidth))return value.minWidth;
 }catch(e){}
 return 180;
}
function objectivePosition(feature,forward,mode,ownCenter,enemyCenter,field){
 const width=Math.max(0,Number(feature.width)||0);
 const vector={x:enemyCenter.x-ownCenter.x,y:enemyCenter.y-ownCenter.y};
 const len=Math.max(1,Math.hypot(vector.x,vector.y)),ux=vector.x/len,uy=vector.y/len;
 let x=feature.x,y=feature.y;
 if(feature.type==='ford'){
  x-=ux*(Math.min(110,width*.2)+30);y-=uy*(Math.min(110,width*.2)+30);
 }else if(feature.type==='bank'){
  x-=ux*(Math.min(90,width*.16)+24);y-=uy*(Math.min(90,width*.16)+24);
 }else if(feature.type==='crest'||feature.type==='slope'){
  x-=ux*(Math.min(110,width*.22)+20);y-=uy*(Math.min(110,width*.22)+20);
 }else if(feature.type==='cover'){
  x-=ux*28;y-=uy*28;
 }else if(feature.type==='lane'){
  x-=ux*24;y-=uy*24;
 }
 const margin=28;
 return {x:clamp(x,margin,field.width-margin),y:clamp(y,margin,field.height-margin)};
}
function featureScore(feature,pos,context){
 const {field,ownCenter,enemyCenter,forward,mode,profileId,groups,previous,intent,personality}=context;
 const sample=safeSample(field,pos),toward={x:enemyCenter.x-ownCenter.x,y:enemyCenter.y-ownCenter.y};
 const span=Math.max(1,Math.hypot(toward.x,toward.y)),axis={x:toward.x/span,y:toward.y/span};
 const pastEnemy=dot({x:pos.x-enemyCenter.x,y:pos.y-enemyCenter.y},axis)>0;
 const ownDistance=distance(ownCenter,pos),enemyDistance=distance(enemyCenter,pos);
 const progress=dot({x:pos.x-ownCenter.x,y:pos.y-ownCenter.y},axis);
 const advancing=['attack','press','flank'].includes(mode);
 if(advancing&&progress< -38)return null;
 const ranged=groups.archer?.count||0,mounted=(groups.cavalry?.count||0)+(groups.horseArcher?.count||0);
 let score=3.2-ownDistance/Math.max(180,Math.min(field.width,field.height)*.12);
 const type=String(feature.type||'');
 if(type==='crest')score+=mode==='defend'||profileId==='ridge'?4.5:1.4;
 if(type==='slope')score+=mode==='defend'||profileId==='ridge'?3.2:1;
 if(type==='cover')score+=(ranged?3.0+Math.min(2,ranged*.04):.5)+(profileId==='woodland'?2.3:0);
 if(type==='ford')score+=mode==='attack'?3.7:mode==='defend'?1.4:2.2;
 if(type==='bank')score+=mode==='defend'?3.6:mode==='attack'?1.8:2.5;
 if(type==='lane')score+=mounted?2.2:0.3;
 if(profileId==='ridge'&&(type==='crest'||type==='bank'))score+=2.2;
 if(profileId==='woodland'&&type==='cover')score+=1.8;
 if(profileId==='marsh'&&(type==='bank'||type==='lane'))score+=1.2;
 if(profileId==='steppe'&&type==='lane')score+=1.8;
 score+=valueAt(sample,'elevation')*(mode==='defend'?1.05:.25);
 score+=valueAt(sample,'forest')*(ranged?.55:.08);
 score-=valueAt(sample,'mud')*(mounted?2.0:.7);
 score-=valueAt(sample,'water')*(mounted?2.6:1.15);
 if(mode==='defend'&&enemyDistance<72)score-=2.4;
 if(mode!=='retreat'&&pastEnemy)score-=8.5;
 if(advancing){
  score+=clamp(progress/Math.max(140,field.height*.23),-1,2.1);
  if(enemyDistance>span*.80)score-=1.4;
 }
 if(/cautious|defensive|patient/i.test(String(intent||'')+' '+String(personality||''))&&type==='crest')score+=1.2;
 if(/aggressive|bold|relentless/i.test(String(intent||'')+' '+String(personality||''))&&type==='lane')score+=.8;
 const id='feature:'+String(feature.id??type)+':'+mode;
 if(previous?.objective?.id===id&&previous.objective.use===mode)score+=1.25;
 return {id,type,name:String(feature.name||featureTypeName(type)),x:pos.x,y:pos.y,score,use:mode,featureId:feature.id??null};
}
function featureTypeName(type){
 return ({crest:'High ground',slope:'Slope',cover:'Covered approach',ford:'River crossing',bank:'River bank',lane:'Open lane'})[type]||'Battlefield ground';
}
function defaultObjective(field,ownCenter,enemyCenter,forward,mode,profileId,team){
 const vx=enemyCenter.x-ownCenter.x,vy=enemyCenter.y-ownCenter.y,len=Math.max(1,Math.hypot(vx,vy));
 const ux=vx/len,uy=vy/len,side=team==='foe'||team==='enemy'?1:-1;
 let x,y,type='frontage',name='Approach the enemy line';
 if(mode==='retreat'){
  x=ownCenter.x-ux*Math.min(240,len*.16);y=ownCenter.y-uy*Math.min(240,len*.16);type='retreat';name='Withdraw to safer ground';
 }else if(mode==='defend'||mode==='skirmish'){
  x=ownCenter.x+ux*Math.min(260,len*.24);y=ownCenter.y+uy*Math.min(260,len*.24);type='defensive-line';name='Hold a clear defensive line';
 }else{
  const approach=mode==='press'?24:55;
  x=enemyCenter.x-ux*approach;y=enemyCenter.y-uy*approach;
  if(mode==='press'){type='frontage';name='Press into the enemy center'}
  if(mode==='flank'){x+=uy*side*155;y-=ux*side*155;type='flank';name='Turn the enemy flank'}
  else if(mode==='reinforce'){x=ownCenter.x+ux*Math.min(190,len*.23);y=ownCenter.y+uy*Math.min(190,len*.23);type='reinforce';name='Join the main line'}
 }
 return {id:'default:'+type+':'+mode,type,name,x:clamp(x,28,field.width-28),y:clamp(y,28,field.height-28),score:0,use:mode,profileId};
}
function roleOrder(role,mode){
 if(mode==='retreat')return'retreat';
 if(mode==='defend')return'defend';
 if(mode==='woodlandHold')return['infantry','archer'].includes(role)?'defend':'attack';
 if(mode==='skirmish'&&role==='infantry')return'defend';
 if(mode==='reinforce'&&role==='infantry')return'defend';
 return'attack';
}
function goalFor(role,objective,groups,forward,side,field,routing,team,mode,enemyCenter){
 const infantry=groups.infantry,spacing=Math.max(105,Math.min(205,Math.sqrt(infantry?.count||0)*25+100));
 const back=role==='archer'?105:role==='horseArcher'?155:0;
 const axisVector={x:enemyCenter.x-groups[role].center.x,y:enemyCenter.y-groups[role].center.y};
 const axisLength=Math.max(1,Math.hypot(axisVector.x,axisVector.y));
 const ux=axisVector.x/axisLength,uy=axisVector.y/axisLength,lx=-uy,ly=ux;
 let x=objective.x-ux*back,y=objective.y-uy*back;
 if(role==='archer'){
  if(!infantry||infantry.count<2){x-=ux*45+lx*side*70;y-=uy*45+ly*side*70}
  else{x+=lx*side*48;y+=ly*side*48}
 }else if(role==='cavalry'){
  x=objective.x-ux*55+lx*side*spacing;y=objective.y-uy*55+ly*side*spacing;
 }else if(role==='horseArcher'){
  x=objective.x-ux*150+lx*side*spacing*1.35;y=objective.y-uy*150+ly*side*spacing*1.35;
 }else if(role==='infantry'){
  x=objective.x-lx*side*18;y=objective.y-ly*side*18;
 }
 if(mode==='retreat'){
  const towardEnemy={x:groups[role].center.x-objective.x,y:groups[role].center.y-objective.y};
  x=objective.x+towardEnemy.x*.08;y=objective.y+towardEnemy.y*.08;
 }
 const margin=28;x=clamp(x,margin,field.width-margin);y=clamp(y,margin,field.height-margin);
 let clearance=role==='cavalry'?30:role==='horseArcher'?25:role==='archer'?17:20;
 const narrowLane=field.features?.some(feature=>feature.type==='lane'&&
  distance(feature,objective)<Math.max(120,Number(feature.width)||0)&&Number(feature.width)>0&&Number(feature.width)<125);
 if(narrowLane&&(role==='cavalry'||role==='horseArcher'))clearance=14;
 if(role==='cavalry'||role==='horseArcher'){
  const angle=Math.atan2(enemyCenter.y-groups[role].center.y,enemyCenter.x-groups[role].center.x);
  const flankDistance=role==='horseArcher'?spacing*1.35:spacing;
  const backDistance=role==='horseArcher'?150:55;
  const baseX=objective.x-ux*backDistance,baseY=objective.y-uy*backDistance;
  const left={x:clamp(baseX+lx*side*flankDistance,28,field.width-28),
   y:clamp(baseY+ly*side*flankDistance,28,field.height-28)};
  const right={x:clamp(baseX-lx*side*flankDistance,28,field.width-28),
   y:clamp(baseY-ly*side*flankDistance,28,field.height-28)};
  const score=p=>{
   const ground=safeSample(field,p);
   const preferredSide=Math.sign(p.y-objective.y)===side?1:0;
   return availableWidth(routing,p,angle)*.008-valueAt(ground,'mud')*3.1-valueAt(ground,'water')*4.2-
    valueAt(ground,'forest')*1.3+valueAt(ground,'elevation')*.1+preferredSide*.35;
  };
  x=score(left)>=score(right)?left.x:right.x;y=score(left)>=score(right)?left.y:right.y;
 }
 return {x,y,clearance};
}
function previousRole(previous,role){return previous?.roles?.[role]||null}
function groupHasAmmo(group){
 if(finite(group?.ammo))return group.ammo>0;
 if(finite(group?.arrows))return group.arrows>0;
 if(Array.isArray(group?.troops))return group.troops.some(troop=>
  finite(troop?.ammo)?troop.ammo>0:finite(troop?.arrows)?troop.arrows>0:finite(troop?.ammoRemaining)?troop.ammoRemaining>0:false);
 return false;
}
function nearestEnemyDistance(input,from,fallback){
 const enemies=Array.isArray(input.enemies)?input.enemies:[];
 const positions=enemies.filter(enemy=>enemy&&enemy.dead!==true&&enemy.routed!==true&&enemy.active!==false)
  .map(enemy=>point(enemy.position)||point(enemy)).filter(Boolean);
 if(!positions.length)return distance(from,fallback);
 return Math.min(...positions.map(enemy=>distance(from,enemy)));
}
function stableGoal(candidate,previous,objective,role,order){
 const prior=previousRole(previous,role);
 if(prior&&prior.objectiveId===objective.id&&prior.tacticalUse===objective.use+':'+role&&prior.order===order&&
  point(prior.goal)&&distance(prior.goal,candidate)<=64){
  return point(prior.goal);
 }
 return candidate;
}
function roleId(role,objective,use,goal){
 return role+':'+objective.id+':'+use+':'+Math.round(goal.x)+','+Math.round(goal.y);
}
function plan(input={}){
 const field=input.field,routing=input.routing,ownCenter=point(input.ownCenter),enemyCenter=point(input.enemyCenter);
 if(!field||!finite(field.width)||!finite(field.height)||field.width<100||field.height<100||!routing?.route||!ownCenter||!enemyCenter)return null;
 const groups=activeGroups(input.groups);
 if(!Object.keys(groups).length)return null;
 const team=input.team||'friend',forward=teamForward(team),baseMode=postureFor(input.phase,input.intent),
  profileId=String(input.profileId||''),previous=input.previous||null;
 let mode=baseMode;
 const features=Array.isArray(field.features)?field.features:[];
 const crossingFeatures=features.filter(feature=>feature?.type==='ford');
 const crossingRequired=crossingFeatures.length>0&&[.2,.35,.5,.65,.8].some(part=>
  valueAt(safeSample(field,{x:ownCenter.x+(enemyCenter.x-ownCenter.x)*part,y:ownCenter.y+(enemyCenter.y-ownCenter.y)*part}),'water')>.18);
 const ridgeDefenseRequested=baseMode==='attack'&&(input.phase==='advance'||input.phase==='orderedAdvance')&&
  (team==='foe'||team==='enemy')&&profileId==='ridge';
 const selectionMode=ridgeDefenseRequested?'defend':baseMode;
 const context={field,ownCenter,enemyCenter,forward,mode:selectionMode,profileId,groups,previous,intent:input.intent,personality:input.personality};
 const routeCount={value:0};
 const candidates=[];
 const allowedFeatures=mode==='retreat'?[]:features.filter(feature=>{
  if(mode==='press')return crossingRequired&&['ford','bank'].includes(feature?.type);
  if((mode==='defend'||ridgeDefenseRequested)&&crossingRequired)return ['ford','bank'].includes(feature?.type);
  if(ridgeDefenseRequested)return ['crest','bank'].includes(feature?.type);
  return true;
 });
 for(const feature of allowedFeatures){
  if(!feature||!finite(feature.x)||!finite(feature.y)||!['crest','slope','cover','ford','bank','lane'].includes(feature.type))continue;
  const pos=objectivePosition(feature,forward,mode,ownCenter,enemyCenter,field);
  const candidate=featureScore(feature,pos,context);
  if(candidate&&candidate.score>-.5)candidates.push(candidate);
 }
 candidates.sort((a,b)=>b.score-a.score||String(a.id).localeCompare(String(b.id)));
 let objective=null;
 // Compare the best reachable positions by marching cost and frontage.
 for(const candidate of candidates.slice(0,3)){
  routeCount.value++;
  const route=routeValue(routing,ownCenter,candidate,'infantry',20);
  if(!route)continue;
  const heading=Math.atan2(enemyCenter.y-candidate.y,enemyCenter.x-candidate.x);
  const width=availableWidth(routing,candidate,heading);
  const frontage=Math.sqrt(groups.infantry?.count||1)*34;
  const score=candidate.score-Math.max(0,route.cost-route.length)/220-
   Math.max(0,frontage-width)/115;
  if(!objective||score>objective.score)objective={...candidate,score};
 }
 if(ridgeDefenseRequested){
  const span=Math.max(1,distance(ownCenter,enemyCenter));
  const elevation=valueAt(safeSample(field,objective||{x:0,y:0}),'elevation');
  if(objective&&['crest','bank'].includes(objective.type)&&distance(ownCenter,objective)<Math.max(220,span*.38)&&
    (objective.type==='bank'&&crossingRequired||elevation>=.45)){
   mode='defend';
  }else{mode='attack';objective=null}
 }
 if(!objective)objective=defaultObjective(field,ownCenter,enemyCenter,forward,mode,profileId,team);
 const distanceVector={x:enemyCenter.x-ownCenter.x,y:enemyCenter.y-ownCenter.y};
 const distanceLength=Math.max(1,Math.hypot(distanceVector.x,distanceVector.y));
 const teamSide=team==='foe'||team==='enemy'?1:-1;
 let woodlandArcherRoute=null,woodlandArcherGoal=null;
 if(mode==='attack'&&profileId==='woodland'&&input.phase==='advance'&&objective.type==='cover'&&
  groups.archer&&groupHasAmmo(groups.archer)){
  const pressure=nearestEnemyDistance(input,objective,enemyCenter);
  const pressureLimit=Math.min(560,distanceLength*.62);
  const holdObjective={...objective,id:objective.id.replace(/:attack$/u,':woodlandHold'),use:'woodlandHold'};
  const proposed=goalFor('archer',holdObjective,groups,forward,teamSide,field,routing,team,'woodlandHold',enemyCenter);
  const archerGoal=stableGoal(proposed,previous,holdObjective,'archer','defend');
  if(pressure>=90&&pressure<=pressureLimit&&shotClear(routing,archerGoal,enemyCenter)){
   routeCount.value++;
   woodlandArcherRoute=routeValue(routing,groups.archer.center,archerGoal,'archer',17);
   if(woodlandArcherRoute){
    woodlandArcherGoal=archerGoal;
    mode='woodlandHold';objective=holdObjective;
   }
  }
 }
 const roles={};let retries=0;
 for(const role of ROLE_KEYS){
  const group=groups[role];if(!group)continue;
  const order=roleOrder(role,mode);
  let candidate=goalFor(role,objective,groups,forward,teamSide,field,routing,team,mode,enemyCenter);
  let goal=role==='archer'&&woodlandArcherRoute?woodlandArcherGoal:stableGoal(candidate,previous,objective,role,order);
  if(role==='archer'){
   const options=[goal,
    {x:clamp(goal.x,28,field.width-28),y:clamp(goal.y-teamSide*105,28,field.height-28)},
    {x:clamp(goal.x,28,field.width-28),y:clamp(goal.y+teamSide*105,28,field.height-28)}];
   const clear=options.map(p=>shotClear(routing,p,enemyCenter));
   const selected=clear.indexOf(true);
   if(selected>=0)goal=options[selected];
   else if(mode!=='retreat')continue;
  }
  const routeRole=role==='horseArcher'?'cavalry':role;
  let route=role==='archer'&&woodlandArcherRoute?woodlandArcherRoute:
   routeValue(routing,group.center,goal,routeRole,candidate.clearance);
  if(!(role==='archer'&&woodlandArcherRoute))routeCount.value++;
  if(!route&&retries<2){
   retries++;
   const rawFallback=role==='archer'?{x:objective.x-forward*115,y:objective.y}:
    role==='cavalry'||role==='horseArcher'?{x:objective.x-forward*35,y:objective.y+teamSide*140}:objective;
   const fallback={x:clamp(rawFallback.x,28,field.width-28),y:clamp(rawFallback.y,28,field.height-28)};
   route=routeValue(routing,group.center,fallback,routeRole,candidate.clearance);routeCount.value++;
   if(route)goal=fallback;
  }
  if(!route)continue;
  const tacticalUse=objective.use+':'+role;
  const id=roleId(role,objective,tacticalUse,goal);
  const facing=Math.atan2(enemyCenter.y-goal.y,enemyCenter.x-goal.x);
  roles[role]={id,goal,route,order,facing,name:roleName(role,objective,mode),objectiveId:objective.id,
   tacticalUse,routeCost:finite(route.cost)?route.cost:null,clearShot:role==='archer'?shotClear(routing,goal,enemyCenter):undefined,
   screenedBy:role==='archer'&&groups.infantry&&groups.infantry.count>=2?'infantry':null,
   count:group.count,role};
 }
 if(routeCount.value>ROUTE_BUDGET)return null;
 if(!Object.keys(roles).length)return null;
 return {objective:{id:objective.id,type:objective.type,name:objective.name,x:objective.x,y:objective.y,
   score:objective.score,use:objective.use,featureId:objective.featureId??null},roles,routeQueries:routeCount.value};
}
function roleName(role,objective,mode){
 const titles={infantry:'Infantry line',archer:'Covered archers',cavalry:'Cavalry flank',horseArcher:'Mounted skirmishers'};
 if(mode==='retreat')return titles[role]+' · withdrawal';
 if(mode==='defend')return titles[role]+' · defend '+objective.name.toLowerCase();
 if(mode==='woodlandHold'&&['infantry','archer'].includes(role))return titles[role]+' · hold woodland cover';
 if(role==='archer')return titles[role]+' · clear shot';
 if(role==='cavalry'||role==='horseArcher')return titles[role]+' · dry flank';
 return titles[role]+' · advance';
}

window.UABattleTactics={VERSION:1,ROUTE_BUDGET,plan};
})();
