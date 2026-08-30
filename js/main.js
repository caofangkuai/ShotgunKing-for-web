// Main Entry Point - asset loading, game loop, initialization
// Ported from code.lua _init(), _update(), _draw(), boot()

let t = 0;          // frame counter
let _t = 0;          // total frame counter  
let frz = false;     // freeze flag
let mcl = false;     // mouse click lock
let assetsLoaded = false;
let assetsToLoad = 0;
let assetsLoadedCount = 0;
let loadingProgress = 0;
let loadingPhase = 'init'; // 'init', 'fonts', 'sprites', 'audio', 'done'

// Game state for UI
let gameState = {
    hoveredSq: null,
    hoveredPiece: null,
    selectedSq: null
};

// === MAIN INITIALIZATION ===
async function main() {
    console.log('Shotgun King: The Final Checkmate - Web Edition');
    
    // Initialize Sugar engine
    Sugar.init();
    
    // Initialize input
    Input.init();
    
    // Initialize audio
    AudioManager.init();
    
    // Initialize save system
    Save.init();
    DEN.init();
    SET.init();
    
    // Start game loop IMMEDIATELY - shows loading screen before anything else
    loadingPhase = 'init';
    gameLoop();
    
    // Load language
    const langSetting = Save.getOpt('lang');
    let langName = 'english';
    if (langSetting === 99 || langSetting === undefined) {
        const browserLang = (navigator.language || 'en').toLowerCase();
        if (browserLang.startsWith('zh')) {
            langName = 'simplified_chinese';
        }
    }
    
    try {
        await Lang.load(langName);
    } catch (e) {
        console.warn('Failed to load language, using defaults');
    }
    window.lang = Lang.data;
    
    // Load fonts with 10s timeout (FontFace.load can be slow for large fonts like indienovaBC 10MB)
    loadingPhase = 'fonts';
    try {
        await Promise.race([
            Sugar.loadAllFonts(),
            new Promise(resolve => setTimeout(resolve, 10000))
        ]);
    } catch (e) {
        console.warn('Font loading error:', e);
    }
    
    // Apply font from language file and set font properties
    const fontName = Lang.fontName || 'pico';
    font(fontName);
    
    // Apply language-specific font settings (font_size, font_line_height, font_offset_y)
    if (Sugar.fonts[fontName]) {
        if (Lang.fontSize) {
            Sugar.fonts[fontName].sz = Lang.fontSize;
            Sugar.fontSize = Lang.fontSize;
        }
        if (Lang.fontLineHeight) {
            Sugar.fonts[fontName].h = Lang.fontLineHeight;
            Sugar.fontLineHeight = Lang.fontLineHeight;
        }
        if (Lang.fontDy !== undefined) {
            Sugar.fonts[fontName].dy = Lang.fontDy;
            Sugar.fontDy = Lang.fontDy;
        }
    }
    console.log('Font set to:', fontName, 'size:', Sugar.fontSize, 'lineHeight:', Sugar.fontLineHeight, 'dy:', Sugar.fontDy);
    
    // Load spritesheets (needed for rendering)
    loadingPhase = 'sprites';
    await loadAllSpritesheets();
    
    // Apply options
    Save.applyOptions();
    applyOption('show_danger');
    
    // Generate graphics (grenade, explosions etc.)
    genGfx();
    
    // Boot sequence
    boot();
    
    assetsLoaded = true;
    loadingPhase = 'audio';
    
    // Load audio files in BACKGROUND (parallel, non-blocking)
    loadAllAudio().then(() => {
        loadingPhase = 'done';
        console.log('All audio assets loaded.');
    });
}

