// ============================================================================
// AI - Iterative Deepening, PVS, Null-Move Pruning, LMR, RFP, 64-bit TT & QS
// ============================================================================

// AI difficulty settings (global, 1..7)
let aiDifficulty = 3;
let aiDifficultyWhite = 3;
let aiDifficultyBlack = 3;
let nodesEvaluated = 0;         // Track total nodes evaluated by AI in current game
let lastMoveNodesEvaluated = 0; // Nodes evaluated for the most recent AI move

// Difficulty Names and Per-Move Maximum Time Budgets (in milliseconds)
const DIFFICULTY_NAMES = [
    'Beginner',     // 1 (Depth 1)
    'Easy',         // 2 (Depth 2)
    'Medium',       // 3 (Depth 3)
    'Hard',         // 4 (Depth 4)
    'Expert',       // 5 (Depth 5)
    'Master',       // 6 (Depth 6)
    'Grandmaster'   // 7 (Depth 7)
];

// Hard time limits per move so deeper levels can think 2x-4x longer without ever freezing
const DIFFICULTY_MAX_TIME_MS = {
    1: 100,
    2: 200,
    3: 350,
    4: 600,
    5: 1000,
    6: 1600,
    7: 2500
};

// Search time control & root contempt state
let searchDeadline = Infinity;
let searchAborted = false;
let searchRootPlayer = 'white';
const DRAW_CONTEMPT = 75; // Centipawn penalty against repeating positions unless down material
const MAX_PLY = 32;

// Track hashes along the active search path to detect in-tree 2-fold repetitions
const searchPathHashes = new Int32Array(MAX_PLY + 8);

// ============================================================================
// Transposition Table (Power-of-2 size with 64-bit Zobrist verification)
// ============================================================================
const TT_SIZE = 1 << 20; // 1,048,576 entries
const TT_MASK = TT_SIZE - 1;
const transpositionTable = new Array(TT_SIZE);

// Entry flags
const TT_EXACT = 0;
const TT_ALPHA = 1; // Upper bound (score <= originalAlpha)
const TT_BETA = 2;  // Lower bound (score >= originalBeta)

function ttStore(hash, depth, score, flag, bestMove) {
    if (searchAborted) return; // Never store incomplete aborted search results
    const index = hash.lo & TT_MASK;
    const existing = transpositionTable[index];
    if (!existing || existing.depth <= depth || existing.hashLo !== hash.lo || existing.hashHi !== hash.hi) {
        transpositionTable[index] = {
            hashLo: hash.lo,
            hashHi: hash.hi,
            depth,
            score,
            flag,
            bestMove
        };
    }
}

function ttLookup(hash, depth, alpha, beta) {
    const index = hash.lo & TT_MASK;
    const entry = transpositionTable[index];
    if (entry && entry.hashLo === hash.lo && entry.hashHi === hash.hi) {
        const result = { bestMove: entry.bestMove, cutoff: false, score: 0 };

        if (entry.depth >= depth) {
            if (entry.flag === TT_EXACT) {
                result.score = entry.score;
                result.cutoff = true;
            } else if (entry.flag === TT_ALPHA && entry.score <= alpha) {
                result.score = entry.score;
                result.cutoff = true;
            } else if (entry.flag === TT_BETA && entry.score >= beta) {
                result.score = entry.score;
                result.cutoff = true;
            }
        }
        return result;
    }
    return null;
}

function ttClear() {
    transpositionTable.fill(undefined);
    resetSearchHeuristics();
}

// ============================================================================
// Move Ordering - TT Best Move, Promotions, MVV-LVA, Killer Moves, History
// ============================================================================
const MVV_LVA_VALUES = {
    'p': 1, 'P': 1,
    'n': 3, 'N': 3,
    'b': 3, 'B': 3,
    'r': 5, 'R': 5,
    'q': 9, 'Q': 9,
    'k': 100, 'K': 100
};

const killerMoves = Array.from({ length: MAX_PLY }, () => [null, null]);
const historyTable = Array.from({ length: 12 }, () => new Int32Array(64));

function resetSearchHeuristics() {
    for (let i = 0; i < MAX_PLY; i++) {
        killerMoves[i][0] = null;
        killerMoves[i][1] = null;
    }
    for (let p = 0; p < 12; p++) {
        historyTable[p].fill(0);
    }
}

function recordKillerMove(move, ply) {
    if (ply < 0 || ply >= MAX_PLY) return;
    const k0 = killerMoves[ply][0];
    if (!k0 || k0.from.row !== move.from.row || k0.from.col !== move.from.col ||
        k0.to.row !== move.to.row || k0.to.col !== move.to.col) {
        killerMoves[ply][1] = k0;
        killerMoves[ply][0] = move;
    }
}

function recordHistoryMove(piece, move, depth) {
    if (!piece) return;
    const pIdx = PIECE_INDEX[piece];
    if (pIdx === undefined) return;
    const toSq = (move.to.row << 3) | move.to.col;
    historyTable[pIdx][toSq] = Math.min(30000, historyTable[pIdx][toSq] + depth * depth);
}

