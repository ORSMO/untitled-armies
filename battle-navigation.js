(function(){
'use strict';

const EPSILON=1e-9;
const RING_STEPS=24;
const EMPTY_ROCKS=[];
const scenesByRocks=new WeakMap();
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const finitePoint=point=>Number.isFinite(point?.x)&&Number.isFinite(point?.y);

function clearanceValue(clearance){
 return Number.isFinite(clearance)?Math.max(0,clearance):0;
}

function validRock(rock){
 return finitePoint(rock)&&Number.isFinite(rock.rx)&&Number.isFinite(rock.ry)&&rock.rx>0&&rock.ry>0;
}

function hitsEllipse(start,end,rock,rx,ry){
 if(Math.min(start.x,end.x)>rock.x+rx||Math.max(start.x,end.x)<rock.x-rx||
    Math.min(start.y,end.y)>rock.y+ry||Math.max(start.y,end.y)<rock.y-ry)return false;
 const x=(start.x-rock.x)/rx,y=(start.y-rock.y)/ry;
 const dx=(end.x-start.x)/rx,dy=(end.y-start.y)/ry;
 const lengthSquared=dx*dx+dy*dy;
 const closest=lengthSquared>0?clamp(-(x*dx+y*dy)/lengthSquared,0,1):0;
 const nearestX=x+dx*closest,nearestY=y+dy*closest;
 return nearestX*nearestX+nearestY*nearestY<=1+EPSILON;
}

function segmentClear(start,end,rocks=EMPTY_ROCKS,clearance=0){
 if(!finitePoint(start)||!finitePoint(end))return false;
 const padding=clearanceValue(clearance);
 for(const rock of Array.isArray(rocks)?rocks:EMPTY_ROCKS){
  if(validRock(rock)&&hitsEllipse(start,end,rock,rock.rx+padding,rock.ry+padding))return false;
 }
 return true;
}

function navigationBounds(bounds){
 const minX=bounds?.minX??0,minY=bounds?.minY??0;
 const maxX=bounds?.maxX??bounds?.width,maxY=bounds?.maxY??bounds?.height;
 if(![minX,minY,maxX,maxY].every(Number.isFinite)||maxX<minX||maxY<minY)return null;
 return {minX,minY,maxX,maxY};
}

function boundPoint(point,bounds){
 return {x:clamp(point.x,bounds.minX,bounds.maxX),y:clamp(point.y,bounds.minY,bounds.maxY)};
}

function sceneClear(start,end,scene){
 for(const rock of scene.rocks)if(hitsEllipse(start,end,rock,rock.rx,rock.ry))return false;
 return true;
}

function sceneFor(rocks,bounds,clearance){
 const source=Array.isArray(rocks)?rocks:EMPTY_ROCKS;
 let scenes=scenesByRocks.get(source);
 if(!scenes){
  scenes=new Map();
  scenesByRocks.set(source,scenes);
 }
 const key=[bounds.minX,bounds.minY,bounds.maxX,bounds.maxY,clearance].join(':');
 if(scenes.has(key))return scenes.get(key);
 const scene={
  bounds,
  rocks:source.filter(validRock).map(rock=>({
   x:rock.x,y:rock.y,rx:rock.rx+clearance,ry:rock.ry+clearance
  })),
  nodes:null,
  edges:null,
  visible:null
 };
 if(scenes.size>=12)scenes.delete(scenes.keys().next().value);
 scenes.set(key,scene);
 return scene;
}

function radialPoint(rock,x,y,margin=0){
 const scale=1/Math.hypot(x/rock.rx,y/rock.ry);
 return {x:rock.x+x*scale+x*margin,y:rock.y+y*scale+y*margin};
}

function sceneNodes(scene){
 if(scene.nodes)return scene.nodes;
 const {bounds,rocks}=scene;
 const nodes=[],seen=new Set();
 function add(point){
  const node=boundPoint(point,bounds);
  const key=Math.round(node.x*1000)+':'+Math.round(node.y*1000);
  if(seen.has(key)||!sceneClear(node,node,scene))return;
  seen.add(key);
  nodes.push(node);
 }
 function addGate(x,y,axisX,axisY,span){
  add({x,y});
  for(const offset of [Math.max(1,span*.12),Math.max(3,span*.48)]){
   add({x:x+axisX*offset,y:y+axisY*offset});
   add({x:x-axisX*offset,y:y-axisY*offset});
  }
 }
 for(const x of [bounds.minX,bounds.maxX]){
  for(const y of [bounds.minY,bounds.maxY])add({x,y});
 }

 for(let i=0;i<rocks.length;i++){
  const rock=rocks[i];
  // Adjacent vertices enclose the inflated ellipse. An inscribed ring
  // would cut through it, so add a small margin outside the tangent polygon.
  const outside=1/Math.cos(Math.PI/RING_STEPS);
  for(let n=0;n<RING_STEPS;n++){
   const angle=n*Math.PI*2/RING_STEPS;
   add({
    x:rock.x+Math.cos(angle)*(rock.rx*outside+.2),
    y:rock.y+Math.sin(angle)*(rock.ry*outside+.2)
   });
  }

  // Near a wall, the midpoint preserves passages thinner than a ring segment.
  const left=rock.x-rock.rx,right=rock.x+rock.rx;
  const top=rock.y-rock.ry,bottom=rock.y+rock.ry;
  const sideGap=Math.max(18,rock.rx*.35),heightGap=Math.max(18,rock.ry*.35);
  if(left>bounds.minX&&left-bounds.minX<sideGap)addGate((left+bounds.minX)/2,rock.y,0,1,rock.ry);
  if(right<bounds.maxX&&bounds.maxX-right<sideGap)addGate((right+bounds.maxX)/2,rock.y,0,1,rock.ry);
  if(top>bounds.minY&&top-bounds.minY<heightGap)addGate(rock.x,(top+bounds.minY)/2,1,0,rock.rx);
  if(bottom<bounds.maxY&&bounds.maxY-bottom<heightGap)addGate(rock.x,(bottom+bounds.maxY)/2,1,0,rock.rx);

  for(let j=0;j<i;j++){
   const other=rocks[j],gap=distance(rock,other);
   if(gap<EPSILON)continue;
   const dx=(other.x-rock.x)/gap,dy=(other.y-rock.y)/gap;
   const a=radialPoint(rock,dx,dy),b=radialPoint(other,-dx,-dy);
   const span=Math.min(rock.rx,rock.ry,other.rx,other.ry);
   const opening=(b.x-a.x)*dx+(b.y-a.y)*dy;
   if(opening<=EPSILON||opening>Math.max(18,span*.35))continue;
   addGate((a.x+b.x)/2,(a.y+b.y)/2,-dy,dx,span);
  }
 }
 scene.nodes=nodes;
 return nodes;
}

function projectInScene(point,scene){
 const position=boundPoint(point,scene.bounds);
 if(sceneClear(position,position,scene))return position;
 let best=null,bestDistance=Infinity;
 function consider(candidate){
  const safe=boundPoint(candidate,scene.bounds),gap=distance(position,safe);
  if(gap<bestDistance&&sceneClear(safe,safe,scene)){
   best=safe;
   bestDistance=gap;
  }
 }
 for(const rock of scene.rocks){
  if(!hitsEllipse(position,position,rock,rock.rx,rock.ry))continue;
  const dx=position.x-rock.x,dy=position.y-rock.y;
  const length=Math.hypot(dx,dy);
  if(length>EPSILON)consider(radialPoint(rock,dx/length,dy/length,.25));
  // A point at the center or along the long axis might be closer to either side.
  for(let n=0;n<RING_STEPS;n++){
   const angle=n*Math.PI*2/RING_STEPS;
   consider(radialPoint(rock,Math.cos(angle),Math.sin(angle),.25));
  }
 }
 for(const node of sceneNodes(scene))consider(node);
 return best;
}

function projectPoint(point,rocks,bounds,clearance=0){
 const area=navigationBounds(bounds);
 if(!area||!finitePoint(point))return null;
 const position=boundPoint(point,area),padding=clearanceValue(clearance);
 if(segmentClear(position,position,rocks,padding))return position;
 return projectInScene(position,sceneFor(rocks,area,padding));
}

function edgesFrom(scene,index){
 const nodes=sceneNodes(scene),count=nodes.length;
 if(!scene.edges){
  scene.edges=new Array(count);
  scene.visible=new Uint8Array(count*count);
 }
 if(scene.edges[index])return scene.edges[index];
 const edges=[];
 // Evaluate and cache a visibility row only when a search expands it.
 // Both directions share the collision test.
 for(let next=0;next<count;next++){
  if(index===next)continue;
  const offset=index*count+next;
  if(scene.visible[offset]===0){
   const clear=sceneClear(nodes[index],nodes[next],scene)?1:2;
   scene.visible[offset]=scene.visible[next*count+index]=clear;
  }
  if(scene.visible[offset]===1)edges.push({next,cost:distance(nodes[index],nodes[next])});
 }
 scene.edges[index]=edges;
 return edges;
}

function routeThroughScene(start,end,scene){
 const nodes=sceneNodes(scene);
 const count=nodes.length,costs=new Float64Array(count),heuristic=new Float64Array(count);
 const parents=new Int32Array(count),visited=new Uint8Array(count);
 costs.fill(Infinity);
 parents.fill(-1);
 for(let i=0;i<count;i++){
  heuristic[i]=distance(nodes[i],end);
  if(sceneClear(start,nodes[i],scene))costs[i]=distance(start,nodes[i]);
 }

 while(true){
  let current=-1,score=Infinity;
  for(let i=0;i<count;i++){
   const estimate=costs[i]+heuristic[i];
   if(!visited[i]&&estimate<score){current=i;score=estimate}
  }
  if(current<0)return [];
  if(sceneClear(nodes[current],end,scene)){
   const route=[end];
   for(let i=current;i>=0;i=parents[i])route.push({...nodes[i]});
   return route.reverse();
  }
  visited[current]=1;
  for(const edge of edgesFrom(scene,current)){
   if(visited[edge.next])continue;
   const cost=costs[current]+edge.cost;
   if(cost>=costs[edge.next])continue;
   costs[edge.next]=cost;
   parents[edge.next]=current;
  }
 }
}

function findPath(start,end,rocks,bounds,clearance=0){
 const area=navigationBounds(bounds);
 if(!area||!finitePoint(start)||!finitePoint(end))return [];
 const padding=clearanceValue(clearance);
 const boundedStart=boundPoint(start,area),boundedEnd=boundPoint(end,area);
 if(segmentClear(boundedStart,boundedEnd,rocks,padding))return [boundedEnd];
 const scene=sceneFor(rocks,area,padding);
 const safeStart=projectInScene(boundedStart,scene),safeEnd=projectInScene(boundedEnd,scene);
 if(!safeStart||!safeEnd)return [];
 const route=sceneClear(safeStart,safeEnd,scene)?[safeEnd]:
  routeThroughScene(safeStart,safeEnd,scene);
 if(route.length&&distance(safeStart,boundedStart)>EPSILON)route.unshift(safeStart);
 return route;
}

window.UABattleNavigation={findPath,segmentClear,projectPoint};
})();