async function loadAllSpritesheets() {
    const spritesheets = [
        { name: 'gfx', src: 'assets/gfx/gfx.png' },
        { name: 'title', src: 'assets/gfx/title.png' },
        { name: 'cards', src: 'assets/gfx/cards.png' },
        { name: 'weapons', src: 'assets/gfx/weapons.png' },
        { name: 'intro', src: 'assets/gfx/intro.png' },
        { name: 'crumble', src: 'assets/gfx/crumble.png' },
        { name: 'tutorial', src: 'assets/gfx/tutorial.png' },
    ];

    const totalFiles = spritesheets.length;
    let loadedCount = 0;
    const updateProgress = () => {
        loadedCount++;
        loadingProgress = (loadedCount / totalFiles) * 0.5;
    };

    const promises = [];
    for (const ss of spritesheets) {
        promises.push(Sugar.loadSpritesheet(ss.name, ss.src).then(updateProgress));
    }

    await Promise.all(promises);
}

async function loadAllAudio() {
    const sfxFiles = [
        'abort_mission', 'alleluia', 'ammo', 'arrow', 'ascend', 'backup_call',
        'backup_land', 'blade', 'boost', 'boss_crumble', 'boss_jump', 'boss_land',
        'boulder_launch', 'boulder_xpl', 'cancel', 'card_land', 'castle', 'catch',
        'charge', 'cloak_in', 'cloak_out', 'crystal_xpl', 'detected',
        'disarm', 'disrupt', 'dmg_cap', 'eat', 'execute', 'extra_turn', 'fall',
        'flash_boss', 'flip_back', 'glue', 'grab_cancel', 'grab_done', 'grenade_beep',
        'grenade_bounce', 'grenade_fall', 'grenade_xpl', 'gust', 'head_bump',
        'healing', 'help', 'hero_leave', 'hero_light', 'hero_spawn', 'hero_spawn_boom',
        'hippocracy', 'hurt', 'hurt_boss', 'incantation', 'jester', 'jump', 'king_talk',
        'land', 'legacy', 'level_up_sel', 'level_up_zoom', 'lift', 'lost_king',
        'menu_in', 'menu_out', 'missile', 'mission', 'next_vig', 'next_vig_2',
        'pause', 'penta', 'penta_full', 'penta_reset', 'plague', 'promote', 'raise',
        'rat', 'reap_soul', 'recycle_cards', 'recycle_new', 'refill_wand', 'reload',
        'replace_card', 'retire', 'reverse_karma', 'scope', 'seer', 'sel_disruption',
        'sel_opt', 'shell_ground', 'shell_land', 'shell_spark', 'shield', 'shoot',
        'shoot_0', 'shoot_1', 'shoot_2', 'shoot_3', 'shoot_4', 'shoot_silencer',
        'show_book', 'show_card', 'soul', 'soul_wand', 'spawn', 'spawn_final',
        'splash', 'start', 'start_detune', 'swap', 'swap_init', 'tear_up', 'throw',
        'throw_impact', 'tic', 'tile_move', 'tile_out', 'trampoline', 'trg_in',
        'trg_out', 'turn_card', 'twinkle', 'unsoul', 'unused_xpl', 'use_card',
        'vampire_eat', 'vampire_suck', 'wand', 'water_poison', 'wrong', 'wrong_shield',
        'xpl', 'apo_jump', 'apo_sing_0', 'apo_sing_1', 'apo_sing_2', 'apo_sing_3',
        'apo_sit', 'apo_talk', 'bishop_resist', 'black_mist', 'book_float',
        'crown_fly', 'decay_jingle', 'disguise', 'execute_disruption',
        'hypno_execute', 'hypnosys', 'inc_countdown', 'conscription',
        'holo_vanish', 'caltrops',
    ];

    const musicFiles = [
        'title_A', 'title_B', 'ingame', 'boss_A', 'boss_B', 'boss_queen_A',
        'boss_queen_B', 'boss_riders_A', 'boss_riders_B', 'chase', 'codex',
        'ending_A', 'ending_B', 'endless', 'final_countdown', 'fireplace',
        'gameover', 'gameover_w_fx', 'level_up_A', 'level_up_B',
    ];

    // Load ALL audio files in PARALLEL with progress tracking
    const totalFiles = sfxFiles.length + musicFiles.length;
    let loadedCount = 0;
    const updateProgress = () => {
        loadedCount++;
        loadingProgress = 0.5 + (loadedCount / totalFiles) * 0.5;
    };

    const promises = [];
    for (const name of sfxFiles) {
        promises.push(AudioManager.loadSfx(name, `assets/sfx/${name}.wav`).then(updateProgress));
    }
    for (const name of musicFiles) {
        promises.push(AudioManager.loadMusic(name, `assets/music/${name}.mp3`).then(updateProgress));
    }

    await Promise.all(promises);
}