function scoreMoveForOrdering(move, ttBestMove, ply) {
    // 1. Transposition Table PV move first
    if (ttBestMove &&
        move.from.row === ttBestMove.from.row && move.from.col === ttBestMove.from.col &&
        move.to.row === ttBestMove.to.row && move.to.col === ttBestMove.to.col) {
        return 1000000;
    }

    const attacker = board[move.from.row][move.from.col];
    const victim = board[move.to.row][move.to.col];
    const isPawn = attacker === 'P' || attacker === 'p';

    // 2. Pawn promotion
    let score = 0;
    if (isPawn && (move.to.row === 0 || move.to.row === 7)) {
        score += 500000;
    }

    // 3. Captures (normal and en passant) ordered by MVV-LVA
    if (victim) {
        score += 100000 + (MVV_LVA_VALUES[victim] * 10 - MVV_LVA_VALUES[attacker]);
        return score;
    }
    if (isPawn && enPassantTarget &&
        move.to.row === enPassantTarget.row && move.to.col === enPassantTarget.col) {
        score += 100000 + (1 * 10 - 1);
        return score;
    }

    if (score > 0) return score;

    // 4. Killer moves (quiet moves that caused a beta cutoff at this ply)
    if (ply >= 0 && ply < MAX_PLY) {
        const k0 = killerMoves[ply][0];
        if (k0 && k0.from.row === move.from.row && k0.from.col === move.from.col &&
            k0.to.row === move.to.row && k0.to.col === move.to.col) {
            return 50000;
        }
        const k1 = killerMoves[ply][1];
        if (k1 && k1.from.row === move.from.row && k1.from.col === move.from.col &&
            k1.to.row === move.to.row && k1.to.col === move.to.col) {
            return 40000;
        }
    }

    // 5. History heuristic for quiet moves (plus tiny tie-break jitter at root for varied games)
    if (attacker) {
        const pIdx = PIECE_INDEX[attacker];
        const toSq = (move.to.row << 3) | move.to.col;
        let histScore = historyTable[pIdx][toSq];

        // At root, discourage immediate back-and-forth reversal of this side's previous move
        if (ply === 0 && moveHistory.length >= 2) {
            const prevOwnMove = moveHistory[moveHistory.length - 2];
            if (prevOwnMove &&
                move.from.row === prevOwnMove.to.row && move.from.col === prevOwnMove.to.col &&
                move.to.row === prevOwnMove.from.row && move.to.col === prevOwnMove.from.col) {
                histScore -= 15000;
            }
        }

        const jitter = ply === 0 ? Math.random() * 0.9 : 0;
        return histScore + jitter;
    }

    return 0;
}

function orderMoves(moves, ttBestMove, ply = 0) {
    if (moves.length <= 1) return moves;
    const scored = new Array(moves.length);
    for (let i = 0; i < moves.length; i++) {
        scored[i] = {
            move: moves[i],
            score: scoreMoveForOrdering(moves[i], ttBestMove, ply)
        };
    }
    scored.sort((a, b) => b.score - a.score);
    for (let i = 0; i < moves.length; i++) {
        moves[i] = scored[i].move;
    }
    return moves;
}

// ============================================================================
// Hoisted Piece-Square Tables & Material Values (Tapered Evaluation)
// ============================================================================
const PIECE_VALUES = {
    'p': 100, 'n': 320, 'b': 330, 'r': 500, 'q': 900, 'k': 20000,
    'P': 100, 'N': 320, 'B': 330, 'R': 500, 'Q': 900, 'K': 20000
};

const PAWN_TABLE = [
    [0,   0,   0,   0,   0,   0,   0,   0],
    [65,  70,  70,  75,  75,  70,  70,  65],
    [25,  25,  35,  45,  45,  35,  25,  25],
    [10,  12,  20,  32,  32,  20,  12,  10],
    [5,    5,  10,  24,  24,  10,   5,   5],
    [5,    0,   5,  10,  10,   5,   0,   5],
    [0,    5,   5, -15, -15,   5,   5,   0],
    [0,    0,   0,   0,   0,   0,   0,   0]
];

const KNIGHT_TABLE = [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  0,  0,  0,-20,-40],
    [-30,  0, 10, 15, 15, 10,  0,-30],
    [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 15, 20, 20, 15,  0,-30],
    [-30,  5, 10, 15, 15, 10,  5,-30],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50]
];

const BISHOP_TABLE = [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10],
    [-10,  5,  5, 10, 10,  5,  5,-10],
    [-10,  0, 10, 10, 10, 10,  0,-10],
    [-10, 10, 10, 10, 10, 10, 10,-10],
    [-10,  5,  0,  0,  0,  0,  5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20]
];

const ROOK_TABLE = [
    [0,  0,  0,  0,  0,  0,  0,  0],
    [5, 10, 10, 10, 10, 10, 10,  5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [0,  0,  0,  5,  5,  0,  0,  0]
];

const QUEEN_TABLE = [
    [-20,-10,-10, -5, -5,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5,  5,  5,  5,  0,-10],
    [-5,  0,  5,  5,  5,  5,  0, -5],
    [0,  0,  5,  5,  5,  5,  0, -5],
    [-10,  5,  5,  5,  5,  5,  0,-10],
    [-10,  0,  5,  0,  0,  0,  0,-10],
    [-20,-10,-10, -5, -5,-10,-10,-20]
];

const KING_MIDDLE_GAME_TABLE = [
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-20,-30,-30,-40,-40,-30,-30,-20],
    [-10,-20,-20,-20,-20,-20,-20,-10],
    [20, 20,  0,  0,  0,  0, 20, 20],
    [20, 30, 10,  0,  0, 10, 30, 20]
];

