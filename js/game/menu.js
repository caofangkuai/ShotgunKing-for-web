// Menu System - title screen, weapon/rank select, options
// Ported from code/menu.lua

const BUTTON_HEIGHT = 12;

let menuState = 'title';
let menuList = [];      // current menu entities (like Lua's 'menu' table)
let selectedWeapon = 0;
let selectedRank = 0;
let skipIntro = false;
let titleEntity = null;
let menuSelIndex = -1;

// === TITLE SCREEN ===
function initMenu(gotoPlay) {
    reset();
    menuState = 'title';
    menuList = [];
    menuSelIndex = -1;
    
    const intro = !skipIntro;
    skipIntro = true;
    
    const tempo = intro ? 60 : 30;
    
    music('title_A');
    fd = -3;
    fadeTo(0, 24);
    
    // Background
    const bg = mke(0, 0, 0);
    bg.dp = DP_BG;
    bg.upd = function() {
        if (intro && bg.t > 240 && (Input.mouse.pressed || btnp('validate'))) {
            sfx('start', 0.75);
            wait(5, () => openMenu());
        }
    };
    bg.dr = function(e, x, y) {
        spritesheet('title');
        sspr(0, 0, MCW, MCH, x, y);
        spritesheet('gfx');
        
        var sav = font();
        font('pico');
        lprint('PUNKCAKE#9 v1.515g', 1, 1, 2);
        font(sav);
    };
    
    // CASTLE - slides up from below
    const castle = mke(0, 0, 17 + MCH / 2);
    castle.dp = DP_BG + 1;
    castle.dr = function(e, x, y) {
        spritesheet('title');
        sspr(0, 189, 307, 163, x, y);
        spritesheet('gfx');
    };
    mvt(castle, 0, 17, tempo);
    castle.twcv = ease_in_out;
    
    // TREES - slides up from below
    const trees = mke(0, 0, 73 + MCH);
    trees.dp = DP_BG + 1;
    trees.dr = function(e, x, y) {
        spritesheet('title');
        sspr(463, 216, 49, 29, x, y + 78);
        sspr(307, 245, 205, 107, x + 115, y);
        spritesheet('gfx');
        
        if (bg.t > 240 && intro && _t % 60 < 40) {
            var txt = lang.click_start || lang.press_start || 'Click to Start';
            var w = txtwidth(txt);
            rectfill(244 - w / 2 - 3, 116 - 2, 244 + w / 2 + 3, 116 + 6, 1);
            lprint(txt, 244, 116, 5, 1);
        }
    };
    mvt(trees, 0, 73, tempo + 10);
    trees.twcv = ease_in_out;
    
    // PIECES - slides up from below
    const pieces = mke(0, 0, 114 + MCH * 2);
    pieces.dp = DP_BG + 2;
    pieces.dr = function(e, x, y) {
        spritesheet('title');
        sspr(320, 114, 192, 66, x, y);
        spritesheet('gfx');
    };
    mvt(pieces, 0, 114, tempo + 15);
    pieces.twcv = ease_in_out;
    
    // TITLE - piece by piece animation
    titleEntity = mke();
    titleEntity.dp = DP_TOP;
    
    var boxes = [
        [320, 0, 142, 28], [320, 31, 142, 52],
        [324, 84, 7, 12], [331, 84, 10, 12], [340, 84, 7, 12],
        [350, 84, 6, 12], [356, 84, 4, 12], [359, 84, 9, 12],
        [367, 84, 9, 12], [376, 84, 8, 12],
        [386, 84, 8, 12], [394, 84, 10, 12], [403, 84, 8, 12],
        [411, 84, 7, 12], [418, 84, 8, 12], [426, 84, 10, 12],
        [436, 84, 9, 12], [445, 84, 6, 12], [451, 84, 7, 12],
    ];
    
    var bi = 0;
    var prev = null;
    
    function spawnTitle() {
        if (bi >= boxes.length) return;
        
        var b = boxes[bi];
        var mult = intro ? 1 : 0;
        
        var tx = (b[0] - 320) + 173;
        var ty = b[1] + 7;
        var e = mke(0, tx, MCH);
        add_child(titleEntity, e);
        e.bi = bi + 1;
        bi++;
        
        e.dr = function(e, x, y) {
            if (e.c_shake) {
                y = y + e.c_shake * (Math.sin(_t * 0.8) * 2 - 1);
                e.c_shake = Math.max(0, e.c_shake - 0.3);
            }
            spritesheet('title');
            sspr(b[0], b[1], b[2], b[3], x, y - 5);
            spritesheet('gfx');
        };
        
        var p = prev;
        function beep() {
            if (!intro) return;
            if (e.bi <= 2) {
                sfx('shoot');
            } else {
                sfx('spawn');
            }
            if (p) {
                p.c_shake = e.bi <= 2 ? 8 : 3;
            }
        }
        
        mvt(e, tx, ty, 30 * mult);
        e.twcv = ease_bounce_out;
        wait(15, beep);
        wait((e.bi <= 2 ? 30 : 6) * mult, spawnTitle);
        
        prev = e;
    }
    
    wait(tempo, spawnTitle);
    
    if (!intro) {
        wait(tempo, function() { openMenu(); });
    }
    
    mdr = drawMenu;
}

