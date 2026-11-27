(function () {
  'use strict';

  const EPSILON = 1e-6;
  const NEIGHBORS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  const MOVEMENT = {
    infantry: { clearance: 10, forest: .38, mud: 1.05, water: 2.9, slope: 1.45 },
    archer: { clearance: 10, forest: .4, mud: 1.15, water: 3.05, slope: 1.4 },
    cavalry: { clearance: 14, forest: 1.48, mud: 2.65, water: 5.1, slope: 2.7 },
    horseArcher: { clearance: 14, forest: 1.3, mud: 2.45, water: 4.8, slope: 2.4 }
  };
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const finitePoint = point => Number.isFinite(point?.x) && Number.isFinite(point?.y);
  const normalized = value => Number.isFinite(value) ? clamp(value, 0, 1) : value === true ? 1 : 0;

  function groundAt(field, x, y) {
    const sample = field.sample(x, y) || {};
    return {
      elevation: Number.isFinite(sample.elevation) ? sample.elevation : 0,
      forest: normalized(sample.forest), mud: normalized(sample.mud), water: normalized(sample.water),
      slope: normalized(sample.slope), ford: normalized(sample.ford)
    };
  }

  function validRock(rock) {
    return finitePoint(rock) && Number.isFinite(rock.rx) && Number.isFinite(rock.ry) && rock.rx > 0 && rock.ry > 0;
  }

  function makeGrid(field) {
    const { width, height } = field;
    const features = Array.isArray(field.features) ? field.features : [];
    const featureKind = feature => feature?.kind ?? feature?.type;
    const fords = features.filter(feature => featureKind(feature) === 'ford' && Number.isFinite(feature.width));
    const fordCell = fords.reduce((previous, feature) => Math.min(previous, feature.width * .47), 40);
    const nominal = clamp(Math.min(width, height) / 24, 14, 40);
    const step = Math.max(12, Math.min(nominal, fordCell));
    const cols = clamp(Math.ceil(width / step), 2, 62);
    const rows = clamp(Math.ceil(height / step), 2, 42);
    const dx = width / cols, dy = height / rows;
    let hasWidthTerrain = false, hasForest = false, minElevation = Infinity, maxElevation = -Infinity;
    const nodes = Array.from({ length: cols * rows }, (_, index) => {
      const x = (index % cols + .5) * dx, y = (Math.floor(index / cols) + .5) * dy;
      const sample = groundAt(field, x, y);
      hasWidthTerrain ||= sample.water > .55 || sample.slope > .57 || sample.forest > .67;
      hasForest ||= sample.forest > .62;
      minElevation = Math.min(minElevation, sample.elevation);
      maxElevation = Math.max(maxElevation, sample.elevation);
      return { x, y };
    });
    hasWidthTerrain ||= features.some(feature => ['ford', 'bank', 'cover', 'slope', 'crest'].includes(featureKind(feature)));
    hasForest ||= features.some(feature => featureKind(feature) === 'cover');
    const hasCrest = maxElevation - minElevation > .22 || features.some(feature => featureKind(feature) === 'crest');
    return { nodes, cols, rows, dx, dy, sampleStep: clamp(Math.min(dx, dy) * .65, 9, 25), hasWidthTerrain, hasForest, hasCrest };
  }

  class RouteQueue {
    constructor() { this.items = []; }
    push(index, estimate) {
      const entry = { index, estimate };
      const items = this.items;
      let at = items.length;
      items.push(entry);
      while (at > 0) {
        const parent = (at - 1) >> 1;
        if (items[parent].estimate <= estimate) break;
        items[at] = items[parent];
        at = parent;
      }
      items[at] = entry;
    }
    pop() {
      const items = this.items;
      const first = items[0], last = items.pop();
      if (!items.length) return first;
      let at = 0;
      while (at * 2 + 1 < items.length) {
        let child = at * 2 + 1;
        if (child + 1 < items.length && items[child + 1].estimate < items[child].estimate) child++;
        if (items[child].estimate >= last.estimate) break;
        items[at] = items[child];
        at = child;
      }
      items[at] = last;
      return first;
    }
  }

  function rayAgainstRock(point, dx, dy, rock) {
    const x = (point.x - rock.x) / rock.rx, y = (point.y - rock.y) / rock.ry;
    const c = x * x + y * y - 1;
    if (c <= EPSILON) return 0;
    const vx = dx / rock.rx, vy = dy / rock.ry;
    const b = x * vx + y * vy;
    if (b >= 0) return Infinity;
    const a = vx * vx + vy * vy;
    const determinant = b * b - a * c;
    return determinant < 0 ? Infinity : (-b - Math.sqrt(determinant)) / a;
  }

  function deepWater(sample) {
    return sample.water * (1 - .79 * sample.ford);
  }

  function crowdedSide(center, side) {
    const water = deepWater(side);
    return (water > .63 && water > deepWater(center) + .19) ||
      (side.slope > .73 && side.slope > center.slope + .18) ||
      (side.forest > .85 && center.forest < .66);
  }

  function create(field, navigation) {
    if (!Number.isFinite(field?.width) || field.width <= 0 || !Number.isFinite(field?.height) || field.height <= 0 ||
        typeof field.sample !== 'function' || typeof navigation?.segmentClear !== 'function') {
      throw new TypeError('Battle routing needs battlefield dimensions, a terrain sampler and obstacle navigation.');
    }
    const { width, height } = field;
    const bounds = { minX: 0, minY: 0, maxX: width, maxY: height };
    const rocks = Array.isArray(field.rocks) ? field.rocks.filter(validRock) : [];
    const widthLandmarks = rocks.concat((Array.isArray(field.features) ? field.features : []).filter(feature =>
      (feature?.kind ?? feature?.type) === 'ford' && finitePoint(feature)));
    const grid = makeGrid(field);
    const scenes = new Map();
    const inBounds = point => finitePoint(point) && point.x >= 0 && point.y >= 0 && point.x <= width && point.y <= height;
    const clearSegment = (a, b, clearance) => inBounds(a) && inBounds(b) && navigation.segmentClear(a, b, rocks, clearance);

    function traversalCost(a, b, profile) {
      const length = distance(a, b);
      if (length < EPSILON) return length;
      const steps = Math.ceil(length / grid.sampleStep);
      let previous = groundAt(field, a.x, a.y).elevation, heightCost = 0, weight = 0;
      for (let i = 0; i < steps; i++) {
        const t = (i + .5) / steps;
        const sample = groundAt(field, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
        const climb = sample.elevation - previous;
        heightCost += Math.abs(climb) + Math.max(0, climb) * .65;
        previous = sample.elevation;
        weight += 1 + profile.forest * sample.forest + profile.mud * sample.mud * (1 - .27 * sample.ford) +
          profile.water * deepWater(sample) + profile.slope * sample.slope;
      }
      const endingClimb = groundAt(field, b.x, b.y).elevation - previous;
      heightCost += Math.abs(endingClimb) + Math.max(0, endingClimb) * .65;
      return length * weight / steps + heightCost * (5 + 5 * profile.slope);
    }

    function sceneFor(clearance) {
      if (!scenes.has(clearance)) {
        if (scenes.size >= 6) scenes.delete(scenes.keys().next().value);
        scenes.set(clearance, {
          open: Uint8Array.from(grid.nodes, point => Number(clearSegment(point, point, clearance))),
          edges: new Array(grid.nodes.length), clearance
        });
      }
      return scenes.get(clearance);
    }

    function connectedEdges(scene, index) {
      if (scene.edges[index]) return scene.edges[index];
      const col = index % grid.cols, row = Math.floor(index / grid.cols), point = grid.nodes[index];
      const edges = [];
      for (const [x, y] of NEIGHBORS) {
        const colNext = col + x, rowNext = row + y;
        if (colNext < 0 || colNext >= grid.cols || rowNext < 0 || rowNext >= grid.rows) continue;
        const next = rowNext * grid.cols + colNext;
        if (scene.open[next] && clearSegment(point, grid.nodes[next], scene.clearance)) edges.push({ next, cost: {} });
      }
      scene.edges[index] = edges;
      return edges;
    }

    function endpointNodes(point, scene) {
      const col = Math.floor(point.x / grid.dx), row = Math.floor(point.y / grid.dy);
      const nearby = [];
      for (let y = Math.max(0, row - 2); y <= Math.min(grid.rows - 1, row + 2); y++) {
        for (let x = Math.max(0, col - 2); x <= Math.min(grid.cols - 1, col + 2); x++) {
          const index = y * grid.cols + x;
          if (scene.open[index] && clearSegment(point, grid.nodes[index], scene.clearance)) nearby.push(index);
        }
      }
      return nearby;
    }

    function gridRoute(start, goal, role, clearance, directCost) {
      const profile = MOVEMENT[role];
      const scene = sceneFor(clearance);
      const count = grid.nodes.length;
      const cost = new Float64Array(count), goalCost = new Float64Array(count);
      cost.fill(Infinity); goalCost.fill(Infinity);
      const cameFrom = new Int32Array(count); cameFrom.fill(-1);
      const visited = new Uint8Array(count);
      const queue = new RouteQueue();
      for (const index of endpointNodes(goal, scene)) goalCost[index] = traversalCost(grid.nodes[index], goal, profile);
      if (goalCost.every(value => !Number.isFinite(value))) return null;
      for (const index of endpointNodes(start, scene)) {
        const point = grid.nodes[index];
        cost[index] = traversalCost(start, point, profile);
        queue.push(index, cost[index] + distance(point, goal));
      }
      let best = -1, bound = directCost;
      while (queue.items.length) {
        const { index, estimate } = queue.pop();
        if (estimate >= bound - EPSILON) break;
        if (visited[index]) continue;
        visited[index] = 1;
        if (cost[index] + goalCost[index] < bound) {
          best = index;
          bound = cost[index] + goalCost[index];
        }
        const point = grid.nodes[index];
        for (const edge of connectedEdges(scene, index)) {
          if (visited[edge.next]) continue;
          const next = grid.nodes[edge.next];
          edge.cost[role] ??= traversalCost(point, next, profile);
          const nextCost = cost[index] + edge.cost[role];
          const score = nextCost + distance(next, goal);
          if (nextCost >= cost[edge.next] || score >= bound - EPSILON) continue;
          cost[edge.next] = nextCost;
          cameFrom[edge.next] = index;
          queue.push(edge.next, score);
        }
      }
      if (best < 0) return null;
      const path = [goal];
      for (let index = best; index >= 0; index = cameFrom[index]) path.push(grid.nodes[index]);
      return path.reverse();
    }

    function simplify(start, path, clearance, profile) {
      if (path.length < 2) return path;
      const points = [start, ...path];
      const costs = [0];
      for (let i = 1; i < points.length; i++) costs.push(costs[i - 1] + traversalCost(points[i - 1], points[i], profile));
      const result = [];
      let from = 0;
      while (from < points.length - 1) {
        let next = Math.min(from + 12, points.length - 1);
        for (; next > from + 1; next--) {
          if (clearSegment(points[from], points[next], clearance) &&
              traversalCost(points[from], points[next], profile) <= (costs[next] - costs[from]) * 1.012 + .1) break;
        }
        result.push(points[next]);
        from = next;
      }
      return result;
    }

    function sideWidth(point, dx, dy, center) {
      const wallX = dx > EPSILON ? (width - point.x) / dx : dx < -EPSILON ? -point.x / dx : Infinity;
      const wallY = dy > EPSILON ? (height - point.y) / dy : dy < -EPSILON ? -point.y / dy : Infinity;
      let usable = Math.min(wallX, wallY);
      for (const rock of rocks) usable = Math.min(usable, rayAgainstRock(point, dx, dy, rock));
      if (!center || usable < EPSILON) return usable;
      const search = Math.min(usable, 204);
      const steps = Math.ceil(search / 15);
      for (let i = 1; i <= steps; i++) {
        const dist = search * i / steps;
        const ground = groundAt(field, point.x + dx * dist, point.y + dy * dist);
        if (crowdedSide(center, ground)) return dist - search / steps * .5;
      }
      return usable;
    }

    function areaWidth(point, heading = 0) {
      if (!inBounds(point) || !clearSegment(point, point, 0)) return 0;
      const angle = Number.isFinite(heading) ? heading : 0;
      const x = -Math.sin(angle), y = Math.cos(angle);
      const center = grid.hasWidthTerrain ? groundAt(field, point.x, point.y) : null;
      return sideWidth(point, x, y, center) + sideWidth(point, -x, -y, center);
    }

    function describe(start, path, profile) {
      const waypoints = [];
      let from = start, length = 0, cost = 0, minWidth = Infinity;
      for (const point of path) {
        const segmentLength = distance(from, point);
        const dx = point.x - from.x, dy = point.y - from.y;
        const angle = Math.atan2(dy, dx);
        const samples = Math.max(1, Math.ceil(segmentLength / 34));
        const fractions = Array.from({ length: samples }, (_, i) => (i + 1) / samples);
        if (segmentLength > EPSILON) {
          const square = segmentLength * segmentLength;
          for (const feature of widthLandmarks) {
            const fraction = ((feature.x - from.x) * dx + (feature.y - from.y) * dy) / square;
            if (fraction > EPSILON && fraction < 1 - EPSILON) fractions.push(fraction);
          }
          fractions.sort((a, b) => a - b);
        }
        let lastWidth = areaWidth(from, angle);
        minWidth = Math.min(minWidth, lastWidth);
        for (const [index, t] of fractions.entries()) {
          if (index > 0 && t - fractions[index - 1] < EPSILON) continue;
          const current = t === 1 ? { x: point.x, y: point.y } : { x: from.x + dx * t, y: from.y + dy * t };
          current.width = areaWidth(current, angle);
          minWidth = Math.min(minWidth, current.width);
          if (t === 1 || (Math.min(current.width, lastWidth) < 220 &&
              Math.abs(current.width - lastWidth) >= Math.max(7, Math.min(current.width, lastWidth) * .17))) {
            waypoints.push(current);
            lastWidth = current.width;
          }
        }
        length += segmentLength;
        cost += traversalCost(from, point, profile);
        from = point;
      }
      return { waypoints, length, cost, minWidth };
    }

    function route(from, to, { role = 'infantry', clearance } = {}) {
      if (!Object.hasOwn(MOVEMENT, role)) role = 'infantry';
      const profile = MOVEMENT[role];
      const padding = Number.isFinite(clearance) ? Math.max(0, clearance) : profile.clearance;
      if (!clearSegment(from, from, padding) || !clearSegment(to, to, padding)) return null;
      const direct = clearSegment(from, to, padding);
      const directCost = direct ? traversalCost(from, to, profile) : Infinity;
      if (direct && directCost <= distance(from, to) * 1.045 + 2) return describe(from, [to], profile);
      const planned = gridRoute(from, to, role, padding, directCost);
      const exact = planned || (direct ? [to] : navigation.findPath?.(from, to, rocks, bounds, padding));
      if (!exact?.length || distance(exact[exact.length - 1], to) > EPSILON) return null;
      const path = simplify(from, exact, padding, profile);
      let previous = from;
      for (const point of path) {
        if (!clearSegment(previous, point, padding)) return null;
        previous = point;
      }
      const result = describe(from, path, profile);
      return direct && result.cost > directCost + EPSILON ? describe(from, [to], profile) : result;
    }

    function clearShot(from, to) {
      if (!clearSegment(from, to, 0)) return false;
      const length = distance(from, to);
      if (!(grid.hasForest || grid.hasCrest) || length < 20) return true;
      const start = groundAt(field, from.x, from.y), end = groundAt(field, to.x, to.y);
      const steps = clamp(Math.ceil(length / 12), 2, 60);
      let dense = 0;
      for (let i = 1; i < steps; i++) {
        const part = i / steps;
        const ground = groundAt(field, from.x + (to.x - from.x) * part, from.y + (to.y - from.y) * part);
        const arc = .20 + .27 * Math.sin(Math.PI * part);
        const line = start.elevation + (end.elevation - start.elevation) * part;
        if (grid.hasCrest && ground.elevation > line + arc) return false;
        if (part * length > 14 && (1 - part) * length > 10 && ground.forest > .73) dense += length / steps;
        else dense = 0;
        if (dense >= 34) return false;
      }
      return true;
    }

    return { route, clearShot, areaWidth };
  }

  window.UABattleTerrainRouting = { create };
}());