const KING_END_GAME_TABLE = [
    [-50,-40,-30,-20,-20,-30,-40,-50],
    [-30,-20,-10,  0,  0,-10,-20,-30],
    [-30,-10, 20, 30, 30, 20,-10,-30],
    [-30,-10, 30, 40, 40, 30,-10,-30],
    [-30,-10, 30, 40, 40, 30,-10,-30],
    [-30,-10, 20, 30, 30, 20,-10,-30],
    [-30,-30,  0,  0,  0,  0,-30,-30],
    [-50,-30,-30,-30,-30,-30,-30,-50]
];

// Check if `player` has any non-pawn, non-king material (to guard against Zugzwang in Null Move Pruning)
function hasNonPawnMaterial(player) {
    const isWhite = player === 'white';
    for (let r = 0; r < 8; r++) {
        const boardRow = board[r];
        for (let c = 0; c < 8; c++) {
            const p = boardRow[c];
            if (!p || (p === p.toUpperCase()) !== isWhite) continue;
            const t = p.toLowerCase();
            if (t === 'n' || t === 'b' || t === 'r' || t === 'q') return true;
        }
    }
    return false;
}

// Fast pseudo-legal mobility count for a single piece (zero allocation)
function countPiecePseudoMobility(piece, row, col) {
    const isWhite = piece === piece.toUpperCase();
    const type = piece.toLowerCase();
    let count = 0;

    if (type === 'n') {
        for (let i = 0; i < 8; i++) {
            const r = row + KNIGHT_OFFSETS[i][0];
            const c = col + KNIGHT_OFFSETS[i][1];
            if (r >= 0 && r < 8 && c >= 0 && c < 8) {
                const t = board[r][c];
                if (!t || (t === t.toUpperCase()) !== isWhite) count++;
            }
        }
    } else if (type === 'b' || type === 'r' || type === 'q') {
        const dirs = type === 'r' ? ROOK_DIRS : (type === 'b' ? BISHOP_DIRS : QUEEN_DIRS);
        for (let d = 0; d < dirs.length; d++) {
            const dr = dirs[d][0];
            const dc = dirs[d][1];
            let r = row + dr;
            let c = col + dc;
            while (r >= 0 && r < 8 && c >= 0 && c < 8) {
                const t = board[r][c];
                if (t) {
                    if ((t === t.toUpperCase()) !== isWhite) count++;
                    break;
                }
                count++;
                r += dr;
                c += dc;
            }
        }
    }
    return count;
}

// Passed pawn bonus by relative rank (0 = promotion rank, 7 = back rank)
const PASSED_PAWN_BONUS = [0, 90, 55, 32, 18, 8, 0, 0];

function isPassedPawn(row, col, isWhite) {
    const enemyPawn = isWhite ? 'p' : 'P';
    const cMin = col > 0 ? col - 1 : 0;
    const cMax = col < 7 ? col + 1 : 7;
    if (isWhite) {
        for (let r = row - 1; r >= 1; r--) {
            const bRow = board[r];
            for (let c = cMin; c <= cMax; c++) {
                if (bRow[c] === enemyPawn) return false;
            }
        }
    } else {
        for (let r = row + 1; r <= 6; r++) {
            const bRow = board[r];
            for (let c = cMin; c <= cMax; c++) {
                if (bRow[c] === enemyPawn) return false;
            }
        }
    }
    return true;
}

// Center distance table (0..6) for Endgame Mop-Up evaluation (pushes losing King to corners/edges)
const CENTER_DIST = [3, 2, 1, 0, 0, 1, 2, 3];

