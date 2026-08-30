# Shotgun King: UI/Rendering System Analysis

## Complete Reference for HTML5 Canvas + JavaScript Replication

---

## 1. SCREEN RESOLUTION AND COORDINATE SYSTEM

### Core Constants (defined in `code/data.lua`)

```
MCW = 320    -- Main Canvas Width (internal resolution)
MCH = 180    -- Main Canvas Height (internal resolution)
MSC = 4      -- Main Scale Factor (window scale)
SQ  = 16     -- Square/tile size in pixels
```

- The game renders at an internal resolution of **320x180 pixels**.
- The window is created at `MCW * MSC` = 1280x720 (or scaled to fit).
- All game coordinates are in the 320x180 internal space.
- The board is an 8x8 grid of SQ(16)-pixel squares = 128x128 pixels.
- Board position is centered: `board_x = (MCW - xmax*SQ) / 2`, `board_y = (MCH - ymax*SQ) / 2 + 4`.
- **Origin (0,0)** is top-left. X increases right, Y increases downward.
- The game uses a fixed 60 FPS loop (`fpslimit(60)`).

### Depth Layers (render order, lowest to highest)

```
DP_BG     = 0    -- Background
DP_BOARD  = 1    -- Board squares, souls slots
DP_SHADES = 2    -- Shadows, shades
DP_PIECES = 3    -- Game pieces, entities (default)
DP_FX     = 4    -- Effects, particles, square buttons
DP_INTER  = 5    -- UI, buttons, HUD overlays
DP_TOP    = 6    -- Top-most layer (above pause dimming)
```

Entities are sorted into 16 depth buckets (0-15) and rendered in order. Within each bucket, entities can also be Y-sorted for proper overlapping.

### Direction Constants

```
DIRS = { 1,0, 0,1, -1,0, 0,-1, 1,1, -1,1, -1,-1, 1,-1 }  -- 8 directions as x,y pairs
ADI  = {0,4,1,5,2,6,3,7}  -- adjacency index mapping
KNIGHT_MOVES = { 2,-1,2,1, 1,2,-1,2, -2,-1,-2,1, -1,-2,1,-2 }
```

### Color Palette

The game uses a 16-color palette (indices 0-15), PICO-8 style. Key colors:
- 0: transparent/black
- 1: dark blue/black (shadows)
- 2: dark purple
- 3: brown/mid-dark
- 4: gray/light
- 5: white/light

Palette is extracted from the spritesheet: `palette("assets/gfx/gfx.png")`.

Force-color constants map to specific palette entries:
```
FORCE_DARK   = 10
FORCE_MEDIUM = 11
FORCE_BRIGHT = 12
```

These are remapped every frame in `_draw()`:
```lua
pal(FORCE_DARK, 2, true)    -- force color 10 -> palette 2
pal(FORCE_MEDIUM, 3, true)  -- force color 11 -> palette 3
pal(FORCE_BRIGHT, 4, true)  -- force color 12 -> palette 4
```

---

## 2. SUGAR ENGINE API (Rendering Functions)

The game runs on the "Sugar" engine (a PICO-8-like Lua runtime). The README files (`README.md`, `sugar_runtime/README2.md`) only contain "secret punkcake repo" -- no API docs. The API was reverse-engineered from usage across all source files.

### Surface / Target Management

| Function | Description |
|---|---|
| `newsrf(path_or_w, h_or_name, name)` | Create a new surface. Can load from file path or create blank with width/height. Third arg is the surface name. |
| `delsrf(name)` | Delete a surface. |
| `target(name)` | Set the current render target surface. `target()` with no arg returns to the main screen. |
| `srfshot(path, scale, transparent)` | Screenshot/export the current target to a file. |
| `srfmem()` | Returns address and length of the surface memory. |
| `srfsize()` | Returns width and height of current target. |
| `newwin(title, w, h, scale, mode, ...)` | Create the game window. Mode is "resize" or "fullscreen". Optional shader path. |
| `winspec(key, ...)` | Set window properties ("title", "screen", "overlay"). |
| `fpslimit(n)` | Set frame rate limit (60). |
| `shdrf(name, val)` | Set shader float parameter. |
| `flip()` | Flip buffers (used during export). |

### Spritesheet Management

| Function | Description |
|---|---|
| `spritesheet(name)` | Set the active spritesheet for `spr()`/`sspr()` calls. |
| `sprgrid(w, h)` | Set the sprite grid cell size (default 16x16). Used for `spr()` indexing. |
| `spr(fr, x, y, sw, sh, flx, fly)` | Draw sprite `fr` at (x,y). sw/sh are scale multipliers (in grid units). flx/fly are flip flags. |
| `sspr(sx, sy, sw, sh, dx, dy, dw, dh)` | Draw a sub-region of the spritesheet. Source rect (sx,sy,sw,sh) to destination (dx,dy,dw,dh). dw/dh can be negative for flipping. |
| `sget(x, y)` | Get pixel color at (x,y) on the spritesheet. |
| `pget(x, y)` | Get pixel color at (x,y) on the current target. |
| `pset(x, y, c)` | Set pixel at (x,y) to color c. |

### Drawing Primitives

| Function | Description |
|---|---|
| `cls(c)` | Clear screen to color c (default 0). |
| `camera(x, y)` | Set camera offset. `camera()` resets to (0,0). |
| `tcamera(dx, dy)` | Translate camera (add to current offset). |
| `clip(x, y, w, h, relative)` | Set clipping rectangle. `clip()` clears it. |
| `rect(x0, y0, x1, y1, c)` | Draw rectangle outline. Uses corner coordinates (x0,y0) to (x1,y1). |
| `rectfill(x0, y0, x1, y1, c)` | Draw filled rectangle. Uses corner coordinates. |
| `circ(x, y, r, c)` | Draw circle outline at (x,y) with radius r. |
| `circfill(x, y, r, c)` | Draw filled circle. |
| `line(x0, y0, x1, y1, c)` | Draw a line. |
| `pset(x, y, c)` | Set a single pixel. |
| `fillp(pattern, transparent)` | Set fill pattern (dithering/transparency). `fillp()` resets. Pattern is a bitmask. |

### Palette Manipulation

| Function | Description |
|---|---|
| `pal(c_from, c_to, transparent)` | Remap color c_from to c_to. If transparent flag is set, affects transparent drawing. `pal()` with no args resets. `pal(table, transparent)` sets entire palette from a table. |
| `palt(c, flag)` | Set whether color c is treated as transparent. |
| `palette(file)` | Load palette from an image file. Returns palette table. |
| `pal_rst()` | Reset palette to default (custom function in code.lua). |
| `pal_inc(k)` | Shift all palette colors by k (custom function). |
| `blend(mode, a, b)` | Set blend mode between colors a and b. |

### Font / Text

| Function | Description |
|---|---|
| `addfont(name, overlay, path, size)` | Register a font. overlay=true means it renders on the HD overlay surface. |
| `font(name)` | Set active font. `font()` returns current font name. |
| `fntspec(key, val)` | Set font specification parameters (h, dy, etc.). |
| `print(str, x, y, c)` | Print string at (x,y) in color c. Returns x position after printing. |
| `bprint(str, x, y, w, c)` | Print string with word-wrap to width w. Returns y after printing. |
| `strwidth(str)` | Get pixel width of string in current font. |
| `txtinp(callback)` | Register text input callback (for cheat codes). |

### Input

| Function | Description |
|---|---|
| `btn(name)` | Is button currently held? |
| `btnp(name)` | Was button just pressed this frame? |
| `btnr(name)` | Was button just released this frame? |
| `btnv(name)` | Get button analog value (for sticks/mouse). |
| `defbtn(name, val, input_str)` | Define a named button mapping. |
| `controls(input_assignments)` | Load control mappings. |
| `mx, my` | Global mouse x,y position (in game coordinates). |
| `mcl` | Mouse left click (just pressed). |
| `mcr` | Mouse right click. |
| `mlb` | Mouse left button (held). |

### Audio

| Function | Description |
|---|---|
| `newsfx(path)` | Load a sound effect. |
| `sfx(name, vol)` | Play sound effect at volume. |
| `newmus(path)` | Load music. |
| `music(name, fade, loop)` | Play music track. |

### Other Engine Functions

