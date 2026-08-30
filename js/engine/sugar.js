// Sugar Engine API - PICO-8-like rendering for HTML5 Canvas
// Internal resolution: 320x180, palette-based 16-color system

const Sugar = {
    canvas: null,
    ctx: null,
    width: 320,
    height: 180,
    scale: 4,
    
    // 16-color palette (default PICO-8-like)
    colors: [
        '#000000', // 0 - black
        '#1d2b53', // 1 - dark blue
        '#7e2553', // 2 - dark purple
        '#008751', // 3 - dark green
        '#ab5236', // 4 - brown
        '#5f574f', // 5 - dark gray
        '#c2c3c7', // 6 - light gray
        '#fff1e8', // 7 - white
        '#ff004d', // 8 - red
        '#ffa300', // 9 - orange
        '#ffec27', // 10 - yellow
        '#00e436', // 11 - green
        '#29adff', // 12 - blue
        '#83769c', // 13 - lavender
        '#ff77a8', // 14 - pink
        '#ffccaa', // 15 - peach
    ],
    
    // Palette remapping
    palMap: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
    palIncVal: 0,
    transparentColor: null, // which color index is transparent
    paltMap: {}, // transparency map
    
    // Current drawing color
    _color: 7,
    
    // Camera
    camX: 0,
    camY: 0,
    
    // Clip
    clipStack: [],
    
    // Surfaces (offscreen canvases)
    surfaces: {},
    currentTarget: null, // null = main screen
    
    // Spritesheets
    spritesheets: {},
    currentSheet: 'gfx',
    sprW: 16,
    sprH: 16,
    
    // Font
    fonts: {},
    currentFont: 'pico',
    fontSize: 8,
    fontLineHeight: 8,
    fontDy: 0,
    
    // Time
    time: 0,
    frameCount: 0,
    
    // Input state
    mouse: { x: 0, y: 0, px: 0, py: 0, down: false, pressed: false, released: false, rightDown: false, rightPressed: false },
    keys: {},
    keysPressed: {},
    touchPoints: [],
    
    // Screen fill pattern
    fillPattern: null,
    fillPatternTrans: false,
    
    init() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.resize();
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 100));
        
        this.ctx.imageSmoothingEnabled = false;
    },
    
    resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        
        // Fit canvas to screen maintaining 16:9 aspect ratio
        const targetRatio = this.width / this.height;
        const screenRatio = w / h;
        
        let cw, ch;
        if (screenRatio > targetRatio) {
            // Screen is wider - fit to height, center horizontally
            ch = h;
            cw = ch * targetRatio;
        } else {
            // Screen is taller - fit to width, center vertically
            cw = w;
            ch = cw / targetRatio;
        }
        
        this.canvas.style.width = cw + 'px';
        this.canvas.style.height = ch + 'px';
        this.scale = cw / this.width;
        
        // Update canvas rect for input
        this.canvasRect = this.canvas.getBoundingClientRect();
        
        // Check landscape
        this.checkOrientation();
    },
    
    checkOrientation() {
        const isPortrait = window.innerHeight > window.innerWidth;
        const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
        const prompt = document.getElementById('rotate-prompt');
        if (isMobile && isPortrait) {
            prompt.classList.add('show');
        } else {
            prompt.classList.remove('show');
        }
    },
    
    // === COLOR / PALETTE ===
    color(c) {
        this._color = c;
    },
    
    getColor(c) {
        c = c !== undefined ? c : this._color;
        const mapped = this.palMap[c] !== undefined ? this.palMap[c] : c;
        return this.colors[mapped] || this.colors[0];
    },
    
    pal(c1, c2) {
        if (c1 === undefined && c2 === undefined) {
            this.palMap = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15];
            this.palIncVal = 0;
            return;
        }
        if (c2 !== undefined) {
            this.palMap[c1] = c2;
        }
    },
    
    palRst() {
        this.palMap = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15];
        this.palIncVal = 0;
    },
    
    palInc(n) {
        this.palIncVal = n || 0;
    },
    
    palt(c, t) {
        if (t) {
            this.paltMap[c] = true;
        } else {
            delete this.paltMap[c];
        }
    },
    
    paltRst() {
        this.paltMap = {};
    },
    
    palette(path) {
        // Load palette from spritesheet (not needed for web)
    },
    
    // === DRAWING PRIMITIVES ===
    pset(x, y, c) {
        if (c === undefined) c = this._color;
        const ctx = this.getTargetCtx();
        ctx.fillStyle = this.getColor(c);
        ctx.fillRect(Math.floor(x + this.camX), Math.floor(y + this.camY), 1, 1);
    },
    
    rect(x1, y1, x2, y2, c) {
        if (c === undefined) c = this._color;
        const ctx = this.getTargetCtx();
        ctx.strokeStyle = this.getColor(c);
        ctx.lineWidth = 1;
        ctx.strokeRect(
            Math.floor(x1 + this.camX) + 0.5,
            Math.floor(y1 + this.camY) + 0.5,
            Math.floor(x2 - x1),
            Math.floor(y2 - y1)
        );
    },
    
    rectfill(x1, y1, x2, y2, c) {
        if (c === undefined) c = this._color;
        if (this.palIncVal < 0) {
            // Darken
            c = Math.max(0, c + this.palIncVal);
        }
        const ctx = this.getTargetCtx();
        ctx.fillStyle = this.getColor(c);
        ctx.fillRect(
            Math.floor(x1 + this.camX),
            Math.floor(y1 + this.camY),
            Math.ceil(x2 - x1 + 1),
            Math.ceil(y2 - y1 + 1)
        );
    },
    
    line(x1, y1, x2, y2, c) {
        if (c === undefined) c = this._color;
        const ctx = this.getTargetCtx();
        ctx.strokeStyle = this.getColor(c);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.floor(x1 + this.camX) + 0.5, Math.floor(y1 + this.camY) + 0.5);
        ctx.lineTo(Math.floor(x2 + this.camX) + 0.5, Math.floor(y2 + this.camY) + 0.5);
        ctx.stroke();
    },
    
    circ(cx, cy, r, c) {
        if (c === undefined) c = this._color;
        const ctx = this.getTargetCtx();
        ctx.strokeStyle = this.getColor(c);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(Math.floor(cx + this.camX), Math.floor(cy + this.camY), Math.max(0, r), 0, Math.PI * 2);
        ctx.stroke();
    },
    
    circfill(cx, cy, r, c) {
        if (c === undefined) c = this._color;
        const ctx = this.getTargetCtx();
        ctx.fillStyle = this.getColor(c);
        ctx.beginPath();
        ctx.arc(Math.floor(cx + this.camX), Math.floor(cy + this.camY), Math.max(0.5, r), 0, Math.PI * 2);
        ctx.fill();
    },
    
    trifill(x1, y1, x2, y2, x3, y3, c) {
        if (c === undefined) c = this._color;
        const ctx = this.getTargetCtx();
        ctx.fillStyle = this.getColor(c);
        ctx.beginPath();
        ctx.moveTo(Math.floor(x1 + this.camX), Math.floor(y1 + this.camY));
        ctx.lineTo(Math.floor(x2 + this.camX), Math.floor(y2 + this.camY));
        ctx.lineTo(Math.floor(x3 + this.camX), Math.floor(y3 + this.camY));
        ctx.closePath();
        ctx.fill();
    },
    
    cls(c) {
        if (c === undefined) c = 0;
        const ctx = this.getTargetCtx();
        if (this.currentTarget === null) {
            ctx.fillStyle = this.getColor(c);
            ctx.fillRect(0, 0, this.width, this.height);
        } else {
            ctx.fillStyle = this.getColor(c);
            ctx.fillRect(0, 0, this.currentSurfaceW, this.currentSurfaceH);
        }
    },
    
    // === CAMERA ===
    camera(x, y) {
        if (x === undefined && y === undefined) {
            this.camX = 0;
            this.camY = 0;
        } else {
            this.camX = x || 0;
            this.camY = y || 0;
        }
    },
    
    // === CLIP ===
    clip(x, y, w, h) {
        const ctx = this.getTargetCtx();
        if (x === undefined) {
            if (this.currentTarget === null) {
                ctx.restore();
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, 0, this.width, this.height);
                ctx.clip();
            }
            return;
        }
        ctx.save();
        ctx.beginPath();
        ctx.rect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
        ctx.clip();
    },
    
    // === SURFACES ===
    getTargetCtx() {
        if (this.currentTarget === null) {
            return this.ctx;
        }
        return this.surfaces[this.currentTarget].getContext('2d');
    },
    
    newsrf(w, h, name) {
        if (typeof w === 'string') {
            // Load from image path
            name = h || w;
            const img = this.spritesheets[w];
            if (!img) return null;
            const srf = document.createElement('canvas');
            srf.width = img.width;
            srf.height = img.height;
            srf.getContext('2d').drawImage(img, 0, 0);
            this.surfaces[name] = srf;
            return srf;
        }
        if (typeof w === 'number') {
            const srf = document.createElement('canvas');
            srf.width = w;
            srf.height = h;
            const sctx = srf.getContext('2d');
            sctx.imageSmoothingEnabled = false;
            this.surfaces[name] = srf;
            this.currentSurfaceW = w;
            this.currentSurfaceH = h;
            return srf;
        }
        return null;
    },
    
    target(name) {
        if (name === undefined || name === null) {
            this.currentTarget = null;
        } else {
            this.currentTarget = name;
            const srf = this.surfaces[name];
            if (srf) {
                this.currentSurfaceW = srf.width;
                this.currentSurfaceH = srf.height;
            }
        }
    },
    
    srfshot(name, x, y, w, h, scale) {
        // Screenshot of a surface region
        const srf = this.surfaces[name];
        if (!srf) return null;
        const tmp = document.createElement('canvas');
        tmp.width = w || srf.width;
        tmp.height = h || srf.height;
        const tctx = tmp.getContext('2d');
        tctx.imageSmoothingEnabled = false;
        tctx.drawImage(srf, x || 0, y || 0, w || srf.width, h || srf.height, 0, 0, tmp.width, tmp.height);
        return tmp;
    },
    
    // === SPRITESHEETS ===
    loadSpritesheet(name, src, callback) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                this.spritesheets[name] = img;
                // Also create a surface
                const srf = document.createElement('canvas');
                srf.width = img.width;
                srf.height = img.height;
                srf.getContext('2d').drawImage(img, 0, 0);
                this.surfaces[name] = srf;
                if (callback) callback(img);
                resolve(img);
            };
            img.onerror = () => {
                console.error('Failed to load spritesheet:', src);
                resolve(null);
            };
            img.src = src;
        });
    },
    
    spritesheet(name) {
        this.currentSheet = name;
    },
    
    sprgrid(w, h) {
        this.sprW = w;
        this.sprH = h;
    },
    
    // Get sprite coordinates from index
    getSprPos(index) {
        const srf = this.surfaces[this.currentSheet];
        if (!srf) return { x: 0, y: 0 };
        const cols = Math.floor(srf.width / this.sprW);
        const sx = (index % cols) * this.sprW;
        const sy = Math.floor(index / cols) * this.sprH;
        return { x: sx, y: sy };
    },
    
    // Draw sprite by index
    spr(index, x, y, w, h, flipX, flipY) {
        w = w || 1;
        h = h || 1;
        const pos = this.getSprPos(index);
        this.sspr(pos.x, pos.y, this.sprW * w, this.sprH * h, x, y, this.sprW * w, this.sprH * h, flipX, flipY);
    },
    
    // Draw sprite with rotation
    aspr(index, x, y, angle, sw, sh, w, h, cx, cy) {
        sw = sw || 1;
        sh = sh || 1;
        w = w || this.sprW * sw;
        h = h || this.sprH * sh;
        cx = cx || w / 2;
        cy = cy || h / 2;
        const pos = this.getSprPos(index);
        
        const ctx = this.getTargetCtx();
        ctx.save();
        ctx.translate(Math.floor(x + this.camX), Math.floor(y + this.camY));
        ctx.rotate(angle);
        
        const srf = this.surfaces[this.currentSheet];
        if (srf) {
            // Apply palette by drawing then compositing
            ctx.drawImage(srf, pos.x, pos.y, this.sprW * sw, this.sprH * sh, -cx, -cy, w, h);
        }
        ctx.restore();
    },
    
    // Draw sub-sprite (sspr)
    sspr(sx, sy, sw, sh, dx, dy, dw, dh, flipX, flipY) {
        dw = dw || sw;
        dh = dh || sh;
        const srf = this.surfaces[this.currentSheet];
        if (!srf) return;
        
        const ctx = this.getTargetCtx();
        ctx.save();
        
        const tx = Math.floor(dx + this.camX);
        const ty = Math.floor(dy + this.camY);
        
        if (flipX) {
            ctx.scale(-1, 1);
            ctx.translate(-tx - dw, ty);
        } else {
            ctx.translate(tx, ty);
        }
        if (flipY) {
            ctx.scale(1, -1);
            if (!flipX) ctx.translate(0, -dh);
            else ctx.translate(0, -dh);
        }
        
        ctx.drawImage(srf, sx, sy, sw, sh, 0, 0, dw, dh);
        ctx.restore();
    },
    
    // Shaded sprite (with palette swap)
    shpr(sx, sy, sw, sh, dx, dy, palShift) {
        // Simple implementation: just draw normally
        this.sspr(sx, sy, sw, sh, dx, dy);
    },
    
    // === FILL PATTERN ===
    fillp(pattern, transparent) {
        this.fillPattern = pattern;
        this.fillPatternTrans = transparent;
    },
    
    // === TEXT ===
    
    // Hardcoded PICO-8 font masks - DISABLED (masks were incorrect)
    // When pico_font.png fails to load, fall through to canvas monospace rendering
    PICO_FONT_MASKS: {},
    
    // Get font mask for a character (with hardcoded fallback)
    getFontMask(ch) {
        var f = this.fonts[this.currentFont];
        if (f && f.masks && f.masks[ch]) {
            return f.masks[ch];
        }
        // Fallback to hardcoded masks (convert string to boolean array)
        if (this.PICO_FONT_MASKS && this.PICO_FONT_MASKS[ch]) {
            var s = this.PICO_FONT_MASKS[ch];
            var arr = [];
            for (var i = 0; i < s.length; i++) {
                arr.push(s[i] === '1');
            }
            return arr;
        }
        return null;
    },
    
    addfont(name, overlay, src, charset) {
        if (typeof src === 'string' && src.endsWith('.png')) {
            // Bitmap font from image - extract pixel masks
            return this.loadSpritesheet(name + '_font', src).then(img => {
                if (img) {
                    var charW = 4, charH = 5;
                    var masks = {};
                    try {
                        var tc = document.createElement('canvas');
                        tc.width = img.width; tc.height = img.height;
                        var tctx = tc.getContext('2d');
                        tctx.drawImage(img, 0, 0);
                        var imgData = tctx.getImageData(0, 0, img.width, img.height);
                        var data = imgData.data;
                        var numChars = Math.floor(img.width / charW);
                        var cs = charset || '!"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';
                        for (var ci = 0; ci < numChars && ci < cs.length; ci++) {
                            var ch = cs[ci];
                            var mask = [];
                            for (var py = 0; py < charH; py++) {
                                for (var px = 0; px < charW; px++) {
                                    var sx = ci * charW + px;
                                    var pi = (py * img.width + sx) * 4;
                                    mask.push(data[pi] > 40 || data[pi+1] > 40 || data[pi+2] > 40);
                                }
                            }
                            masks[ch] = mask;
                        }
                    } catch(e) { console.warn('Font mask extraction failed:', e); }
                    this.fonts[name] = { type: 'bitmap', masks: masks, charW: charW, charH: charH, charset: charset, dy: 0, h: 7, overlay: overlay };
                }
            });
        } else if (typeof src === 'string' && src.endsWith('.ttf')) {
            // TrueType font
            this.fonts[name] = { type: 'ttf', src: src, dy: 0, h: 12, sz: 12, overlay: overlay };
            return Promise.resolve();
        }
        return Promise.resolve();
    },
    
    loadAllFonts() {
        const fontList = [
            { name: 'Galmuri11', src: 'assets/fonts/Galmuri11.ttf', sz: 12, dy: 9, h: 16 },
            { name: 'LanaPixel', src: 'assets/fonts/LanaPixel.ttf', sz: 11, dy: 8, h: 14 },
            { name: 'indienovaBC', src: 'assets/fonts/indienovaBC.ttf', sz: 12, dy: 9, h: 16 },
            { name: 'Terminus', src: 'assets/fonts/Terminus.ttf', sz: 12, dy: 8, h: 14 },
            { name: 'Determination', src: 'assets/fonts/Determination.ttf', sz: 13, dy: 9, h: 14 },
            { name: 'galvanic', src: 'assets/fonts/galvanic.ttf', sz: 8, dy: 8, h: 12 },
            { name: 'pico', src: 'assets/fonts/pico.ttf', sz: 8, dy: 0, h: 8 },
        ];
        
        // Register all font metadata immediately
        for (const f of fontList) {
            this.fonts[f.name] = { type: 'ttf', name: f.name, sz: f.sz, dy: f.dy, h: f.h, overlay: false, loaded: false };
        }
        
        // Use FontFace API for explicit loading (more reliable for Canvas than CSS @font-face)
        const promises = [];
        for (const f of fontList) {
            const face = new FontFace(f.name, `url(${f.src})`);
            const p = face.load().then(loadedFace => {
                // Add to document fonts so Canvas can use it
                document.fonts.add(loadedFace);
                this.fonts[f.name].loaded = true;
                console.log('Font loaded:', f.name);
            }).catch(e => {
                console.warn('FontFace load failed for', f.name, e);
                // CSS @font-face in index.html is a fallback
            });
            // Race with timeout - don't block game for slow fonts
            promises.push(Promise.race([p, new Promise(r => setTimeout(r, 8000))]));
        }
        
        // Wait for all font loading attempts to complete (or timeout)
        return Promise.all(promises);
    },
    
    // Check if current font is loaded and ready for Canvas rendering
    isFontReady() {
        const f = this.fonts[this.currentFont];
        if (!f) return false;
        if (f.type !== 'ttf') return true;
        const fontStr = `${f.sz || 8}px "${f.name || this.currentFont}"`;
        try {
            return document.fonts.check(fontStr);
        } catch(e) {
            return f.loaded || false;
        }
    },
    
    font(name) {
        if (name === undefined) return this.currentFont;
        this.currentFont = name;
        const f = this.fonts[name];
        if (f) {
            this.fontSize = f.sz || 8;
            this.fontLineHeight = f.h || 8;
            this.fontDy = f.dy || 0;
        }
        return name;
    },
    
    // Build canvas font string - always use the custom font name
    // The browser automatically falls back to a system font with CJK support
    // when the custom font isn't loaded yet. Using "monospace" as fallback
    // breaks CJK text on many systems because monospace lacks CJK glyphs.
    _getCanvasFont() {
        const f = this.fonts[this.currentFont];
        if (!f) return '8px monospace';
        const fontName = f.name || this.currentFont;
        const fontSize = f.sz || 8;
        // No explicit fallback - browser handles CJK fallback automatically
        return `${fontSize}px "${fontName}"`;
    },
    
    // Text width
    txtwidth(str) {
        if (str === undefined || str === null) return 0;
        str = String(str);
        const f = this.fonts[this.currentFont];
        if (!f) return str.length * 4;
        if (f.type === 'bitmap') {
            return str.length * (f.charW || 4);
        }
        // TTF font - use canvas to measure with the same font string as lprint
        const ctx = this.getTargetCtx();
        ctx.font = this._getCanvasFont();
        ctx.textAlign = 'left';
        return Math.ceil(ctx.measureText(str).width);
    },
    
    // Print single line - always uses canvas fillText
    // Browser handles font fallback automatically (including CJK glyphs)
    lprint(str, x, y, c, align, outline) {
        if (c === undefined) c = this._color;
        if (str === undefined || str === null) return x;
        str = String(str);
        const ctx = this.getTargetCtx();
        const f = this.fonts[this.currentFont];
        const dy = (f && f.dy) || 0;
        
        let rx = x;
        if (align === 1) { // center
            rx = x - this.txtwidth(str) / 2;
        } else if (align === 2) { // right
            rx = x - this.txtwidth(str);
        }
        
        rx = Math.floor(rx);
        const ty = Math.floor(y + this.camY);
        const tx = Math.floor(rx + this.camX);
        
        ctx.font = this._getCanvasFont();
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        
        if (outline !== undefined && outline !== null) {
            ctx.fillStyle = this.getColor(outline);
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy2 = -1; dy2 <= 1; dy2++) {
                    if (dx === 0 && dy2 === 0) continue;
                    ctx.fillText(str, tx + dx, ty + dy2 + dy);
                }
            }
        }
        
        ctx.fillStyle = this.getColor(c);
        ctx.fillText(str, tx, ty + dy);
        
        return rx;
    },
    
    // Print paragraph (word wrap)
    pprint(str, x, y, w, c, align, lim, outline) {
        if (c === undefined) c = this._color;
        if (align === undefined) align = 0;
        
        str = String(str);
        const words = str.split(' ');
        let cx = x;
        let cy = y;
        const lh = this.fontLineHeight || 8;
        let lineCount = 0;
        let lineStr = '';
        
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const testStr = lineStr ? lineStr + ' ' + word : word;
            const tw = this.txtwidth(testStr);
            
            if (tw > w && lineStr) {
                this.lprint(lineStr, x, cy, c, align, outline);
                cy += lh;
                lineStr = word;
                lineCount++;
                if (lim && lineCount >= lim) break;
            } else {
                lineStr = testStr;
            }
        }
        if (lineStr && (!lim || lineCount < lim)) {
            this.lprint(lineStr, x, cy, c, align, outline);
        }
        return cy + lh;
    },
    
    // Bitmap font drawing (pico font - 4px wide chars, pixel mask based)
    drawBitmapText(str, x, y, c, outline) {
        var f = this.fonts[this.currentFont];
        var ctx = this.getTargetCtx();
        var charW = (f && f.charW) || 4;
        var charH = (f && f.charH) || 5;
        var mainColor = this.getColor(c);
        var outlineColor = (outline !== undefined && outline !== null) ? this.getColor(outline) : null;
        
        for (var i = 0; i < str.length; i++) {
            var ch = str[i];
            var mask = this.getFontMask(ch);
            if (!mask) continue;
            var cx = x + i * charW;
            
            // Draw outline first (8 directions)
            if (outlineColor) {
                ctx.fillStyle = outlineColor;
                for (var dx = -1; dx <= 1; dx++) {
                    for (var dy = -1; dy <= 1; dy++) {
                        if (dx === 0 && dy === 0) continue;
                        for (var py = 0; py < charH; py++) {
                            for (var px = 0; px < charW; px++) {
                                if (mask[py * charW + px]) {
                                    ctx.fillRect(cx + px + dx, y + py + dy, 1, 1);
                                }
                            }
                        }
                    }
                }
            }
            
            // Draw main character
            ctx.fillStyle = mainColor;
            for (var py = 0; py < charH; py++) {
                for (var px = 0; px < charW; px++) {
                    if (mask[py * charW + px]) {
                        ctx.fillRect(cx + px, y + py, 1, 1);
                    }
                }
            }
        }
    },
    
    // bprint - print with background
    bprint(str, x, y, c, align) {
        this.lprint(str, x, y, c, align);
    },

    // print - simple print
    print(str, x, y, c, align) {
        if (x === undefined) { x = 0; y = 0; c = 7; }
        this.lprint(str, x, y, c, align);
    },

    // smallPrint - render text at 4px height (like PICO-8 bitmap font)
    // Used for button labels and UI elements that need compact text
    smallPrint(str, x, y, c, align) {
        if (c === undefined) c = 7;
        str = String(str);
        const ctx = this.getTargetCtx();

        let rx = x;
        if (align === 1) { // center
            rx = x - this.txtwidth4px(str) / 2;
        } else if (align === 2) { // right
            rx = x - this.txtwidth4px(str);
        }

        rx = Math.floor(rx);
        const ty = Math.floor(y + this.camY);
        const tx = Math.floor(rx + this.camX);

        // Use 4px font size
        const savedFont = ctx.font;
        ctx.font = '4px monospace';
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.fillStyle = this.getColor(c);
        ctx.fillText(str, tx, ty);
        ctx.font = savedFont;

        return rx;
    },

    // Measure text width at 4px size
    txtwidth4px(str) {
        const ctx = this.getTargetCtx();
        const savedFont = ctx.font;
        ctx.font = '4px monospace';
        const w = ctx.measureText(str).width;
        ctx.font = savedFont;
        return w;
    },
    
    // === MATH UTILITIES ===
    flr(x) { return Math.floor(x); },
    ceil(x) { return Math.ceil(x); },
    abs(x) { return Math.abs(x); },
    max(...a) { return Math.max(...a); },
    min(...a) { return Math.min(...a); },
    mid(a, b, c) { return Math.max(Math.min(b, c), Math.min(Math.max(b, c), a)); },
    cos(x) { return Math.cos(x * Math.PI * 2); },
    sin(x) { return -Math.sin(x * Math.PI * 2); }, // PICO-8 sin is inverted
    atan2(y, x) { return Math.atan2(y, x) / (Math.PI * 2); },
    sqrt(x) { return Math.sqrt(Math.max(0, x)); },
    pow(a, b) { return Math.pow(a, b); },
    rnd(n) { if (n === undefined) n = 1; return Math.random() * n; },
    irnd(n) { return Math.floor(Math.random() * (n || 1)); },
    sgn(x) { return x < 0 ? -1 : (x > 0 ? 1 : 0); },
    sub(str, a, b) { if (b === undefined) b = str.length; return str.substring(a - 1, b); },
    sbs(str, find, replace) { return str.split(find).join(replace); },
    
    // === UTILITY ===
    add(tbl, v) { if (tbl) { tbl.push(v); return v; } return v; },
    del(tbl, v) { if (!tbl) return; const i = tbl.indexOf(v); if (i >= 0) tbl.splice(i, 1); },
    deli(tbl, i) { if (!tbl) return; if (i < 0) i += tbl.length; return tbl.splice(i, 1)[0]; },
    all(tbl) { if (!tbl) return []; return tbl; },
    foreach(tbl, fn) { if (tbl) for (let i = 0; i < tbl.length; i++) fn(tbl[i]); },
    count(tbl) { return tbl ? tbl.length : 0; },
    pairs(tbl) { return Object.entries(tbl || {}); },
    
    // Bitwise helpers
    band(a, b) { return a & b; },
    bor(a, b) { return a | b; },
    bxor(a, b) { return a ^ b; },
    bnot(a) { return ~a; },
    shl(a, b) { return a << b; },
    shr(a, b) { return a >> b; },
    
    // String helpers
    tostr(v) { return String(v); },
    tonum(v) { return parseFloat(v) || 0; },
    uppercase(s) { return s.toUpperCase(); },
    lowercase(s) { return s.toLowerCase(); },
    
    // === ANIMATION ===
    easeOutBack(t) {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    
    easeUturn(t) {
        // sin curve 0->1->0
        return Math.sin(t * Math.PI);
    },
    
    cyc(a, b, t) {
        // triangular wave
        const p = (t * a) % (a + b);
        return p < a ? p / a : (a + b - p) / b;
    },
    
    // === SCREEN EFFECTS ===
    screenShake: 0,
    
    shake(n) {
        this.screenShake = n;
    },
    
    // Flash/fade
    fadeColor: 0,
    fadeTarget: 0,
    fadeSpeed: 0,
    fadeCallback: null,
    
    fadeTo(color, speed, cbk) {
        this.fadeTarget = color;
        this.fadeSpeed = speed || 30;
        this.fadeCallback = cbk || null;
    },
    
    updateFade() {
        if (this.fadeColor !== this.fadeTarget) {
            const diff = this.fadeTarget - this.fadeColor;
            const step = diff > 0 ? Math.min(diff, 1 / this.fadeSpeed) : Math.max(diff, -1 / this.fadeSpeed);
            this.fadeColor += step;
            if (Math.abs(this.fadeColor - this.fadeTarget) < 0.01) {
                this.fadeColor = this.fadeTarget;
                if (this.fadeCallback) {
                    const cb = this.fadeCallback;
                    this.fadeCallback = null;
                    cb();
                }
            }
        }
    },
    
    drawFade() {
        const alpha = Math.min(Math.abs(this.fadeColor), 1);
        if (alpha < 0.01) return;
        
        const ctx = this.ctx;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.getColor(0);
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.restore();
    },
    
    // === MAIN DRAW ===
    present() {
        // Draw fade overlay
        this.drawFade();
    },
    
    // === FPS ===
    fpslimit(n) {
        this.targetFps = n;
    },
    
    // === WINDOW ===
    newwin(title, w, h, scale, mode, scaleMode, shader) {
        // Already set up in init
    },
    
    winspec(prop, val) {
        if (prop === 'title') document.title = val;
        if (prop === 'screen') {
            this.resize();
        }
    },
    
    // Get font face name for CSS
    getFontName() {
        const f = this.fonts[this.currentFont];
        if (f && f.type === 'ttf') return f.name || this.currentFont;
        return null;
    },
};