// Evaluate board position (zero-allocation, tapered king PST, passed pawns, bishop pair, mobility, endgame mop-up)
function evaluateBoard() {
    let score = 0;
    let phase = 0; // Max 24 (4 knights * 1 + 4 bishops * 1 + 4 rooks * 2 + 2 queens * 4)
    let whiteBishops = 0;
    let blackBishops = 0;
    let whiteKingRow = 7, whiteKingCol = 4;
    let blackKingRow = 0, blackKingCol = 4;
    let mobilityDiff = 0;

    for (let row = 0; row < 8; row++) {
        const boardRow = board[row];
        for (let col = 0; col < 8; col++) {
            const piece = boardRow[col];
            if (!piece) continue;

            const isWhite = piece === piece.toUpperCase();
            const r = isWhite ? row : 7 - row;
            const type = piece.toLowerCase();
            let val = PIECE_VALUES[piece];
            let posVal = 0;

            switch (type) {
                case 'p':
                    posVal = PAWN_TABLE[r][col];
                    if (isPassedPawn(row, col, isWhite)) {
                        posVal += PASSED_PAWN_BONUS[r];
                    }
                    break;
                case 'n':
                    posVal = KNIGHT_TABLE[r][col];
                    phase += 1;
                    mobilityDiff += isWhite
                        ? countPiecePseudoMobility(piece, row, col)
                        : -countPiecePseudoMobility(piece, row, col);
                    break;
                case 'b':
                    posVal = BISHOP_TABLE[r][col];
                    phase += 1;
                    if (isWhite) whiteBishops++; else blackBishops++;
                    mobilityDiff += isWhite
                        ? countPiecePseudoMobility(piece, row, col)
                        : -countPiecePseudoMobility(piece, row, col);
                    break;
                case 'r':
                    posVal = ROOK_TABLE[r][col];
                    phase += 2;
                    mobilityDiff += isWhite
                        ? countPiecePseudoMobility(piece, row, col)
                        : -countPiecePseudoMobility(piece, row, col);
                    break;
                case 'q':
                    posVal = QUEEN_TABLE[r][col];
                    phase += 4;
                    mobilityDiff += isWhite
                        ? countPiecePseudoMobility(piece, row, col)
                        : -countPiecePseudoMobility(piece, row, col);
                    break;
                case 'k':
                    if (isWhite) {
                        whiteKingRow = row;
                        whiteKingCol = col;
                    } else {
                        blackKingRow = row;
                        blackKingCol = col;
                    }
                    break;
            }

            if (isWhite) {
                score += val + posVal;
            } else {
                score -= val + posVal;
            }
        }
    }

    // Tapered King positional evaluation between Middlegame and Endgame
    const clampedPhase = Math.min(24, phase);
    const egWeight = 24 - clampedPhase;

    const wKingMG = KING_MIDDLE_GAME_TABLE[whiteKingRow][whiteKingCol];
    const wKingEG = KING_END_GAME_TABLE[whiteKingRow][whiteKingCol];
    score += Math.round((wKingMG * clampedPhase + wKingEG * egWeight) / 24);

    const bKingMG = KING_MIDDLE_GAME_TABLE[7 - blackKingRow][blackKingCol];
    const bKingEG = KING_END_GAME_TABLE[7 - blackKingRow][blackKingCol];
    score -= Math.round((bKingMG * clampedPhase + bKingEG * egWeight) / 24);

    // Bishop pair bonus
    if (whiteBishops >= 2) score += 30;
    if (blackBishops >= 2) score -= 30;

    // Fast mobility bonus
    score += mobilityDiff * 4;

    // Endgame Mop-Up evaluation: when ahead in endgame, drive losing King to edge/corner and close distance
    if (egWeight >= 10 && Math.abs(score) >= 180) {
        const kingsDist = Math.abs(whiteKingRow - blackKingRow) + Math.abs(whiteKingCol - blackKingCol);
        const closenessBonus = (14 - kingsDist) * 7;
        if (score > 0) {
            const losingCenterDist = CENTER_DIST[blackKingRow] + CENTER_DIST[blackKingCol];
            const mopUp = Math.round(((losingCenterDist * 16 + closenessBonus) * egWeight) / 24);
            score += mopUp;
        } else {
            const losingCenterDist = CENTER_DIST[whiteKingRow] + CENTER_DIST[whiteKingCol];
            const mopUp = Math.round(((losingCenterDist * 16 + closenessBonus) * egWeight) / 24);
            score -= mopUp;
        }
    }

    // King safety - penalize if king is in check
    if (isSquareAttacked(whiteKingRow, whiteKingCol, 'black')) score -= 40;
    if (isSquareAttacked(blackKingRow, blackKingCol, 'white')) score += 40;

    return score;
}

// ============================================================================
// Quiescence Search with Delta Pruning (resolves tactical exchanges at leaves)
// ============================================================================
const MAX_QUIESCENCE_DEPTH = 3;