| Function | Description |
|---|---|
| `time()` | Get elapsed time in seconds (float). |
| `rnd(n)` | Random float 0 to n. |
| `irnd(n)` | Random integer 0 to n-1. |
| `cos(a)`, `sin(a)` | Trig functions (angle in turns, 0=right, 0.25=down). |
| `atan2(dx, dy)` | Arc tangent (returns in turns, 0=right). |
| `sqrt(n)`, `pow(a,b)` | Math functions. |
| `flr(n)` | Floor (overridden to support optional second arg for rounding). |
| `mid(a, b, c)` | Clamp/middle value. |
| `abs(n)` | Absolute value. |
| `sub(str, a, b)` | Substring. |
| `sbs(str, find, replace)` | String replace. |
| `split(str, sep)` | Split string into table. |
| `clipboard(s)` | Get/set clipboard. |
| `file(path, content)` | Read/write file. |
| `log(msg)` | Print to log. |

---

## 3. RENDERING PIPELINE (code.lua)

### Initialization (`_init()`)

```lua
function _init()
    -- 1. Load palette from the main spritesheet
    palette("assets/gfx/gfx.png")

    -- 2. Load all sound effects and music
    dirload("assets/sfx", "wav", newsfx)
    dirload("assets/music", "mp3", newmus)

    -- 3. Create/load all sprite surfaces
    newsrf("assets/gfx/gfx.png", "gfx")
    newsrf("assets/gfx/console_Xbox.png", "console_Xbox")
    -- ... (console_PS5, console_PS4, console_NX, console_PC, cards, title, intro, crumble, achievements, weapons, codex, tutorial, logo_hd)
    newsrf(106, MCH, "playground")          -- blank 106x180 surface
    newsrf(190, ceil(#ACHIEVEMENTS/5)*38-1, "achievements_pane")
    newsrf(64, 64, "big_achievement")

    -- 4. Load fonts
    addfont("pico", false, "assets/gfx/pico_font.png", "!\"#...~")
    addfont("Terminus", true, "assets/fonts/Terminus.ttf", 12)

    -- 5. Load language
    load_lang("safe_english")

    -- 6. Create window
    newwin("Shotgun King", MCW, MCH, MSC, wmode, "scale", shader)

    -- 7. Set default spritesheet and grid
    spritesheet("gfx")
    sprgrid(16, 16)

    -- 8. Generate procedural graphics (grenade animation, explosions, spirals)
    gen_gfx()

    -- 9. Boot into menu or game
    boot()
end
```

### Procedural Graphic Generation (`gen_gfx()`)

The game generates several surfaces programmatically using drawing primitives:

1. **Grenade animation** (12 frames, each 48x32): Uses `circfill()` with growing radius, color 5 outer / 0 inner.
2. **Mini explosion** (12 frames, each 16x16): `circfill()` with offset for directional explosion.
3. **Spiral** (64x64): Uses `line()` in a growing spiral pattern.

All generated using `target("surface_name")` then `cls(0)` then draw primitives, then `target()` to return to main screen.

### Main Update Loop (`_update()`)

```lua
function _update()
    _t = _t + 1  -- total frame counter (never pauses)

    -- Frame drop handling
    -- ...

    -- Main update loop
    local function lp()
        gamepad_ctrl()  -- process input

        if pause or skip or frz then
            -- Only update "permanent" entities when paused
            for e in all(ents) do
                if e.perm then upe(e) end
            end
        else
            t = t + 1              -- game time counter
            foreach(ents, upe)     -- update all entities
            foreach(ents_ach, upe) -- update achievement entities
        end
    end

    -- Fast-forward support
    if fast then
        for i = 1, fast do lp() end
    else
        lp()
    end

    target()  -- reset render target to screen

    -- Pause toggle
    if ingame and playing and btnp("pause") then
        if pause then unpause() else pause_game() end
    end
end
```

### Main Draw Loop (`_draw()`)

```lua
function _draw()
    target()           -- ensure we're drawing to screen
    cls(0)             -- clear to black
    camera()           -- reset camera
    fillp()            -- reset fill pattern

    -- Call the mode-specific draw function (mdr)
    if mdr then
        mdr()
    else
        local lents = shallow_copy(ents)
        foreach(lents, dre)  -- draw all entities
    end

    -- Draw achievement popups
    exe(function() foreach(ents_ach, dre) end)

    -- Fade effect: remap colors 0-9 based on fade value (fd)
    if fd ~= 0 then
        if fd == 6 and fast then
            -- Stroked border fade
            rect(0, 0, MCW-1, MCH-1, c)
            rect(1, 1, MCW-2, MCH-2, c)
            rect(2, 2, MCW-3, MCH-3, c)
            rect(3, 3, MCW-4, MCH-4, c)
        else
            -- Palette shift fade: map all colors toward dark/medium/bright
            for i = 0, 9 do
                pal(i, sget(16+i, mid(1, 4+fd, 11)), true)
            end
        end
    end

    -- Force color remapping (dark/medium/bright -> 2/3/4)
    pal(FORCE_DARK, 2, true)
    pal(FORCE_MEDIUM, 3, true)
    pal(FORCE_BRIGHT, 4, true)

    -- Red flash overlay when hero is in danger
    if hero and hero.c_wrong and SET.scrflash == 1 and t%6 < 3 then
        rect(0, 0, MCW-1, MCH-1, 5)
        rect(1, 1, MCW-2, MCH-2, 5)
    end

    camera()  -- reset camera

    -- Debug logs (DEV mode)
    for s in all(logs) do
        print(s, 22, ly, 5)
        ly = ly + 8
    end
end
```

### In-Game Draw Function (`draw_game()`)

This is set as `mdr` (mode draw function) during gameplay:

```lua
function draw_game()
    cls()
    camera()

    -- 1. Y-SORT: Sort entities with a `z` property by their y position
    local a = {}
    for e in all(ents) do if e.z then add(a, e) end end
    custom_sort(a, function(e) return e.y + (e.ysort_dy or 0) end)
    for e in all(a) do del(ents, e); add(ents, e) end

    -- 2. DEPTH SORT: Build 16 depth buckets
    local a = {}
    for i = 0, 15 do add(a, {}) end
    for e in all(ents) do
        add(a[e.dp + 1], e)
    end

    -- 3. SCREEN SHAKE
    local cy = 0
    if inter and inter.c_screen_shake and SET.scrshake == 1 then
        local s = cyc(2, 2, inter.c_screen_shake) * 2 - 1
        cy = s * inter.c_screen_shake
    end

    -- 4. PAUSE DIMMING (darken palette when paused)
    local black = pause or (inter and inter.c_unpause)
    if black then
        pal_inc(-2)  -- shift palette darker
        pause_pal = pal
        pal = function() end  -- disable palette calls during pause
    end

    -- 5. DRAW ALL DEPTH LAYERS (0 to 15)
    camera(0, cy)  -- apply screen shake offset
    depth = 0
    for tbl in all(a) do
        foreach(tbl, dre)  -- draw each entity via dre()
        depth = depth + 1
        if black and depth == DP_TOP then
            pal = pause_pal  -- restore palette for top layer
            pal_rst()
        end
    end
    camera()

    -- 6. Draw speedrun timer (throne mode)
    -- 7. Draw virtual gamepad sticks (VPAD mode)
end
```

### Entity Draw Function (`dre()` from `libs/ents.lua`)

Each entity is drawn via `dre()`:

```lua
function dre(e, ddx, ddy)
    local x = (ddx or 0) + e.x
    local y = (ddy or 0) + e.y

    -- Draw the entity's sprite frame (if fr > 0)
    if e.fr > 0 then
        spr(e.fr, flr(x), flr(y), e.ww/16, e.hh/16, e.flx, e.fly)
    end

    -- Call custom draw function
    if e.dr then e.dr(e, x, y) end

    -- Draw child entities (with camera offset relative to parent)
    if e.ents then
        tcamera(-x, -y)
        foreach(e.ents, dre)
        tcamera(x, y)
    end
end
```

### Entity Update Function (`upe()` from `libs/ents.lua`)

