// Entity System - manages game objects with draw/update callbacks

const Entity = {
    entities: [],
    waitQueue: [],
    loopQueue: [],
    
    // Create entity
    mke(fr, x, y) {
        const e = {
            fr: fr || 0,        // sprite frame
            x: x || 0,
            y: y || 0,
            vx: 0,
            vy: 0,
            z: 0,               // height offset
            vz: 0,
            dp: 3,              // depth layer (DP_PIECES default)
            life: -1,           // -1 = infinite
            t: 0,               // time alive
            blink: 0,           // blink frames
            frict: 0.7,         // friction
            twcv: null,          // tween curve function
            visible: true,
            dead: false,
            perm: false,         // persists through level reset
            children: [],
            parent: null,
            sq: null,            // square reference (for pieces)
            dr: null,            // draw callback
            upd: null,           // update callback
            drs: null,           // shade draw callback
            onKill: null,        // called when killed
            custom: {},          // custom properties
            
            // Movement/animation
            moveTx: null,
            moveTy: null,
            moveT: 0,
            moveTotal: 0,
            moveCb: null,
            
            // Tween properties
            twFrom: null,
            twTo: null,
            twT: 0,
            twTotal: 0,
            twCb: null,
        };
        this.entities.push(e);
        return e;
    },
    
    // Kill entity
    kl(e) {
        if (!e || e.dead) return;
        e.dead = true;
        if (e.onKill) e.onKill(e);
        // Remove children
        for (const c of e.children) this.kl(c);
    },
    
    // Remove dead entities
    cleanup() {
        this.entities = this.entities.filter(e => !e.dead);
    },
    
    // Draw entity (recursive)
    dre(e, bx, by) {
        if (!e || e.dead) return;
        if (!e.visible) return;
        
        const x = (bx || 0) + e.x;
        const y = (by || 0) + e.y;
        
        // Blink check
        if (e.blink > 0) {
            e.blink--;
            if (Math.floor(e.blink / 2) % 2 === 0) return;
        }
        
        // Draw sprite
        if (e.fr !== undefined && e.fr !== null && e.fr >= 0) {
            spr(e.fr, x, y, 1, 1 + 3/16);
        }
        
        // Custom draw
        if (e.dr) {
            e.dr(e, x, y);
        }
        
        // Draw children
        for (const c of e.children) {
            this.dre(c, x, y);
        }
    },
    
    // Execute function (safely)
    exe(fn, ...args) {
        if (fn) {
            try {
                return fn(...args);
            } catch (e) {
                console.error('Entity exe error:', e);
            }
        }
    },
    
    // Wait function - schedule callback after delay
    wait(delay, fn, ...args) {
        this.waitQueue.push({ t: delay, fn: fn, args: args });
    },
    
    // Loop function - run callback every frame for duration
    loop(fn, duration) {
        const ev = { fn: fn, t: 0, total: duration, done: false, perm: false, nxt: null };
        this.loopQueue.push(ev);
        return ev;
    },
    
    // Movement tween
    mvt(e, tx, ty, t, cb) {
        e.moveTx = tx;
        e.moveTy = ty;
        e.moveT = 0;
        e.moveTotal = t;
        e.moveCb = cb;
        e.moveStartX = e.x;
        e.moveStartY = e.y;
    },
    
    // Impulse
    impulse(e, angle, speed) {
        e.vx += cos(angle) * speed;
        e.vy += sin(angle) * speed;
    },
    
    // Update all entities
    update(dt) {
        // Process wait queue
        for (let i = this.waitQueue.length - 1; i >= 0; i--) {
            this.waitQueue[i].t--;
            if (this.waitQueue[i].t <= 0) {
                const item = this.waitQueue[i];
                this.waitQueue.splice(i, 1);
                if (item.fn) item.fn(...item.args);
            }
        }
        
        // Process loop queue
        for (let i = this.loopQueue.length - 1; i >= 0; i--) {
            const ev = this.loopQueue[i];
            ev.t++;
            if (ev.fn) ev.fn(ev);
            if (ev.t >= ev.total) {
                if (ev.nxt) ev.nxt();
                this.loopQueue.splice(i, 1);
            }
        }
        
        // Update entities
        for (const e of this.entities) {
            if (e.dead) continue;
            
            e.t++;
            
            // Life countdown
            if (e.life > 0) {
                e.life--;
                if (e.life <= 0) {
                    this.kl(e);
                    continue;
                }
            }
            
            // Movement tween
            if (e.moveTx !== null) {
                e.moveT++;
                const c = e.moveT / e.moveTotal;
                const ec = e.twcv ? e.twcv(c) : c;
                e.x = e.moveStartX + (e.moveTx - e.moveStartX) * ec;
                e.y = e.moveStartY + (e.moveTy - e.moveStartY) * ec;
                if (e.moveT >= e.moveTotal) {
                    e.x = e.moveTx;
                    e.y = e.moveTy;
                    e.moveTx = null;
                    if (e.moveCb) {
                        const cb = e.moveCb;
                        e.moveCb = null;
                        cb();
                    }
                }
            }
            
            // Physics
            if (e.vx || e.vy) {
                e.x += e.vx;
                e.y += e.vy;
                e.vx *= e.frict;
                e.vy *= e.frict;
                if (Math.abs(e.vx) < 0.1) e.vx = 0;
                if (Math.abs(e.vy) < 0.1) e.vy = 0;
            }
            
            // Z physics
            if (e.vz) {
                e.z += e.vz;
                e.vz -= 0.5;
                if (e.z < 0) {
                    e.z = 0;
                    e.vz = 0;
                }
            }
            
            // Custom update
            if (e.upd) e.upd(e);
        }
        
        // Cleanup dead
        this.cleanup();
    },
    
    // Draw all entities by depth
    drawAll() {
        // Y-sort entities with z property
        const ysorted = [];
        for (const e of this.entities) {
            if (e.z !== undefined && e.z !== 0) {
                ysorted.push(e);
            }
        }
        ysorted.sort((a, b) => (a.y + (a.ysort_dy || 0)) - (b.y + (b.ysort_dy || 0)));
        
        // Depth sort
        const layers = [];
        for (let i = 0; i < 16; i++) layers.push([]);
        
        for (const e of this.entities) {
            if (e.dead) continue;
            const dp = Math.max(0, Math.min(15, e.dp || 0));
            layers[dp].push(e);
        }
        
        // Draw each layer
        for (const layer of layers) {
            for (const e of layer) {
                this.dre(e);
            }
        }
    },
    
    // Reset
    reset() {
        this.entities = this.entities.filter(e => e.perm);
        this.waitQueue = [];
        this.loopQueue = [];
    },
};

// Global function aliases
function mke(fr, x, y) { return Entity.mke(fr, x, y); }
function kl(e) { Entity.kl(e); }
function dre(e, bx, by) { Entity.dre(e, bx, by); }
function exe(fn, ...args) { return Entity.exe(fn, ...args); }
function wait(delay, fn, ...args) { Entity.wait(delay, fn, ...args); }
function loop(fn, duration) { return Entity.loop(fn, duration); }
function mvt(e, tx, ty, t, cb) { Entity.mvt(e, tx, ty, t, cb); }
function impulse(e, angle, speed) { Entity.impulse(e, angle, speed); }
function mv(e, dx, dy, t) { 
    e.moveStartX = e.x;
    e.moveStartY = e.y;
    e.moveTx = e.x + dx;
    e.moveTy = e.y + dy;
    e.moveT = 0;
    e.moveTotal = t;
    e.moveCb = null;
}
