// Grid System - AI decision making and board simulation

function mkGrid() {
    const grid = {
        pos: {}, // piece -> square mapping
        score: 0,
        dangers: {},
        bonus: 0,
        sq: null,
        act: null,
    };
    
    // Initialize from current board state
    for (const sq of squares) {
        if (sq.p) {
            grid.pos[sq.p] = sq;
        }
    }
    
    grid.mov = function(p, tsq) {
        grid.pos[p] = tsq;
    };
    
    grid.push = function(p, di) {
        if (!p || !grid.pos[p]) return 0;
        const nsq = dsq(grid.pos[p], di);
        const np = grid.pieceAt(nsq);
        if (np && np !== hero && (np.big || np.type === leader)) return -100;
        let pushed = np ? 1 : 0;
        pushed += grid.push(np, di);
        grid.pos[p] = nsq;
        return pushed;
    };
    
    grid.pieceAt = function(sq) {
        if (!sq) return null;
        for (const k in grid.pos) {
            if (grid.pos[k] === sq) return k;
            if (k.big) {
                const a = getPieceSquares(k);
                for (const bsq of a) {
                    if (bsq === sq) return k;
                }
            }
        }
        return null;
    };
    
    return grid;
}

function paintDanger(grid) {
    // Reset danger
    for (const sq of squares) sq.dan = 0;
    
    // Paint danger from bad pieces
    for (const p in grid.pos) {
        const piece = p; // piece object
        if (piece.bad) {
            const osq = piece.sq;
            piece.sq = grid.pos[piece];
            const a = getRange(piece, "atk", null, true);
            piece.sq = osq;
            for (const sq of a) sq.dan = (sq.dan || 0) + 1;
        }
    }
}

function scoreGrid(grid, from) {
    grid.score = grid.bonus || 0;
    
    const sco = (n) => { grid.score += n; };
    
    // Save and modify squares
    for (const sq of squares) sq.op = sq.p;
    for (const p in grid.pos) {
        grid.pos[p].p = p;
    }
    
    // Reset danger
    for (const sq of squares) sq.dan = 0;
    
    const hsq = getHeroSq();
    const hsd = pside(hsq);
    
    // Evaluate each piece
    for (const p in grid.pos) {
        const piece = p;
        const sq = grid.pos[piece];
        
        // Army sum
        const pdan = piece.danger || 0;
        sco(pdan);
        
        // Promotion evaluation
        if (piece.promote) {
            if (sq.py === 7) {
                sco(3);
            } else {
                sco(sq.py * (piece.type === 0 ? 1 : 2) / 8);
            }
        }
        
        // Paint danger
        if (piece.bad) {
            const osq = piece.sq;
            piece.sq = sq;
            const a = getRange(piece, "atk", null, true);
            piece.sq = osq;
            for (const dsq of a) dsq.dan = (dsq.dan || 0) + 1;
        }
        
        // Moat
        if (stack.moat && !stack.bridge && !piece.flying && piece.type !== 1) {
            const psd = pside(sq);
            if (hsd !== 0 && psd === -hsd || (hsd === 0 && stack.deepwater)) {
                sco(-pdan);
            }
        }
        
        // POV evaluation
        if (from === piece) {
            // Fear
            if (piece.fear) sco(sq.wdist * 10);
            // Guard
            if (piece.jester && stack.jester_guard) sco(-(sq.gdist || 0) * 2);
        }
        
        // Cover
        if (piece.type === leader) {
            const a = bres2(hsq.px, hsq.py, sq.px, sq.py);
            for (let i = 1; i < a.length; i++) {
                const p = a[i];
                const osq = gsq(p.x, p.y);
                if (osq && osq.p && osq.p.type !== leader) {
                    sco(Math.min(osq.p.hp, 3) / 80);
                }
            }
        }
        
        // Seek
        if (piece.dgr) {
            sco(-Math.min(piece.dgr[sq], 6) / 8);
        }
        
        // Diagonal near target
        sco(1 / (sq.ddist + 20));
        
        // Inquisition
        if (sq.waypoint && piece.investigate) {
            sco(2);
        }
        
        // Doubt (disguise)
        if (piece.type === leader && hero.cloaked && hero.disguised) {
            sco(sq.doubt_dist || 0);
        }
    }
    
    // Check hero target
    const h = getHeroTrg();
    if (!grid.pos[h] && !h.cloaked) sco(2000);
    
    // Scan all squares for danger
    if (!hero.cloaked || hero.holoking) {
        const ai_lvl = stack.ai_lvl || 0;
        for (const sq of squares) {
            const trg = hero.holoking || hero;
            if (sq.dan > 0) {
                if (sq.p === trg) {
                    if (sq.dan > 0) {
                        sco(sq.dan > 1 ? 5 : 3);
                    }
                } else if (sq.ddist <= 1 && ai_lvl >= 1) {
                    sco(1);
                } else if (sq.p || (sq.dan > 0 && ai_lvl >= 2)) {
                    sco(1/20);
                }
            }
        }
    }
    
    // Store dangers
    grid.dangers = {};
    for (const sq of squares) {
        grid.dangers[sq] = sq.dan;
    }
    
    // Restore squares
    for (const sq of squares) sq.p = sq.op;
}

