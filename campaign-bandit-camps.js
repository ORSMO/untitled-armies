(function () {
  'use strict';

  const FIRST_DYNAMIC_ID = 10000;
  const STARTING_CAMPS = 5;
  const MAX_CAMPS = 7;
  const MAX_ACTIVE_BANDS = MAX_CAMPS * 7;
  const BAND_RECOVERY_DAYS = 2;
  const CAMP_REPLACEMENT_DAYS = 6;
  const MAX_GOLD = 100000;
  const MAX_GOODS = 12000;
  const MAX_RECEIPTS = 48;
  const MAX_CLEARED_HISTORY = 14;
  const LEVELS = [
    { threshold: 0, strength: [6, 10], raidRadius: 670, defenders: 10 },
    { threshold: 100, strength: [8, 14], raidRadius: 850, defenders: 15 },
    { threshold: 260, strength: [11, 19], raidRadius: 1030, defenders: 21 },
    { threshold: 520, strength: [15, 24], raidRadius: 1250, defenders: 28 },
    { threshold: 900, strength: [19, 30], raidRadius: 1500, defenders: 36 }
  ];
  const GOODS_VALUE = { grain: 6, food: 4, timber: 8, iron: 14, tools: 16, salt: 9 };
  const NAMES = {
    woodland: ['Brambleveil Camp', 'Ashneedle Den', 'Yewshade Camp', 'Hollowbough Camp', 'Fernhook Den'],
    roadside: ['Broken Mile Camp', 'Bridgeworn Hideout', 'Last Toll Camp', 'Crooked Spur Camp', 'Wayside Jackals'],
    ridge: ['Riven Crag Den', 'Fellstone Camp', 'Slatefang Hideout', 'High Scar Camp', 'Goatstep Camp'],
    marsh: ['Drowned Reeds Camp', 'Bog Lantern Den', 'Siltwater Camp', 'Mirewake Hideout', 'Fenrat Camp'],
    steppe: ['Dustantler Camp', 'Redgrass Hideout', 'Windscar Camp', 'Dry Hoof Camp', 'Cloudbreak Den']
  };
  const LEGACY_NAMES = new Set(['Larkwood Camp', 'Fallen Banner Camp', 'Three Oaks Camp']);
  const WOODS = new Set(['forest', 'taiga', 'rainforest']);
  const RIDGE = new Set(['hills', 'mountain', 'snow']);
  const EXCLUDED = new Set(['sea', 'river', 'mountain', 'snow']);
  const EDGES = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const siteCache = new WeakMap();

  function integer(value, minimum, maximum, fallback = minimum) {
    return Number.isSafeInteger(value) ? Math.max(minimum, Math.min(maximum, value)) : fallback;
  }

  function dayNumber(day) {
    return integer(day, 1, Number.MAX_SAFE_INTEGER - CAMP_REPLACEMENT_DAYS);
  }

  function validId(id) {
    return Number.isSafeInteger(id) && id >= 0 && id < Number.MAX_SAFE_INTEGER;
  }

  function identity(seed) {
    return (typeof seed === 'string' && seed.length ? seed.slice(0, 128) : 'asterra-outlaws');
  }

  function seedNumber(seed) {
    let value = 0x811c9dc5;
    for (let i = 0; i < seed.length; i++) value = Math.imul(value ^ seed.charCodeAt(i), 0x01000193);
    return value;
  }

  function chance(a, b, seed) {
    let value = Math.imul(a + 1, 0x45d9f3b) ^ Math.imul(b + 1, 0x119de1f3) ^ seed;
    value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
    return ((value ^ (value >>> 13)) >>> 0) / 0x100000000;
  }

  function distanceSquared(a, b) {
    return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  }

  function terrainType(world, x, y) {
    const tile = world.tileAt(x, y);
    const kind = tile?.kind;
    if (WOODS.has(kind)) return 'woodland';
    if (RIDGE.has(kind)) return 'ridge';
    if (kind === 'marsh' || EDGES.some(([dx, dy]) => world.tileAt(x + dx * world.TILE, y + dy * world.TILE)?.kind === 'marsh')) return 'marsh';
    if (kind === 'steppe' || kind === 'desert') return 'steppe';
    return 'roadside';
  }

  function passable(world, x, y) {
    return Number.isFinite(x) && Number.isFinite(y) && x > 0 && y > 0 && x < world.WIDTH && y < world.HEIGHT &&
      (world.isPassable ? world.isPassable(x, y) : world.tileAt(x, y)?.walk);
  }

  function normalizeGoods(raw) {
    return Object.fromEntries(Object.keys(GOODS_VALUE).flatMap(resource => {
      const value = integer(raw?.[resource], 0, MAX_GOODS);
      return value ? [[resource, value]] : [];
    }));
  }

  function growth(gold, goods) {
    return gold + Object.entries(goods).reduce((sum, [resource, quantity]) => sum + quantity * GOODS_VALUE[resource], 0);
  }

  function levelFor(progress) {
    return LEVELS.reduce((level, stage, index) => progress >= stage.threshold ? index + 1 : level, 1);
  }

  function validReceipt(receipt) {
    return typeof receipt === 'string' && /^[A-Za-z0-9_.:-]{1,100}$/.test(receipt);
  }

  function normalizeCamp(raw, world, day) {
    if (!validId(raw?.id) || !passable(world, raw.x, raw.y)) return null;
    const clearedDay = Number.isSafeInteger(raw.clearedDay) ? integer(raw.clearedDay, 1, day) : null;
    const gold = clearedDay === null ? integer(raw.gold, 0, MAX_GOLD) : 0;
    const goods = clearedDay === null ? normalizeGoods(raw.goods) : {};
    const level = clearedDay === null ? levelFor(growth(gold, goods)) : integer(raw.level, 1, LEVELS.length);
    const type = Object.hasOwn(NAMES, raw.type) ? raw.type : terrainType(world, raw.x, raw.y);
    const region = world.tileAt(raw.x, raw.y)?.owner;
    const names = NAMES[type];
    const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 48) : names[raw.id % names.length];
    const landmark = world.landmarks?.find(place => place.id === raw.landmarkId && LEGACY_NAMES.has(place.name));
    const bandIds = clearedDay === null && Array.isArray(raw.bandIds) ? [...new Set(raw.bandIds.filter(validId))].slice(0, level + 2) : [];
    const receipts = clearedDay === null && Array.isArray(raw.receipts) ? [...new Set(raw.receipts.filter(validReceipt))].slice(-MAX_RECEIPTS) : [];
    return {
      id: raw.id, landmarkId: landmark?.id ?? null, name, x: raw.x, y: raw.y,
      region: Number.isInteger(region) ? region : -1, type, level, gold, goods, bandIds, receipts,
      createdDay: integer(raw.createdDay, 1, day, day), nextBandDay: integer(raw.nextBandDay, 1, day + BAND_RECOVERY_DAYS + 2, day),
      clearedDay, replaceDay: clearedDay === null || raw.replaceDay === null ? null
        : integer(raw.replaceDay, clearedDay, day + CAMP_REPLACEMENT_DAYS, clearedDay + CAMP_REPLACEMENT_DAYS)
    };
  }

  function history(camps) {
    const retired = camps.filter(camp => camp.clearedDay !== null && camp.replaceDay === null);
    const expired = new Set(retired.slice(0, Math.max(0, retired.length - MAX_CLEARED_HISTORY)).map(camp => camp.id));
    return expired.size ? camps.filter(camp => !expired.has(camp.id)) : camps;
  }

  function normalize(raw, world, currentDay) {
    const day = dayNumber(currentDay);
    const camps = [];
    const campIds = new Set();
    const bandIds = new Set();
    let occupied = 0;
    for (const entry of Array.isArray(raw?.camps) ? raw.camps : []) {
      const camp = normalizeCamp(entry, world, day);
      if (!camp || campIds.has(camp.id)) continue;
      if (camp.clearedDay === null || camp.replaceDay !== null) {
        if (occupied >= MAX_CAMPS) continue;
        occupied++;
      }
      camp.bandIds = camp.bandIds.filter(id => {
        if (bandIds.size >= MAX_ACTIVE_BANDS || bandIds.has(id)) return false;
        bandIds.add(id);
        return true;
      });
      campIds.add(camp.id);
      camps.push(camp);
    }
    const minimumId = camps.reduce((id, camp) => Math.max(id, camp.id + 1), FIRST_DYNAMIC_ID);
    return { seed: identity(raw?.seed), nextId: Math.max(minimumId, integer(raw?.nextId, FIRST_DYNAMIC_ID, Number.MAX_SAFE_INTEGER)), camps: history(camps) };
  }

  function roadDistances(world, cols, rows) {
    const distances = new Uint16Array(cols * rows);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      distances[i] = world.roads?.[i] ? 0 : Math.min(x ? distances[i - 1] + 1 : 1000, y ? distances[i - cols] + 1 : 1000);
    }
    for (let y = rows - 1; y >= 0; y--) for (let x = cols - 1; x >= 0; x--) {
      const i = y * cols + x;
      distances[i] = Math.min(distances[i], x + 1 < cols ? distances[i + 1] + 1 : 1000, y + 1 < rows ? distances[i + cols] + 1 : 1000);
    }
    return distances;
  }

  function candidateSites(world) {
    const cached = siteCache.get(world);
    if (cached) return cached;
    const { TILE } = world;
    const cols = Math.ceil(world.WIDTH / TILE);
    const rows = Math.ceil(world.HEIGHT / TILE);
    const roads = roadDistances(world, cols, rows);
    const sites = [];
    for (let ty = 3; ty < rows - 3; ty++) for (let tx = 3; tx < cols - 3; tx++) {
      const i = ty * cols + tx;
      if ((tx + ty) % 3 !== 0) continue;
      const x = (tx + .5) * TILE;
      const y = (ty + .5) * TILE;
      const tile = world.tileAt(x, y);
      if (tile?.owner < 0 || EXCLUDED.has(tile?.kind) || !passable(world, x, y)) continue;
      const road = roads[i] * TILE;
      if (road < TILE || road > 780) continue;
      const point = { x, y };
      if (world.landmarks?.some(place => distanceSquared(point, place) < 220 ** 2)) continue;
      let nearestSite = null;
      let nearestDistance = Infinity, villageDistance = Infinity;
      for (const settlement of world.settlements || []) {
        const distance = distanceSquared(point, settlement);
        if (settlement.type === 'village') villageDistance = Math.min(villageDistance, distance);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestSite = settlement;
        }
      }
      if (nearestDistance < 280 ** 2 || nearestDistance > 1450 ** 2) continue;
      sites.push({ x, y, tx, ty, region: tile.owner, type: terrainType(world, x, y), road, nearestSite, villageGap: Math.sqrt(villageDistance), settlementGap: Math.sqrt(nearestDistance) });
    }
    siteCache.set(world, sites);
    return sites;
  }

  function freshCamp(site, id, day, seeded, usedNames) {
    const names = NAMES[site.type];
    const first = Math.floor(chance(site.tx, site.ty, seeded ^ id) * names.length);
    let name = names[first];
    for (let i = 1; i < names.length && usedNames.has(name); i++) name = names[(first + i) % names.length];
    if (usedNames.has(name)) name = `${name} ${id - FIRST_DYNAMIC_ID + 1}`;
    return {
      id, landmarkId: null, name, x: site.x, y: site.y, region: site.region, type: site.type,
      level: 1, gold: 0, goods: {}, bandIds: [], receipts: [], createdDay: day, nextBandDay: day, clearedDay: null, replaceDay: null
    };
  }

  function placeCamp(state, world, day, origin) {
    if (!validId(state.nextId)) return null;
    const live = state.camps.filter(camp => camp.clearedDay === null);
    const avoided = state.camps.filter(camp => camp.clearedDay === null || camp.clearedDay >= day - 18);
    const typeCounts = new Map();
    const regionCounts = new Map();
    for (const camp of live) {
      typeCounts.set(camp.type, (typeCounts.get(camp.type) || 0) + 1);
      regionCounts.set(camp.region, (regionCounts.get(camp.region) || 0) + 1);
    }
    const ranked = [];
    const seeded = seedNumber(state.seed) ^ Math.imul(state.nextId + day, 0x27d4eb2d);
    for (const site of candidateSites(world)) {
      let distance = Infinity;
      for (const camp of avoided) distance = Math.min(distance, distanceSquared(site, camp));
      if (distance < 1050 ** 2) continue;
      const score = Math.min(2.1, Math.sqrt(distance) / 1350) + (typeCounts.has(site.type) ? 2.1 / (1 + typeCounts.get(site.type)) : 4.9) +
        1.2 / (1 + (regionCounts.get(site.region) || 0)) + chance(site.tx, site.ty, seeded) * 1.45 +
        (origin === site.region ? 1.6 : 0) + Math.max(0, 1.6 - site.villageGap / 420) - Math.abs(site.road - 245) / 520 - Math.abs(site.settlementGap - 590) / 1400;
      ranked.push({ site, score });
    }
    ranked.sort((a, b) => b.score - a.score);
    const usedNames = new Set(state.camps.map(camp => camp.name));
    for (const { site } of ranked.slice(0, 24)) {
      const anchor = site.nearestSite;
      const path = world.findPath?.(site.x, site.y, anchor.x, anchor.y);
      if (world.findPath && (!path?.length || distanceSquared(path[path.length - 1], anchor) > 100 ** 2)) continue;
      return freshCamp(site, state.nextId, day, seeded, usedNames);
    }
    return null;
  }

  function create(world, { seed, day: currentDay, origin, saved } = {}) {
    const day = dayNumber(currentDay);
    if (Array.isArray(saved?.camps)) return normalize(saved, world, day);
    const legacy = (world.landmarks || []).filter(place => LEGACY_NAMES.has(place.name) && saved?.[place.id]);
    let state = normalize({ seed, camps: legacy.map(place => {
      const old = saved[place.id];
      return { ...place, landmarkId: place.id, bandIds: validId(old.partyId) && old.partyId >= 68 ? [old.partyId] : [], nextBandDay: old.nextDay, createdDay: day };
    }) }, world, day);
    while (state.camps.length < STARTING_CAMPS) {
      const camp = placeCamp(state, world, day, state.camps.length === 0 ? origin : null);
      if (!camp) break;
      state = { ...state, nextId: camp.id + 1, camps: [...state.camps, camp] };
    }
    return state;
  }

  function advance(state, world, { day: currentDay, activePartyIds, allowPlacement = true } = {}) {
    const day = dayNumber(currentDay);
    const activeIds = Array.isArray(activePartyIds) ? new Set(activePartyIds) : activePartyIds;
    let changed = false;
    let camps = state.camps.map(camp => {
      if (camp.clearedDay !== null || !activeIds) return camp;
      const bandIds = camp.bandIds.filter(id => activeIds.has(id));
      if (bandIds.length === camp.bandIds.length) return camp;
      changed = true;
      return { ...camp, bandIds, nextBandDay: Math.max(camp.nextBandDay, day + BAND_RECOVERY_DAYS) };
    });
    let nextId = state.nextId;
    if (allowPlacement) {
      const target = STARTING_CAMPS + Number(day >= 12) + Number(day >= 24);
      let held = camps.filter(camp => camp.clearedDay === null || (camp.replaceDay !== null && camp.replaceDay > day)).length;
      while (held < target) {
        const camp = placeCamp({ ...state, camps, nextId }, world, day, null);
        if (!camp) break;
        const replaced = camps.findIndex(old => old.replaceDay !== null && old.replaceDay <= day);
        if (replaced >= 0) camps[replaced] = { ...camps[replaced], replaceDay: null };
        camps.push(camp);
        nextId = camp.id + 1;
        changed = true;
        held++;
      }
    }
    return changed ? { ...state, nextId, camps: history(camps) } : state;
  }

  function lookup(state, campId) {
    return state?.camps.find(camp => camp.id === campId && camp.clearedDay === null) ?? null;
  }

  function byLandmark(state, placeId) {
    if (!validId(placeId)) return null;
    return state?.camps.find(camp => camp.clearedDay === null && (camp.id === placeId || camp.landmarkId === placeId)) ?? null;
  }

  function forParty(state, partyId) {
    return state?.camps.find(camp => camp.clearedDay === null && camp.bandIds.includes(partyId)) ?? null;
  }

  function quote(state, campId, { day: currentDay, totalBands = 0 } = {}) {
    const camp = lookup(state, campId);
    if (!camp) return { ok: false, reason: 'That camp has been cleared.', vacancies: 0 };
    const day = dayNumber(currentDay);
    const { threshold, strength, raidRadius, defenders } = LEVELS[camp.level - 1];
    const maxBands = camp.level + 2;
    const freeSlots = Math.max(0, Math.min(maxBands - camp.bandIds.length, MAX_ACTIVE_BANDS - integer(totalBands, 0, MAX_ACTIVE_BANDS)));
    const vacancies = camp.nextBandDay <= day ? freeSlots : 0;
    const reason = vacancies ? '' : (camp.nextBandDay > day ? `Raiders regroup until day ${camp.nextBandDay}.` : 'The camp has all the bands it can send.');
    return {
      ok: vacancies > 0, reason, level: camp.level, maxBands, minStrength: strength[0], maxStrength: strength[1],
      raidRadius, defenders, vacancies, progress: growth(camp.gold, camp.goods), threshold, nextThreshold: LEVELS[camp.level]?.threshold ?? null
    };
  }

  function updateCamp(state, next) {
    return { ...state, camps: state.camps.map(camp => camp.id === next.id ? next : camp) };
  }

  function attachBand(state, campId, partyId, context) {
    if (!validId(partyId) || forParty(state, partyId) || !quote(state, campId, context).ok) return state;
    const camp = lookup(state, campId);
    return updateCamp(state, { ...camp, bandIds: [...camp.bandIds, partyId] });
  }

  function credit(state, campId, { partyId, receipt, gold: rawGold, goods: rawGoods } = {}) {
    const camp = lookup(state, campId);
    const empty = { state, ok: false, levelUp: false, gold: 0, goods: {} };
    if (!camp?.bandIds.includes(partyId) || !validReceipt(receipt) || camp.receipts.includes(receipt)) return empty;
    const gold = Math.min(MAX_GOLD - camp.gold, integer(rawGold, 0, MAX_GOLD));
    const goods = {};
    const cargo = { ...camp.goods };
    for (const [resource, amount] of Object.entries(normalizeGoods(rawGoods))) {
      const stored = cargo[resource] || 0;
      const accepted = Math.min(amount, MAX_GOODS - stored);
      if (!accepted) continue;
      goods[resource] = accepted;
      cargo[resource] = stored + accepted;
    }
    if (gold === 0 && Object.keys(goods).length === 0) return empty;
    const level = levelFor(growth(camp.gold + gold, cargo));
    const next = { ...camp, gold: camp.gold + gold, goods: cargo, level, receipts: [...camp.receipts, receipt].slice(-MAX_RECEIPTS) };
    return { state: updateCamp(state, next), ok: true, levelUp: level > camp.level, gold, goods };
  }

  function clear(state, campId, currentDay) {
    const camp = lookup(state, campId);
    if (!camp) return { state, ok: false, bandIds: [], gold: 0, goods: {} };
    const day = dayNumber(currentDay);
    const next = {
      ...camp, gold: 0, goods: {}, bandIds: [], receipts: [], clearedDay: day, replaceDay: day + CAMP_REPLACEMENT_DAYS
    };
    return { state: updateCamp(state, next), ok: true, bandIds: camp.bandIds.slice(), gold: camp.gold, goods: { ...camp.goods } };
  }

  window.UABanditCamps = { MAX_ACTIVE_BANDS, create, normalize, advance, lookup, byLandmark, forParty, quote, attachBand, credit, clear };
}());
