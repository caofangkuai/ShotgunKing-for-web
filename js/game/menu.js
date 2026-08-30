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
    bg.menuOpened = false;
    bg.upd = function() {
        if (intro && bg.t > 240 && !bg.menuOpened && (Input.mouse.pressed || btnp('validate'))) {
            bg.menuOpened = true;
            sfx('start', 0.75);
            wait(5, () => openMenu());
        }
    };
    bg.dr = function(e, x, y) {
        spritesheet('title');
        sspr(0, 0, MCW, MCH, x, y);
        spritesheet('gfx');
        
        lprint('PUNKCAKE#9 v1.515g', 1, 1, 2);
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
            var w = txtwidthSmall(txt, 8);
            rectfill(244 - w / 2 - 3, 116 - 2, 244 + w / 2 + 3, 116 + 6, 1);
            smallPrint(txt, 244, 116, 5, 1);
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
    menuSelIndex = 0;
    
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
    eraser.dr = function() {};
    menuList.push(eraser);
    
    // BUTTONS
    for (var i = 0; i < a.length; i++) {
        var name = a[i];
        var by = py + ma + i * ecy - 2;
        var m = mkMenuBut(name, px, by, pw, ecy + 2);
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

        // Clip text to button bounds so it doesn't overflow
        clip(x, y, w, BUTTON_HEIGHT);

        // NAME - centered (use small 4px font like PICO-8)
        var txty = y + (BUTTON_HEIGHT * 0.5) - 2;
        if (e.align_left) {
            smallPrint(name, x + 4, txty, labelc);
        } else {
            smallPrint(name, x + w / 2, txty, labelc, 1);
        }

        // VALUE (for options)
        if (e.val) {
            smallPrint(e.val, x + w - 4, txty, valc, 2);
        }

        // SLIDER
        if (e.slider !== undefined) {
            for (var i = 0; i < 10; i++) {
                var sx = x + w + i * 2 - 10 * 2 - 4;
                var sy = y + BUTTON_HEIGHT * 0.5;
                line(sx, sy - 3, sx, sy + 1, i < e.slider ? valc : 1);
            }
        }

        clip();
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

// === WEAPON & RANK SELECTION (Combined - matches Android UI) ===
function initWeaponSelect() {
    reset();
    menuList = [];
    selectedWeapon = ThroneMode.weaponsIndex || 0;
    selectedRank = ThroneMode.ranksIndex || 0;
    var maxRank = Save.data.prog.throne ? (Save.data.prog.throne.rank || 0) : 0;
    
    fadeTo(0, 20);
    
    var bx = 240;       // center X for panels
    var ec = 6;         // element gap
    var tma = 12;       // top margin area (for weapon sprite)
    
    // Calculate total height and starting Y
    var th = 0;
    // Rank panel
    var rpw = 128, rph = 48;
    th += rph;
    // Weapon panel
    var wpw = 136, wph = 64;
    th += ec + wph;
    // Start button
    var sbw = 64, sbh = BUTTON_HEIGHT;
    th += ec + sbh;
    // Back button
    th += ec + sbh;
    
    var startY = (MCH - th) / 2;
    
    var elements = [];
    
    // --- Background ---
    var bg = mke(0, 0, 0);
    bg.dp = DP_BG;
    bg.dr = function() {
        // Dark background
        rectfill(0, 0, MCW, MCH, 0);
        // Decorative border
        rect(1, 1, MCW - 2, MCH - 2, 1);
        rect(3, 3, MCW - 4, MCH - 4, 1);
    };
    menuList.push(bg);
    
    // --- RANK PANEL ---
    var rankPan = mke(0, bx - rpw / 2, MCH);
    rankPan.dp = DP_TOP;
    rankPan.pw = rpw;
    rankPan.ph = rph;
    rankPan.sel = selectedRank;
    rankPan.smax = Math.min(RANKS.length - 1, maxRank);
    rankPan.selected = false;
    rankPan.ady = 8;
    
    rankPan.dr = function(e, px, py) {
        var data = RANKS[e.sel];
        
        // Panel background
        rectfill(px, py, px + rpw - 1, py + rph - 1, 1);
        if (e.selected) {
            rect(px - 1, py - 1, px + rpw, py + rph, 5);
        }
        
        // Title
        smallPrint(lang.rank || 'Rank', px + rpw / 2, py + 3, 3, 1);
        
        // Rank number (large sprite-style)
        var s = (e.sel + 1) + '';
        var numBx = px + rpw / 2 - s.length * 8;
        pal(3, 4);
        for (var i = 0; i < s.length; i++) {
            var k = parseInt(s[i]);
            if (!isNaN(k)) {
                sspr(k * 16, 256, 16, 16, numBx + i * 16, py + 12);
            }
        }
        pal();
        
        // Description
        var desc = describeRank(data);
        desc = sbs(desc, '%$', lang.degree_symbol || '\u00b0');
        smallPrint(desc, px + rpw / 2, py + 38, 3, 1);
    };
    elements.push(rankPan);
    menuList.push(rankPan);
    
    // Rank arrows
    for (var ai = 0; ai < 2; ai++) {
        (function(ai) {
            var ar = mke(0, 3 + (rpw - 14) * ai, 8);
            ar.dp = DP_TOP;
            add_child(rankPan, ar);
            ar.vis = true;
            ar.dr = function(e, x, y) {
                ar.vis = true;
                if ((ai === 0 && rankPan.sel === 0) || (ai === 1 && rankPan.sel >= rankPan.smax)) {
                    ar.vis = false;
                    return;
                }
                var cl = rankPan.selected ? 4 : 5;
                spritesheet('gfx');
                if (ai === 0) {
                    // Left arrow
                    sspr(192, 160, 8, 24, x, y, 8, 24, false);
                } else {
                    // Right arrow (flipped)
                    sspr(192, 160, 8, 24, x, y, 8, 24, true);
                }
            };
            ar.upd = function() {
                if (!ar.vis) return;
                var wx = rankPan.x + ar.x;
                var wy = rankPan.y + ar.y;
                if (Input.mouse.x >= wx && Input.mouse.x < wx + 8 &&
                    Input.mouse.y >= wy && Input.mouse.y < wy + 24 &&
                    Input.mouse.pressed) {
                    var inc = ai * 2 - 1; // -1 for left, +1 for right
                    rankPan.sel = mid(0, rankPan.sel + inc, rankPan.smax);
                    selectedRank = rankPan.sel;
                    sfx('sel_opt', 0.4);
                }
            };
            if (ai === 0) rankPan.prev_ar = ar; else rankPan.next_ar = ar;
        })(ai);
    }
    
    // --- WEAPON PANEL ---
    var wepPan = mke(0, bx - wpw / 2, MCH);
    wepPan.dp = DP_TOP;
    wepPan.pw = wpw;
    wepPan.ph = wph;
    wepPan.sel = selectedWeapon;
    wepPan.smax = WEAPONS.length - 1;
    wepPan.selected = false;
    wepPan.ady = 8;
    
    wepPan.dr = function(e, px, py) {
        var i = e.sel;
        var data = WEAPONS[i];
        if (!data) return;
        
        // Panel background
        rectfill(px, py, px + wpw - 1, py + wph - 1, 1);
        if (e.selected) {
            rect(px - 1, py - 1, px + wpw, py + wph, 5);
        }
        
        // Title - weapon name
        smallPrint(data.name, px + wpw / 2, py + 3, 3, 1);
        
        // Weapon sprite with border
        var sprX = px + 20;  // 16 + 4
        var sprY = py + tma + 4;  // 12 + 4 = 16
        spritesheet('weapons');
        // Draw border (rect around sprite area)
        rect(sprX - 1, sprY - 1, sprX + 96, sprY + 24, 4);
        // Draw weapon sprite
        sspr(0, i * 24, 96, 24, sprX, sprY);
        spritesheet('gfx');
        
        // AMMO display
        var ammoX = px + wpw - 16 - (data.chamber_max + data.ammo_max + 1) * 4 - 4;
        var ammoY = py + 28 + 8;  // = py + 36
        
        // Chamber bullets
        for (var ci = 0; ci < data.chamber_max; ci++) {
            sspr(4, 56, 3, 7, ammoX, ammoY);
            ammoX += 4;
        }
        // Separator
        sspr(83, 48, 3, 6, ammoX, ammoY + 1);
        ammoX += 4;
        // Ammo bullets
        for (var ai2 = 0; ai2 < data.ammo_max; ai2++) {
            sspr(4, 56, 3, 7, ammoX, ammoY);
            ammoX += 4;
        }
        
        // STATS
        var statIds = ['firepower', 'firerange', 'spread', 'knockback', 'blade', 'pierce', 'search', 'all_freereload'];
        var sx = px + 10;
        var sy = py + 48;
        var col = 0;
        
        for (var si = 0; si < statIds.length; si++) {
            var id = statIds[si];
            var val = data[id];
            if (val === undefined || val === null) continue;
            
            var lbl;
            if (id === 'all_freereload') {
                lbl = lang.effect_freereload || 'Free Reload';
            } else {
                lbl = (lang[id] || id) + ':';
            }
            
            var stx = sx + (col % 2) * 62;
            var sty = sy + Math.floor(col / 2) * 7;
            
            smallPrint(lbl, stx, sty, 3);

            var valStr = String(val);
            if (id === 'spread') valStr += lang.degree_symbol || '\u00b0';
            if (id === 'knockback') valStr += '%';
            if (id === 'pierce') valStr += '%';
            if (id === 'all_freereload') valStr = '';

            var lblW = txtwidthSmall(lbl, 8);
            smallPrint(valStr, stx + lblW + 3, sty, 4);
            col++;
        }
    };
    elements.push(wepPan);
    menuList.push(wepPan);
    
    // Weapon arrows
    for (var wi = 0; wi < 2; wi++) {
        (function(wi) {
            var ar = mke(0, 3 + (wpw - 14) * wi, 14);
            ar.dp = DP_TOP;
            add_child(wepPan, ar);
            ar.vis = true;
            ar.dr = function(e, x, y) {
                ar.vis = true;
                if ((wi === 0 && wepPan.sel === 0) || (wi === 1 && wepPan.sel >= wepPan.smax)) {
                    ar.vis = false;
                    return;
                }
                var cl = wepPan.selected ? 4 : 5;
                spritesheet('gfx');
                if (wi === 0) {
                    sspr(192, 160, 8, 24, x, y, 8, 24, false);
                } else {
                    sspr(192, 160, 8, 24, x, y, 8, 24, true);
                }
            };
            ar.upd = function() {
                if (!ar.vis) return;
                var wx = wepPan.x + ar.x;
                var wy = wepPan.y + ar.y;
                if (Input.mouse.x >= wx && Input.mouse.x < wx + 8 &&
                    Input.mouse.y >= wy && Input.mouse.y < wy + 24 &&
                    Input.mouse.pressed) {
                    var inc = wi * 2 - 1;
                    wepPan.sel = mid(0, wepPan.sel + inc, wepPan.smax);
                    selectedWeapon = wepPan.sel;
                    sfx('sel_opt', 0.4);
                }
            };
            if (wi === 0) wepPan.prev_ar = ar; else wepPan.next_ar = ar;
        })(wi);
    }
    
    // --- START BUTTON ---
    var startBut = mkSquareBut(lang.start || 'START', function() {
        sfx('menu_in', 0.7);
        ThroneMode.weaponsIndex = selectedWeapon;
        ThroneMode.ranksIndex = selectedRank;
        // Save preferences
        if (!Save.data.prog.throne) Save.data.prog.throne = {};
        Save.data.prog.throne.weapon_sel = selectedWeapon;
        Save.data.prog.throne.rank_sel = selectedRank;
        Save.save();
        
        // Slide panels out
        var wt = 0;
        for (var ei = 0; ei < elements.length; ei++) {
            (function(e) {
                wait(wt, function() {
                    mv(e, 0, -MCH, 16);
                    e.twcv = ease_in;
                    wait(16, function() { kl(e); });
                });
            })(elements[ei]);
            wt += 6;
        }
        
        wait(wt + 8, function() {
            fadeTo(-4, 30, function() {
                closeMenu();
                menuState = 'game';
                setMode('throne');
                mode.start();
            });
        });
    });
    startBut.x = bx - 32;
    startBut.y = MCH;
    startBut.dp = DP_TOP;
    elements.push(startBut);
    menuList.push(startBut);
    
    // --- BACK BUTTON ---
    var backBut = mkSquareBut(lang.back || 'BACK', function() {
        sfx('menu_out', 0.7);
        closeMenu();
        menuState = 'title';
        initMenu();
    });
    backBut.x = bx - 32;
    backBut.y = MCH;
    backBut.dp = DP_TOP;
    elements.push(backBut);
    menuList.push(backBut);
    
    // --- KEYBOARD INPUT HANDLER ---
    var input = mke(0, 0, 0);
    input.dp = DP_TOP;
    input.upd = function() {
        // Weapon navigation
        if (btnp('left')) {
            if (selectedWeapon > 0) {
                selectedWeapon--;
                wepPan.sel = selectedWeapon;
                sfx('sel_opt', 0.4);
            }
        }
        if (btnp('right')) {
            if (selectedWeapon < WEAPONS.length - 1) {
                selectedWeapon++;
                wepPan.sel = selectedWeapon;
                sfx('sel_opt', 0.4);
            }
        }
        // Rank navigation (up/down)
        if (btnp('up')) {
            if (selectedRank > 0) {
                selectedRank--;
                rankPan.sel = selectedRank;
                sfx('sel_opt', 0.4);
            }
        }
        if (btnp('down')) {
            if (selectedRank < maxRank && selectedRank < RANKS.length - 1) {
                selectedRank++;
                rankPan.sel = selectedRank;
                sfx('sel_opt', 0.4);
            }
        }
        // Start
        if (btnp('validate')) {
            startBut.clicked = true;
            startBut.action();
        }
        // Back
        if (btnp('cancel')) {
            backBut.clicked = true;
            backBut.action();
        }
    };
    menuList.push(input);
    
    // --- SLIDE IN ANIMATION ---
    var cy = startY;
    var wt = 0;
    for (var ei = 0; ei < elements.length; ei++) {
        var e = elements[ei];
        e.y = cy + MCH;  // Start below screen
        (function(ent, ty) {
            wait(wt, function() {
                mvt(ent, ent.x, ty, 16);
                ent.twcv = ease_out;
            });
        })(e, cy);
        wt += 6;
        cy += e.ph + ec;
    }
    
    mdr = drawMenu;
}

// Square button factory (matches Android mk_square_but)
function mkSquareBut(name, action, pw) {
    var e = mke();
    e.pw = pw || 64;
    e.ph = BUTTON_HEIGHT;
    e.name = name;
    e.ov = false;
    e.clicked = false;
    e.action = action;
    
    e.upd = function() {
        var ins = Input.mouse.x >= e.x && Input.mouse.x < e.x + e.pw &&
                  Input.mouse.y >= e.y && Input.mouse.y < e.y + e.ph;
        if (ins && !e.ov) {
            e.ov = true;
            sfx('sel_opt', 0.4);
        }
        if (!ins && e.ov) {
            e.ov = false;
            e.clicked = false;
        }
        if (ins && Input.mouse.pressed) {
            e.clicked = true;
            e.action();
        }
    };
    
    e.dr = function(e, x, y) {
        var labelc = 4;
        spritesheet('title');
        if (e.clicked) {
            sspr(320, 180, 2, 12, x, y, 2, BUTTON_HEIGHT);
            sspr(322, 180, 1, 12, x + 2, y, e.pw - 4, BUTTON_HEIGHT);
            sspr(382, 180, 2, 12, x + e.pw - 2, y, 2, BUTTON_HEIGHT);
            labelc = 1;
        } else if (e.ov) {
            sspr(320, 192, 2, 12, x, y, 2, BUTTON_HEIGHT);
            sspr(322, 192, 1, 12, x + 2, y, e.pw - 4, BUTTON_HEIGHT);
            sspr(382, 192, 2, 12, x + e.pw - 2, y, 2, BUTTON_HEIGHT);
            labelc = 1;
        } else {
            sspr(320, 204, 2, 12, x, y, 2, BUTTON_HEIGHT);
            sspr(322, 204, 1, 12, x + 2, y, e.pw - 4, BUTTON_HEIGHT);
            sspr(382, 204, 2, 12, x + e.pw - 2, y, 2, BUTTON_HEIGHT);
            labelc = 4;
        }
        spritesheet('gfx');

        // Clip text to button bounds
        clip(x, y, e.pw, BUTTON_HEIGHT);

        // Button text - centered (use small 4px font like PICO-8)
        var txty = y + (BUTTON_HEIGHT * 0.5) - 2;
        smallPrint(e.name, x + e.pw / 2, txty, labelc, 1);

        clip();
    };
    
    return e;
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
    reset();
    menuList = [];
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
    for (var di = 0; di < 16; di++) layers.push([]);
    
    for (var ei = 0; ei < Entity.entities.length; ei++) {
        var ent = Entity.entities[ei];
        if (ent.dead) continue;
        var dp = Math.max(0, Math.min(15, ent.dp || 0));
        layers[dp].push(ent);
    }
    
    for (var li = 0; li < layers.length; li++) {
        var layer = layers[li];
        for (var ej = 0; ej < layer.length; ej++) {
            dre(layer[ej]);
        }
    }
    
    camera();
    Sugar.updateFade();
    Sugar.drawFade();
}// === PAUSE ===
function pauseGame() {
    if (!ingame || !playing) return;
    pause = true;
    timerun = false;
    sfx('pause');
    
    var bg = mke(0, 0, 0);
    bg.dp = DP_TOP;
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
