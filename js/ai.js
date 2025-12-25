// ============================================================================
// AI - Minimax algorithm and position evaluation
// ============================================================================

// AI difficulty settings (global)
let aiDifficulty = 3;
let aiDifficultyWhite = 3;
let aiDifficultyBlack = 3;

// ============================================================================
// Transposition Table
// ============================================================================
const TT_SIZE = 1 << 20; // ~1M entries
const transpositionTable = new Array(TT_SIZE);

// Entry flags
const TT_EXACT = 0;
const TT_ALPHA = 1; // Upper bound (failed low)
const TT_BETA = 2;  // Lower bound (failed high)

function ttStore(hash, depth, score, flag, bestMove) {
    const index = hash % TT_SIZE;
    // Replace if deeper or same depth (always-replace scheme)
    const existing = transpositionTable[index];
    if (!existing || existing.depth <= depth) {
        transpositionTable[index] = { hash, depth, score, flag, bestMove };
    }
}

function ttLookup(hash, depth, alpha, beta) {
    const index = hash % TT_SIZE;
    const entry = transpositionTable[index];
    if (entry && entry.hash === hash) {
        // Return best move for move ordering even if depth is insufficient
        const result = { bestMove: entry.bestMove };

        if (entry.depth >= depth) {
            if (entry.flag === TT_EXACT) {
                result.score = entry.score;
                result.cutoff = true;
            } else if (entry.flag === TT_ALPHA && entry.score <= alpha) {
                result.score = alpha;
                result.cutoff = true;
            } else if (entry.flag === TT_BETA && entry.score >= beta) {
                result.score = beta;
                result.cutoff = true;
            }
        }
        return result;
    }
    return null;
}

function ttClear() {
    for (let i = 0; i < TT_SIZE; i++) {
        transpositionTable[i] = undefined;
    }
}

// ============================================================================
// Move Ordering - MVV-LVA (Most Valuable Victim - Least Valuable Attacker)
// ============================================================================
const MVV_LVA_VALUES = {
    'p': 1, 'P': 1,
    'n': 3, 'N': 3,
    'b': 3, 'B': 3,
    'r': 5, 'R': 5,
    'q': 9, 'Q': 9,
    'k': 100, 'K': 100
};

function orderMoves(moves, ttBestMove) {
    return moves.sort((a, b) => {
        // TT best move first
        if (ttBestMove) {
            const aIsTT = a.from.row === ttBestMove.from.row && a.from.col === ttBestMove.from.col &&
                         a.to.row === ttBestMove.to.row && a.to.col === ttBestMove.to.col;
            const bIsTT = b.from.row === ttBestMove.from.row && b.from.col === ttBestMove.from.col &&
                         b.to.row === ttBestMove.to.row && b.to.col === ttBestMove.to.col;
            if (aIsTT) return -1;
            if (bIsTT) return 1;
        }

        const victimA = board[a.to.row][a.to.col];
        const victimB = board[b.to.row][b.to.col];

        // Captures first, ordered by MVV-LVA
        if (victimA && victimB) {
            const attackerA = board[a.from.row][a.from.col];
            const attackerB = board[b.from.row][b.from.col];
            const scoreA = MVV_LVA_VALUES[victimA] * 10 - MVV_LVA_VALUES[attackerA];
            const scoreB = MVV_LVA_VALUES[victimB] * 10 - MVV_LVA_VALUES[attackerB];
            return scoreB - scoreA; // Higher score first
        }
        if (victimA) return -1; // a is capture, goes first
        if (victimB) return 1;  // b is capture, goes first
        return 0; // Both non-captures, keep order
    });
}

