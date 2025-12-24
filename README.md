# coolChess

A fully-featured, browser-based chess game with AI opponent powered by minimax algorithm with alpha-beta pruning.

## Features

- **Complete Chess Rules**: Castling, en passant, pawn promotion, 50-move rule, threefold repetition detection
- **AI Opponent**: Intelligent AI with 4 difficulty levels (Beginner to Hard)
- **Multiple Game Modes**:
  - Player vs Player
  - Player vs AI
  - AI vs AI (watch mode)
- **Position Analysis**: Visual evaluation bar showing game advantage
- **Opening Book**: Varied opening moves including English Opening (c4)
- **Smart Undo**: Reverts two moves (opponent + yours) to get back to your turn
- **Move Hints**: Get AI suggestions for your next move (works correctly for both colors)
- **Info Dialog**: Circular info button explains how the AI works
- **Mobile Optimized**: Full responsive design with touch-friendly controls
- **Accessibility**: ARIA labels for screen reader support

## Quick Start

1. Open `index.html` in any modern web browser
2. No installation, dependencies, or build process required
3. Click to select a piece, then click a highlighted square to move

## How to Play

- **Select a Piece**: Click on any of your pieces to see legal moves highlighted in green
- **Make a Move**: Click on a highlighted square to move your piece
- **Promote a Pawn**: Choose a piece when your pawn reaches the last rank
- **Undo Move**: Reverts opponent's move and your move (below board)
- **Get Hint**: AI suggests best move for current position (below board)
- **Change Mode**: Select game mode from sidebar (PvP, PvAI, AI vs AI)
- **View Info**: Click the info button in the title to learn how the AI works

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
- **Responsive Design**: Adapts to different screen sizes with mobile-specific UI
- **Performance**: Optimized for real-time gameplay with alpha-beta pruning in AI search
- **Dark Mode Compatible**: Pieces render correctly in both light and dark themes

## Recent Improvements

### Game Logic Fixes
- ✅ Fixed hint function to correctly suggest moves for Black player
- ✅ Position history properly maintained during undo operations
- ✅ Pawn promotion no longer duplicates state tracking
- ✅ Castling validation improved (path checking and check-through detection)
- ✅ En passant captures fully supported in undo functionality
- ✅ Castling rights updated when rooks are captured

### Mobile Experience
- ✅ Bidirectional sync between mobile and desktop UI elements
- ✅ Real-time move history updates on both platforms
- ✅ Touch-optimized buttons and controls
- ✅ Proper piece rendering on mobile (dark mode compatible)

### Accessibility & UX
- ✅ ARIA labels added to all interactive elements
- ✅ Consistent info button (circular "i") across all platforms
- ✅ Solid piece rendering (same shapes for both colors, just different colors)

## File Structure

```
coolchess/
├── index.html          # Main application (CSS + HTML + JS)
├── README.md          # This file
├── CLAUDE.md          # Development guide
└── .gitignore         # Git ignore rules
```
