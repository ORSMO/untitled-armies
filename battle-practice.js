(function(){
'use strict';

const form=document.getElementById('practiceSetup');
const playerFaction=document.getElementById('practiceFaction');
const enemyFaction=document.getElementById('practiceEnemyFaction');
const enemyRealm=document.getElementById('practiceEnemyRealm');
const opponent=document.getElementById('practiceOpponent');

const defaultEnemyFaction=enemyFaction.value;
enemyFaction.replaceChildren(...Array.from(playerFaction.options,option=>
 new Option(option.textContent,option.value)
));
enemyFaction.value=defaultEnemyFaction;

const restoredSettings=new URLSearchParams(window.location.search);
for(const control of form.elements){
 const value=restoredSettings.get(control.name);
 if(value===null)continue;
 if(control.type==='select-one'&&Array.from(control.options).some(option=>option.value===value)){
  control.value=value;
 }else if(control.type==='number'&&/^[0-9]+$/.test(value)){
  const number=Number(value);
  if(Number.isInteger(number)&&number>=Number(control.min)&&number<=Number(control.max)){
   control.value=String(number);
  }
 }
}

function updateOpponent(){
 enemyRealm.hidden=opponent.value==='bandit';
}
opponent.addEventListener('change',updateOpponent);
updateOpponent();

form.addEventListener('submit',event=>{
 event.preventDefault();
 if(!form.reportValidity())return;
 const settings=new URLSearchParams(new FormData(form));
 window.location.assign('campaign-battle.html?'+settings.toString());
});
})();