// AI Move using Minimax algorithm
function makeAIMove() {
    if (gameOver) return;

    // Check opening book first
    if (fullMoveNumber <= 3) {
        const bookMove = getOpeningBookMove();
        if (bookMove) {
            executeMoveWithUI(bookMove.from.row, bookMove.from.col,
                    bookMove.to.row, bookMove.to.col,
                    bookMove.promotion);

            if (gameMode === 'watch' && watchMatchRunning && !gameOver) {
                setTimeout(() => {
                    if (!gameOver && watchMatchRunning) makeAIMove();
                }, AI_WATCH_DELAY);
            }
            return;
        }
    }

    // Determine which difficulty to use
    let currentDifficulty = aiDifficulty;
    if (gameMode === 'watch') {
        currentDifficulty = currentPlayer === 'white' ? aiDifficultyWhite : aiDifficultyBlack;
    }

    // Show thinking indicator
    showAIThinking(currentDifficulty);

    // Use setTimeout to let the UI update before blocking
    setTimeout(() => {
        const startTime = Date.now();
        // CRITICAL: White maximizes (true), Black minimizes (false)
        const isMaximizing = currentPlayer === 'white';
        const bestMove = minimax(currentDifficulty, currentPlayer, -Infinity, Infinity, isMaximizing);

        // Ensure minimum display time for thinking indicator
        const elapsed = Date.now() - startTime;
        const delayNeeded = Math.max(0, AI_THINKING_MIN_DISPLAY - elapsed);

        setTimeout(() => {
            // Hide thinking indicator
            hideAIThinking();

            if (bestMove.move) {
                // Check if it's a pawn promotion
                const piece = board[bestMove.move.from.row][bestMove.move.from.col];
                let promotionPiece = null;
                if (piece && piece.toLowerCase() === 'p') {
                    const toRow = bestMove.move.to.row;
                    if (toRow === 0 || toRow === 7) {
                        promotionPiece = currentPlayer === 'white' ? 'Q' : 'q';
                    }
                }

                executeMoveWithUI(bestMove.move.from.row, bestMove.move.from.col,
                        bestMove.move.to.row, bestMove.move.to.col,
                        promotionPiece);

                if (gameMode === 'watch' && watchMatchRunning && !gameOver) {
                    setTimeout(() => {
                        if (!gameOver && watchMatchRunning) makeAIMove();
                    }, AI_WATCH_DELAY);
                }
            }
        }, delayNeeded);
    }, 50);
}

// Get move from opening book
function getOpeningBookMove() {
    if (moveHistory.length === 0 && currentPlayer === 'white') {
        const moves = openingBook['start'];
        return moves[Math.floor(Math.random() * moves.length)];
    }

    if (moveHistory.length === 1 && currentPlayer === 'black') {
        const lastMoveData = moveHistory[0];
        const key = `${String.fromCharCode(97 + lastMoveData.from.col)}${8 - lastMoveData.from.row}${String.fromCharCode(97 + lastMoveData.to.col)}${8 - lastMoveData.to.row}`;
        const moves = openingBook[key];
        if (moves) {
            return moves[Math.floor(Math.random() * moves.length)];
        }
    }

    return null;
}

// Simulate a move for minimax search (handles special moves)
function simulateMoveForMinimax(move, player) {
    const piece = board[move.from.row][move.from.col];
    const pieceType = piece.toLowerCase();
    const fromRow = move.from.row;
    const fromCol = move.from.col;
    const toRow = move.to.row;
    const toCol = move.to.col;
    const capturedPiece = board[toRow][toCol];

    // Handle en passant capture
    if (pieceType === 'p' && enPassantTarget &&
        toRow === enPassantTarget.row && toCol === enPassantTarget.col) {
        const capturedPawnRow = player === 'white' ? toRow + 1 : toRow - 1;
        board[capturedPawnRow][toCol] = '';
    }

    // Handle castling - move rook
    if (pieceType === 'k' && Math.abs(toCol - fromCol) === 2) {
        const isKingside = toCol > fromCol;
        const rookFromCol = isKingside ? 7 : 0;
        const rookToCol = isKingside ? toCol - 1 : toCol + 1;
        board[fromRow][rookToCol] = board[fromRow][rookFromCol];
        board[fromRow][rookFromCol] = '';
    }

    // Move the piece
    board[toRow][toCol] = piece;
    board[fromRow][fromCol] = '';

    // Handle pawn promotion (auto-queen for AI)
    if (pieceType === 'p' && (toRow === 0 || toRow === 7)) {
        board[toRow][toCol] = player === 'white' ? 'Q' : 'q';
    }

    // Update en passant target
    if (pieceType === 'p' && Math.abs(toRow - fromRow) === 2) {
        enPassantTarget = { row: (fromRow + toRow) / 2, col: toCol };
    } else {
        enPassantTarget = null;
    }

    // Update castling rights
    if (pieceType === 'k') {
        if (player === 'white') {
            castlingRights.white.kingside = false;
            castlingRights.white.queenside = false;
        } else {
            castlingRights.black.kingside = false;
            castlingRights.black.queenside = false;
        }
    }
    if (pieceType === 'r') {
        if (player === 'white') {
            if (fromCol === 0 && fromRow === 7) castlingRights.white.queenside = false;
            if (fromCol === 7 && fromRow === 7) castlingRights.white.kingside = false;
        } else {
            if (fromCol === 0 && fromRow === 0) castlingRights.black.queenside = false;
            if (fromCol === 7 && fromRow === 0) castlingRights.black.kingside = false;
        }
    }

    // Update castling rights when rook is captured
    if (capturedPiece && capturedPiece.toLowerCase() === 'r') {
        if (toRow === 7 && toCol === 0) castlingRights.white.queenside = false;
        if (toRow === 7 && toCol === 7) castlingRights.white.kingside = false;
        if (toRow === 0 && toCol === 0) castlingRights.black.queenside = false;
        if (toRow === 0 && toCol === 7) castlingRights.black.kingside = false;
    }
}