// === OPEN MENU ===
function openMenu(a, type) {
    closeMenu();
    menuList = [];
    menuSelIndex = -1;
    
    if (!a) {
        a = ['play', 'options', 'quit'];
    }
    
    var ma = 8;
    var ecy = BUTTON_HEIGHT;
    var pw = 64;
    var ph = 2 * ma + a.length * ecy - 2;
    var px = 212;
    var py = 108;
    
    var dk = py + ph - (MCH - 4);
    if (dk > 0) py = py - dk / 2;
    
    // ERASER - clears area behind menu
    var eraser = mke();
    eraser.dp = DP_TOP;
    eraser.perm = true;
    eraser.dr = function() {};
    menuList.push(eraser);
    
    // BUTTONS
    for (var i = 0; i < a.length; i++) {
        var name = a[i];
        var by = py + ma + i * ecy - 2;
        var m = mkMenuBut(name, px, by, pw, ecy - 2);
        m.menuIndex = i;
        menuList.push(m);
        
        // Slide in animation - alternating left/right
        var s = (i % 2) * 2 - 1;
        m.x = m.x + s * 16;
        mv(m, -s * 16, 0, 16);
        m.twcv = ease_out;
    }
    
    // Input handler for keyboard navigation
    var nav = mke(0, 0, 0);
    nav.dp = DP_TOP;
    nav.perm = true;
    nav.upd = function() {
        if (btnp('down')) {
            menuSelIndex = Math.min(menuSelIndex + 1, a.length - 1);
            sfx('sel_opt', 0.4);
        }
        if (btnp('up')) {
            menuSelIndex = Math.max(menuSelIndex - 1, 0);
            sfx('sel_opt', 0.4);
        }
        if (menuSelIndex >= 0 && menuSelIndex < a.length && btnp('validate')) {
            var btn = menuList[menuSelIndex + 1]; // +1 for eraser offset
            if (btn && !btn.lock) {
                btn.clicked = true;
                actMenu(btn.id);
            }
        }
        if (btnp('cancel')) {
            // Go back to title
            actMenu('back');
        }
    };
    menuList.push(nav);
}

