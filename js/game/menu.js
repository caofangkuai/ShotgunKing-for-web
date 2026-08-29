// Menu System - title screen, weapon/rank select, options
// Ported from code/menu.lua

let menuState = 'title'; // title, weapon_select, rank_select, options, game
let menuButtons = [];
let selectedWeapon = 0;
let selectedRank = 0;
let titleAnimT = 0;

function initMenu(gotoPlay) {
    reset();
    menuState = 'title';
    titleAnimT = 0;
    
    music('title_A');
    fadeTo(0, 30);
    
    // Background entity
    const bg = mke(0, 0, 0);
    bg.dp = DP_BG;
    bg.dr = function(e, x, y) {
        // Draw title background
        spritesheet('title');
        sspr(0, 0, MCW, MCH, x, y);
        spritesheet('gfx');
        
        // Version text
        const sav = font();
        font('pico');
        lprint('v' + (Save.data.version || '1.515g'), 1, 1, 2);
        font(sav);
    };
    
    // Castle entity
    const castle = mke(0, 0, 17 + MCH / 2);
    castle.dp = DP_BG + 1;
    castle.dr = function(e, x, y) {
        spritesheet('title');
        sspr(0, 189, 307, 163, x, y);
        spritesheet('gfx');
    };
    mvt(castle, 0, 17, 30);
    
    // Pieces entity
    const pieces = mke(0, 0, 114 + MCH * 2);
    pieces.dp = DP_BG + 2;
    pieces.dr = function(e, x, y) {
        spritesheet('title');
        sspr(320, 114, 192, 66, x, y);
        spritesheet('gfx');
    };
    mvt(pieces, 0, 114, 45);
    
    // Press start text
    const pst = mke(0, 0, 0);
    pst.dp = DP_TOP;
    pst.dr = function(e, x, y) {
        if (titleAnimT > 120 && Math.floor(titleAnimT / 60) % 2 === 0) {
            const txt = lang.click_start || lang.press_start || 'Click to Start';
            const w = txtwidth(txt);
            rectfill(MCW / 2 - w / 2 - 3, 116 - 2, MCW / 2 + w / 2 + 3, 116 + 6, 1);
            lprint(txt, MCW / 2, 116, 5, 1);
        }
    };
    pst.upd = function(e) {
        titleAnimT++;
        if (titleAnimT > 120 && (Input.mouse.pressed || btnp('validate'))) {
            sfx('start', 0.75);
            openMenu(['play', 'options', 'quit']);
        }
    };
    
    mdr = drawMenu;
}

function openMenu(actions) {
    closeMenu();
    menuButtons = [];
    
    const ma = 8;
    const ecy = 14;
    const pw = 80;
    const ph = 2 * ma + actions.length * ecy - 2;
    let px = MCW / 2 - pw / 2;
    let py = MCH / 2 - ph / 2;
    
    for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        const y = py + ma + i * ecy;
        const but = mkMenuBut(action, px, y, pw, ecy - 2);
        but.action = action;
        menuButtons.push(but);
    }
}

function mkMenuBut(label, x, y, w, h) {
    const e = mke(0, x, y);
    e.label = label;
    e.pw = w;
    e.ph = h;
    e.dp = DP_TOP;
    e.ov = false;
    e.t = 0;
    
    e.dr = function(e, bx, by) {
        const hover = Input.mouseInRect(bx, by, e.pw, e.ph) || e.ov;
        const bgc = hover ? 5 : 1;
        const txc = hover ? 0 : 7;
        
        rectfill(bx, by, bx + e.pw, by + e.ph, bgc);
        rect(bx, by, bx + e.pw, by + e.ph, 7);
        
        const label = lang[e.label] || e.label;
        lprint(label, bx + e.pw / 2, by + 2, txc, 1);
        
        if (hover) {
            // Arrow indicator
            lprint('>', bx - 6, by + 2, 8);
            lprint('<', bx + e.pw + 2, by + 2, 8);
        }
    };
    
    e.upd = function(e) {
        e.t++;
        const hover = Input.mouseInRect(e.x, e.y, e.pw, e.ph);
        e.ov = hover;
        
        if (e.t > 5 && hover && Input.mouse.pressed) {
            handleMenuAction(e.action);
        }
        if (e.t > 5 && hover && btnp('validate')) {
            handleMenuAction(e.action);
        }
    };
    
    return e;
}

function handleMenuAction(action) {
    if (!action) return;
    sfx('sel_opt');
    
    switch (action) {
        case 'play':
            closeMenu();
            menuState = 'weapon_select';
            initWeaponSelect();
            break;
        case 'options':
            closeMenu();
            menuState = 'options';
            initOptions();
            break;
        case 'quit':
            closeMenu();
            initMenu();
            break;
        case 'back':
            closeMenu();
            menuState = 'title';
            openMenu(['play', 'options', 'quit']);
            break;
        case 'reset_save':
            Save.reset();
            closeMenu();
            initOptions();
            break;
        case 'export_save':
            exportSaveData();
            break;
        case 'import_save':
            importSaveData();
            break;
        default:
            break;
    }
}