function genGfx() {
    // Generate grenade animation surface
    const r = SQ * 1.5;
    const frames = 12;
    Sugar.newsrf(frames * r * 2, r * 2, 'grenade');
    Sugar.target('grenade');
    Sugar.cls(0);
    for (let i = 0; i < frames; i++) {
        const cx = r + i * 2 * r;
        const cy = r;
        const c = i / frames;
        circfill(cx, cy, Math.pow(c, 0.5) * r, 5);
        circfill(cx, cy, Math.pow(c, 2) * r, 0);
    }
    Sugar.target();
    
    // Generate mini explosion
    Sugar.newsrf(frames * 16, 16, 'mini_xpl');
    Sugar.target('mini_xpl');
    Sugar.cls(0);
    for (let i = 0; i < frames; i++) {
        const cx = 8 + i * 16;
        const cy = 8;
        const c = i / frames;
        circfill(cx, cy, Math.pow(c, 0.4) * 7.5, 5);
    }
    Sugar.target();
}

function boot() {
    reset();
    setMode('throne');
    initMenu();
}

// === GAME LOOP ===
let lastTime = 0;
const TARGET_FPS = 60;
const FRAME_TIME = 1000 / TARGET_FPS;
let accumulator = 0;

function gameLoop(currentTime) {
    if (!currentTime) currentTime = 0;
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;
    
    accumulator += deltaTime;
    
    // Run fixed timestep updates
    while (accumulator >= FRAME_TIME) {
        _update();
        accumulator -= FRAME_TIME;
    }
    
    // Draw once
    _draw();
    
    // End frame input state
    Input.endFrame();
    
    requestAnimationFrame(gameLoop);
}

function _update() {
    _t++;
    
    // Skip if frozen
    if (frz) {
        // Only update permanent entities
        for (const e of Entity.entities) {
            if (e.perm && e.upd) e.upd(e);
        }
        Entity.update(1);
        return;
    }
    
    // Update entities
    Entity.update(1);
    
    // Update game state
    if (ingame && !pause) {
        t++;
        
        // Handle gameplay input
        if (playing && timerun) {
            handleGameInput();
        }
        
        // Update hero aim
        updateHeroAim();
        
        // Process fade
        Sugar.updateFade();
        
        // Screen shake decay
        if (screenShake > 0) {
            screenShake = Math.max(0, screenShake - 0.5);
        }
        
        // Update inter entity counters
        if (inter) {
            if (inter.cShoot > 0) inter.cShoot--;
            if (inter.cReload > 0) inter.cReload--;
            if (inter.cScreenShake > 0) inter.cScreenShake--;
        }
    }
    
}

