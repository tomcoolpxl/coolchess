# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a browser-based chess game implemented as a single HTML file (`index.html`) with embedded CSS and JavaScript. The game features:
- Full chess rules implementation (castling, en passant, pawn promotion, 50-move rule, threefold repetition)
- AI opponent using minimax algorithm with alpha-beta pruning
- Three game modes: Player vs Player, Player vs AI, AI vs AI (watch mode with start/pause/stop controls)
- Position evaluation with visual evaluation bar
- Opening book for common opening moves (11 pre-programmed moves)
- Info dialog explaining how the AI works
- Smart undo that reverts 2 moves (opponent + yours)
- Hint feature with visual arrow showing suggested move
- Auto-hiding game over dialog

## Running the Application

Simply open `index.html` in any modern web browser. No build process, server, or dependencies required.

## Architecture

### Single-File Structure

The entire application is contained in `index.html` with three main sections:

1. **CSS**: All styling including board layout, pieces, animations, dialogs, info panel
2. **HTML**: DOM structure with:
   - Board container with chessboard and evaluation bar
   - Controls below board (undo, hint, captured pieces)
   - Sidebar with title, game status, mode selection, AI difficulty, settings
   - Dialogs (promotion, game over, info)
3. **JavaScript**: Game logic, AI, rendering, UI controls

### Layout Structure

- **Main Board Area**: 8x8 chessboard with coordinate labels and evaluation bar
- **Below Board Controls**: Quick actions (undo, hint) and captured pieces display
- **Sidebar**: Game status, mode selection, AI difficulty settings, new game button
- **Info Button**: In sidebar title, opens dialog explaining minimax and opening book
- **Watch Mode Controls**: Start/Pause/Resume/Stop buttons for AI vs AI matches (separate difficulty selectors for White and Black AI)

### Core Game State

The game state is managed through global variables:
- `board`: 8x8 array representing the chessboard
- `currentPlayer`: 'white' or 'black'
- `gameMode`: 'pvp', 'ai', or 'watch'
- `moveHistory`: Array of move objects for undo functionality
- `castlingRights`: Tracks castling availability for both sides
- `enPassantTarget`: Tracks en passant capture opportunity
- `halfMoveClock`: For 50-move rule
- `positionHistory`: For threefold repetition detection
- `watchMatchRunning`: Controls AI vs AI match state (running/paused)
- `aiDifficultyWhite`/`aiDifficultyBlack`: Separate difficulty settings for watch mode
- `arrowFadeTimeout`/`arrowRemovalTimeout`: Manage move arrow fade animations
- `gameOverDialogTimeout`: Controls auto-hide of game over dialog
- `isSyncingUI`: Guard flag preventing circular updates between mobile/desktop UI

### Key Functions

**Game Logic**:
- `initGame()`: Initialize/reset game state
- `isValidMove()`: Validates if a move is legal
- `isPieceMovementValid()`: Checks piece-specific movement rules
- `makeMove()`: Executes a move and updates state
- `isInCheck()`: Determines if a player is in check
- `getAllLegalMoves()`: Generates all legal moves for a player
- `checkGameOver()`: Detects checkmate, stalemate, draws

**AI System**:
- `makeAIMove()`: Entry point for AI move generation
- `minimax()`: Minimax algorithm with alpha-beta pruning
  - White maximizes (isMaximizing=true)
  - Black minimizes (isMaximizing=false)
  - Difficulty levels 1-4 control search depth
- `evaluateBoard()`: Position evaluation function
  - Material counting with piece values
  - Piece-square tables for positional evaluation
  - Mobility evaluation (number of legal moves)
  - King safety bonuses/penalties
- `getOpeningBookMove()`: Selects moves from opening book

**Rendering**:
- `renderBoard()`: Renders the chessboard and pieces
- `drawMoveArrow()`: Draws SVG arrow showing last move (orange with fade after 4s)
- `highlightLegalMoves()`: Highlights valid moves for selected piece
- Hint arrows: Red dotted line drawn via `getHint()` with `.hint-arrow` class

**UI Controls**:
- `newGame()`: Start a new game
- `undoMove()`: Undoes 2 moves (opponent + yours) to return to your turn
- `undoSingleMove()`: Helper that undoes a single move
- `setMode()`: Change game mode
- `getHint()`: Calculate and display suggested move with visual arrow
- `showInfo()`: Opens info dialog explaining how the AI works
- `closeInfo()`: Closes info dialog
- `startWatchMatch()`: Start AI vs AI match in watch mode
- `pauseWatchMatch()`: Pause/resume AI vs AI match
- `stopWatchMatch()`: Stop AI vs AI match and reset game

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

