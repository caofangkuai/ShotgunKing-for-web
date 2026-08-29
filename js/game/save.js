// Save System - uses JSON in localStorage

const Save = {
    SAVE_KEY: 'shotgun_king_save',
    SETTINGS_KEY: 'shotgun_king_settings',
    
    // Progress data (DEN equivalent)
    data: {
        version: '1.515g',
        prog: {
            throne: {
                rank: 0,
                rank_sel: 0,
                weapon_sel: 0,
                lvl: {},
                best_time: {},
                badges: {},
                weapon_unl: {},
            },
            endless: { best_floor: 0 },
            chase: { best_score: 0 },
            tutorial: { done: false },
            stats: {},
            achievements: {},
        },
    },
    
    // Settings (SET equivalent)
    settings: {
        music: 10,
        sfx: 10,
        fullscreen: 1,
        crt: 1,
        speedrun: 0,
        shields: 2,
        show_danger: 1,
        scrshake: 1,
        scrflash: 1,
        lang: 99,
        hdtext: 0,
    },
    
    init() {
        this.load();
        this.checkSave();
    },
    
    load() {
        try {
            const saveStr = localStorage.getItem(this.SAVE_KEY);
            if (saveStr) {
                const parsed = JSON.parse(saveStr);
                // Deep merge
                this.data = this.deepMerge(this.data, parsed);
            }
        } catch (e) {
            console.error('Failed to load save:', e);
        }
        
        try {
            const setStr = localStorage.getItem(this.SETTINGS_KEY);
            if (setStr) {
                const parsed = JSON.parse(setStr);
                this.settings = { ...this.settings, ...parsed };
            }
        } catch (e) {
            console.error('Failed to load settings:', e);
        }
    },
    
    save() {
        try {
            localStorage.setItem(this.SAVE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.error('Failed to save:', e);
        }
    },
    
    saveSettings() {
        try {
            localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(this.settings));
        } catch (e) {
            console.error('Failed to save settings:', e);
        }
    },
    
    deepMerge(target, source) {
        const result = { ...target };
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        return result;
    },
    
    checkSave() {
        if (!this.data.prog.throne) {
            this.data.prog.throne = {
                rank: 0,
                rank_sel: 0,
                weapon_sel: 0,
                lvl: {},
                best_time: {},
                badges: {},
                weapon_unl: {},
            };
        }
        if (!this.data.prog.endless) this.data.prog.endless = { best_floor: 0 };
        if (!this.data.prog.chase) this.data.prog.chase = { best_score: 0 };
        if (!this.data.prog.tutorial) this.data.prog.tutorial = { done: false };
        if (!this.data.prog.stats) this.data.prog.stats = {};
        if (!this.data.prog.achievements) this.data.prog.achievements = {};
    },
    
    reset() {
        this.data = {
            version: '1.515g',
            prog: {
                throne: {
                    rank: 0,
                    rank_sel: 0,
                    weapon_sel: 0,
                    lvl: {},
                    best_time: {},
                    badges: {},
                    weapon_unl: {},
                },
                endless: { best_floor: 0 },
                chase: { best_score: 0 },
                tutorial: { done: false },
                stats: {},
                achievements: {},
            },
        };
        this.save();
    },
    
    // Get option value
    getOpt(s) {
        return this.settings[s];
    },
    
    // Set option value
    setOpt(s, v) {
        this.settings[s] = v;
        this.saveSettings();
    },
    
    // Apply options
    applyOptions() {
        AudioManager.setMusicVolume(this.settings.music / 11);
        AudioManager.setSfxVolume(this.settings.sfx / 11);
    },
    
    // Inc stats
    incStats(id) {
        if (!this.data.prog.stats[id]) this.data.prog.stats[id] = { played: 0 };
        this.data.prog.stats[id].played++;
    },
    
    getStats(id) {
        return this.data.prog.stats[id] || { played: 0 };
    },
    
    // Export save as JSON
    exportJSON() {
        return JSON.stringify({
            data: this.data,
            settings: this.settings,
        }, null, 2);
    },
    
    // Import save from JSON
    importJSON(jsonStr) {
        try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.data) this.data = this.deepMerge(this.data, parsed.data);
            if (parsed.settings) this.settings = { ...this.settings, ...parsed.settings };
            this.save();
            this.saveSettings();
            return true;
        } catch (e) {
            console.error('Import failed:', e);
            return false;
        }
    },
    
    // Check if save exists
    hasSave() {
        return localStorage.getItem(this.SAVE_KEY) !== null;
    },
};

// Global save aliases (DEN equivalent)
const DEN = {
    prog: null,
    
    init() {
        this.prog = Save.data.prog;
    },
    
    save() {
        Save.save();
    },
};

// SET equivalent
const SET = {
    init() {
        // Settings are accessed directly from Save.settings
    },
    
    get(s) { return Save.settings[s]; },
    set(s, v) { Save.settings[s] = v; Save.saveSettings(); },
};
