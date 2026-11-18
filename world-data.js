
(function(){
'use strict';
const WIDTH=12000,HEIGHT=8200,TILE=56,COLS=Math.ceil(WIDTH/TILE),ROWS=Math.ceil(HEIGHT/TILE);
const factions=[
 {id:0,name:'Verdant Marches',color:'#609569',symbol:'✥',culture:'Woodland marcher lords',capital:[1480,2650],motto:'The green watch endures.',trait:'Resilient shieldmen and forest rangers',troops:['March Recruit','March Shieldman','Greenwarden'],cities:['Greenwatch','Thornfield','Briarholt','Oakkeep','Mossford','Ferncross','Rookwood','Lindenfell']},
 {id:1,name:'Skeldic Jarldoms',color:'#83b9bd',symbol:'ᛟ',culture:'Northern sea jarls',capital:[3540,1590],motto:'We endure the winter.',trait:'Huscarls and fearless axe warriors',troops:['Skeldic Bondi','Skeldic Axe Guard','Storm Huscarl'],cities:['Frostheim','Skeldhaven','Whaleport','Snowgate','Hailvik','Windstead','Bearholt','Icemead']},
 {id:2,name:'Ironhold Clans',color:'#a2a6b4',symbol:'⚒',culture:'Mountain strongholds',capital:[6120,1690],motto:'Steel holds where words fail.',trait:'Armored infantry and disciplined pikes',troops:['Clan Levy','Iron Spearman','Ironhold Sentinel'],cities:['Ironhold','Forgecross','Granitehall','Hammerkeep','Stonebridge','Deepwell','Anvilford','Cairnwatch']},
 {id:3,name:'Crown of Veyr',color:'#9b87b9',symbol:'♛',culture:'Old feudal nobility',capital:[8360,1730],motto:'By the crown and oath.',trait:'Royal knights and heavily armored lancers',troops:['Veyran Footman','Veyran Man-at-Arms','Royal Lancer'],cities:['Veyrgrad','Rosehaven','Goldbridge','Kingspire','Bellwick','Oathford','Northspire','Gildmere']},
 {id:4,name:'Sunspire Dominion',color:'#d7b06b',symbol:'☼',culture:'Eastern sun courts',capital:[10510,2780],motto:'Our banners meet the dawn.',trait:'Elite bowmen and plated cavalry',troops:['Sunspire Levy','Sunspire Archer','Sunward Cataphract'],cities:['Sunspire','Dawncrest','Amberreach','Lightridge','Larkford','Hearthsun','Palegate','Goldmere']},
 {id:5,name:'Tideborn League',color:'#589cb0',symbol:'⚓',culture:'Western merchant cities',capital:[1450,5910],motto:'A free shore, a free people.',trait:'Crossbowmen and caravan guards',troops:['League Dockhand','League Crossbowman','Tidewatch Veteran'],cities:['Saltmere','Bluehaven','Marshport','Seawatch','Reedbay','Wharfend','Nettleport','Brineford']},
 {id:6,name:'Kingdom of Valdoria',color:'#c77876',symbol:'⚜',culture:'Western hill kingdoms',capital:[3870,5320],motto:'Honor is forged in service.',trait:'Balanced swordsmen, spearmen and cavalry',troops:['Valdorian Recruit','Valdorian Swordsman','Valdorian Royal Guard'],cities:['Valdoria','Redmarsh','Stonefield','Valecrown','Duskford','Westhaven','Clearbrook','Ashmont']},
 {id:7,name:'Aurelian Empire',color:'#b9a4d0',symbol:'✦',culture:'Imperial heartland',capital:[6220,5080],motto:'A thousand banners, one empire.',trait:'Legion shields and organized veteran infantry',troops:['Imperial Recruit','Aurelian Legionary','Imperial Praetorian'],cities:['Aurelia','Corvannis','Silvergate','Legionwatch','Locus','Valemere','Hearthwick','Praetorium']},
 {id:8,name:'Saffron Sultanate',color:'#c99a67',symbol:'☾',culture:'Southern oasis sultanates',capital:[8610,6250],motto:'The sands remember.',trait:'Desert lancers and composite bowmen',troops:['Saffron Militia','Desert Archer','Sultan’s Guard'],cities:['Saffron','Qamar','Zarif','Sandhold','Nadir','Miraj','Azhar','Sahira']},
 {id:9,name:'Red Steppe Khanate',color:'#c66e57',symbol:'➳',culture:'Eastern horse clans',capital:[10600,5770],motto:'The horizon has no walls.',trait:'Fast horse archers and nomadic riders',troops:['Steppe Rider','Steppe Horse Archer','Crimson Khan Guard'],cities:['Kharadan','Tumar','Ordu','Redcrest','Khagan','Uldan','Kesh','Tengri']}
];

const wars=[[0,3],[1,2],[3,7],[4,9],[5,6],[7,8]].map(p=>p.slice());
const palette={
 sea:'#284d5a',river:'#638e9a',mountain:'#888a7c',hills:'#929579',
 forest:'#4b7754',grass:'#849c6f',steppe:'#aa9f77',desert:'#c6ae7a',
 snow:'#d3d8cb',marsh:'#668b7b',taiga:'#55786c',tundra:'#aab39c',
 scrub:'#a6a17b',rainforest:'#3b735b'
};
const biomeCost={
 grass:1,forest:1.52,steppe:1.14,desert:1.55,hills:1.62,
 mountain:4.8,snow:1.75,marsh:2.75,river:2.3,taiga:1.68,
 tundra:1.65,scrub:1.30,rainforest:1.88
};
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function hash(a,b){const v=Math.sin(a*127.1+b*311.7+51.733)*43758.545312;return v-Math.floor(v)}
function lerp(a,b,t){return a+(b-a)*t}
function noise(x,y){
 const a=Math.floor(x),b=Math.floor(y),u=x-a,v=y-b;
 const fx=u*u*(3-2*u),fy=v*v*(3-2*v);
 return lerp(lerp(hash(a,b),hash(a+1,b),fx),lerp(hash(a,b+1),hash(a+1,b+1),fx),fy);
}
function fractal(x,y,scale){
 return noise(x/scale,y/scale)*.52+
        noise(x/(scale*.47)+42,y/(scale*.47)+11)*.30+
        noise(x/(scale*.21)+87,y/(scale*.21)-24)*.18;
}
function distanceSegment(x,y,ax,ay,bx,by){
 const vx=bx-ax,vy=by-ay;
 const t=clamp(((x-ax)*vx+(y-ay)*vy)/(vx*vx+vy*vy),0,1);
 return Math.hypot(x-(ax+vx*t),y-(ay+vy*t));
}
// Continental rifts and folded mountain belts, not elliptical 'mountain blobs'.
const ridgeLines=[
 {width:440,height:.70,points:[[3020,400],[3860,900],[4750,1560],[5300,2130],[6200,2750],[6820,3420]]},
 {width:330,height:.64,points:[[5600,7840],[5970,7140],[6810,6470],[7440,5710],[8010,4950]]},
 {width:240,height:.35,points:[[8710,7710],[9240,7130],[9770,6650],[10780,6410]]}
];
function ridgeHeight(x,y){
 let peak=0;
 for(const r of ridgeLines){
  let d=Infinity;
  for(let j=1;j<r.points.length;j++){
   const a=r.points[j-1],b=r.points[j];
   d=Math.min(d,distanceSegment(x,y,a[0],a[1],b[0],b[1]));
  }
  const jagged=.78+.47*fractal(x+340,y+250,325);
  peak=Math.max(peak,r.height*Math.exp(-Math.pow(d/r.width,2)*1.6)*jagged);
 }
 return peak;
}
function smoothGaussian(x,y,cx,cy,rx,ry){
 const a=(x-cx)/rx,b=(y-cy)/ry;
 return Math.exp(-(a*a+b*b)*1.75);
}
function geographicSample(x,y){
 const nx=(x-5950)/5620,ny=(y-4100)/3910;
 const theta=Math.atan2(ny,nx),radial=Math.hypot(nx,ny);
 const silhouette=1+
  .075*Math.sin(theta*3+.37)+.075*Math.sin(theta*5-1.02)+
  .041*Math.cos(theta*9+1.2)+
  (fractal(x+105,y-290,1350)-.5)*.23;
 let shape=silhouette-radial;
 // Deep estuaries and coastal inlets cut into the mainland, while offshore
 // capes make the west and east coast irregular at a continental scale.
 shape-=.23*smoothGaussian(x,y,930,3850,1050,1150);
 shape-=.25*smoothGaussian(x,y,11170,4530,1050,1360);
 shape-=.17*smoothGaussian(x,y,7120,7600,1680,900);
 shape+=.18*smoothGaussian(x,y,950,6160,950,1180);
 shape+=.16*smoothGaussian(x,y,10690,6010,940,1330);
 shape+=.13*smoothGaussian(x,y,2180,1030,1300,920);
 let protection=0;
 for(const f of factions){
  const d=Math.hypot(x-f.capital[0],y-f.capital[1]);
  if(d<610)protection=Math.max(protection,(1-d/610)*.19);
 }
 shape=Math.max(shape,protection);
 const isSea=shape<.010;
 const hills=fractal(x-230,y+310,1040);
 const ridge=ridgeHeight(x,y);
 const altitude=clamp(.09+Math.max(0,shape)*.35+hills*.27+
  ridge*.68+ (fractal(x+2300,y-3000,520)-.5)*.10,0,1.42);
 // The north is cold, the south is hot. Altitude and local variations
 // cause colder mountain passes and warmer river valleys at any latitude.
 const latitude=y/HEIGHT;
 const temperature=clamp(.14+latitude*.91-altitude*.25+
  (fractal(x+6100,y-1700,1740)-.5)*.17,0,1);
 return {isSea,shape,altitude,temperature};
}
function tileIndex(tx,ty){return ty*COLS+tx}
const tiles=new Array(COLS*ROWS),roads=new Uint8Array(COLS*ROWS);
const roadTier=new Uint8Array(COLS*ROWS);
for(let ty=0;ty<ROWS;ty++)for(let tx=0;tx<COLS;tx++){
 const x=(tx+.5)*TILE,y=(ty+.5)*TILE;
 const g=geographicSample(x,y);
 tiles[tileIndex(tx,ty)]={
  kind:g.isSea?'sea':'grass',e:g.altitude,temp:g.temperature,
  m:0,owner:-1,walk:!g.isSea,river:0,
  shade:(fractal(x+1700,y+300,215)-.5)*.11,
  relief:g.shape
 };
}
function atGrid(tx,ty){return tx>=0&&ty>=0&&tx<COLS&&ty<ROWS?tileIndex(tx,ty):-1}
function tileAt(x,y){return tiles[tileIndex(clamp(Math.floor(x/TILE),0,COLS-1),clamp(Math.floor(y/TILE),0,ROWS-1))]}
function walkable(tx,ty){const i=atGrid(tx,ty);return i>=0&&tiles[i].walk}
function nearestWalk(tx,ty){
 if(walkable(tx,ty))return{x:tx,y:ty};
 for(let r=1;r<45;r++){
  for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
   if(Math.abs(dx)!==r&&Math.abs(dy)!==r)continue;
   if(walkable(tx+dx,ty+dy))return{x:tx+dx,y:ty+dy}
  }
 }
 return null;
}
// Prevailing moist ocean winds blow eastwards. Mountains lift their moisture,
// then cast a dry rain shadow behind the crest.
const wetSea=new Uint16Array(tiles.length);
const q=new Int32Array(tiles.length);let head=0,tail=0;
wetSea.fill(65535);
for(let i=0;i<tiles.length;i++)if(!tiles[i].walk){wetSea[i]=0;q[tail++]=i}
while(head<tail){
 const id=q[head++],tx=id%COLS,ty=(id/COLS)|0;
 for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
  const next=atGrid(tx+dx,ty+dy);
  if(next<0||wetSea[next]!==65535)continue;
  wetSea[next]=wetSea[id]+1;q[tail++]=next;
 }
}
for(let ty=0;ty<ROWS;ty++){
 let upwindPeak=0,windMoisture=.93;
 for(let tx=0;tx<COLS;tx++){
  const id=tileIndex(tx,ty),t=tiles[id];
  if(!t.walk){windMoisture=.94;upwindPeak=0;continue}
  const coastline=Math.exp(-wetSea[id]/31);
  const wetNoise=fractal((tx+.5)*TILE+4040,(ty+.5)*TILE-1280,1410);
  const lee=clamp(upwindPeak-t.e-.08,0,.8);
  const uplift=clamp(t.e-upwindPeak+.06,0,.4);
  windMoisture=clamp(windMoisture*.992+uplift*.12-t.e*.009,.09,.98);
  const humidity=clamp(.09+.41*wetNoise+.24*coastline+
    windMoisture*.23-lee*.75-Math.max(0,t.temp-.53)*.34-
    Math.max(0,t.temp-.56)*clamp((wetSea[id]-12)/35,0,1)*.44+
    (fractal((tx+.5)*TILE,(ty+.5)*TILE+300,720)-.5)*.21,0,1);
  t.m=humidity;
  upwindPeak=Math.max(t.e,upwindPeak*.983);
  const temperature=t.temp,altitude=t.e;
  if(altitude>.77){t.kind=temperature<.22?'snow':'mountain';continue}
  if(altitude>.58){t.kind=temperature<.19?'snow':'hills';continue}
  if(temperature<.17){t.kind=humidity>.48?'taiga':'snow';continue}
  if(temperature<.32){t.kind=humidity>.52?'taiga':humidity>.31?'forest':'tundra';continue}
  if(temperature<.66){
   t.kind=humidity>.64?'forest':humidity<.34?'steppe':humidity>.61&&altitude<.28?'marsh':'grass';
   continue;
  }
  t.kind=humidity<.32?'desert':humidity<.46?'scrub':humidity>.73?'rainforest':
   humidity>.60?'forest':'steppe';
 }
}
// Depression-filled priority drainage: every stream ultimately reaches the
// coast, even if the terrain contains basins and complicated highlands.
class Heap{
 constructor(){this.a=[]}
 push(id,p){const a=this.a;let i=a.length;a.push([id,p]);
  while(i){const b=(i-1)>>1;if(a[b][1]<=p)break;a[i]=a[b];i=b}a[i]=[id,p]}
 pop(){const a=this.a,top=a[0],v=a.pop();if(a.length){
  let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1][1]<a[c][1])c++;
   if(a[c][1]>=v[1])break;a[i]=a[c];i=c}a[i]=v
 }return top}
 get length(){return this.a.length}
}
const directions=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
const downhill=new Int32Array(tiles.length),filled=new Float32Array(tiles.length);
const hydroVisited=new Uint8Array(tiles.length),hydroOrder=[];
downhill.fill(-1);filled.fill(Infinity);
const flood=new Heap();
for(let i=0;i<tiles.length;i++)if(!tiles[i].walk){
 flood.push(i,0);filled[i]=0;hydroVisited[i]=1;
}
while(flood.length){
 const item=flood.pop(),i=item[0],x=i%COLS,y=(i/COLS)|0;
 hydroOrder.push(i);
 for(const [dx,dy] of directions){
  const n=atGrid(x+dx,y+dy);
  if(n<0||hydroVisited[n])continue;
  hydroVisited[n]=1;
  filled[n]=Math.max(tiles[n].e,filled[i]+.000016);
  downhill[n]=i;flood.push(n,filled[n]);
 }
}
const flow=new Float32Array(tiles.length);
for(let i=0;i<tiles.length;i++)if(tiles[i].walk)
 flow[i]=.55+tiles[i].m*.85;
