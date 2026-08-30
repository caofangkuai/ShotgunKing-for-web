# Shotgun King: Source Code Analysis & Porting Reference

## Overview

Shotgun King is a chess-roguelike hybrid built on a custom Lua engine ("Sugar"). You play as the **Black King** armed with a **shotgun**, fighting the **White army** across procedurally-generated floors. The game alternates between your turn (move or shoot) and the enemy's turn (white pieces move/attack using chess rules modified by cards).

The codebase is split across multiple files:

* `code/data.lua` - Platform config, global constants, options

* `code/gameplay.lua` - Data definitions: CARDS, PIECES, HERO\_INIT, TAGS

* `code/grid.lua` - AI grid simulation & scoring system

* `code/save.lua` - Save/load system (hoard library)

* `code/menu.lua` - Menu, UI, rank/weapon selection, credits, intro

* `code.lua` - **Main engine** (\~14000 lines): all game logic (turns, movement, combat, AI, levels)

* `code/modes/throne.lua` - Main game mode (weapons, ranks, level progression)

***

## 1. code/data.lua - Platform Configuration & Constants

### Key Constants (CRITICAL for porting)

```lua
MCW = 320    -- Canvas width (virtual pixels)
MCH = 180    -- Canvas height
MSC = 4      -- Pixel scale multiplier
SQ  = 16     -- Square size in pixels (board tiles are 16x16)
TEMPO = 20   -- Default animation tempo (frames) for piece moves
PDY = -2     -- Piece draw Y offset
HALF_POOL = 80
```

### Direction System

```lua
DIRS = {1,0, 0,1, -1,0, 0,-1, 1,1, -1,1, -1,-1, 1,-1}
-- 8 directions indexed 0-7:
-- 0=right, 1=down, 2=left, 3=up, 4=down-right, 5=down-left, 6=up-left, 7=up-right
ADI = {0,4,1,5,2,6,3,7}  -- Anti-diagonal index reordering for shooting angles
KNIGHT_MOVES = {2,-1,2,1, 1,2,-1,2, -2,-1,-2,1, -1,-2,1,-2}
```

### Draw Priority (z-layering)

```lua
DP_BG=0, DP_BOARD=1, DP_SHADES=2, DP_PIECES=3, DP_FX=4, DP_INTER=5, DP_TOP=6
```

### Options System

```lua
OPTIONS = {
    {id="music",      nid="music",      opt=11, def=10},
    {id="sfx",        nid="sfx",        opt=11, def=10},
    {id="fullscren",  nid="fullscreen", opt=2,  def=1},
    {id="crt",        nid="crt",        opt=11, def=1},
    {id="speedrun",   nid="speedrun",   opt=2,  def=0},
    {id="shields",    nid="shields",    opt=4,  def=2},
    {id="show_danger",nid="show_danger",opt=2,  def=1},
    {id="scr.shake",  nid="scrshake",   opt=2,  def=1},
    {id="scr.flash",  nid="scrflash",   opt=2,  def=1},
    {id="lang",       nid="lang",       opt=#LANGUAGES, def=99},
    {id="HD text",    nid="hdtext",     opt=2,  def=0},
}
-- opt=11 means slider 0-10; opt=2 means toggle 0/1
```

### Build/Platform

```lua
BUILD_TYPE = "PC"  -- or ANDROID, NX_EU, NX_H2, XBOX, PS, TRAILER
VERSION = "1.515g"
BOOT = "MENU"     -- or "GAME", "ACHIEVEMENTS"
```

### ROLES (special piece identities)

```lua
ROLES = { {id="heir"}, {id="spy"} }
```

### ITEMS (level-up reward groups)

Arrays of card names organized by category (Hearth A/B/C, Large Wall, Furniture).

***

## 2. code/gameplay.lua - Game Data Definitions

### PIECES Table (12 piece types)

Each piece has: `type`, `name`, `hp`, `tempo` (turns between actions), `behavior` (movement/attack patterns), `danger` (AI weight), `seek` (distance metric key), and various flags.

