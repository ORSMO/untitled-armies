(function () {
  'use strict';

  const CAPACITY = 12;
  const BATTLE_LIMIT = 50;
  const HISTORY_LIMIT = 64;
  const ROLE_PREMIUM = new Map([
    ['infantry', 0], ['archer', 3], ['cavalry', 8], ['horseArcher', 6]
  ]);
  const RANSOM = [18, 25, 35];
  const BOUNTY = [12, 17, 22];

  function validFaction(faction) {
    return Number.isInteger(faction) && faction >= 0 && faction < 10;
  }

  function validBattleId(id) {
    return typeof id === 'string' && /^[A-Za-z0-9:_-]{1,96}$/.test(id);
  }

  function normalizeGroup(group) {
    if (!group || !Number.isSafeInteger(group.count) || group.count < 1) return null;
    if (group.kind !== 'outlaw' && group.kind !== 'soldier') return null;
    if (group.kind === 'soldier' && !validFaction(group.faction)) return null;
    const faction = group.kind === 'outlaw' ? -1 : group.faction;
    const tier = Number.isInteger(group.tier) && group.tier >= 0 && group.tier < RANSOM.length ? group.tier : 0;
    const role = ROLE_PREMIUM.has(group.role) ? group.role : 'infantry';
    const id = `${group.kind}:${faction}:${tier}:${role}`;
    return { id, kind: group.kind, faction, tier, role, count: group.count };
  }

  function normalize(raw) {
    const incomingGroups = Array.isArray(raw) ? raw : raw?.groups;
    const groups = new Map();
    let space = CAPACITY;
    for (const entry of Array.isArray(incomingGroups) ? incomingGroups : []) {
      const group = normalizeGroup(entry);
      if (!group) continue;
      const count = Math.min(group.count, space);
      const existing = groups.get(group.id);
      if (existing) existing.count += count;
      else groups.set(group.id, { ...group, count });
      space -= count;
      if (space === 0) break;
    }
    const battleIds = Array.isArray(raw?.battleIds)
      ? [...new Set(raw.battleIds.filter(validBattleId))].slice(-HISTORY_LIMIT)
      : [];
    return { groups: [...groups.values()], battleIds };
  }

  function total(groups) {
    return groups.reduce((sum, group) => sum + group.count, 0);
  }

  function count(raw) {
    return total(normalize(raw).groups);
  }

  function surrenderGroups(result) {
    const enemyInitial = Number.isSafeInteger(result.enemyInitial) && result.enemyInitial >= 0
      ? Math.min(result.enemyInitial, BATTLE_LIMIT) : BATTLE_LIMIT;
    const reportedCount = Number.isSafeInteger(result.enemySurrendered) && result.enemySurrendered >= 0
      ? Math.min(result.enemySurrendered, enemyInitial) : null;
    const limit = reportedCount ?? enemyInitial;
    if (!limit) return [];

    const groups = [];
    const slots = new Set();
    if (Array.isArray(result.enemyCaptives)) {
      for (const captive of result.enemyCaptives) {
        const slot = captive?.slot;
        if (!Number.isInteger(slot) || slot < 0 || slot >= enemyInitial || slots.has(slot)) continue;
        groups.push({ tier: captive.tier, role: captive.role, count: 1 });
        slots.add(slot);
        if (slots.size === limit) break;
      }
    }
    if (groups.length) return groups;

    let remaining = limit;
    if (Array.isArray(result.enemySurrenderedGroups)) {
      for (const group of result.enemySurrenderedGroups) {
        if (!Number.isSafeInteger(group?.count) || group.count < 1) continue;
        const count = Math.min(remaining, group.count);
        groups.push({ tier: group.tier, role: group.role, count });
        remaining -= count;
        if (!remaining) break;
      }
    }
    if (groups.length) return groups;
    return reportedCount ? [{ count: reportedCount }] : [];
  }

  function capture(raw, result, party) {
    const state = normalize(raw);
    const empty = { state, captured: 0, overflow: 0 };
    if (result?.winner !== 'friend' || !validBattleId(result.sessionId) || state.battleIds.includes(result.sessionId)) return empty;
    if (Number.isInteger(result.partyId) && Number.isInteger(party?.id) && result.partyId !== party.id) return empty;
    const sourceKind = party?.kind ?? result.kind;
    const kind = sourceKind === 'bandit' ? 'outlaw' : 'soldier';
    const faction = kind === 'outlaw' ? -1 : (party?.faction ?? result.faction);
    if (kind === 'soldier' && (!['patrol', 'caravan'].includes(sourceKind) || !validFaction(faction))) return empty;
    const additions = surrenderGroups(result).map(group => ({ ...group, kind, faction }));
    if (!additions.length) return empty;

    const after = normalize({
      groups: [...state.groups, ...additions],
      battleIds: [...state.battleIds, result.sessionId]
    });
    const captured = total(after.groups) - total(state.groups);
    return { state: after, captured, overflow: total(additions) - captured };
  }

  function unavailable(reason) {
    return { ok: false, reason, group: null, quantity: 0, expectedCount: 0, unitGold: 0, gold: 0, standingFaction: null, standing: 0 };
  }

  function quoteState(state, action, groupId, quantity, site) {
    const group = state.groups.find(entry => entry.id === groupId);
    if (!group || !Number.isInteger(quantity) || quantity < 1 || quantity > group.count) {
      return unavailable('That many prisoners are no longer available.');
    }

    const localFaction = validFaction(site?.faction) ? site.faction : null;
    const town = site?.type === 'town' || site?.type === 'capital';
    const hasGarrison = Number.isFinite(site?.garrison) && site.garrison > 0;
    const premium = ROLE_PREMIUM.get(group.role);
    let unitGold = 0;
    let standingFaction = null;
    let standing = 0;

    switch (action) {
      case 'ransom':
        if (group.kind !== 'soldier' || !town) return unavailable('Realm soldiers can be ransomed in a town or capital.');
        unitGold = RANSOM[group.tier] + premium;
        break;
      case 'handoff':
        if (group.kind !== 'outlaw' || (!town && site?.type !== 'castle') || localFaction === null || !hasGarrison) {
          return unavailable('Wanted outlaws can be turned in at a town, capital, or castle with a garrison.');
        }
        unitGold = BOUNTY[group.tier] + Math.floor(premium / 2);
        standingFaction = localFaction;
        standing = quantity;
        break;
      case 'release':
        standingFaction = group.kind === 'soldier' ? group.faction : localFaction;
        standing = group.kind === 'soldier' ? quantity : (localFaction === null ? 0 : -quantity);
        break;
      default:
        return unavailable('Choose a prisoner action.');
    }

    return { ok: true, reason: '', group, quantity, expectedCount: group.count, unitGold, gold: unitGold * quantity, standingFaction, standing };
  }

  function quote(raw, action, groupId, quantity, site) {
    return quoteState(normalize(raw), action, groupId, quantity, site);
  }

  function apply(raw, action, groupId, quantity, site, expectedCount) {
    const state = normalize(raw);
    const offer = quoteState(state, action, groupId, quantity, site);
    if (!offer.ok) return { ...offer, state };
    if (expectedCount !== undefined && expectedCount !== offer.expectedCount) {
      return { ...unavailable('The prisoner group changed. Review the current offer.'), state };
    }
    const groups = state.groups.map(group => group.id === groupId
      ? { ...group, count: group.count - quantity } : group);
    return { ...offer, state: { ...state, groups: groups.filter(group => group.count > 0) } };
  }

  window.UAPrisoners = { CAPACITY, normalize, count, capture, quote, apply };
}());
