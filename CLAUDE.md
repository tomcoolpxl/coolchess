# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a browser-based chess game with separate HTML, CSS, and JavaScript files. The game features:
- Full chess rules implementation (castling, en passant, pawn promotion, 50-move rule, threefold repetition)
- AI opponent using minimax with alpha-beta pruning, transposition tables, and move ordering
- Two game modes: Player vs AI, AI vs AI (watch mode)
- Unified New Game dialog for mode and difficulty selection
- Position evaluation with visual evaluation bar
- AI statistics display (positions evaluated per move and total)
- Opening book for common opening moves (11 pre-programmed moves)
- Info dialog explaining how the AI works (includes tribute to Maurits Cool)
- Smart undo that reverts 2 moves (opponent + yours)
- Hint feature with visual arrow showing suggested move
- Zero AI delays for instant responsive gameplay

## Running the Application

Simply open `index.html` in any modern web browser. No build process, server, or dependencies required.

## Architecture

### File Structure

```
coolchess/
├── index.html          # HTML structure only (~207 lines)
├── css/
│   └── style.css       # All styling (~1200 lines)
├── js/
│   ├── constants.js    # Shared constants + Zobrist tables (~87 lines)
│   ├── engine.js       # Core game logic, pure functions (~665 lines)
│   ├── ai.js           # AI/minimax/evaluation/TT (~520 lines)
│   ├── ui.js           # Rendering & controls (~915 lines)
│   └── main.js         # Initialization (~7 lines)
├── assets/
│   └── img/            # Images (maurice_cool.jpg for info dialog)
├── CLAUDE.md           # This documentation
└── README.md           # Project readme
```

### Module Responsibilities

1. **index.html**: DOM structure with links to external CSS and JS files

2. **css/style.css**: All styling (board, pieces, animations, dialogs, mobile)

3. **js/constants.js**: Shared constants
   - `PIECES` / `PIECES_HOLLOW` - Unicode chess symbols
   - `ZOBRIST` - Zobrist hash tables for transposition table (seeded PRNG)
   - `PIECE_INDEX` - Maps piece characters to indices for hashing
   - Timing constants (arrow fade, AI delays - all set to 0 for instant play)
   - `openingBook` - Pre-programmed opening moves

4. **js/engine.js**: Core game logic (pure, no DOM manipulation)
   - Game state variables (board, currentPlayer, castlingRights, etc.)
   - Move validation (`isValidMove`, `isPieceMovementValid`, `canCastle`)
   - Move execution (`makeMove` returns result object, `undoSingleMove`)
   - Game rules (`isInCheck`, `checkGameOver` returns state, `getAllLegalMoves`)
   - Promotion handling (`completePromotion`)
   - `computeHash()` - Zobrist hash for current position

5. **js/ai.js**: AI and evaluation
   - AI difficulty settings (`aiDifficulty`, `aiDifficultyWhite`, `aiDifficultyBlack`) - default: 3 (Medium)
   - Node tracking (`nodesEvaluated`, `lastMoveNodesEvaluated`)
   - Transposition table (`ttStore`, `ttLookup`, `ttClear`) - ~1M entries
   - Move ordering (`orderMoves`) - MVV-LVA (Most Valuable Victim - Least Valuable Attacker)
   - `minimax()` with alpha-beta pruning, TT lookups, and move ordering
   - `evaluateBoard()` with piece-square tables
   - `getOpeningBookMove()` for opening book
   - Uses UI wrappers (`executeMoveWithUI`) for moves

6. **js/ui.js**: Rendering and user interface
   - Board rendering (`renderBoard`, `drawMoveArrow`, `drawHintArrow`)
   - UI updates (`updateStatus`, `updateEvaluationBar`, `updateGameInfo`)
   - User input (`handleSquareClick`, `getHint`)
   - Game controls (`newGame`, `undoMove`)
   - New Game dialog (`showNewGameDialog`, `startNewGame`, `cancelNewGame`, `selectGameMode`)
   - UI wrappers for engine (`executeMoveWithUI`, `executePromotionWithUI`)
   - Dialog management (info, mobile menu, promotion, game over)

7. **js/main.js**: Application entry point
   - Calls `initGame()` and `initUI()` on load

**Load Order**: Scripts must load in this order due to dependencies:
`constants.js` → `engine.js` → `ai.js` → `ui.js` → `main.js`

### Layout Structure

- **Main Board Area**: 8x8 chessboard with coordinate labels and evaluation bar
- **Below Board Controls**: Quick actions (undo, hint) and captured pieces display
- **Sidebar**: Game status with game info display, move history, New Game button
- **Info Button**: In sidebar title, opens dialog explaining minimax and opening book
- **New Game Dialog**: Modal for selecting game mode and AI difficulty

### Core Game State

The game state is managed through global variables in engine.js:
- `board`: 8x8 array representing the chessboard
- `currentPlayer`: 'white' or 'black'
- `gameMode`: 'ai' or 'watch'
- `moveHistory`: Array of move objects for undo functionality
- `castlingRights`: Tracks castling availability for both sides
- `enPassantTarget`: Tracks en passant capture opportunity
- `halfMoveClock`: For 50-move rule
- `positionHistory`: For threefold repetition detection

UI state in ui.js:
- `watchMatchRunning`: Controls AI vs AI match state
- `selectedDialogMode`: Tracks mode selection in New Game dialog
- Arrow timeout variables for fade animations

### Key Functions

**Engine Functions** (pure, return results):
- `initGame()`: Initialize/reset game state
- `isValidMove()`: Validates if a move is legal
- `makeMove()`: Returns `{success, needsPromotion, moveInfo, gameOverResult}`
- `completePromotion()`: Returns `{success, moveInfo, gameOverResult}`
- `undoSingleMove()`: Returns `{success, undoneMove}`
- `checkGameOver()`: Returns `{isOver, reason, message, winner}`
- `getAllLegalMoves()`: Generates all legal moves for a player

