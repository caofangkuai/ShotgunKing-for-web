// Core Gameplay - turn system, movement, shooting, AI, cards, levels

// === GLOBAL GAME STATE ===
let ingame = false;
let pause = false;
let playing = false;
let timerun = false;
let aim = null;
let hero = null;
let boss = null;
let seer = null;
let bads = [];
let squares = [];
let ents = [];
let bullets = [];
let events = [];
let spawners = [];
let stack = {};
let upgrades = [];
let cardSlots = [];
let cards = { pool: [] };
let whiteArmy = [];
let perm = {};
let chamber = 0;
let ammo = 0;
let grenades = 0;
let reloading = null;
let buildingAmmo = null;
let shields = 2;
let waitAmmo = 0;
let curtsy = 0;
let xmax = 8, ymax = 8;
let boardX = 0, boardY = 0;
let board = null;
let inter = null;
let bg = null;
let mdr = null;
let mode = null;
let gameMode = 'throne';
let chronoTime = 0;
let newBestTime = null;
let autofire = false;
let ctrlMode = 'move';
let rov = null; // rollover entity (hovered piece)
let info = null;
let leveling = null;
let ingameover = false;
let showDangerZone = false;
let leader = 5;
let fadeColor = 0;
let screenShake = 0;
let waitQueue = [];
let justMoved = false; // prevent firing on same frame as move
let eventQueue = [];
let executions = [];