function _draw() {
    // Clear HD text overlay at start of each frame
    Sugar.clearOverlay();

    // Early loading screen - no font dependency (for mobile compatibility)
    if (loadingPhase === 'init' || loadingPhase === 'fonts') {
        cls(0);
        // Use Canvas API directly (not pico font which may not be loaded yet)
        const ctx = Sugar.ctx;
        const barW = 160;
        const barH = 10;
        const barX = (320 - barW) / 2;
        const barY = 90;
        // Label
        ctx.fillStyle = '#C2C3C7';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('LOADING...', 160, barY - 14);
        // Bar background
        ctx.fillStyle = '#5F574F';
        ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
        ctx.fillStyle = '#1d2b53';
        ctx.fillRect(barX, barY, barW, barH);
        // Animated fill (indeterminate)
        const animOffset = (Date.now() / 20) % 40;
        ctx.fillStyle = '#00E436';
        ctx.fillRect(barX + animOffset, barY, 40, barH);
        ctx.textAlign = 'left';
        return;
    }
    
    // Loading screen - with pico font
    if (loadingPhase !== 'done') {
        cls(0);
        // Draw loading bar
        const barW = 160;
        const barH = 10;
        const barX = (320 - barW) / 2;
        const barY = 90;
        const label = loadingPhase === 'sprites' ? 'LOADING GRAPHICS...' : 'LOADING AUDIO...';
        const txtW = txtwidthSmall(label, 8);
        smallPrint(label, (320 - txtW) / 2, barY - 14, 6);
        // Bar background
        rectfill(barX - 1, barY - 1, barX + barW + 1, barY + barH + 1, 5);
        rectfill(barX, barY, barX + barW, barY + barH, 1);
        // Bar fill
        const fillW = Math.floor(barW * loadingProgress);
        if (fillW > 0) {
            rectfill(barX, barY, barX + fillW, barY + barH, 11);
        }
        // Percentage text
        const pct = Math.floor(loadingProgress * 100) + '%';
        const pctW = txtwidthSmall(pct, 8);
        smallPrint(pct, (320 - pctW) / 2, barY + barH + 4, 6);
        return;
    }
    
    // Use mdr if set, otherwise draw entities
    if (mdr) {
        mdr();
    } else {
        cls(0);
        camera();
        
        // Screen shake
        let shX = 0, shY = 0;
        if (screenShake > 0) {
            shX = (Math.random() * 2 - 1) * screenShake;
            shY = (Math.random() * 2 - 1) * screenShake;
        }
        camera(shX, shY);
        
        // Draw entities by depth
        const layers = [];
        for (let i = 0; i < 16; i++) layers.push([]);
        
        for (const e of Entity.entities) {
            if (e.dead) continue;
            const dp = Math.max(0, Math.min(15, e.dp || 0));
            layers[dp].push(e);
        }
        
        for (const layer of layers) {
            for (const e of layer) {
                dre(e);
            }
        }
        
        camera();
        Sugar.updateFade();
        Sugar.drawFade();
        Sugar.drawOverlay();
    }
}

// === HERO AIM UPDATE ===
function updateHeroAim() {
    if (!hero || hero.dead || !playing) return;

    // Update aim angle from mouse position
    // atan2 uses PICO-8 convention (positive Y = UP), screen coords have positive Y = DOWN
    if (Input.mouse.x !== 0 || Input.mouse.y !== 0) {
        const dx = Input.mouse.x - (hero.x + 8);
        const dy = Input.mouse.y - (hero.y + 8);
        if (dx !== 0 || dy !== 0) {
            hero.an = atan2(-dy, dx);
        }
    }

    // Update distance calculations
    traceHerosDists();
}

// === GAMEPLAY INPUT HANDLING ===
function handleGameInput() {
    if (!hero || hero.dead || hero.inMove) return;

    // Pause
    if (btnp('pause')) {
        if (pause) {
            unpause();
        } else {
            pauseGame();
        }
        return;
    }

    // Level up selection
    if (leveling && leveling.choices) {
        handleLevelUpInput();
        return;
    }

    // Game over
    if (ingameover) {
        handleGameOverInput();
        return;
    }

    // Movement phase
    if (ctrlMode === 'move') {
        handleMoveInput();
    } else if (ctrlMode === 'aim') {
        handleAimInput();
    }

    // Reload
    if (btnp('reload') && chamber < stack.chamber_max && ammo > 0) {
        reload();
    }

    // End turn (skip)
    if (btnp('cancel') && ctrlMode === 'move') {
        // Confirm end turn
        endPlayerTurn();
    }
}