```lua
function upe(e)
    e.t = e.t + 1  -- age counter

    -- Physics: velocity, friction, gravity
    e.vx = e.vx * e.frict
    e.vy = e.vy * e.frict
    e.vy = e.vy + e.we
    e.x = e.x + e.vx
    e.y = e.y + e.vy

    -- Custom update
    if e.upd then e.upd(e) end

    -- Tween animation (movement, jumps, spirals)
    if e.twc then
        local c = min(e.twc + 1/e.tws, 1)
        -- Linear interpolation between start and end positions
        e.x = e.sx + (e.ex - e.sx) * cc
        e.y = e.sy + (e.ey - e.sy) * cc
        -- Jump arc
        if e.jmp then
            local k = sin(c/2) * e.jmp
            e.x = e.x + cos(e.jma or -.25) * k
            e.y = e.y + sin(e.jma or -.25) * k
        end
        -- Spiral movement
        if e.spiral then
            local ray = sin(c/2) * 80
            local an = .5 + cc * 3
            e.x = e.x + cos(an) * ray
            e.y = e.y + sin(an) * ray
        end
        e.twc = c
        if c == 1 then  -- tween complete
            e.twc = nil
            if e.twf then e.twf() end  -- call completion callback
        end
    end

    -- Update child entities
    if e.ents then
        for e in all(e.ents) do upe(e) end
    end

    -- Countdown counters (fields starting with "c_")
    for v, n in pairs(e) do
        if sub(v, 1, 2) == "c_" then
            n = n - 1
            e[v] = n > 0 and n or nil
        end
    end

    -- Life timer (auto-kill when life reaches 0)
    if e.life then
        e.life = e.life - 1
        if e.life <= 0 then kl(e) end
    end
end
```

---

## 4. SPRITESHEET SYSTEM

### Spritesheets Loaded

| Name | File | Grid Size | Usage |
|---|---|---|---|
| `gfx` | `assets/gfx/gfx.png` | 16x16 | Main game sprites (pieces, board, UI icons, effects) |
| `cards` | `assets/gfx/cards.png` | 24x32 | Card artwork |
| `weapons` | `assets/gfx/weapons.png` | 24x16 | Shotgun sprites |
| `title` | `assets/gfx/title.png` | Full 320x180 | Title screen background |
| `intro` | `assets/gfx/intro.png` | Full | Intro vignettes |
| `crumble` | `assets/gfx/crumble.png` | - | Crumble animation |
| `achievements` | `assets/gfx/achievements.png` | 64x64 | Achievement icons |
| `codex` | `assets/gfx/codex.png` | - | Codex room background |
| `tutorial` | `assets/gfx/tutorial.png` | - | Tutorial sprites |
| `logo_hd` | `assets/gfx/logo_hd.png` | - | HD logo |
| `console_*` | `assets/gfx/console_*.png` | - | Controller button icons per platform |

### Sprite Grid System

- `sprgrid(16, 16)` sets the default grid cell size.
- `spr(fr, x, y)` draws sprite number `fr` from the current spritesheet.
- Sprite `fr` is located at grid position: `x = (fr % grid_cols) * 16`, `y = floor(fr / grid_cols) * 16`.
- `sspr(sx, sy, sw, sh, dx, dy, dw, dh)` draws an arbitrary sub-region (more flexible, used for non-grid-aligned sprites).

### Spritesheet Switching

The game frequently switches between spritesheets during drawing:
```lua
spritesheet("weapons")
sspr(fr, fy, 24, 16, board_x + chmax*4 + dx, board.y + dy - 20)
spritesheet("gfx")  -- restore
```

The `ospr()` helper in `libs/ents.lua` provides a save/restore wrapper:
```lua
function ospr(fr, x, y, sheet, gw, gh)
    local a, b, c = my_spritesheet, my_grid_w, my_grid_h
    spritesheet(sheet)
    sprgrid(gw, gh)
    spr(fr, x, y)
    spritesheet(a)
    sprgrid(b, c)
end
```

### Board Square Sprites

Board squares use sprite indices 30-31 (light/dark squares):
```lua
local fr = 30 + sq.cl  -- sq.cl is 0 (dark) or 1 (light)
spr(fr, x, y, 1, 1 + 3/16)  -- slightly taller for depth effect
```

Special board overlays:
- Pentagram: sprite 14
- Waypoint: sprite 15
- Flagstone: `sspr(192, 64, 16, 16, x, y)`

### Card Sprites

Cards are 24x32 pixels, indexed by `gid`:
```lua
spritesheet(ca.spsheet or "cards")
sspr((ca.gid % 10) * 24, floor(ca.gid / 10) * 32, 24, 32, cx, cy)
```

Card back: `sspr(48 + ca.team * 24, 72, 24, 32, cx, cy)` (from gfx sheet).

### UI Icon Sprites (from `gfx` sheet)

- Square action icons: sprites 32+icon (movement indicators, etc.)
- Arrow icons: sprites 32-34
- Ammo/shield/grenade indicators: `sspr(0/4, 56, 3, 7, x, y)` for ammo, `sspr(32/38, 64, 6, 7, x, y)` for shields, `sspr(44/50, 64, 6, 7, x, y)` for grenades
- Chamber/barrel indicators: same as ammo (`sspr(0/4, 56, 3, 7, x, y)`)
- Shotgun: `sspr(fr, fy, 24, 16, x, y)` from weapons sheet (fr=96 normal, fr=120 reloading)
- Stat bars: `sspr(112/114/116, 75, 2, 5, x, y)` (empty/partial/full bar segments)
- Big text: `sspr((k%32)*6, 84+floor(k/32)*7, 6, 7, x, y)` for 6x7 pixel characters

---

## 5. FONT AND TEXT SYSTEM

### Font Registration

```lua
-- PICO-8 style bitmap font (pixel art)
addfont("pico", false, "assets/gfx/pico_font.png", "!\"#°%&'()*+,-./0123456789:;<=>?...")

-- TrueType fonts (HD text, rendered on overlay surface)
addfont("Terminus", true, "assets/fonts/Terminus.ttf", 12)
```

- `overlay = false`: Font renders directly to the screen (pixel font, lower quality).
- `overlay = true`: Font renders to a 2x scale overlay surface for crisp HD text.

### HD Text Overlay System (`libs/hdtext.lua`)

The HD text system creates a separate high-resolution surface:

```lua
OVERLAY_SCALE = 2         -- text rendered at 2x resolution
OVERLAY_SURF = "hdtext"   -- surface name
OVERLAY_TKEY = 255        -- transparent color key
```

**Initialization** (`_lib_init.hdtext()`):
```lua
newsrf(MCW * OVERLAY_SCALE, MCH * OVERLAY_SCALE, OVERLAY_SURF)  -- 640x360 surface
target(OVERLAY_SURF)
cls(OVERLAY_TKEY)  -- clear to transparent
target()
winspec("overlay", OVERLAY_SURF, OVERLAY_TKEY)  -- register as overlay
```

**Per-frame update** (`_lib_update.hdtext()`):
```lua
if _using_overlay then
    target(OVERLAY_SURF)
    cls(OVERLAY_TKEY)  -- clear overlay each frame
    target()
end
```

### Text Drawing Functions

**`lprint(str, x, y, c, align, outline)`** -- Single line print:
- `align`: 0=left, 1=center, 2=right (shifts x by half string width)
- `outline`: if set, draws an outline by printing the text in all 8 directions + center
- For overlay fonts, coordinates are scaled by 2x and camera offset is compensated

```lua
function lprint(str, x, y, c, align, outline)
    if _on_ov then
        target(OVERLAY_SURF)
        -- Scale coordinates
        local csc = (OVERLAY_SCALE - 1)
        x = x * OVERLAY_SCALE - csc * _camx
        y = y * OVERLAY_SCALE - csc * _camy
        -- Draw outline (8-directional + 4-cardinal)
        if outline then
            _print(str, x-2, y, outline)
            _print(str, x+2, y, outline)
            _print(str, x, y-2, outline)
            _print(str, x, y+2, outline)
            _print(str, x-1, y-1, outline)
            _print(str, x+1, y-1, outline)
            _print(str, x-1, y+1, outline)
            _print(str, x+1, y+1, outline)
            _print(str, x-1, y, outline)
            _print(str, x+1, y, outline)
            _print(str, x, y-1, outline)
            _print(str, x, y+1, outline)
        end
        -- Draw text
        res = _print(str, x, y, c)
        target()
        return res / OVERLAY_SCALE
    end
    -- Non-overlay: draw directly
    -- ...
end
```

**`pprint(str, x, y, w, c, align, lim, outline)`** -- Paragraph print with word wrap:
- `w`: max width in pixels for wrapping
- `lim`: character limit
- Word-wraps by finding spaces, breaks lines when width exceeds `w`
- Handles multi-byte (UTF-8) character splitting for CJK languages
- Uses `bprint()` for the actual drawing (batch print with wrap)

