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
let eventQueue = [];
let executions = [];

// === INIT GAME ===
function initGame() {
    Entity.reset();
    mode.frags = {};
    fadeTo(0, 30);
    mdr = drawGame;
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
        e.hurt = null;
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
    
    const land = function() {
        if (hero.big) {
            sfx('boss_land');
            screenShake = 8;
        }
        hero.inMove = false;
        if (cb) cb();
    };
    
    mvt(hero, tx, ty, t, land);
    hero.inMove = true;
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
    if (e.iron && !at.direct) return;
    
    // Shield check
    if (e.shield) {
        e.shield--;
        sfx('shield');
        return;
    }
    
    // Bleeding bonus
    if (e.bleed && stack.tearing) {
        dmg += 1;
    }
    if (e.bleed) {
        dmg += 1;
    }
    
    // Apply damage
    e.hp -= dmg;
    e.hurt = 10;
    e.cShake = 8;
    
    sfx(e.boss ? 'hurt_boss' : 'hurt');
    
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
                    const [tx, ty] = sqp(nsq);
                    mvt(e, tx, ty, 10);
                    leaveSq(e);
                    e.sq = nsq;
                    nsq.p = e;
                } else if (!nsq) {
                    // Knocked off board
                    kl(e);
                    onDeath(e);
                    return;
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

// === OPPONENT TURN ===
function oppTurn() {
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
    mvt(e, tx, ty, t, function() {
        e.inMove = false;
        if (cb) cb();
    });
    e.inMove = true;
    
    // Jump animation
    const ev = loop(function(ev) {
        const c = ev.t / t;
        e.z = -Math.sin(c / 2) * 8;
    }, t);
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
    hero.hurt = 10;
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
    
    fadeTo(-4, 30, function() {
        if (nxt) nxt();
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
    
    // Apply z offset
    const dy = e.z || 0;
    
    if (e === hero) {
        // Draw hero (black king)
        const fr = 176;
        sspr(fr, 0, 16, 16, x, y + dy);
        
        // Draw aim indicator
        if (aim || ctrlMode === 'aim') {
            const an = hero.an || 0;
            const ax = x + 8 + cos(an) * 8;
            const ay = y + 8 + sin(an) * 8;
            line(x + 8, y + 8, ax, ay, 8);
        }
    } else if (e.bad) {
        // Draw white piece
        const spx = 176 + e.type * 16;
        let spy = 192;
        
        if (e.iron) {
            spy = 208;
        }
        
        sspr(spx, spy, 16, 16, x, y + dy);
        
        // HP bar
        if (e.hp < e.hp_max) {
            const w = 12;
            const h = 2;
            const bx = x + 2;
            const by = y - 3 + dy;
            rectfill(bx, by, bx + w, by + h, 0);
            const hpw = Math.floor(w * e.hp / e.hp_max);
            rectfill(bx, by, bx + hpw, by + h, 8);
        }
        
        // Hurt flash
        if (e.hurt && e.hurt > 0) {
            e.hurt--;
            if (Math.floor(e.hurt / 2) % 2 === 0) {
                pal(7, 8);
                sspr(spx, spy, 16, 16, x, y + dy);
                palRst();
            }
        }
    }
}

function drawUI() {
    if (!ingame) return;
    
    // Save current font and use pico for all gameplay UI
    var savedFont = font();
    font('pico');
    
    spritesheet('gfx');
    
    // Chamber (top row, closest to board)
    const chmax = Math.max(stack.chamber_max || 0, chamber);
    for (let i = 0; i < chmax; i++) {
        const y = boardY - 10;
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
    var shotgunX = boardX + chmax * 4 + 4;
    var shotgunY = boardY - 14;
    sspr(wfr, wfy, 24, 16, shotgunX, shotgunY);
    
    spritesheet('gfx');
    
    // Ammo display (second row, below chamber)
    const ram = ammo - waitAmmo;
    for (let i = 0; i < (stack.ammo_max || 0); i++) {
        const y = boardY - 3;
        sspr(i < ram ? 4 : 0, 56, 3, 7, boardX + i * 4, y);
    }
    
    // Shields (right of ammo)
    const shieldsMax = SET.get('shields');
    for (let i = 0; i < shieldsMax; i++) {
        sspr(i < shields ? 32 : 38, 64, 6, 7, boardX + (stack.ammo_max || 0) * 4 + i * 6 + 1, boardY - 3);
    }
    
    // Floor display (centered, below board top)
    const s = (lang.floor_ || 'Floor') + ' ';
    const lx = lprint(s, MCW / 2, 2, 3, 1);
    lprint(String(mode.lvl || 1), lx, 2, 5);
    
    // Turn counter (bottom left)
    if (mode.turns) {
        lprint(lang.turn || 'Turn', 2, boardY + ymax * SQ + 2, 3);
        lprint(String(mode.turns), 2 + txtwidth(lang.turn || 'Turn') + 4, boardY + ymax * SQ + 2, 5);
    }
    
    // Stats panel (left side)
    drawStatsPanel();
    
    // Card display (right side)
    drawCardsPanel();
    
    // Level up UI
    if (leveling) {
        drawLevelUpUI();
    }
    
    // Game over UI
    if (ingameover) {
        drawGameOverUI();
    }
    
    // Restore font
    font(savedFont);
}

function drawStatsPanel() {
    const x = 2;
    
    const stats = getDispStats();
    const ec = 8;
    let cy = boardY + ymax * SQ - stats.length * ec;
    
    for (const s of stats) {
        lprint(s.name, x, cy, 3);
        lprint(s.value, x + 28, cy, 5);
        cy += ec;
    }
    
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
    const x = boardX + xmax * SQ + 3;
    const startY = boardY;
    const cardH = 14;
    const maxSlots = 10;
    
    if (!cardSlots) return;
    
    // Calculate how many slots can fit vertically
    var availH = MCH - startY - 2;
    var slotH = Math.min(cardH, Math.floor(availH / maxSlots));
    
    for (let i = 0; i < maxSlots; i++) {
        const sl = cardSlots[i];
        const cx = x;
        const cy = startY + i * slotH;
        
        if (!sl || !sl.ca) {
            // Empty slot indicator
            rectfill(cx, cy, cx + 22, cy + slotH - 1, 1);
            rect(cx, cy, cx + 22, cy + slotH - 1, 0);
        } else {
            const ca = sl.ca;
            
            if (ca.flipped) {
                // Flipped card
                rectfill(cx, cy, cx + 22, cy + slotH - 1, 1);
                rect(cx, cy, cx + 22, cy + slotH - 1, 0);
                lprint('x', cx + 8, cy + 2, 5);
            } else {
                // Active card
                const team = ca.team || 0;
                rectfill(cx, cy, cx + 22, cy + slotH - 1, team === 1 ? 4 : 5);
                rect(cx, cy, cx + 22, cy + slotH - 1, 0);
                
                // Card name (truncated)
                var name = ca.id || '';
                if (name.length > 8) name = name.substring(0, 8);
                lprint(name, cx + 2, cy + 2, team === 1 ? 7 : 0);
            }
        }
    }
}

function drawLevelUpUI() {
    if (!leveling || !leveling.choices) return;
    
    // Darken background
    rectfill(0, 0, MCW, MCH, 0);
    
    // Title
    lprint(lang.level_up || 'Level Up!', MCW / 2, 10, 5, 1);
    
    // Card choices
    const choices = leveling.choices;
    const cardW = 24;
    const cardH = 32;
    const totalW = choices.length * (cardW + 8) - 8;
    const startX = (MCW - totalW) / 2;
    const startY = MCH / 2 - cardH / 2;
    
    for (let i = 0; i < choices.length; i++) {
        const ca = choices[i];
        const x = startX + i * (cardW + 8);
        const y = startY;
        
        // Card background
        const team = ca.team || 0;
        rectfill(x, y, x + cardW, y + cardH, team === 1 ? 4 : 5);
        rect(x, y, x + cardW, y + cardH, 0);
        
        // Hover highlight
        if (Input.mouseInRect(x, y, cardW, cardH)) {
            rect(x - 1, y - 1, x + cardW + 1, y + cardH + 1, 8);
        }
        
        // Card name
        const name = ca.id;
        pprint(name, x + 2, y + 2, cardW - 4, 0, 0, 3);
    }
    
    // Instructions
    lprint(lang.choose_card || 'Choose a card', MCW / 2, MCH - 10, 7, 1);
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

function mkSquareBut(label, fn, pw) {
    const e = mke(0, 0, 0);
    e.label = label;
    e.fn = fn;
    e.pw = pw || 32;
    e.ph = 12;
    e.dp = DP_TOP;
    e.dr = function(e, x, y) {
        const hover = Input.mouseInRect(x, y, e.pw, e.ph);
        rectfill(x, y, x + e.pw, y + e.ph, hover ? 5 : 1);
        rect(x, y, x + e.pw, y + e.ph, 7);
        lprint(e.label, x + e.pw / 2, y + 2, hover ? 0 : 7, 1);
    };
    e.upd = function(e) {
        if (e.t > 5 && Input.mouse.pressed && Input.mouseInRect(e.x, e.y, e.pw, e.ph)) {
            e.fn();
        }
        if (e.t > 5 && btnp('validate') && rov === e) {
            e.fn();
        }
    };
    return e;
}

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