```lua
PIECES = {
  [0] = {type=0, name="pawn",   hp=3,  tempo=5,
    behavior={
      {id="line", 1,1,1, move=1},        -- move: diagonal forward (dir 1, range 1)
      {id="line", 4,5,1, atk=1},          -- attack: forward diagonals (dir 4-5, range 1)
    }, danger=1, seek="wdist"},
  [1] = {type=1, name="knight", hp=3, tempo=3,
    behavior={
      {id="jump", move=1, atk=1, 2,-1,2,1, 1,2,-1,2, -2,-1,-2,1, -1,-2,1,-2}
    }, danger=3, seek="kdist", nocarry=1},
  [2] = {type=2, name="bishop", hp=4, tempo=3,
    behavior={{id="line",4,7,8, move=1, atk=1}},  -- diagonals (dir 4-7), range 8
    danger=3, seek="bdist"},
  [3] = {type=3, name="rook", hp=5, tempo=4,
    behavior={{id="line",0,3,8, move=1, atk=1}},   -- orthogonal (dir 0-3), range 8
    danger=6, seek="rdist", nocarry=1},
  [4] = {type=4, name="queen", hp=5, tempo=4,
    behavior={{id="line",0,7,8, move=1, atk=1}},   -- all 8 dirs, range 8
    danger=9, seek="qdist"},
  [5] = {type=5, name="king", hp=8, tempo=4,
    behavior={{id="line",0,7,1, move=1, atk=1}},   -- all 8 dirs, range 1
    danger=6, seek="wdist"},
  [6] = {type=6, name="boss", hp=24, tempo=3, boss=1, big=true,
    behavior={
      {id="line",0,3,1, move=1},                    -- move: orthogonal, range 1
      {id="jump",2,0,2,1, 0,2,1,2, -1,0,-1,1, 0,-1,1,-1, atk=1, fatality="eat"}  -- L-shaped attack that eats the king
    }, danger=16, seek="wdist", hdy=-24, nocarry=1},
  [7] = {type=7, name="all"},      -- meta-type for targeting all pieces
  [8] = {type=8, name="leader"},   -- meta-type (resolves to king or ruler type)
  [9] = {type=9, name="cannonball", hp=99, tempo=4, behavior={}, inert=true, freelift=1, knockback=100},
  [10] = {type=10, name="queen mother", hp=30, tempo=4, boss=1, ...},
  [11] = {type=11, name="horseman", hp=12, tempo=4, team_boss=1, ...},
}
```

**Behavior format**: `{id="line", dirStart, dirEnd, maxRange, move=1, atk=1, fatality=...}` or `{id="jump", move=1, atk=1, x1,y1, x2,y2, ...}`

**Tempo**: Number of turns a piece must wait between actions. `e.cd` increments each turn; when `e.cd >= tempo`, piece is `ready`.

### HERO\_INIT (Black King base stats)

```lua
HERO_INIT = {
  ammo_max=5,        -- max reserve ammo
  chamber_max=2,     -- max shells in chamber
  firepower=4,       -- bullets per shot
  firerange=3,       -- shooting range in squares
  ammo_regen=1,      -- ammo regenerated per turn
  spread=57,         -- bullet spread angle (degrees/10)
  knockback=0,       -- knockback chance %
  pierce=0,          -- pierce chance %
  special="none",    -- active special ability
  ai_lvl=0,          -- AI difficulty level
}
```

### CARDS Table (156 cards)

Cards are divided into 3 extensions (ext=0,1,2) and have fields like:

* `gid` - global ID for save stats

* `ext` - extension (0=base, 1=expansion A, 2=expansion B)

* `n` - number of copies in pool

* `id` - card name

* `team` - 0=white (enemy buff), 1=black (player buff)

* Various effect keys (ammo\_max, firepower, spread, knockback, etc.)

* `need` / `sac` / `gain` - army composition: `gain={3}` adds 3 queens, `sac=5` removes 5 pawns

* `need_card` / `need_tag` - prerequisites

* `flip_on` - auto-flip conditions ("no\_knight", "inner", "contact", etc.)

