// ============================================================================
// CONSTANTS - Shared constants for the chess game
// ============================================================================

// Chess pieces Unicode characters (solid)
const PIECES = {
    'K': '♚', 'Q': '♛', 'R': '♜', 'B': '♝', 'N': '♞', 'P': '♟',
    'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
};

// Chess pieces Unicode characters (hollow - used for move history)
const PIECES_HOLLOW = {
    'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
    'k': '♔', 'q': '♕', 'r': '♖', 'b': '♗', 'n': '♘', 'p': '♙'
};

// Timing constants (in milliseconds)
const ARROW_FADE_DELAY = 4000;        // Time before move arrow starts fading
const ARROW_FADE_DURATION = 500;      // Duration of fade animation
const HINT_ARROW_DISPLAY_TIME = 1500; // Time hint arrow is shown
const GAME_OVER_DIALOG_DELAY = 2000;  // Time game over dialog is shown
const AI_MOVE_DELAY = 500;            // Delay before AI makes a move
const AI_WATCH_DELAY = 1000;          // Delay between AI moves in watch mode
const AI_THINKING_MIN_DISPLAY = 300;  // Minimum display time for thinking indicator

// Opening book - common opening moves
const openingBook = {
    'start': [
        { from: { row: 6, col: 4 }, to: { row: 4, col: 4 } }, // e4
        { from: { row: 6, col: 3 }, to: { row: 4, col: 3 } }, // d4
        { from: { row: 6, col: 2 }, to: { row: 4, col: 2 } }, // c4 (English Opening)
        { from: { row: 7, col: 6 }, to: { row: 5, col: 5 } }  // Nf3
    ],
    'e2e4': [
        { from: { row: 1, col: 4 }, to: { row: 3, col: 4 } }, // e5
        { from: { row: 1, col: 2 }, to: { row: 3, col: 2 } }, // c5 (Sicilian)
        { from: { row: 1, col: 4 }, to: { row: 2, col: 4 } }, // e6 (French)
        { from: { row: 1, col: 2 }, to: { row: 2, col: 2 } }  // c6 (Caro-Kann)
    ],
    'd2d4': [
        { from: { row: 1, col: 3 }, to: { row: 3, col: 3 } }, // d5
        { from: { row: 0, col: 6 }, to: { row: 2, col: 5 } }, // Nf6
        { from: { row: 1, col: 5 }, to: { row: 3, col: 5 } }  // f5 (Dutch)
    ]
};
