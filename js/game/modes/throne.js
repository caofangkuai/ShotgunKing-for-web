// Throne Mode - main game mode configuration
// Ported from code/modes/throne.lua

const ThroneMode = {
    id: 'throne',
    intro: true,
    weapons: WEAPONS,
    ranks: RANKS,
    base: BASE,
    weaponsIndex: 0,
    ranksIndex: 0,
    lvl: 0,
    turns: 0,
    frags: {},
    noShotgun: false,
    onHeroDeath: null, // Will use default gameover screen
    in_cine: false,
    infinite_shield: false,
    storming: false,
    bossfight: false,
    rev_deathcount: false,
    deathcount_trig: -1,
    paralysis: 0,
    flagstones: false,
    grab: false,
    autofire: false,
    throwing: false,
    surrender: false,
    tactic: 0,
    alarm: 0,
    onBossDeath: function() {
        hero.win = true;
        checkLevelEnd();
    },

    initialize() {
        // Load saved selections
        if (Save.data.prog.throne) {
            const tp = Save.data.prog.throne;
            this.ranksIndex = mid(0, tp.rank_sel || 0, this.ranks.length - 1);
            this.weaponsIndex = mid(0, tp.weapon_sel || 0, this.weapons.length - 1);
        }
    },
    
    start() {
        // Save current selections
        if (Save.data.prog.throne) {
            Save.data.prog.throne.rank_sel = this.ranksIndex;
            Save.data.prog.throne.weapon_sel = this.weaponsIndex;
            Save.save();
        }

        // Show loading screen while setting up game
        showLoadingScreen(() => {
            initGame();
            this.lvl = 0;
            this.turns = 0;
            cardSlots = new Array(10).fill(null);
            cards = { pool: [] };
            this.buildCardPool();

            // Show intro vignette sequence
            if (this.intro) {
                this.intro = false;
                showVignetteSequence([1, 2, 3], () => {
                    this.nextFloor();
                });
            } else {
                this.nextFloor();
            }
        });
    },
    
    buildCardPool() {
        cards.pool = [];
        for (const ca of CARDS) {
            // Skip cards with requirements for initial pool
            if (ca.need || ca.need_card || ca.need_tag) continue;
            // Add copies based on n
            const n = ca.n || 1;
            for (let i = 0; i < n; i++) {
                cards.pool.push({ ...ca });
            }
        }
    },
    
    nextFloor() {
        this.lvl++;
        newLevel();
    },
    
    grow() {
        if (this.lvl < 11) {
            const data = {
                id: 'level_up',
                pan_xm: 1,
                pan_ym: 2,
                pan_width: 80,
                pan_height: 96,
                choices: [
                    [{ team: 0 }, { team: 1 }],
                    [{ team: 0 }, { team: 1 }],
                ],
            };
            levelUp(data, () => this.nextFloor());
        } else if (this.lvl === 11) {
            // Final boss floor
            upgrades.push({ gain: [6], sac: [5] });
            buildStack();
            this.nextFloor();
        }
    },
    
    outro() {
        // Ending sequence
        timerun = false;
        playing = false;
        music('ending_A');
        fadeTo(0, 60, () => {
            // Show ending screen
            const bg = mke(0, 0, 0);
            bg.dp = DP_TOP;
            bg.dr = function() {
                rectfill(0, 0, MCW, MCH, 0);
                const txt = lang.victory || 'VICTORY!';
                lprint(txt, MCW / 2, MCH / 2 - 8, 10, 1);
                const txt2 = lang.thanks_for_playing || 'Thanks for playing!';
                lprint(txt2, MCW / 2, MCH / 2 + 8, 7, 1);
            };
            
            // Save rank progression
            if (Save.data.prog.throne) {
                if (this.ranksIndex >= (Save.data.prog.throne.rank || 0)) {
                    Save.data.prog.throne.rank = this.ranksIndex + 1;
                }
                Save.save();
            }
            
            // Return to menu after delay
            wait(180, () => {
                fadeTo(0, 30, () => initMenu());
            });
        });
    },
    
    onBossDeath() {
        if (this.lvl >= 11) {
            this.outro();
        } else {
            // Regular boss defeated, proceed
            this.grow();
        }
    },
    
    onHeroDeath() {
        gameover();
    },
    
    drawInter() {
        // Mode-specific UI drawing handled by drawUI in gameplay.js
    },
    check_unlocks: function() {
        // Check for unlocks (simplified)
    },
    on_new_turn: function() {
        // Mode-specific new turn logic
    },
    on_bad_hurt: function(e) {
        // Mode-specific bad hurt logic
    },
    on_leader_death: function() {
        // Mode-specific leader death logic
    },
};