function closeMenu() {
    for (const b of menuButtons) {
        kl(b);
    }
    menuButtons = [];
}

// === WEAPON SELECTION ===
function initWeaponSelect() {
    selectedWeapon = ThroneMode.weaponsIndex || 0;
    fadeTo(0, 20);
    
    const bg = mke(0, 0, 0);
    bg.dp = DP_BG;
    bg.dr = function() {
        rectfill(0, 0, MCW, MCH, 0);
        
        // Title
        lprint(lang.choose_weapon || 'Choose Your Weapon', MCW / 2, 8, 7, 1);
        
        // Weapon display
        const w = WEAPONS[selectedWeapon];
        if (w) {
            // Weapon name
            lprint(w.name, MCW / 2, 24, 10, 1);
            
            // Stats
            let y = 40;
            const stats = [
                { name: lang.power || 'Power', val: w.firepower },
                { name: lang.range || 'Range', val: w.firerange },
                { name: lang.chamber || 'Chamber', val: w.chamber_max },
                { name: lang.ammo || 'Ammo', val: w.ammo_max },
                { name: lang.spread || 'Spread', val: w.spread + (lang.degree_symbol || '°') },
            ];
            if (w.knockback) stats.push({ name: lang.knock || 'Knock', val: w.knockback + '%' });
            if (w.pierce) stats.push({ name: lang.pierc || 'Pierce', val: w.pierce + '%' });
            if (w.blade) stats.push({ name: lang.blade || 'Blade', val: w.blade });
            if (w.search) stats.push({ name: lang.search || 'Search', val: w.search });
            
            for (const s of stats) {
                lprint(s.name + ':', MCW / 2 - 40, y, 3);
                lprint(String(s.val), MCW / 2 + 40, y, 5, 2);
                y += 10;
            }
        }
        
        // Instructions
        lprint('< ' + (lang.select || 'Select') + ' >', MCW / 2, MCH - 16, 7, 1);
        if (selectedWeapon === 0) {
            lprint(lang.press_enter || 'Press Enter', MCW / 2, MCH - 8, 5, 1);
        }
    };
    
    // Input handler
    const input = mke(0, 0, 0);
    input.dp = DP_TOP;
    input.upd = function() {
        if (btnp('left')) {
            selectedWeapon = (selectedWeapon - 1 + WEAPONS.length) % WEAPONS.length;
            sfx('sel_opt');
        }
        if (btnp('right')) {
            selectedWeapon = (selectedWeapon + 1) % WEAPONS.length;
            sfx('sel_opt');
        }
        if (btnp('validate')) {
            sfx('menu_in');
            ThroneMode.weaponsIndex = selectedWeapon;
            closeMenu();
            menuState = 'rank_select';
            initRankSelect();
        }
        if (btnp('cancel')) {
            sfx('menu_out');
            closeMenu();
            menuState = 'title';
            initMenu();
        }
    };
    
    mdr = drawMenu;
}

// === RANK SELECTION ===
function initRankSelect() {
    selectedRank = ThroneMode.ranksIndex || 0;
    const maxRank = Save.data.prog.throne ? (Save.data.prog.throne.rank || 0) : 0;
    fadeTo(0, 20);
    
    const bg = mke(0, 0, 0);
    bg.dp = DP_BG;
    bg.dr = function() {
        rectfill(0, 0, MCW, MCH, 0);
        
        // Title
        lprint(lang.choose_rank || 'Choose Your Rank', MCW / 2, 8, 7, 1);
        
        // Rank display
        lprint(lang.rank || 'Rank' + ': ' + (selectedRank + 1), MCW / 2, 24, 10, 1);
        
        // Rank effects
        let y = 40;
        for (let i = 0; i <= selectedRank && i < RANKS.length; i++) {
            const r = RANKS[i];
            const desc = describeRank(r);
            const col = i === selectedRank ? 8 : 3;
            lprint(desc, MCW / 2, y, col, 1);
            y += 10;
        }
        
        // Show locked ranks
        for (let i = selectedRank + 1; i < RANKS.length && y < MCH - 20; i++) {
            if (i > maxRank) {
                lprint('???', MCW / 2, y, 5, 1);
                y += 10;
            } else {
                const r = RANKS[i];
                const desc = describeRank(r);
                lprint(desc, MCW / 2, y, 5, 1);
                y += 10;
            }
        }
        
        // Instructions
        lprint('< ' + (lang.select || 'Select') + ' >', MCW / 2, MCH - 16, 7, 1);
    };
    
    // Input handler
    const input = mke(0, 0, 0);
    input.dp = DP_TOP;
    input.upd = function() {
        if (btnp('left')) {
            if (selectedRank > 0) {
                selectedRank--;
                sfx('sel_opt');
            }
        }
        if (btnp('right')) {
            if (selectedRank < maxRank && selectedRank < RANKS.length - 1) {
                selectedRank++;
                sfx('sel_opt');
            }
        }
        if (btnp('validate')) {
            sfx('start');
            ThroneMode.ranksIndex = selectedRank;
            closeMenu();
            menuState = 'game';
            // Start the game!
            setMode('throne');
            mode.start();
        }
        if (btnp('cancel')) {
            sfx('menu_out');
            closeMenu();
            menuState = 'weapon_select';
            initWeaponSelect();
        }
    };
    
    mdr = drawMenu;
}