**`txtwidth(str)`** -- Get string width, accounting for overlay scaling.

**`hdclear(xa, ya, xb, yb)`** -- Clear a region of the overlay surface.

### Camera-Aware Text

The text system tracks camera position (`_camx`, `_camy`) to properly position text on the overlay when the game camera is offset:
```lua
x = x * OVERLAY_SCALE - csc * _camx
y = y * OVERLAY_SCALE - csc * _camy
```

### Big Text (custom, from spritesheet)

```lua
function write_big_at(s, x, y, cl)
    if cl then pal(21, cl) end
    for i = 1, #s do
        local k = ord(sub(s, i, i)) - 32 - 1
        sspr((k % 32) * 6, 84 + floor(k / 32) * 7, 6, 7, x + (i-1)*6, y)
    end
end
```

This draws 6x7 pixel characters from a custom big font embedded in the gfx spritesheet at y=84.

---

## 6. UI ELEMENT DRAWING

### Button System

**`mk_but(x, y, w, h, f)`** -- Create a rectangular clickable button:
```lua
function mk_but(x, y, w, h, f)
    local e = mke(0, x, y)  -- entity at frame 0
    e.left_clic = f         -- click callback
    e.button = true
    e.clicked = false
    e.dp = DP_INTER          -- UI depth layer
    -- Update: check mouse hover/click, handle gamepad
    e.upd = function()
        -- Calculate global position (accounting for parent chain)
        local bx, by, par = x, y, e.par
        while par do bx = bx + par.x; by = by + par.y; par = par.par end
        -- Hover detection
        local ins = mx >= bx and mx < bx+w and my >= by and my < by+h
        -- Handle mouse over/out/click/drag
        -- Handle touch/gamepad
    end
    -- Optional debug rendering
    if SHOW_BUTS then
        e.dr = function(e, x, y)
            if cyc(2, 3, _t) == 0 then
                rect(x, y, x+w-1, y+h-1, 5)
            end
        end
    end
    return e
end
```

**`mk_square_but(name, f, ww)`** -- Button for the gamepad UI (from `code/menu.lua`):
Creates a button with specific visual style using `lprint` for text.

**`mk_sq_but(sq, f, icon)`** -- Square button on the board:
```lua
function mk_sq_but(sq, f, icon)
    local px, py = sqp(sq)  -- get pixel position from square
    e = mk_but(px, py, SQ, SQ, f)
    e.dp = DP_FX
    e.issq = true
    e.dr = function(e, x, y)
        if ov and icon then
            spr(32 + icon, x, y)  -- draw action icon
        end
    end
end
```

**`mk_hint_but(x, y, w, h, str, ...)`** -- Button that shows a tooltip hint on hover.

**`mk_text_but(x, y, ww, str, f)`** -- Text button with background:
```lua
e.dr = function(e, x, y)
    if e.shd then rectfill(x+n, y+n, x+ww-1+n, y+hh-1+n, 1) end  -- shadow
    rectfill(x, y, x+ww-1, y+hh-1, e.ov and 5 or 3)              -- bg (highlight on hover)
    lprint(str, x+ww/2, y+3, 4, 1)                                -- centered text
end
```

### Gamepad Button Drawing (`code/gamepad.lua`)

```lua
function draw_button(but, x, y, fake, press)
    spritesheet(console_sheet)
    local sprSY = butInfo[but].y
    if btn(but) and not pause then sprSY = sprSY + butInfo[but].h end
    sspr(butInfo[but].x, sprSY, butInfo[but].w, butInfo[but].h, x, y)
    spritesheet("gfx")  -- restore
end
```

Button sprite info is defined per-platform (Xbox, PS, NX, Android, PC):
```lua
butInfo = {
    validate = {x=27, y=19, w=9, h=10},
    cancel = {x=35, y=19, w=9, h=10},
    shoot = {x=13, y=0, w=14, h=9},
    -- ...
}
```

### Board Overlay Drawing

```lua
function draw_on_board()
    if is_select_mode[ctrl_mode] and rov then
        rect(rov.x, rov.y, rov.x + SQ - 1, rov.y + SQ - 1, 5)
    end
end
```

### Shade/Shadow Effects

```lua
-- Solid shade (darken a rectangle)
function rectshade(px, py, ww, hh, n)
    local n = n or -1
    for i = 0, 5 do blend(1, i, bright(i, n)) end
    rectfill(px, py, px+ww-1, py+hh-1, 1)
    for i = 0, 5 do blend(1, i, 1) end
end

-- Dithered shade
function rectshade_dither(px, py, ww, hh, n, dith)
    n = n or -1
    fillp(pat[dith], true)  -- set dithering pattern
    for i = 0, 5 do blend(1, i, bright(i, n)) end
    rectfill(px, py, px+ww-1, py+hh-1, 1)
    for i = 0, 5 do blend(1, i, 1) end
    fillp()  -- reset
end
```

### Border/Outline Drawing

```lua
-- Draw function with a 1px border
function brd(f, col)
    apal(col)           -- set all colors to col
    _pal = pal
    pal = function() end  -- disable palette
    tcamera(1, 0);  f()  -- right
    tcamera(-1, 1); f()  -- down-right
    tcamera(-1, -1); f() -- up
    tcamera(1, -1); f()  -- up-right
    tcamera(0, 1)
    pal = _pal
    pal_rst()
    f()                  -- center (actual draw)
end

-- Filled border (thicker, 2px)
function fbrd(f, col)
    -- Similar but draws 8 times around + center
end
```

### Fade System

```lua
function fade_to(n, tempo, nxt)
    local sn = fd  -- start fade value
    local f = function(e)
        fd = sn + (n - sn) * e.t / tempo  -- interpolate
    end
    local ev = loop(f, tempo, nxt)  -- create entity that runs f for `tempo` frames
    ev.pause_act = true  -- survives pause
end
```

Fade value `fd` ranges:
- `fd = -4`: fully faded to dark (black screen transition)
- `fd = 0`: no fade (normal)
- `fd = -3`: partially faded
- Positive values: fade to bright

In `_draw()`, the fade remaps colors 0-9 to darker/brighter palette entries:
```lua
for i = 0, 9 do
    pal(i, sget(16+i, mid(1, 4+fd, 11)), true)
end
```

This reads the palette from the spritesheet at column x=16+i, row y=4+fd (which selects a pre-made darker/brighter palette variant).

### Slicer (text wrapping utility)

```lua
function slicer(s, max_width, cc)
    -- Splits string into lines no wider than max_width (in pico font pixels)
    -- Uses 4px per character width estimate
    -- Returns array of line strings
end
```

### Grid Drawing (9-slice)

```lua
function grid_rect(x, y, w, h, px, py, k, fill)
    -- Draws a 9-slice bordered rectangle from the spritesheet
    -- k = corner/edge size
    -- px, py = source position in spritesheet
    -- Corners, edges, and optional center fill
    sspr(px, py, k, k, x, y)                           -- top-left
    sspr(px+k*2, py, k, k, x+w-k, y)                   -- top-right
    sspr(px+k*2, py+k*2, k, k, x+w-k, y+h-k)           -- bottom-right
    sspr(px, py+k*2, k, k, x, y+h-k)                   -- bottom-left
    -- Edges (stretched)
    sspr(px+k, py, k, k, x+k, y, w-k*2, k)             -- top
    sspr(px+k, py+2*k, k, k, x+k, y+h-k, w-k*2, k)     -- bottom
    sspr(px, py+k, k, k, x, y+k, k, h-k*2)             -- left
    sspr(px+k*2, py+k, k, k, x+w-k, y+k, k, h-k*2)     -- right
    -- Optional center fill
    if fill then
        sspr(px+k, py+k, k, k, x+k, y+k, w-k*2, h-k*2)
    end
end
```

---

## 7. LOCALIZATION SYSTEM (`code/lang.lua`)

### Language File Format

Language files are plain text (`.txt`) with entries:
```
-- Comments start with --
key::Translation text here
key:s:plural_form
key:42:specific_number_form
font>>Terminus
font_line_height>>14
font_offset_y>>8
font_size>>12
```

- `::` separator for key/value
- `|` in values is converted to newline
- `:s:` defines plural forms
- `:N:` defines specific number forms (for languages like Russian)
- `>>` defines font parameters

### Loading Process

