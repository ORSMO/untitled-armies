
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
const palette={sea:'#244755',river:'#528391',mountain:'#738079',hills:'#788b70',forest:'#416f56',grass:'#78916b',steppe:'#b2a17b',desert:'#bda276',snow:'#a2b5ac',marsh:'#668272'};
function clamp(x,min,max){return Math.min(max,Math.max(min,x))}
function hash(x,y){const n=Math.sin(x*127.13+y*311.71+81.1)*43758.5453;return n-Math.floor(n)}
function noise(x,y){const a=Math.floor(x),b=Math.floor(y),u=x-a,v=y-b;const sx=u*u*(3-2*u),sy=v*v*(3-2*v);const p=hash(a,b)*(1-sx)+hash(a+1,b)*sx,q=hash(a,b+1)*(1-sx)+hash(a+1,b+1)*sx;return p*(1-sy)+q*sy}
function fbm(x,y){return noise(x/870,y/870)*.53+noise(x/340,y/340)*.31+noise(x/110,y/110)*.16}
function factionAt(x,y){let winner=0,best=Infinity;const wobble=(noise(x/420,y/420)-.5)*430;for(const f of factions){const dx=(x-f.capital[0])/1.09,dy=y-f.capital[1];const d=Math.hypot(dx,dy)+wobble*hash(f.id+2,Math.floor(x/500)+Math.floor(y/600));if(d<best){best=d;winner=f.id}}return winner}
function tileIndex(tx,ty){return ty*COLS+tx}
const tiles=new Array(COLS*ROWS),roads=new Uint8Array(COLS*ROWS);
function makeTile(x,y){
 const n=fbm(x,y),m=fbm(x+477,y+844),mountains=
  Math.max(0,1-Math.hypot((x-5950)/1850,(y-2450)/1450))*.61+
  Math.max(0,1-Math.hypot((x-7120)/1800,(y-6350)/1600))*.37;
 const e=n*.75+mountains;
 const coastWest=205+noise(y/260,7)*205;
 const coastEast=11770-noise(y/210,13)*290;
 const coastNorth=135+noise(x/330,15)*180;
 const coastSouth=8000-noise(x/270,24)*150;
 const lake1=Math.pow((x-5160)/345,2)+Math.pow((y-3760)/295,2)<1;
 const lake2=Math.pow((x-9530)/320,2)+Math.pow((y-4240)/310,2)<1;
 const sea=x<coastWest||x>coastEast||y<coastNorth||y>coastSouth||lake1||lake2;
 const river1=Math.abs(x-(4510+Math.sin(y/630)*164+Math.sin(y/220)*49))<34&&y>550&&y<7750;
 const river2=Math.abs(x-(8790+Math.sin(y/750+2)*127))<29&&y>550&&y<7800;
 const desert=x>7600&&y>4400&&m<.71;
 const snow=y<2000&&e>.47;
 let kind=sea?'sea':river1||river2?'river':e>.83?'mountain':e>.69?'hills':desert?'desert':snow?'snow':m>.59?'forest':m<.34?'steppe':m>.54&&e<.37?'marsh':'grass';
 const t={kind,e,m,owner:sea?-1:factionAt(x,y),shade:(hash(Math.floor(x/56),Math.floor(y/56))-.5)*.13,walk:kind!=='sea'};
 return t;
}
for(let ty=0;ty<ROWS;ty++)for(let tx=0;tx<COLS;tx++)tiles[tileIndex(tx,ty)]=makeTile(tx*TILE+TILE/2,ty*TILE+TILE/2);
function tileAt(x,y){return tiles[tileIndex(clamp(Math.floor(x/TILE),0,COLS-1),clamp(Math.floor(y/TILE),0,ROWS-1))]}
function suitable(x,y,fid){const t=tileAt(x,y);return t.walk&&t.kind!=='mountain'&&t.owner===fid}
const types=['capital','town','town','castle','village','village','village','village'];
const offsets=[[0,0],[690,-460],[-640,510],[320,830],[-860,-290],[850,490],[-320,-800],[380,-760]];
const settlements=[];
for(const fac of factions){
 for(let k=0;k<8;k++){
  let ox=offsets[k][0],oy=offsets[k][1];
  if(k>0){const rot=(fac.id%4-.8)*.31,cos=Math.cos(rot),sin=Math.sin(rot);const tx=ox*cos-oy*sin;oy=ox*sin+oy*cos;ox=tx}
  let x=clamp(fac.capital[0]+ox,380,WIDTH-380),y=clamp(fac.capital[1]+oy,360,HEIGHT-360);
  if(!suitable(x,y,fac.id)){
   let found=false;
   for(let r=80;r<=1400&&!found;r+=76){
    for(let a=0;a<16&&!found;a++){
     const angle=a*Math.PI/8+fac.id*.21;
     const cx=clamp(x+Math.cos(angle)*r,350,WIDTH-350),cy=clamp(y+Math.sin(angle)*r,320,HEIGHT-320);
     if(suitable(cx,cy,fac.id)){x=cx;y=cy;found=true}
    }
   }
  }
  settlements.push({id:settlements.length,faction:fac.id,name:fac.cities[k],type:types[k],x,y,prosperity:42+(fac.id*17+k*13)%55,garrison:k===0?250:k===3?130:k<=2?85:25});
 }
}
function makeRoad(a,b){
 const dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy),steps=Math.ceil(dist/(TILE*.28));
 for(let i=0;i<=steps;i++){
  const t=i/steps,px=a.x+dx*t,py=a.y+dy*t,tx=Math.floor(px/TILE),ty=Math.floor(py/TILE);
  for(let yy=-1;yy<=1;yy++)for(let xx=-1;xx<=1;xx++){
   const nx=tx+xx,ny=ty+yy;
   if(nx<0||ny<0||nx>=COLS||ny>=ROWS)continue;
   const idx=tileIndex(nx,ny);
   if(tiles[idx].kind!=='sea')roads[idx]=1;
  }
 }
 return {a,b};
}
const roadSegments=[];
for(let f=0;f<10;f++){
 const start=settlements[f*8];
 for(let i=1;i<8;i++)roadSegments.push(makeRoad(start,settlements[f*8+i]));
}
for(let f=0;f<10;f++){
 const a=settlements[f*8],near=factions.filter(b=>b.id!==f).sort((v,w)=>Math.hypot(v.capital[0]-a.x,v.capital[1]-a.y)-Math.hypot(w.capital[0]-a.x,w.capital[1]-a.y)).slice(0,2);
 for(const b of near)if(b.id>f)roadSegments.push(makeRoad(a,settlements[b.id*8]));
}
function walkable(tx,ty){return tx>=0&&ty>=0&&tx<COLS&&ty<ROWS&&tiles[tileIndex(tx,ty)].walk}
function nearestWalk(tx,ty){
 if(walkable(tx,ty))return {x:tx,y:ty};
 for(let r=1;r<16;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
  if(Math.abs(dx)!==r&&Math.abs(dy)!==r)continue;
  if(walkable(tx+dx,ty+dy))return{x:tx+dx,y:ty+dy}
 }
 return null;
}
class Heap{
 constructor(){this.a=[]}
 push(id,p){const a=this.a;let k=a.length;a.push([id,p]);while(k>0){const pa=(k-1)>>1;if(a[pa][1]<=p)break;a[k]=a[pa];k=pa}a[k]=[id,p]}
 pop(){const a=this.a,top=a[0],last=a.pop();if(a.length){let k=0;while(k*2+1<a.length){let child=k*2+1;if(child+1<a.length&&a[child+1][1]<a[child][1])child++;if(last[1]<=a[child][1])break;a[k]=a[child];k=child}a[k]=last}return top}
 get length(){return this.a.length}
}
const directions=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
const biomeCost={grass:1,forest:1.64,steppe:1.14,desert:1.51,hills:1.47,mountain:3.1,snow:1.62,marsh:2,river:2.4};
function findPath(startX,startY,endX,endY){
 const sx=clamp(Math.floor(startX/TILE),0,COLS-1),sy=clamp(Math.floor(startY/TILE),0,ROWS-1);
 const dst=nearestWalk(clamp(Math.floor(endX/TILE),0,COLS-1),clamp(Math.floor(endY/TILE),0,ROWS-1));
 if(!dst)return [];
 const start=tileIndex(sx,sy),goal=tileIndex(dst.x,dst.y),length=tiles.length;
 if(start===goal)return [{x:dst.x*TILE+TILE/2,y:dst.y*TILE+TILE/2}];
 const g=new Float32Array(length);g.fill(Infinity);
 const came=new Int32Array(length);came.fill(-1);
 const seen=new Uint8Array(length),heap=new Heap();
 const heuristic=(tx,ty)=>Math.hypot(tx-dst.x,ty-dst.y)*.46;
 g[start]=0;heap.push(start,heuristic(sx,sy));let visited=0,found=false;
 while(heap.length&&visited<length*2){
  const pair=heap.pop(),id=pair[0];if(seen[id])continue;seen[id]=1;visited++;
  if(id===goal){found=true;break}
  const tx=id%COLS,ty=Math.floor(id/COLS);
  for(const [dx,dy] of directions){
   const nx=tx+dx,ny=ty+dy;if(!walkable(nx,ny))continue;
   if(dx&&dy&&(!walkable(tx+dx,ty)||!walkable(tx,ty+dy)))continue;
   const next=tileIndex(nx,ny);if(seen[next])continue;
   const cost=(dx&&dy?1.414:1)*(roads[next]?.56:(biomeCost[tiles[next].kind]||1));
   const ng=g[id]+cost;
   if(ng<g[next]){came[next]=id;g[next]=ng;heap.push(next,ng+heuristic(nx,ny))}
  }
 }
 if(!found)return[];
 const list=[];let p=goal;
 while(p>=0&&list.length<length){
  const tx=p%COLS,ty=Math.floor(p/COLS);list.push({x:tx*TILE+TILE/2,y:ty*TILE+TILE/2});
  if(p===start)break;p=came[p];
 }
 list.reverse();return list;
}
function walkingSpeed(x,y){
 const idx=tileIndex(clamp(Math.floor(x/TILE),0,COLS-1),clamp(Math.floor(y/TILE),0,ROWS-1));
 if(!tiles[idx].walk)return 0;
 const b=tiles[idx].kind;
 return (roads[idx]?1.5:1)/Math.sqrt(biomeCost[b]||1);
}
function getSettlement(id){return settlements[id]||null}
function closestSettlement(x,y,factionId){let best=null,dist=Infinity;for(const s of settlements){if(factionId!==undefined&&s.faction!==factionId)continue;const d=Math.hypot(s.x-x,s.y-y);if(d<dist){dist=d;best=s}}return best}
window.UAWorld={WIDTH,HEIGHT,TILE,COLS,ROWS,factions,wars,settlements,roadSegments,roads,tiles,palette,
 tileAt,tileIndex,factionAt,findPath,walkingSpeed,closestSettlement,getSettlement,nearestWalk,clamp,hash,noise};
})();