**AI Functions**:
- `makeAIMove()`: Entry point for AI move generation (uses UI wrappers)
- `minimax()`: Minimax with alpha-beta pruning, transposition table, move ordering
- `evaluateBoard()`: Position evaluation with piece-square tables
- `getOpeningBookMove()`: Selects moves from opening book
- `orderMoves()`: MVV-LVA move ordering for better pruning
- `ttStore()` / `ttLookup()` / `ttClear()`: Transposition table operations
- `computeHash()`: Zobrist hash computation (in engine.js)

**UI Wrapper Functions**:
- `executeMoveWithUI()`: Calls engine makeMove + updates all UI
- `executePromotionWithUI()`: Calls engine completePromotion + updates all UI

**UI Control Functions**:
- `newGame()`: Opens New Game dialog
- `showNewGameDialog()`: Display the New Game modal
- `startNewGame()`: Read dialog values, init game, start if AI vs AI
- `cancelNewGame()`: Close dialog, resume AI vs AI if was running
- `selectGameMode()`: Toggle mode in dialog, show/hide difficulty sections
- `updateGameInfo()`: Update game info display with current mode/difficulty
- `undoMove()`: Undoes 2 moves to return to player's turn
- `getHint()`: Calculate and display suggested move with visual arrow

### Chess Rules Implementation

**Special Moves**:
- Castling: Validated in `canCastle()`, executed in `makeMove()`
- En passant: Validated in `isPieceMovementValid()`, executed in `makeMove()`
- Pawn promotion: Handled with modal dialog in `showPromotionDialog()`

**Game Ending Conditions**:
- Checkmate/Stalemate: Detected by checking if player has no legal moves
- 50-move rule: Tracked via `halfMoveClock`
- Threefold repetition: Tracked via `positionHistory`

### AI Difficulty Levels

Search depth controls difficulty:
- Depth 1: Beginner (looks 1 move ahead)
- Depth 2: Easy (looks 2 moves ahead)
- Depth 3: Medium (looks 3 moves ahead)
- Depth 4: Hard (looks 4 moves ahead)

In AI vs AI mode, White and Black can have different difficulties.

### Opening Book

The opening book contains 11 pre-programmed moves that randomize for variety:
- White's first move: 4 options (e4, d4, c4 [English Opening], Nf3)
- Black's response to e4: 4 options (e5, c5, e6, c6)
- Black's response to d4: 3 options (d5, Nf6, f6)

### AI Optimizations

**Transposition Table**:
- ~1 million entry hash table for caching evaluated positions
- Uses Zobrist hashing for fast position identification
- Stores: hash, depth, score, flag (EXACT/ALPHA/BETA), best move
- Cleared on new game via `ttClear()`
- Provides 2-3x speedup by avoiding re-evaluation of identical positions

**Move Ordering (MVV-LVA)**:
- Most Valuable Victim - Least Valuable Attacker ordering
- TT best move searched first (from previous iterations)
- Captures ordered by victim value minus attacker value
- Improves alpha-beta pruning by searching likely best moves first
- Provides ~2x speedup through better cutoffs

**Zobrist Hashing**:
- 64 squares × 12 piece types random values
- 4 castling rights, 8 en passant files, side-to-move values
- Seeded PRNG for reproducible hashes across sessions
- XOR-based for efficient incremental updates (future enhancement)

**Node Tracking**:
- `nodesEvaluated`: Cumulative count for entire game
- `lastMoveNodesEvaluated`: Count for most recent AI move
- Displayed in status area and game over dialog

## Chess Piece Rendering

**On the Board**:
- All pieces use solid Unicode chess characters (♚♛♜♝♞♟)
- White pieces styled with `color: #ffffff`
- Black pieces styled with `color: #000000`
- Classes `.piece-white` and `.piece-black` with `!important`

**In Move History and Captured Pieces**:
- White's moves use hollow pieces (♔♕♖♗♘♙)
- Black's moves use solid pieces (♚♛♜♝♞♟)

## Mobile Responsiveness

The application includes full mobile support with:
- **Mobile Header**: Sticky header with menu button, title, info button, game info, status, New Game
- **Mobile Menu**: Shows move history only (simplified)
- **New Game Dialog**: Same dialog works on mobile (responsive width)
- **Touch Optimizations**: Proper touch targets and tap highlight prevention
- **Responsive Layout**: Board and controls adapt to screen size

## Modifying the Game

**To adjust AI strength** (in `js/ai.js`):
- Modify piece values in `evaluateBoard()`
- Adjust piece-square tables
- Modify mobility weight calculation

**To customize appearance** (in `css/style.css`):
- Board colors: `.square.light` and `.square.dark` classes
- Piece size: `.square` font-size
- Highlight colors: `.selected`, `.legal-move` classes

## Known Behaviors

- Legal moves always shown when piece selected (no toggle)
- AI auto-promotes pawns to queen
- Move arrows fade after 4 seconds with smooth CSS transition
- AI thinking indicator shows current depth during calculation
- Position evaluation capped at ±2000 centipawns for display
- Undo reverts 2 moves to return player to their turn (disabled in watch mode)
- Hint arrows shown as red dotted lines, fade out after timeout
- AI vs AI starts automatically when you click Start Game in dialog
- Clicking New Game during AI vs AI pauses the match; Cancel resumes it
- AI positions evaluated shown after each AI move and at game end
- Game over dialog auto-closes after 2 seconds
- Transposition table cleared on new game
- All AI delays set to 0 for instant responsiveness
- Default AI difficulty is Medium (depth 3)
