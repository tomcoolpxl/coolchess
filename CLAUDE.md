# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a browser-based chess game implemented as a single HTML file (`index.html`) with embedded CSS and JavaScript. The game features:
- Full chess rules implementation (castling, en passant, pawn promotion, 50-move rule, threefold repetition)
- AI opponent using minimax algorithm with alpha-beta pruning
- Three game modes: Player vs Player, Player vs AI, AI vs AI (watch mode)
- Position evaluation with visual evaluation bar
- Opening book for common opening moves (11 pre-programmed moves)
- Info dialog explaining how the AI works
- Smart undo that reverts 2 moves (opponent + yours)

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
- `drawMoveArrow()`: Draws SVG arrow showing last move
- `highlightLegalMoves()`: Highlights valid moves for selected piece

**UI Controls**:
- `newGame()`: Start a new game
- `undoMove()`: Undoes 2 moves (opponent + yours) to return to your turn
- `undoSingleMove()`: Helper that undoes a single move
- `setMode()`: Change game mode
- `getHint()`: Calculate and display suggested move
- `showInfo()`: Opens info dialog explaining how the AI works
- `closeInfo()`: Closes info dialog

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
- White's first move: 4 options (e4, d4, c3, Nf3)
- Black's response to e4: 4 options (e5, c5, e6, c6)
- Black's response to d4: 3 options (d5, Nf6, f6)

## Chess Piece Rendering

Pieces are displayed using Unicode chess characters (♔♕♖♗♘♙ / ♚♛♜♝♞♟) with simple styling.

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

## Known Behaviors

- AI auto-promotes pawns to queen
- Move arrows fade after 4 seconds
- AI thinking indicator shows current depth during calculation
- Position evaluation capped at ±2000 centipawns for display
- Undo reverts 2 moves to return player to their turn