// === MENU BUTTON ===
function mkMenuBut(id, x, y, w, h) {
    var lock = isLocked(id);
    var first = menuList.length === 1;
    
    var e = mke(0, x, y);
    e.id = id;
    e.name = lang[id] || id;
    e.lock = lock;
    e.perm = true;
    e.dp = DP_TOP;
    e.pw = w;
    e.ph = h;
    e.ov = false;
    e.clicked = false;
    e.inside = false;
    
    // Click handler
    e.upd = function() {
        var ins = Input.mouse.x >= e.x && Input.mouse.x < e.x + w &&
                  Input.mouse.y >= e.y && Input.mouse.y < e.y + h;
        
        // Keyboard selection highlight
        if (e.menuIndex !== undefined && e.menuIndex === menuSelIndex) {
            e.ov = true;
        }
        
        if (e.inside && !ins && (e.menuIndex === undefined || e.menuIndex !== menuSelIndex)) {
            e.ov = false;
            e.clicked = false;
        }
        if (!e.inside && ins) {
            e.ov = true;
            if (e.menuIndex !== undefined) menuSelIndex = e.menuIndex;
            sfx('sel_opt', 0.4);
        }
        e.inside = ins;
        
        if (ins && Input.mouse.pressed && !e.lock) {
            e.clicked = true;
            actMenu(e.id);
        }
    };
    
    // 9-slice sprite button rendering
    e.dr = function(e, x, y) {
        e.name = lang[e.id] || e.name || e.id;
        var name = e.red ? (e.name + '?') : e.name;
        
        spritesheet('title');
        
        var labelc = 4;
        var valc = 4;
        
        if (e.lock) {
            // Locked
            sspr(320, 216, 2, 12, x, y, 2, BUTTON_HEIGHT);
            sspr(322, 216, 1, 12, x + 2, y, w - 4, BUTTON_HEIGHT);
            sspr(382, 216, 2, 12, x + w - 2, y, 2, BUTTON_HEIGHT);
            labelc = 1;
            valc = 1;
            if (e.ov) labelc = 3;
        } else if (e.ov && e.clicked) {
            // Clicked
            sspr(320, 180, 2, 12, x, y, 2, BUTTON_HEIGHT);
            sspr(322, 180, 1, 12, x + 2, y, w - 4, BUTTON_HEIGHT);
            sspr(382, 180, 2, 12, x + w - 2, y, 2, BUTTON_HEIGHT);
            labelc = 1;
        } else if (e.ov) {
            // Hover
            sspr(320, 192, 2, 12, x, y, 2, BUTTON_HEIGHT);
            sspr(322, 192, 1, 12, x + 2, y, w - 4, BUTTON_HEIGHT);
            sspr(382, 192, 2, 12, x + w - 2, y, 2, BUTTON_HEIGHT);
            labelc = 1;
            valc = 5;
        } else {
            // Normal
            sspr(320, 204, 2, 12, x, y, 2, BUTTON_HEIGHT);
            sspr(322, 204, 1, 12, x + 2, y, w - 4, BUTTON_HEIGHT);
            sspr(382, 204, 2, 12, x + w - 2, y, 2, BUTTON_HEIGHT);
            labelc = e.labelc || 4;
            valc = 4;
        }
        spritesheet('gfx');
        
        var pico = e.pico;
        var fntsav;
        if (pico) {
            fntsav = font();
            font('pico');
        }
        
        // NAME - centered
        var txty = y + (BUTTON_HEIGHT * 0.5) - 2;
        if (e.align_left) {
            lprint(name, x + 4, txty, labelc);
        } else {
            lprint(name, x + w / 2, txty, labelc, 1);
        }
        
        // VALUE (for options)
        if (e.val) {
            lprint(e.val, x + w - 4, txty, valc, 2);
        }
        
        // SLIDER
        if (e.slider !== undefined) {
            for (var i = 0; i < 10; i++) {
                var sx = x + w + i * 2 - 10 * 2 - 4;
                var sy = y + BUTTON_HEIGHT * 0.5;
                line(sx, sy - 3, sx, sy + 1, i < e.slider ? valc : 1);
            }
        }
        
        if (pico && fntsav !== 'pico') {
            font(fntsav);
        }
    };
    
    return e;
}

// Check if a menu item is locked
function isLocked(id) {
    // No locked items in web version
    return false;
}

