(() => {
  'use strict';

  const PRESETS = new Set(['plain', 'ridge', 'forest', 'mud', 'river', 'rocks', 'mixed']);
  const FEATURE_TYPES = new Set(['crest', 'slope', 'cover', 'ford', 'bank', 'lane']);
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  function create(options = {}) {
    const width = Math.max(1, Number(options.width) || 1000);
    const height = Math.max(1, Number(options.height) || 600);
    const preset = PRESETS.has(options.preset) ? options.preset : 'plain';
    const approach = Number(options.approach) === -1 ? -1 : 0;
    const road = clamp(Math.floor(Number(options.road) || 0), 0, 2);
    const seedValue = Number(options.seed);
    const seed = Number.isFinite(seedValue) ? ((Math.floor(seedValue) % 50) + 50) % 50 : 0;
    let state = (0x9e3779b9 ^ Math.imul(seed + 1, 0x85ebca6b)) >>> 0;
    const random = () => {
      state += 0x6d2b79f5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const jitter = (amount) => (random() * 2 - 1) * amount;
    const zones = [];
    const features = [];
    let nextId = 0;
    const wx = (v) => v * width;
    const wy = (v) => v * height;

    function addZone(kind, x, y, rx, ry, strength = 1) {
      const z = {
        kind,
        x: clamp(wx(x), 0, width),
        y: clamp(wy(y), 0, height),
        rx: clamp(wx(rx), width * 0.012, width * 0.8),
        ry: clamp(wy(ry), height * 0.012, height * 0.8),
        strength: clamp(strength, 0.2, 1)
      };
      zones.push(z);
      return z;
    }

    function addFeature(type, name, x, y, span = 0.1) {
      if (!FEATURE_TYPES.has(type)) return;
      features.push({
        id: `terrain-${seed}-${nextId++}`,
        type,
        name,
        x: clamp(wx(x), 0, width),
        y: clamp(wy(y), 0, height),
        width: clamp(wx(span), width * 0.025, width * 0.8)
      });
    }

    function pair(kind, x, y, rx, ry, strength = 1, xShift = 0, yShift = 0) {
      addZone(kind, x + xShift, y + yShift, rx, ry, strength);
      addZone(kind, 1 - x - xShift, y + yShift, rx, ry, strength);
    }

    const variation = 0.018 + random() * 0.025;
    const strength = (base, spread = 0.12) => clamp(base + jitter(spread), 0.3, 1);
    const addCoverPair = (y, name = 'Shelter grove') => {
      const x = 0.19 + random() * 0.055;
      const yy = y + jitter(0.025);
      pair('forest', x, yy, 0.075 + random() * 0.02, 0.08 + random() * 0.02, strength(0.78));
      addFeature('cover', name, x, yy, 0.14);
      addFeature('cover', name, 1 - x, yy, 0.14);
    };

    if (preset === 'plain') {
      // A usable open center with matching, optional cover on both flanks.
      pair('hill', 0.24, 0.3 + jitter(0.025), 0.095, 0.1, strength(0.43));
      pair('hill', 0.24, 0.7 + jitter(0.025), 0.095, 0.1, strength(0.4));
      addCoverPair(0.31, 'Rough copse');
      addCoverPair(0.69, 'Rough copse');
      addFeature('lane', 'Open central ground', 0.5, 0.5, 0.28);
    } else if (preset === 'ridge') {
      // Three ridge shoulders leave two clear low passes; rocky shoulders sit outside them.
      const ridgeY = 0.5 + jitter(0.025);
      const ridgeParts = [0.25, 0.5, 0.75];
      for (const rx of ridgeParts) {
        const x = rx + (rx === 0.5 ? 0 : jitter(variation));
        const y = ridgeY + jitter(0.015);
        addZone('hill', x, y, rx === 0.5 ? 0.145 : 0.16, 0.19 + random() * 0.025, strength(0.9, 0.08));
        addFeature('crest', 'Broken ridge', x, y, 0.2);
        addFeature('slope', 'Ridge approach', x, y + (random() < 0.5 ? -0.12 : 0.12), 0.18);
      }
      for (const x of [0.375, 0.625]) {
        addFeature('lane', 'Low pass', x, ridgeY, 0.11);
        addZone('rock', x, ridgeY + 0.205, 0.055, 0.065, strength(0.85));
      }
      pair('rock', 0.19, ridgeY - 0.22, 0.06, 0.075, strength(0.82));
      addFeature('cover', 'Rocky flank', 0.19, ridgeY - 0.22, 0.12);
      addFeature('cover', 'Rocky flank', 0.81, ridgeY - 0.22, 0.12);
    } else if (preset === 'forest') {
      // Twin woodlands keep a central lane and smaller gaps for flanking movement.
      for (const y of [0.25, 0.5, 0.75]) {
        const yy = y + jitter(0.025);
        pair('forest', 0.23 + random() * 0.035, yy, 0.12 + random() * 0.02, 0.105 + random() * 0.02, strength(0.88));
        pair('hill', 0.32, yy + 0.045, 0.07, 0.07, strength(0.3));
        addFeature('cover', 'Dense woodland', 0.235, yy, 0.2);
        addFeature('cover', 'Dense woodland', 0.765, yy, 0.2);
      }
      addFeature('lane', 'Forest clearing', 0.5, 0.5, 0.2);
    } else if (preset === 'mud') {
      // A broad muddy basin is broken by two paired, drier shoulder lanes.
      addZone('mud', 0.5, 0.5, 0.31, 0.31, strength(0.82));
      pair('mud', 0.23, 0.29, 0.1, 0.12, strength(0.63));
      pair('mud', 0.23, 0.71, 0.1, 0.12, strength(0.63));
      for (const x of [0.18, 0.82]) {
        addFeature('lane', 'Firm shoulder', x, 0.5, 0.18);
        pair('hill', x, 0.5, 0.065, 0.12, strength(0.26));
      }
      addFeature('slope', 'Soft basin', 0.5, 0.5, 0.34);
    } else if (preset === 'river') {
      // A continuous cross-field channel with two distinct, mirrored shallow crossings.
      const channelX = 0.5 + jitter(0.012);
      addZone('water', channelX, 0.5, 0.075 + random() * 0.012, 0.78, 1);
      const fordYs = [0.32 + jitter(0.02), 0.68 + jitter(0.02)];
      for (const y of fordYs) {
        addZone('ford', channelX, y, 0.12, 0.045, 1);
        addFeature('ford', 'Shallow ford', channelX, y, 0.24);
        addFeature('bank', 'River bank', channelX - 0.11, y, 0.18);
        addFeature('bank', 'River bank', channelX + 0.11, y, 0.18);
        pair('hill', 0.27, y, 0.075, 0.09, strength(0.45));
      }
      pair('forest', 0.21, 0.5, 0.07, 0.13, strength(0.55));
      addFeature('lane', 'North approach', channelX, 0.16, 0.18);
      addFeature('lane', 'South approach', channelX, 0.84, 0.18);
    } else if (preset === 'rocks') {
      // Mirrored outcrops create cover without sealing the center or both flanks.
      for (const y of [0.24, 0.5, 0.76]) {
        const yy = y + jitter(0.025);
        const x = 0.25 + random() * 0.035;
        pair('rock', x, yy, 0.065 + random() * 0.015, 0.075 + random() * 0.02, strength(0.9, 0.07));
        pair('hill', 0.34, yy + 0.05, 0.065, 0.07, strength(0.36));
        addFeature('cover', 'Stone outcrop', x, yy, 0.13);
        addFeature('cover', 'Stone outcrop', 1 - x, yy, 0.13);
      }
      addFeature('lane', 'Open center', 0.5, 0.5, 0.22);
    } else { // mixed
      pair('hill', 0.28, 0.5, 0.105, 0.19, strength(0.66));
      pair('forest', 0.19, 0.27, 0.075, 0.095, strength(0.76));
      pair('forest', 0.19, 0.73, 0.075, 0.095, strength(0.76));
      pair('mud', 0.34, 0.26, 0.07, 0.085, strength(0.52));
      pair('mud', 0.34, 0.74, 0.07, 0.085, strength(0.52));
      pair('rock', 0.25, 0.5, 0.05, 0.075, strength(0.82));
      addFeature('crest', 'Twin high ground', 0.28, 0.5, 0.17);
      addFeature('crest', 'Twin high ground', 0.72, 0.5, 0.17);
      addFeature('lane', 'Central approach', 0.5, 0.5, 0.25);
      addFeature('cover', 'Woodland edge', 0.19, 0.27, 0.14);
      addFeature('cover', 'Woodland edge', 0.81, 0.27, 0.14);
      addFeature('cover', 'Woodland edge', 0.19, 0.73, 0.14);
      addFeature('cover', 'Woodland edge', 0.81, 0.73, 0.14);
    }

    if (road > 0 && preset === 'rocks') {
      addFeature('lane', 'Old trade road', 0.5, 0.5, 0.2 + road * 0.035);
    }
    if (approach === -1) {
      for (const z of zones) z.y = height - z.y;
      for (const feature of features) feature.y = height - feature.y;
    }
    const rocks = zones.filter((z) => z.kind === 'rock');
    function zoneStrength(z, x, y) {
      const dx = (x - z.x) / z.rx;
      const dy = (y - z.y) / z.ry;
      const d2 = dx * dx + dy * dy;
      if (d2 >= 1) return 0;
      // Soft edge keeps sampled movement penalties smooth instead of pixel-stepped.
      const edge = 1 - d2;
      return edge * edge * (z.strength || 1);
    }
    function elevationAt(x, y) {
      let elevation = 0;
      for (const z of zones) if (z.kind === 'hill') elevation = Math.max(elevation, zoneStrength(z, x, y) * 1.85);
      return clamp(elevation, 0, 2);
    }
    function sample(x, y) {
      x = clamp(Number(x) || 0, 0, width);
      y = clamp(Number(y) || 0, 0, height);
      let forest = 0, mud = 0, water = 0, ford = 0;
      for (const z of zones) {
        const v = zoneStrength(z, x, y);
        if (z.kind === 'forest') forest = Math.max(forest, v);
        else if (z.kind === 'mud') mud = Math.max(mud, v);
        else if (z.kind === 'water') water = Math.max(water, v);
        else if (z.kind === 'ford') ford = Math.max(ford, v);
      }
      // Ford ellipses locally replace deep water with firm/shallow crossing.
      water *= (1 - ford);
      const step = Math.max(2, Math.min(width, height) * 0.012);
      const gx = Math.abs(elevationAt(clamp(x + step, 0, width), y) - elevationAt(clamp(x - step, 0, width), y)) / (2 * step);
      const gy = Math.abs(elevationAt(x, clamp(y + step, 0, height)) - elevationAt(x, clamp(y - step, 0, height))) / (2 * step);
      const slope = clamp(Math.hypot(gx * width, gy * height) / 1.9, 0, 1);
      return {
        elevation: elevationAt(x, y),
        forest: clamp(forest, 0, 1),
        mud: clamp(mud, 0, 1),
        water: clamp(water, 0, 1),
        slope,
        ford: clamp(ford, 0, 1)
      };
    }

    return { width, height, zones, rocks, features, sample };
  }

  window.UABattleTerrain = { create };
})();