// Global PICO-8-like function aliases
function color(c) { Sugar.color(c); }
function pal(c1, c2) { Sugar.pal(c1, c2); }
function palRst() { Sugar.palRst(); }
function palInc(n) { Sugar.palInc(n); }
function palt(c, t) { Sugar.palt(c, t); }
function pset(x, y, c) { Sugar.pset(x, y, c); }
function rect(x1, y1, x2, y2, c) { Sugar.rect(x1, y1, x2, y2, c); }
function rectfill(x1, y1, x2, y2, c) { Sugar.rectfill(x1, y1, x2, y2, c); }
function line(x1, y1, x2, y2, c) { Sugar.line(x1, y1, x2, y2, c); }
function circ(cx, cy, r, c) { Sugar.circ(cx, cy, r, c); }
function circfill(cx, cy, r, c) { Sugar.circfill(cx, cy, r, c); }
function trifill(x1, y1, x2, y2, x3, y3, c) { Sugar.trifill(x1, y1, x2, y2, x3, y3, c); }
function cls(c) { Sugar.cls(c); }
function camera(x, y) { Sugar.camera(x, y); }
function clip(x, y, w, h) { Sugar.clip(x, y, w, h); }
function spr(index, x, y, w, h, fx, fy) { Sugar.spr(index, x, y, w, h, fx, fy); }
function sspr(sx, sy, sw, sh, dx, dy, dw, dh, fx, fy) { Sugar.sspr(sx, sy, sw, sh, dx, dy, dw, dh, fx, fy); }
function aspr(index, x, y, angle, sw, sh, w, h, cx, cy) { Sugar.aspr(index, x, y, angle, sw, sh, w, h, cx, cy); }
function shpr(sx, sy, sw, sh, dx, dy, ps) { Sugar.shpr(sx, sy, sw, sh, dx, dy, ps); }
function spritesheet(name) { Sugar.spritesheet(name); }
function sprgrid(w, h) { Sugar.sprgrid(w, h); }
function fillp(pattern, trans) { Sugar.fillp(pattern, trans); }
function lprint(str, x, y, c, align, outline) { return Sugar.lprint(str, x, y, c, align, outline); }
function pprint(str, x, y, w, c, align, lim, outline) { return Sugar.pprint(str, x, y, w, c, align, lim, outline); }
function bprint(str, x, y, c, align) { Sugar.bprint(str, x, y, c, align); }
function print(str, x, y, c, align) { Sugar.print(str, x, y, c, align); }
function smallPrint(str, x, y, c, align) { return Sugar.smallPrint(str, x, y, c, align); }
function txtwidth(str) { return Sugar.txtwidth(str); }
function txtwidth4px(str) { return Sugar.txtwidth4px(str); }
function font(name) { return Sugar.font(name); }

