// ============================================================================
// CONSTANTS - Shared constants for the chess game
// ============================================================================

// Zobrist hashing tables for transposition table
const ZOBRIST = {
    pieces: [], // [64][12] random 32-bit integers
    castling: [], // [4] for each castling right
    enPassant: [], // [8] for each file
    side: 0 // XOR when black to move
};

// Piece to index mapping for Zobrist hashing
const PIECE_INDEX = {
    'P': 0, 'N': 1, 'B': 2, 'R': 3, 'Q': 4, 'K': 5,
    'p': 6, 'n': 7, 'b': 8, 'r': 9, 'q': 10, 'k': 11
};

// Initialize Zobrist hash tables with random values
(function initZobrist() {
    // Use a seeded pseudo-random number generator for reproducibility
    let seed = 12345;
    function random32() {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const high = seed;
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const low = seed;
        return ((high << 16) | (low & 0xffff)) >>> 0;
    }

    for (let sq = 0; sq < 64; sq++) {
        ZOBRIST.pieces[sq] = [];
        for (let p = 0; p < 12; p++) {
            ZOBRIST.pieces[sq][p] = random32();
        }
    }
    for (let i = 0; i < 4; i++) {
        ZOBRIST.castling[i] = random32();
    }
    for (let i = 0; i < 8; i++) {
        ZOBRIST.enPassant[i] = random32();
    }
    ZOBRIST.side = random32();
})();

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
const AI_MOVE_DELAY = 0;            // Delay before AI makes a move
const AI_WATCH_DELAY = 0;          // Delay between AI moves in watch mode
const AI_THINKING_MIN_DISPLAY = 0;  // Minimum display time for thinking indicator

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
