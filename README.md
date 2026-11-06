# coolChess

A fully-featured, browser-based chess game with AI opponent powered by minimax algorithm with alpha-beta pruning, transposition tables, and intelligent move ordering.

## Features

- **Complete Chess Rules**: Castling, en passant (including horizontal pin detection), pawn promotion, 50-move rule, threefold repetition, and insufficient material draws
- **AI Opponent**: Intelligent AI with 4 difficulty levels (Beginner to Hard), powered by Alpha-Beta pruning, Quiescence Search, 64-bit Zobrist Transposition Tables, Killer Moves, History Heuristics, and Tapered Piece-Square Evaluation
- **Game Modes**:
  - Player vs AI (play as white against the computer)
  - AI vs AI (watch two AIs battle each other with Pause/Resume control)
- **Position Analysis**: Visual evaluation bar showing game advantage
- **AI Statistics**: Shows positions evaluated per move and total for game
- **Opening Book**: Varied master opening lines across the first 2–3 moves (Open Games, Sicilian, French, Caro-Kann, Queen's Gambit, Indian, Dutch, English, and Réti)
- **Smart Undo**: Reverts moves cleanly back to your turn and supports cancelling pending promotions
- **Move Hints**: Get AI suggestions for your next move without affecting game stats
- **Unified New Game Dialog**: Configure mode and difficulty in one place
- **Mobile & Tablet Optimized**: Full responsive design with touch-friendly controls and keyboard (`Escape`) support

## Quick Start

1. Open `index.html` in any modern web browser
2. No installation, dependencies, or build process required
3. Click to select a piece, then click a highlighted square to move

## How to Play

- **Select a Piece**: Click on any of your pieces to see legal moves highlighted
- **Make a Move**: Click on a highlighted square to move your piece
- **Promote a Pawn**: Choose a piece when your pawn reaches the last rank
- **Undo Move**: Reverts opponent's move and your move (below board)
- **Get Hint**: AI suggests best move for current position (below board)
- **New Game**: Opens dialog to select mode and difficulty
- **View Info**: Click the info button to learn how the AI works

## Game Modes

| Mode | Description |
|------|-------------|
| **Player vs AI** | Play as white against the computer |
| **AI vs AI** | Watch two AI opponents play each other |

## AI Difficulty Levels

- **Level 1 (Beginner)**: Looks 1 move ahead
- **Level 2 (Easy)**: Looks 2 moves ahead
- **Level 3 (Medium)**: Looks 3 moves ahead
- **Level 4 (Hard)**: Looks 4 moves ahead

In AI vs AI mode, you can set different difficulty levels for White and Black AI.

## Architecture

The application uses a modular file structure:

```bash
coolchess/
├── index.html          # Main HTML structure
├── css/
│   └── style.css       # Complete styling
├── js/
│   ├── constants.js    # PIECES, timing, opening book, Zobrist tables
│   ├── engine.js       # Game state, rules, hash computation
│   ├── ai.js           # Minimax, evaluation, transposition table
│   ├── ui.js           # Rendering and dialogs
│   └── main.js         # Entry point
├── assets/
│   └── img/            # Images (info dialog)
├── README.md           # This file
└── CLAUDE.md           # Development documentation
```

### Key Components

**Game Logic** (engine.js):

- Board state management with piece tracking
- Legal move validation and generation
- Special move handling (castling, en passant, promotion)
- Game-over detection (checkmate, stalemate, draws)
- Move history for undo functionality

**AI Engine** (ai.js):

- Minimax algorithm with alpha-beta pruning
- **Transposition table** (~1M entries) for position caching
- **Zobrist hashing** for fast position identification
- **MVV-LVA move ordering** for better pruning efficiency
- **Node evaluation tracking** with per-move and cumulative counts
- Configurable search depth for difficulty levels
- Position evaluation with piece-square tables
- King safety and mobility evaluation
- Opening book for move variety

**UI Layer** (ui.js):

- Board rendering and move arrows
- New Game dialog for mode/difficulty selection
- Game info display showing current settings
- AI statistics display (positions evaluated)
- Hint system with visual arrows
- Auto-closing game over dialog

## Technical Details

- **No Dependencies**: Pure HTML, CSS, and JavaScript
- **Modern Browser Support**: Works on all modern browsers
- **Responsive Design**: Adapts to different screen sizes
- **Clean Architecture**: Engine logic separated from UI
- **Performance**: Transposition tables + move ordering for 3-5x speedup
- **Zero Delays**: Instant AI moves for responsive gameplay
