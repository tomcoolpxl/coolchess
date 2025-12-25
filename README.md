# coolChess

A fully-featured, browser-based chess game with AI opponent powered by minimax algorithm with alpha-beta pruning.

## Features

- **Complete Chess Rules**: Castling, en passant, pawn promotion, 50-move rule, threefold repetition detection
- **AI Opponent**: Intelligent AI with 4 difficulty levels (Beginner to Hard)
- **Game Modes**:
  - Player vs AI (play as white against the computer)
  - AI vs AI (watch two AIs battle each other)
- **Position Analysis**: Visual evaluation bar showing game advantage
- **Opening Book**: Varied opening moves including English Opening (c4)
- **Smart Undo**: Reverts two moves (opponent + yours) to get back to your turn
- **Move Hints**: Get AI suggestions for your next move
- **Unified New Game Dialog**: Configure mode and difficulty in one place
- **Mobile Optimized**: Full responsive design with touch-friendly controls

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

```
coolchess/
├── index.html          # HTML structure
├── css/
│   └── style.css       # All styling
├── js/
│   ├── constants.js    # Shared constants
│   ├── engine.js       # Core game logic (pure, no DOM)
│   ├── ai.js           # AI/minimax/evaluation
│   ├── ui.js           # Rendering & controls
│   └── main.js         # Initialization
├── README.md           # This file
└── CLAUDE.md           # Development guide
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
- Configurable search depth for difficulty levels
- Position evaluation with piece-square tables
- King safety assessment
- Mobility-based evaluation
- Opening book for move variety

**UI Layer** (ui.js):
- Board rendering and move arrows
- New Game dialog for mode/difficulty selection
- Game info display showing current settings
- Hint system with visual arrows

## Technical Details

- **No Dependencies**: Pure HTML, CSS, and JavaScript
- **Modern Browser Support**: Works on all modern browsers
- **Responsive Design**: Adapts to different screen sizes
- **Clean Architecture**: Engine logic separated from UI
- **Performance**: Alpha-beta pruning for efficient AI search

## File Structure

```
coolchess/
├── index.html          # Main HTML structure
├── css/
│   └── style.css       # Complete styling
├── js/
│   ├── constants.js    # PIECES, timing, opening book
│   ├── engine.js       # Game state and rules
│   ├── ai.js           # Minimax and evaluation
│   ├── ui.js           # Rendering and dialogs
│   └── main.js         # Entry point
├── README.md           # This file
└── CLAUDE.md           # Development documentation
```