* `special` - "grenade", "decree", "strafe", "scope", "orb"

* `wand` - wand effects `{type, ...params}`

Example cards:

```lua
{gid=0, n=3, id="Ermine Belt", ammo_max=3}
{gid=7, n=2, id="Blunderbuss", spread=30, firepower=2}
{gid=23, n=3, id="Kingly Alms", grenades_max=1, grenade_center_dmg=2, special="grenade"}
{gid=80, id="Backups", gain={0,0,0}, n=3, team=1}  -- adds 3 pawns over time
```

### TAGS (card grouping for synergies)

```lua
TAGS = {
  {id="leader", attributes={"leader","king","heir","rook_leaderbond","rook_castle","ruler"}},
  {id="mission", attributes={"waypoint","spy"}},
  {id="cloak", attributes={"holocloak","pawn_disguise"}},
  {id="bleed", attributes={"grenade_bleed","tearing","caltrops"}},
  {id="orb", attributes={"orb"}, special={"orb"}},
  {id="jump", attributes={"hop"}},
  {id="grenade", attributes={"freegren"}, special={"grenade"}},
  {id="blade", attributes={"blade"}, except={"Full Plate Armor"}},
}
```

### Other Definitions

```lua
EXCLUDE = {{"Royal Loafers","Sawed-off Justice"}, ...}  -- mutually exclusive cards
AUTO_REPLACE = {{"Bodyguard","Commoner's Reign","Self-Defense"}}  -- card replacement rules
COUNTERS = {"poisoned","stun"}  -- status effects that decrement each turn
FIRST_ARMY = {3,0,0,0,1,5,2,0}  -- default white army: [pawn,knight,bishop,rook,queen,king,...]
```

***

## 3. code/grid.lua - AI Grid Simulation System

This file implements the **enemy AI decision-making** via grid simulation. The AI creates hypothetical grids for each possible move, scores them, and picks the best.

### mk\_grid()

Creates a grid object that maps pieces to squares:

```lua
grid.pos = {}  -- piece -> square mapping
grid.mov(p, tsq)  -- move piece p to target square tsq
grid.push(p, di)  -- recursively push pieces in direction di (for Sokoban rooks)
grid.piece_at(sq)  -- find which piece occupies a square (handles big pieces)
```

### paint\_danger(grid)

For each enemy piece, calculates its attack range and marks squares as dangerous (`sq.dan` counter). Used to determine which squares threaten the king.

### score\_grid(grid, from)

**The core AI scoring function.** Evaluates a hypothetical board state. Higher score = better for white army. Key scoring factors:

* **Army sum**: Each piece contributes its `danger` value

* **Promotion eval**: Pawns near row 7 get bonus (promotion threat)

* **Danger painting**: Marks squares threatened by enemy attacks

* **Moat penalty**: Pieces stuck in moat get penalty

* **Fear**: Frightened pieces prefer distance from king

* **Guard**: Jesters prefer proximity to king

* **Cover**: Leader pieces blocking line-of-sight to king get bonus

* **Seek distance**: Pieces prefer moving toward king (uses `seek` metric)

* **King endangerment**: +2000 score if hero target square unoccupied, +5 if king in danger, +3 for single threat

* **AI level**: Higher `ai_lvl` considers more squares as dangerous

### pside(sq)

Determines board half: `py>4` = 1 (white side), `py<4` = -1 (black side), `py==4` = 0 (middle).

***

## 4. code/save.lua - Save System

### Architecture

Uses the "hoard" library (from libs/hoard.lua) with three save objects:

* **DEN** - Persistent progress (cloud-synced): prog, stats, achievements, misc

* **SET** - Settings (local only): music, sfx, fullscreen, language, etc.

* **MODSAV** - Mod-specific saves

### Data Structures

