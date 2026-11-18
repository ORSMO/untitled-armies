# Untitled Armies

## V4.2 — Moving-party pursuit, encounters and playable campaign battles

- **Click to follow a moving party.** Selecting a roaming bandit, patrol, or caravan begins pursuit instead of simply inspecting their old coordinates. The player's route recalculates as the party moves, keeping the player camera centered while chasing (even if normal map-follow was disabled). Clicking a settlement still offers its normal route.
- **Conversations before combat.** Catching a party opens a modal with the other party's identity and strength, your troop totals, and choices to speak, trade/ask for news, lead troops into battle, or leave. Nearby hostile bandits also stop the player and open the encounter instead of automatically triggering a win/loss roll. Caravans can sell provisions.
- **Actually fight the encounter.** `campaign-battle.html` is a separate campaign-linked version of the existing V3.6 Classic physical combat engine. It loads up to 50 of your actual healthy faction troops (with a basic conversion from faction/tier to their weapons, shields, armor and role), your current health and the enemy party's size. Your avatar is the friendly commander: **WASD** to move directly, **click/hold or Space** to attack, **Shift** to raise a shield. The camera follows the hero. Mobile users get an on-screen direction pad and attack/guard controls. Your soldiers still use commander AI, morale, physics, cavalry, shield/spear walls and battle terrain based on the encounter's world biome. The Commander panel remains available for formation and tactical orders. **Withdraw from battle** allows you to disengage without automatic victory.
- **Results matter in the campaign.** When the physical battle ends, a return button writes its troop-by-troop survivor and casualty records, the hero's remaining health, and winner into the browser's local campaign storage. Loading back into the campaign applies permanent deaths/captures, incapacitated soldiers (wounded units recover by resting at an inn), gold, experience, renown, loot and defeated world-party state. Returning results is single-use, so reloads cannot multiply loot. Troops beyond the current 50-soldier battlefield limit remain in the campaign reserve. If you flee, the enemy remains on the world map.
- **The overworld feels inhabited.** 54 naturally scattered explorable locations now appear while zoomed in, including abandoned ruins, shrines, watchtowers, traveler camps, hidden groves and river fords. The first visit yields small provisions, denars and experience, and discovery progress saves between sessions. The map interface includes a **Nearby Discovery** option.

This is a major bridge into the tactical engine, but **not yet a 3D third-person Bannerlord battle**. Combat is the existing 2D physics battlefield with direct character controls. Settlement interactions, diplomacy and armies will keep evolving. Original `classic.html` and `lab.html` remain unchanged as developer test environments. Existing V4.0/V4.1 browser-local saves keep their format and remain usable.

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
- **Party gameplay:** supplies and food consumption, money, health, experience, renown, level-ups, quests, roaming bandits, caravans and patrols. In V4.0, bandit encounters used an abstract strength roll. V4.2 replaces those rolls with controllable campaign battles.
- **Save / Continue:** browser-local save file in localStorage (auto-save plus explicit save) and persistent view preferences. Clearing browser storage or changing browser/device removes that local save.

### Links

- [Campaign main menu](https://untitled-armies.onrender.com/)
- [Classic 50v50 combat engine](https://untitled-armies.onrender.com/classic.html)
- [Six-Arena Battle Lab](https://untitled-armies.onrender.com/lab.html)
- [Campaign tactical battlefield (only through encounters)](https://untitled-armies.onrender.com/campaign-battle.html)

The previous V3.6 default Battle Lab has been **preserved as `lab.html`**, so the campaign menu does not replace or discard any existing battle-test mechanics.

### Current limits and next steps

This is the **first campaign foundation**, not the finished Mount & Blade-style sandbox. The world has faction borders, preset troops, patrols and static starting wars, but no full economic simulation, diplomacy changes, lords, or AI-led sieges yet. V4.2 now links campaign parties to a dedicated 2D battle mode using the Classic combat engine and returns actual survivors and casualties. A deeper system for joining full armies, commanding reinforcements, sieges, third-person presentation and faction diplomacy is still to come. A faction can only create custom troop and equipment templates **after the player has founded their own faction**, when that feature is implemented.

## Development

The app is static HTML, CSS and JavaScript: `index.html` (main menu / campaign), `campaign.css`, `world-data.js`, `campaign.js`, `campaign-battle.html` (playable campaign encounters), `classic.html` (combat testing), and `lab.html` (six-arena balance laboratory). No server or database is required for the present alpha. 
