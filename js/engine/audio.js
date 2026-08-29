// Audio System - handles SFX and music

const AudioManager = {
    audioCtx: null,
    sfx: {},
    music: {},
    currentMusic: null,
    musicVolume: 0.7,
    sfxVolume: 0.7,
    enabled: true,
    
    init() {
        // Audio context will be created on first user interaction
        const initAudio = () => {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }
        };
        
        document.addEventListener('click', initAudio, { once: false });
        document.addEventListener('keydown', initAudio, { once: false });
        document.addEventListener('touchstart', initAudio, { once: false });
    },
    
    loadSfx(name, path) {
        return new Promise((resolve) => {
            const audio = new Audio();
            audio.src = path;
            audio.preload = 'auto';
            let done = false;
            const finish = () => { if (!done) { done = true; resolve(); } };
            audio.addEventListener('canplaythrough', finish, { once: true });
            audio.addEventListener('error', finish, { once: true });
            setTimeout(finish, 3000); // 3s timeout
            this.sfx[name] = audio;
        });
    },
    
    loadMusic(name, path) {
        return new Promise((resolve) => {
            const audio = new Audio();
            audio.src = path;
            audio.preload = 'auto';
            audio.loop = true;
            let done = false;
            const finish = () => { if (!done) { done = true; resolve(); } };
            audio.addEventListener('canplaythrough', finish, { once: true });
            audio.addEventListener('error', finish, { once: true });
            setTimeout(finish, 3000); // 3s timeout
            this.music[name] = audio;
        });
    },
    
    playSfx(name, volume) {
        if (!this.enabled) return;
        const audio = this.sfx[name];
        if (!audio) return;
        try {
            audio.currentTime = 0;
            audio.volume = (volume !== undefined ? volume : 1) * this.sfxVolume;
            audio.play().catch(() => {});
        } catch (e) {}
    },
    
    playMusic(name, fade) {
        if (!this.enabled) return;
        if (this.currentMusic === name) return;
        
        // Stop current music
        if (this.currentMusic && this.music[this.currentMusic]) {
            const old = this.music[this.currentMusic];
            if (fade) {
                this.fadeOut(old, () => {
                    old.pause();
                    old.currentTime = 0;
                });
            } else {
                old.pause();
                old.currentTime = 0;
            }
        }
        
        this.currentMusic = name;
        const audio = this.music[name];
        if (audio) {
            audio.volume = this.musicVolume;
            audio.play().catch(() => {});
        }
    },
    
    stopMusic(fade) {
        if (this.currentMusic && this.music[this.currentMusic]) {
            const audio = this.music[this.currentMusic];
            if (fade) {
                this.fadeOut(audio, () => {
                    audio.pause();
                    audio.currentTime = 0;
                });
            } else {
                audio.pause();
                audio.currentTime = 0;
            }
        }
        this.currentMusic = null;
    },
    
    setMusicVolume(v) {
        this.musicVolume = v;
        if (this.currentMusic && this.music[this.currentMusic]) {
            this.music[this.currentMusic].volume = v;
        }
    },
    
    setSfxVolume(v) {
        this.sfxVolume = v;
    },
    
    fadeOut(audio, callback) {
        const startVol = audio.volume;
        const steps = 30;
        let step = 0;
        const interval = setInterval(() => {
            step++;
            audio.volume = startVol * (1 - step / steps);
            if (step >= steps) {
                clearInterval(interval);
                audio.volume = 0;
                if (callback) callback();
            }
        }, 16);
    },
    
    fadeIn(audio, callback) {
        audio.volume = 0;
        const targetVol = this.musicVolume;
        const steps = 30;
        let step = 0;
        const interval = setInterval(() => {
            step++;
            audio.volume = targetVol * (step / steps);
            if (step >= steps) {
                clearInterval(interval);
                audio.volume = targetVol;
                if (callback) callback();
            }
        }, 16);
    },
};

function sfx(name, vol) { AudioManager.playSfx(name, vol); }
function music(name, fade) { AudioManager.playMusic(name, fade); }
function stopMusic(fade) { AudioManager.stopMusic(fade); }