function handleMoveInput() {
    if (!hero || !hero.sq) return;

    // Track hovered square for info display
    gameState.hoveredSq = null;
    gameState.hoveredPiece = null;

    const sq = getSquareAt(Input.mouse.x, Input.mouse.y);
    if (sq) {
        gameState.hoveredSq = sq;
        gameState.hoveredPiece = sq.p;
    }

    // Single-click on highlighted empty square to move (stay in move mode)
    if (Input.mouse.pressed) {
        if (sq && sq.highlight && !sq.p) {
            moveHero(sq, function() {
                showValidMoves();
            });
            return;
        }

        // Click on self = stay and aim
        if (sq && sq.p === hero) {
            ctrlMode = 'aim';
            showShootRange();
        }
    }
    
    // Keyboard movement
    if (btnp('up') || btnp('down') || btnp('left') || btnp('right')) {
        let dx = 0, dy = 0;
        if (btnp('left')) dx = -1;
        if (btnp('right')) dx = 1;
        if (btnp('up')) dy = -1;
        if (btnp('down')) dy = 1;
        
        const nsq = gsq(hero.sq.px + dx, hero.sq.py + dy);
        if (nsq && nsq.highlight && !nsq.p) {
            moveHero(nsq, function() {
                showValidMoves();
            });
        }
    }
}

function aimAndFireAt(targetSq) {
    if (!hero || !targetSq || !targetSq.p) return;
    const target = targetSq.p;
    if (!target.bad || target.inert) return;
    
    // Set aim target
    aim = target;
    ctrlMode = 'aim';
    showShootRange();
    
    // Fire at target after short delay
    wait(8, function() {
        if (chamber > 0) {
            fire();
            if (chamber <= 0) {
                wait(20, endPlayerTurn);
            }
        } else {
            // No ammo, end turn
            wait(20, endPlayerTurn);
        }
    });
}

function bladeAttack(target, cb) {
    if (!target || target.dead) {
        if (cb) cb();
        return;
    }
    
    sfx('blade');
    screenShake = 6;
    
    // Calculate blade damage
    const bladeDmg = Math.max(1, stack.blade || 1);
    
    // Flash effect
    target.hurt = 10;
    
    // Deal damage
    hit(target, bladeDmg, { from: hero, fsq: hero.sq, direct: true }, hero);
    
    // If target died, move hero to its square
    if (target.dead) {
        const targetSq = target.sq || gsq(target.px, target.py);
        if (targetSq) {
            moveHero(targetSq, function() {
                ctrlMode = 'aim';
                showShootRange();
                if (cb) cb();
            });
        } else {
            if (cb) cb();
        }
    } else {
        // Target survived, hero stays
        if (cb) cb();
    }
}

function handleAimInput() {
    // Track hovered square for info display (also during aim phase)
    gameState.hoveredSq = null;
    gameState.hoveredPiece = null;
    const hoverSq = getSquareAt(Input.mouse.x, Input.mouse.y);
    if (hoverSq) {
        gameState.hoveredSq = hoverSq;
        gameState.hoveredPiece = hoverSq.p;
    }

    // Double-click to fire: auto-aim towards click position
    // Note: atan2 uses PICO-8 convention where positive Y = UP,
    // but screen coords have positive Y = DOWN, so we flip dy
    if (Input.mouse.dclick && chamber > 0) {
        const dx = Input.mouse.x - (hero.x + SQ / 2);
        const dy = Input.mouse.y - (hero.y + SQ / 2);
        if (dx !== 0 || dy !== 0) {
            hero.an = atan2(-dy, dx);
        }
        fire();
        if (chamber <= 0) {
            wait(20, endPlayerTurn);
        }
    }

    // Space/Enter to shoot
    if (btnp('validate') && chamber > 0) {
        fire();
        if (chamber <= 0) {
            wait(20, endPlayerTurn);
        }
    }

    // Cancel = skip shooting, end turn
    if (btnp('cancel')) {
        endPlayerTurn();
    }

    // Grenade
    if (btnp('info') && grenades > 0) {
        const sq = getSquareAt(Input.mouse.x, Input.mouse.y);
        if (sq) {
            throwGrenade(sq);
        }
    }
}