// Minimax algorithm with alpha-beta pruning, transposition table, and move ordering
function minimax(depth, player, alpha, beta, isMaximizing) {
    const originalAlpha = alpha;
    const hash = computeHash();

    // Transposition table lookup
    const ttHit = ttLookup(hash, depth, alpha, beta);
    if (ttHit && ttHit.cutoff) {
        return { score: ttHit.score, move: ttHit.bestMove };
    }

    if (depth === 0) {
        return { score: evaluateBoard() };
    }

    let moves = getAllLegalMoves(player);

    if (moves.length === 0) {
        const originalPlayer = currentPlayer;
        currentPlayer = player;
        if (isInCheck(player)) {
            currentPlayer = originalPlayer;
            return { score: isMaximizing ? -10000 : 10000 };
        }
        currentPlayer = originalPlayer;
        return { score: 0 }; // Stalemate
    }

    // Order moves for better pruning (TT best move first, then captures by MVV-LVA)
    const ttBestMove = ttHit ? ttHit.bestMove : null;
    moves = orderMoves(moves, ttBestMove);

    let bestMove = null;

    if (isMaximizing) {
        let maxScore = -Infinity;

        for (const move of moves) {
            // Save game state
            const originalBoard = JSON.parse(JSON.stringify(board));
            const originalCurrentPlayer = currentPlayer;
            const originalCastlingRights = JSON.parse(JSON.stringify(castlingRights));
            const originalEnPassantTarget = enPassantTarget ? { ...enPassantTarget } : null;

            try {
                currentPlayer = player;
                simulateMoveForMinimax(move, player);

                const nextPlayer = player === 'white' ? 'black' : 'white';
                const result = minimax(depth - 1, nextPlayer, alpha, beta, false);

                if (result.score > maxScore) {
                    maxScore = result.score;
                    bestMove = move;
                }

                alpha = Math.max(alpha, result.score);
                if (beta <= alpha) {
                    break;
                }
            } finally {
                board = originalBoard;
                currentPlayer = originalCurrentPlayer;
                castlingRights = originalCastlingRights;
                enPassantTarget = originalEnPassantTarget;
            }
        }

        // Store in transposition table
        let flag = TT_EXACT;
        if (maxScore <= originalAlpha) {
            flag = TT_ALPHA;
        } else if (maxScore >= beta) {
            flag = TT_BETA;
        }
        ttStore(hash, depth, maxScore, flag, bestMove);

        return { score: maxScore, move: bestMove };
    } else {
        let minScore = Infinity;

        for (const move of moves) {
            // Save game state
            const originalBoard = JSON.parse(JSON.stringify(board));
            const originalCurrentPlayer = currentPlayer;
            const originalCastlingRights = JSON.parse(JSON.stringify(castlingRights));
            const originalEnPassantTarget = enPassantTarget ? { ...enPassantTarget } : null;

            try {
                currentPlayer = player;
                simulateMoveForMinimax(move, player);

                const nextPlayer = player === 'white' ? 'black' : 'white';
                const result = minimax(depth - 1, nextPlayer, alpha, beta, true);

                if (result.score < minScore) {
                    minScore = result.score;
                    bestMove = move;
                }

                beta = Math.min(beta, result.score);
                if (beta <= alpha) {
                    break;
                }
            } finally {
                board = originalBoard;
                currentPlayer = originalCurrentPlayer;
                castlingRights = originalCastlingRights;
                enPassantTarget = originalEnPassantTarget;
            }
        }

        // Store in transposition table
        let flag = TT_EXACT;
        if (minScore >= beta) {
            flag = TT_BETA;
        } else if (minScore <= alpha) {
            flag = TT_ALPHA;
        }
        ttStore(hash, depth, minScore, flag, bestMove);

        return { score: minScore, move: bestMove };
    }
}

