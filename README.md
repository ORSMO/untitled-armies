# Untitled Armies

## V4.8 — Bannerlord-inspired town activity hub

- **Town visits open a proper activity hub.** Choose Overview, Market, Inn, Garrison, Contracts or Local News, with clear actions and a quick return to the road.
- **Town time pauses while you decide.** Inn and Garrison show useful campaign details, local rumors react to nearby parties, and the hub is laid out for landscape phone screens.
- **Phone-first landscape play continues.** Portrait screens show a rotate prompt; town, encounter and menu screens keep their compact landscape layout.

## V4.7 — Phone-first landscape play

- **Landscape is the play orientation.** Portrait screens show a clear rotate prompt. Campaign launch also requests the browser's landscape lock where the installed browser supports it.
- **The campaign fits a short phone screen.** The map takes the available space, status chips scroll in a compact header, side panels open as drawers, and travel controls stay within thumb reach.
- **Town, encounter and menu screens are rearranged for landscape.** Town services, inventory and contracts remain usable in short-height screens, with independent scrolling for long lists.
- **Tactical battles keep a wide field and reachable controls.** The campaign battle now enforces the same landscape prompt and uses compact battlefield HUD, equipment and army-order controls. Classic and Lab already use landscape-only play; their controls remain touch-friendly.
## V4.6 — Kingdom standing and a living road network

- **Kingdoms remember your actions.** Existing faction reputation now has clear standing tiers. Contracts and victories against bandits improve local standing; attacking a patrol or caravan damages your relationship with its kingdom.
- **Standing changes settlement life.** Goods cost less with trusted factions. At high standing, volunteers are cheaper and more numerous; outlawed travelers are refused recruits. Town and faction screens show your relationship and recruiting status.
- **Road parties pursue their own goals.** Patrols hunt nearby outlaw bands, while bandits seek merchant caravans. They reroute as targets move and can fight, repel or raid one another during travel; a small trickle of travelers replaces losses over time.
- **World events respect campaign time.** Party movement and clashes advance only while the player travels. Towns, menus and the pause control still stop the world; distant encounters do not flood the player's event log.
- **Existing saves stay compatible.** V4.6 uses the current campaign save format and retains existing faction reputation, parties, markets and backups.

## V4.5 — Army command, economy, contracts and portable saves

- **Command your troops in campaign battles.** Issue advance, hold, stop or retreat orders to the whole company or a troop group; return any group to commander AI at any time. Hero Auto/Manual control remains separate.
- **Daily upkeep has consequences.** Travel and resting advance campaign days, charging troop wages and provisions. Paid, supplied troops recover morale; unpaid or hungry troops lose it, suffer health loss, and can desert if it collapses. The Quartermaster perk reduces upkeep.
- **Every settlement has its own market.** Capitals, towns, castles and villages stock different goods. Prosperity, biome and faction standing affect prices; finite stock slowly replenishes. The Silver Tongue perk improves market prices.
- **Perks make progression count.** Earn a perk point every three levels and choose from combat, command, trade, medical, supply and travel benefits. Equipment inventory shows a slot comparison before equipping.
- **Take campaign contracts.** Town boards offer courier, landmark survey and bandit bounty work. Up to three can be active; completion pays denars and XP and improves standing with a faction.
- **Export, import and restore saves.** Download or import a campaign JSON save from the title or pause menu. Two rotating local backups are available. Existing local saves remain on version 1 and gain sensible defaults for the new systems.
- **Testing modes stay intact.** Campaign battle orders are available in the campaign HUD; stress testing and combat lab controls remain isolated to Classic and Lab.

## V4.4 — Character growth, markets and hands-on campaign battles

- **Choose how to fight.** Campaign battles start in automatic mode, where your hero uses the battle AI. Switch to Manual at any time to move with WASD or the on-screen phone controls, hold attack, guard, and throw stones from an equipped pouch. Campaign battles do not expose stress tests, training switches, or other balance tools; Classic and Lab remain the test modes.
- **50 generated battlefields.** Each campaign encounter picks one of 50 seeded layouts for its local biome. Plains, ridges, forests, mud, rivers, rocky ground and mixed country place tactical terrain that changes movement, cover, collision and combat.
- **Character progression and gear.** Existing characters gain compatible defaults for strength, agility, tactics and leadership, plus four equipment slots, arrows, stones and provisions. XP grants levels and stat points. Town shops sell weapons, armor, shields, quivers, arrows and stones; battle loot can add equipment and supplies. Bow and rock pouch choices carry into battle, and ammunition spent returns to the campaign inventory.
- **Town visits pause the world.** Entering a settlement opens its service and market screen and pauses campaign time. Campaign time offers pause and 1×, 2× and 4× controls; roaming parties only move as the player travels. A compact time bar and larger touch targets support phones.
- **Existing campaign flow remains.** Pursuit, encounter conversations, troop casualties, survivors, rewards and local saves continue to use the existing V4.x campaign storage. Classic and Lab pages are unchanged.

## V4.3 — Automatic campaign battles and a focused battle HUD

- **Click to follow a moving party.** Selecting a roaming bandit, patrol, or caravan begins pursuit instead of simply inspecting their old coordinates. The player's route recalculates as the party moves, keeping the player camera centered while chasing (even if normal map-follow was disabled). Clicking a settlement still offers its normal route.
- **Conversations before combat.** Catching a party opens a modal with the other party's identity and strength, your troop totals, and choices to speak, trade/ask for news, lead troops into battle, or leave. Nearby hostile bandits also stop the player and open the encounter instead of automatically triggering a win/loss roll. Caravans can sell provisions.
- **Campaign battles run in real time.** `campaign-battle.html` uses the physical combat engine with your actual healthy faction troops, equipment, hero health and the enemy party's size. Both armies use their AI, morale, formations and terrain rules; the camera follows your commander. V4.4 adds the choice to take manual control.
- **Results matter in the campaign.** When the physical battle ends, a return button writes its troop-by-troop survivor and casualty records, the hero's remaining health, and winner into browser-local campaign storage. Returning applies deaths/captures, wounded soldiers, gold, experience, renown, loot and defeated world-party state. Returning results is single-use, so reloads cannot multiply loot. Troops beyond the 50-soldier battlefield limit remain in reserve. If you flee, the enemy remains on the world map.
- **The overworld feels inhabited.** 54 naturally scattered explorable locations now appear while zoomed in, including abandoned ruins, shrines, watchtowers, traveler camps, hidden groves and river fords. The first visit yields small provisions, denars and experience, and discovery progress saves between sessions. The map interface includes a **Nearby Discovery** option.

Campaign battles are fought on the existing 2D physics battlefield, not in a 3D third-person view. Settlement interactions, diplomacy and armies will keep evolving. Original `classic.html` and `lab.html` remain unchanged as developer test environments. Existing V4.x browser-local saves keep their format and remain usable.

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

The campaign is still an evolving sandbox: it has upkeep, markets, faction standing, contracts and playable 2D battles, while lords, AI-led sieges, third-person battles and player-founded factions remain future work. Classic and Lab preserve the original combat test modes.

## Development

The app is static HTML, CSS and JavaScript: `index.html` (main menu / campaign), `campaign.css`, `world-data.js`, `campaign.js`, `campaign-battle.html` (playable campaign encounters), `classic.html` (combat testing), and `lab.html` (six-arena balance laboratory). No server or database is required for the present alpha.


