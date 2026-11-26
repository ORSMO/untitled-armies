(function(){
'use strict';

const VERSION=1;
const RESOURCES=['grain','timber','iron','tools','salt'];
const MARKET_SITES=new Set(['capital','town']);
const BONUS_LIMIT=1;
const FACTOR_MIN=.92,FACTOR_MAX=1.08;
const FACTOR_PROFILES={
 smithing:{buy:{iron:.96,tools:.96},sale:{iron:1.04,tools:1.04}},
 provisions:{buy:{grain:.96,food:.96},sale:{grain:1.04,food:1.04}},
 timber:{buy:{timber:.96},sale:{timber:1.04}},
 market:{buy:{grain:.98,timber:.98,iron:.98,tools:.98,salt:.98},sale:{grain:1.02,timber:1.02,iron:1.02,tools:1.02,salt:1.02}}
};

const copy=(value)=>JSON.parse(JSON.stringify(value));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function tileKind(site,tileAt){
 try{return tileAt?.(site.x,site.y)?.kind||'grass'}catch(e){return'grass'}
}
function yields(site,kind){
 const result={grain:1,timber:0,iron:0,tools:0,salt:0};
 if(['grass','steppe','marsh','rainforest'].includes(kind))result.grain+=2;
 if(['forest','taiga','rainforest'].includes(kind))result.timber=3;
 if(['hills','mountain'].includes(kind))result.iron=2;
 if(['desert','scrub','marsh'].includes(kind))result.salt=2;
 if(site.type==='village'){
  if(RESOURCES.includes(site.specialty)&&site.specialty!=='tools')result[site.specialty]+=4;
 }else if(site.type==='town'||site.type==='capital'){
  result.grain++;
  result.tools=site.marketTier==='hub'?2:1;
 }else if(site.type==='castle')result.tools=1;
 const prosperity=Math.max(0,Math.min(100,Number(site.prosperity)||50)),factor=.75+prosperity/200;
 for(const resource of ['grain','timber','iron','salt'])result[resource]=Math.round(result[resource]*factor);
 return result;
}
function villageResource(village,tileAt){
 if(RESOURCES.includes(village.specialty)&&village.specialty!=='tools')return village.specialty;
 const base=yields(village,tileKind(village,tileAt));
 return ['grain','timber','iron','salt'].sort((a,b)=>base[b]-base[a]||['grain','timber','iron','salt'].indexOf(a)-['grain','timber','iron','salt'].indexOf(b))[0];
}
function nearbyVillages(site,settlements,maxDistance=2300){
 return settlements.filter(other=>other.type==='village'&&other.faction===site.faction)
  .map(village=>({site:village,distance:distance(site,village)}))
  .filter(item=>item.distance<=maxDistance)
  .sort((a,b)=>a.distance-b.distance||a.site.id-b.site.id);
}
function scoresFor(site,settlements,tileAt){
 const values=yields(site,tileKind(site,tileAt)),nearby=nearbyVillages(site,settlements);
 const villageIds=nearby.slice(0,4).map(item=>item.site.id);
 const supply={...values};
 for(const {site:village,distance:gap} of nearby){
  const weight=Math.max(0,1-gap/2300),profile=yields(village,tileKind(village,tileAt));
  for(const resource of RESOURCES)supply[resource]+=profile[resource]*weight*.28;
 }
 const roleScores={
  // Iron working is a strong destination signal: hills and nearby iron
  // villages should be able to outweigh a town's ordinary grain output.
  smithing:supply.iron*2+supply.tools*.9,
  provisions:supply.grain*1.2,
  timber:supply.timber*1.18
 };
 return {resourceScores:Object.fromEntries(RESOURCES.map(id=>[id,Math.round(supply[id]*100)/100])),roleScores,
  nearbyVillageIds:villageIds};
}
function chooseTradeSpecialty(roleScores){
 const ranked=Object.entries(roleScores).sort((a,b)=>b[1]-a[1]||['smithing','provisions','timber'].indexOf(a[0])-['smithing','provisions','timber'].indexOf(b[0]));
 // Strong iron catchments remain smithing towns even where a broad timber
 // hinterland slightly outranks them. Keep the gap bounded so this does not
 // Turn every resource-rich settlement into a forge.
 if(roleScores.smithing>=4.25&&ranked[0][0]!=='smithing'&&ranked[0][1]-roleScores.smithing<=4)return'smithing';
 return ranked[0][1]>=4.25&&ranked[0][1]-ranked[1][1]>=.45?ranked[0][0]:'market';
}
function specialtyText(kind,trade){
 if(kind==='smithing')return 'Nearby iron and tools keep the local forges busy.';
 if(kind==='provisions')return 'The surrounding farms and storehouses supply provisions.';
 if(kind==='timber')return 'Nearby woodland sends timber to the town’s builders and workshops.';
 if(trade==='market')return 'Caravans bring a broad selection of goods from across the region.';
 return 'Local traders connect this settlement with its surrounding villages.';
}
function identityFor(site,trade){
 if(site.type==='capital')return {identityKey:'capital',title:'Capital seat',overview:'The realm’s ruling household, garrison, and market gather beneath its banners.'};
 if(site.type==='castle')return {identityKey:'stronghold',title:'Stronghold',overview:'A fortified house seat with a garrison and nearby holdings.'};
 if(site.type==='village')return {identityKey:'village-supplier',title:'Village supplier',overview:'A small settlement whose work supports the surrounding towns.'};
 if(site.marketTier==='hub')return {identityKey:'hub-market',title:'Major market',overview:'A busy crossroads where local goods meet long-distance trade.'};
 if(trade==='smithing')return {identityKey:'smithing-town',title:'Smithing town',overview:'Local metal and tools support the settlement’s forges.'};
 if(trade==='provisions')return {identityKey:'provisions-town',title:'Provisioning town',overview:'Local grain and provisions feed travelers and nearby garrisons.'};
 if(trade==='timber')return {identityKey:'timber-town',title:'Timber town',overview:'Nearby woodland supplies builders and craftspeople.'};
 return {identityKey:'market-town',title:'Trade town',overview:'Merchants and craftspeople serve the surrounding settlements.'};
}
function factorsFor(site,trade){
 const profile=site.marketTier==='hub'?FACTOR_PROFILES.market:FACTOR_PROFILES[trade]||{};
 const buy=Object.fromEntries(RESOURCES.concat(['food']).map(id=>[id,1]));
 const sale={...buy};
 for(const [id,factor] of Object.entries(profile.buy||{}))buy[id]=Math.max(FACTOR_MIN,Math.min(FACTOR_MAX,factor));
 for(const [id,factor] of Object.entries(profile.sale||{}))sale[id]=Math.max(FACTOR_MIN,Math.min(FACTOR_MAX,factor));
 return {buyFactors:buy,saleFactors:sale};
}
function bonusesFor(site,trade){
 const bonus={grain:0,timber:0,iron:0,tools:0,salt:0};
 if(site.type==='town'){
  if(trade==='smithing')bonus.iron=BONUS_LIMIT;
  else if(trade==='provisions')bonus.grain=BONUS_LIMIT;
  else if(trade==='timber')bonus.timber=BONUS_LIMIT;
 }
 return bonus;
}
function classifyWithData(site,data){
 if(!site||!Number.isInteger(site.id))return null;
 const {settlements,tileAt,factions}=data;
 const {resourceScores,roleScores,nearbyVillageIds}=scoresFor(site,settlements,tileAt);
 const trade=site.type==='village'?villageResource(site,tileAt):
  MARKET_SITES.has(site.type)&&site.type!=='capital'&&site.marketTier!=='hub'?chooseTradeSpecialty(roleScores):
  site.type==='capital'?chooseTradeSpecialty(roleScores):'market';
 const identity=identityFor(site,trade),faction=factions.find(item=>item.id===site.faction);
 const factors=factorsFor(site,trade),productionBonus=bonusesFor(site,trade);
 const marketSites=settlements.filter(other=>MARKET_SITES.has(other.type)&&other.faction===site.faction);
 const nearestMarket=marketSites.slice().sort((a,b)=>distance(site,a)-distance(site,b)||a.id-b.id)[0]||null;
 const villageSupply=site.type==='village'?{
  resource:trade,resourceLabel:trade.charAt(0).toUpperCase()+trade.slice(1),
  nearestMarketId:nearestMarket?.id??null,nearestMarketName:nearestMarket?.name??null,
  text:nearestMarket?'This '+trade+' village supplies '+nearestMarket.name+' along the local roads.':'This village supplies passing travelers with '+trade+'.',
  destinationText:nearestMarket?'Supply road to '+nearestMarket.name:'Local village supply'
 }:null;
 const capitalHall=site.type==='capital'?{
  title:'The capital hall',actionId:'capital-hall',actionLabel:'Enter the capital hall',
  description:'Seek an audience, hear the court’s concerns, and learn what the realm needs.'
 }:null;
 const factionName=faction?.name||'the realm';
 const tradeLabel=trade==='smithing'?'Smithing':trade==='provisions'?'Provisions':trade==='timber'?'Timber':trade==='grain'?'Grain':trade==='iron'?'Iron':trade==='salt'?'Salt':'General trade';
 const hallAction=capitalHall?[{id:'capital-hall',label:capitalHall.actionLabel,description:capitalHall.description}]:[];
 const roleAction=site.type==='town'&&trade!=='market'?[{id:'local-trade',label:'Visit the '+trade+' quarter',description:specialtyText(trade,trade)}]:[];
 const actions=hallAction.concat(roleAction);
 return {version:VERSION,siteId:site.id,faction:site.faction,type:site.type,identityKey:identity.identityKey,title:identity.title,
  overview:identity.overview,tradeSpecialty:trade,tradeLabel,tradeText:specialtyText(site.type==='village'?'':trade,trade),
  resourceScores,roleScores,productionBonus,nearbyVillageIds,nearestMarketId:nearestMarket?.id??null,
  buyFactors:factors.buyFactors,saleFactors:factors.saleFactors,capitalHall,villageSupply,actions,
  bannerLabel:site.type==='capital'?'Capital of '+factionName:identity.title};
}
function validInputs(config){
 const settlements=Array.isArray(config.settlements)?config.settlements.filter(site=>site&&Number.isInteger(site.id)):[];
 const factions=Array.isArray(config.factions)?config.factions:[];
 return {settlements,factions,tileAt:typeof config.tileAt==='function'?config.tileAt:null};
}
function create(config={}){
 const data=validInputs(config),roles=new Map();
 for(const site of data.settlements){
  if(roles.has(site.id))continue;
  const record=classifyWithData(site,data);
  if(record)roles.set(site.id,record);
 }
 return roles;
}
function classify(site,options={}){
 const data=validInputs({settlements:Array.isArray(options.settlements)?options.settlements:[site],factions:options.factions,tileAt:options.tileAt});
 return classifyWithData(site,data);
}
function get(roles,siteId){
 if(roles instanceof Map)return roles.get(Number(siteId))||null;
 return roles?.[String(siteId)]||null;
}
function marketFactor(roles,siteId,itemId,side='buy'){
 const record=get(roles,siteId),factors=side==='sale'?record?.saleFactors:record?.buyFactors;
 const factor=Number(factors?.[itemId]);
 return Number.isFinite(factor)?Math.max(FACTOR_MIN,Math.min(FACTOR_MAX,factor)):1;
}

window.UACampaignPlaceRoles={VERSION,RESOURCES,FACTOR_MIN,FACTOR_MAX,create,classify,get,marketFactor};
})();