// Math
function flr(x) { return Math.floor(x); }
function ceil(x) { return Math.ceil(x); }
function abs(x) { return Math.abs(x); }
function max(...a) { return Math.max(...a); }
function min(...a) { return Math.min(...a); }
function mid(a, b, c) { return Math.max(Math.min(b, c), Math.min(Math.max(b, c), a)); }
function cos(x) { return Math.cos(x * Math.PI * 2); }
function sin(x) { return -Math.sin(x * Math.PI * 2); }
function atan2(y, x) { return Math.atan2(y, x) / (Math.PI * 2); }
function sqrt(x) { return Math.sqrt(Math.max(0, x)); }
function pow(a, b) { return Math.pow(a, b); }
function rnd(n) { if (n === undefined) n = 1; return Math.random() * n; }
function irnd(n) { return Math.floor(Math.random() * (n || 1)); }
function sgn(x) { return x < 0 ? -1 : (x > 0 ? 1 : 0); }
function sub(str, a, b) { if (b === undefined) b = str.length; return str.substring(a - 1, b); }
function sbs(str, find, replace) { return str.split(find).join(replace); }
function tostr(v) { return String(v); }
function tonum(v) { return parseFloat(v) || 0; }
function uppercase(s) { return s.toUpperCase(); }
function lowercase(s) { return s.toLowerCase(); }

