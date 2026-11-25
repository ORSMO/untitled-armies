(function(){
'use strict';

const VERSION=1;
const MATERIALS=['iron','timber','tools'];
const ITEM_IDS=['sword','spear','axe'];
const MAX_DAILY_PRODUCTION=2;
const MAX_DAILY_BUYERS=2;
const MAX_COMPANY_STOCK=60;
const MAX_TREASURY=1000000;
const MAX_MATERIAL_STOCK=500;
const MAX_MARKET_OWNED=250;
const OWNER_SHARE=.60;
const DEFAULT_PRICES={iron:20,timber:13,tools:25,sword:180,spear:145,axe:220};
const recipes={
 sword:{id:'sword',itemId:'sword',name:'Arming swords',materials:{iron:2,tools:1},labor:12},
 spear:{id:'spear',itemId:'spear',name:'Spears',materials:{iron:1,timber:2},labor:10},
 axe:{id:'axe',itemId:'axe',name:'Battle axes',materials:{iron:2,timber:1,tools:1},labor:14}
};
const BLOCKED=new Set([
 'idle','already_processed','no_order','invalid_site','invalid_recipe','invalid_output',
 'no_funds','market_shortage','market_full','no_demand','company_storage_full','no_company_stock','no_earnings','invalid_quantity'
]);

function amount(value,max=MAX_TREASURY){
 const n=Number(value);
 return Number.isFinite(n)?Math.max(0,Math.min(max,Math.floor(n))):0;
}
function money(value,max=MAX_TREASURY){
 const n=Number(value);
 return Number.isFinite(n)?Math.max(0,Math.min(max,Math.round(n*100)/100)):0;
}
function validSite(site){return !!site&&Number.isInteger(site.id)&&['capital','town'].includes(site.type)}
function blankWorkshop(siteId,day){
 return {version:VERSION,siteId,treasury:0,materials:{iron:0,timber:0,tools:0},recipeId:null,output:'market',
  lastDay:Number.isInteger(day)?day:1,ownedStock:{sword:0,spear:0,axe:0},ownedCost:{sword:0,spear:0,axe:0},
  companyStock:{sword:0,spear:0,axe:0},earnings:0,producedTotal:0,soldTotal:0,blockedReason:'idle'};
}
function normalize(saved,settlements=[],day=1){
 const source=saved&&typeof saved==='object'?saved:{};
 const normalized={};
 for(const site of settlements){
  if(!validSite(site))continue;
  const key=String(site.id),raw=source[key];
  if(!raw||typeof raw!=='object'||Array.isArray(raw))continue;
  const workshop=blankWorkshop(site.id,day);
  workshop.treasury=money(raw.treasury??raw.gold);
  for(const id of MATERIALS)workshop.materials[id]=amount(raw.materials?.[id],MAX_MATERIAL_STOCK);
  workshop.recipeId=Object.hasOwn(recipes,raw.recipeId)?raw.recipeId:null;
  workshop.output=raw.output==='company'?'company':'market';
  workshop.lastDay=Number.isInteger(raw.lastDay)?Math.max(1,raw.lastDay):Number.isInteger(day)?day:1;
  for(const id of ITEM_IDS){
   workshop.ownedStock[id]=amount(raw.ownedStock?.[id],MAX_MARKET_OWNED);
   workshop.ownedCost[id]=money(raw.ownedCost?.[id]);
   workshop.companyStock[id]=amount(raw.companyStock?.[id],MAX_COMPANY_STOCK);
  }
  workshop.earnings=money(raw.earnings);
  workshop.producedTotal=amount(raw.producedTotal,1000000000);
  workshop.soldTotal=amount(raw.soldTotal,1000000000);
  workshop.blockedReason=BLOCKED.has(raw.blockedReason)?raw.blockedReason:'idle';
  normalized[key]=workshop;
 }
 return normalized;
}
function get(workshops,siteId){return workshops?.[String(siteId)]||null}
function pricesOf(input={}){
 const out={};
 for(const id of [...MATERIALS,...ITEM_IDS])out[id]=Math.max(1,money(input?.[id],100000)||DEFAULT_PRICES[id]);
 return out;
}
function quote(recipeId,prices={},output='market'){
 const recipe=recipes[recipeId];
 if(!recipe)return {valid:false,blockedReason:'invalid_recipe'};
 if(!['market','company'].includes(output))return {valid:false,blockedReason:'invalid_output'};
 const p=pricesOf(prices),marketMaterialCost=Object.entries(recipe.materials).reduce((sum,[id,n])=>sum+n*p[id],0);
 const unitCost=marketMaterialCost+recipe.labor;
 const ownerSharePerSale=Math.floor(p[recipe.itemId]*OWNER_SHARE);
 return {valid:true,blockedReason:'',recipeId,itemId:recipe.itemId,name:recipe.name,materials:{...recipe.materials},labor:recipe.labor,
  marketMaterialCost,unitCost,marketUnitPrice:p[recipe.itemId],ownerShareRate:OWNER_SHARE,ownerSharePerSale,
  estimatedProfitPerSale:Math.max(0,ownerSharePerSale-unitCost),recommendedFund:Math.max(100,Math.ceil(unitCost*3)),
  output,outputOptions:['market','company'],maxDailyProduction:MAX_DAILY_PRODUCTION,maxDailyBuyers:MAX_DAILY_BUYERS};
}
function result(valid,blockedReason,extra={}){return {valid,blockedReason,...extra}}
function fail(workshop,reason,extra={}){
 if(workshop)workshop.blockedReason=reason;
 return result(false,reason,extra);
}
function fund(workshops,siteId,player,deposit={}){
 if(!workshops||typeof workshops!=='object'||siteId==null||!Number.isInteger(Number(siteId)))return result(false,'invalid_site');
 const id=Number(siteId),key=String(id),existing=get(workshops,id),workshop=existing||blankWorkshop(id,Number.isInteger(deposit.day)?deposit.day:1);
 const goldInput=deposit.gold??0,goldNumber=Number(goldInput),gold=money(goldNumber);
 const materials={};
 for(const material of MATERIALS)materials[material]=amount(deposit.materials?.[material],MAX_MATERIAL_STOCK);
 if(!player||!player.inventory||!Number.isFinite(Number(player.gold)))return fail(workshop,'no_funds');
 if(!Number.isFinite(goldNumber)||goldNumber<0||gold>Number(player.gold)||workshop.treasury+gold>MAX_TREASURY)return fail(workshop,'no_funds');
 for(const material of MATERIALS){
  const input=deposit.materials?.[material]??0,quantity=Number(input);
  if(!Number.isInteger(quantity)||quantity<0||materials[material]>(Number(player.inventory[material])||0)||
     workshop.materials[material]+materials[material]>MAX_MATERIAL_STOCK)return fail(workshop,'no_funds');
 }
 if(!existing)workshops[key]=workshop;
 player.gold-=gold;workshop.treasury=money(workshop.treasury+gold);
 for(const material of MATERIALS){player.inventory[material]=(Number(player.inventory[material])||0)-materials[material];workshop.materials[material]+=materials[material]}
 workshop.blockedReason='idle';
 return result(true,'',{siteId,gold,materials});
}
function setOrder(workshops,siteId,order={}){
 const workshop=get(workshops,siteId);
 if(!workshop)return result(false,'invalid_site');
 if(!Object.hasOwn(recipes,order.recipeId))return fail(workshop,'invalid_recipe');
 if(!['market','company'].includes(order.output))return fail(workshop,'invalid_output');
 workshop.recipeId=order.recipeId;workshop.output=order.output;workshop.blockedReason='idle';
 return result(true,'',{siteId,recipeId:workshop.recipeId,output:workshop.output});
}
function quoteFunding(workshop,prices={}){
 if(!workshop||!Object.hasOwn(recipes,workshop.recipeId))return {valid:false,blockedReason:'no_order'};
 const estimate=quote(workshop.recipeId,prices,workshop.output);
 if(!estimate.valid)return estimate;
 const cashShort=Math.max(0,estimate.unitCost-workshop.treasury);
 const materialShort=Object.fromEntries(MATERIALS.map(id=>[id,Math.max(0,estimate.materials[id]-(workshop.materials[id]||0))]));
 return {...estimate,treasury:workshop.treasury,materialsAvailable:{...workshop.materials},cashShort,materialShort};
}
function marketObject(market){
 if(!market||typeof market!=='object')return null;
 if(!market.stock||typeof market.stock!=='object')market.stock={};
 if(!market.capacity||typeof market.capacity!=='object')market.capacity={};
 for(const id of [...MATERIALS,...ITEM_IDS]){
  if(!Number.isFinite(Number(market.stock[id])))market.stock[id]=0;
  market.stock[id]=amount(market.stock[id],1000000);
 }
 return market;
}
function removeOwned(workshop,itemId,quantity){
 const current=workshop.ownedStock[itemId]||0,taken=Math.min(current,amount(quantity));
 if(!taken)return {taken:0,cost:0};
 const totalCost=workshop.ownedCost[itemId]||0,cost=current?totalCost*taken/current:0;
 workshop.ownedStock[itemId]-=taken;workshop.ownedCost[itemId]=money(Math.max(0,totalCost-cost));
 return {taken,cost};
}
function recordPlayerPurchase(workshops,siteId,itemId,quantity){
 const workshop=get(workshops,siteId);
 if(!workshop)return result(false,'invalid_site');
 if(!ITEM_IDS.includes(itemId))return fail(workshop,'invalid_recipe');
 const units=amount(quantity);
 if(!units)return fail(workshop,'invalid_quantity');
 const removed=removeOwned(workshop,itemId,units);
 workshop.blockedReason='idle';
 return result(true,'',{siteId,itemId,ownedUnitsConsumed:removed.taken,ownerPayment:0});
}
function collect(workshops,siteId,player,itemId,quantity){
 const workshop=get(workshops,siteId),units=amount(quantity);
 if(!workshop)return result(false,'invalid_site');
 if(!ITEM_IDS.includes(itemId))return fail(workshop,'invalid_recipe');
 if(!Number.isInteger(Number(quantity))||units<1)return fail(workshop,'invalid_quantity');
 if(units>workshop.companyStock[itemId])return fail(workshop,'no_company_stock');
 if(!player?.inventory)return fail(workshop,'invalid_site');
 const owned=amount(player.inventory[itemId],1000000);
 if(owned+units>1000000)return fail(workshop,'invalid_quantity');
 workshop.companyStock[itemId]-=units;player.inventory[itemId]=owned+units;workshop.blockedReason='idle';
 return result(true,'',{siteId,itemId,quantity:units});
}
function collectEarnings(workshops,siteId,player){
 const workshop=get(workshops,siteId);
 if(!workshop)return result(false,'invalid_site');
 if(!player||!Number.isFinite(Number(player.gold)))return fail(workshop,'invalid_site');
 const payout=Math.min(workshop.earnings,workshop.treasury,Math.max(0,MAX_TREASURY-Number(player.gold)));
 if(payout<=0)return fail(workshop,'no_earnings');
 workshop.earnings=money(workshop.earnings-payout);workshop.treasury=money(workshop.treasury-payout);
 player.gold=money(Number(player.gold)+payout);workshop.blockedReason='idle';
 return result(true,'',{siteId,amount:payout});
}
function buyerStep(workshop,market,prices,demand,activeItemId,allowGeneric){
 let buyersLeft=Math.min(MAX_DAILY_BUYERS,amount(demand,MAX_DAILY_BUYERS)),sold=0,earnings=0,stockConsumed=0,genericConsumed=0;
 const order=ITEM_IDS.slice().sort((a,b)=>Number(b===activeItemId)-Number(a===activeItemId));
 for(const itemId of order){
  if(!buyersLeft)break;
  const marketStock=market.stock[itemId]||0,ownedStock=workshop.ownedStock[itemId]||0;
  // Repair stale ownership if some other market event already removed these units.
  if(ownedStock>marketStock)removeOwned(workshop,itemId,ownedStock-marketStock);
  const units=Math.min(buyersLeft,marketStock,workshop.ownedStock[itemId]||0);
  if(!units)continue;
  const owned=removeOwned(workshop,itemId,units),saleRevenue=owned.taken*Math.floor(prices[itemId]*OWNER_SHARE);
  const profit=Math.max(0,saleRevenue-owned.cost);
  market.stock[itemId]=Math.max(0,marketStock-owned.taken);
  workshop.treasury=money(workshop.treasury+saleRevenue);
  workshop.earnings=money(workshop.earnings+profit);
  workshop.soldTotal=amount(workshop.soldTotal+owned.taken,1000000000);
  sold+=owned.taken;earnings+=profit;stockConsumed+=owned.taken;buyersLeft-=owned.taken;
 }
 if(allowGeneric&&activeItemId&&buyersLeft>0){
  const stock=market.stock[activeItemId]||0,generic=Math.min(buyersLeft,stock);
  market.stock[activeItemId]=Math.max(0,stock-generic);
  genericConsumed+=generic;stockConsumed+=generic;buyersLeft-=generic;
 }
 return {sold,earnings,stockConsumed,genericConsumed,buyersLeft};
}
function unitPlan(workshop,recipe,market,prices){
 const fromReserve={},fromMarket={};let materialMarketCost=0,materialBasis=0;
 for(const [id,needed] of Object.entries(recipe.materials)){
  const reserve=Math.min(workshop.materials[id]||0,needed),buy=needed-reserve;
  if((market.stock[id]||0)<buy)return {valid:false,blockedReason:'market_shortage'};
  fromReserve[id]=reserve;fromMarket[id]=buy;
  materialMarketCost+=buy*prices[id];materialBasis+=needed*prices[id];
 }
 const cashCost=materialMarketCost+recipe.labor;
 if(workshop.treasury<cashCost)return {valid:false,blockedReason:'no_funds'};
 return {valid:true,fromReserve,fromMarket,materialMarketCost,materialBasis,cashCost,unitBasis:materialBasis+recipe.labor};
}
function processDay(workshops,siteId,context={}){
 const workshop=get(workshops,siteId);
 if(!workshop)return result(false,'invalid_site');
 const day=Number(context.day);
 if(!Number.isInteger(day)||day<1)return fail(workshop,'invalid_quantity');
 if(day<=workshop.lastDay)return result(true,'already_processed',{day,produced:0,sold:0,addedToMarket:0,addedToCompany:0,materialSpend:0,earningsAdded:0});
 const market=marketObject(context.market);
 if(!market)return fail(workshop,'invalid_site');
 const prices=pricesOf(context.prices),recipe=recipes[workshop.recipeId];
 const demand=amount(context.demand??1,MAX_DAILY_BUYERS);
 let produced=0,sold=0,addedToMarket=0,addedToCompany=0,materialSpend=0,earningsAdded=0;
 let blockedReason='idle';

 // Existing output reaches buyers before today's production. The shared daily demand can clear
 // any tracked batch, prioritizing the current recipe; only spare buyers consume ordinary stock.
 const buyer=buyerStep(workshop,market,prices,demand,workshop.recipeId,workshop.output==='market'&&!!workshop.recipeId);
 sold+=buyer.sold;earningsAdded+=buyer.earnings;

 if(!recipe){blockedReason=produced||sold?'idle':'no_order'}
 else if(workshop.output==='market'){
  const itemId=recipe.itemId,stock=market.stock[itemId]||0;
  const capacity=Number.isFinite(Number(market.capacity[itemId]))?Math.max(stock,amount(market.capacity[itemId],1000000)):stock;
  let room=Math.min(MAX_MARKET_OWNED-(workshop.ownedStock[itemId]||0),capacity-stock);
  if(room<=0)blockedReason='market_full';
  while(produced<MAX_DAILY_PRODUCTION&&room>0){
   const plan=unitPlan(workshop,recipe,market,prices);
   if(!plan.valid){blockedReason=plan.blockedReason;break}
   for(const id of Object.keys(recipe.materials)){
    workshop.materials[id]-=plan.fromReserve[id];
    market.stock[id]-=plan.fromMarket[id];
   }
   workshop.treasury=money(workshop.treasury-plan.cashCost);
   market.stock[itemId]++;
   workshop.ownedStock[itemId]++;
   workshop.ownedCost[itemId]=money(workshop.ownedCost[itemId]+plan.unitBasis);
   workshop.producedTotal=amount(workshop.producedTotal+1,1000000000);
   produced++;addedToMarket++;materialSpend+=plan.cashCost;room--;
  }
  if(produced===0&&sold===0&&blockedReason==='idle')blockedReason=demand?'no_funds':'no_demand';
 }else{
  const itemId=recipe.itemId;
  let room=MAX_COMPANY_STOCK-(workshop.companyStock[itemId]||0);
  if(room<=0)blockedReason='company_storage_full';
  while(produced<MAX_DAILY_PRODUCTION&&room>0){
   const plan=unitPlan(workshop,recipe,market,prices);
   if(!plan.valid){blockedReason=plan.blockedReason;break}
   for(const id of Object.keys(recipe.materials)){
    workshop.materials[id]-=plan.fromReserve[id];
    market.stock[id]-=plan.fromMarket[id];
   }
   workshop.treasury=money(workshop.treasury-plan.cashCost);
   workshop.companyStock[itemId]++;
   workshop.producedTotal=amount(workshop.producedTotal+1,1000000000);
   produced++;addedToCompany++;materialSpend+=plan.cashCost;room--;
  }
  if(produced===0&&blockedReason==='idle')blockedReason='no_funds';
 }
 workshop.lastDay=day;workshop.blockedReason=blockedReason;
 return result(true,blockedReason,{day,produced,sold,addedToMarket,addedToCompany,materialSpend:money(materialSpend),earningsAdded:money(earningsAdded),
  demand,treasury:workshop.treasury,earnings:workshop.earnings,marketStock:market.stock[recipe?.itemId]||0});
}

window.UACampaignWorkshops={VERSION,MATERIALS,ITEM_IDS,recipes,MAX_DAILY_PRODUCTION,MAX_DAILY_BUYERS,OWNER_SHARE,
 normalize,get,quote,quoteFunding,fund,setOrder,processDay,recordPlayerPurchase,collect,collectEarnings};
})();
