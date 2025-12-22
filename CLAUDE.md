# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a browser-based chess game implemented as a single HTML file (`chess.html`) with embedded CSS and JavaScript. The game features:
- Full chess rules implementation (castling, en passant, pawn promotion, 50-move rule, threefold repetition)
- AI opponent using minimax algorithm with alpha-beta pruning
- Three game modes: Player vs Player, Player vs AI, AI vs AI (watch mode)
- Position evaluation with visual evaluation bar
- Opening book for common opening moves

## Running the Application

Simply open `chess.html` in any modern web browser. No build process, server, or dependencies required.

## Architecture

### Single-File Structure

The entire application is contained in `chess.html` with three main sections:

1. **CSS (lines 7-502)**: All styling including board layout, pieces, animations, dialogs
2. **HTML (lines 504-625)**: DOM structure for board, sidebar panels, dialogs, overlays
3. **JavaScript (lines 627-1882)**: Game logic, AI, rendering

### Core Game State

The game state is managed through global variables (lines 635-654):
- `board`: 8x8 array representing the chessboard
- `currentPlayer`: 'white' or 'black'
- `gameMode`: 'pvp', 'ai', or 'watch'
- `moveHistory`: Array of move objects for undo functionality
- `castlingRights`: Tracks castling availability for both sides
- `enPassantTarget`: Tracks en passant capture opportunity
- `halfMoveClock`: For 50-move rule
- `positionHistory`: For threefold repetition detection

### Key Functions

**Game Logic (lines 678-1256)**:
- `initGame()`: Initialize/reset game state (line 678)
- `isValidMove()`: Validates if a move is legal (line 932)
- `isPieceMovementValid()`: Checks piece-specific movement rules (line 965)
- `makeMove()`: Executes a move and updates state (line 1093)
- `isInCheck()`: Determines if a player is in check (line 1225)
- `getAllLegalMoves()`: Generates all legal moves for a player (line 1260)
- `checkGameOver()`: Detects checkmate, stalemate, draws (line 1286)

**AI System (lines 1458-1763)**:
- `makeAIMove()`: Entry point for AI move generation (line 1458)
- `minimax()`: Minimax algorithm with alpha-beta pruning (line 1548)
  - White maximizes (isMaximizing=true)
  - Black minimizes (isMaximizing=false)
  - Difficulty levels 1-4 control search depth
- `evaluateBoard()`: Position evaluation function (line 1636)
  - Material counting with piece values
  - Piece-square tables for positional evaluation
  - Mobility evaluation (number of legal moves)
  - King safety bonuses/penalties
- `getOpeningBookMove()`: Selects moves from opening book (line 1529)

**Rendering (lines 717-843)**:
- `renderBoard()`: Renders the chessboard and pieces (line 717)
- `drawMoveArrow()`: Draws SVG arrow showing last move (line 780)
- `highlightLegalMoves()`: Highlights valid moves for selected piece (line 892)

**UI Controls (lines 1789-1878)**:
- `newGame()`: Start a new game (line 1789)
- `undoMove()`: Undo the last move (line 1795)
- `setMode()`: Change game mode (line 1841)
- `getHint()`: Calculate and display suggested move (line 1766)

### Chess Rules Implementation

**Special Moves**:
- Castling: Validated in `canCastle()` (line 1055), executed in `makeMove()` (line 1141)
- En passant: Validated in `isPieceMovementValid()` (line 991), executed in `makeMove()` (line 1119)
- Pawn promotion: Handled with modal dialog in `showPromotionDialog()` (line 1362)

**Game Ending Conditions**:
- Checkmate/Stalemate: Detected by checking if player has no legal moves (line 1316)
- 50-move rule: Tracked via `halfMoveClock` (line 1293)
- Threefold repetition: Tracked via `positionHistory` (line 1303)

### AI Difficulty Levels

Search depth controls difficulty:
- Depth 1: Beginner (looks 1 move ahead)
- Depth 2: Easy (looks 2 moves ahead)
- Depth 3: Medium (looks 3 moves ahead)
- Depth 4: Hard (looks 4 moves ahead)

Opening book (lines 657-675) provides variety in the first few moves.

## Modifying the Game

**To adjust AI strength**:
- Modify piece values in `evaluateBoard()` (line 1637-1640)
- Adjust piece-square tables (lines 1643-1707)
- Modify mobility weight (line 1756)

**To add new game modes**:
- Update `setMode()` function (line 1841)
- Add mode handling in `handleSquareClick()` (line 846)

**To customize appearance**:
- Board colors: `.square.light` and `.square.dark` classes (lines 61-67)
- Piece size: `.square` font-size (line 55)
- Highlight colors: `.selected`, `.legal-move` classes (lines 69-96)

## Known Behaviors

- AI auto-promotes pawns to queen (line 1509)
- Move arrows fade after 4 seconds (line 812)
- AI thinking indicator shows current depth during calculation (line 1488)
- Position evaluation capped at ±2000 centipawns for display (line 1432)
