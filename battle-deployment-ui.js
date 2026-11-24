(()=>{
'use strict';

const byId=id=>document.getElementById(id);
const panel=byId('deploymentPanel'),placement=byId('deploymentPlacement');
const title=byId('deploymentTitle'),ready=byId('deploymentReady'),reserve=byId('deploymentReserve');
const edit=byId('deploymentEdit'),groups=byId('deploymentGroup'),status=byId('deploymentStatus');
const amount=byId('deploymentCount'),fewer=byId('deploymentFewer'),more=byId('deploymentMore');
const formation=byId('deploymentFormation'),place=byId('deploymentPlace');
const placementHint=byId('deploymentPlacementHint'),cancelPlace=byId('deploymentCancelPlace');
const back=byId('deploymentBack'),quick=byId('deploymentQuick'),begin=byId('deploymentBegin');
let groupId=null,active=false,placing=false,optionsKey='';

function selectedGroup(state){
 return state.groups.find(group=>String(group.id)===groupId)||state.groups[0];
}
function groupCapacity(state,group){
 return Math.max(0,Math.min(group.count,state.limit-state.selectedCount+group.selected));
}
function updateDeployment(){
 const state=window.UADeployment?.getState();
 const nextActive=!!state?.active;
 const placingGroup=nextActive?state.groups.find(group=>group.placing):null;
 panel.hidden=!nextActive||!!placingGroup;
 placement.hidden=!placingGroup;
 document.body.classList.toggle('deployment-active',nextActive);
 if(!nextActive){active=false;placing=false;return}

 const group=selectedGroup(state);
 groupId=group?String(group.id):null;
 const key=JSON.stringify(state.groups.map(({id,name,count,selected})=>[id,name,count,selected]));
 if(key!==optionsKey){
  optionsKey=key;
  groups.replaceChildren(...state.groups.map(group=>new Option(
   group.name+' · '+group.selected+'/'+group.count,
   String(group.id)
  )));
 }
 if(group)groups.value=groupId;
 edit.hidden=!group;
 ready.textContent=state.selectedCount+' / '+state.limit+' fielded';
 reserve.textContent=Math.max(0,state.availableCount-state.selectedCount)+' in reserve';
 back.textContent=state.practiceMode?'Back to setup':'Back';
 back.setAttribute('aria-label',state.practiceMode?'Back to practice setup':'Back to encounter');
 begin.disabled=state.availableCount>0&&state.selectedCount===0;
 status.textContent=state.message||(group?'':'Your hero will enter alone.');
 if(group){
  const max=groupCapacity(state,group);
  amount.max=String(max);
  if(document.activeElement!==amount)amount.value=String(group.selected);
  fewer.disabled=group.selected===0;
  more.disabled=group.selected>=max;
  formation.value=group.formation||'current';
  formation.disabled=place.disabled=group.selected===0;
 }
 if(placingGroup){
  placementHint.textContent=state.message||'Tap the highlighted starting area for '+placingGroup.name+'.';
  if(!placing)cancelPlace.focus({preventScroll:true});
 }else if(placing){
  (place.disabled?groups:place).focus({preventScroll:true});
 }else if(!active)title.focus({preventScroll:true});
 active=true;
 placing=!!placingGroup;
}
function applyGroupCount(value){
 const api=window.UADeployment,state=api?.getState();
 if(!state?.active)return;
 const group=selectedGroup(state);
 if(!group)return;
 const current=group.selected;
 const count=Number.isInteger(value)?Math.max(0,Math.min(groupCapacity(state,group),value)):current;
 api.setCount(group.id,count);
 amount.value=String(selectedGroup(api.getState())?.selected??current);
 updateDeployment();
}
groups.addEventListener('change',()=>{groupId=groups.value;updateDeployment()});
amount.addEventListener('change',()=>applyGroupCount(amount.value.trim()?Number(amount.value):NaN));
amount.addEventListener('keydown',event=>{
 if(event.key==='Enter'){event.preventDefault();amount.blur()}
});
fewer.addEventListener('click',()=>applyGroupCount(Number(amount.value)-1));
more.addEventListener('click',()=>applyGroupCount(Number(amount.value)+1));
formation.addEventListener('change',()=>{
 const api=window.UADeployment,group=selectedGroup(api.getState());
 if(group)api.setFormation(group.id,formation.value);
});
place.addEventListener('click',()=>{
 const api=window.UADeployment,group=selectedGroup(api.getState());
 if(group)api.choosePosition(group.id);
});
cancelPlace.addEventListener('click',()=>window.UADeployment?.cancelPosition());
back.addEventListener('click',()=>window.UADeployment?.cancel());
quick.addEventListener('click',()=>window.UADeployment?.quickStart());
begin.addEventListener('click',()=>window.UADeployment?.begin());
window.addEventListener('keydown',event=>{
 if(!placing||event.key!=='Escape')return;
 event.preventDefault();window.UADeployment?.cancelPosition();
});
window.addEventListener('ua:deployment-change',updateDeployment);
updateDeployment();
})();