```lua
function load_lang(s)
    -- Read the language file
    -- Parse entries into `lang` table
    -- Parse plurals into `plural` table
    -- Parse numbered forms into `numbered` table
    -- Parse font parameters
    -- Set the font and font specs
end
```

### String Formatting (`get_lang`)

```lua
function get_lang(s, reps)
    -- s: the language key
    -- reps: replacement table (array or key-value)
    -- Supports:
    --   $0, $1, $2... : positional replacements
    --   $0s, $1s... : pluralized replacements
    --   %(s%) : language-specific plural suffix (s/es/y/и/n/er/e)
    --   %[key] : plural lookup by key
    --   %key : named replacement
end
```

### Pluralization

```lua
function get_plural(s, n)
    -- Check numbered overrides first
    if numbered[s] and numbered[s][n] then return numbered[s][n] end
    -- n <= 1: singular
    if n <= 1 then return s end
    -- Use plural form if defined
    if plural[s] then return plural[s] end
    -- Default: append universal plural suffix
    return s .. (plural["*"] or "")
end
```

### Supported Languages

PC version supports: English, French, Spanish (Spain + LATAM), Portuguese, German, Dutch, Italian, Romanian, Catalan, Galician, Polish, Ukrainian, Russian, Japanese, Korean, Simplified Chinese, Vietnamese.

### Console Version

Console versions use `load_lang_nofont()` which doesn't dynamically load fonts. Font parameters are predefined in `FONTS_DATA`:
```lua
FONTS_DATA = {
    pico = {dy=0, h=7},
    indienovaBC = {dy=9, h=16, sz=12},
    Galmuri11 = {dy=9, h=16, sz=12},
    Terminus = {dy=8, h=14, sz=12},
    galvanic = {dy=8, h=12, sz=8},
    LanaPixel = {dy=8, h=14, sz=11},
    Determination = {dy=9, h=14, sz=13},
}
```

### Console-Specific Text

```lua
function console_ver()
    return MOUSE and "" or "_console"  -- append "_console" for gamepad-only versions
end

function console_alt(key)
    if MOUSE then return key end
    local cons = key .. "_console"
    if lang[cons] then return cons end
    return key
end
```

---

## 8. ACHIEVEMENTS SYSTEM

### Achievement Data (`code/achievements_data.lua`)

Achievements are defined as a table with fields:
```lua
ACHIEVEMENTS = {
    { id="FULL_SET",     chk="on_card", spr=1, type="B" },
    { id="COMPLETE",     spr=4, type="B" },
    { id="SOLOMON",      gun=0, type="B" },
    { id="RANK_5",       rank=5, type="S" },
    { id="SWARM",        cards={"Pillage", "Revolution", "Conscription"} },
}
```

Fields:
- `id`: Unique identifier string
- `chk`: Check type ("on_card", "win", "end_floor", "play", "frag")
- `spr`: Sprite index in the achievements spritesheet (64x64 grid)
- `type`: Trophy type: "B" (bronze), "S" (silver), "G" (gold), "P" (platinum)
- `gun`: Gun index (for gun-specific achievements)
- `rank`: Rank number (for rank achievements)
- `sm`: Special sprite modifier index
- `cards`: Table of card names (for collection achievements)

### Achievement Drawing (`code/achievements.lua`)

```lua
function draw_icon(sel, x, y)
    spritesheet("achievements")
    sspr(0, 0, 64, 64, x, y)  -- base trophy frame

    local col = ACHIEVEMENTS[sel+1]

    if col.spr then
        -- Sprite-based icon
        sprgrid(64, 64)
        spr(col.spr, x, y)
        sprgrid(16, 16)
        spritesheet("gfx")
    elseif col.gun then
        -- Gun-based: draw weapon sprite with border
        sspr(192, 0, 64, 64, x, y)
        spritesheet("weapons")
        brd(function()
            asspr(0, col.gun*24, 96, 24, x+32, y+32, -.125, .7, .7)
        end, 4)
    elseif col.rank then
        -- Rank-based: draw rank number
        sspr(448, 0, 64, 64, x, y)
        brd(function()
            local dx = (n % 10) * 48
            local dy = floor(n/10) * 32
            sspr(dx, 192+dy, 48, 32, x+8, y+16)
        end, 1)
    elseif col.sm then
        -- Special sprite modifier
        local px = (col.sm % 32) * 32
        local py = 128 + floor(col.sm/32) * 32
        apal(1)  -- border
        sspr(px, py, 32, 32, x+2, y+2, 64, 64)
        pal()
        sspr(px, py, 32, 32, x, y, 64, 64)
    elseif col.cards then
        -- Collection: draw 3 mini cards
        for i = 1, 3 do
            local ca = get_card(col.cards[i]) or {gid=59}
            dr_flip_card(cx, cy, ca, 0, true)
        end
    end
end
```

### Achievement Popup System

Achievement popups are entities in `ents_ach` (separate entity list):
- Drawn after the main game render
- Use `big_achievement` surface (64x64)
- Slide in from the side, display for a duration, then slide out

### Collection Checking

```lua
function check_collections()
    -- Check if player has all required cards for collection achievements
    -- Returns true if a new collection achievement is unlocked
end
```

---

## 9. CODEX SYSTEM (`code/codex.lua`)

### Overview

The codex is an in-game encyclopedia showing:
- Card statistics and descriptions
- Unlocked/locked card states
- Achievement progress
- A visual "room" with furniture that changes as you unlock items

### Codex Layout

```
+---------------------------+----------+
|                           |          |
|    Card List (scrollable) |  Info    |
|    8 columns x 24px       |  Panel   |
|    cdw = 8 * 24 = 192     |  pw =    |
|                           |  MCW -   |
|                           |  (cdw+16)|
|                           |  = 112   |
+---------------------------+----------+
```

### Codex Rendering

The codex has its own `mdr` function:
```lua
mdr = function()
    local lents = shallow_copy(ents)
    foreach(lents or {}, dre)
end
```

**Background**: `rectfill(0, 0, MCW-1, MCH-1, 1)` (dark background)

**Codex room** (visual decoration):
```lua
spritesheet("codex")
sspr(0, 0, 106, 168, cx, cy)  -- main room background
-- Furniture items drawn based on unlock state
sspr(288 + index*48, 0, 48, 96, cx+64, cy+48)  -- furniture
sspr(168 + index*40, 96, 40, 80, cx+64, cy+48)  -- wall item
```

**Fireplace effect** (if unlocked):
```lua
-- Spawn fire particles
local p = mke(0, 27+dx, 118+dy-dx/4)
p.life = 32
p.vy = -rnd(1)
p.dr = function(e, x, y)
    local r = sqrt(p.life)
    local sc = sqrt(p.life/32)
    sspr(40 + fr*8, 272, 8, 16, x-4*sc, y-8*sc, sc*8, sc*16)
end
```

**Card display**: Uses `dr_flip_card()` to show card artwork with flip animation.

**Info panel**: Uses `lprint()` and `pprint()` for card descriptions, stats, and tags.

### Card Description System

Card descriptions use the localization system with parameter substitution:
```lua
local desc = get_desc(ca)  -- generates description from card data
desc = get_lang(ca.id) .. "|" .. desc  -- name + description
```

### Clipping

The codex uses clipping to create scrollable regions:
```lua
codex.dr = function(e, cmx, cmy)
    clip(cmx, bh+7, cdw, MCH-1, true)  -- clip to card list area
end
```

---

## 10. GAME MODES

### Mode System Architecture

Modes are loaded via `set_mode(id)` in `code/menu.lua`:
```lua
function set_mode(id)
    tbl = safe_require("", "code/modes/" .. id .. ".lua", {"lvl", "rov"}, {"DEN"})
    mode = tbl
    mode.frags = {}
    exe(mode.initialize)  -- call mode-specific init
end
```

Each mode file returns a table with:
- `id`: Mode identifier string
- `setup`: Configuration (slot limits)
- `base`: Base stats (firepower, range, etc.)
- `weapons`: Array of weapon definitions
- `ranks`: Array of rank modifiers
- `initialize()`: Called when mode is set
- `start()`: Called when game starts
- `next_floor()`: Called to advance to next level
- `grow()`: Called for level-up card selection
- `on_hero_death()`: Called when player dies
- `on_empty()`: Called when board is cleared
- `draw_inter()`: Custom HUD drawing

### Throne Mode (`code/modes/throne.lua`)

