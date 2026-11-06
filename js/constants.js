// ============================================================================
// CONSTANTS - Shared constants for the chess game
// ============================================================================

// Zobrist hashing tables for transposition table (64-bit via dual 32-bit unsigned ints)
const ZOBRIST = {
    pieces: [],    // [64][12] { lo, hi } random 32-bit integers
    castling: [],  // [4] { lo, hi } for each castling right
    enPassant: [], // [8] { lo, hi } for each file
    side: { lo: 0, hi: 0 } // XOR when black to move
};

// Piece to index mapping for Zobrist hashing
const PIECE_INDEX = {
    'P': 0, 'N': 1, 'B': 2, 'R': 3, 'Q': 4, 'K': 5,
    'p': 6, 'n': 7, 'b': 8, 'r': 9, 'q': 10, 'k': 11
};

// Initialize Zobrist hash tables with seeded 64-bit random values (lo, hi)
(function initZobrist() {
    let seed = 12345;
    function random32() {
        seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
        const high = seed;
        seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
        const low = seed;
        return ((high << 16) | (low & 0xffff)) >>> 0;
    }

    function random64() {
        return { lo: random32(), hi: random32() };
    }

    for (let sq = 0; sq < 64; sq++) {
        ZOBRIST.pieces[sq] = [];
        for (let p = 0; p < 12; p++) {
            ZOBRIST.pieces[sq][p] = random64();
        }
    }
    for (let i = 0; i < 4; i++) {
        ZOBRIST.castling[i] = random64();
    }
    for (let i = 0; i < 8; i++) {
        ZOBRIST.enPassant[i] = random64();
    }
    ZOBRIST.side = random64();
})();

// Chess pieces Unicode characters (solid)
const PIECES = {
    'K': '♚', 'Q': '♛', 'R': '♜', 'B': '♝', 'N': '♞', 'P': '♟',
    'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
};

// Chess pieces Unicode characters (hollow - used for move history & captured white pieces)
const PIECES_HOLLOW = {
    'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
    'k': '♔', 'q': '♕', 'r': '♖', 'b': '♗', 'n': '♘', 'p': '♙'
};

// Standard material values for sorting captured pieces and display
const CAPTURE_SORT_ORDER = {
    'q': 1, 'Q': 1,
    'r': 2, 'R': 2,
    'b': 3, 'B': 3,
    'n': 4, 'N': 4,
    'p': 5, 'P': 5
};

// Timing constants (in milliseconds)
const ARROW_FADE_DELAY = 4000;        // Time before move arrow starts fading
const ARROW_FADE_DURATION = 500;      // Duration of fade animation
const HINT_ARROW_DISPLAY_TIME = 1500; // Time hint arrow is shown
const GAME_OVER_DIALOG_DELAY = 2000;  // Kept for backward reference
const AI_MOVE_DELAY = 0;              // Delay before AI makes a move in Player vs AI
const AI_WATCH_DELAY = 0;             // Zero delay for fast AI vs AI autobattler mode
const AI_THINKING_MIN_DISPLAY = 0;    // Minimum display time for thinking indicator