// === MENU ACTION ===
function actMenu(id) {
    sfx('menu_in');
    
    switch (id) {
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
            initMenu();
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
    for (var i = 0; i < menuList.length; i++) {
        kl(menuList[i]);
    }
    menuList = [];
}

// === WEAPON SELECTION ===
function initWeaponSelect() {
    selectedWeapon = ThroneMode.weaponsIndex || 0;
    fadeTo(0, 20);
    
    var bg = mke(0, 0, 0);
    bg.dp = DP_BG;
    bg.dr = function() {
        rectfill(0, 0, MCW, MCH, 0);
        
        lprint(lang.choose_weapon || 'Choose Your Weapon', MCW / 2, 8, 7, 1);
        
        var w = WEAPONS[selectedWeapon];
        if (w) {
            lprint(w.name, MCW / 2, 24, 10, 1);
            
            var y = 40;
            var stats = [
                { name: lang.power || 'Power', val: w.firepower },
                { name: lang.range || 'Range', val: w.firerange },
                { name: lang.chamber || 'Chamber', val: w.chamber_max },
                { name: lang.ammo || 'Ammo', val: w.ammo_max },
                { name: lang.spread || 'Spread', val: w.spread + '\u00b0' },
            ];
            if (w.knockback) stats.push({ name: lang.knock || 'Knock', val: w.knockback + '%' });
            if (w.pierce) stats.push({ name: lang.pierc || 'Pierce', val: w.pierce + '%' });
            if (w.blade) stats.push({ name: lang.blade || 'Blade', val: w.blade });
            if (w.search) stats.push({ name: lang.search || 'Search', val: w.search });
            
            for (var i = 0; i < stats.length; i++) {
                var s = stats[i];
                lprint(s.name + ':', 60, y, 3);
                lprint(String(s.val), 260, y, 5, 2);
                y += 10;
            }
        }
        
        lprint('< ' + (lang.select || 'Select') + ' >', MCW / 2, MCH - 16, 7, 1);
        lprint(lang.press_enter || 'Press Enter', MCW / 2, MCH - 8, 5, 1);
    };
    
    var input = mke(0, 0, 0);
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
    var maxRank = Save.data.prog.throne ? (Save.data.prog.throne.rank || 0) : 0;
    fadeTo(0, 20);
    
    var bg = mke(0, 0, 0);
    bg.dp = DP_BG;
    bg.dr = function() {
        rectfill(0, 0, MCW, MCH, 0);
        
        lprint(lang.choose_rank || 'Choose Your Rank', MCW / 2, 8, 7, 1);
        lprint((lang.rank || 'Rank') + ': ' + (selectedRank + 1), MCW / 2, 24, 10, 1);
        
        var y = 40;
        for (var i = 0; i <= selectedRank && i < RANKS.length; i++) {
            var desc = describeRank(RANKS[i]);
            var col = i === selectedRank ? 8 : 3;
            lprint(desc, MCW / 2, y, col, 1);
            y += 10;
        }
        
        for (var i = selectedRank + 1; i < RANKS.length && y < MCH - 20; i++) {
            if (i > maxRank) {
                lprint('???', MCW / 2, y, 5, 1);
            } else {
                lprint(describeRank(RANKS[i]), MCW / 2, y, 5, 1);
            }
            y += 10;
        }
        
        lprint('< ' + (lang.select || 'Select') + ' >', MCW / 2, MCH - 16, 7, 1);
    };
    
    var input = mke(0, 0, 0);
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
    
    var opts = ['music', 'sfx', 'shields', 'show_danger', 'scrshake', 'scrflash', 'lang', 'back'];
    var selIndex = 0;
    
    var ma = 8;
    var ecy = BUTTON_HEIGHT;
    var pw = 64;
    var ph = 2 * ma + opts.length * ecy - 2;
    var px = 212;
    var py = MCH / 2 - ph / 2;
    
    var dk = py + ph - (MCH - 4);
    if (dk > 0) py = py - dk / 2;
    
    // Eraser
    var eraser = mke();
    eraser.dp = DP_TOP;
    eraser.perm = true;
    menuList.push(eraser);
    
    for (var i = 0; i < opts.length; i++) {
        var id = opts[i];
        var by = py + ma + i * ecy - 2;
        var m = mkMenuBut(id, px, by, pw, ecy - 2);
        m.align_left = true;
        
        // Set up option value display
        var o = OPTIONS[id];
        if (o) {
            if (o.opt === 11 && id !== 'lang') {
                // Slider
                m.slider = SET[o.nid];
                m.upn = function() { m.slider = SET[o.nid]; };
            } else {
                // Value display
                m.upn = function() {
                    var k = SET[o.nid];
                    if (id === 'lang') {
                        k = lang.lang_endonym || 'English';
                    } else if (o.labels) {
                        k = o.labels[k + 1];
                    } else if (o.opt === 2) {
                        k = k === 0 ? (lang.off || 'OFF') : (lang.on || 'ON');
                    }
                    m.val = (k || '') + '';
                };
            }
            m.upn();
        }
        
        menuList.push(m);
        
        // Slide in animation
        var s = (i % 2) * 2 - 1;
        m.x = m.x + s * 16;
        mv(m, -s * 16, 0, 16);
        m.twcv = ease_out;
    }
    
    // Input handler for options
    var input = mke(0, 0, 0);
    input.dp = DP_TOP;
    input.perm = true;
    input.upd = function() {
        if (btnp('down')) {
            selIndex = (selIndex + 1) % opts.length;
            sfx('sel_opt', 0.4);
        }
        if (btnp('up')) {
            selIndex = (selIndex - 1 + opts.length) % opts.length;
            sfx('sel_opt', 0.4);
        }
        if (btnp('left') || btnp('right')) {
            var id = opts[selIndex];
            if (id === 'back') return;
            var o = OPTIONS[id];
            if (o) {
                var dir = btnp('right') ? 1 : -1;
                var val = SET[o.nid] || 0;
                val = (val + dir + o.opt) % o.opt;
                SET[o.nid] = val;
                sfx('tic', 0.5);
                applyOption(id);
                // Update button display
                for (var j = 0; j < menuList.length; j++) {
                    if (menuList[j].id === id && menuList[j].upn) {
                        menuList[j].upn();
                    }
                }
            }
        }
        if (btnp('validate') || btnp('cancel')) {
            var id = opts[selIndex];
            if (id === 'back' || btnp('cancel')) {
                sfx('menu_out');
                Save.save();
                closeMenu();
                menuState = 'title';
                initMenu();
            }
        }
    };
    menuList.push(input);
    
    mdr = drawMenu;
}

// === SAVE EXPORT/IMPORT ===
function exportSaveData() {
    var json = Save.exportJSON();
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'shotgun_king_save.json';
    a.click();
    URL.revokeObjectURL(url);
    sfx('sel_opt');
}

function importSaveData() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(ev) {
            var json = ev.target.result;
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
    var shX = 0, shY = 0;
    if (screenShake > 0) {
        shX = (Math.random() * 2 - 1) * screenShake;
        shY = (Math.random() * 2 - 1) * screenShake;
        screenShake = Math.max(0, screenShake - 0.5);
    }
    camera(shX, shY);
    
    // Draw entities by depth
    var layers = [];
    for (var i = 0; i < 16; i++) layers.push([]);
    
    for (var e of Entity.entities) {
        if (e.dead) continue;
        var dp = Math.max(0, Math.min(15, e.dp || 0));
        layers[dp].push(e);
    }
    
    for (var layer of layers) {
        for (var e of layer) {
            dre(e);
        }
    }
    
    camera();
    Sugar.updateFade();
    Sugar.drawFade();
}

// === PAUSE ===
function pauseGame() {
    if (!ingame || !playing) return;
    pause = true;
    timerun = false;
    sfx('pause');
    
    var bg = mke(0, 0, 0);
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
    Entity.entities = Entity.entities.filter(function(e) {
        return !e.perm || e === inter || e === bg || e === board;
    });
}