function getCaptureAndPromotionMoves(player) {
    const tactical = [];
    const isWhite = player === 'white';
    const ep = enPassantTarget;
    const kingPos = findKing(player);

    for (let fromRow = 0; fromRow < 8; fromRow++) {
        const boardRow = board[fromRow];
        for (let fromCol = 0; fromCol < 8; fromCol++) {
            const piece = boardRow[fromCol];
            if (!piece || (piece === piece.toUpperCase()) !== isWhite) continue;

            const type = piece.toLowerCase();

            if (type === 'p') {
                const dir = isWhite ? -1 : 1;
                const toRow = fromRow + dir;
                if (toRow < 0 || toRow >= 8) continue;

                // Forward promotion (quiet push to promotion rank)
                if ((toRow === 0 || toRow === 7) && !board[toRow][fromCol]) {
                    if (isValidMove(fromRow, fromCol, toRow, fromCol, player, kingPos)) {
                        tactical.push({ from: { row: fromRow, col: fromCol }, to: { row: toRow, col: fromCol } });
                    }
                }
                // Diagonal captures (normal & en passant)
                for (let dc = -1; dc <= 1; dc += 2) {
                    const toCol = fromCol + dc;
                    if (toCol < 0 || toCol >= 8) continue;
                    const target = board[toRow][toCol];
                    const isEp = !target && ep && toRow === ep.row && toCol === ep.col;
                    if ((target && (target === target.toUpperCase()) !== isWhite) || isEp) {
                        if (isValidMove(fromRow, fromCol, toRow, toCol, player, kingPos)) {
                            tactical.push({ from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } });
                        }
                    }
                }
            } else if (type === 'n') {
                for (let i = 0; i < 8; i++) {
                    const r = fromRow + KNIGHT_OFFSETS[i][0];
                    const c = fromCol + KNIGHT_OFFSETS[i][1];
                    if (r >= 0 && r < 8 && c >= 0 && c < 8) {
                        const target = board[r][c];
                        if (target && (target === target.toUpperCase()) !== isWhite) {
                            if (isValidMove(fromRow, fromCol, r, c, player, kingPos)) {
                                tactical.push({ from: { row: fromRow, col: fromCol }, to: { row: r, col: c } });
                            }
                        }
                    }
                }
            } else if (type === 'k') {
                for (let i = 0; i < 8; i++) {
                    const r = fromRow + KING_OFFSETS[i][0];
                    const c = fromCol + KING_OFFSETS[i][1];
                    if (r >= 0 && r < 8 && c >= 0 && c < 8) {
                        const target = board[r][c];
                        if (target && (target === target.toUpperCase()) !== isWhite) {
                            if (isValidMove(fromRow, fromCol, r, c, player, kingPos)) {
                                tactical.push({ from: { row: fromRow, col: fromCol }, to: { row: r, col: c } });
                            }
                        }
                    }
                }
            } else {
                const dirs = type === 'r' ? ROOK_DIRS : (type === 'b' ? BISHOP_DIRS : QUEEN_DIRS);
                for (let d = 0; d < dirs.length; d++) {
                    const dr = dirs[d][0];
                    const dc = dirs[d][1];
                    let r = fromRow + dr;
                    let c = fromCol + dc;
                    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
                        const target = board[r][c];
                        if (target) {
                            if ((target === target.toUpperCase()) !== isWhite) {
                                if (isValidMove(fromRow, fromCol, r, c, player, kingPos)) {
                                    tactical.push({ from: { row: fromRow, col: fromCol }, to: { row: r, col: c } });
                                }
                            }
                            break;
                        }
                        r += dr;
                        c += dc;
                    }
                }
            }
        }
    }

    return tactical.length > 1 ? orderMoves(tactical, null, MAX_PLY - 1) : tactical;
}

function quiescence(alpha, beta, player, isMaximizing, qDepth = MAX_QUIESCENCE_DEPTH) {
    nodesEvaluated++;
    if ((nodesEvaluated & 511) === 0 && Date.now() >= searchDeadline) {
        searchAborted = true;
        return 0;
    }

    const standPat = evaluateBoard();

    if (qDepth <= 0) {
        return standPat;
    }

    if (isMaximizing) {
        if (standPat >= beta) return beta;
        if (standPat > alpha) alpha = standPat;

        const captures = getCaptureAndPromotionMoves(player);
        const nextPlayer = player === 'white' ? 'black' : 'white';

        for (let i = 0; i < captures.length; i++) {
            const cap = captures[i];
            const victim = board[cap.to.row][cap.to.col];
            const isPromo = cap.to.row === 0 || cap.to.row === 7;
            // Delta pruning: skip captures that cannot possibly raise score to alpha
            if (victim && !isPromo && standPat + PIECE_VALUES[victim] + 200 < alpha) {
                continue;
            }

            const state = makeFastMove(cap, player);
            const score = quiescence(alpha, beta, nextPlayer, false, qDepth - 1);
            unmakeFastMove(state);

            if (searchAborted) return 0;
            if (score >= beta) return beta;
            if (score > alpha) alpha = score;
        }
        return alpha;
    } else {
        if (standPat <= alpha) return alpha;
        if (standPat < beta) beta = standPat;

        const captures = getCaptureAndPromotionMoves(player);
        const nextPlayer = player === 'white' ? 'black' : 'white';

        for (let i = 0; i < captures.length; i++) {
            const cap = captures[i];
            const victim = board[cap.to.row][cap.to.col];
            const isPromo = cap.to.row === 0 || cap.to.row === 7;
            // Delta pruning: skip captures that cannot possibly lower score to beta
            if (victim && !isPromo && standPat - PIECE_VALUES[victim] - 200 > beta) {
                continue;
            }

            const state = makeFastMove(cap, player);
            const score = quiescence(alpha, beta, nextPlayer, true, qDepth - 1);
            unmakeFastMove(state);

            if (searchAborted) return 0;
            if (score <= alpha) return alpha;
            if (score < beta) beta = score;
        }
        return beta;
    }
}

// ============================================================================
// Minimax with PVS, Null-Move Pruning, LMR, Reverse Futility Pruning & 64-bit TT
// ============================================================================
function getContemptDrawScore() {
    // Penalize draws for the root player so neither AI willingly bails into a repetition
    return searchRootPlayer === 'white' ? -DRAW_CONTEMPT : DRAW_CONTEMPT;
}