```lua
DEN.prog.throne = {
  rank_sel, weapon_sel,  -- selected rank/weapon in menu
  rank,                   -- max rank completed
  lvl = {},               -- best floor reached per rank
  best_time = {},         -- best completion time per rank
  badges = {},            -- achievement badges per weapon
  weapon_unl = {},        -- unlocked weapons
}
DEN.prog.endless = best_floor
DEN.prog.chase = {score, turns}
DEN.prog.tutorialdone = bool
DEN.stats = { [card_id] = {played=N, ignored=N} }  -- codex card stats
DEN.achievements = { [ach_id] = true }
DEN.misc = { fireplace, codexitems }
```

### Key Functions

* `check_save()` - Main entry: loads from cloud/Steam/PSN/Xbox, migrates legacy saves

* `load_legacy_save()` - Migrates old `.bnk` bank format to new hoard system

* `init_banks()` - Initializes old bank-based storage with corruption checking

* `check_corrupt(save)` - Validates save data (checks for invalid characters)

* `reset_settings()` / `reset_save()` / `reset_stats()` - Reset functions

* `inc_stats(id, played)` / `get_stats(id, played)` - Card usage tracking

* `apply_option(id)` - Applies a single setting (volume, shader, language, etc.)

* `apply_options(not_lang)` - Applies all settings at startup

* `set_default_lang()` - Auto-detects system language

* `is_locked(id)` - Mode unlock checks (currently always returns false)

### Save Versioning

```lua
SAVE_VERSION = 1
-- Version stored at bank position (25,0)
-- Version number at (26,0) using get_version_num()
```

### Legacy Bank Layout (for understanding old saves)

* Y0: Options (slider values)

* Y1: Throne unlocks (0=max rank, 1-15=max floor per rank)

* Y2: Records (0=best endless floor, 1-15=best time per rank)

* Y3: Chase (0=best score, 1=best turns)

* Y4: Custom zone (1-7 weapon unlocks)

* Y5: Codex prefs (0=fireplace on/off)

* Y6: Misc codex items

***

## 5. code/menu.lua - Menu & UI System

### Menu Architecture

Menus are built from **entities** (using the `mke()` entity system). Each menu item is an entity with:

* `id` - button identifier

* `name` - display text (from language file)

* `lock` - whether button is disabled

* `dr` - draw function (renders button graphics from spritesheet)

* `but` - child button entity for click/hover detection

* `over` - hover state

### Key Functions

**init\_menu(goto\_play)**

* Sets up title screen with animated castle, trees, pieces

* Plays intro music, handles "press start" prompt

* On first launch shows animated title assembly

**open\_menu(a, type)**

* `a` = array of button IDs

* `type` = "play", "mods", or nil (main menu)

* Default main menu: `{"play","options","codex","credits","quit"}`

* Creates menu buttons with slide-in animations

**mk\_menu\_but(id, x, y, w, h)**

* Creates a menu button entity

* Handles options (sliders for opt=11, toggles for opt=2)

* Shows "best record" for throne/endless/chase modes

* Attaches hint buttons with descriptions

* Button graphics drawn from title spritesheet (9-slice: corners + middle)

**act\_menu(id)**

* Central menu action dispatcher

* Handles: resign, skip\_tutorial, mode launching, play, mods, codex, options, credits, reset\_save, quit, back

* For resign: requires double-click confirmation (sets `self.red=true`)

* Launches game modes via `set_mode(id)` then `rank_select()` or `mode.start()`

**rank\_select()**

* Weapon and rank selection screen

* Creates scrollable panels with arrows for cycling

* Shows weapon stats (firepower, range, spread, knockback, pierce, blade, search)

* Shows rank descriptions

* Start/Back buttons at bottom

**close\_menu(f)**

* Animates buttons sliding out, then calls callback `f`

**set\_mode(id)**

* Loads mode file from `code/modes/<id>.lua`

* For mods: loads from mod folder

* Calls `mode.initialize()`

**init\_vig(seq, nxt)**

* Displays story vignettes (cutscenes) from intro spritesheet

* `seq` = array of vignette IDs, shown sequentially

* Typewriter text effect, click to advance/skip

**init\_credits()**

* Scrolling credits screen with auto-scroll and manual scroll

### Menu Constants

