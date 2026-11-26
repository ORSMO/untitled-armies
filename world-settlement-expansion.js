(function () {
  'use strict';

  const ADDITIONS = ['town', 'town', 'town', 'castle', ...Array(12).fill('village')];
  const NAMES = [
    ['Aldermead', 'Wrenford', 'Hawthorn Cross', 'Brambleward', 'Elmbrook', 'Foxmere', 'Tansy Glen', 'Mallowbank', 'Yewbrook', 'Hearthgrove', 'Badgerfold', 'Larksedge', 'Cloverhollow', 'Whittlegate', 'Mosscleft', 'Rushwood'],
    ['Bergvik', 'Kaldsund', 'Storhavn', 'Rimskans', 'Vargnes', 'Skaradal', 'Hrafnby', 'Torfvik', 'Eirholt', 'Dalsvik', 'Sundgard', 'Brannstad', 'Ravna', 'Hvalnes', 'Kvernby', 'Ljosdal'],
    ['Copperhall', 'Orebridge', 'Kilnstead', 'Basalt Ward', 'Gravelden', 'Slateglen', 'Malletbrook', 'Cragcut', 'Cinder Dell', 'Hewnfield', 'Bellows End', 'Tinstep', 'Hammerwick', 'Cliffspan', 'Coalrun', 'Gritwell'],
    ['Mireval', 'Bellecour', 'Aubricourt', 'Fleurwatch', 'Violet Bank', 'Sablewick', 'Fallowcombe', 'Laurel Vale', 'Elderbell', 'Arcenay', 'Lornel', 'Corbinet', 'Fleurey', 'Bellerive', 'Dornes', 'Roswick'],
    ['Avenash', 'Deyasan', 'Miranor', 'Emberwatch', 'Sarevi', 'Tehranil', 'Ivory Spring', 'Lathas', 'Orenash', 'Navaren', 'Belaris', 'Orun Vale', 'Tasari', 'Seresh', 'Mellovar', 'Darelun'],
    ['Mastbridge', 'Ternhaven', 'Lockmarket', 'Greybar Fort', 'Oystercove', 'Sedgewater', 'Tallowquay', 'Greycap', 'Windlass', 'Ploverbank', 'Sailstead', 'Fishwell', 'Nacre Point', 'Heronsby', 'Bendwater', 'Caskmere'],
    ['Kestrelford', 'Marchcombe', 'Chestnut Market', 'Cormorant Hold', 'Harecross', 'Hedgewell', 'Crabapple End', 'Roughbrook', 'Walnut Lea', 'Gorsebank', 'Longpasture', 'Sparrowmead', 'Willow Dene', 'Russetburn', 'Horsley', 'Tannerwick'],
    ['Vespera', 'Domitia', 'Lentoria', 'Fort Aster', 'Morianum', 'Fausta', 'Rillium', 'Salvia', 'Vallonis', 'Clarus', 'Castella', 'Marevia', 'Verenna', 'Oliveta', 'Castor Vale', 'Nerinus'],
    ['Azram', 'Muraya', 'Qadira', 'Jandur Fort', 'Sabilan', 'Kasiri', 'Talifan', 'Rahail', 'Mahzara', 'Bahra', 'Nazim Wells', 'Yasrin', 'Durayya', 'Arud', 'Shamari', 'Nayaf'],
    ['Khurun', 'Arkat', 'Torush', 'Falcon Gate', 'Belig', 'Saruk', 'Urbai', 'Yorun', 'Kushal', 'Tolun', 'Arslan Vale', 'Borlu', 'Temesh', 'Suyar', 'Kara Spring', 'Mergen']
  ];
  const RESOURCES = ['grain', 'timber', 'iron', 'salt'];
  const RESOURCE_WEIGHT = [1, .92, 1.85, 1.18];
  const RESOURCE_TERRAIN = {
    grass: [4, 0, 0, 0], steppe: [3.4, 0, 0, 0], forest: [1, 5, 0, 0], taiga: [.2, 5.7, 0, 0],
    rainforest: [1.75, 5.2, 0, 0], hills: [.8, 0, 4, 0], mountain: [0, 0, 6, 0],
    scrub: [.5, 0, 0, 3], desert: [0, 0, 0, 4.5], marsh: [.65, 0, 0, 3], tundra: [.6, .8, 0, 0]
  };
  const MARKET_TERRAIN = { grass: 1.4, steppe: 1.1, forest: .6, hills: .4, scrub: .4, rainforest: .4, taiga: .2, marsh: -.7, tundra: -.3, desert: -.3 };
  const FORBIDDEN = new Set(['sea', 'river', 'mountain', 'snow']);
  const DIRECTIONS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const RESOURCE_SAMPLE = [[0, 0], [-5, 0], [5, 0], [0, -5], [0, 5], [-3, -3], [3, -3], [-3, 3], [3, 3]];

  function distanceSquared(a, b) {
    return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  }

  function chance(x, y, salt) {
    let value = Math.imul(x + 1, 0x45d9f3b) ^ Math.imul(y + 1, 0x119de1f3) ^ Math.imul(salt + 1, 0x27d4eb2d);
    value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
    return ((value ^ (value >>> 13)) >>> 0) / 0x100000000;
  }

  function distances(cols, rows, seedAt) {
    const field = new Uint16Array(cols * rows);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      field[i] = seedAt(i, x, y) ? 0 : Math.min(1000, x ? field[i - 1] + 1 : 1000, y ? field[i - cols] + 1 : 1000);
    }
    for (let y = rows - 1; y >= 0; y--) for (let x = cols - 1; x >= 0; x--) {
      const i = y * cols + x;
      field[i] = Math.min(field[i], x + 1 < cols ? field[i + 1] + 1 : 1000, y + 1 < rows ? field[i + cols] + 1 : 1000);
    }
    return field;
  }

  function resourceProfile(tileAtGrid, x, y, river, coast) {
    const amounts = [0, 0, 0, 0];
    RESOURCE_SAMPLE.forEach(([dx, dy], i) => {
      const profile = RESOURCE_TERRAIN[tileAtGrid(x + dx, y + dy)?.kind];
      if (profile) profile.forEach((amount, j) => { amounts[j] += amount * (i === 0 ? 2 : 1); });
    });
    amounts[0] += Math.max(0, 6 - river) * 1.25;
    amounts[3] += Math.max(0, 7 - coast) * 2.2;
    return amounts;
  }

  function collectCandidates({ width, height, tileSize, factions, settlements, tileAt, roads, landmarks, reachable }) {
    const cols = Math.ceil(width / tileSize);
    const rows = Math.ceil(height / tileSize);
    const land = Array.from({ length: cols * rows }, (_, i) => {
      const x = (i % cols + .5) * tileSize;
      const y = (Math.floor(i / cols) + .5) * tileSize;
      return tileAt(x, y);
    });
    const at = (x, y) => x >= 0 && x < cols && y >= 0 && y < rows ? land[y * cols + x] : null;
    const coast = distances(cols, rows, i => land[i]?.kind === 'sea');
    const river = distances(cols, rows, i => land[i]?.kind === 'river');
    const road = distances(cols, rows, i => Boolean(roads?.[i]));
    const border = distances(cols, rows, (i, x, y) => land[i]?.owner >= 0 && DIRECTIONS.some(([dx, dy]) => {
      const neighbor = at(x + dx, y + dy);
      return neighbor?.owner >= 0 && neighbor.owner !== land[i].owner;
    }));
    const realms = new Map(factions.map(faction => [faction.id, []]));

    for (let y = 2; y < rows - 2; y++) for (let x = 2; x < cols - 2; x++) {
      const i = y * cols + x;
      const tile = land[i];
      if (!tile?.walk || !realms.has(tile.owner) || FORBIDDEN.has(tile.kind) || (reachable && !reachable(x, y))) continue;
      const neighbors = DIRECTIONS.reduce((total, [dx, dy]) => total + Number(Boolean(at(x + dx, y + dy)?.walk)), 0);
      if (neighbors < 3) continue;
      const site = { x: (x + .5) * tileSize, y: (y + .5) * tileSize };
      if (landmarks.some(place => distanceSquared(site, place) < 170 ** 2)) continue;

      let separation = Infinity;
      let marketDistance = Infinity;
      let fortDistance = Infinity;
      let marketId = null;
      for (const old of settlements) {
        const distance = distanceSquared(site, old);
        separation = Math.min(separation, distance);
        if (old.faction !== tile.owner) continue;
        if (old.type === 'castle') fortDistance = Math.min(fortDistance, distance);
        if (distance < marketDistance && (old.type === 'capital' || old.type === 'town')) {
          marketDistance = distance;
          marketId = old.id;
        }
      }
      if (separation < 150 ** 2 || marketId === null) continue;

      const profile = resourceProfile(at, x, y, river[i], coast[i]);
      realms.get(tile.owner).push({
        ...site, tx: x, ty: y, terrain: tile.kind, profile,
        coastalAccess: Math.max(0, 1 - coast[i] / 6), riverAccess: Math.max(0, 1 - river[i] / 7),
        roadAccess: Math.max(0, 1 - road[i] / 12), frontier: Math.max(0, 1 - Math.abs(border[i] - 4) / 11),
        separation, marketDistance, fortDistance, marketId
      });
    }
    return realms;
  }

  function choose(candidates, factionId, type, slot, resourceUsage) {
    const spacing = type === 'town' ? 405 : type === 'castle' ? 345 : 228;
    let best = null;
    let bestScore = -Infinity;
    for (const candidate of candidates) {
      if (candidate.separation < 150 ** 2) continue;
      const distance = Math.sqrt(candidate.separation);
      const market = Math.sqrt(candidate.marketDistance);
      const spread = Math.min(distance, 830) / 230;
      const { coastalAccess, riverAccess, roadAccess } = candidate;
      const noise = chance(candidate.tx, candidate.ty, factionId * 19 + slot) * .75;
      let score = noise - Math.max(0, spacing - distance) / 18;
      if (type === 'town') {
        score += spread * 1.18 + roadAccess * 1.55 + riverAccess * .88 + coastalAccess * .85 +
          (MARKET_TERRAIN[candidate.terrain] || 0) - Math.max(0, market - 1260) / 575;
      } else if (type === 'castle') {
        score += spread * 1.35 + candidate.frontier * 1.50 + roadAccess * .75 +
          (candidate.terrain === 'hills' ? 1.65 : 0) - Math.max(0, 740 - Math.sqrt(candidate.fortDistance)) / 300 -
          Math.max(0, market - 1050) / 575;
      } else {
        const resource = bestResource(candidate.profile, resourceUsage);
        const production = resourceScore(candidate.profile, resourceUsage, resource);
        score += spread + production / 25 + roadAccess * .9 + riverAccess * .46 + coastalAccess * .35
          - Math.max(0, market - 940) / 410;
      }
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    return best;
  }

  function register(realms, settlement) {
    for (const [factionId, candidates] of realms) {
      for (const candidate of candidates) {
        const distance = distanceSquared(candidate, settlement);
        candidate.separation = Math.min(candidate.separation, distance);
        if (factionId !== settlement.faction) continue;
        if (settlement.type === 'castle') candidate.fortDistance = Math.min(candidate.fortDistance, distance);
        if (settlement.type === 'town' && distance < candidate.marketDistance) {
          candidate.marketDistance = distance;
          candidate.marketId = settlement.id;
        }
      }
    }
  }

  function reserveName(name, usedNames) {
    let result = name;
    for (let i = 2; usedNames.has(result.toLowerCase()); i++) result = `${name} ${i}`;
    usedNames.add(result.toLowerCase());
    return result;
  }

  function resourceScore(profile, usage, resource) {
    return profile[resource] * RESOURCE_WEIGHT[resource] / (1 + usage[resource] * .12);
  }

  function bestResource(profile, usage) {
    let best = 0;
    for (let i = 1; i < profile.length; i++) {
      if (resourceScore(profile, usage, i) > resourceScore(profile, usage, best)) best = i;
    }
    return best;
  }

  function create({ width, height, tileSize, factions, settlements, tileAt, roads, landmarks = [], reachable }) {
    const candidates = collectCandidates({ width, height, tileSize, factions, settlements, tileAt, roads, landmarks, reachable });
    const expansions = [];
    const usedNames = new Set([...settlements, ...landmarks].map(site => site.name.toLowerCase()));
    for (const faction of [...factions].sort((a, b) => a.id - b.id)) {
      const names = NAMES[faction.id];
      const resourceUsage = [0, 0, 0, 0];
      for (const [slot, type] of ADDITIONS.entries()) {
        const location = choose(candidates.get(faction.id), faction.id, type, slot, resourceUsage);
        if (!location) throw new Error(`Settlement expansion has too little connected land in realm ${faction.id}.`);
        const village = type === 'village';
        const castle = type === 'castle';
        const { x, y, marketId, tx, ty, riverAccess, roadAccess } = location;
        const variation = chance(tx, ty, 901 + faction.id);
        const resource = village ? bestResource(location.profile, resourceUsage) : -1;
        if (village) resourceUsage[resource]++;
        const site = {
          id: settlements.length + expansions.length, faction: faction.id,
          name: reserveName(names[slot], usedNames), type, x, y,
          prosperity: Math.round((village ? 34 : castle ? 43 : 48) + 29 * variation + 8 * riverAccess + 6 * roadAccess),
          garrison: Math.round((village ? 13 : castle ? 92 : 60) + (village ? 12 : 24) * variation),
          marketTier: village ? 'local' : castle ? null : 'regional',
          specialty: village ? RESOURCES[resource] : castle ? null : 'tools',
          villageClusterId: null,
          roadAnchorId: marketId, roadKind: village ? 'local' : 'trunk'
        };
        expansions.push(site);
        register(candidates, site);
      }
    }
    return expansions;
  }

  window.UASettlementExpansion = { create };
}());