function minimax(depth, player, alpha, beta, isMaximizing, ply = 0, allowNull = true) {
    if ((nodesEvaluated & 511) === 0 && Date.now() >= searchDeadline) {
        searchAborted = true;
        return { score: 0, move: null };
    }

    const hash = computeHash();
    if (ply >= 0 && ply < searchPathHashes.length) {
        searchPathHashes[ply] = hash.lo;
    }

    // 1. Check for draw by 50-move rule or ANY repetition (2-fold in game history OR in current search path)
    if (ply > 0) {
        if (halfMoveClock >= 100) {
            return { score: getContemptDrawScore(), move: null };
        }
        if (halfMoveClock >= 2) {
            // 1a. Check against current search path (prevent cycling within search tree)
            for (let p = ply - 2; p >= 0; p -= 2) {
                if (searchPathHashes[p] === hash.lo) {
                    return { score: getContemptDrawScore(), move: null };
                }
            }
            // 1b. Check against actual game positionHistory (if position already appeared even once, repeating it leads to draw!)
            if (positionHistory.length >= 2) {
                const posKey = getPositionKey();
                const maxCheck = Math.min(positionHistory.length, halfMoveClock + 2);
                for (let i = positionHistory.length - 1; i >= positionHistory.length - maxCheck; i--) {
                    if (positionHistory[i] === posKey) {
                        return { score: getContemptDrawScore(), move: null };
                    }
                }
            }
        }
    }

    // 2. Save BOTH originalAlpha and originalBeta for accurate TT bound classification
    const originalAlpha = alpha;
    const originalBeta = beta;
    const isPV = (beta - alpha) > 1;

    nodesEvaluated++;

    // 3. Transposition table lookup (at root ply === 0, verify bestMove legality)
    const ttHit = ttLookup(hash, depth, alpha, beta);
    if (ttHit && ttHit.cutoff) {
        if (ply > 0 || (ttHit.bestMove && isValidMove(
            ttHit.bestMove.from.row, ttHit.bestMove.from.col,
            ttHit.bestMove.to.row, ttHit.bestMove.to.col, player
        ))) {
            return { score: ttHit.score, move: ttHit.bestMove };
        }
    }

    // 4. Frontier node (depth <= 0): run Quiescence Search to resolve pending captures
    if (depth <= 0) {
        const qDepth = ply <= 1 ? 2 : MAX_QUIESCENCE_DEPTH;
        return { score: quiescence(alpha, beta, player, isMaximizing, qDepth), move: null };
    }

    const inCheck = isInCheck(player);
    const nextPlayer = player === 'white' ? 'black' : 'white';

    // 5. Reverse Futility Pruning (Static Null Move Pruning) & Null Move Pruning at non-PV nodes
    if (ply > 0 && !isPV && !inCheck && Math.abs(alpha) < 90000 && Math.abs(beta) < 90000) {
        // 5a. Reverse Futility Pruning (depth <= 3)
        if (depth <= 3) {
            const staticEval = evaluateBoard();
            const margin = 120 * depth;
            if (isMaximizing && staticEval - margin >= beta) {
                return { score: staticEval, move: null };
            }
            if (!isMaximizing && staticEval + margin <= alpha) {
                return { score: staticEval, move: null };
            }
        }

        // 5b. Null Move Pruning (depth >= 3, not in pawn-only endgame)
        if (allowNull && depth >= 3 && hasNonPawnMaterial(player)) {
            const R = depth >= 5 ? 3 : 2;
            const savedPlayer = currentPlayer;
            const savedEp = enPassantTarget;
            currentPlayer = nextPlayer;
            enPassantTarget = null;

            let nullRes;
            if (isMaximizing) {
                nullRes = minimax(depth - 1 - R, nextPlayer, beta - 1, beta, false, ply + 1, false);
            } else {
                nullRes = minimax(depth - 1 - R, nextPlayer, alpha, alpha + 1, true, ply + 1, false);
            }

            currentPlayer = savedPlayer;
            enPassantTarget = savedEp;

            if (searchAborted) return { score: 0, move: null };
            if (isMaximizing && nullRes.score >= beta) {
                return { score: beta, move: null };
            }
            if (!isMaximizing && nullRes.score <= alpha) {
                return { score: alpha, move: null };
            }
        }
    }

    let moves = getAllLegalMoves(player);

    // 6. Terminal node: Checkmate or Stalemate
    if (moves.length === 0) {
        if (inCheck) {
            const mateScore = 100000 + depth * 100;
            return { score: isMaximizing ? -mateScore : mateScore, move: null };
        }
        return { score: 0, move: null }; // Stalemate
    }

    // 7. Order moves (TT best move -> Promotions -> MVV-LVA Captures -> Killers -> History)
    const ttBestMove = ttHit ? ttHit.bestMove : null;
    moves = orderMoves(moves, ttBestMove, ply);

    let bestMove = moves[0];

    if (isMaximizing) {
        let maxScore = -Infinity;

        for (let i = 0; i < moves.length; i++) {
            const move = moves[i];
            const isCapture = Boolean(board[move.to.row][move.to.col]);
            const movingPiece = board[move.from.row][move.from.col];
            const isPromo = (movingPiece === 'P' || movingPiece === 'p') && (move.to.row === 0 || move.to.row === 7);

            const state = makeFastMove(move, player);
            let score;

            // Principal Variation Search (PVS) + Late Move Reductions (LMR)
            if (i === 0) {
                score = minimax(depth - 1, nextPlayer, alpha, beta, false, ply + 1, true).score;
            } else {
                let needsFullNullWindow = true;
                // Late Move Reductions (LMR) for quiet late moves
                if (depth >= 3 && i >= 3 && !isCapture && !isPromo && !inCheck) {
                    const reduction = (depth >= 5 && i >= 8) ? 2 : 1;
                    const reducedDepth = Math.max(1, depth - 1 - reduction);
                    score = minimax(reducedDepth, nextPlayer, alpha, alpha + 1, false, ply + 1, true).score;
                    needsFullNullWindow = (score > alpha);
                }

                if (needsFullNullWindow && !searchAborted) {
                    // PVS zero-window search
                    score = minimax(depth - 1, nextPlayer, alpha, alpha + 1, false, ply + 1, true).score;
                    if (!searchAborted && score > alpha && score < beta) {
                        // Full-window re-search
                        score = minimax(depth - 1, nextPlayer, alpha, beta, false, ply + 1, true).score;
                    }
                }
            }

            unmakeFastMove(state);

            if (searchAborted) return { score: maxScore === -Infinity ? 0 : maxScore, move: bestMove };

            if (score > maxScore) {
                maxScore = score;
                bestMove = move;
            }

            if (score > alpha) {
                alpha = score;
            }
            if (beta <= alpha) {
                if (!isCapture) {
                    recordKillerMove(move, ply);
                    recordHistoryMove(movingPiece, move, depth);
                }
                break; // Beta cutoff
            }
        }

        let flag = TT_EXACT;
        if (maxScore <= originalAlpha) {
            flag = TT_ALPHA;
        } else if (maxScore >= originalBeta) {
            flag = TT_BETA;
        }
        ttStore(hash, depth, maxScore, flag, bestMove);

        return { score: maxScore, move: bestMove };
    } else {
        let minScore = Infinity;

        for (let i = 0; i < moves.length; i++) {
            const move = moves[i];
            const isCapture = Boolean(board[move.to.row][move.to.col]);
            const movingPiece = board[move.from.row][move.from.col];
            const isPromo = (movingPiece === 'P' || movingPiece === 'p') && (move.to.row === 0 || move.to.row === 7);

            const state = makeFastMove(move, player);
            let score;

            // Principal Variation Search (PVS) + Late Move Reductions (LMR)
            if (i === 0) {
                score = minimax(depth - 1, nextPlayer, alpha, beta, true, ply + 1, true).score;
            } else {
                let needsFullNullWindow = true;
                // Late Move Reductions (LMR) for quiet late moves
                if (depth >= 3 && i >= 3 && !isCapture && !isPromo && !inCheck) {
                    const reduction = (depth >= 5 && i >= 8) ? 2 : 1;
                    const reducedDepth = Math.max(1, depth - 1 - reduction);
                    score = minimax(reducedDepth, nextPlayer, beta - 1, beta, true, ply + 1, true).score;
                    needsFullNullWindow = (score < beta);
                }

                if (needsFullNullWindow && !searchAborted) {
                    // PVS zero-window search
                    score = minimax(depth - 1, nextPlayer, beta - 1, beta, true, ply + 1, true).score;
                    if (!searchAborted && score < beta && score > alpha) {
                        // Full-window re-search
                        score = minimax(depth - 1, nextPlayer, alpha, beta, true, ply + 1, true).score;
                    }
                }
            }

            unmakeFastMove(state);

            if (searchAborted) return { score: minScore === Infinity ? 0 : minScore, move: bestMove };

            if (score < minScore) {
                minScore = score;
                bestMove = move;
            }

            if (score < beta) {
                beta = score;
            }
            if (beta <= alpha) {
                if (!isCapture) {
                    recordKillerMove(move, ply);
                    recordHistoryMove(movingPiece, move, depth);
                }
                break; // Alpha cutoff
            }
        }

        let flag = TT_EXACT;
        if (minScore <= originalAlpha) {
            flag = TT_ALPHA;
        } else if (minScore >= originalBeta) {
            flag = TT_BETA;
        }
        ttStore(hash, depth, minScore, flag, bestMove);

        return { score: minScore, move: bestMove };
    }
}