### Opening Book

The opening book contains 11 pre-programmed moves that randomize for variety:
- White's first move: 4 options (e4, d4, c4 [English Opening], Nf3)
- Black's response to e4: 4 options (e5, c5, e6, c6)
- Black's response to d4: 3 options (d5, Nf6, f6)

## Chess Piece Rendering

**On the Board**:
- All pieces use solid Unicode chess characters (♚♛♜♝♞♟) for visual consistency
- White pieces are styled with `color: #ffffff` (white)
- Black pieces are styled with `color: #000000` (black)
- Classes `.piece-white` and `.piece-black` control colors with `!important` to override dark mode

**In Move History and Captured Pieces**:
- White's moves use hollow pieces (♔♕♖♗♘♙) in move notation
- Black's moves use solid pieces (♚♛♜♝♞♟) in move notation
- Captured black pieces displayed as hollow, captured white pieces as solid

## Mobile Responsiveness

The application includes full mobile support with:
- **Mobile Header**: Sticky header with menu button, title, and info button
- **Mobile Menu**: Side panel with game mode, difficulty, and settings
- **Real-time Sync**: Desktop and mobile UI elements stay synchronized bidirectionally
- **Touch Optimizations**: Proper touch targets and tap highlight prevention
- **Responsive Layout**: Board and controls adapt to screen size

## Modifying the Game

**To adjust AI strength**:
- Modify piece values in `evaluateBoard()`
- Adjust piece-square tables
- Modify mobility weight calculation

**To add new game modes**:
- Update `setMode()` function
- Add mode handling in `handleSquareClick()`

**To customize appearance**:
- Board colors: `.square.light` and `.square.dark` classes
- Piece size: `.square` font-size
- Highlight colors: `.selected`, `.legal-move` classes

## Bug Fixes & Improvements History

### Core Game Logic
- **Hint Function**: Fixed incorrect hint suggestions for Black player (was maximizing White's position)
- **Position History**: Position history properly cleaned during undo operations
- **Pawn Promotion**: Removed duplicate position tracking and move counter increments during promotion
- **Castling Validation**: Fixed path checking and king-through-check validation logic
- **En Passant Undo**: En passant captures properly tracked and restored during undo
- **Castling Undo**: Castling moves fully tracked (rook position restored via board state)
- **Rook Capture**: Castling rights properly updated when rooks are captured
- **Minimax State**: Special game state (castling rights, en passant) saved/restored in minimax search

### UI/UX Enhancements
- **Hint Arrow**: Visual red dotted line arrow showing suggested move
- **Move Arrows**: Smooth fade-out transition with proper timeout handling
- **Game Over Dialog**: Auto-hides after brief display, repositioned to top of screen
- **Hollow Pieces**: White moves/captured pieces use hollow Unicode characters for differentiation
- **AI Thinking**: Smoother fade transitions for thinking indicator

### Watch Mode (AI vs AI)
- **Match Controls**: Start/Pause/Resume/Stop buttons for controlling AI matches
- **Separate Difficulty**: Independent difficulty settings for White and Black AI
- **Mobile Controls**: Full watch mode controls available on mobile

### Mobile Enhancements
- **Bidirectional Sync**: Mobile and desktop UI elements properly synchronized in both directions
- **Real-time History**: Move history updates in real-time on both desktop and mobile
- **Touch Targets**: Proper button sizes (min 44px) and touch action handling
- **Mobile AI Thinking**: Dedicated mobile thinking indicator with fade transition

### Accessibility
- **ARIA Labels**: Added to all interactive buttons for screen reader support
- **Info Button**: Circular "i" button with consistent rendering across platforms

## Known Behaviors

- AI auto-promotes pawns to queen
- Move arrows fade after 4 seconds with smooth CSS transition
- AI thinking indicator shows current depth during calculation
- Position evaluation capped at ±2000 centipawns for display
- Undo reverts 2 moves to return player to their turn (disabled in watch mode)
- Game over dialog auto-hides after a short delay
- Hint arrows shown as red dotted lines, fade out after timeout
- Watch mode requires clicking "Start Match" to begin AI vs AI play
- Watch mode can be paused/resumed or stopped entirely
