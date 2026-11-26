(function () {
  'use strict';

  const RIVER = 1;
  const RIDGE = 2;
  const MAX_NEW_BRIDGES = 14;
  const MAX_NEW_PASSES = 3;
  const RIDGE_ELEVATION = .77;
  const CARDINAL = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const ADJACENT = [...CARDINAL, [1, 1], [-1, 1], [1, -1], [-1, -1]];
  const AXES = [[1, 0], [0, 1], [1, 1], [-1, 1]];

  function isRiver(tile) {
    return tile.kind === 'river' || tile.river > 0;
  }

  function isRidge(tile) {
    return tile.kind === 'mountain' || (tile.kind === 'snow' && tile.e >= RIDGE_ELEVATION);
  }

  function create({ tiles, roads, bridgePoints = [], fordCrossings = new Map(), settlements = [], TILE, COLS, ROWS }) {
    const blocked = Uint8Array.from(tiles, tile => {
      if (!tile.walk) return 0;
      if (isRiver(tile)) return RIVER;
      return isRidge(tile) ? RIDGE : 0;
    });
    const center = id => ({ x: (id % COLS + .5) * TILE, y: (Math.floor(id / COLS) + .5) * TILE });
    const pointId = ({ x, y }) => Math.floor(y / TILE) * COLS + Math.floor(x / TILE);
    const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const neighbor = (id, dx, dy) => {
      const x = id % COLS + dx, y = Math.floor(id / COLS) + dy;
      return x >= 0 && x < COLS && y >= 0 && y < ROWS ? y * COLS + x : -1;
    };
    function nearest(point, points) {
      let best = Infinity;
      for (const other of points) best = Math.min(best, distance(point, other));
      return best;
    }
    const roadRiver = new Set();
    const roadRidge = new Set();
    const roadCenters = [];
    for (let id = 0; id < tiles.length; id++) {
      if (!roads[id] || !tiles[id].walk) continue;
      roadCenters.push(center(id));
      if (blocked[id] === RIVER) roadRiver.add(id);
      if (isRidge(tiles[id])) roadRidge.add(id);
      blocked[id] = 0;
    }

    const fordPoints = [];
    for (const route of fordCrossings.values()) {
      if (!route.length) continue;
      fordPoints.push(route[Math.floor(route.length / 2)]);
      for (const point of route) blocked[pointId(point)] = 0;
    }

    function connectedGroups(indices, directions) {
      const remaining = new Set(indices);
      const groups = [];
      for (const index of indices) {
        if (!remaining.delete(index)) continue;
        const group = [index];
        for (let cursor = 0; cursor < group.length; cursor++) {
          for (const [dx, dy] of directions) {
            const next = neighbor(group[cursor], dx, dy);
            if (remaining.delete(next)) group.push(next);
          }
        }
        groups.push(group);
      }
      return groups;
    }

    function roadAngle(id) {
      const across = Number(!!roads[neighbor(id, -1, 0)]) + Number(!!roads[neighbor(id, 1, 0)]);
      const vertical = Number(!!roads[neighbor(id, 0, -1)]) + Number(!!roads[neighbor(id, 0, 1)]);
      return across >= vertical ? 0 : Math.PI / 2;
    }

    const existingBridge = new Map(bridgePoints.map(point => [pointId(point), point]));
    const bridges = connectedGroups(roadRiver, CARDINAL).map(group => {
      const id = group.find(index => existingBridge.has(index)) ?? group[0];
      const point = existingBridge.get(id);
      return { ...center(id), angle: point?.angle ?? roadAngle(id), id: 'bridge-' + id, kind: 'bridge', tiles: group };
    });

    function slopeFrom(id, dx, dy, barrier, maxSteps) {
      const chain = [];
      let next = id;
      for (let step = 0; step < maxSteps; step++) {
        next = neighbor(next, dx, dy);
        if (next < 0 || !tiles[next].walk) return null;
        const tile = tiles[next];
        if (blocked[next] === barrier) {
          chain.push(next);
          continue;
        }
        if (blocked[next] || isRiver(tile) || (barrier === RIDGE && isRidge(tile))) return null;
        return { id: next, chain };
      }
      return null;
    }

    function riverContinues(id, dx, dy) {
      // The course must continue on both sides of a bridge, even where it bends a cell off-axis.
      return [-1, 1].every(side => [-1, 0, 1].some(offset => {
        const next = neighbor(id, -dy * side + dx * offset, dx * side + dy * offset);
        return next >= 0 && tiles[next].walk && isRiver(tiles[next]);
      }));
    }

    const blockers = [...bridges, ...fordPoints];
    const candidates = [];
    for (let id = 0; id < tiles.length; id++) {
      if (blocked[id] !== RIVER || isRidge(tiles[id])) continue;
      const point = center(id);
      if (nearest(point, blockers) < TILE * 6) continue;
      const roadDistance = nearest(point, roadCenters);
      const settlementDistance = nearest(point, settlements);
      if (roadDistance > TILE * 12 && settlementDistance > TILE * 14) continue;
      for (const [dx, dy] of AXES.slice(0, 2)) {
        if (!riverContinues(id, dx, dy)) continue;
        const start = slopeFrom(id, -dx, -dy, RIVER, 3);
        const end = slopeFrom(id, dx, dy, RIVER, 3);
        if (!start || !end || start.chain.length + end.chain.length > 2) continue;
        const wetted = [...start.chain.reverse(), id, ...end.chain];
        const score = Math.min(roadDistance, settlementDistance) + wetted.length * TILE * 1.5;
        candidates.push({
          ...point, id: 'bridge-' + id, kind: 'bridge', angle: dx ? 0 : Math.PI / 2,
          tiles: wetted, banks: [start.id, end.id], score
        });
      }
    }
    candidates.sort((a, b) => a.score - b.score);
    const additions = [];
    for (const candidate of candidates) {
      if (additions.length >= MAX_NEW_BRIDGES) break;
      if (nearest(candidate, additions) < TILE * 9 || candidate.tiles.some(id => blocked[id] !== RIVER)) continue;
      const { score, ...bridge } = candidate;
      for (const id of bridge.tiles) blocked[id] = 0;
      additions.push(bridge);
    }

    const passName = point => {
      const settlement = settlements.reduce((best, site) =>
        !best || distance(point, site) < distance(point, best) ? site : best, null);
      return settlement ? settlement.name + ' Pass' : 'Mountain Pass';
    };
    const passPoints = connectedGroups(roadRidge, ADJACENT).map(group => {
      const id = group.reduce((best, index) => tiles[index].e > tiles[best].e ? index : best);
      const point = center(id);
      const first = center(group[0]), last = center(group.at(-1));
      return {
        ...point, id: 'pass-' + id, kind: 'pass', tiles: group,
        angle: group.length > 1 ? Math.atan2(last.y - first.y, last.x - first.x) : roadAngle(id),
        name: passName(point)
      };
    });

    function shoulderHeight(id, dx, dy) {
      let peak = 0;
      for (let step = 1; step <= 9; step++) {
        const next = neighbor(id, dx * step, dy * step);
        if (next < 0 || !tiles[next].walk || isRiver(tiles[next])) break;
        peak = Math.max(peak, tiles[next].e);
      }
      return peak;
    }

    function cardinalPass(chain, dx, dy) {
      if (!dx || !dy) return chain;
      // Turn each diagonal at the lower viable shoulder so the pass stays walkable with corner cutting off.
      const route = [chain[0]];
      for (let i = 1; i < chain.length; i++) {
        const previous = chain[i - 1];
        const corners = [neighbor(previous, dx, 0), neighbor(previous, 0, dy)]
          .filter(index => tiles[index]?.walk && !isRiver(tiles[index]));
        if (!corners.length) return null;
        corners.sort((a, b) => tiles[a].e - tiles[b].e);
        route.push(corners[0], chain[i]);
      }
      return route;
    }

    const saddles = [];
    for (let id = 0; id < tiles.length; id++) {
      if (blocked[id] !== RIDGE) continue;
      const point = center(id);
      if (nearest(point, passPoints) < TILE * 12 || nearest(point, settlements) < TILE * 5) continue;
      for (const [dx, dy] of AXES) {
        const start = slopeFrom(id, -dx, -dy, RIDGE, 10);
        const end = slopeFrom(id, dx, dy, RIDGE, 10);
        if (!start || !end || start.chain.length + end.chain.length > 7) continue;
        const chain = [...start.chain.reverse(), id, ...end.chain];
        if (chain.some(index => tiles[index].e > tiles[id].e)) continue;
        const route = cardinalPass([start.id, ...chain, end.id], dx, dy);
        if (!route) continue;
        const crest = Math.max(...route.map(index => tiles[index].e));
        const shoulders = Math.min(shoulderHeight(id, -dy, dx), shoulderHeight(id, dy, -dx));
        const ridge = route.filter(index => blocked[index] === RIDGE);
        if (ridge.length > 10 || shoulders < crest + .006) continue;
        saddles.push({
          ...point, id: 'pass-' + id, kind: 'pass', angle: Math.atan2(dy, dx), name: passName(point),
          tiles: ridge, banks: [start.id, end.id], route, score: crest - shoulders + ridge.length * .003
        });
      }
    }
    saddles.sort((a, b) => a.score - b.score);
    let addedPasses = 0;
    for (const candidate of saddles) {
      if (addedPasses >= MAX_NEW_PASSES) break;
      if (nearest(candidate, passPoints) < TILE * 12 || passPoints.some(pass => pass.name === candidate.name)) continue;
      const { score, ...pass } = candidate;
      for (const id of pass.tiles) blocked[id] = 0;
      passPoints.push(pass);
      addedPasses++;
    }

    return { blocked, bridgePoints: [...bridges, ...additions], passPoints };
  }

  window.UAWorldCrossings = { create };
})();
