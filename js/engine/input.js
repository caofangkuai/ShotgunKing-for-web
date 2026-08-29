// Input System - handles mouse, keyboard, and touch input

const Input = {
    mouse: { x: 0, y: 0, px: 0, py: 0, down: false, pressed: false, released: false, rightDown: false, rightPressed: false },
    keys: {},
    keysPressed: {},
    touchActive: false,
    
    init() {
        const canvas = Sugar.canvas;
        
        // Mouse events
        canvas.addEventListener('mousedown', (e) => { this.onMouseDown(e); });
        canvas.addEventListener('mouseup', (e) => { this.onMouseUp(e); });
        canvas.addEventListener('mousemove', (e) => { this.onMouseMove(e); });
        canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); });
        
        // Touch events
        canvas.addEventListener('touchstart', (e) => { e.preventDefault(); this.onTouchStart(e); }, { passive: false });
        canvas.addEventListener('touchmove', (e) => { e.preventDefault(); this.onTouchMove(e); }, { passive: false });
        canvas.addEventListener('touchend', (e) => { e.preventDefault(); this.onTouchEnd(e); }, { passive: false });
        
        // Keyboard events
        window.addEventListener('keydown', (e) => { this.onKeyDown(e); });
        window.addEventListener('keyup', (e) => { this.onKeyUp(e); });
        
        // Prevent scrolling
        document.body.addEventListener('touchmove', (e) => { e.preventDefault(); }, { passive: false });
    },
    
    getCanvasPos(e) {
        const rect = Sugar.canvas.getBoundingClientRect();
        const scaleX = Sugar.width / rect.width;
        const scaleY = Sugar.height / rect.height;
        const cx = (e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0)) - rect.left;
        const cy = (e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0)) - rect.top;
        return { x: Math.floor(cx * scaleX), y: Math.floor(cy * scaleY) };
    },
    
    onMouseDown(e) {
        const pos = this.getCanvasPos(e);
        this.mouse.x = pos.x;
        this.mouse.y = pos.y;
        if (e.button === 0) {
            this.mouse.down = true;
            this.mouse.pressed = true;
        } else if (e.button === 2) {
            this.mouse.rightDown = true;
            this.mouse.rightPressed = true;
        }
    },
    
    onMouseUp(e) {
        const pos = this.getCanvasPos(e);
        this.mouse.x = pos.x;
        this.mouse.y = pos.y;
        if (e.button === 0) {
            this.mouse.down = false;
            this.mouse.released = true;
        } else if (e.button === 2) {
            this.mouse.rightDown = false;
        }
    },
    
    onMouseMove(e) {
        const pos = this.getCanvasPos(e);
        this.mouse.x = pos.x;
        this.mouse.y = pos.y;
    },
    
    onTouchStart(e) {
        this.touchActive = true;
        if (e.touches.length > 0) {
            const pos = this.getCanvasPos(e);
            this.mouse.x = pos.x;
            this.mouse.y = pos.y;
            this.mouse.down = true;
            this.mouse.pressed = true;
        }
    },
    
    onTouchMove(e) {
        if (e.touches.length > 0) {
            const pos = this.getCanvasPos(e);
            this.mouse.px = this.mouse.x;
            this.mouse.py = this.mouse.y;
            this.mouse.x = pos.x;
            this.mouse.y = pos.y;
        }
    },
    
    onTouchEnd(e) {
        this.mouse.down = false;
        this.mouse.released = true;
        if (e.touches.length === 0) {
            this.touchActive = false;
        }
    },
    
    onKeyDown(e) {
        const k = e.key.toLowerCase();
        if (!this.keys[k]) {
            this.keysPressed[k] = true;
        }
        this.keys[k] = true;
        
        // Map special keys
        if (e.key === ' ' || e.key === 'Spacebar') {
            if (!this.keys['space']) this.keysPressed['space'] = true;
            this.keys['space'] = true;
        }
        if (e.key === 'Enter') {
            if (!this.keys['enter']) this.keysPressed['enter'] = true;
            this.keys['enter'] = true;
        }
        if (e.key === 'Escape') {
            if (!this.keys['escape']) this.keysPressed['escape'] = true;
            this.keys['escape'] = true;
        }
        
        // Arrow keys
        if (e.key === 'ArrowLeft') { if (!this.keys['left']) this.keysPressed['left'] = true; this.keys['left'] = true; }
        if (e.key === 'ArrowRight') { if (!this.keys['right']) this.keysPressed['right'] = true; this.keys['right'] = true; }
        if (e.key === 'ArrowUp') { if (!this.keys['up']) this.keysPressed['up'] = true; this.keys['up'] = true; }
        if (e.key === 'ArrowDown') { if (!this.keys['down']) this.keysPressed['down'] = true; this.keys['down'] = true; }
        
        // Prevent default for game keys
        if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(e.key.toLowerCase()) || 
            ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Spacebar'].includes(e.key)) {
            e.preventDefault();
        }
    },
    
    onKeyUp(e) {
        const k = e.key.toLowerCase();
        this.keys[k] = false;
        
        if (e.key === ' ' || e.key === 'Spacebar') this.keys['space'] = false;
        if (e.key === 'Enter') this.keys['enter'] = false;
        if (e.key === 'Escape') this.keys['escape'] = false;
        if (e.key === 'ArrowLeft') this.keys['left'] = false;
        if (e.key === 'ArrowRight') this.keys['right'] = false;
        if (e.key === 'ArrowUp') this.keys['up'] = false;
        if (e.key === 'ArrowDown') this.keys['down'] = false;
    },
    
    // Button check (PICO-8 style)
    btn(name) {
        switch(name) {
            case 'left': case 'k:left': return this.keys['left'] || this.keys['a'] || this.keys['arrowleft'];
            case 'right': case 'k:right': return this.keys['right'] || this.keys['d'] || this.keys['arrowright'];
            case 'up': case 'k:up': return this.keys['up'] || this.keys['w'] || this.keys['arrowup'];
            case 'down': case 'k:down': return this.keys['down'] || this.keys['s'] || this.keys['arrowdown'];
            case 'validate': case 'k:enter': case 'k:space': return this.keys['enter'] || this.keys['space'] || this.keys['z'] || this.keys['j'];
            case 'cancel': case 'k:escape': case 'k:x': return this.keys['escape'] || this.keys['x'] || this.keys['k'];
            case 'info': return this.keys['c'] || this.keys['l'] || this.keys['tab'];
            case 'pause': return this.keys['escape'] || this.keys['p'];
            case 'unsafe': return this.keys['shift'] || this.keys['q'];
            case 'reload': return this.keys['r'] || this.keys['space'];
            default: return false;
        }
    },
    
    btnp(name) {
        switch(name) {
            case 'left': case 'k:left': return this.keysPressed['left'] || this.keysPressed['a'] || this.keysPressed['arrowleft'];
            case 'right': case 'k:right': return this.keysPressed['right'] || this.keysPressed['d'] || this.keysPressed['arrowright'];
            case 'up': case 'k:up': return this.keysPressed['up'] || this.keysPressed['w'] || this.keysPressed['arrowup'];
            case 'down': case 'k:down': return this.keysPressed['down'] || this.keysPressed['s'] || this.keysPressed['arrowdown'];
            case 'validate': case 'k:enter': case 'k:space': return this.keysPressed['enter'] || this.keysPressed['space'] || this.keysPressed['z'] || this.keysPressed['j'];
            case 'cancel': case 'k:escape': case 'k:x': return this.keysPressed['escape'] || this.keysPressed['x'] || this.keysPressed['k'];
            case 'info': return this.keysPressed['c'] || this.keysPressed['l'] || this.keysPressed['tab'];
            case 'pause': return this.keysPressed['escape'] || this.keysPressed['p'];
            case 'unsafe': return this.keysPressed['shift'] || this.keysPressed['q'];
            case 'reload': return this.keysPressed['r'] || this.keysPressed['space'];
            default: return false;
        }
    },
    
    btnv(name) {
        // Returns axis value (-1 to 1)
        switch(name) {
            case 'mx': return this.mouse.x;
            case 'my': return this.mouse.y;
            case 'leftStickX': return (this.keys['right'] || this.keys['d'] ? 1 : 0) - (this.keys['left'] || this.keys['a'] ? 1 : 0);
            case 'leftStickY': return (this.keys['down'] || this.keys['s'] ? 1 : 0) - (this.keys['up'] || this.keys['w'] ? 1 : 0);
            case 'leftStickX-': return this.keys['left'] || this.keys['a'] ? 1 : 0;
            case 'leftStickX+': return this.keys['right'] || this.keys['d'] ? 1 : 0;
            case 'leftStickY-': return this.keys['up'] || this.keys['w'] ? 1 : 0;
            case 'leftStickY+': return this.keys['down'] || this.keys['s'] ? 1 : 0;
            default: return 0;
        }
    },
    
    // Reset per-frame state
    endFrame() {
        this.mouse.pressed = false;
        this.mouse.released = false;
        this.mouse.rightPressed = false;
        this.keysPressed = {};
    },
    
    // Check if mouse is over a rectangle
    mouseInRect(x, y, w, h) {
        return this.mouse.x >= x && this.mouse.x < x + w && this.mouse.y >= y && this.mouse.y < y + h;
    },
};

// Global input function aliases
function btn(name) { return Input.btn(name); }
function btnp(name) { return Input.btnp(name); }
function btnv(name) { return Input.btnv(name); }