// Evaluate board position
function evaluateBoard() {
    const pieceValues = {
        'p': 100, 'n': 320, 'b': 330, 'r': 500, 'q': 900, 'k': 20000,
        'P': 100, 'N': 320, 'B': 330, 'R': 500, 'Q': 900, 'K': 20000
    };

    // Piece-square tables for positional bonuses
    const pawnTable = [
        [0,  0,  0,  0,  0,  0,  0,  0],
        [50, 50, 50, 50, 50, 50, 50, 50],
        [10, 10, 20, 30, 30, 20, 10, 10],
        [5,  5, 10, 25, 25, 10,  5,  5],
        [0,  0,  0, 20, 20,  0,  0,  0],
        [5, -5,-10,  0,  0,-10, -5,  5],
        [5, 10, 10,-20,-20, 10, 10,  5],
        [0,  0,  0,  0,  0,  0,  0,  0]
    ];

    const knightTable = [
        [-50,-40,-30,-30,-30,-30,-40,-50],
        [-40,-20,  0,  0,  0,  0,-20,-40],
        [-30,  0, 10, 15, 15, 10,  0,-30],
        [-30,  5, 15, 20, 20, 15,  5,-30],
        [-30,  0, 15, 20, 20, 15,  0,-30],
        [-30,  5, 10, 15, 15, 10,  5,-30],
        [-40,-20,  0,  5,  5,  0,-20,-40],
        [-50,-40,-30,-30,-30,-30,-40,-50]
    ];

    const bishopTable = [
        [-20,-10,-10,-10,-10,-10,-10,-20],
        [-10,  0,  0,  0,  0,  0,  0,-10],
        [-10,  0,  5, 10, 10,  5,  0,-10],
        [-10,  5,  5, 10, 10,  5,  5,-10],
        [-10,  0, 10, 10, 10, 10,  0,-10],
        [-10, 10, 10, 10, 10, 10, 10,-10],
        [-10,  5,  0,  0,  0,  0,  5,-10],
        [-20,-10,-10,-10,-10,-10,-10,-20]
    ];

    const rookTable = [
        [0,  0,  0,  0,  0,  0,  0,  0],
        [5, 10, 10, 10, 10, 10, 10,  5],
        [-5,  0,  0,  0,  0,  0,  0, -5],
        [-5,  0,  0,  0,  0,  0,  0, -5],
        [-5,  0,  0,  0,  0,  0,  0, -5],
        [-5,  0,  0,  0,  0,  0,  0, -5],
        [-5,  0,  0,  0,  0,  0,  0, -5],
        [0,  0,  0,  5,  5,  0,  0,  0]
    ];

    const queenTable = [
        [-20,-10,-10, -5, -5,-10,-10,-20],
        [-10,  0,  0,  0,  0,  0,  0,-10],
        [-10,  0,  5,  5,  5,  5,  0,-10],
        [-5,  0,  5,  5,  5,  5,  0, -5],
        [0,  0,  5,  5,  5,  5,  0, -5],
        [-10,  5,  5,  5,  5,  5,  0,-10],
        [-10,  0,  5,  0,  0,  0,  0,-10],
        [-20,-10,-10, -5, -5,-10,-10,-20]
    ];

    const kingMiddleGameTable = [
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-20,-30,-30,-40,-40,-30,-30,-20],
        [-10,-20,-20,-20,-20,-20,-20,-10],
        [20, 20,  0,  0,  0,  0, 20, 20],
        [20, 30, 10,  0,  0, 10, 30, 20]
    ];

    function getPieceSquareValue(piece, row, col) {
        const isWhite = piece === piece.toUpperCase();
        const r = isWhite ? row : 7 - row;

        switch(piece.toLowerCase()) {
            case 'p': return pawnTable[r][col];
            case 'n': return knightTable[r][col];
            case 'b': return bishopTable[r][col];
            case 'r': return rookTable[r][col];
            case 'q': return queenTable[r][col];
            case 'k': return kingMiddleGameTable[r][col];
            default: return 0;
        }
    }

    let score = 0;

    // Material and position evaluation
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece) {
                const value = pieceValues[piece];
                const posValue = getPieceSquareValue(piece, row, col);

                if (piece === piece.toUpperCase()) {
                    score += value + posValue;
                } else {
                    score -= value + posValue;
                }
            }
        }
    }

    // Mobility evaluation (number of legal moves)
    const originalPlayer = currentPlayer;

    currentPlayer = 'white';
    const whiteMoves = getAllLegalMoves('white').length;

    currentPlayer = 'black';
    const blackMoves = getAllLegalMoves('black').length;

    currentPlayer = originalPlayer;
    score += (whiteMoves - blackMoves) * 10;

    // King safety - penalize if king is in check
    if (isInCheck('white')) score -= 50;
    if (isInCheck('black')) score += 50;

    return score;
}