// Table helpers
function add(tbl, v) { if (tbl) { tbl.push(v); return v; } return v; }
function del(tbl, v) { if (!tbl) return; const i = tbl.indexOf(v); if (i >= 0) tbl.splice(i, 1); }
function deli(tbl, i) { if (!tbl) return; if (i < 0) i += tbl.length; return tbl.splice(i, 1)[0]; }
function all(tbl) { return tbl || []; }
function foreach(tbl, fn) { if (tbl) for (let i = 0; i < tbl.length; i++) fn(tbl[i]); }
function count(tbl) { return tbl ? tbl.length : 0; }

// Misc
function shuffle(a) { if (!a) return; for (let i = a.length - 1; i > 0; i--) { const j = irnd(i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; } }
function steal(a) { if (!a || a.length === 0) return undefined; return a.splice(irnd(a.length), 1)[0]; }
function customSort(a, f) { a.sort((x, y) => f(x) - f(y)); }
function minDigits(n, d) { let s = String(Math.floor(n)); while (s.length < d) s = '0' + s; return s; }
function easeOutBack(t) { const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
function easeUturn(t) { return Math.sin(t * Math.PI); }
function cyc(a, b, t) { const p = (t * a) % (a + b); return p < a ? p / a : (a + b - p) / b; }
function hrnd(n) { return Math.floor(rnd(n + 1)); }