for(let k=hydroOrder.length-1;k>=0;k--){
 const i=hydroOrder[k],parent=downhill[i];
 if(parent>=0)flow[parent]+=flow[i];
}
const riverPaths=[];
const riverThreshold=105;
for(let i=0;i<tiles.length;i++)if(tiles[i].walk&&flow[i]>riverThreshold&&tiles[i].e<.91){
 const t=tiles[i];t.river=flow[i];
 if(t.kind!=='mountain'&&t.kind!=='snow')t.kind='river';
}
// Rivers have branching headwaters. Draw only major courses as smooth-ish
// descending polylines, not two straight decorative vertical stripes.
const streamUp=new Uint8Array(tiles.length);
for(let i=0;i<tiles.length;i++)if(tiles[i].river){
 const p=downhill[i];if(p>=0&&tiles[p].river)streamUp[p]++;
}
for(let i=0;i<tiles.length;i++){
 if(!tiles[i].river||streamUp[i]>0)continue;
 const points=[],seen=new Set();let p=i;
 while(p>=0&&!seen.has(p)&&points.length<450){
  seen.add(p);const tx=p%COLS,ty=(p/COLS)|0;
  points.push({x:(tx+.5)*TILE,y:(ty+.5)*TILE});
  const n=downhill[p];
  if(n<0)break;
  if(!tiles[n].river){
   if(!tiles[n].walk)points.push({x:((n%COLS)+.5)*TILE,y:(((n/COLS)|0)+.5)*TILE});
   break;
  }
  p=n;
 }
 if(points.length>=2)riverPaths.push({points,weight:Math.max(1,Math.min(3,Math.sqrt(flow[i]/riverThreshold)))});
}
// Geopolitical frontiers spread across traversable valleys and mountain
// passes instead of straight nearest-capital Voronoi spokes.
const nationCost=new Float32Array(tiles.length);nationCost.fill(Infinity);
const countryHeap=new Heap();
for(const fac of factions){
 const seed=atGrid(Math.floor(fac.capital[0]/TILE),Math.floor(fac.capital[1]/TILE));
 if(seed>=0&&tiles[seed].walk){nationCost[seed]=0;tiles[seed].owner=fac.id;countryHeap.push(seed,0)}
}
while(countryHeap.length){
 const [id,cost]=countryHeap.pop();
 if(cost>nationCost[id]+.00001)continue;
 const x=id%COLS,y=(id/COLS)|0,fac=tiles[id].owner;
 for(const [dx,dy] of directions){
  const nx=x+dx,ny=y+dy,next=atGrid(nx,ny);
  if(next<0||!tiles[next].walk)continue;
  const t=tiles[next],a=tiles[id];
  const barrier=(t.kind==='mountain'?3.15:t.kind==='hills'?1.57:t.kind==='river'?2.25:
   t.kind==='forest'||t.kind==='taiga'?1.36:1);
  const uphill=1+Math.max(0,t.e-a.e)*5.0;
  const step=(dx&&dy?1.414:1)*barrier*uphill*
   (.98+.09*hash(nx+2*fac,ny-fac));
  const nc=cost+step;
  if(nc<nationCost[next]){nationCost[next]=nc;t.owner=fac;countryHeap.push(next,nc)}
 }
}
function factionAt(x,y){return tileAt(x,y).owner}
const types=['capital','town','town','castle','village','village','village','village'];
const settlements=[];
function townScore(tx,ty,fac,type,placed){
 const id=tileIndex(tx,ty),t=tiles[id];
 if(!t.walk||t.owner!==fac||t.kind==='mountain'||t.kind==='snow'||t.kind==='river')return -Infinity;
 const x=(tx+.5)*TILE,y=(ty+.5)*TILE,capital=factions[fac].capital;
 const d0=Math.hypot(x-capital[0],y-capital[1]);
 if(d0<370||d0>1950)return -Infinity;
 let nearest=Infinity;
 for(const s of settlements){
  const d=Math.hypot(x-s.x,y-s.y);nearest=Math.min(nearest,d);
  if(d<340)return -Infinity;
 }
 let riverNearby=0;
 for(let ry=Math.max(0,ty-3);ry<=Math.min(ROWS-1,ty+3)&&!riverNearby;ry++){
  for(let rx=Math.max(0,tx-3);rx<=Math.min(COLS-1,tx+3);rx++){
   if(tiles[tileIndex(rx,ry)].kind==='river'){riverNearby=1;break}
  }
 }
 const neighboring= [[1,0],[-1,0],[0,1],[0,-1]]
  .reduce((n,[dx,dy])=>{const z=atGrid(tx+dx,ty+dy);return n+(z>=0&&tiles[z].owner!==fac?1:0)},0);
 const fertile=(t.kind==='grass'?2:t.kind==='forest'?1.1:t.kind==='steppe'?1.0:t.kind==='scrub'?.7:0);
 const noiseScore=hash(tx+fac*17,ty+placed*41)*1.2+
  (fractal(x+100,y-300,350)-.5)*.6;
 const desired=type==='town'?1050:type==='castle'?1170:790;
 let score=4-Math.abs(d0-desired)/480+fertile*.7+riverNearby*.5+
  Math.min(nearest,1150)/950+noiseScore;
 if(type==='castle')score+=neighboring*1.35+(t.kind==='hills'?2.3:0)+t.e*1.5;
 if(type==='village'){
  const nearTown=settlements.filter(s=>s.faction===fac&&s.type==='town')
   .reduce((d,s)=>Math.min(d,Math.hypot(x-s.x,y-s.y)),2000);
  score+=Math.max(0,1.8-nearTown/750)+fertile*.6;
 }
 return score;
}
for(const fac of factions){
 for(let k=0;k<8;k++){
  let x=fac.capital[0],y=fac.capital[1];
  if(k>0){
   let best=-Infinity,chosen=-1;
   // Geography chooses locations; no repeated radial offsets.
   for(let ty=4;ty<ROWS-4;ty+=2)for(let tx=4;tx<COLS-4;tx+=2){
    const score=townScore(tx,ty,fac.id,types[k],k);
    if(score>best){best=score;chosen=tileIndex(tx,ty)}
   }
   if(chosen<0){
    for(let i=0;i<tiles.length;i++)if(tiles[i].owner===fac.id&&tiles[i].walk&&
       tiles[i].kind!=='river'&&tiles[i].kind!=='mountain'){
      const xx=(i%COLS+.5)*TILE,yy=(((i/COLS)|0)+.5)*TILE;
      if(settlements.every(s=>Math.hypot(s.x-xx,s.y-yy)>190)){chosen=i;break}
    }
   }
   if(chosen>=0){x=(chosen%COLS+.5)*TILE;y=(((chosen/COLS)|0)+.5)*TILE}
  }
  settlements.push({id:settlements.length,faction:fac.id,name:fac.cities[k],type:types[k],
   x,y,prosperity:42+(fac.id*17+k*13)%55,
   garrison:k===0?250:k===3?130:k<=2?85:25});
 }
}
function terrainTravelCost(id,from,roadMode){
 const t=tiles[id],a=tiles[from];
 let cost=biomeCost[t.kind]||1.2;
 cost+=Math.abs(t.e-a.e)*(roadMode?6:3.5);
 if(roadMode){
  if(t.kind==='river')cost+=3.8;
  if(t.kind==='marsh')cost+=2;
  if(t.kind==='mountain')cost+=6;
  if(t.owner>=0&&a.owner>=0&&t.owner!==a.owner)cost+=.35;
  if(roads[id])cost*=.49;
 }else if(roads[id])cost*=.58;
 return Math.max(roadMode?.38:.4,cost);
}
function findTilePath(startX,startY,endX,endY,roadMode=false){
 const sx=clamp(Math.floor(startX/TILE),0,COLS-1),sy=clamp(Math.floor(startY/TILE),0,ROWS-1);
 const end=nearestWalk(clamp(Math.floor(endX/TILE),0,COLS-1),clamp(Math.floor(endY/TILE),0,ROWS-1));
 if(!end)return[];
 const start=atGrid(sx,sy),goal=atGrid(end.x,end.y);
 if(!tiles[start].walk)return[];
 if(start===goal)return [start];
 const g=new Float32Array(tiles.length);g.fill(Infinity);
 const came=new Int32Array(tiles.length);came.fill(-1);
 const closed=new Uint8Array(tiles.length),h=new Heap();
 const heuristic=(x,y)=>Math.hypot(x-end.x,y-end.y)*.38;
 g[start]=0;h.push(start,heuristic(sx,sy));
 while(h.length){
  const [id]=h.pop();if(closed[id])continue;closed[id]=1;
  if(id===goal)break;
  const tx=id%COLS,ty=(id/COLS)|0;
  for(const [dx,dy] of directions){
   const nx=tx+dx,ny=ty+dy,next=atGrid(nx,ny);
   if(next<0||!tiles[next].walk||closed[next])continue;
   if(dx&&dy&&(!walkable(tx+dx,ty)||!walkable(tx,ty+dy)))continue;
   const ng=g[id]+(dx&&dy?1.414:1)*terrainTravelCost(next,id,roadMode);
   if(ng<g[next]){g[next]=ng;came[next]=id;h.push(next,ng+heuristic(nx,ny))}
  }
 }
 if(came[goal]<0)return[];
 const steps=[],limit=tiles.length;
 for(let p=goal;p>=0&&steps.length<limit;p=came[p]){
  steps.push(p);if(p===start)break;
 }
 steps.reverse();return steps;
}
function findPath(sx,sy,ex,ey){
 return findTilePath(sx,sy,ex,ey,false).map(i=>({x:(i%COLS+.5)*TILE,y:(((i/COLS)|0)+.5)*TILE}));
}
function perpendicularDistance(p,a,b){
 const vx=b.x-a.x,vy=b.y-a.y;
 const t=clamp(((p.x-a.x)*vx+(p.y-a.y)*vy)/(vx*vx+vy*vy||1),0,1);
 return Math.hypot(p.x-a.x-vx*t,p.y-a.y-vy*t);
}
function simplify(points,tolerance=21){
 if(points.length<3)return points;
 const keep=new Uint8Array(points.length);keep[0]=1;keep[points.length-1]=1;
 const stack=[[0,points.length-1]];
 while(stack.length){
  const [start,end]=stack.pop();let best=-1,max=tolerance;
  for(let i=start+1;i<end;i++){const d=perpendicularDistance(points[i],points[start],points[end]);
   if(d>max){max=d;best=i}}
  if(best>0){keep[best]=1;stack.push([start,best],[best,end])}
 }
 return points.filter((v,i)=>keep[i]);
}
const roadSegments=[],roadLinks=[];
function makeRoad(a,b,kind){
 const route=findTilePath(a.x,a.y,b.x,b.y,true);
 if(!route.length)return false;
 for(const id of route){roads[id]=1;roadTier[id]=Math.max(roadTier[id],kind==='trunk'?2:1)}
 const points=[{x:a.x,y:a.y},...route.map(i=>({x:(i%COLS+.5)*TILE,y:(((i/COLS)|0)+.5)*TILE})),{x:b.x,y:b.y}];
 const smooth=simplify(points,25);
 const xs=smooth.map(p=>p.x),ys=smooth.map(p=>p.y);
 roadSegments.push({a,b,kind,points:smooth,bounds:{
  minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)}});
 roadLinks.push([a.id,b.id]);
 return true;
}
function spanningEdges(nodes){
 const selected=[nodes[0]],remaining=nodes.slice(1),links=[];
 while(remaining.length){
  let best=Infinity,at=-1,source=null;
  for(const a of selected)for(let i=0;i<remaining.length;i++){
   const b=remaining[i],d=Math.hypot(a.x-b.x,a.y-b.y);
   if(d<best){best=d;at=i;source=a}
  }
  const b=remaining.splice(at,1)[0];links.push([source,b]);selected.push(b);
 }
 return links;
}
const linkSet=new Set();
function connect(a,b,kind){
 const key=Math.min(a.id,b.id)+':'+Math.max(a.id,b.id);
 if(linkSet.has(key))return;
 if(makeRoad(a,b,kind))linkSet.add(key);
}
// Build useful local networks first, a few shared trade spines second;
// farms attach to their nearest market rather than the capital.
for(let f=0;f<10;f++){
 const core=settlements.slice(f*8,f*8+4);
 for(const [a,b] of spanningEdges(core))connect(a,b,'trunk');
}
const capitals=factions.map(f=>settlements[f.id*8]);
for(const [a,b] of spanningEdges(capitals))connect(a,b,'trunk');
for(let f=0;f<10;f++){
 const towns=settlements.slice(f*8,f*8+4);
 for(const v of settlements.slice(f*8+4,f*8+8)){
  const nearest=towns.slice().sort((a,b)=>
   Math.hypot(a.x-v.x,a.y-v.y)-Math.hypot(b.x-v.x,b.y-v.y))[0];
  connect(v,nearest,'local');
 }
}
// Two optional strategic routes create alternatives without connecting
// every kingdom to every other kingdom.
const candidate=[];
for(let i=0;i<capitals.length;i++)for(let j=i+1;j<capitals.length;j++){
 const a=capitals[i],b=capitals[j],d=Math.hypot(a.x-b.x,a.y-b.y);
 if(d<2700&&!linkSet.has(a.id+':'+b.id))candidate.push({a,b,d});
}
candidate.sort((a,b)=>a.d-b.d);
for(const v of candidate.slice(0,2))connect(v.a,v.b,'trunk');
// Smooth faction-border contours, drawn once as faint continuous paths
// instead of a sharp grid of block-shaped national edges.
const borderEdges=new Map();
function borderSegment(a,b,x1,y1,x2,y2){
 const pair=Math.min(a,b)+':'+Math.max(a,b);
 let list=borderEdges.get(pair);
 if(!list){list=[];borderEdges.set(pair,list)}
 list.push([{x:x1,y:y1},{x:x2,y:y2}]);
}
for(let ty=0;ty<ROWS;ty++)for(let tx=0;tx<COLS;tx++){
 const id=tileIndex(tx,ty),own=tiles[id].owner;if(own<0)continue;
 if(tx+1<COLS){const next=tiles[id+1].owner;
  if(next>=0&&next!==own)borderSegment(own,next,(tx+1)*TILE,ty*TILE,(tx+1)*TILE,(ty+1)*TILE)}
 if(ty+1<ROWS){const next=tiles[id+COLS].owner;
  if(next>=0&&next!==own)borderSegment(own,next,tx*TILE,(ty+1)*TILE,(tx+1)*TILE,(ty+1)*TILE)}
}
const borderPaths=[];
for(const [pair,segments] of borderEdges){
 const adjacency=new Map();
 const key=p=>Math.round(p.x/TILE)+':'+Math.round(p.y/TILE);
 for(let i=0;i<segments.length;i++)for(const p of segments[i]){
  const k=key(p);if(!adjacency.has(k))adjacency.set(k,[]);adjacency.get(k).push(i);
 }
 const used=new Uint8Array(segments.length);
 for(let i=0;i<segments.length;i++){
  if(used[i])continue;
  const ends=segments[i],start=ends.find(p=>(adjacency.get(key(p))||[]).length===1)||ends[0];
  let cursor=start,points=[cursor],lastEdge=-1;
  while(points.length<segments.length+2){
   const available=(adjacency.get(key(cursor))||[]).filter(e=>!used[e]);
   if(!available.length)break;
   const edge=available[0];used[edge]=1;lastEdge=edge;
   const [a,b]=segments[edge];cursor=key(a)===key(cursor)?b:a;points.push(cursor);
   if(key(cursor)===key(start))break;
  }
  if(points.length<2)continue;
  // Two Chaikin passes soften ninety-degree cell corners into geographic
  // looking borders without changing which two nations share the frontier.
  for(let pass=0;pass<2;pass++){
   const rounded=[points[0]];
   for(let j=0;j<points.length-1;j++){
    const a=points[j],b=points[j+1];
    rounded.push({x:.75*a.x+.25*b.x,y:.75*a.y+.25*b.y},
     {x:.25*a.x+.75*b.x,y:.25*a.y+.75*b.y});
   }
   rounded.push(points[points.length-1]);points=rounded;
  }
  const simplified=simplify(points,9);
  borderPaths.push({pair,points:simplified,bounds:{
   minX:Math.min(...simplified.map(p=>p.x)),maxX:Math.max(...simplified.map(p=>p.x)),
   minY:Math.min(...simplified.map(p=>p.y)),maxY:Math.max(...simplified.map(p=>p.y))
  }});
 }
}
// Coastline contours share the same smoothing method as the national
// borders. Beaches therefore follow rounded inlets instead of tile edges.
const coastSegments=[];
for(let ty=0;ty<ROWS;ty++)for(let tx=0;tx<COLS;tx++){
 const id=tileIndex(tx,ty),land=tiles[id].walk;
 if(tx+1<COLS&&land!==tiles[id+1].walk)
  coastSegments.push([{x:(tx+1)*TILE,y:ty*TILE},{x:(tx+1)*TILE,y:(ty+1)*TILE}]);
 if(ty+1<ROWS&&land!==tiles[id+COLS].walk)
  coastSegments.push([{x:tx*TILE,y:(ty+1)*TILE},{x:(tx+1)*TILE,y:(ty+1)*TILE}]);
}
const coastConnections=new Map();
const coastKey=p=>Math.round(p.x/TILE)+':'+Math.round(p.y/TILE);
for(let i=0;i<coastSegments.length;i++)for(const p of coastSegments[i]){
 const k=coastKey(p);
 if(!coastConnections.has(k))coastConnections.set(k,[]);
 coastConnections.get(k).push(i);
}
const coastUsed=new Uint8Array(coastSegments.length),coastPaths=[];
for(let i=0;i<coastSegments.length;i++){
 if(coastUsed[i])continue;
 const ends=coastSegments[i],start=ends.find(p=>coastConnections.get(coastKey(p)).length===1)||ends[0];
 let cursor=start,pts=[cursor];
 while(pts.length<coastSegments.length+2){
  const available=(coastConnections.get(coastKey(cursor))||[]).find(j=>!coastUsed[j]);
  if(available===undefined)break;
  coastUsed[available]=1;
  const edge=coastSegments[available],next=coastKey(edge[0])===coastKey(cursor)?edge[1]:edge[0];
  cursor=next;pts.push(cursor);
  if(coastKey(cursor)===coastKey(start))break;
 }
 if(pts.length<3)continue;
 for(let k=0;k<2;k++){
  const smooth=[pts[0]];
  for(let j=0;j<pts.length-1;j++){
   const a=pts[j],b=pts[j+1];
   smooth.push({x:.75*a.x+.25*b.x,y:.75*a.y+.25*b.y},
    {x:.25*a.x+.75*b.x,y:.25*a.y+.75*b.y});
  }
  smooth.push(pts[pts.length-1]);pts=smooth;
 }
 pts=simplify(pts,9);
 coastPaths.push({points:pts,bounds:{
  minX:Math.min(...pts.map(p=>p.x)),maxX:Math.max(...pts.map(p=>p.x)),
  minY:Math.min(...pts.map(p=>p.y)),maxY:Math.max(...pts.map(p=>p.y))
 }});
}
function walkingSpeed(x,y){
 const i=tileIndex(clamp(Math.floor(x/TILE),0,COLS-1),clamp(Math.floor(y/TILE),0,ROWS-1)),t=tiles[i];
 if(!t.walk)return 0;
 return (roads[i]?1.44:1)/Math.sqrt(biomeCost[t.kind]||1.25);
}
function getSettlement(id){return settlements[id]||null}
function closestSettlement(x,y,factionId){
 let best=null,d=Infinity;
 for(const s of settlements){
  if(factionId!==undefined&&s.faction!==factionId)continue;
  const near=Math.hypot(s.x-x,s.y-y);if(near<d){d=near;best=s}
 }
 return best;
}
window.UAWorld={WIDTH,HEIGHT,TILE,COLS,ROWS,factions,wars,settlements,
 roadSegments,roadLinks,roadTier,roads,riverPaths,borderPaths,coastPaths,flow,downhill,
 tiles,palette,biomeCost,tileAt,tileIndex,factionAt,findPath,walkingSpeed,
 closestSettlement,getSettlement,nearestWalk,clamp,hash,noise,fractal};
})();
