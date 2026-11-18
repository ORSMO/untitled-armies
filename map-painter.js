
(function(){
'use strict';
// V4.1: one shared atlas renderer for the campaign and the small map.
// Smooth environmental layers are cached once. Political boundaries,
// roads, coastline, rivers and landscape details are independent overlays.
let landTexture=null,politicalTexture=null,miniTexture=null,cacheWorld=null;
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function rgb(hex){
 const c=parseInt(hex.replace('#',''),16);
 return [(c>>16)&255,(c>>8)&255,c&255];
}
function makeLayer(w,h){
 const element=document.createElement('canvas');element.width=w;element.height=h;
 return element;
}
function build(w){
 if(cacheWorld===w&&landTexture)return;
 cacheWorld=w;const SCALE=5,TW=w.COLS*SCALE,TH=w.ROWS*SCALE;
 landTexture=makeLayer(TW,TH);politicalTexture=makeLayer(w.COLS,w.ROWS);
 const lctx=landTexture.getContext('2d'),pctx=politicalTexture.getContext('2d');
 const colors=Object.fromEntries(Object.entries(w.palette).map(([name,c])=>[name,rgb(c)]));
 const tileColors=w.tiles.map(t=>colors[t.kind]||colors.grass);
 const data=lctx.createImageData(TW,TH),pixels=data.data;
 // Bilinear transitions remove the 'painted square tile' look. Each texel
 // also receives directional relief shading and deterministic grain.
 for(let y=0;y<TH;y++){
  const v=(y+.5)/SCALE-.5,iy=Math.floor(v),fy=clamp(v-iy,0,1);
  const y0=clamp(iy,0,w.ROWS-1),y1=clamp(iy+1,0,w.ROWS-1);
  for(let x=0;x<TW;x++){
   const u=(x+.5)/SCALE-.5,ix=Math.floor(u),fx=clamp(u-ix,0,1);
   const x0=clamp(ix,0,w.COLS-1),x1=clamp(ix+1,0,w.COLS-1);
   const i00=w.tileIndex(x0,y0),i10=w.tileIndex(x1,y0),
    i01=w.tileIndex(x0,y1),i11=w.tileIndex(x1,y1);
   const a=tileColors[i00],b=tileColors[i10],c=tileColors[i01],d=tileColors[i11];
   const t=w.tiles[i00],east=w.tiles[i10],south=w.tiles[i01];
   const relief=clamp((t.e-east.e)*18+(t.e-south.e)*12,-13,13);
   const rough=(Math.imul(x+31,374761393)^Math.imul(y+17,668265263));
   const grain=(((rough^(rough>>>13))&255)/255-.5)*5.8;
   const idx=(y*TW+x)*4;
   for(let ch=0;ch<3;ch++){
    const top=a[ch]+(b[ch]-a[ch])*fx,bot=c[ch]+(d[ch]-c[ch])*fx;
    const v=top+(bot-top)*fy+relief+grain;
    pixels[idx+ch]=clamp(v,0,255);
   }
   pixels[idx+3]=255;
  }
 }
 lctx.putImageData(data,0,0);
 const nations=pctx.createImageData(w.COLS,w.ROWS);
 for(let i=0;i<w.tiles.length;i++){
  const owner=w.tiles[i].owner;
  if(owner<0){nations.data[i*4+3]=0;continue}
  const color=rgb(w.factions[owner].color);
  nations.data[i*4]=color[0];nations.data[i*4+1]=color[1];
  nations.data[i*4+2]=color[2];nations.data[i*4+3]=255;
 }
 pctx.putImageData(nations,0,0);
 miniTexture=makeLayer(360,246);
 const mini=miniTexture.getContext('2d');
 mini.drawImage(landTexture,0,0,miniTexture.width,miniTexture.height);
 mini.globalAlpha=.14;
 mini.drawImage(politicalTexture,0,0,miniTexture.width,miniTexture.height);
 mini.globalAlpha=1;
}
function visible(bounds,l,r,t,b,pad){
 return !bounds||!(bounds.maxX<l-pad||bounds.minX>r+pad||
  bounds.maxY<t-pad||bounds.minY>b+pad);
}
function curved(ctx,points){
 if(!points||points.length<2)return;
 ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
 for(let i=1;i<points.length-1;i++){
  const mid={x:(points[i].x+points[i+1].x)*.5,y:(points[i].y+points[i+1].y)*.5};
  ctx.quadraticCurveTo(points[i].x,points[i].y,mid.x,mid.y);
 }
 const last=points[points.length-1];ctx.lineTo(last.x,last.y);
}
function drawRivers(ctx,w,l,r,t,b,zoom){
 ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
 for(const river of w.riverPaths){
  if(!river.bounds){
   const pts=river.points;river.bounds={
    minX:Math.min(...pts.map(p=>p.x)),maxX:Math.max(...pts.map(p=>p.x)),
    minY:Math.min(...pts.map(p=>p.y)),maxY:Math.max(...pts.map(p=>p.y))};
  }
  if(!visible(river.bounds,l,r,t,b,130))continue;
  curved(ctx,river.points);ctx.strokeStyle='#1b4d5a99';
  ctx.lineWidth=16+river.weight*2;ctx.stroke();
  curved(ctx,river.points);ctx.strokeStyle='#86aeb19e';
  ctx.lineWidth=6+river.weight*2.1;ctx.stroke();
 }
 ctx.restore();
}
function drawRoads(ctx,w,l,r,t,b,zoom){
 ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
 for(const road of w.roadSegments){
  if(!visible(road.bounds,l,r,t,b,130))continue;
  const main=road.kind==='trunk';
  curved(ctx,road.points);
  ctx.strokeStyle='#403825b1';ctx.lineWidth=main?14:9;ctx.stroke();
  curved(ctx,road.points);
  ctx.strokeStyle=main?'#d4bd8be3':'#bcaa85a5';
  ctx.lineWidth=main?6.5:3.7;ctx.stroke();
  if(main&&zoom>.5){
   curved(ctx,road.points);
   ctx.strokeStyle='#f1dcac5a';ctx.lineWidth=1.6;ctx.stroke();
  }
 }
 ctx.restore();
}
function drawBridges(ctx,w,l,r,t,b,zoom){
 if(!w.bridgePoints||zoom<.27)return;
 ctx.save();ctx.lineCap='round';
 for(const bridge of w.bridgePoints){
  if(bridge.x<l-80||bridge.x>r+80||bridge.y<t-80||bridge.y>b+80)continue;
  ctx.save();ctx.translate(bridge.x,bridge.y);ctx.rotate(bridge.angle);
  ctx.fillStyle='#554938e0';ctx.fillRect(-26,-10,52,20);
  ctx.fillStyle='#e5d3a9e7';ctx.fillRect(-26,-6,52,12);
  ctx.strokeStyle='#463d2bc6';ctx.lineWidth=2;
  for(let k=-22;k<=22;k+=11){ctx.beginPath();ctx.moveTo(k,-6);ctx.lineTo(k,6);ctx.stroke()}
  ctx.restore();
 }
 ctx.restore();
}
function drawBorders(ctx,w,l,r,t,b,zoom){
 ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
 const lw=clamp(1.65/zoom,2.6,13);
 ctx.setLineDash([12,10]);ctx.strokeStyle='#efddae94';ctx.lineWidth=lw;
 for(const border of w.borderPaths){
  if(!visible(border.bounds,l,r,t,b,65))continue;
  const pts=border.points;
  if(pts.length<2)continue;
  curved(ctx,pts);ctx.stroke();
 }
 ctx.restore();
}
function drawCoasts(ctx,w,l,r,t,b,zoom){
 if(!w.coastPaths)return;
 ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
 for(const outline of w.coastPaths){
  if(!visible(outline.bounds,l,r,t,b,85))continue;
  curved(ctx,outline.points);ctx.strokeStyle='#142f3699';ctx.lineWidth=20;ctx.stroke();
  curved(ctx,outline.points);ctx.strokeStyle='#dfd3a57c';ctx.lineWidth=6;ctx.stroke();
 }
 ctx.restore();
}
const landmarks=[
 {name:'FROSTSPINE RANGE',x:5070,y:2050,angle:.38},
 {name:'CLOUDBREAK HIGHLANDS',x:6610,y:6810,angle:-.62},
 {name:'THE LOWLANDS',x:4860,y:3950,angle:0},
 {name:'SOUTHERN STEPPE',x:9500,y:7100,angle:-.07}
];
function drawLandmarks(ctx,w,l,r,t,b,zoom){
 if(zoom>.32)return;
 ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
 for(const label of landmarks){
  if(label.x<l-900||label.x>r+900||label.y<t-420||label.y>b+420)continue;
  ctx.save();ctx.translate(label.x,label.y);ctx.rotate(label.angle);
  ctx.font='italic 76px Georgia,serif';ctx.fillStyle='#f2dfb956';
  ctx.strokeStyle='#14201866';ctx.lineWidth=5;
  ctx.strokeText(label.name,0,0);ctx.fillText(label.name,0,0);ctx.restore();
 }
 ctx.restore();
}
function vegetation(ctx,w,tx,ty,x,y,kind,zoom){
 const density=kind==='rainforest'?3:kind==='forest'?2:1;
 for(let n=0;n<density;n++){
  const a=w.hash(tx*13+n*7,ty*31+n*3),c=w.hash(tx*7+n*5,ty*11+n*41);
  const px=x+11+a*34,py=y+10+c*32;
  const evergreen=kind==='taiga',height=evergreen?23:kind==='rainforest'?18:15;
  if(evergreen){
   ctx.fillStyle='#21483dcb';ctx.beginPath();ctx.moveTo(px,py-height);
   ctx.lineTo(px-9,py+5);ctx.lineTo(px+9,py+5);ctx.closePath();ctx.fill();
   ctx.fillStyle='#9cac84a8';ctx.beginPath();ctx.moveTo(px,py-height);
   ctx.lineTo(px-2,py-5);ctx.lineTo(px+4,py-5);ctx.closePath();ctx.fill();
  }else{
   ctx.strokeStyle='#463c2c81';ctx.lineWidth=2.3;ctx.beginPath();ctx.moveTo(px,py+6);ctx.lineTo(px,py-3);ctx.stroke();
   ctx.fillStyle=kind==='rainforest'?'#1f634cdd':'#2c6547e1';
   ctx.beginPath();ctx.ellipse(px,py-8,12,10,0,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#70987976';ctx.beginPath();ctx.ellipse(px-4,py-11,6,3.5,0,0,Math.PI*2);ctx.fill();
  }
 }
}
function drawDetails(ctx,w,l,r,t,b,zoom){
 if(zoom<.24)return;
 const c0=clamp(Math.floor(l/w.TILE)-1,0,w.COLS-1),
 c1=clamp(Math.ceil(r/w.TILE)+1,0,w.COLS-1),
 r0=clamp(Math.floor(t/w.TILE)-1,0,w.ROWS-1),
 r1=clamp(Math.ceil(b/w.TILE)+1,0,w.ROWS-1);
 ctx.save();
 for(let ty=r0;ty<=r1;ty++)for(let tx=c0;tx<=c1;tx++){
  const tile=w.tiles[w.tileIndex(tx,ty)],x=tx*w.TILE,y=ty*w.TILE;
  const kind=tile.kind,rand=w.hash(tx,ty);
  if((kind==='forest'||kind==='taiga'||kind==='rainforest')&&rand>.13)
   vegetation(ctx,w,tx,ty,x,y,kind,zoom);
  else if(kind==='mountain'||kind==='hills'){
   if(rand<.33)continue;
   const h=kind==='mountain'?40:24,peak=x+10+rand*32,base=y+48;
   ctx.fillStyle=kind==='mountain'?'#596b64aa':'#6f80689b';
   ctx.beginPath();ctx.moveTo(peak,base-h);
   ctx.lineTo(x+2,base);ctx.lineTo(x+53,base);ctx.closePath();ctx.fill();
   ctx.fillStyle=kind==='mountain'?'#c3c5b0ac':'#b7ba91a1';
   ctx.beginPath();ctx.moveTo(peak,base-h);
   ctx.lineTo(peak+5,base-h*.55);ctx.lineTo(x+53,base);ctx.closePath();ctx.fill();
   if(kind==='mountain'&&tile.temp<.31){
    ctx.fillStyle='#e6e5d0bd';ctx.beginPath();ctx.moveTo(peak,base-h);
    ctx.lineTo(peak-6,base-h*.68);ctx.lineTo(peak,base-h*.74);
    ctx.lineTo(peak+8,base-h*.64);ctx.closePath();ctx.fill();
   }
  }else if((kind==='steppe'||kind==='scrub'||kind==='grass')&&rand>.68&&zoom>.42){
   ctx.strokeStyle=kind==='grass'?'#e0d6a349':'#e0ce9b6b';
   ctx.lineWidth=1.7;ctx.beginPath();ctx.moveTo(x+16,y+35);
   ctx.quadraticCurveTo(x+25,y+29,x+32,y+34);ctx.stroke();
  }else if(kind==='desert'&&rand>.45){
   ctx.strokeStyle='#e8d2a180';ctx.lineWidth=1.7;ctx.beginPath();ctx.arc(x+28,y+25,17,3.2,5.9);ctx.stroke();
  }else if((kind==='sea'||kind==='river')&&rand>.67&&zoom>.46){
   ctx.strokeStyle='#c2dbd752';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(x+12,y+29);
   ctx.quadraticCurveTo(x+22,y+22,x+32,y+29);ctx.stroke();
  }
 }
 ctx.restore();
}
function draw(ctx,w,camera,view,options){
 build(w);
 const zoom=camera.zoom,hw=view.w/(2*zoom),hh=view.h/(2*zoom);
 const l=clamp(camera.x-hw-80,0,w.WIDTH),r=clamp(camera.x+hw+80,0,w.WIDTH);
 const t=clamp(camera.y-hh-80,0,w.HEIGHT),b=clamp(camera.y+hh+80,0,w.HEIGHT);
 if(l>=r||t>=b)return;
 ctx.save();ctx.imageSmoothingEnabled=true;
 const sx=l/w.WIDTH*landTexture.width,sy=t/w.HEIGHT*landTexture.height;
 const sw=(r-l)/w.WIDTH*landTexture.width,sh=(b-t)/w.HEIGHT*landTexture.height;
 ctx.drawImage(landTexture,sx,sy,sw,sh,l,t,r-l,b-t);
 if(options.borders){
  ctx.globalAlpha=.145;
  ctx.drawImage(politicalTexture,l/w.WIDTH*politicalTexture.width,
   t/w.HEIGHT*politicalTexture.height,
   (r-l)/w.WIDTH*politicalTexture.width,(b-t)/w.HEIGHT*politicalTexture.height,
   l,t,r-l,b-t);
  ctx.globalAlpha=1;
 }
 drawCoasts(ctx,w,l,r,t,b,zoom);
 drawRivers(ctx,w,l,r,t,b,zoom);
 drawLandmarks(ctx,w,l,r,t,b,zoom);
 drawDetails(ctx,w,l,r,t,b,zoom);
 if(options.roads){drawRoads(ctx,w,l,r,t,b,zoom);drawBridges(ctx,w,l,r,t,b,zoom)}
 if(options.borders)drawBorders(ctx,w,l,r,t,b,zoom);
 ctx.restore();
}
function mini(w){build(w);return miniTexture}
window.UAMapPainter={draw,mini,build};
})();