- **id**: "throne"
- **Description**: Main campaign mode, 11 floors + boss fight
- **Weapons**: 7 shotguns (Solomon, Victoria, Ramesses II, Richard III, Makeda, Alexander, Yvan IV)
- **Ranks**: 15 ranks with increasing difficulty (AI levels, HP bonuses, spread increases)
- **Flow**: `start()` -> intro vignettes -> `next_floor()` -> play -> `grow()` (level up) -> `next_floor()` -> ... -> floor 11 boss -> `outro()`
- **Base stats**: `pawn_promote=1, surrender=1, gain={0,0,0,1,5,2,0}, ai_lvl=0`
- **Level up data**: 2 choices per level, each with team 0 (white) or team 1 (black) cards

### Chase Mode (`code/modes/chase.lua`)

- **id**: "chase"
- **Description**: Survival mode with endless waves
- **Banned cards**: Egotic Maelstrom, Undercover Mission, Unholy Call, Imperial Shot Put, The Mole, Bold Plan, Patience
- **Setup**: `slots_max={5,0}` (5 white slots, 0 black slots)
- **Base**: Stronger gun, faster gameplay, `ammo_regen=1`
- **Spawning**: `ev_side_spawn` events create new pieces
- **Difficulty scaling**: `dif` increases each turn by 1/8
- **Score**: Based on `mode.turns` and `score`
- **on_new_turn()**: Spawns new waves when danger < difficulty threshold

### Endless Mode (`code/modes/endless.lua`)

- **id**: "endless"
- **Description**: Endless floors with card selection each floor
- **Setup**: `slots_max={10,10}` (full card slots)
- **Base**: Standard gun, `pawn_promote=1, surrender=1, ai_lvl=1`
- **Flow**: `start()` -> `next_floor()` -> play -> `on_empty()` -> `end_level(grow)` -> `grow()` -> `next_floor()` -> repeat
- **Level up**: Same 2-choice system as throne
- **Decay**: After floor 11, uses `decay_up()` instead of `level_up()`
- **draw_inter()**: Shows floor number above the board

### Tutorial Mode (`code/modes/tutorial.lua`)

- **id**: "tutorial"
- **Description**: Scripted tutorial teaching movement, shooting, reloading
- **Base**: Simplified stats: `chamber_max=1, firepower=4, firerange=3, soul_slot=-1`
- **Tutorial panels**: Defined in `pan_contents` table with:
  - `chess`: Piece info with text descriptions
  - `ctrl`: Control instructions with button/stick icons
- **Per-level content**: Levels 1, 3, 4, 5 have tutorial panels
- **Touch/Virtual gamepad variants**: Different text for touch controls
- **Mode-specific drawing**: Uses `tutorial.png` spritesheet for tutorial visuals

### Mode `draw_inter()` Pattern

Each mode can define a custom `draw_inter()` function for HUD elements:
```lua
-- Endless mode
function draw_inter()
    local s = lang.floor_ .. " "
    local x = lprint(s, MCW/2, board_y-19, 3, 1)
    lprint(mode.lvl, x, board_y-19, 5)
end
```

---

## 11. UTILITY LIBRARIES

### `libs/toolkit.lua` -- Math, Easing, Collections, Graphics

**Easing functions**:
```lua
ease_in(c, p)       -- pow(c, p or 2)
ease_out(c)         -- sqrt(c)
ease_in_out(c)      -- 0.5 - cos(c/2) * 0.5
ease_in_back(x, c1) -- c3*x*x*x - c1*x*x (with overshoot)
ease_out_back(c, c1)-- 1 + c3*(c-1)^3 + c1*(c-1)^2 (with overshoot)
ease_out_in(c, p)   -- combined ease
ease_bounce_out(c)  -- bounce effect
ease_uturn(c)       -- sin(c/2) (sine wave, used for screen shake)
ease_atk(c)         -- attack animation: quick in, slow out
ease_flat(c, tresh) -- flat with ramp up/down at edges
```

**Math functions**:
```lua
acos(x)    -- atan2(x, -sqrt(1-x*x))
asin(y)    -- atan2(sqrt(1-y*y), -y)
dist(a, b) -- euclidean distance between entities
hmod(n, k) -- half-modulo: wraps n into [-k, k] range
cyc(k, n, pt)  -- cyclical counter: floor(pt/n) % k
gco(n, pt)     -- normalized cycle: (pt % n) / n
rotate(x, y, a) -- rotate point by angle
```

**Table utilities**:
```lua
uadd(a, b)        -- unique add (no duplicates)
shuffle(a)        -- in-place shuffle
shuffle_copy(a)   -- returns shuffled copy
clone(a, recursive) -- shallow or deep copy
concat(a, b)      -- append all of b to a
reverse(a)        -- returns reversed copy
tbl_has(a, n)     -- check if table contains value
map_tbl(a, k)     -- index table by key field
```

**String utilities**:
```lua
split(str, sep)   -- split string by separator
join(a, sep)      -- join table into string
rep(str, a, b)    -- replace all occurrences
min_digits(s, n)  -- pad with leading zeros
```

**Graphics utilities**:
```lua
grid_rect(x, y, w, h, px, py, k, fill) -- 9-slice rectangle
grid_line(x, y, w, px, py, k)          -- 3-slice horizontal line
ssspr(x, y, w, h, dx, dy, sx, sy)      -- scaled sspr (center-scaled)
apal(n)           -- set all palette colors to n
transp(n)         -- make color n transparent
mpal(x, y, xm, dy) -- map palette from spritesheet
```

**Bresenham line algorithms**:
```lua
bres(x0, y0, x1, y1)   -- basic line
bres_2(x0, y0, x1, y1) -- supercover line (visits all crossed cells)
```

**Collision**:
```lua
rect_col(ax, ay, aw, ah, bx, by, bw, bh)  -- AABB collision
bump_all(tbl, ray)  -- circle-based collision resolution
```

### `libs/ents.lua` -- Entity System

**Entity creation**:
```lua
function mke(fr, x, y)
    local e = {
        fr = fr or -1,     -- sprite frame (-1 = no sprite)
        x = x or 0,        -- position
        y = y or 0,
        t = 0,             -- age (frames since creation)
        vx = 0, vy = 0,    -- velocity
        we = 0,            -- gravity/weight
        frict = 1,         -- friction multiplier
        ww = 16, hh = 16,  -- width/height
        dp = DP_PIECES,    -- depth layer
        flx = false, fly = false,  -- flip flags
    }
    add(ents, e)
    return e
end
```

Note: `code.lua` overrides `mke()` with `dp = DP_PIECES` (depth 3) as default, while `libs/ents.lua` uses `dp = 1`.

**Child entity system**:
```lua
add_child(par, e, keep_pos)  -- make e a child of par
pop_child(e, lp)             -- remove child relationship
```

Children are drawn relative to parent position, and updated within the parent's update cycle.

**Tween system**:
```lua
mv(e, dx, dy, n, f)     -- move by delta over n frames
mvt(e, tx, ty, n, f)    -- move to target over n frames
mv_speed(e, n)          -- recalculate tween speed based on distance
```

**Mouse tracking**:
```lua
track_mouse()  -- detects mouse over/click/release on entities
get_mouse_target(a, mx, my)  -- finds topmost entity at mouse position
```

Entities can define:
- `on_over()`, `on_out()` -- mouse enter/leave
- `on_click()`, `on_press()`, `on_release()` -- left mouse button
- `on_right_click()`, `on_right_press()`, `on_right_release()` -- right mouse button

**Wait/Loop utilities**:
```lua
wait(t, f, ...)  -- call f(...) after t frames
loop(f, t, nxt)  -- call f every frame for t frames, then call nxt
```

**Animation**:
```lua
play(e, tempo, mfr)  -- animate sprite frames: fr cycles through mfr frames at `tempo` frames each
```

### `libs/hoard.lua` -- Save System

A serialization-based save system using custom binary format:
- `HOARD` table: Main save data (game progress, codex unlocks, etc.)
- `SETTINGS` table: Settings (stored in root file, no per-table files)
- `MODSAV` table: Mod-specific saves

Key features:
- `init_hoard(params)`: Initialize save system with configuration
- `read_v(str, pos)`: Read a value from serialized string
- Custom format readers for tables, strings, numbers, booleans
- Automatic backup support
- Debounced saving (wait parameter delays writes)

---

## 12. KEY GAMEPLAY RENDERING

### Board Position Calculation

