// Language System - loads and manages translations

const Lang = {
    data: {},
    plural: {},
    numbered: {},
    fontName: 'pico',
    fontSize: 8,
    fontLineHeight: 8,
    fontDy: 0,
    currentLang: 'english',
    
    async load(name) {
        this.currentLang = name;
        // Return cached data if already loaded
        if (this._loaded && this._loaded[name]) {
            this.data = this._loaded[name].data;
            this.plural = this._loaded[name].plural;
            this.numbered = this._loaded[name].numbered;
            this.applyFont();
            return;
        }
        try {
            // Add 3s timeout for fetch (mobile networks can be slow)
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            const response = await fetch(`lang/${name}.txt`, { signal: controller.signal });
            clearTimeout(timeout);
            const text = await response.text();
            this.parse(text);
            // Cache the loaded language data
            if (!this._loaded) this._loaded = {};
            this._loaded[name] = {
                data: { ...this.data },
                plural: { ...this.plural },
                numbered: { ...this.numbered },
            };
        } catch (e) {
            console.error('Failed to load language:', name, e);
            if (name !== 'english') {
                await this.load('english');
            }
        }
    },
    
    parse(text) {
        this.data = {};
        this.plural = {};
        this.numbered = {};
        
        const lines = text.split('\n');
        for (let line of lines) {
            line = line.replace(/\r/g, '');
            if (line.startsWith('--')) continue;
            if (line.trim() === '') continue;
            
            // Font config
            if (line.startsWith('font>>')) {
                this.fontName = line.substring(6).trim();
            } else if (line.startsWith('font_size>>')) {
                this.fontSize = parseInt(line.substring(11).trim());
            } else if (line.startsWith('font_line_height>>')) {
                this.fontLineHeight = parseInt(line.substring(18).trim());
            } else if (line.startsWith('font_offset_y>>')) {
                this.fontDy = parseInt(line.substring(15).trim());
            } else if (line.includes('::')) {
                // Translation entry
                const idx = line.indexOf('::');
                const key = line.substring(0, idx).trim();
                let val = line.substring(idx + 2);
                // Replace | with newlines
                val = val.split('|').join('\n');
                this.data[key] = val;
            } else if (line.includes(':s:')) {
                // Plural rule
                const parts = line.split(':s:');
                if (parts.length === 3) {
                    const sing = parts[0].trim();
                    const plur = parts[1].trim();
                    this.plural[sing] = plur;
                    this.plural[sing.toLowerCase()] = plur;
                }
            } else if (line.match(/:\d+:/)) {
                // Numbered plural
                const match = line.match(/^(.+?):(\d+):(.+)$/);
                if (match) {
                    const word = match[1].trim();
                    const num = parseInt(match[2]);
                    const plur = match[3].trim();
                    if (!this.numbered[word]) this.numbered[word] = {};
                    if (!this.numbered[word.toLowerCase()]) this.numbered[word.toLowerCase()] = {};
                    this.numbered[word][num] = plur;
                    this.numbered[word.toLowerCase()][num] = plur;
                }
            }
        }
        
        // Set default plural
        if (!this.plural['*']) this.plural['*'] = 's';
        
        // Apply font (works if fonts are already loaded, otherwise main.js applies it)
        if (this.fontName && Sugar.fonts && Sugar.fonts[this.fontName]) {
            this.applyFont();
        }
    },
    
    get(key, reps) {
        let str = this.data[key];
        if (str === undefined) return key;
        
        // Apply replacements
        if (reps) {
            // $0, $1, etc.
            str = str.replace(/\$(\d+)/g, (match, num) => {
                const idx = parseInt(num);
                if (reps[idx] !== undefined) return String(reps[idx]);
                return match;
            });
            
            // $0s, $1s (pluralized)
            str = str.replace(/\$(\d+)s/g, (match, num) => {
                const idx = parseInt(num);
                if (reps[idx] !== undefined) {
                    const val = reps[idx];
                    const count = typeof val === 'number' ? val : 1;
                    return this.pluralize(String(val), count);
                }
                return match;
            });
            
            // %key named replacements
            str = str.replace(/%(\w+)/g, (match, name) => {
                if (reps[name] !== undefined) return String(reps[name]);
                return match;
            });
        }
        
        // (s) plural suffix
        str = str.replace(/\(s\)/g, (match) => '');
        
        // Piece name replacements
        str = str.replace(/<piece>/g, this.data['piece_0'] || 'pawn');
        str = str.replace(/<pieces>/g, this.getPlural(this.data['piece_0'] || 'pawn', 2));
        str = str.replace(/<target_piece>/g, this.data['piece_0'] || 'pawn');
        str = str.replace(/<target_pieces>/g, this.getPlural(this.data['piece_0'] || 'pawn', 2));
        
        return str;
    },
    
    getPlural(word, n) {
        if (n <= 1) return word;
        const lower = word.toLowerCase();
        if (this.numbered[lower] && this.numbered[lower][n]) {
            return this.numbered[lower][n];
        }
        if (this.plural[lower]) {
            return this.plural[lower];
        }
        return word + (this.plural['*'] || 's');
    },
    
    pluralize(word, n) {
        return this.getPlural(word, n);
    },
    
    applyFont() {
        if (this.fontName && Sugar.fonts[this.fontName]) {
            const f = Sugar.fonts[this.fontName];
            // Apply language-specific font settings
            if (this.fontSize) f.sz = this.fontSize;
            if (this.fontLineHeight) f.h = this.fontLineHeight;
            if (this.fontDy !== undefined) f.dy = this.fontDy;
            Sugar.font(this.fontName);
        }
    },
};

// Global language function
function get_lang(key, reps) { return Lang.get(key, reps); }