function handleLevelUpInput() {
    if (!leveling || !leveling.choices) return;

    const choices = leveling.choices;
    const cardW = 48;
    const cardH = 56;
    const gap = 12;
    const startY = 22;

    // Build layout info for hover detection
    const playerCards = [];
    const enemyCards = [];
    for (let i = 0; i < choices.length; i++) {
        if (choices[i].team === 1) playerCards.push(i);
        else enemyCards.push(i);
    }

    // Track hover index for description display
    leveling.hoverIdx = -1;

    // Check player cards (left column)
    for (let i = 0; i < playerCards.length; i++) {
        const idx = playerCards[i];
        const x = 36;
        const y = startY + 8 + i * (cardH + gap);
        if (Input.mouseInRect(x, y, cardW, cardH)) {
            leveling.hoverIdx = idx;
            break;
        }
    }

    // Check enemy cards (right column)
    if (leveling.hoverIdx < 0) {
        for (let i = 0; i < enemyCards.length; i++) {
            const idx = enemyCards[i];
            const x = MCW - 36 - cardW;
            const y = startY + 8 + i * (cardH + gap);
            if (Input.mouseInRect(x, y, cardW, cardH)) {
                leveling.hoverIdx = idx;
                break;
            }
        }
    }

    // Single click to view details (updates hoverIdx which triggers description)
    if (Input.mouse.pressed && leveling.hoverIdx >= 0) {
        // Hover already updated, description will be shown automatically
    }

    // Double-click to select
    if (Input.mouse.dclick && leveling.hoverIdx >= 0) {
        selectLevelUpCard(leveling.hoverIdx);
        return;
    }

    // Keyboard selection (number keys 1-9)
    for (let k = 1; k <= 9 && k <= choices.length; k++) {
        if (Input.keysPressed[String(k)]) {
            selectLevelUpCard(k - 1);
            return;
        }
    }

    // Enter/Space to select hovered card
    if (btnp('validate') && leveling.hoverIdx >= 0) {
        selectLevelUpCard(leveling.hoverIdx);
    }
}

function selectLevelUpCard(index) {
    if (!leveling || !leveling.choices) return;
    const card = leveling.choices[index];
    const cb = leveling.callback;
    
    // Clear leveling state before callback to prevent UI lingering
    leveling = null;
    
    // Play sound
    if (typeof sfx === 'function') sfx('card_land');
    
    // Execute callback
    if (cb) {
        cb(card);
    }
}

function handleGameOverInput() {
    if (Input.mouse.pressed || btnp('validate')) {
        ingameover = false;
        sfx('menu_in');
        wait(30, function() { 
            fadeTo(0, 30, function() {
                initMenu();
            });
        });
    }
}

function endPlayerTurn() {
    // Clear highlights
    for (const sq of squares) sq.highlight = false;
    
    playing = false;
    timerun = false;
    ctrlMode = 'move';
    
    // Reload ammo
    if (ammo < stack.ammo_max) {
        ammo = Math.min(stack.ammo_max, ammo + (stack.ammo_regen || 1));
    }
    
    // Start opponent turn
    wait(10, oppTurn);
}

function showShootRange() {
    if (!hero || !hero.sq) return;
    
    // Show squares within firing range
    const range = getFirerange();
    const fp = getFirepower();
    
    // Highlight squares in shooting direction
    for (const sq of squares) {
        const dx = sq.px - hero.sq.px;
        const dy = sq.py - hero.sq.py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= range + 2) {
            sq.shootable = true;
        }
    }
}

// === FADE TO GLOBAL ===
function fadeTo(color, speed, cbk) {
    Sugar.fadeTo(color, speed, cbk);
}

// === DRAW GAME UI ===
function drawGameUI() {
    if (!ingame) return;
    drawUI();
}

// === START ===
window.addEventListener('load', main);