// === LOADING SCREEN ===
let isLoading = false;
function showLoadingScreen(callback) {
    isLoading = true;
    let loadingDrawn = false;

    // Override mdr to show loading screen until callback runs
    mdr = function() {
        cls(0);
        const barW = 160;
        const barH = 10;
        const barX = (MCW - barW) / 2;
        const barY = MCH / 2;
        // Label
        const label = lang.loading || 'LOADING...';
        const txtW = txtwidth(label);
        lprint(label, (MCW - txtW) / 2, barY - 16, 7);
        // Animated spinner
        const spinnerX = MCW / 2;
        const spinnerY = barY + barH + 16;
        const angle = Date.now() / 200;
        for (let i = 0; i < 8; i++) {
            const a = angle + (i / 8) * Math.PI * 2;
            const r = 8;
            const x = spinnerX + Math.cos(a) * r;
            const y = spinnerY + Math.sin(a) * r;
            const alpha = 0.3 + 0.7 * ((i / 8));
            const ctx = Sugar.ctx;
            ctx.fillStyle = `rgba(0, 228, 54, ${alpha})`;
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        loadingDrawn = true;
    };

    // Run callback after loading screen has rendered at least 1 frame
    wait(5, function() {
        isLoading = false;
        callback();
    });
}

// === INIT GAME ===
function initGame() {
    Entity.reset();
    mode.frags = {};
    fadeTo(0, 30);
    // Don't set mdr here - let loading screen or vignette control drawing
    if (!isLoading) {
        mdr = drawGame;
    }
    gameMode = gameMode || 'throne';
    ingame = true;
    newBestTime = null;
    chamber = 0;
    ammo = 0;
    grenades = 0;
    reloading = null;
    buildingAmmo = null;
    shields = SET.get('shields');
    boss = null;
    seer = null;
    xmax = 8; ymax = 8;
    boardX = (MCW - xmax * SQ) / 2;
    boardY = (MCH - ymax * SQ) / 2 + 4;
    whiteArmy = [];
    waitAmmo = 0;
    curtsy = 0;
    perm = {};
    events = [];
    bullets = [];
    spawners = [];
    stack = {};
    
    // Upgrades
    const tempUpgrades = [];
    if (mode.base) tempUpgrades.push(mode.base);
    if (mode.weapons) {
        const wi = mode.weaponsIndex || 0;
        tempUpgrades.push(mode.weapons[wi]);
    }
    if (mode.ranks) {
        for (let i = 0; i < mode.ranks.length; i++) {
            if (i <= (mode.ranksIndex || 0)) {
                tempUpgrades.push(mode.ranks[i]);
            }
        }
    }
    upgrades = tempUpgrades;
    
    // Background
    bg = mke(0, 0, 0);
    bg.dp = DP_BG;
    bg.dr = function() {
        rectfill(0, -32, MCW - 1, MCH + 64 - 1, 1);
    };
    
    // Board entity
    board = mke(0, boardX, boardY);
    board.dp = DP_SHADES;
    board.x = boardX;
    board.y = boardY;
    board.dr = function(e, bx, by) {
        // Draw piece shades
        for (const ent of Entity.entities) {
            if (ent.drs) exe(ent.drs, ent);
        }
        drawOnBoard();
    };
    
    // Inter entity (UI)
    inter = mke(0, 0, 0);
    inter.perm = true;
    inter.dp = DP_TOP;
    inter.dr = function() {
        if (mode && mode.drawInter) mode.drawInter();
        drawUI();
    };
    
    spritesheet('gfx');
    sprgrid(16, 16);
    
    buildStack();
    
    // Initialize chamber and ammo from weapon stats
    chamber = stack.chamber_max || 0;
    ammo = stack.ammo_max || 0;
}

// === BUILD STACK (aggregate card effects) ===
function buildStack() {
    stack = {};
    
    // Apply base
    if (mode.base) applyUpgrade(mode.base);
    
    // Apply weapon
    if (mode.weapons) {
        const wi = mode.weaponsIndex || 0;
        applyUpgrade(mode.weapons[wi]);
    }
    
    // Apply ranks
    if (mode.ranks) {
        for (let i = 0; i < mode.ranks.length; i++) {
            if (i <= (mode.ranksIndex || 0)) {
                applyUpgrade(mode.ranks[i]);
            }
        }
    }
    
    // Apply cards
    for (const sl of cardSlots) {
        if (sl.ca && !sl.ca.flipped) {
            applyCard(sl.ca);
        }
    }
    
    // Apply hero init
    stack.ammo_max = stack.ammo_max || HERO_INIT.ammo_max;
    stack.chamber_max = stack.chamber_max || HERO_INIT.chamber_max;
    stack.firepower = stack.firepower || HERO_INIT.firepower;
    stack.firerange = stack.firerange || HERO_INIT.firerange;
    stack.spread = stack.spread || HERO_INIT.spread;
    stack.knockback = stack.knockback || HERO_INIT.knockback;
    stack.pierce = stack.pierce || HERO_INIT.pierce;
    stack.special = stack.special || HERO_INIT.special;
    stack.ai_lvl = stack.ai_lvl || HERO_INIT.ai_lvl;
    stack.ammo_regen = stack.ammo_regen || HERO_INIT.ammo_regen;
    stack.grenades_max = stack.grenades_max || 0;
    
    // Ensure non-negative
    stack.ammo_max = Math.max(0, stack.ammo_max);
    stack.chamber_max = Math.max(0, stack.chamber_max);
    stack.firepower = Math.max(1, stack.firepower);
    stack.firerange = Math.max(0, stack.firerange);
    
    // Set shields
    if (mode.infiniteShield) {
        stack.shields = 1;
    }
}

function applyUpgrade(upg) {
    if (!upg) return;
    for (const key in upg) {
        if (key === 'gid' || key === 'name' || key === 'nothing') continue;
        if (typeof upg[key] === 'number') {
            stack[key] = (stack[key] || 0) + upg[key];
        } else if (Array.isArray(upg[key])) {
            if (!stack[key]) stack[key] = [...upg[key]];
            else stack[key] = stack[key].concat(upg[key]);
        } else {
            stack[key] = upg[key];
        }
    }
}

function applyCard(ca) {
    for (const key in ca) {
        if (['gid', 'ext', 'n', 'id', 'index', 'team', 'pwe', 'flipped', 'turn_count'].includes(key)) continue;
        if (typeof ca[key] === 'number') {
            stack[key] = (stack[key] || 0) + ca[key];
        } else if (Array.isArray(ca[key])) {
            if (!stack[key]) stack[key] = [...ca[key]];
            else stack[key] = stack[key].concat(ca[key]);
        } else if (typeof ca[key] === 'object') {
            if (!stack[key]) stack[key] = {};
            Object.assign(stack[key], ca[key]);
        } else {
            stack[key] = ca[key];
        }
    }
}

// === GET STATS ===
function getFirepower(raw) {
    if (raw) return stack.firepower || 4;
    let fp = stack.firepower || 4;
    if (hero && hero.boost && hero.boost.firepower) fp += hero.boost.firepower;
    return Math.max(1, fp);
}

function getFirerange(raw) {
    if (raw) return stack.firerange || 3;
    let fr = stack.firerange || 3;
    if (hero && hero.boost && hero.boost.firerange) fr += hero.boost.firerange;
    return Math.max(0, fr);
}

function getSpread(raw) {
    if (raw) return stack.spread || 57;
    let sp = stack.spread || 57;
    if (hero && hero.boost && hero.boost.spread) sp += hero.boost.spread;
    return Math.max(0, sp);
}

// === NEW LEVEL ===
function newLevel() {
    fadeTo(0, 30);
    bads = [];
    ingame = true;
    aim = null;
    hero = null;
    inter.bgm = null;
    startLvlMusic();
    leader = getLeaderType();
    
    // Create squares
    squares = [];
    for (let x = 0; x < xmax; x++) {
        for (let y = 0; y < ymax; y++) {
            const sq = {
                x: boardX + SQ * x,
                y: boardY + SQ * y,
                px: x,
                py: y,
                cl: (x + y) % 2,
                mark: {},
                danger: [],
                shells: [],
                raiders: [],
                dp: DP_BOARD,
                seed: irnd(999),
                c_deep: 60 + irnd(60),
                p: null,
                highlight: false,
                moat: false,
            };
            sq.dr = function(sq, x, y) {
                drawSquare(sq, x, y);
            };
            sq.upd = function(sq) {
                // Shells collision
            };
            squares.push(sq);
        }
    }
    
    // Setup white army
    setupWhiteArmy();
    
    // Create hero
    createHero();
    
    // Setup pieces
    setupPieces();
    
    // Start turn
    initNewTurn();
}

function setupWhiteArmy() {
    whiteArmy = [...FIRST_ARMY];
    
    // Apply gain (army composition from cards)
    if (stack.gain) {
        const gains = Array.isArray(stack.gain) ? stack.gain : [stack.gain];
        for (let i = 0; i < gains.length; i++) {
            if (gains[i] > 0) {
                whiteArmy[gains[i]] = (whiteArmy[gains[i]] || 0) + 1;
            }
        }
    }
    
    // Apply sac (remove pieces)
    if (stack.sac) {
        const sacs = Array.isArray(stack.sac) ? stack.sac : [stack.sac];
        for (const s of sacs) {
            if (s > 0) {
                whiteArmy[s] = Math.max(0, (whiteArmy[s] || 0) - 1);
            }
        }
    }
    
    // Boss floor
    if (mode.lvl === 11) {
        whiteArmy[6] = 1;
    }
    
    // Apply hp modifiers
    applyHpModifiers();
}

function applyHpModifiers() {
    // Apply per-piece HP modifiers from stack
    if (stack.pawn_hp) PIECES[0].hp_mod = stack.pawn_hp;
    if (stack.knight_hp) PIECES[1].hp_mod = stack.knight_hp;
    if (stack.bishop_hp) PIECES[2].hp_mod = stack.bishop_hp;
    if (stack.rook_hp) PIECES[3].hp_mod = stack.rook_hp;
    if (stack.queen_hp) PIECES[4].hp_mod = stack.queen_hp;
    if (stack.king_hp) PIECES[5].hp_mod = stack.king_hp;
    if (stack.boss_hp) PIECES[6].hp_mod = stack.boss_hp;
    if (stack.all_hp) {
        for (let i = 0; i < 7; i++) {
            PIECES[i].hp_mod = (PIECES[i].hp_mod || 0) + stack.all_hp;
        }
    }
}

function createHero() {
    hero = mke(160, boardX + 4 * SQ, boardY + 7 * SQ);
    hero.type = 5;
    hero.name = 'king';
    hero.bad = false;
    hero.sq = gsq(4, 7);
    hero.sq.p = hero;
    hero.hp = 1;
    hero.hp_max = 1;
    hero.an = -0.25; // pointing up
    hero.dp = DP_PIECES;
    hero.z = 0;
    hero.boost = {};
    hero.tempo = 1;
    hero.cd = 1;
    hero.ready = true;
    hero.dead = false;
    hero.special = stack.special || 'none';
    
    // Draw hero
    hero.dr = function(e, x, y) {
        drawPiece(e, x, y);
    };
    
    hero.drs = function(e) {
        // Shadow
        if (e.sq) {
            circfill(e.sq.x + 8, e.sq.y + 12, 6, 0);
        }
    };
}

function setupPieces() {
    // Place white pieces on the board
    for (let type = 0; type < whiteArmy.length; type++) {
        const count = whiteArmy[type] || 0;
        for (let i = 0; i < count; i++) {
            const piece = createPiece(type, true);
            if (piece) {
                placePiece(piece, type, i);
            }
        }
    }
}

function createPiece(type, isBad) {
    const pieceData = PIECES[type];
    if (!pieceData) return null;
    
    const piece = mke(0, 0, 0);
    piece.type = type;
    piece.name = pieceData.name;
    piece.bad = isBad || false;
    piece.hp = pieceData.hp + (pieceData.hp_mod || 0);
    piece.hp_max = piece.hp;
    piece.tempo = pieceData.tempo;
    piece.behavior = pieceData.behavior || [];
    piece.danger = pieceData.danger || 0;
    piece.big = pieceData.big || false;
    piece.seek = pieceData.seek || 'wdist';
    piece.hdy = pieceData.hdy || 0;
    piece.cd = 0;
    piece.ready = false;
    piece.dp = DP_PIECES;
    piece.z = 0;
    piece.boost = {};
    piece.mark = {};
    piece.inert = pieceData.inert || false;
    piece.nocarry = pieceData.nocarry || false;
    piece.freelift = pieceData.freelift || false;
    piece.unlift = pieceData.unlift || false;
    piece.promote = type === 0 && stack.pawn_promote;
    piece.knockback = pieceData.knockback || 0;
    
    // Boss hp bonus
    if (piece.boss && stack.boss_hprc) {
        piece.hp = Math.floor(piece.hp * (1 + stack.boss_hprc / 100));
        piece.hp_max = piece.hp;
    }
    
    piece.dr = function(e, x, y) {
        drawPiece(e, x, y);
    };
    
    piece.drs = function(e) {
        if (e.sq && !e.big) {
            circfill(e.sq.x + 8, e.sq.y + 12, 6, 0);
        }
    };
    
    return piece;
}

function placePiece(piece, type, index) {
    // Place on top rows (white side)
    const positions = getPlacementPositions(type, index);
    if (positions.length === 0) return;
    
    const pos = positions[0];
    const sq = gsq(pos.x, pos.y);
    if (sq && !sq.p) {
        piece.sq = sq;
        sq.p = piece;
        piece.x = sq.x;
        piece.y = sq.y;
        if (piece.big) {
            // Occupy 4 squares
            for (let dx = 0; dx < 2; dx++) {
                for (let dy = 0; dy < 2; dy++) {
                    const nsq = gsq(pos.x + dx, pos.y + dy);
                    if (nsq) nsq.p = piece;
                }
            }
        }
        add(bads, piece);
    }
}

function getPlacementPositions(type, index) {
    const positions = [];
    
    // Standard chess-like placement
    switch (type) {
        case 0: // Pawns on row 1
            for (let x = 0; x < 8; x++) {
                if (!gsq(x, 1) || !gsq(x, 1).p) {
                    positions.push({ x, y: 1 });
                }
            }
            break;
        case 1: // Knights
            positions.push({ x: 1, y: 0 });
            positions.push({ x: 6, y: 0 });
            break;
        case 2: // Bishops
            positions.push({ x: 2, y: 0 });
            positions.push({ x: 5, y: 0 });
            break;
        case 3: // Rooks
            positions.push({ x: 0, y: 0 });
            positions.push({ x: 7, y: 0 });
            break;
        case 4: // Queen
            positions.push({ x: 3, y: 0 });
            break;
        case 5: // King
            positions.push({ x: 4, y: 0 });
            break;
        case 6: // Boss - center top
            positions.push({ x: 3, y: 0 });
            break;
    }
    
    return positions;
}

// === TURN SYSTEM ===
function initNewTurn() {
    if (hero.detected) return;
    
    // Increment turn
    mode.turns = (mode.turns || 0) + 1;
    
    newTurn();
}

function newTurn() {
    shields = SET.get('shields');
    if (mode.id === 'tutorial') shields = 2;
    
    // Auto-reload chamber from ammo at start of turn
    if (stack.chamber_max && ammo > 0 && chamber < stack.chamber_max) {
        while (chamber < stack.chamber_max && ammo > 0) {
            chamber++;
            ammo--;
        }
    }
    reloading = null;
    
    // Extra turn
    if (hero.extraTurn && !hero.win) {
        hero.extraTurn = false;
        play();
        return;
    }
    
    // Clean squares
    for (const sq of squares) sq.plague = null;
    
    // Update bad pieces
    for (const e of [...bads]) {
        if (e.dead) continue;
        e.ready = false;
        if (!e.stun) {
            e.cd = (e.cd || 0) + 1;
            e.ready = e.cd >= getPieceTempo(e);
        }
        e.hoppedOn = null;
        e.curtsy = null;
        e.cHit = 0;
        e.cShake = 0;
        e.dcx = 0;
        e.dcy = 0;
        e.kback = null;
        
        // Counters
        if (e.poisoned) {
            e.poisoned = e.poisoned > 1 ? e.poisoned - 1 : null;
        }
        if (e.stun) {
            e.stun = e.stun > 1 ? e.stun - 1 : null;
        }
        
        e.airy = e.wraith && !e.ready;
    }
    
    // Hero ready
    hero.grenadeReady = grenades > 0;
    hero.hop = stack.hop;
    
    // Cloak
    if (hero.cloaked) {
        hero.cloaked--;
        if (hero.cloaked <= 0) {
            cloakHero();
        }
    }
    
    play();
}

function play() {
    if (hero.dead) return;
    
    // Process events
    if (eventQueue.length > 0) {
        const ev = eventQueue.shift();
        if (ev.fn) ev.fn();
        return;
    }
    
    // Clear marks
    for (const e of bads) e.mark = {};
    
    // Check win
    if (hero.win || (boss && boss.hp <= 0)) {
        wait(2, oppTurn);
        return;
    }
    
    // Check death count
    if (stack.deathcount && hero.deathcountStart) {
        if (mode.turns - hero.deathcountStart >= stack.deathcount) {
            xplKing(hero);
            return;
        }
    }
    
    playing = true;
    timerun = true;
    
    // Clear highlights
    for (const sq of squares) sq.highlight = false;
    
    // Show valid moves
    showValidMoves();
    
    // Set control mode
    ctrlMode = 'move';
}

function showValidMoves() {
    if (!hero || !hero.sq) return;
    
    const moves = getHeroMoves();
    for (const sq of moves) {
        sq.highlight = true;
    }
}

function getHeroMoves() {
    if (!hero || !hero.sq) return [];
    const result = [];
    
    // King moves: 1 square in any direction (8 directions)
    for (let di = 0; di < 8; di++) {
        const nsq = dsq(hero.sq, di, 1);
        if (nsq && !nsq.p && !nsq.moat) {
            result.push(nsq);
        } else if (nsq && nsq.p && nsq.p.bad && !nsq.p.inert) {
            // Can move to attack
            result.push(nsq);
        }
    }
    
    // Add hop moves if available
    if (hero.hop && hero.hop > 0) {
        for (let di = 0; di < 8; di++) {
            const nsq = dsq(hero.sq, di, 2);
            if (nsq && !nsq.p && !nsq.moat) {
                if (!result.includes(nsq)) result.push(nsq);
            }
        }
    }
    
    return result;
}

// === HERO ACTIONS ===
function moveHero(sq, cb, recoil, t) {
    t = t || TEMPO;
    if (hero.big) t += 12;

    leaveSq(hero);
    hero.sq = sq;
    hero.sq.p = hero;
    hero.sq.reserved = null;

    const [tx, ty] = sqp(sq);

    // Clear highlights
    for (const s of squares) s.highlight = false;

    hero.inMove = true;
    hero.z = 0;

    // Jump arc animation
    const ev = loop(function(ev) {
        const c = ev.t / t;
        hero.z = -Math.sin(c * Math.PI) * 6;
    }, t);

    const land = function() {
        if (hero.big) {
            sfx('boss_land');
            screenShake = 8;
        }
        hero.inMove = false;
        hero.z = 0;
        if (cb) cb();
    };

    mvt(hero, tx, ty, t, land);
}

function reload() {
    if (reloading) return;
    if (chamber >= stack.chamber_max) return;
    if (ammo <= 0) return;
    
    reloading = true;
    sfx('reload');
    inter.cReload = TEMPO;
    
    wait(TEMPO, function() {
        reloading = null;
        while (chamber < stack.chamber_max && ammo > 0) {
            chamber++;
            ammo--;
        }
        if (inter) inter.cReload = null;
    });
}

function fire() {
    sfx('shoot');
    screenShake = 8;
    inter.cShoot = 10;
    
    const fp = getFirepower();
    
    for (let i = 0; i < fp; i++) {
        const an = hero.an;
        const x = hero.x + 8 + cos(an) * 8;
        const y = hero.y + 8 + sin(an) * 8;
        
        const sp = getSpread();
        const a = an + (Math.random() * 2 - 1) * sp / 720;
        mkBullet(x, y, a, 8, hero);
        
        // Muzzle flash particles
        for (let j = 0; j < 3; j++) {
            const p = mke(0, x, y);
            impulse(p, an, 3);
            p.dr = function(p, x, y) {
                pset(x, y, 5);
            };
            p.life = 8 + irnd(24);
            p.frict = 0.85 + rnd(0.12);
        }
    }
    
    chamber--;
    hero.boost = {};
    
    if (hero.cloaked && !stack.silencer) {
        expose();
    }
}

function mkBullet(x, y, an, spd, from) {
    const b = mke(0, x, y);
    b.vx = cos(an) * spd;
    b.vy = sin(an) * spd;
    b.from = from;
    b.knockback = from.knockback || 0;
    b.dp = DP_FX;
    b.frict = 1; // no friction for bullets
    b.life = 60;
    
    b.upd = function(e) {
        // Move in small steps for collision
        const steps = 4;
        for (let s = 0; s < steps; s++) {
            e.x += e.vx / steps;
            e.y += e.vy / steps;
            
            const sq = getSquareAt(e.x, e.y);
            if (sq) {
                if (sq.p && sq.p.bad && !sq.p.dead && sq.p !== hero) {
                    // Hit!
                    const dmg = 1;
                    hit(sq.p, dmg, { from: from, fsq: hero.sq }, e);
                    
                    // Pierce check
                    if (stack.pierce && Math.random() * 100 < stack.pierce) {
                        // Continue through
                    } else {
                        kl(e);
                        return;
                    }
                }
            } else {
                // Off board
                kl(e);
                return;
            }
        }
    };
    
    b.dr = function(e, x, y) {
        pset(x, y, 10);
        pset(x - e.vx, y - e.vy, 9);
    };
    
    add(bullets, b);
    return b;
}

function hit(e, dmg, at, from) {
    if (!e || e.dead) return;
    at = at || {};
    
    // Iron check
    if (e.iron && !at.direct) {
        e.cIron = 16;
        sfx('shield');
        return;
    }
    
    // Shield check
    if (e.shield) {
        e.shield--;
        e.cProtected = 16;
        sfx('shield');
        return;
    }
    
    // Bleeding bonus
    if (e.bleed) {
        dmg += 1;
    }
    
    // Apply damage
    e.hp -= dmg;
    e.cHit = 30;
    e.from = from;
    
    // Knockback displacement (like Lua dcx/dcy)
    if (from && (from.vx || from.vy)) {
        e.dcx = from.vx;
        e.dcy = from.vy;
    } else {
        e.cShake = 8;
    }
    
    sfx(e.boss ? 'hurt_boss' : 'hurt');
    
    // Create floating damage number entity (like Lua)
    if (!e.lifted && dmg > 0) {
        const p = mke(0, e.x + 8, e.y);
        if (e.big) {
            p.x = p.x + 8;
            p.y = p.y - 12;
        }
        p.dp = DP_FX;
        p.dmg = dmg;
        p.vy = -2;
        p.frict = 0.85;
        p.life = 60;
        p.dr = function(p, x, y) {
            const s = String(p.dmg);
            // Draw damage number with outline for readability
            lprint(s, x, y, 4, 1);
        };
        p.nxt = function() { e.hurtFx = null; };
        e.hurtFx = p;
    }
    
    // Knockback
    if (!e.big && !e.curtsy) {
        const kb = (from && from.knockback) || stack.knockback || 0;
        if (kb > 0 && from) {
            e.curtsy = true;
            curtsy++;
            
            let di;
            if (e.sq && at.fsq) {
                di = Math.floor(atan2(e.sq.px - at.fsq.px, e.sq.py - at.fsq.py) * 8 + 0.25) % 8;
            } else if (from.vx || from.vy) {
                di = Math.floor(atan2(from.vx, from.vy) * 8 + 0.25) % 8;
            }
            
            if (di !== undefined) {
                const nsq = dsq(e.sq, di);
                if (nsq && !nsq.p) {
                    e.kback = true;
                    gotoSq(e, nsq);
                    const r = function() { curtsy--; };
                    wait(30, r);
                } else if (!nsq) {
                    // Knocked off board
                    const r = function() { curtsy--; };
                    gotoFall(e, di);
                    wait(60, r);
                    return;
                } else {
                    curtsy--;
                }
            }
        }
    }
    
    // Check death
    if (e.hp <= 0) {
        if (e.boss) {
            onBossDeath();
            return;
        }
        onDeath(e);
    }
}

function onDeath(e) {
    if (!e || e.dead) return;
    e.dead = true;
    kl(e);
    del(bads, e);
    
    // Leave square
    leaveSq(e);
    
    // Check level end
    checkLevelEnd();
}

function onBossDeath() {
    if (mode && mode.onBossDeath) {
        mode.onBossDeath();
    }
}

function checkLevelEnd() {
    const realBads = getRealBads();
    if (realBads.length === 0) {
        endLevel(function() {
            if (mode.grow) mode.grow();
            else if (mode.nextFloor) mode.nextFloor();
        });
    }
}

function leaveSq(e) {
    if (e.sq) {
        if (e.sq.p === e) {
            if (e.big) {
                const a = gsqZone(e.sq);
                for (const sq of a) sq.p = null;
            }
            e.sq.p = null;
        }
        e.wsq = e.sq;
        e.sq = null;
    }
}

// Move entity to a square (with tween)
function gotoSq(e, sq, tempo) {
    if (!e || !sq) return;
    tempo = tempo || TEMPO;
    
    leaveSq(e);
    e.sq = sq;
    sq.p = e;
    
    const [tx, ty] = sqp(sq);
    mvt(e, tx, ty, tempo, function() {
        e.kback = false;
    });
}

// Knock entity off board (fall animation)
function gotoFall(e, di) {
    if (!e) return;
    
    e.falling = true;
    const dx = DIRS[di * 2] * 2;
    const dy = DIRS[di * 2 + 1] * 2;
    
    // Tween off screen
    mvt(e, e.x + dx * 20, e.y + dy * 20 + 30, 30, function() {
        if (!e.dead) {
            kl(e);
            onDeath(e);
        }
    });
}

// === OPPONENT TURN ===
function oppTurn() {
    // Clean up dead bullets
    bullets = bullets.filter(b => !b.dead);
    
    // Wait for bullets
    if (bullets.length > 0 || curtsy > 0) {
        wait(4, oppTurn);
        return;
    }
    
    // Check end game
    if (boss && boss.hp <= 0) {
        xplBoss();
        return;
    }
    
    // Get all bad pieces that can act
    oppMove();
}

function oppMove() {
    // Find next ready piece
    const ready = bads.filter(b => !b.dead && b.ready && !b.stun);
    
    if (ready.length === 0) {
        // All pieces done, start new turn
        initNewTurn();
        return;
    }
    
    // Pick first ready piece
    const e = ready[0];
    e.ready = false;
    
    // Choose move
    const action = getPieceNextAction(e);
    
    if (!action) {
        // No valid move, skip
        wait(TEMPO / 2, oppMove);
        return;
    }
    
    if (action.act === 'move' && action.sq) {
        // Move piece
        movePiece(e, action.sq, function() {
            wait(TEMPO / 2, oppMove);
        });
    } else {
        // Skip
        wait(TEMPO / 2, oppMove);
    }
}

function movePiece(e, sq, cb) {
    if (!e || !sq) {
        if (cb) cb();
        return;
    }
    
    const t = TEMPO;
    leaveSq(e);
    e.sq = sq;
    sq.p = e;
    
    const [tx, ty] = sqp(sq);
    
    // Check if hero is target
    if (sq === hero.sq) {
        // Attack hero
        oppAtk(e, hero, cb);
        return;
    }
    
    // Animate movement
    e.inMove = true;
    e.z = 0;

    // Jump animation (arc)
    const ev = loop(function(ev) {
        const c = ev.t / t;
        e.z = -Math.sin(c * Math.PI) * 6; // arc height
    }, t);

    mvt(e, tx, ty, t, function() {
        e.inMove = false;
        e.z = 0;
        if (cb) cb();
    });
}

function oppAtk(atk, def, cb) {
    if (hero.win || def.dead) {
        if (cb) cb();
        return;
    }
    
    // Attack animation - move towards target then attack
    const t = TEMPO;
    
    sfx('blade');
    
    // Check shields
    if (shields > 0) {
        shields--;
        sfx('shield');
        // Move piece back
        wait(TEMPO, function() {
            if (cb) cb();
        });
        return;
    }
    
    // Hit hero
    hero.hp -= 1;
    hero.cHit = 30;
    sfx('hurt');
    screenShake = 12;
    
    if (hero.hp <= 0) {
        hero.dead = true;
        gameover();
        return;
    }
    
    wait(TEMPO + 10, function() {
        if (cb) cb();
    });
}

// === LEVEL PROGRESSION ===
function endLevel(nxt) {
    timerun = false;
    playing = false;
    
    // Ascend remaining enemies (lightning effect in Android)
    ascendEnemies(function() {
        // Show win screen after ascend animation
        showWinScreen(nxt);
    });
}

function ascendEnemies(nxt) {
    const remaining = bads.filter(b => !b.dead && !b.inert);
    
    if (remaining.length === 0) {
        if (nxt) nxt();
        return;
    }
    
    // Make remaining enemies float up and fade out
    let completed = 0;
    const total = remaining.length;
    
    for (let i = 0; i < remaining.length; i++) {
        const e = remaining[i];
        const delay = i * 5; // Stagger the animation
        
        wait(delay, function() {
            e.ascending = true;
            const ev = loop(function(ev) {
                e.z = e.z - 0.3; // Float up
                e.fade = ev.t > 20 ? (ev.t % 4 < 2) : false; // Blink
                if (ev.t >= 30) {
                    kl(ev);
                    kl(e);
                    del(bads, e);
                    completed++;
                    if (completed >= total && nxt) {
                        nxt();
                    }
                }
            });
        });
    }
}

function showWinScreen(nxt) {
    // Show win screen
    const winBg = mke(0, 0, 0);
    winBg.dp = DP_TOP;
    winBg.dr = function() {
        rectfill(0, 0, MCW, MCH, 1);
        smallPrint('FLOOR CLEAR!', MCW / 2, MCH / 2 - 20, 5, 1);
        smallPrint('Mode: ' + (mode.id === 'throne' ? 'Throne' : 'Endless'), MCW / 2, MCH / 2, 7, 1);
        smallPrint('Floor: ' + (mode.lvl || 1), MCW / 2, MCH / 2 + 10, 6, 1);
    };

    // Continue button
    const continueBtn = mkSquareBut('CONTINUE', function() {
        kl(winBg);
        fadeTo(-4, 30, function() {
            if (nxt) nxt();
        });
    }, 48);
    continueBtn.x = MCW / 2 - continueBtn.pw / 2;
    continueBtn.y = MCH / 2 + 30;

    mdr = function() {
        for (const e of Entity.entities) dre(e);
    };

    // Auto-advance after delay if no input
    wait(120, function() {
        if (!continueBtn.dead) {
            kl(winBg);
            fadeTo(-4, 30, function() {
                if (nxt) nxt();
            });
        }
    });
}

function levelUp(data, nxt) {
    leveling = true;
    
    // Pick cards for selection
    const choices = [];
    for (let i = 0; i < 3; i++) {
        const card = pickCard();
        if (card) choices.push(card);
    }
    
    // Show card selection UI
    showCardSelection(choices, function(selectedCard) {
        if (selectedCard) {
            addCard(selectedCard);
        }
        leveling = false;
        if (nxt) nxt();
    });
}

function pickCard() {
    // Pick a random card from the pool
    if (!cards.pool || cards.pool.length === 0) {
        // Build pool from all cards
        cards.pool = CARDS.filter(c => !c.need && !c.need_card && !c.need_tag);
    }
    
    if (cards.pool.length === 0) return null;
    const idx = irnd(cards.pool.length);
    const card = cards.pool[idx];
    
    // Remove from pool if no more copies
    card.n = (card.n || 1) - 1;
    if (card.n <= 0) {
        cards.pool.splice(idx, 1);
    }
    
    return { ...card };
}

function newCard(cid) {
    const data = getCard(cid);
    if (!data) return null;
    return { ...data, flipped: false, turn_count: 0 };
}

function addCard(ca, nxt) {
    if (!ca) {
        if (nxt) nxt();
        return;
    }
    
    // Find free slot
    const slot = getFreeCardSlot(ca);
    if (slot !== null) {
        cardSlots[slot] = { ca: ca };
    }
    
    if (nxt) nxt();
}

function getFreeCardSlot(ca) {
    const maxSlots = 10;
    for (let i = 0; i < maxSlots; i++) {
        if (!cardSlots[i] || !cardSlots[i].ca) {
            return i;
        }
    }
    return null;
}

function showCardSelection(choices, cb) {
    // This will be handled by the menu system
    leveling = { choices: choices, callback: cb };
}

// === GAME OVER ===
function gameover(cbk) {
    if (mode && mode.onHeroDeath) {
        mode.onHeroDeath();
        return;
    }
    
    reset();
    ingameover = true;
    fadeTo(0, 30);
    stopMusic(true);
    sfx('gameover');
    
    const gbg = mke(0, 0, 0);
    gbg.dr = function() {
        rectfill(0, 0, MCW, MCH, 1);
        lprint(lang.try_again || 'Try Again?', MCW / 2, MCH / 2 - 16, 7, 1);
    };
    
    // Retry menu
    const menu = [];
    for (let i = 0; i < 2; i++) {
        const f = function() {
            ingameover = false;
            sfx('menu_in');
            const nxt = i === 0 ? retryLevel : initMenu;
            wait(30, function() { fadeTo(-4, 30, nxt); });
        };
        const e = mkSquareBut(i === 0 ? (lang.yes || 'Yes') : (lang.no || 'No'), f, 32);
        e.x = MCW / 2 + (i * 2 - 1) * 24 - e.pw / 2;
        e.y = MCH / 2;
        menu.push(e);
    }
    
    mdr = function() {
        for (const e of Entity.entities) dre(e);
    };
}

function retryLevel() {
    if (!mode.nextFloor) {
        mode.start();
        return;
    }
    const lvl = mode.lvl || 1;
    initGame();
    mode.lvl = Math.max(lvl - 1, 0);
    mode.nextFloor();
}

// === DRAWING ===
function drawGame() {
    cls();
    camera();
    
    // Y-sort entities with z
    const ysorted = Entity.entities.filter(e => e.z !== undefined && e.z !== 0);
    ysorted.sort((a, b) => (a.y + (a.ysort_dy || 0)) - (b.y + (b.ysort_dy || 0)));
    
    // Depth sort
    const layers = [];
    for (let i = 0; i < 16; i++) layers.push([]);
    
    for (const e of Entity.entities) {
        if (e.dead) continue;
        const dp = Math.max(0, Math.min(15, e.dp || 0));
        layers[dp].push(e);
    }
    
    // Screen shake
    let shX = 0, shY = 0;
    if (screenShake > 0) {
        shX = (Math.random() * 2 - 1) * screenShake;
        shY = (Math.random() * 2 - 1) * screenShake;
    }
    
    camera(shX, shY);
    
    // Draw each layer
    for (let i = 0; i < layers.length; i++) {
        for (const e of layers[i]) {
            dre(e);
        }
    }
    
    camera();
    
    // Present
    Sugar.present();
}

function drawOnBoard() {
    // Draw squares
    spritesheet('gfx');
    for (const sq of squares) {
        const x = board.x + sq.px * SQ;
        const y = board.y + sq.py * SQ;
        
        // Board tile
        const fr = 30 + sq.cl;
        spr(fr, x, y, 1, 1 + 3/16);
        
        // Highlight
        if (sq.highlight) {
            rect(x + 3, y + 3, x + SQ - 4, y + SQ - 4, 3 + sq.cl);
        }
        
        // Danger zone
        if (showDangerZone && sq.danger && sq.danger.length > 0 && !sq.p) {
            sspr(80 + sq.cl * 16, 272, 16, 16, x, y);
        }
    }
}

function drawSquare(sq, x, y) {
    const fr = 30 + sq.cl;
    if (sq.moat) fr = fr - 2;
    spr(fr, x, y, 1, 1 + 3/16);
}

function drawPiece(e, x, y) {
    if (!e || e.dead) return;

    spritesheet('gfx');

    // Apply shake displacement (like Lua c_shake)
    let shx = 0;
    if (e.cShake) {
        shx = e.cShake * (Math.floor((e.cShake % 3) * 2 - 1));
        e.cShake *= 0.8;
        if (e.cShake < 0.5) e.cShake = 0;
    }

    // Z offset (height)
    const dz = e.z || 0;

    // Hurt flash effect (like Lua c_hit=30)
    const isHurt = e.cHit && e.cHit > 0;
    if (isHurt) e.cHit--;

    if (e === hero) {
        // === HERO (Black King) ===
        // Use spr() with correct sprite index (like Lua spr(16+tp, ...))
        // Hero is type 5 (king), so sprite index = 16 + 5 = 21
        const heroSprIdx = 16 + 5; // 21
        const bodyX = x + shx;
        const bodyY = y + dz + PDY;

        // Draw shadow (depth effect) - like Lua shpr(20,12,7,4,...)
        if (dz > -1) {
            sspr(20, 12, 7, 4, bodyX + 4, bodyY + 13 + PDY);
        }

        if (isHurt && Math.floor(e.cHit / 4) % 2 === 0) {
            pal(7, 8);
            spr(heroSprIdx, bodyX, bodyY);
            palRst();
        } else {
            spr(heroSprIdx, bodyX, bodyY);
        }

        // Draw head (king crown) - animated based on angle
        // Head sprites at row 4 (y=64), each 8x8
        const an = hero.an || 0;
        const headIdx = ((Math.floor(((an % 1) + 1) % 1 * 8)) % 8 + 8) % 8;
        sspr(56 + headIdx * 8, 64, 8, 8, bodyX + 4, bodyY - 3);

        // Draw shotgun (in front of piece) - like Lua draw_shotgun
        if ((!mode || !mode.noShotgun) && chamber > 0) {
            // shotgun sprite at (32,0) size 12x16, drawn at center-bottom
            sspr(32, 0, 12, 16, bodyX + 8, bodyY + 8);
        }

        // Draw aim indicator line
        if (ctrlMode === 'aim') {
            const aimAn = hero.an || 0;
            const ax = bodyX + 8 + cos(aimAn) * 12;
            const ay = bodyY + 8 + sin(aimAn) * 12;
            line(bodyX + 8, bodyY + 8, ax, ay, 8);
        }

    } else if (e.bad) {
        // === ENEMY PIECE ===
        const bodyX = x + shx;
        const bodyY = y + dz + PDY;
        const tp = e.type;

        // Use spr() with correct sprite index (like Lua spr(16+tp, ...))
        // Sprite index = 16 + type
        let sprIdx = 16 + tp;
        if (e.iron) {
            // Iron pieces use sprite at tp + 12*16 + 11 (from Lua)
            sprIdx = 16 + tp + 12 * 16 + 11;
        }

        // Draw shadow (depth effect) - like Lua shpr(20,12,7,4,...)
        if (dz > -1) {
            sspr(20, 12, 7, 4, bodyX + 4, bodyY + 13 + PDY);
        }

        // Draw body with hurt flash
        if (isHurt && Math.floor(e.cHit / 4) % 2 === 0) {
            pal(7, 8);
            spr(sprIdx, bodyX, bodyY);
            palRst();
        } else {
            spr(sprIdx, bodyX, bodyY);
        }

        // Draw head for king pieces (type 5)
        if (tp === 5) {
            // King head at (112, 56) size 8x8
            sspr(112, 56, 8, 8, bodyX + 4, bodyY - 3);
        }

        // HP bar (show when damaged) - positioned above piece
        if (e.hp < e.hp_max) {
            const w = 12;
            const h = 2;
            const bx = bodyX + 2;
            const by = bodyY - 5;
            rectfill(bx, by, bx + w, by + h, 0);
            const hpw = Math.max(0, Math.floor(w * e.hp / e.hp_max));
            if (hpw > 0) {
                rectfill(bx, by, bx + hpw, by + h, 8);
            }
        }

        // Protection indicator (like Lua c_protect)
        if (e.cProtect && e.cProtect > 0) {
            e.cProtect--;
            circfill(bodyX + 6, bodyY + 7, 3 + e.cProtect / 6, 5);
        }

        // Iron flash (like Lua c_iron)
        if (e.cIron && e.cIron > 0) {
            e.cIron--;
        }
    }
}

function drawUI() {
    if (!ingame) return;
    
    spritesheet('gfx');
    
    // Floor display (top center, above board)
    var floorStr = (lang.floor_ || 'Floor:') + ' ';
    var lvlStr = String(mode.lvl || 1);
    var floorW = txtwidth(floorStr);
    var fx = (MCW - (floorW + txtwidth(lvlStr))) / 2;
    lprint(floorStr, fx, 2, 3);
    lprint(lvlStr, fx + floorW, 2, 5);
    
    // Chamber (above board, starting from boardX)
    const chmax = Math.max(stack.chamber_max || 0, chamber);
    for (let i = 0; i < chmax; i++) {
        const y = boardY - 18;
        sspr(i < chamber ? 4 : 0, 56, 3, 7, boardX + i * 4, y);
    }

    // Shotgun sprite (right of chamber)
    spritesheet('weapons');
    let wfr = 96;
    let wfy = 0;
    if (mode.weaponsIndex !== undefined) {
        wfy = (mode.weaponsIndex + 1) * 16;
    }
    if (inter && inter.cReload) wfr = 120;
    sspr(wfr, wfy, 24, 16, boardX + chmax * 4 + 2, boardY - 18);

    spritesheet('gfx');

    // Ammo display (below chamber, above board)
    const ram = ammo - waitAmmo;
    for (let i = 0; i < (stack.ammo_max || 0); i++) {
        const y = boardY - 10;
        sspr(i < ram ? 4 : 0, 56, 3, 7, boardX + i * 4, y);
    }

    // Shields (right of ammo, on same row)
    const shieldsMax = SET.get('shields');
    for (let i = 0; i < shieldsMax; i++) {
        sspr(i < shields ? 32 : 38, 64, 6, 7, boardX + (stack.ammo_max || 0) * 4 + i * 6 + 4, boardY - 10);
    }
    
    // Card display (both sides of board)
    drawCardsPanel();
    
    // Stats panel (left side, between card slots and board)
    drawStatsPanel();
    
    // Turn counter and difficulty (bottom, below board)
    var by = boardY + ymax * SQ + 2;
    if (mode.turns) {
        var turnLabel = lang.turn_ || 'Turn:';
        lprint(turnLabel, 2, by, 3);
        lprint(String(mode.turns), 2 + txtwidth(turnLabel) + 2, by, 5);
    }
    // Difficulty/rank (bottom center)
    if (mode.ranksIndex !== undefined && RANKS) {
        var rankStr = (lang.rank || 'Rank') + ' ' + (mode.ranksIndex + 1);
        lprint(rankStr, MCW / 2, by, 3, 1);
    }
    // Mode name (bottom right)
    var modeStr = mode.id === 'throne' ? (lang.throne || 'Throne') : (lang.endless || 'Endless');
    lprint(modeStr, MCW - 2, by, 3, 2);
    
    // Level up UI
    if (leveling) {
        drawLevelUpUI();
    }
    
    // Game over UI
    if (ingameover) {
        drawGameOverUI();
    }

    // Aim line and scatter visualization
    if (hero && !hero.dead && ctrlMode === 'aim' && chamber > 0) {
        drawAimVisualization();
    }

    // Hover info for squares (name, HP, attack info)
    if (typeof gameState !== 'undefined' && gameState.hoveredSq && gameState.hoveredPiece) {
        drawHoverInfo(gameState.hoveredSq, gameState.hoveredPiece);
    }
}

// === AIM VISUALIZATION ===
function drawAimVisualization() {
    if (!hero || !hero.sq) return;

    const camX = Sugar.camX;
    const camY = Sugar.camY;

    const heroX = hero.x + SQ / 2 + camX;
    const heroY = hero.y + SQ / 2 + camY;
    const aimRad = hero.an * Math.PI * 2;
    const range = getFirerange() * SQ;
    const spreadRad = (getSpread() / 360) * Math.PI * 2;

    const minX = board.x + camX;
    const maxX = board.x + 8 * SQ + camX;
    const minY = board.y + camY;
    const maxY = board.y + 8 * SQ + camY;

    let endX = heroX + Math.cos(aimRad) * range;
    let endY = heroY - Math.sin(aimRad) * range;
    endX = Math.max(minX, Math.min(maxX, endX));
    endY = Math.max(minY, Math.min(maxY, endY));

    const ctx = Sugar.ctx;
    ctx.save();

    ctx.fillStyle = 'rgba(255, 0, 77, 0.15)';
    ctx.beginPath();
    ctx.moveTo(heroX, heroY);
    const segments = 12;
    const startAngle = aimRad - spreadRad / 2;
    const endAngle = aimRad + spreadRad / 2;
    for (let i = 0; i <= segments; i++) {
        const a = startAngle + (endAngle - startAngle) * (i / segments);
        let px = heroX + Math.cos(a) * range;
        let py = heroY - Math.sin(a) * range;
        px = Math.max(minX, Math.min(maxX, px));
        py = Math.max(minY, Math.min(maxY, py));
        ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 0, 77, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(heroX, heroY);
    let edgeX = heroX + Math.cos(startAngle) * range;
    let edgeY = heroY - Math.sin(startAngle) * range;
    edgeX = Math.max(minX, Math.min(maxX, edgeX));
    edgeY = Math.max(minY, Math.min(maxY, edgeY));
    ctx.lineTo(edgeX, edgeY);
    ctx.moveTo(heroX, heroY);
    edgeX = heroX + Math.cos(endAngle) * range;
    edgeY = heroY - Math.sin(endAngle) * range;
    edgeX = Math.max(minX, Math.min(maxX, edgeX));
    edgeY = Math.max(minY, Math.min(maxY, edgeY));
    ctx.lineTo(edgeX, edgeY);
    ctx.stroke();

    ctx.strokeStyle = '#ff004d';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(heroX, heroY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
}

function drawHoverInfo(sq, piece) {
    if (!sq || !piece) return;

    // Don't show info for the player's own hero
    if (piece === hero) return;

    const infoX = 2;
    const infoY = MCH - 36;
    const infoW = MCW - 4;
    const infoH = 34;

    // Background
    rectfill(infoX, infoY, infoX + infoW, infoY + infoH, 1);
    rect(infoX, infoY, infoX + infoW, infoY + infoH, 5);

    // Piece name
    const pieceName = getPieceName(piece);
    lprint(pieceName, infoX + 4, infoY + 2, 7);

    // HP
    const hpStr = 'HP: ' + (piece.hp || 1) + '/' + (piece.hp_max || piece.hp || 1);
    lprint(hpStr, infoX + 4, infoY + 12, 8);

    // Attack info for enemies
    if (piece.bad && !piece.inert) {
        const atkStr = 'ATK: ' + (piece.atk || 1);
        lprint(atkStr, infoX + 60, infoY + 12, 8);
        const rangeStr = 'Range: ' + getPieceAttackRange(piece);
        lprint(rangeStr, infoX + 100, infoY + 12, 11);
    }

    // Status effects
    var statusY = infoY + 22;
    if (piece.shield) {
        lprint('Shield:' + piece.shield, infoX + 4, statusY, 12);
    }
    if (piece.bleed) {
        lprint('Bleed:' + piece.bleed, infoX + 60, statusY, 8);
    }
    if (piece.stun) {
        lprint('Stun', infoX + 110, statusY, 10);
    }

    // Highlight attack range on board
    highlightAttackRange(piece);
}

// Get piece attack range
function getPieceAttackRange(piece) {
    if (!piece || !piece.behavior) return 1;
    var maxRange = 1;
    for (var i = 0; i < piece.behavior.length; i++) {
        var b = piece.behavior[i];
        if (b.atk) {
            if (b.id === 'line') {
                maxRange = Math.max(maxRange, b.range || 8);
            } else if (b.id === 'jump') {
                maxRange = Math.max(maxRange, 2);
            }
        }
    }
    return maxRange;
}

// Draw semi-transparent filled rectangle (in board coords, no camera offset)
function fillTransparent(x, y, w, h, color, alpha) {
    const ctx = Sugar.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = Sugar.getColor(color);
    ctx.fillRect(
        Math.floor(x + Sugar.camX),
        Math.floor(y + Sugar.camY),
        Math.ceil(w),
        Math.ceil(h)
    );
    ctx.restore();
}

// Highlight squares that a piece can attack (filled highlight)
function highlightAttackRange(piece) {
    if (!piece || !piece.sq || !piece.behavior) return;

    spritesheet('gfx');
    var sq = piece.sq;

    for (var i = 0; i < piece.behavior.length; i++) {
        var b = piece.behavior[i];
        if (!b.atk) continue;

        if (b.id === 'line') {
            var dirStart = b.a;
            var dirEnd = b.b;
            var maxRange = b.range || 8;
            for (var d = dirStart; d <= dirEnd; d++) {
                var dx = DIRS[d * 2];
                var dy = DIRS[d * 2 + 1];
                for (var r = 1; r <= maxRange; r++) {
                    var tx = sq.px + dx * r;
                    var ty = sq.py + dy * r;
                    if (tx < 0 || tx >= 8 || ty < 0 || ty >= 8) break;
                    var targetSq = gsq(tx, ty);
                    if (!targetSq) break;
                    var sx = board.x + tx * SQ;
                    var sy = board.y + ty * SQ;
                    // Fill square with semi-transparent red
                    fillTransparent(sx + 2, sy + 2, SQ - 4, SQ - 4, 8, 0.4);
                    if (targetSq.p) break; // blocked by piece
                }
            }
        } else if (b.id === 'jump') {
            // Knight-style jumps: pairs of x,y offsets from b.moves array
            var moves = b.moves;
            if (moves) {
                for (var j = 0; j < moves.length; j += 2) {
                    var jx = moves[j];
                    var jy = moves[j + 1];
                    var tx = sq.px + jx;
                    var ty = sq.py + jy;
                    if (tx >= 0 && tx < 8 && ty >= 0 && ty < 8) {
                        var sx = board.x + tx * SQ;
                        var sy = board.y + ty * SQ;
                        // Fill square with semi-transparent red
                        fillTransparent(sx + 2, sy + 2, SQ - 4, SQ - 4, 8, 0.4);
                    }
                }
            }
        }
    }
}

function drawStatsPanel() {
    // Position to the LEFT of the board, between card slots and board edge
    // Card slots are at x=0..20, board starts at boardX=96
    // Stats panel goes at x=22, width ~72px
    const x = 22;
    const stats = getDispStats();
    const ec = Sugar.fontLineHeight || 8;
    let cy = boardY + 2;
    
    for (const s of stats) {
        lprint(s.name, x, cy, 3);
        lprint(s.value, x + 36, cy, 5);
        cy += ec;
    }
    
    // Special ability
    if (stack.special && stack.special !== 'none') {
        const spec = lang['special_' + stack.special] || stack.special;
        lprint(spec, x, cy, 4);
    }
}

function getDispStats() {
    const a = [];
    a.push({ id: 'firepower', name: lang.power || 'Power', value: String(getFirepower()) });
    a.push({ id: 'range', name: lang.range || 'Range', value: Math.max(0, getFirerange()) + '-' + Math.max(0, getFirerange() + 2) });
    a.push({ id: 'f_arc', name: lang.f_arc || 'Arc', value: getSpread() + (lang.degree_symbol || '°') });
    
    if ((stack.knockback || 0) > 0) a.push({ id: 'knock', name: lang.knock || 'Knock', value: (stack.knockback || 0) + '%' });
    if ((stack.pierce || 0) > 0) a.push({ id: 'pierce', name: lang.pierc || 'Pierce', value: (stack.pierce || 0) + '%' });
    if ((stack.blade || 0) > 0) a.push({ id: 'blade', name: lang.blade || 'Blade', value: String(stack.blade || 0) });
    
    return a;
}

function drawCardsPanel() {
    const maxSlots = 8;
    const cardW = 28;
    const startY = boardY;
    const availH = ymax * SQ;
    const slotH = Math.floor(availH / maxSlots);
    
    if (!cardSlots) return;
    
    spritesheet('cards');
    
    // Split card slots by team
    var whiteSlots = [];
    var blackSlots = [];
    for (let i = 0; i < cardSlots.length; i++) {
        const sl = cardSlots[i];
        if (sl && sl.ca) {
            if (sl.ca.team === 1) whiteSlots.push(sl);
            else blackSlots.push(sl);
        }
    }
    
    // Left side: player/black card slots (team 0) - at x=0
    var lx = 0;
    for (let i = 0; i < maxSlots; i++) {
        const sl = blackSlots[i];
        const cx = lx;
        const cy = startY + i * slotH;
        
        if (!sl) {
            // Empty slot - dark with border
            rectfill(cx, cy, cx + cardW - 1, cy + slotH - 1, 1);
            rect(cx, cy, cx + cardW - 1, cy + slotH - 1, 5);
        } else {
            const ca = sl.ca;
            if (ca.flipped) {
                // Flipped card - dark with X mark
                rectfill(cx, cy, cx + cardW - 1, cy + slotH - 1, 5);
                rect(cx, cy, cx + cardW - 1, cy + slotH - 1, 0);
                lprint('X', cx + cardW / 2, cy + 2, 2, 1);
            } else {
                // Active card - draw from spritesheet
                if (ca.gid !== undefined) {
                    const sx = (ca.gid % 16) * 16;
                    const sy = Math.floor(ca.gid / 16) * 16;
                    sspr(sx, sy, 16, 16, cx + 2, cy + 2, cardW - 4, slotH - 8);
                } else {
                    rectfill(cx, cy, cx + cardW - 1, cy + slotH - 1, 4);
                }
                rect(cx, cy, cx + cardW - 1, cy + slotH - 1, 0);
            }
        }
    }
    
    // Right side: enemy/white card slots (team 1) - at x=MCW-cardW
    var rx = MCW - cardW;
    for (let i = 0; i < maxSlots; i++) {
        const sl = whiteSlots[i];
        const cx = rx;
        const cy = startY + i * slotH;
        
        if (!sl) {
            // Empty slot
            rectfill(cx, cy, cx + cardW - 1, cy + slotH - 1, 1);
            rect(cx, cy, cx + cardW - 1, cy + slotH - 1, 5);
        } else {
            const ca = sl.ca;
            if (ca.flipped) {
                // Flipped card
                rectfill(cx, cy, cx + cardW - 1, cy + slotH - 1, 5);
                rect(cx, cy, cx + cardW - 1, cy + slotH - 1, 0);
                lprint('X', cx + cardW / 2, cy + 2, 2, 1);
            } else {
                // Active card - draw from spritesheet
                if (ca.gid !== undefined) {
                    const sx = (ca.gid % 16) * 16;
                    const sy = Math.floor(ca.gid / 16) * 16;
                    sspr(sx, sy, 16, 16, cx + 2, cy + 2, cardW - 4, slotH - 8);
                } else {
                    rectfill(cx, cy, cx + cardW - 1, cy + slotH - 1, 5);
                }
                rect(cx, cy, cx + cardW - 1, cy + slotH - 1, 0);
            }
        }
    }
    
    spritesheet('gfx');
}

function drawLevelUpUI() {
    if (!leveling || !leveling.choices) return;
    
    // Darken background
    rectfill(0, 0, MCW, MCH, 0);
    
    // Title
    lprint(lang.level_up || 'LEVEL UP!', MCW / 2, 6, 5, 1);
    
    // Card choices
    const choices = leveling.choices;
    const cardW = 48;
    const cardH = 56;
    const gap = 16;
    const totalW = choices.length * (cardW + gap) - gap;
    const startX = (MCW - totalW) / 2;
    const startY = MCH / 2 - cardH / 2 - 10;
    
    for (let i = 0; i < choices.length; i++) {
        const ca = choices[i];
        const x = startX + i * (cardW + gap);
        const y = startY;
        
        // Card background
        const team = ca.team || 0;
        rectfill(x, y, x + cardW, y + cardH, team === 1 ? 12 : 1);
        rect(x, y, x + cardW, y + cardH, 0);
        
        // Draw card image from cards spritesheet using gid
        if (ca.gid !== undefined) {
            const sx = (ca.gid % 16) * 16;
            const sy = Math.floor(ca.gid / 16) * 16;
            sspr(sx, sy, 16, 16, x + (cardW - 24) / 2, y + 4, 24, 24);
        }
        
        // Card name
        const name = ca.id || ca.name || '';
        smallPrint(name, x + cardW / 2, y + 32, 7, 1);
        
        // Show card effect summary
        const effect = getCardEffectText(ca);
        if (effect) {
            smallPrint(effect, x + cardW / 2, y + 42, 6, 1);
        }
        
        // Show full description for hovered card
        if (leveling.hoverIdx === i && ca.desc) {
            rectfill(4, y + cardH + 4, MCW - 4, y + cardH + 24, 1);
            rect(4, y + cardH + 4, MCW - 4, y + cardH + 24, 5);
            pprint(ca.desc, MCW / 2, y + cardH + 8, MCW - 16, 7, 1);
        }
        
        // Hover/select highlight
        if (leveling.hoverIdx === i) {
            rect(x - 2, y - 2, x + cardW + 2, y + cardH + 2, 8);
            rect(x - 1, y - 1, x + cardW + 1, y + cardH + 1, 11);
        } else if (Input.mouseInRect(x, y, cardW, cardH)) {
            rect(x - 1, y - 1, x + cardW + 1, y + cardH + 1, 8);
        }
    }
    
    // Instructions
    lprint('Click: View  |  Double-Click: Select', MCW / 2, MCH - 10, 6, 1);
}

function getCardEffectText(ca) {
    const parts = [];
    if (ca.firepower) parts.push('PWR+' + ca.firepower);
    if (ca.firerange) parts.push('RNG' + (ca.firerange > 0 ? '+' : '') + ca.firerange);
    if (ca.spread) parts.push('SPR' + (ca.spread > 0 ? '+' : '') + ca.spread);
    if (ca.ammo_max) parts.push('AMMO' + (ca.ammo_max > 0 ? '+' : '') + ca.ammo_max);
    if (ca.chamber_max) parts.push('CHMB+' + ca.chamber_max);
    if (ca.blade) parts.push('BLADE+' + ca.blade);
    if (ca.knockback) parts.push('KNOCK');
    if (ca.pierce) parts.push('PIERCE+' + ca.pierce);
    return parts.join(' ');
}

function drawGameOverUI() {
    rectfill(0, 0, MCW, MCH, 1);
    lprint(lang.try_again || 'Try Again?', MCW / 2, MCH / 2 - 16, 7, 1);
}

// === UTILITY ===
function reset() {
    camera();
    ingame = false;
    pause = false;
    playing = false;
    timerun = false;
    bads = [];
    squares = [];
    ents = [];
    bullets = [];
    events = [];
    spawners = [];
    stack = {};
    cardSlots = [];
    Entity.reset();
}

function setMode(name) {
    if (name === 'throne') {
        mode = ThroneMode;
    }
    mode.initialize();
}

function startLvlMusic() {
    let trackId = 'ingame';
    if (whiteArmy[6]) trackId = 'boss_A';
    if (mode.id === 'chase') trackId = 'chase';
    if (mode.id === 'endless') trackId = 'endless';
    if (mode.id === 'tutorial') trackId = 'title_A';
    music(trackId);
}

function xplKing(e) {
    if (e === hero) {
        hero.dead = true;
        gameover();
    }
}

function xplBoss() {
    if (mode && mode.onBossDeath) {
        mode.onBossDeath();
    }
}

function expose() {
    if (hero.cloaked) {
        hero.cloaked = 0;
        cloakHero();
    }
}

function cloakHero() {
    // Toggle cloak state
    if (hero) {
        hero.cloaked = hero.cloaked || 0;
    }
}

function earnExtraTurn() {
    if (hero) hero.extraTurn = true;
}

function spendHop() {
    if (hero && hero.hop) {
        hero.hop--;
    }
}

function getRecoilSquare() {
    if (!hero || !hero.sq) return [null, null];
    if (stack.recoil) {
        const k = Math.floor((hero.an + 0.125 / 2) * 8) % 8;
        const rsq = dsq(hero.sq, ADI[k] + 4, 1); // opposite direction
        return [rsq, (ADI[k] + 4) % 8];
    }
    return [null, null];
}

function checkFatality(sq, power, tsq) {
    // Check if shooting would be fatal (hero would die)
    return false; // Simplified
}

function checkFollyShields(sq, shooting) {
    return true; // Simplified - safe
}

function initSafeMode() {
    // Initialize safety checks
}

function traceHerosDists() {
    // Calculate distances from hero
    if (!hero || !hero.sq) return;
    
    for (const sq of squares) {
        const dx = sq.px - hero.sq.px;
        const dy = sq.py - hero.sq.py;
        sq.wdist = Math.abs(dx) + Math.abs(dy);
        sq.ddist = Math.sqrt(dx * dx + dy * dy);
        sq.kdist = Math.max(Math.abs(dx), Math.abs(dy)); // Knight distance
    }
}

function traceAllPieceDist() {
    // Calculate distances from all pieces
    for (const sq of squares) {
        if (sq.p && sq.p.seek) {
            // Distance calculations per piece type
        }
    }
}

function checkCardsAutoFlip() {
    // Check card auto-flip conditions
    if (!cardSlots) return;
    for (const sl of cardSlots) {
        if (!sl || !sl.ca || sl.ca.flipped) continue;
        const ca = sl.ca;
        
        // Check flip_on conditions
        if (ca.flip_on === 'no_knight') {
            const knights = getPieces(1);
            if (knights.length === 0) ca.flipped = true;
        } else if (ca.flip_on === 'no_bishop') {
            const bishops = getPieces(2);
            if (bishops.length === 0) ca.flipped = true;
        } else if (ca.flip_on === 'no_rook') {
            const rooks = getPieces(3);
            if (rooks.length === 0) ca.flipped = true;
        } else if (ca.flip_on === 'only_queen') {
            const queens = getPieces(4);
            const others = bads.filter(b => !b.dead && b.type !== 4 && b.type !== 6);
            if (queens.length > 0 && others.length === 0) ca.flipped = true;
        }
    }
}

// mkSquareBut is defined in menu.js (with 9-slice sprite rendering matching Android UI)

function removeButs() {
    // Remove menu buttons
    Entity.entities = Entity.entities.filter(e => !e.isBut);
}

function throwGrenade(sq) {
    if (grenades <= 0) return;
    grenades--;
    sfx('grenade_xpl');
    
    // Create explosion
    const e = mke(0, sq.x, sq.y);
    e.dp = DP_FX;
    e.life = 20;
    e.dr = function(e, x, y) {
        const c = 1 - e.life / 20;
        circfill(x + 8, y + 8, Math.sqrt(c) * 24, 8 + Math.floor(c * 3));
    };
    
    // Damage pieces in zone
    const zone = getZone(sq, 1);
    for (const zsq of zone) {
        if (zsq.p && zsq.p.bad) {
            hit(zsq.p, 2, { direct: 1 }, e);
        }
    }
    screenShake = 12;
}

function toggleTarget(p) {
    // Strafe ability
}

function seerTarget(p, confirm) {
    // Seer orb ability
}

function addEvent(fn, ...args) {
    eventQueue.push({ fn: fn, args: args });
}

function playEvents(nxt) {
    if (eventQueue.length > 0) {
        const ev = eventQueue.shift();
        if (ev.fn) ev.fn(...(ev.args || []));
        return true;
    }
    return false;
}

function checkAutoReplace(nxt) {
    return false;
}

function applyOptions(first) {
    Save.applyOptions();
}

function applyOption(name) {
    if (name === 'lang') {
        // Reload language
    }
    if (name === 'crt') {
        // Toggle CRT shader
    }
    if (name === 'show_danger') {
        showDangerZone = Save.getOpt('show_danger') === 1;
    }
}

// === VIGNETTE SYSTEM ===
let vignetteState = null;

function showVignetteSequence(seq, nxt) {
    if (seq.length === 0) {
        vignetteState = null;
        if (nxt) nxt();
        return;
    }
    
    const id = seq[0];
    seq.splice(0, 1);
    
    // Vignette text (from lang or hardcoded)
    const vigTexts = {
        1: "The Black King had been an extravagant and unpleasant ruler. As the years went by, more and more of his subjects were won over by the White King who offered higher wages and genuinely decent work. And then they took his castle. His knights resigned from their service. Even his wife, the Queen, abandoned him.",
        2: "Before leaving, the last black bishop came to the Black King and told him \"Thou hast been a bad king, yet thyne reign is still holy. Thou shalt retain a claim over thyne former subjects' souls, and we may yet have cause to fear thyne wrath. Thus heed my warning. The wrath of a man, as godly as might thee be, is ever his undoing.\"",
        3: "But the Black King was abandoned by all, with not a rook left to his name. All he had left was his prized royal shotgun, the shreds of his dignity, and the growing fires of the prophesized wrath. Ever my undoing was it? Undone!! Just what more exactly could I lose?!? In his dark folly, the king loaded the shotgun and went to meet his final checkmate.",
    };
    
    const desc = vigTexts[id] || '';
    
    // Create vignette background (covers entire screen)
    const vbg = mke(0, 0, 0);
    vbg.dp = DP_TOP + 1; // above everything
    vbg.dr = function() {
        rectfill(0, 0, MCW, MCH, 0);
    };
    
    // Create vignette entity
    const e = mke(0, 0, 16);
    e.dp = DP_TOP + 1;
    let tt = 0;
    let fast = false;
    let leaving = false;
    const slideTempo = 32;
    const textSpeed = 0.5;
    
    e.upd = function() {
        if (leaving) return;
        
        tt += fast ? 5 : textSpeed;
        
        if (Input.mouse.pressed) {
            Input.mouse.pressed = false;
            if (fast || tt > slideTempo) {
                leaving = true;
                wait(10, function() {
                    kl(e);
                    kl(vbg);
                    showVignetteSequence(seq, nxt);
                });
            } else {
                fast = true;
            }
        }
    };
    
    e.dr = function(e, px, py) {
        // Draw vignette image from intro spritesheet
        spritesheet('intro');
        const vw = 128, vh = 64;
        const x = (MCW - vw) / 2;
        const y = 16;
        rectfill(x, y, x + vw - 1, y + vh - 1, 5);
        sspr(0, id * vh - vh, vw, vh, x, y);
        spritesheet('gfx');
        
        // Draw text with typewriter effect
        const sw = 128 + 64;
        const lim = Math.max(tt - slideTempo / 2, 0);
        const cy = 96;
        pprint(desc, (MCW - sw) / 2, cy, sw, 4, 0, lim);
    };
    
    vignetteState = { vbg: vbg, entity: e };
}

// === UTILITY ===
function getPieceName(piece) {
    if (!piece) return '';
    if (!piece.bad) return 'King (You)';
    const typeNames = ['Pawn', 'Knight', 'Bishop', 'Rook', 'Queen', 'King', 'Boss'];
    return typeNames[piece.type] || 'Enemy';
}