```lua
BUTTON_HEIGHT = 12
```

***

## 6. code.lua - Main Engine (Game Logic)

### Game State Variables

```lua
-- Player state
chamber = 0        -- current shells in chamber
ammo = 0            -- reserve ammo
grenades = 0        -- grenades available
shields = SET.shields  -- folly shields remaining
reloading = nil     -- reload in progress flag
hero                -- the black king entity
aim                 -- targeted enemy (for aimed shots)

-- Board state
squares = {}        -- array of square entities (8x8 grid)
bads = {}           -- array of enemy (white) pieces
boss                -- boss piece reference
seer                -- seer's orb reference
scepters = {}       -- wand entities
souls = {}          -- captured souls

-- Turn state
playing = false     -- true during player's turn
mode.turns          -- global turn counter
ctrl_mode           -- "move", "aim", "click", "grenade"

-- Card system
upgrades = {}        -- permanent cards (weapon + rank)
temporary = {}       -- temporary cards (from level choices)
stack = {}           -- aggregated stat values from all cards
perm = {}            -- set of active card IDs (for need_card checks)
white_army = {}      -- piece type -> count mapping
card_slots = {}      -- card slot entities on screen
cards.pool = {}      -- remaining cards in pool

-- Board geometry
xmax, ymax = 8, 8
board_x = (MCW - xmax*SQ) / 2
board_y = (MCH - ymax*SQ) / 2 + 4
```

### Grid Navigation

```lua
function gsq(x, y, di, n)
  -- Get square at grid coords (x,y), optionally offset by direction di, n steps
  -- Returns nil if out of bounds
  -- Square index: squares[1 + x*ymax + y]
end

function dsq(sq, di, n)
  -- Get square adjacent to sq in direction di
  return gsq(sq.px, sq.py, di, n)
end

function sqp(sq)
  -- Convert grid coords to pixel coords
  return board.x + sq.px*SQ, board.y + sq.py*SQ
end
```

### init\_game()

Resets all game state, sets up board geometry, creates background/board/inter entities, applies upgrades from mode (base stats + weapon + ranks). Calls `new_level()`.

### new\_level()

Creates the 8x8 board:

* Generates 64 square entities with random seeds, checkerboard colors

* Each square has: `px, py` (grid coords), `cl` (color 0/1), `mark`, `danger`, `shells`, `raiders`

* Squares have `upd` (plague particles, shell physics) and `dr` (rendering) functions

* Calls `spawn_pieces()` after a delay

* Places pentagrams, waypoint, flagstones in rows 2-3

* Calls `build_stack()` to apply card effects

### spawn\_pieces()

* Flips face-down cards back up

* Spawns white army pieces from `white_army` table

* Pieces sorted by type (big pieces last), placed in columns 0-7

* Uses `xpos = {3,4,2,5,1,6,0,7}` for center-out placement

* Calls `spawn_hero()` to place the black king

### build\_stack(n)

**Aggregates all card effects into the** **`stack`** **table and** **`white_army`.**

1. Resets `perm` (active card IDs) and `white_army`
2. Initializes `stack` with defaults (ammo\_regen=1, grenade\_dmg=3, soul\_slot=1, etc.)
3. Iterates all cards (upgrades + temporary + slot cards):

   * `sac` removes pieces from army, `gain` adds pieces

   * Numeric values are added to `stack[key]`

   * Tables are concatenated

   * `reversed` cards negate their effects

   * Wand effects stored separately
4. Calls `setup_piece()` on all pieces to apply HP, tempo, and ability bonuses
5. Manages scepters (wands) and soul slots
6. Applies square effects (moat, pentagrams, waypoints, flagstones)

### setup\_piece(e)

Applies card effects to individual pieces:

1. Resets all ability flags (shield, iron, flying, etc.)
2. Sets `hp_max` and `tempo` from PIECES table
3. Iterates all cards, applies effects matching the piece type
4. `parse_effect(key)` extracts piece-type targets from key names (e.g., "knight\_hp" targets knights)
5. Applies behavior modifications (jester moves, pike attacks, orth movement, etc.)
6. Applies HP percentage bonuses (`hprc`)

