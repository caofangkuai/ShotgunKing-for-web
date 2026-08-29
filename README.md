# Shotgun King: The Final Checkmate - Web Edition

A web port of the Android Lua game "Shotgun King: The Final Checkmate" by PUNKCAKE.

## Play

Open `index.html` in a web browser, or serve the directory with any HTTP server:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

**Please use landscape mode on mobile devices.**

## Features

- Faithful port of the original game's UI and gameplay
- Pixel-art rendering via HTML5 Canvas (PICO-8-like 320x180 internal resolution)
- Touch, mouse, and keyboard input support
- JSON-based save/load system (via localStorage)
- Landscape orientation prompt for mobile devices
- All original game assets (sprites, music, SFX, fonts)

## Controls

| Action | Keyboard | Mouse/Touch |
|--------|----------|-------------|
| Move/Select | Arrow Keys | Click |
| Confirm | Enter / Space | Click |
| Cancel/Menu | Escape | Right Click |
| Shoot | Space | Click |
| Reload | R | - |
| Grenade | C / Tab | - |
| Pause | Escape / P | - |

## Game Structure

```
ShotgunKing-for-web/
├── index.html          # Entry point
├── css/style.css       # Styles
├── js/
│   ├── engine/
│   │   ├── sugar.js    # PICO-8-like rendering engine
│   │   ├── input.js    # Input handling
│   │   ├── audio.js    # Audio playback
│   │   └── entity.js   # Entity management
│   ├── game/
│   │   ├── data.js     # Game data (pieces, cards, weapons)
│   │   ├── gameplay.js # Core gameplay logic
│   │   ├── grid.js     # AI decision making
│   │   ├── menu.js     # Menu system
│   │   ├── save.js     # Save/load system
│   │   ├── lang.js     # Language system
│   │   └── modes/
│   │       └── throne.js  # Throne game mode
│   └── main.js         # Main entry & game loop
├── assets/             # Game assets
│   ├── gfx/             # Spritesheets
│   ├── music/           # Background music
│   ├── sfx/             # Sound effects
│   └── fonts/           # Font files
└── lang/               # Language files
```

## Credits

Original game by PUNKCAKE. Web port powered by the Sugar engine.