// ============================================================================
// Iterative Deepening Root Search with Time Management
// ============================================================================
function searchBestMoveWithIterativeDeepening(targetDepth, player) {
    const isMaximizing = player === 'white';
    searchRootPlayer = player;
    const maxTime = DIFFICULTY_MAX_TIME_MS[targetDepth] || 1500;
    const startTime = Date.now();

    // For depths 1-3, allow full completion; for depths 4+, enforce hard deadline
    searchDeadline = targetDepth <= 3 ? Infinity : (startTime + maxTime);
    searchAborted = false;

    let bestResult = { score: 0, move: null };
    const startDepth = targetDepth <= 2 ? targetDepth : 1;

    for (let d = startDepth; d <= targetDepth; d++) {
        const res = minimax(d, player, -Infinity, Infinity, isMaximizing, 0, true);
        if (searchAborted) {
            // Keep the move from the last completed depth (or current if we have no move yet)
            if (!bestResult.move && res.move) {
                bestResult = res;
            }
            break;
        }
        if (res.move) {
            bestResult = res;
        }
        // Stop early if a forced checkmate was already found
        if (Math.abs(bestResult.score) >= 100000) {
            break;
        }
        // Soft time limit: if we already spent > 55% of maxTime, don't start next deeper iteration
        if (d >= 4 && d < targetDepth && (Date.now() - startTime) > maxTime * 0.55) {
            break;
        }
    }

    searchDeadline = Infinity;
    searchAborted = false;
    return bestResult;
}