### Turn System

**The turn cycle**: `play()` (player) -> `opp_turn()` (enemy) -> `init_new_turn()` -> `new_turn()` -> `play()`

**play()** - Starts player's turn:

1. Checks for win/boss death -> skip to `opp_turn()`
2. Handles Final Countdown mechanic
3. Checks for spy reveal
4. Sets `playing = true`
5. Initializes safe mode (folly shield calculations)
6. Defines `shoot()` closure (handles shooting, grenades, decree, strafe, orb)
7. Creates movement buttons for all valid move squares
8. Sets up grab/lift buttons for King's Shoulders
9. Starts `watch_keys()` loop for keyboard/gamepad input

**init\_new\_turn()** - Transition from enemy to player turn:

1. Increments `mode.turns`
2. Adds vampire events
3. Calls `new_turn()`

**new\_turn()** - Prepares new turn:

1. Resets shields to setting value
2. Handles extra turns (hero.extra\_turn)
3. For each enemy piece: increments `cd`, sets `ready` if `cd >= tempo`, decrements status effects (poison, stun)
4. Runs tactic system (limits number of ready piece types)
5. Updates seer predictions
6. Applies plague damage
7. Updates hero state (grenade\_ready, bushido, hop, cloak)
8. Calls `play()`

**opp\_turn()** - Enemy turn start:

1. Waits for bullets/knockback to finish
2. Grabs nearby items
3. Checks for extra turns
4. Checks for boss death / surrender
5. Builds `executions` list (pieces that can attack the king)
6. Calls `opp_move()`

**opp\_move()** - Enemy AI movement:

1. Processes executions (pieces attacking king) via `opp_atk()`
2. Handles async moves (first actions, alt moves)
3. Bow users fire arrows (limited by arrow\_limit)
4. **Sync moves**: For each ready piece, calls `choose_piece_move(e)` to find best move
5. Executes the best move via `goto_sq()`, then calls `init_new_turn()`

**choose\_piece\_move(e)** - AI decision:

1. Checks seer prediction
2. Gets all valid move squares via `get_range(e)`
3. For each move, creates a `mk_grid()`, simulates the move, calls `score_grid()`
4. Sorts grids by score (descending)
5. Picks from top N moves (N depends on `ai_lvl`: higher = picks best more often)
6. Soulless pieces pick randomly

### Movement System

**get\_range(p, tag, soul\_type, planning)** - Calculates move/attack squares:

* `tag` = "move" (default) or "atk"

* Checks peace/fear/stun/deepwater conditions

* For "line" behaviors: iterates directions from `bh[1]` to `bh[2]`, up to `bh[3]+inc_range` range

* For "jump" behaviors: checks each (x,y) offset pair

* `pass()` function: handles hopping over pieces, flying, moat blocking

* `add_sq()`: adds valid squares to result, marks fatality types

* Presence ability: removes squares adjacent to hero from enemy move options

**move\_hero(tsq, f, skip\_reload, tempo, just\_check)** - Player movement:

1. Checks pentagrams (earn extra turn, evolve at 3)
2. Checks waypoint (triggers disrupt mission)
3. Checks spy reveal
4. Auto-actions on move: throw lifted piece, fire if aimed, reload, or regen ammo
5. Calls `goto_sq(hero, tsq, tempo, f)` to animate movement

**goto\_sq(e, sq, t, f, jh)** - Universal piece movement:

1. Leaves current square (`leave_sq()`)
2. Occupies new square (handles big pieces occupying 4 squares)
3. Animates via `mvt()` (movement tween) with jump arc
4. On landing: checks caltrops (bleed chance), triggers mode callbacks
5. Handles hop mechanics (jumping over pieces for damage)
6. Checks promotion (pawns reaching row 7)

### Combat System

**shoot(wild, sq)** - Player shooting:

