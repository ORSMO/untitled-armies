(function(){
'use strict';

const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,char=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[char]);
const partLabels={spear:{head:'Spearhead'},axe:{head:'Axe head'},bow:{string:'Bowstring'}};
const labels={draw:'Draw time'};
const title=value=>labels[value]||(value.charAt(0).toUpperCase()+value.slice(1)).replace(/([a-z])([A-Z])/g,'$1 $2');
const statNumber=value=>Number.isFinite(value)?String(Math.round(value*100)/100):'—';

function option(id,name,selected){
 return '<option value="'+escapeHTML(id)+'"'+(id===selected?' selected':'')+'>'+escapeHTML(name)+'</option>';
}
function stats(weapon,baseline){
 const profile=weapon?.profile;
 if(!profile)return'';
 const statsKeys=weapon.category==='bow'?['range','damage','draw','weight']:['reach','damage','handling','weight'];
 return '<div class="smithy-stats">'+statsKeys.map(id=>{
  const value=profile[id],unit=id==='draw'?'s':'';
  const change=baseline?Math.round((value-baseline[id])*100)/100:0;
  const difference=change?'<small class="smithy-delta">'+(change>0?'+':'')+statNumber(change)+unit+'</small>':'';
  const hint=id==='draw'?' title="Seconds to draw an arrow"':'';
  return '<span class="smithy-stat"'+hint+'><b>'+statNumber(value)+unit+difference+'</b><small>'+title(id)+'</small></span>';
 }).join('')+'</div>';
}
function weaponName(weapon){
 if(!weapon)return'';
 if(weapon.build?.name)return weapon.name;
 const [type,segments,finish]=weapon.name.split(' · ');
 return segments&&finish?type+' · '+finish:weapon.name;
}
function materialLabel(materials){
 return Object.entries(materials||{}).filter(([,quantity])=>quantity>0).map(([id,quantity])=>
  quantity+' '+title(id).toLowerCase()
 ).join(' · ');
}

function create(callbacks){
 const forge=window.UABattleForge;
 const workshop=document.getElementById('townSmithy');
 const character=document.getElementById('characterForgedWeapons');
 let siteId=null,mode='forge',pending=null,updatedMessage='';
 const drafts=new Map();
 const categories=forge.categories;
 const categoryName=id=>forge.catalog[id].name||title(id);
 let category=categories[0];

 function draft(){
  if(!drafts.has(category))drafts.set(category,forge.defaultBuild(category));
  return drafts.get(category);
 }
 function renderQuote(){
  const preview=workshop.querySelector('[data-smithy-preview]');
  if(!preview)return;
  const gearButton='<button type="button" class="btn" data-smithy-mode="gear">Manage gear</button>';
  const quote=callbacks.quote(draft(),siteId);
  if(!quote){preview.innerHTML='<p>Choose a valid weapon build.</p>'+gearButton;return}
  const materials=Object.entries(quote.materials||{}).filter(([,quantity])=>quantity>0);
  const pack=callbacks.resources();
  const tokens=materials.map(([id,quantity])=>'<span'+((pack[id]||0)<quantity?' class="short"':'')+'>'+
   escapeHTML(title(id))+' '+(pack[id]||0)+'/'+quantity+'</span>').join('');
  const baseline=forge.resolve(forge.defaultBuild(category))?.profile;
  preview.innerHTML='<h3>'+escapeHTML(weaponName(quote.weapon))+'</h3>'+stats(quote.weapon,baseline)+
   '<small class="smithy-meta smithy-baseline">Compared with a standard '+escapeHTML(categoryName(category).toLowerCase())+'</small>'+
   '<div class="smithy-costs" aria-label="Owned and required materials">'+tokens+'</div>'+
   '<div class="smithy-actions"><button class="btn primary" type="button" data-smithy-craft="materials" aria-label="Forge with materials and '+
    quote.gold+' denars"'+(quote.canMaterials?'':' disabled')+'>Forge · '+quote.gold+'</button>'+
   '<button class="btn" type="button" data-smithy-craft="gold" aria-label="Forge for '+quote.fullGold+' denars without materials"'+
    (quote.canGold?'':' disabled')+'>Gold only · '+quote.fullGold+'</button>'+gearButton+'</div>';
 }
 function renderBuilder(){
  const build=draft();
  const parts=forge.catalog[category].parts;
  const fields=Object.entries(parts).map(([key,list])=>{
   const options=list.map(part=>option(part.id,part.name,build[key])).join('');
   const label=partLabels[category]?.[key]||title(key);
   return '<label>'+escapeHTML(label)+'<select data-smithy-part="'+escapeHTML(key)+'">'+options+'</select></label>';
  }).join('');
  const finishes=forge.catalog.finishes.map(finish=>option(finish.id,finish.name,build.finish)).join('');
  return '<div class="smithy-layout"><div class="smithy-fields">'+
   '<label>Weapon type<select data-smithy-family>'+categories.map(id=>option(id,categoryName(id),category)).join('')+'</select></label>'+
   '<label class="smithy-name">Weapon name<input type="text" data-smithy-name maxlength="32" autocomplete="off" value="'+escapeHTML(build.name)+'"></label>'+
   fields+'<label>Finish<select data-smithy-finish>'+finishes+'</select></label></div>'+
   '<section class="smithy-preview" aria-label="Weapon stats and quote" data-smithy-preview></section></div>';
 }
 function renderItem(item,inTown){
  const tag=item.crafted?'Forged weapon':item.quantity>0?item.quantity+' in pack':'Equipped';
  const canProcess=inTown&&item.quantity>0&&(!item.crafted||!item.equipped);
  const confirm=pending?.id===String(item.id)?pending:null;
  const actionButton=(id,label,enabled=true)=>'<button type="button" class="btn" data-smithy-gear="'+id+'"'+
   (enabled?'':' disabled')+'>'+escapeHTML(label)+'</button>';
  let actions='';
  if(confirm&&inTown){
   const text=confirm.action==='assign'?'Consume this weapon to set the selected troop design?':
    confirm.action==='sell'?'Sell one for '+item.sellPrice+' denars?':'Salvage one for '+materialLabel(item.salvage)+'?';
   actions='<div class="smithy-confirm"><p>'+escapeHTML(text)+'</p><div class="smithy-actions">'+
    actionButton('confirm','Confirm')+actionButton('cancel','Keep')+'</div></div>';
  }else{
   actions='<div class="smithy-actions">'+
    (item.canEquip&&!item.equipped?actionButton('equip','Equip'):'')+
    (canProcess&&item.sellPrice>0?actionButton('sell','Sell · '+item.sellPrice+' denars'):'')+
    (canProcess&&materialLabel(item.salvage)?actionButton('salvage','Salvage'):'')+'</div>';
   if(canProcess&&item.troopChoices?.length){
    actions+='<div class="smithy-assignment"><label>Troop design<select data-smithy-kit>'+
     item.troopChoices.map(kit=>option(kit.id,kit.name)).join('')+'</select></label>'+
     actionButton('assign','Assign design')+'</div>';
   }
  }
  const salvage=canProcess?materialLabel(item.salvage):'';
  return '<article class="smithy-inventory-card" data-smithy-item="'+escapeHTML(item.id)+'">'+
   '<h4 tabindex="-1">'+escapeHTML(item.crafted?weaponName(item.weapon):item.name)+'</h4><small class="smithy-meta">'+escapeHTML(tag)+
   (item.equipped&&tag!=='Equipped'?' · Equipped':'')+'</small>'+stats(item.weapon)+
   (salvage?'<small class="smithy-meta">Salvage: '+escapeHTML(salvage)+'</small>':'')+actions+'</article>';
 }
 function refreshWorkshop(focusId){
  if(siteId==null)return;
  const forgeSelected=mode==='forge';
  workshop.innerHTML=(forgeSelected?'':'<div class="smithy-modes"><button type="button" class="btn" data-smithy-mode="forge">↩ Back to forge</button></div>')+
   '<p class="smithy-live" role="status">'+escapeHTML(updatedMessage)+'</p>'+
   (forgeSelected?renderBuilder():renderGear());
  if(forgeSelected)renderQuote();
  if(focusId!=null){
   const card=[...workshop.querySelectorAll('[data-smithy-item]')].find(item=>item.dataset.smithyItem===String(focusId));
   card?.querySelector('h4')?.focus();
  }
 }
 function renderGear(){
  const items=callbacks.inventory(siteId);
  return items.length?'<section class="smithy-arsenal" aria-label="Gear available at the smithy"><div class="smithy-items">'+
   items.map(item=>renderItem(item,true)).join('')+'</div></section>':
   '<p>No gear to manage. Forge a weapon or bring spare equipment.</p>';
 }
 function showTown(id){
  if(siteId!==id){siteId=id;mode='forge';pending=null;updatedMessage=''}
  refreshWorkshop();
 }
 function showCharacter(){
  const items=callbacks.inventory().filter(item=>item.crafted);
  character.hidden=items.length===0;
  character.innerHTML=items.length?'<h3>Forged weapons</h3><div class="smithy-items">'+
   items.map(item=>renderItem(item,false)).join('')+'</div>':'';
 }
 function updateBuilder(field){
  const build=draft();
  if(field.hasAttribute('data-smithy-finish'))build.finish=field.value;
  else if(field.dataset.smithyPart)build[field.dataset.smithyPart]=field.value;
  else if(field.hasAttribute('data-smithy-name'))build.name=field.value;
  else return;
  renderQuote();
 }
 workshop.addEventListener('input',event=>{
  if(event.target.hasAttribute('data-smithy-name'))updateBuilder(event.target);
 });
 workshop.addEventListener('change',event=>{
  const field=event.target;
  if(field.hasAttribute('data-smithy-family')){
   if(!categories.includes(field.value))return;
   category=field.value;updatedMessage='';refreshWorkshop();
   workshop.querySelector('[data-smithy-family]')?.focus({preventScroll:true});
  }else if(!field.hasAttribute('data-smithy-name'))updateBuilder(field);
 });
 workshop.addEventListener('click',event=>{
  const control=event.target.closest('[data-smithy-mode],[data-smithy-craft],[data-smithy-gear]');
  if(!control||control.disabled)return;
  if(control.dataset.smithyMode){
   mode=control.dataset.smithyMode;pending=null;updatedMessage='';refreshWorkshop();
   workshop.querySelector(mode==='forge'?'[data-smithy-family]':'[data-smithy-mode="forge"]')?.focus({preventScroll:true});
   return;
  }
  if(control.dataset.smithyCraft){
   const id=callbacks.craft(siteId,draft(),control.dataset.smithyCraft);
   if(!id){renderQuote();return}
   mode='gear';updatedMessage='Weapon forged.';refreshWorkshop(id);
   return;
  }
  const card=control.closest('[data-smithy-item]'),id=card?.dataset.smithyItem,action=control.dataset.smithyGear;
  if(!id)return;
  if(action==='equip'){
   if(callbacks.equip(id)){updatedMessage='Equipped.';refreshWorkshop(id)}
  }else if(action==='cancel'){
   pending=null;updatedMessage='';refreshWorkshop(id);
  }else if(action==='confirm'){
   if(!pending||pending.id!==id)return;
   const done=pending.action==='assign'?callbacks.assign(siteId,id,pending.kit):
    callbacks.process(siteId,id,pending.action);
   const feedback={assign:'Troop design assigned.',sell:'Gear sold.',salvage:'Gear salvaged.'};
   if(done)updatedMessage=feedback[pending.action];
   pending=null;refreshWorkshop(id);
  }else{
   pending={id,action,kit:card.querySelector('[data-smithy-kit]')?.value};
   updatedMessage='';refreshWorkshop(id);
  }
 });
 character.addEventListener('click',event=>{
  const control=event.target.closest('[data-smithy-gear="equip"]');
  const id=control?.closest('[data-smithy-item]')?.dataset.smithyItem;
  if(id&&callbacks.equip(id))callbacks.refreshCharacter();
 });
 return {showTown,showCharacter};
}

window.UASmithyUI={create};
})();