// ============================================================================
// Opening Book & AI Move Execution
// ============================================================================

function getOpeningBookMove() {
    if (moveHistory.length === 0 && currentPlayer === 'white') {
        const moves = openingBook['start'];
        if (moves && moves.length > 0) {
            const candidate = moves[Math.floor(Math.random() * moves.length)];
            if (isValidMove(candidate.from.row, candidate.from.col, candidate.to.row, candidate.to.col, currentPlayer)) {
                return candidate;
            }
        }
        return null;
    }

    if (moveHistory.length > 0 && moveHistory.length <= 4) {
        const keys = moveHistory.map(m =>
            `${String.fromCharCode(97 + m.from.col)}${8 - m.from.row}${String.fromCharCode(97 + m.to.col)}${8 - m.to.row}`
        );
        const key = keys.join(',');
        const moves = openingBook[key];
        if (moves && moves.length > 0) {
            const legalBookMoves = moves.filter(m =>
                isValidMove(m.from.row, m.from.col, m.to.row, m.to.col, currentPlayer)
            );
            if (legalBookMoves.length > 0) {
                return legalBookMoves[Math.floor(Math.random() * legalBookMoves.length)];
            }
        }
    }

    return null;
}

// Legacy helper kept for backward compatibility
function simulateMoveForMinimax(move, player) {
    makeFastMove(move, player);
}

// AI Move entry point using Opening Book + Iterative Deepening PVS/NMP/LMR
function makeAIMove() {
    if (gameOver) return;
    if (gameMode === 'watch' && !watchMatchRunning) return;

    if (typeof aiMoveTimeout !== 'undefined' && aiMoveTimeout) {
        clearTimeout(aiMoveTimeout);
        aiMoveTimeout = null;
    }

    // Check opening book first (first 2-3 moves)
    if (fullMoveNumber <= 3) {
        const bookMove = getOpeningBookMove();
        if (bookMove) {
            lastMoveNodesEvaluated = 0;
            executeMoveWithUI(
                bookMove.from.row, bookMove.from.col,
                bookMove.to.row, bookMove.to.col,
                bookMove.promotion
            );

            if (gameMode === 'watch' && watchMatchRunning && !gameOver) {
                aiMoveTimeout = setTimeout(() => {
                    aiMoveTimeout = null;
                    if (!gameOver && watchMatchRunning) makeAIMove();
                }, AI_WATCH_DELAY);
            }
            return;
        }
    }

    let currentDifficulty = aiDifficulty;
    if (gameMode === 'watch') {
        currentDifficulty = currentPlayer === 'white' ? aiDifficultyWhite : aiDifficultyBlack;
    }

    showAIThinking(currentDifficulty);

    aiMoveTimeout = setTimeout(() => {
        aiMoveTimeout = null;
        if (gameOver || (gameMode === 'watch' && !watchMatchRunning)) {
            hideAIThinking();
            return;
        }

        const startNodes = nodesEvaluated;
        const playerForSearch = currentPlayer;

        const bestMove = searchBestMoveWithIterativeDeepening(currentDifficulty, playerForSearch);
        lastMoveNodesEvaluated = Math.max(0, nodesEvaluated - startNodes);

        hideAIThinking();

        if (gameOver || (gameMode === 'watch' && !watchMatchRunning)) return;

        let chosenMove = bestMove && bestMove.move ? bestMove.move : null;

        if (!chosenMove || !isValidMove(
            chosenMove.from.row, chosenMove.from.col,
            chosenMove.to.row, chosenMove.to.col, currentPlayer
        )) {
            const fallbackMoves = getAllLegalMoves(currentPlayer);
            chosenMove = fallbackMoves.length > 0 ? fallbackMoves[0] : null;
        }

        if (chosenMove) {
            const piece = board[chosenMove.from.row][chosenMove.from.col];
            let promotionPiece = chosenMove.promotion || null;
            if (!promotionPiece && piece && piece.toLowerCase() === 'p') {
                const toRow = chosenMove.to.row;
                if (toRow === 0 || toRow === 7) {
                    promotionPiece = currentPlayer === 'white' ? 'Q' : 'q';
                }
            }

            executeMoveWithUI(
                chosenMove.from.row, chosenMove.from.col,
                chosenMove.to.row, chosenMove.to.col,
                promotionPiece
            );

            if (gameMode === 'watch' && watchMatchRunning && !gameOver) {
                aiMoveTimeout = setTimeout(() => {
                    aiMoveTimeout = null;
                    if (!gameOver && watchMatchRunning) makeAIMove();
                }, AI_WATCH_DELAY);
            }
        }
    }, 0);
}
