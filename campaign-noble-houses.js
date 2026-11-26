(function () {
  'use strict';

  const MAX_TREASURY = 1800;
  const MAX_HOUSE_TROOPS = 68;
  const MAX_DAILY_RECRUITS = 4;
  const MAX_CATCHUP_DAYS = 30;
  const UPKEEP_PER_TROOP = 2;
  const RECRUIT_COST = 18;
  const SITE_TAX = new Map([['capital', 28], ['town', 16], ['castle', 10], ['village', 6]]);
  const RESOURCE_DUTY = { grain: .65, timber: .8, iron: 1.4, tools: 1.35, salt: .9 };
  const ROLES = new Map([
    ['head', { weight: 12, troopCap: 44 }],
    ['heir', { weight: 5, troopCap: 26 }],
    ['partner', { weight: 4, troopCap: 22 }],
    ['parent', { weight: 1, troopCap: 8 }],
    ['sibling', { weight: 2, troopCap: 16 }],
    ['sibling-partner', { weight: 1, troopCap: 8 }],
    ['cousin', { weight: 2, troopCap: 16 }],
    ['adult', { weight: 2, troopCap: 16 }]
  ]);
  const ledgerIndexes = new WeakMap();

  function bounded(value, minimum, maximum, fallback) {
    return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, Math.floor(value))) : fallback;
  }

  function settlementMap(world) {
    const sites = Array.isArray(world?.settlements) ? world.settlements : [];
    return new Map(sites.filter(site => Number.isSafeInteger(site?.id)).map(site => [site.id, site]));
  }

  function collectHoldings(houses, sites) {
    const holdings = new Map(houses.map(house => [house.id, []]));
    const housesByFaction = new Map();
    for (const house of houses) {
      if (!housesByFaction.has(house.faction)) housesByFaction.set(house.faction, []);
      housesByFaction.get(house.faction).push(house);
    }
    for (const site of sites.values()) {
      if (!SITE_TAX.has(site.type)) continue;
      let owner = null;
      let closestDistance = Infinity;
      for (const house of housesByFaction.get(site.faction) || []) {
        const seat = sites.get(house.seatId);
        const distance = Math.hypot(site.x - seat.x, site.y - seat.y);
        if (distance < closestDistance) {
          owner = house;
          closestDistance = distance;
        }
      }
      if (owner) holdings.get(owner.id).push(site.id);
    }
    return holdings;
  }

  function adultRetinues(families) {
    const people = families instanceof Map ? [...families.values()].flat() : families;
    const byHouse = new Map();
    const seen = new Set();
    for (const person of Array.isArray(people) ? people : []) {
      if (!Number.isSafeInteger(person?.age) || person.age < 18 || !Number.isSafeInteger(person.houseId) ||
          typeof person.id !== 'string' || !person.id || seen.has(person.id)) continue;
      seen.add(person.id);
      if (!byHouse.has(person.houseId)) byHouse.set(person.houseId, []);
      const role = ROLES.has(person.role) ? person.role : 'adult';
      byHouse.get(person.houseId).push({ personId: person.id, role, strength: 1, target: 1 });
    }
    for (const retinues of byHouse.values()) {
      retinues.sort((a, b) => ROLES.get(b.role).weight - ROLES.get(a.role).weight ||
        (a.personId < b.personId ? -1 : 1));
    }
    return byHouse;
  }

  function siteIncome(site, production) {
    const prosperity = bounded(site.prosperity, 0, 100, 50);
    const yields = production?.(site);
    let duties = 0;
    for (const [resource, rate] of Object.entries(RESOURCE_DUTY)) {
      const fallback = site.specialty === resource ? 4 : 0;
      duties += bounded(yields?.[resource], 0, 12, fallback) * rate;
    }
    return SITE_TAX.get(site.type) * (.55 + prosperity / 100) + duties;
  }

  function holdingIncome(holdings, sites, production) {
    const income = holdings.reduce((sum, id) => {
      const site = sites.get(id);
      return site && SITE_TAX.has(site.type) ? sum + siteIncome(site, production) : sum;
    }, 0);
    return bounded(income, 0, 480, 0);
  }

  function troopCounts(retinues, available, limits) {
    const counts = retinues.map(() => 1);
    // Give each affordable escort a guard before dividing the remaining strength by role.
    for (let index = 0; index < counts.length && available > 0; index++) {
      if (limits[index] < 2) continue;
      counts[index]++;
      available--;
    }
    for (let troop = 0; troop < available; troop++) {
      let next = -1;
      let priority = -1;
      for (let index = 0; index < retinues.length; index++) {
        if (counts[index] >= limits[index]) continue;
        const candidate = ROLES.get(retinues[index].role).weight / counts[index];
        if (candidate > priority) {
          next = index;
          priority = candidate;
        }
      }
      if (next < 0) break;
      counts[next]++;
    }
    return counts;
  }

  function retinueTargets(retinues, income, treasury) {
    const available = Math.min(MAX_HOUSE_TROOPS, Math.floor((income + treasury / 18) / UPKEEP_PER_TROOP));
    const caps = retinues.map(retinue => ROLES.get(retinue.role).troopCap + 1);
    return troopCounts(retinues, available, caps);
  }

  function troopUpkeep(retinues) {
    return retinues.reduce((sum, retinue) => sum + (retinue.strength - 1) * UPKEEP_PER_TROOP, 0);
  }

  function createHouse(houseId, holdings, income, retinues, saved) {
    const treasury = bounded(saved?.treasury, 0, MAX_TREASURY, Math.min(MAX_TREASURY, 75 + income * 5));
    const targets = retinueTargets(retinues, income, treasury);
    const oldStrengths = new Map((Array.isArray(saved?.retinues) ? saved.retinues : [])
      .filter(retinue => typeof retinue?.personId === 'string').map(retinue => [retinue.personId, retinue.strength]));
    const maxSaved = retinues.map(retinue => bounded(oldStrengths.get(retinue.personId), 1, ROLES.get(retinue.role).troopCap + 1, 1));
    const startingTroops = Math.floor(.78 * targets.reduce((sum, target) => sum + target - 1, 0));
    const strengths = saved ? troopCounts(retinues, MAX_HOUSE_TROOPS, maxSaved) : troopCounts(retinues, startingTroops, targets);
    const roster = retinues.map((retinue, index) => ({ ...retinue, strength: strengths[index], target: targets[index] }));
    return { houseId, treasury, holdings, income, upkeep: troopUpkeep(roster), recruitment: 0, retinues: roster };
  }

  function create(world, houses, families, saved, day, production) {
    const sites = settlementMap(world);
    const houseById = new Map();
    for (const house of Array.isArray(houses) ? houses : []) {
      if (!Number.isSafeInteger(house?.id) || houseById.has(house.id) || !sites.has(house.seatId)) continue;
      houseById.set(house.id, house);
    }
    const ordered = [...houseById.values()].sort((a, b) => a.id - b.id);
    const holdings = collectHoldings(ordered, sites);
    const byHouse = adultRetinues(families);
    const previous = new Map((Array.isArray(saved?.houses) ? saved.houses : [])
      .filter(house => Number.isSafeInteger(house?.houseId)).map(house => [house.houseId, house]));
    const currentDay = bounded(day, 1, Number.MAX_SAFE_INTEGER, 1);
    const savedDay = bounded(saved?.day, 1, currentDay, currentDay);
    const ledger = { day: savedDay, houses: ordered.map(({ id }) => {
      const locations = holdings.get(id);
      return createHouse(id, locations, holdingIncome(locations, sites, production), byHouse.get(id) || [], previous.get(id));
    }) };
    return advance(ledger, world, currentDay, production);
  }

  function collectAndPay(house, income) {
    let treasury = Math.min(MAX_TREASURY, house.treasury + income);
    const targets = retinueTargets(house.retinues, income, treasury);
    const retention = house.retinues.map((retinue, index) => Math.min(retinue.strength,
      Math.max(targets[index], retinue.strength - 1)));
    const strengths = troopCounts(house.retinues, Math.min(MAX_HOUSE_TROOPS, Math.floor(treasury / UPKEEP_PER_TROOP)), retention);
    let troopCount = strengths.reduce((sum, strength) => sum + strength - 1, 0);
    const upkeep = troopCount * UPKEEP_PER_TROOP;
    treasury -= upkeep;

    const recruitmentLimit = Math.min(MAX_DAILY_RECRUITS, Math.floor((treasury - Math.min(90, upkeep * 2)) / RECRUIT_COST));
    let recruitment = 0;
    for (let i = 0; i < recruitmentLimit && troopCount < MAX_HOUSE_TROOPS; i++) {
      let next = -1;
      let greatestShortage = 0;
      for (let index = 0; index < strengths.length; index++) {
        const shortage = 1 - strengths[index] / targets[index];
        if (shortage > greatestShortage) {
          greatestShortage = shortage;
          next = index;
        }
      }
      if (next < 0) break;
      strengths[next]++;
      troopCount++;
      recruitment += RECRUIT_COST;
    }
    const retinues = house.retinues.map((retinue, index) => ({ ...retinue, strength: strengths[index], target: targets[index] }));
    return { ...house, treasury: treasury - recruitment, income, upkeep, recruitment, retinues };
  }

  function advance(ledger, world, day, production) {
    const currentDay = bounded(day, 1, Number.MAX_SAFE_INTEGER, ledger.day);
    const elapsed = Math.min(MAX_CATCHUP_DAYS, currentDay - ledger.day);
    if (elapsed <= 0) return ledger;
    const sites = settlementMap(world);
    const houses = ledger.houses.map(house => {
      const income = holdingIncome(house.holdings, sites, production);
      let next = house;
      for (let tick = 0; tick < elapsed; tick++) next = collectAndPay(next, income);
      return next;
    });
    return { day: currentDay, houses };
  }

  function retinueIndex(ledger) {
    let index = ledgerIndexes.get(ledger);
    if (index) return index;
    index = new Map();
    ledger.houses.forEach((house, houseIndex) => {
      house.retinues.forEach((retinue, retinueIndex) => index.set(retinue.personId, [houseIndex, retinueIndex]));
    });
    ledgerIndexes.set(ledger, index);
    return index;
  }

  function strength(ledger, personId) {
    const position = ledger && retinueIndex(ledger).get(personId);
    if (!position) return 0;
    const [houseIndex, unitIndex] = position;
    return ledger.houses[houseIndex].retinues[unitIndex].strength;
  }

  function setStrength(ledger, personId, remaining) {
    if (!ledger) return ledger;
    const index = retinueIndex(ledger);
    const position = index.get(personId);
    if (!position) return ledger;
    const [houseIndex, unitIndex] = position;
    const house = ledger.houses[houseIndex];
    const retinue = house.retinues[unitIndex];
    const nextStrength = bounded(remaining, 1, retinue.strength, retinue.strength);
    if (nextStrength === retinue.strength) return ledger;
    const retinues = house.retinues.slice();
    retinues[unitIndex] = { ...retinue, strength: nextStrength };
    const houses = ledger.houses.slice();
    houses[houseIndex] = { ...house, retinues };
    const next = { ...ledger, houses };
    ledgerIndexes.set(next, index);
    return next;
  }

  function snapshot(ledger) {
    return {
      day: ledger.day,
      houses: ledger.houses.map(({ houseId, treasury, retinues }) => ({
        houseId, treasury, retinues: retinues.map(({ personId, strength }) => ({ personId, strength }))
      }))
    };
  }

  window.UANobleHouses = { create, advance, strength, setStrength, snapshot };
}());