function describeRank(r) {
    if (!r) return '';
    if (r.gain) return 'Army: +' + (Array.isArray(r.gain) ? r.gain.join(',') : r.gain);
    if (r.ai_lvl) return 'AI Level +' + r.ai_lvl;
    if (r.spread) return 'Spread +' + r.spread;
    if (r.king_hp) return 'King HP +' + r.king_hp;
    if (r.rook_hp) return 'Rook HP +' + r.rook_hp;
    if (r.boss_hprc) return 'Boss HP +' + r.boss_hprc + '%';
    if (r.ammo_max) return 'Ammo ' + (r.ammo_max > 0 ? '+' : '') + r.ammo_max;
    if (r.all_hp) return 'All HP +' + r.all_hp;
    if (r.nothing) return 'Nothing';
    return 'Bonus';
}

// === OPTIONS ===
function initOptions() {
    fadeTo(0, 20);
    
    const opts = ['music', 'sfx', 'shields', 'show_danger', 'scrshake', 'scrflash', 'lang', 'back'];
    let selIndex = 0;
    
    const bg = mke(0, 0, 0);
    bg.dp = DP_BG;
    bg.dr = function() {
        rectfill(0, 0, MCW, MCH, 0);
        lprint(lang.options || 'Options', MCW / 2, 8, 7, 1);
        
        let y = 24;
        for (let i = 0; i < opts.length; i++) {
            const opt = opts[i];
            const val = Save.getOpt(opt);
            const col = i === selIndex ? 8 : 3;
            
            lprint(opt + ':', 40, y, col);
            lprint(String(val), 120, y, 5);
            y += 12;
        }
        
        // Instructions
        lprint(lang.up_down_select || 'Up/Down to select, Left/Right to change', MCW / 2, MCH - 8, 5, 1);
    };
    
    const input = mke(0, 0, 0);
    input.dp = DP_TOP;
    input.upd = function() {
        if (btnp('up')) {
            selIndex = (selIndex - 1 + opts.length) % opts.length;
            sfx('sel_opt');
        }
        if (btnp('down')) {
            selIndex = (selIndex + 1) % opts.length;
            sfx('sel_opt');
        }
        if (btnp('left') || btnp('right')) {
            const opt = opts[selIndex];
            if (opt === 'back') return;
            const dir = btnp('right') ? 1 : -1;
            const o = OPTIONS[opt];
            if (o) {
                let val = Save.getOpt(opt);
                val = mid(0, val + dir, o.opt);
                Save.setOpt(opt, val);
                sfx('sel_opt');
                applyOption(opt);
            }
        }
        if (btnp('validate') || btnp('cancel')) {
            const opt = opts[selIndex];
            if (opt === 'back' || btnp('cancel')) {
                sfx('menu_out');
                closeMenu();
                menuState = 'title';
                initMenu();
            }
        }
    };
    
    mdr = drawMenu;
}

// === SAVE EXPORT/IMPORT ===
function exportSaveData() {
    const json = Save.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shotgun_king_save.json';
    a.click();
    URL.revokeObjectURL(url);
    sfx('sel_opt');
}

function importSaveData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(ev) {
            const json = ev.target.result;
            if (Save.importJSON(json)) {
                sfx('alleluia');
                DEN.init();
                closeMenu();
                initOptions();
            } else {
                sfx('wrong');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// === MENU DRAW ===
function drawMenu() {
    cls(0);
    camera();
    
    // Screen shake
    let shY = 0, shX = 0;
    if (screenShake > 0) {
        shX = (Math.random() * 2 - 1) * screenShake;
        shY = (Math.random() * 2 - 1) * screenShake;
        screenShake = Math.max(0, screenShake - 0.5);
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
    
    // Fade
    Sugar.updateFade();
    Sugar.drawFade();
}

// === PAUSE ===
function pauseGame() {
    if (!ingame || !playing) return;
    pause = true;
    timerun = false;
    sfx('pause');
    
    const bg = mke(0, 0, 0);
    bg.dp = DP_TOP;
    bg.perm = true;
    bg.dr = function() {
        rectfill(0, 0, MCW, MCH, 0);
        lprint(lang.paused || 'PAUSED', MCW / 2, MCH / 2 - 8, 7, 1);
        lprint(lang.press_esc || 'Press ESC to resume', MCW / 2, MCH / 2 + 4, 5, 1);
    };
    
    openMenu(['resume', 'options', 'show_danger', 'quit']);
}

function unpause() {
    pause = false;
    timerun = true;
    closeMenu();
    // Remove pause overlay
    Entity.entities = Entity.entities.filter(e => !e.perm || e === inter || e === bg || e === board);
}
