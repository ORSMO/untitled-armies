(function(){
'use strict';

const weapons={
 shortsword:{label:'Short sword',weapon:'shortsword'},
 sword:{label:'Sword',weapon:'sword'},
 greatsword:{label:'Greatsword',weapon:'greatsword'},
 axe:{label:'Axe',weapon:'axe'},
 spear:{label:'Spear',weapon:'spear'},
 pike:{label:'Pike',weapon:'pike'},
 lance:{label:'Lance',weapon:'lance'},
 bow:{label:'Bow',weapon:'shortsword',ranged:'bow'},
 crossbow:{label:'Crossbow',weapon:'shortsword',ranged:'crossbow'},
 javelin:{label:'Javelins',weapon:'spear',ranged:'javelin'},
 horsebow:{label:'Horse bow',weapon:'sword',ranged:'horsebow'}
};
const roles={
 infantry:{label:'Infantry',weapons:['shortsword','sword','greatsword','axe','spear','pike','javelin']},
 archer:{label:'Archer',weapons:['bow','crossbow']},
 cavalry:{label:'Cavalry',weapons:['sword','spear','lance']},
 horseArcher:{label:'Horse archer',weapons:['horsebow','javelin']}
};
const styles={
 quick:{label:'Quick',weaponDamage:.9,weaponSpeed:1.1},
 balanced:{label:'Balanced',weaponDamage:1,weaponSpeed:1},
 heavy:{label:'Heavy',weaponDamage:1.1,weaponSpeed:.9}
};

// Each row defines the recruit, trained and veteran units of one realm.
// Entries specify weapon, body armor, shield, role, and optional horse armor.
const kits=[
 [['spear','padded','buckler','infantry'],['sword','leather','round','infantry'],['bow','padded',null,'archer']],
 [['axe','padded','round','infantry'],['axe','mail','round','infantry'],['greatsword','mail',null,'infantry']],
 [['spear','padded','round','infantry'],['pike','mail',null,'infantry'],['pike','plate',null,'infantry']],
 [['shortsword','leather','round','infantry'],['sword','mail','kite','infantry'],['lance','plate','kite','cavalry','mail']],
 [['spear','leather','buckler','infantry'],['bow','leather',null,'archer'],['lance','plate','round','cavalry','plate']],
 [['shortsword','padded','buckler','infantry'],['crossbow','padded',null,'archer'],['crossbow','mail',null,'archer']],
 [['spear','leather','round','infantry'],['sword','leather','kite','infantry'],['lance','mail','kite','cavalry','leather']],
 [['shortsword','padded','round','infantry'],['javelin','mail','kite','infantry'],['sword','plate','kite','infantry']],
 [['javelin','padded','buckler','infantry'],['bow','mail',null,'archer'],['lance','mail','round','cavalry','leather']],
 [['spear','padded','buckler','cavalry'],['horsebow','leather',null,'horseArcher'],['horsebow','mail',null,'horseArcher','leather']]
];

function validSlot(faction,tier){
 return Number.isInteger(faction)&&Number.isInteger(tier)&&!!kits[faction]?.[tier];
}
function normalizeDesign(faction,tier,input){
 if(!validSlot(faction,tier)||!input||typeof input!=='object')return null;
 const role=kits[faction][tier][3];
 if(!roles[role].weapons.includes(input.weaponId))return null;
 const style=Object.hasOwn(styles,input.style)?input.style:'balanced';
 const name=typeof input.name==='string'?input.name.trim().slice(0,32):'';
 return {weaponId:input.weaponId,style,name:name||weapons[input.weaponId].label};
}
function getLoadout(faction,tier,input){
 if(!validSlot(faction,tier))return null;
 const [baseWeapon,armor,shield,role,horseArmor='none']=kits[faction][tier];
 const design=normalizeDesign(faction,tier,input);
 const weaponId=design?.weaponId||baseWeapon,profile=weapons[weaponId];
 const style=styles[design?.style||'balanced'];
 const usesTwoHands=['axe','greatsword','pike'].includes(profile.weapon)||role==='archer'||role==='horseArcher';
 return {
  name:window.UAWorld?.factions[faction]?.troops[tier]||roles[role].label,
  weaponId,weaponName:design?.name||profile.label,weapon:profile.weapon,ranged:profile.ranged||null,
  armor,shield:usesTwoHands?null:shield,role,horseArmor,
  stats:{weaponDamage:style.weaponDamage,weaponSpeed:style.weaponSpeed}
 };
}
function normalizeDesigns(input){
 const saved={};
 for(let faction=0;faction<kits.length;faction++)for(let tier=0;tier<3;tier++){
  const key=faction+':'+tier,design=normalizeDesign(faction,tier,input?.[key]);
  if(design)saved[key]=design;
 }
 return saved;
}

window.UAArmory={weapons,roles,styles,getLoadout,normalizeDesign,normalizeDesigns};
})();
