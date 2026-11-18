# Untitled Armies

## V4.1 — A more natural continent

Asterra's campaign geography has been rebuilt, not just recolored. The continent uses irregular coastlines with bays and peninsulas, mountain *ranges* with foothills, real downhill drainage, temperature decreasing with latitude, moisture from ocean winds and rain shadows, and a biome classification that blends from northern taiga and snow through central grasslands to southern steppes, scrub and desert. The terrain-aware faction frontier map now spreads through passes and valleys instead of making radial spokes around capitals. All 80 settlement identifiers and original faction capital coordinates are preserved for existing browser saves; old character/party positions that became water are relocated to nearby land on load.

All 80 settlements connect through a **79-link trade and village-road tree**, with primary trade roads following low-cost terrain and local village tracks linked to nearby towns rather than all seven locations directly back to a capital. Routes are true weighted A* polylines, not straight decorative threads; roads and travel avoid impassable water, cannot cut diagonally through river corners, and have 18 physical bridge crossings. River networks drain down actual terrain toward water. The world is rendered with a cached blended-color terrain atlas, softly contoured shorelines, rounded national boundaries, river channels, geographic labels and biome details. At full-continent scale, minor village tracks and smaller tributaries are hidden to prevent visual clutter.

The main menu now includes **Explore the World Atlas**—an interactive preview of the actual generated world, supporting dragging and zoom. Existing Classic 50v50 (`classic.html`) and Six-Arena Battle Lab (`lab.html`) remain unchanged. Campaign saves continue using browser-local storage.

A browser-based medieval warfare game in active development.

## V4.0 — Asterra Campaign Alpha

The main site now launches into a playable campaign **main menu** and a persistent, explorable continent called **Asterra**.

- **World map:** 12,000 × 8,200 world units with ten faction territories, 80 settlements (capitals, towns, castles, villages), roads, rivers, forests, mountains, snow, steppe, swamps and desert.
- **Character creation:** name, starting faction / homeland and background (wanderer, former soldier or merchant).
- **Travel:** click to select a settlement or plot a route, click open terrain to travel, WASD / arrow keys to walk, drag to pan, mouse wheel / buttons to zoom, minimap to recenter, adjustable time speed and pause.
- **Faction roster:** every kingdom has its own culture, locations, initial rivals and three-tier troop progression. Recruited units retain their faction template; upgrades consume denars. Custom troop equipment is **not** unlocked for a wandering character. The future player-founded-faction feature will allow defining custom troop templates.
- **Settlements:** enter, recruit volunteers, buy food, rest and hear rumors.
- **Party gameplay:** supplies and food consumption, money, health, experience, renown, level-ups, quests, roaming bandits, caravans and patrols. Bandit skirmishes currently use an abstract party-strength resolution that awards losses and rewards.
- **Save / Continue:** browser-local save file in localStorage (auto-save plus explicit save) and persistent view preferences. Clearing browser storage or changing browser/device removes that local save.

### Links

- [Campaign main menu](https://untitled-armies.onrender.com/)
- [Classic 50v50 combat engine](https://untitled-armies.onrender.com/classic.html)
- [Six-Arena Battle Lab](https://untitled-armies.onrender.com/lab.html)

The previous V3.6 default Battle Lab has been **preserved as `lab.html`**, so the campaign menu does not replace or discard any existing battle-test mechanics.

### Current limits and next steps

This is the **first campaign foundation**, not the finished Mount & Blade-style sandbox. The world has faction borders, preset troops, patrols and static starting wars, but no full economic simulation, diplomacy changes, lords, or AI-led sieges yet. Campaign encounters are **not yet imported into Classic 50v50**, and no tactical battle can currently return its survivor roster to the campaign. That overworld-to-combat integration is the most important next connection to build. A faction can only create custom troop and equipment templates **after the player has founded their own faction**, when that feature is implemented.

## Development

The app is static HTML, CSS and JavaScript: `index.html` (main menu / campaign), `campaign.css`, `world-data.js`, `campaign.js`, `classic.html` (combat testing), and `lab.html` (six-arena balance laboratory). No server or database is required for the present alpha. 