1. Handles special modes (grenade, decree=autofire, strafe=targeting, orb=seer)
2. Calculates recoil square (for Sawed-off Justice)
3. Safety check: `check_fatality()` (can you kill the threat?) and `check_folly_shields()` (would you die?)
4. If unsafe and not wild: cancels shot, shows warning
5. If safe: calls `fire()`, applies recoil movement, then `opp_turn()`

**fire()** - Fires the shotgun:

1. Spawns `get_firepower()` bullets, each with random spread angle
2. Each bullet: `mk_bullet(x, y, angle, speed, hero)`
3. Decrements chamber by 1
4. Exposes hero if cloaked (unless silencer)

**mk\_bullet(x, y, an, spd, from)** - Creates a bullet entity:

1. `life = get_firerange()*2 + random(5)` (travel distance)
2. `dmg = 1` per bullet
3. `pierce = stack.pierce` (chance to pass through)
4. Update function: checks collisions with enemy pieces (sub-stepped for accuracy)
5. On hit: calls `hit(piece, dmg, attributes, bullet, from_sq)`
6. Pierce: `done[piece]=true`, halves pierce chance

**hit(e, dmg, at, from, fsq)** - Damage application:

1. Applies knockback (chance-based, pushes piece away)
2. Iron pieces: immune to damage, just show effect
3. Applies bleed bonus damage (+1 if bleeding)
4. Damage cap: if piece has protector nearby, capped at 2
5. Shield/buckler/castle protection checks
6. Reduces HP, triggers death if HP <= 0
7. Status effects: stun, bleed infliction

**Stat Calculation Functions**:

```lua
get_firepower(raw)  -- stack.firepower + square boost + soul absolution + confidence + full_firepower
get_firerange(raw)  -- stack.firerange + boost + scope bonus + full_firerange
get_spread(raw)     -- stack.spread + boost - 45 if scoped, min 5
```

### Level Progression

**end\_level(nxt, no\_music)** - Floor complete:

1. Animates hero leaving (ascending beam)
2. Removes board tiles with crumbling animation
3. Kills leftover pieces, shells, projectiles
4. Calls `bye_level()` -> `nxt()` (usually `grow()`)

**level\_up(data, nxt)** - Card selection screen:

1. Shows card choice panels (2x2 grid of card pairs)
2. Each choice: white card (enemy) + black card (player)
3. Patience: browse extra card before choosing
4. Bold Plan: replace a white card
5. Search/recycle: reroll cards
6. After choosing: `add_card()`, then `nxt()` (usually `next_floor()`)

**throne.lua progression**:

* 11 floors (level 1-10 normal, 11 = boss)

* After floor 10: `grow()` adds {gain={6}, sac={5}} then boss vignette

* Boss death triggers `on_boss_death()`:

  * Dark Bishop spawn (if Red Book + Theocracy + 1 bishop)

  * Queen Mother spawn (if 1 iron queen)

  * Horsemen of the Apocalypse (if 4 knights)

  * Otherwise: ending vignette -> `outro()`

### Weapons (throne.lua)

```lua
weapons = {
  {name="Solomon",     chamber_max=2, firepower=4, firerange=3, spread=55, ammo_max=6},
  {name="Victoria",   chamber_max=1, firepower=5, firerange=4, spread=45, ammo_max=3},
  {name="Ramesses II",chamber_max=2, firepower=4, firerange=3, spread=65, ammo_max=5, knockback=50},
  {name="Richard III",chamber_max=3, firepower=3, firerange=5, spread=75, ammo_max=8, pierce=25},
  {name="Makeda",     chamber_max=2, firepower=3, firerange=3, spread=50, ammo_max=6, blade=2},
  {name="Alexander",  chamber_max=2, firepower=4, firerange=3, spread=65, ammo_max=8, search=1},
  {name="Yvan IV",    chamber_max=1, firepower=4, firerange=2, spread=50, ammo_max=6, all_freereload=1},
}
```

### Ranks (throne.lua) - 15 difficulty levels

