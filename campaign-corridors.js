(function () {
  'use strict';

  const PILOT = Object.freeze({ castleId: 51, townId: 49, villageId: 52, faction: 6 });
  const GENERATED_PARTY_COUNT = 68;
  const MIN_GUARD_PATROL = 8;
  const MAX_GUARD_PATROL = 18;
  const CASTLE_GUARD_RESERVE = 80;
  const CASTLE_GRAIN_RESERVE = 6;
  const GUARDS_PER_GRAIN = 4;
  const MIN_SHIPMENT = 6;
  const MAX_SHIPMENT = 12;
  const VILLAGE_GRAIN_RESERVE = 8;
  const MAX_COOLDOWN = 3;

  function integer(value, min, max, fallback = min) {
    return Number.isSafeInteger(value) ? Math.max(min, Math.min(max, value)) : fallback;
  }

  function dayNumber(day) {
    return integer(day, 1, Number.MAX_SAFE_INTEGER - MAX_COOLDOWN);
  }

  function validPartyId(id) {
    return Number.isSafeInteger(id) && id >= GENERATED_PARTY_COUNT && id < Number.MAX_SAFE_INTEGER;
  }

  function normalizePatrol(raw, day) {
    if (!validPartyId(raw?.partyId) || !['outbound', 'return'].includes(raw.stage) ||
        !Number.isSafeInteger(raw.quantity) || raw.quantity < MIN_GUARD_PATROL || raw.quantity > MAX_GUARD_PATROL) return null;
    return { partyId: raw.partyId, stage: raw.stage, quantity: raw.quantity, launchedDay: integer(raw.launchedDay, 1, day, day) };
  }

  function normalizeShipment(raw, day) {
    if (!validPartyId(raw?.partyId) || !Number.isSafeInteger(raw.quantity) ||
        raw.quantity < MIN_SHIPMENT || raw.quantity > MAX_SHIPMENT) return null;
    return { partyId: raw.partyId, quantity: raw.quantity, launchedDay: integer(raw.launchedDay, 1, day, day) };
  }

  function normalizeOutcome(raw, day, events, maxQuantity) {
    if (!validPartyId(raw?.partyId) || !events.includes(raw.event)) return null;
    const quantity = integer(raw.quantity, 0, maxQuantity);
    return {
      partyId: raw.partyId, event: raw.event, day: integer(raw.day, 1, day, day),
      quantity, losses: integer(raw.losses, 0, maxQuantity - quantity)
    };
  }

  function normalize(raw, day) {
    const currentDay = dayNumber(day);
    const lastPatrol = normalizeOutcome(raw?.lastPatrol, currentDay, ['returned', 'defeated'], MAX_GUARD_PATROL);
    const lastShipment = normalizeOutcome(raw?.lastShipment, currentDay, ['delivered', 'raided', 'diverted'], MAX_SHIPMENT);
    const patrol = normalizePatrol(raw?.patrol, currentDay);
    const shipment = normalizeShipment(raw?.shipment, currentDay);
    return {
      patrol: patrol?.partyId > (lastPatrol?.partyId ?? 0) ? patrol : null,
      shipment: shipment?.partyId > (lastShipment?.partyId ?? 0) && shipment.partyId !== patrol?.partyId ? shipment : null,
      lastPatrol, lastShipment,
      nextPatrolDay: integer(raw?.nextPatrolDay, 1, currentDay + MAX_COOLDOWN, currentDay),
      nextShipmentDay: integer(raw?.nextShipmentDay, 1, currentDay + MAX_COOLDOWN, currentDay)
    };
  }

  function quoteState(state, kind, context) {
    if (kind !== 'patrol' && kind !== 'shipment') return { ok: false, reason: 'Unknown corridor assignment.', quantity: 0 };
    const patrol = kind === 'patrol';
    const name = patrol ? 'A patrol' : 'A grain convoy';
    if (state[kind]) return { ok: false, reason: `${name} is already on this road.`, quantity: 0 };
    const nextDay = patrol ? state.nextPatrolDay : state.nextShipmentDay;
    if (nextDay > dayNumber(context.day)) return { ok: false, reason: `${name} can depart again on day ${nextDay}.`, quantity: 0 };

    const castleGuards = integer(context.garrison, 0, Number.MAX_SAFE_INTEGER) - CASTLE_GUARD_RESERVE;
    const castleGrain = integer(context.castleGrain, 0, CASTLE_GRAIN_RESERVE + MAX_GUARD_PATROL) - CASTLE_GRAIN_RESERVE;
    const quantity = patrol
      ? Math.min(MAX_GUARD_PATROL, castleGuards, castleGrain * GUARDS_PER_GRAIN)
      : Math.min(MAX_SHIPMENT, integer(context.targetRoom, 0, MAX_SHIPMENT), integer(context.grain, 0, Number.MAX_SAFE_INTEGER) - VILLAGE_GRAIN_RESERVE);
    if (quantity < (patrol ? MIN_GUARD_PATROL : MIN_SHIPMENT)) return {
      ok: false, quantity: 0,
      reason: patrol ? (castleGuards < MIN_GUARD_PATROL
        ? `Valecrown needs at least ${CASTLE_GUARD_RESERVE + MIN_GUARD_PATROL} defenders to send a patrol.`
        : `Valecrown needs at least ${CASTLE_GRAIN_RESERVE + Math.ceil(MIN_GUARD_PATROL / GUARDS_PER_GRAIN)} grain to outfit a patrol.`)
        : `Duskford needs ${MIN_SHIPMENT} grain to spare, and Redmarsh needs room to store it.`
    };
    return { ok: true, reason: '', quantity, grainCost: patrol ? Math.ceil(quantity / GUARDS_PER_GRAIN) : quantity };
  }

  function quote(raw, kind, context = {}) {
    return quoteState(normalize(raw, context.day), kind, context);
  }

  function effects(state, fields) {
    return { state, ok: false, reason: '', party: null, garrisonDelta: 0, sourceGrainDelta: 0, targetGrainDelta: 0, ...fields };
  }

  function launch(raw, kind, context = {}) {
    const day = dayNumber(context.day);
    const state = normalize(raw, day);
    const offer = quoteState(state, kind, context);
    if (!offer.ok) return effects(state, { reason: offer.reason });
    const partyId = context.partyId;
    const previousId = Math.max(state.patrol?.partyId ?? 0, state.shipment?.partyId ?? 0,
      state.lastPatrol?.partyId ?? 0, state.lastShipment?.partyId ?? 0);
    if (!validPartyId(partyId) || partyId <= previousId) return effects(state, { reason: 'This road assignment already has a party number.' });

    const patrol = kind === 'patrol';
    const originId = patrol ? PILOT.castleId : PILOT.villageId;
    const origin = context.world?.settlements?.[originId];
    const town = context.world?.settlements?.[PILOT.townId];
    if (origin?.id !== originId || town?.id !== PILOT.townId || ![origin.x, origin.y, town.x, town.y].every(Number.isFinite)) {
      return effects(state, { reason: 'This supply road is unavailable.' });
    }

    const quantity = offer.quantity;
    const assignment = { partyId, quantity, launchedDay: day };
    const party = {
      id: partyId, kind: patrol ? 'patrol' : 'caravan', faction: PILOT.faction, active: true,
      x: origin.x, y: origin.y, tx: town.x, ty: town.y, strength: patrol ? quantity : 10,
      path: [], pathIndex: 0, targetPartyId: null,
      cargo: patrol ? null : { resource: 'grain', quantity, from: PILOT.villageId },
      tradeTargetId: patrol ? null : PILOT.townId
    };
    return effects({ ...state, [kind]: patrol ? { ...assignment, stage: 'outbound' } : assignment }, {
      ok: true, party, quantity, sourceSiteId: originId,
      garrisonDelta: patrol ? -quantity : 0, sourceGrainDelta: -offer.grainCost
    });
  }

  function mission(state, partyId) {
    if (!validPartyId(partyId)) return null;
    if (state?.patrol?.partyId === partyId) {
      const returning = state.patrol.stage === 'return';
      return {
        kind: 'patrol', stage: state.patrol.stage, quantity: state.patrol.quantity,
        originId: returning ? PILOT.townId : PILOT.castleId, destinationId: returning ? PILOT.castleId : PILOT.townId
      };
    }
    if (state?.shipment?.partyId === partyId) {
      return { kind: 'shipment', stage: 'outbound', quantity: state.shipment.quantity, originId: PILOT.villageId, destinationId: PILOT.townId };
    }
    return null;
  }

  function settle(raw, kind, context = {}) {
    const day = dayNumber(context.day);
    const state = normalize(raw, day);
    const assignment = mission(state, context.partyId);
    if (!assignment || assignment.kind !== kind) return effects(state, { reason: 'This road assignment is no longer active.' });
    const event = context.event;
    if (kind === 'patrol') {
      if (event === 'checkpoint' && assignment.stage === 'outbound') {
        return effects({ ...state, patrol: { ...state.patrol, stage: 'return' } }, { ok: true, event, quantity: 0 });
      }
      if (event !== 'defeated' && !(event === 'returned' && assignment.stage === 'return')) {
        return effects(state, { reason: 'This patrol has not reached that stage.' });
      }
      const quantity = event === 'returned' ? integer(context.remaining, 0, assignment.quantity, 0) : 0;
      const losses = assignment.quantity - quantity;
      return effects({
        ...state, patrol: null, nextPatrolDay: day + (event === 'returned' ? 2 : 3),
        lastPatrol: { partyId: context.partyId, event, day, quantity, losses }
      }, { ok: true, event, quantity, losses, garrisonDelta: quantity });
    }

    if (event !== 'delivered' && event !== 'raided') return effects(state, { reason: 'This shipment has no such outcome.' });
    const quantity = event === 'delivered' ? integer(context.targetRoom, 0, assignment.quantity, 0) : 0;
    const shipmentEvent = event === 'delivered' && quantity === 0 ? 'diverted' : event;
    const losses = assignment.quantity - quantity;
    return effects({
      ...state, shipment: null, nextShipmentDay: day + (event === 'raided' ? 2 : 1),
      lastShipment: { partyId: context.partyId, event: shipmentEvent, day, quantity, losses }
    }, { ok: true, event: shipmentEvent, quantity, losses, targetGrainDelta: quantity });
  }

  window.UACorridors = { PILOT, normalize, quote, launch, mission, settle };
}());