```lua
-- Board dimensions
xmax = 8  -- 8 columns
ymax = 8  -- 8 rows

-- Centered position
board_x = (MCW - xmax * SQ) / 2  -- (320 - 128) / 2 = 96
board_y = (MCH - ymax * SQ) / 2 + 4  -- (180 - 128) / 2 + 4 = 34

-- Square position helper
function sqp(sq)
    return board.x + sq.px * SQ, board.y + sq.py * SQ
end
```

### HUD Layout (above board)

```
Y position: board_y - 19 to board_y - 10

[Ammo]  [Shields]  [Grenades]  [Shotgun]
 ^^^^    ^^^^^^     ^^^^        [24x16 sprite]
 3px each 6px each   6px each

Y position: board_y - 19 = 15
  [Chamber barrels]  [Shotgun sprite]

Y position: board_y - 10 = 24
  [Ammo indicators]  [Shield icons]  [Grenade icons]
```

Each indicator is drawn using `sspr()` from the gfx spritesheet:
- Ammo: `sspr(i < ram and 4 or 0, 56, 3, 7, x, y)` -- 3px wide, 7px tall
- Shields: `sspr(i < rsh and 32 or 38, 64, 6, 7, x, y)` -- 6px wide
- Grenades: `sspr(i < grenades and 44 or 50, 64, 6, 7, x, y)`
- Shotgun: `sspr(fr, fy, 24, 16, x, y)` from weapons sheet

### Stats Panel (right side of board)

```lua
local a, cy, ec = get_disp_stats()
rectfill(cx-1, cy-2, cx+19, cy+#a*ec-4, 1)  -- dark background

for o in all(a) do
    lprint(o.name, cx+10, cy, 2, 1)        -- stat name (centered)
    lprint(o.value, cx+10, cy+BUTTON_HEIGHT*0.5, cl, 1)  -- stat value

    -- Or draw as bar segments
    for i = 0, 9 do
        local fr = 112  -- empty
        if o.rand and i < o.value + o.rand then fr = 114 end  -- partial
        if i < o.value then fr = 116 end                      -- full
        sspr(fr, 75, 2, 5, cx + i*2, cy + 6)
    end
    cy = cy + ec + BUTTON_HEIGHT * 0.2
end
```

### Footer Text

```lua
-- Turn counter / mode info
s = lang.turn_ .. " " .. mode.turns
lprint(s, MCW/2, MCH-7, cl, 1)

-- Messages (inter.msg)
if inter.msg then
    s = inter.msg
    cl = inter.msg_perm and 2 or (3 + cyc(2, 15, _t))
    if inter.c_warn then cl = 4 + cyc(2, 6) end
end
```

---

## 13. PALETTE AND COLOR MANIPULATION

### Palette Reset

```lua
function pal_rst()
    for i = 0, 9 do
        pal(i, i)          -- reset foreground palette
        pal(i, i, 1)       -- reset transparent palette
    end
    for i = 1, 9 do
        palt(i, false)     -- colors 1-9 are NOT transparent
    end
    palt(0, true)          -- color 0 IS transparent
    sfillp(1, 0, 1)        -- reset fill pattern
end
```

### Palette Darkening (for pause/fade)

```lua
function pal_inc(k)
    for i = 0, 9 do
        pal(i, sget(16+i, mid(1, 4+k, 8)))
    end
end
```

This reads pre-computed darker palette variants from the spritesheet at column x=16+i. The row y=4+k selects the brightness level:
- k=0: normal
- k=-2: darker (pause)
- k=-4: darkest (full fade)

### Fill Patterns (dithering)

```lua
pat = get_patterns(48, 12, 16)
-- Generates 16 fill patterns from the spritesheet at position (48, 12)
-- Each pattern is a 16-bit bitmask representing a 4x4 dithering pattern

fillp(pat[dith], true)  -- enable dithering with pattern
-- draw something
fillp()                  -- disable
```

### Brightness Adjustment

```lua
function bright(c, n)
    -- Returns a color adjusted by n levels of brightness
    -- n > 0: brighter, n < 0: darker
end
```

### Color Forcing

Every frame, three "force" colors are remapped:
```lua
pal(FORCE_DARK, 2, true)     -- 10 -> 2 (dark blue)
pal(FORCE_MEDIUM, 3, true)   -- 11 -> 3 (brown)
pal(FORCE_BRIGHT, 4, true)   -- 12 -> 4 (gray)
```

This allows sprites to use "force" colors (10, 11, 12) that always map to the same visual appearance, even during palette swaps for effects.

---

## 14. HTML5 CANVAS REPLICATION GUIDE

### Canvas Setup

```javascript
const MCW = 320;  // internal width
const MCH = 180;  // internal height
const MSC = 4;    // scale factor (1280x720 display)
const SQ = 16;    // tile size

const canvas = document.createElement('canvas');
canvas.width = MCW;
canvas.height = MCH;
// CSS scale: canvas.style.width = (MCW * scale) + 'px';
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;  // pixel-perfect rendering
```

### Core Drawing API Mapping

| Sugar Engine | HTML5 Canvas Equivalent |
|---|---|
| `cls(c)` | `ctx.fillStyle = palette[c]; ctx.fillRect(0, 0, MCW, MCH);` |
| `pset(x, y, c)` | `ctx.fillStyle = palette[c]; ctx.fillRect(x, y, 1, 1);` |
| `rect(x0, y0, x1, y1, c)` | `ctx.strokeStyle = palette[c]; ctx.strokeRect(x0+0.5, y0+0.5, x1-x0, y1-y0);` |
| `rectfill(x0, y0, x1, y1, c)` | `ctx.fillStyle = palette[c]; ctx.fillRect(x0, y0, x1-x0+1, y1-y0+1);` |
| `circfill(x, y, r, c)` | `ctx.fillStyle = palette[c]; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();` |
| `line(x0, y0, x1, y1, c)` | `ctx.strokeStyle = palette[c]; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();` |
| `camera(x, y)` | `ctx.setTransform(1, 0, 0, 1, -x, -y);` |
| `clip(x, y, w, h)` | `ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();` |
| `spr(fr, x, y)` | `ctx.drawImage(spritesheet, sx, sy, 16, 16, x, y, 16, 16);` |
| `sspr(sx,sy,sw,sh,dx,dy,dw,dh)` | `ctx.drawImage(spritesheet, sx, sy, sw, sh, dx, dy, dw, dh);` |

### Palette System

```javascript
// 16-color palette (PICO-8 style)
const defaultPalette = [
    '#00000000', // 0: transparent (or black)
    '#1D2B53',   // 1: dark blue
    '#7E2553',   // 2: dark purple
    '#008751',   // 3: dark green (or brown)
    '#AB5236',   // 4: brown
    '#5F574F',   // 5: dark gray
    '#C2C3C7',   // 6: light gray
    '#FFF1E8',   // 7: white
    '#FF004D',   // 8: red
    '#FFA300',   // 9: orange
    // ... (colors 10-15 for force colors, etc.)
];

// Runtime palette (can be remapped)
let palette = [...defaultPalette];

function pal(from, to) {
    palette[from] = defaultPalette[to];
}

function pal_rst() {
    palette = [...defaultPalette];
}
```

### Sprite Drawing with Palette Remapping

For pixel-perfect palette swapping, you need to either:
1. **Use a separate offscreen canvas** and manipulate pixel data via `ImageData`
2. **Use CSS filters** (limited)
3. **Pre-render palette variants** of each sprite

Recommended approach for pixel-perfect palette swapping:
```javascript
function drawSpriteWithPalette(img, sx, sy, sw, sh, dx, dy, dw, dh) {
    // Draw to offscreen canvas
    offscreenCtx.clearRect(0, 0, sw, sh);
    offscreenCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    // Get pixel data
    const imageData = offscreenCtx.getImageData(0, 0, sw, sh);
    const data = imageData.data;

    // Remap colors
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue; // skip transparent
        const colorIdx = findColorIndex(data[i], data[i+1], data[i+2]);
        const mappedIdx = paletteMap[colorIdx] ?? colorIdx;
        const mapped = defaultPalette[mappedIdx];
        data[i] = mapped.r;
        data[i+1] = mapped.g;
        data[i+2] = mapped.b;
    }

    offscreenCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(offscreenCanvas, 0, 0, sw, sh, dx, dy, dw, dh);
}
```

### Text Rendering

For the pixel font, render characters from the font spritesheet. For HD text, use a canvas overlay at 2x scale:

```javascript
// Overlay canvas for HD text
const overlayCanvas = document.createElement('canvas');
overlayCanvas.width = MCW * 2;
overlayCanvas.height = MCH * 2;
const overlayCtx = overlayCanvas.getContext('2d');

function lprint(str, x, y, c, align, outline) {
    if (useOverlay) {
        // Render at 2x on overlay
        const ox = x * 2 - (camX);
        const oy = y * 2 - (camY);
        overlayCtx.font = `${fontSize * 2}px ${fontName}`;
        overlayCtx.fillStyle = palette[c];
        if (align) overlayCtx.textAlign = 'center';
        if (outline) {
            overlayCtx.strokeStyle = palette[outline];
            overlayCtx.lineWidth = 4;
            overlayCtx.strokeText(str, ox, oy);
        }
        overlayCtx.fillText(str, ox, oy);
    } else {
        // Direct render
        ctx.font = `${fontSize}px ${fontName}`;
        ctx.fillStyle = palette[c];
        ctx.fillText(str, x, y);
    }
}
```

### Game Loop Structure

```javascript
let _t = 0;  // total frame counter
let t = 0;   // game time (pauses when paused)
let lastTime = 0;
const TARGET_FPS = 60;
const FRAME_TIME = 1000 / TARGET_FPS;

function gameLoop(timestamp) {
    const delta = timestamp - lastTime;
    if (delta >= FRAME_TIME) {
        lastTime = timestamp - (delta % FRAME_TIME);

        // Update
        _t++;
        if (!paused) {
            t++;
            updateEntities();
        }
        processInput();

        // Draw
        ctx.clearRect(0, 0, MCW, MCH);
        drawGame();

        // Apply fade
        if (fadeValue !== 0) {
            applyFade(fadeValue);
        }

        // Render overlay
        if (overlayDirty) {
            renderOverlay();
        }
    }

    requestAnimationFrame(gameLoop);
}
```

### Entity System

```javascript
class Entity {
    constructor(fr = -1, x = 0, y = 0) {
        this.fr = fr;
        this.x = x;
        this.y = y;
        this.t = 0;
        this.vx = 0; this.vy = 0;
        this.we = 0;
        this.frict = 1;
        this.ww = 16; this.hh = 16;
        this.dp = 3; // DP_PIECES
        this.flx = false; this.fly = false;
        this.children = [];
    }

    draw(offsetX = 0, offsetY = 0) {
        const x = Math.floor(offsetX + this.x);
        const y = Math.floor(offsetY + this.y);

        if (this.fr > 0) {
            drawSprite(this.fr, x, y, this.ww/16, this.hh/16, this.flx, this.fly);
        }
        if (this.dr) this.dr(x, y);

        // Draw children
        if (this.children.length > 0) {
            for (const child of this.children) {
                child.draw(-x, -y);
            }
        }
    }

    update() {
        this.t++;
        this.vx *= this.frict;
        this.vy *= this.frict;
        this.vy += this.we;
        this.x += this.vx;
        this.y += this.vy;

        if (this.upd) this.upd();

        // Tween
        if (this.twc !== undefined) {
            // ... tween logic
        }

        // Life timer
        if (this.life !== undefined) {
            this.life--;
            if (this.life <= 0) this.kill();
        }
    }
}
```

### Depth-Sorted Rendering

```javascript
function drawGame() {
    ctx.clearRect(0, 0, MCW, MCH);

    // Y-sort entities with z property
    const ysorted = ents.filter(e => e.z !== undefined);
    ysorted.sort((a, b) => (a.y + (a.ysort_dy || 0)) - (b.y + (b.ysort_dy || 0)));

    // Build depth buckets (0-15)
    const buckets = Array.from({length: 16}, () => []);
    for (const e of ents) {
        buckets[e.dp + 1]?.push(e); // Note: using +1 for 1-indexed like Lua
        if (!buckets[e.dp]) buckets[e.dp] = [];
        buckets[e.dp].push(e);
    }

    // Apply screen shake
    let shakeY = 0;
    if (inter?.c_screen_shake && settings.scrshake) {
        shakeY = (Math.floor(t / 2) % 2 === 0 ? 1 : -1) * inter.c_screen_shake;
    }

    // Draw each depth layer
    ctx.save();
    ctx.translate(0, shakeY);
    for (let depth = 0; depth < 16; depth++) {
        for (const e of buckets[depth] || []) {
            e.draw();
        }
    }
    ctx.restore();

    // Draw HUD, timers, etc.
}
```

---

## 15. ADDITIONAL RENDERING DETAILS

### Card Flip Animation

```lua
function dr_flip_card(cx, cy, ca, ct, shade, spsheet)
    local cpy = cy - sin(ct/2) * 8     -- vertical bounce
    local dw = cos(ct/2) * 24          -- width squeeze (flip effect)

    -- Shadow
    if shade then
        rectshade(cx+13-dw/2, cy+1, 22, 29, -1)
    else
        apal(1)
        sspr(48, 72, 24, 32, cx+13-dw/2, cy+1, dw, 32)
        pal_rst()
    end

    -- Front (if facing forward)
    if dw > 0 then
        spritesheet(ca.spsheet or "cards")
        sspr((ca.gid%10)*24, floor(ca.gid/10)*32, 24, 32, cx+12-dw/2, cpy, dw, 32)
        spritesheet("gfx")
    else
        -- Back (showing card back)
        sspr(48+ca.team*24, 72, 24, 32, cx+12+dw/2, cpy, -dw, 32)
    end
end
```

### Achievement Popup Flow

1. Achievement triggered -> create entity in `ents_ach`
2. Entity slides in from screen edge
3. Displays icon (64x64), name, and description
4. After duration, slides out
5. Drawn after main game render in `_draw()`

### Screen Shake Pattern

```lua
-- Oscillating shake using cyc() function
local s = cyc(2, 2, inter.c_screen_shake) * 2 - 1
-- cyc(2, 2, t) returns 0 or 1, alternating every 2 frames
-- s = -1 or +1
cy = s * inter.c_screen_shake  -- shake magnitude
```

### Red Flash (Danger Warning)

```lua
if hero and hero.c_wrong and SET.scrflash == 1 and t%6 < 3 then
    rect(0, 0, MCW-1, MCH-1, 5)      -- white border
    rect(1, 1, MCW-2, MCH-2, 5)
end
```

Drawn as a 2-pixel border around the screen, flashing every 6 frames (3 on, 3 off).

### Mouse Cursor

For Android/touch platforms, a cursor sprite is available:
```lua
cursor = { x=16, y=40, w=6, h=8 }  -- from console spritesheet
```

---

## 16. SUMMARY OF KEY VALUES FOR REPLICATION

| Constant | Value | Purpose |
|---|---|---|
| `MCW` | 320 | Internal canvas width |
| `MCH` | 180 | Internal canvas height |
| `MSC` | 4 | Window scale (1280x720 display) |
| `SQ` | 16 | Tile/square pixel size |
| `DP_BG` | 0 | Background depth |
| `DP_BOARD` | 1 | Board depth |
| `DP_SHADES` | 2 | Shadow depth |
| `DP_PIECES` | 3 | Pieces/entity depth |
| `DP_FX` | 4 | Effects depth |
| `DP_INTER` | 5 | UI depth |
| `DP_TOP` | 6 | Top overlay depth |
| `OVERLAY_SCALE` | 2 | HD text overlay scale |
| `BUTTON_HEIGHT` | 12 (15 on Android) | Standard button height |
| `TEMPO` | 20 | Base turn tempo |
| `HALF_POOL` | 80 | Card pool size |
| `FORCE_DARK` | 10 | Force dark color index |
| `FORCE_MEDIUM` | 11 | Force medium color index |
| `FORCE_BRIGHT` | 12 | Force bright color index |
| Board size | 8x8 | Chess board dimensions |
| Board pixel size | 128x128 | 8 * 16 |
| Board X offset | 96 | (320-128)/2 |
| Board Y offset | 34 | (180-128)/2 + 4 |
| Card size | 24x32 | Card sprite dimensions |
| Shotgun size | 24x16 | Weapon sprite dimensions |
| Ammo icon | 3x7 | Ammo indicator size |
| Shield icon | 6x7 | Shield indicator size |
| Big font char | 6x7 | Big text character size |
| Pico font height | 7 | Pixel font line height |
| FPS target | 60 | Frame rate limit |