// Opening book - common opening moves across the first 2-3 moves
const openingBook = {
    // Move 1 (White)
    'start': [
        { from: { row: 6, col: 4 }, to: { row: 4, col: 4 } }, // 1. e4
        { from: { row: 6, col: 3 }, to: { row: 4, col: 3 } }, // 1. d4
        { from: { row: 6, col: 2 }, to: { row: 4, col: 2 } }, // 1. c4 (English Opening)
        { from: { row: 7, col: 6 }, to: { row: 5, col: 5 } }  // 1. Nf3 (Réti Opening)
    ],
    // Move 1 (Black responses)
    'e2e4': [
        { from: { row: 1, col: 4 }, to: { row: 3, col: 4 } }, // 1... e5
        { from: { row: 1, col: 2 }, to: { row: 3, col: 2 } }, // 1... c5 (Sicilian Defense)
        { from: { row: 1, col: 4 }, to: { row: 2, col: 4 } }, // 1... e6 (French Defense)
        { from: { row: 1, col: 2 }, to: { row: 2, col: 2 } }  // 1... c6 (Caro-Kann Defense)
    ],
    'd2d4': [
        { from: { row: 1, col: 3 }, to: { row: 3, col: 3 } }, // 1... d5
        { from: { row: 0, col: 6 }, to: { row: 2, col: 5 } }, // 1... Nf6 (Indian Defense)
        { from: { row: 1, col: 5 }, to: { row: 3, col: 5 } }  // 1... f5 (Dutch Defense)
    ],
    'c2c4': [
        { from: { row: 1, col: 4 }, to: { row: 3, col: 4 } }, // 1... e5 (Reversed Sicilian)
        { from: { row: 1, col: 2 }, to: { row: 3, col: 2 } }, // 1... c5 (Symmetrical English)
        { from: { row: 0, col: 6 }, to: { row: 2, col: 5 } }  // 1... Nf6
    ],
    'g1f3': [
        { from: { row: 1, col: 3 }, to: { row: 3, col: 3 } }, // 1... d5
        { from: { row: 0, col: 6 }, to: { row: 2, col: 5 } }, // 1... Nf6
        { from: { row: 1, col: 2 }, to: { row: 3, col: 2 } }  // 1... c5
    ],
    // Move 2 (White continuations)
    'e2e4,e7e5': [
        { from: { row: 7, col: 6 }, to: { row: 5, col: 5 } }, // 2. Nf3
        { from: { row: 7, col: 5 }, to: { row: 4, col: 2 } }, // 2. Bc4 (Italian)
        { from: { row: 7, col: 1 }, to: { row: 5, col: 2 } }  // 2. Nc3 (Vienna)
    ],
    'e2e4,c7c5': [
        { from: { row: 7, col: 6 }, to: { row: 5, col: 5 } }, // 2. Nf3 (Open Sicilian)
        { from: { row: 7, col: 1 }, to: { row: 5, col: 2 } }  // 2. Nc3 (Closed Sicilian)
    ],
    'e2e4,e7e6': [
        { from: { row: 6, col: 3 }, to: { row: 4, col: 3 } }  // 2. d4 (French main line)
    ],
    'e2e4,c7c6': [
        { from: { row: 6, col: 3 }, to: { row: 4, col: 3 } }  // 2. d4 (Caro-Kann main line)
    ],
    'd2d4,d7d5': [
        { from: { row: 6, col: 2 }, to: { row: 4, col: 2 } }, // 2. c4 (Queen's Gambit)
        { from: { row: 7, col: 6 }, to: { row: 5, col: 5 } }  // 2. Nf3
    ],
    'd2d4,g8f6': [
        { from: { row: 6, col: 2 }, to: { row: 4, col: 2 } }, // 2. c4
        { from: { row: 7, col: 6 }, to: { row: 5, col: 5 } }  // 2. Nf3
    ],
    'd2d4,f7f5': [
        { from: { row: 6, col: 2 }, to: { row: 4, col: 2 } }, // 2. c4
        { from: { row: 7, col: 6 }, to: { row: 5, col: 5 } }  // 2. Nf3
    ],
    'c2c4,e7e5': [
        { from: { row: 7, col: 1 }, to: { row: 5, col: 2 } }, // 2. Nc3
        { from: { row: 6, col: 6 }, to: { row: 5, col: 6 } }  // 2. g3
    ],
    'c2c4,c7c5': [
        { from: { row: 7, col: 1 }, to: { row: 5, col: 2 } }, // 2. Nc3
        { from: { row: 7, col: 6 }, to: { row: 5, col: 5 } }  // 2. Nf3
    ],
    'c2c4,g8f6': [
        { from: { row: 7, col: 1 }, to: { row: 5, col: 2 } }, // 2. Nc3
        { from: { row: 6, col: 3 }, to: { row: 4, col: 3 } }  // 2. d4
    ],
    'g1f3,d7d5': [
        { from: { row: 6, col: 3 }, to: { row: 4, col: 3 } }, // 2. d4
        { from: { row: 6, col: 2 }, to: { row: 4, col: 2 } }  // 2. c4
    ],
    'g1f3,g8f6': [
        { from: { row: 6, col: 2 }, to: { row: 4, col: 2 } }, // 2. c4
        { from: { row: 6, col: 3 }, to: { row: 4, col: 3 } }  // 2. d4
    ],
    'g1f3,c7c5': [
        { from: { row: 6, col: 2 }, to: { row: 4, col: 2 } }, // 2. c4
        { from: { row: 6, col: 4 }, to: { row: 4, col: 4 } }  // 2. e4
    ],
    // Move 2 (Black responses)
    'e2e4,e7e5,g1f3': [
        { from: { row: 0, col: 1 }, to: { row: 2, col: 2 } }, // 2... Nc6
        { from: { row: 0, col: 6 }, to: { row: 2, col: 5 } }  // 2... Nf6 (Petrov)
    ],
    'e2e4,c7c5,g1f3': [
        { from: { row: 1, col: 3 }, to: { row: 2, col: 3 } }, // 2... d6
        { from: { row: 0, col: 1 }, to: { row: 2, col: 2 } }, // 2... Nc6
        { from: { row: 1, col: 4 }, to: { row: 2, col: 4 } }  // 2... e6
    ],
    'e2e4,e7e6,d2d4': [
        { from: { row: 1, col: 3 }, to: { row: 3, col: 3 } }  // 2... d5
    ],
    'e2e4,c7c6,d2d4': [
        { from: { row: 1, col: 3 }, to: { row: 3, col: 3 } }  // 2... d5
    ],
    'd2d4,d7d5,c2c4': [
        { from: { row: 1, col: 4 }, to: { row: 2, col: 4 } }, // 2... e6 (QGD)
        { from: { row: 1, col: 2 }, to: { row: 2, col: 2 } }  // 2... c6 (Slav)
    ],
    'd2d4,g8f6,c2c4': [
        { from: { row: 1, col: 4 }, to: { row: 2, col: 4 } }, // 2... e6
        { from: { row: 1, col: 6 }, to: { row: 2, col: 6 } }  // 2... g6 (King's Indian)
    ]
};