```lua
ranks = {
  {nothing=1},         -- Rank 1: no change
  {gain={0,0}},        -- Rank 2: standard army
  {gain={3}},          -- Rank 3: +1 queen
  {ai_lvl=1},          -- Rank 4: smarter AI
  {gain={1}},          -- Rank 5: +1 knight
  {spread=10},         -- Rank 6: +10 spread
  {king_hp=1},         -- Rank 7: king +1 HP
  {gain={2}},          -- Rank 8: +1 bishop
  {rook_hp=1},         -- Rank 9: rook +1 HP
  {ai_lvl=1},          -- Rank 10: smarter AI
  {boss_hprc=200},     -- Rank 11: boss +200% HP
  {spread=15},         -- Rank 12: +15 spread
  {rook_hp=1},         -- Rank 13: rook +1 HP
  {ammo_max=-1},       -- Rank 14: -1 ammo
  {all_hp=1, ammo_max=2}, -- Rank 15: all +1 HP, +2 ammo
}
```

### Base mode config (throne.lua)

```lua
base = {
  pawn_promote=1,  -- pawns can promote
  surrender=1,     -- surrender when last leader dies
  gain={0,0,0,1,5,2,0},  -- army: 0 pawns,0 knights,0 bishops,1 rook,5 queens,2 kings
  ai_lvl=0,
}
```

***

## Porting Notes for HTML5 Canvas + JavaScript

### Coordinate System

* Virtual resolution: 320x180 pixels, scaled by MSC=4 to 1280x720

* Board: 8x8 grid, each square 16x16 pixels

* Board origin: `board_x = (320 - 8*16)/2 = 96`, `board_y = (180 - 8*16)/2 + 4 = 44`

### Entity System

The Lua engine uses `mke()` to create entities with `upd` (update), `dr` (draw), `x/y/z` (position), `life` (timer), `dp` (draw priority). In JS, represent these as objects in arrays sorted by `dp`.

### Animation/Tween System

* `mvt(entity, dx, dy, tempo, callback)` - move tween

* `mv(entity, dx, dy, tempo, callback)` - relative move

* `wait(frames, function, ...args)` - delayed callback

* `loop(function, duration, ...args)` - repeating update loop

* Tween curves: `ease_in`, `ease_out`, `ease_in_out`, `ease_bounce_out`, `ease_uturn`

* Game runs at 60 FPS (`fpslimit(60)`)

### Key Game Flow for Porting

1. **init\_menu()** -> title screen
2. **rank\_select()** -> choose weapon + rank
3. **mode.start()** -> intro vignettes -> `init_game()` -> `new_level()` -> `spawn_pieces()` -> `spawn_hero()` -> `build_stack()` -> `play()`
4. **Player turn**: show move squares, handle input, `move_hero()` or `shoot()` -> `opp_turn()`
5. **Enemy turn**: `opp_move()` -> `choose_piece_move()` (AI) -> `goto_sq()` -> `opp_atk()` -> `init_new_turn()` -> `new_turn()` -> `play()`
6. **Floor complete**: `on_empty()` -> `end_level()` -> `level_up()` (card choice) -> `next_floor()` -> `new_level()`
7. **Boss floor (11)**: special spawn logic -> `on_boss_death()` -> `outro()` -> ending

### AI Porting Strategy

The AI uses grid simulation: for each possible enemy move, create a copy of the board, apply the move, score it with `score_grid()`, pick the best. In JS, implement deep copy of board state, then run the scoring heuristics. The `ai_lvl` (0-2) controls randomness (picks from top 3, 2, or 1 moves).

### Card System Porting

Cards are plain data objects. Effects are applied by iterating all active cards in `build_stack()` and `setup_piece()`. Effect keys directly map to stat names. Parse piece-type prefixes (e.g., "knight\_hp" -> applies to knights only) using `parse_effect()`.

### Rendering Notes

* Uses spritesheet-based rendering (`sspr`, `spr`)

* Palette swapping (`pal`, `apal`) for color variations

* Multiple draw layers (DP\_BG through DP\_TOP)

* CRT shader effect (curve + scanlines) - optional in web port

* Text rendering with custom pixel fonts (`lprint`, `pprint`)