function pside(sq) {
    if (!sq) return 0;
    if (sq.py > 4) return 1;
    if (sq.py < 4) return -1;
    return 0;
}

// Get range for a piece (movement/attack squares)
function getRange(p, tag, soulType, planning) {
    if (!p || !p.sq) return [];
    
    const result = [];
    tag = tag || "move";
    
    const behaviors = p.behavior || [];
    
    for (const beh of behaviors) {
        // Only process behaviors that match the tag
        if (tag === "move" && !beh.move) continue;
        if (tag === "atk" && !beh.atk) continue;
        
        if (beh.id === "line") {
            // Line movement: directions from beh.a to beh.b, up to beh.range
            const startDir = beh.a !== undefined ? beh.a : 0;
            const endDir = beh.b !== undefined ? beh.b : 7;
            const maxDist = beh.range || 8;
            
            for (let di = startDir; di <= endDir; di++) {
                for (let dist = 1; dist <= maxDist; dist++) {
                    const nsq = dsq(p.sq, di, dist);
                    if (!nsq) break;
                    
                    if (nsq.p) {
                        // Square occupied
                        if (nsq.p === hero) {
                            // Can capture hero
                            result.push(nsq);
                        }
                        break; // Blocked by any piece
                    } else {
                        // Empty square
                        result.push(nsq);
                    }
                }
            }
        } else if (beh.id === "jump") {
            // Knight-like jump movement
            const moves = beh.moves || KNIGHT_MOVES;
            for (let i = 0; i < moves.length; i += 2) {
                const dx = moves[i];
                const dy = moves[i + 1];
                const nsq = gsq(p.sq.px + dx, p.sq.py + dy);
                if (!nsq) continue;
                
                if (nsq.p) {
                    if (nsq.p === hero) {
                        result.push(nsq);
                    }
                } else {
                    result.push(nsq);
                }
            }
        }
    }
    
    return result;
}

// Get piece's next action (move or attack)
function getPieceNextAction(e) {
    // Check if piece is ready
    if (!e.ready) return null;
    
    // Create current state grid
    const curgr = mkGrid();
    scoreGrid(curgr, e);
    const curscore = curgr.score;
    
    const grids = [];
    
    // Evaluate moves (including attack moves that can capture hero)
    const moves = getRange(e, "move");
    // Also add attack squares where hero is (for pawns with different attack directions)
    const atks = getRange(e, "atk");
    for (const sq of atks) {
        if (sq.p === hero && !moves.includes(sq)) {
            moves.push(sq);
        }
    }
    
    for (const sq of moves) {
        const grid = mkGrid();
        grid.sq = sq;
        grid.mov(e, sq);
        scoreGrid(grid, e);
        grid.act = "move";
        grids.push(grid);
    }
    
    if (grids.length === 0) return null;
    
    // Sort by score (best first)
    grids.sort((a, b) => b.score - a.score);
    
    // Remember grids
    e.grids = {};
    for (const gr of grids) {
        e.grids[gr.sq] = gr;
    }
    
    // Pick from top N (based on ai_lvl)
    const n = Math.min(grids.length, Math.max(1, 3 - (stack.ai_lvl || 0)));
    const pick = irnd(n);
    e.fgr = grids.length > 0 ? grids[pick] : null;
    
    if (e.soulless) {
        e.fgr = grids[irnd(grids.length)];
    }
    
    return e.fgr;
}

// Get piece targets (for attack)
function getPieceTargets(e) {
    if (!e || !e.sq) return [];
    const result = [];
    const a = getRange(e, "atk");
    for (const sq of a) {
        if (sq.p === hero || (sq.p && !sq.p.bad)) {
            result.push(sq.p);
        }
    }
    return result;
}

// Get piece tempo
function getPieceTempo(e) {
    let tempo = e.tempo;
    if (e.bleed && stack.bleed_slow) tempo += 1;
    if (e.emergency_done) tempo = Math.max(tempo - 1, 1);
    if (stack.shackles && seer && e === seer.trg) tempo += 1;
    return tempo;
}

// Get prediction for seer
function getPrediction(e, mode) {
    if (!seer || !seer.trg || seer.trg !== e) return null;
    
    const action = getPieceNextAction(e);
    if (!action) return null;
    
    return action;
}
