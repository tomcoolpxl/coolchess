# coolChess ♟️

A fully-featured, browser-based chess game with AI opponent powered by minimax algorithm with alpha-beta pruning.

## Features

- **Complete Chess Rules**: Castling, en passant, pawn promotion, 50-move rule, threefold repetition detection
- **AI Opponent**: Intelligent AI with 4 difficulty levels (Beginner to Hard)
- **Multiple Game Modes**: 
  - Player vs Player
  - Player vs AI
  - AI vs AI (watch mode)
- **Position Analysis**: Visual evaluation bar showing game advantage
- **Opening Book**: Varied opening moves for natural gameplay
- **Full Undo Support**: Revert moves at any time
- **Move Hints**: Get suggestions for your next move

## Quick Start

1. Open `index.html` in any modern web browser
2. No installation, dependencies, or build process required
3. Click to select a piece, then click a highlighted square to move

## How to Play

- **Select a Piece**: Click on any of your pieces to see legal moves highlighted in green
- **Make a Move**: Click on a highlighted square to move your piece
- **Promote a Pawn**: Choose a piece when your pawn reaches the last rank
- **Undo**: Click "Undo" to reverse the last move
- **Get Hint**: Click "Hint" to see AI's recommended move
- **Change Mode**: Select game mode (PvP, PvAI, AI vs AI) from the sidebar

## Game Modes

| Mode | Description |
|------|-------------|
| **Player vs Player** | Two players take turns on the same board |
| **Player vs AI** | Play as white against the computer |
| **AI vs AI** | Watch two AI opponents play each other |

## AI Difficulty Levels

- **Level 1 (Beginner)**: Looks 1 move ahead
- **Level 2 (Easy)**: Looks 2 moves ahead
- **Level 3 (Medium)**: Looks 3 moves ahead
- **Level 4 (Hard)**: Looks 4 moves ahead

## Architecture

The entire application is a single-file implementation (`index.html`) with:

- **CSS**: Complete styling for board, pieces, animations, and dialogs (lines 7-502)
- **HTML**: Board layout, sidebar panels, dialogs, and overlays (lines 504-625)
- **JavaScript**: Game logic, AI engine, and rendering (lines 627-1882)

### Key Components

**Game Logic**:
- Board state management with piece tracking
- Legal move validation and generation
- Special move handling (castling, en passant, promotion)
- Game-over detection (checkmate, stalemate, draws)
- Move history for undo functionality

**AI Engine**:
- Minimax algorithm with alpha-beta pruning
- Configurable search depth for difficulty levels
- Position evaluation with piece-square tables
- King safety assessment
- Mobility-based evaluation
- Opening book for move variety

**Rendering**:
- Real-time board updates
- Move highlighting and legal move indicators
- Last move arrow visualization
- Piece promotion dialogs

## Technical Details

- **No Dependencies**: Pure HTML, CSS, and JavaScript
- **Modern Browser Support**: Works on all modern browsers (Chrome, Firefox, Safari, Edge)
- **Responsive Design**: Adapts to different screen sizes
- **Performance**: Optimized for real-time gameplay with alpha-beta pruning in AI search

## File Structure

```
coolchess/
├── index.html          # Main application (CSS + HTML + JS)
├── README.md          # This file
├── CLAUDE.md          # Development guide
└── .gitignore         # Git ignore rules
```
