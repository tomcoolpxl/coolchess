// ============================================================================
// ENGINE - Core game state and logic (pure - no DOM manipulation)
// ============================================================================

// Game state variables (global)
let board = [];
let selectedSquare = null;
let currentPlayer = 'white';
let gameMode = 'ai';
let moveHistory = [];
let capturedPieces = { white: [], black: [] };
let gameOver = false;
let castlingRights = { white: { kingside: true, queenside: true }, black: { kingside: true, queenside: true } };
let enPassantTarget = null;
let halfMoveClock = 0;
let fullMoveNumber = 1;
let lastMove = null;
let pendingPromotion = null;
let positionHistory = [];
let gameOverReason = '';

// Precomputed step offsets for knights and kings, and rays for sliding pieces
const KNIGHT_OFFSETS = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2],  [1, 2],  [2, -1],  [2, 1]
];
const KING_OFFSETS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
];
const ROOK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const BISHOP_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const QUEEN_DIRS = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [-1, 1], [1, -1], [1, 1]
];

// Initialize the game to starting position
function initGame() {
    if (typeof nodesEvaluated !== 'undefined') {
        nodesEvaluated = 0;
    }
    if (typeof lastMoveNodesEvaluated !== 'undefined') {
        lastMoveNodesEvaluated = 0;
    }
    board = [
        ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
        ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
        ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    ];
    currentPlayer = 'white';
    selectedSquare = null;
    moveHistory = [];
    capturedPieces = { white: [], black: [] };
    gameOver = false;
    gameOverReason = '';
    castlingRights = {
        white: { kingside: true, queenside: true },
        black: { kingside: true, queenside: true }
    };
    enPassantTarget = null;
    halfMoveClock = 0;
    fullMoveNumber = 1;
    lastMove = null;
    pendingPromotion = null;
    // Record initial starting position for accurate threefold repetition detection
    positionHistory = [getPositionKey()];
}

// Check if coordinates are on the 8x8 board
function isOnBoard(row, col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
}

// Check if piece belongs to player
function isOwnPiece(piece, player) {
    if (!piece) return false;
    if (player === 'white') {
        return piece === piece.toUpperCase();
    } else {
        return piece === piece.toLowerCase();
    }
}

// Pure attack check: Can `piece` at (fromRow, fromCol) attack (targetRow, targetCol)?
// Does NOT check castling or en passant (preventing recursion and false king checks).
function canPieceAttackSquare(piece, fromRow, fromCol, targetRow, targetCol) {
    if (fromRow === targetRow && fromCol === targetCol) return false;
    const pieceType = piece.toLowerCase();
    const rowDiff = targetRow - fromRow;
    const colDiff = targetCol - fromCol;
    const absRow = Math.abs(rowDiff);
    const absCol = Math.abs(colDiff);

    switch (pieceType) {
        case 'p': {
            const direction = piece === 'P' ? -1 : 1;
            return absCol === 1 && rowDiff === direction;
        }
        case 'n':
            return (absRow === 2 && absCol === 1) || (absRow === 1 && absCol === 2);
        case 'b':
            return absRow === absCol && isPathClear(fromRow, fromCol, targetRow, targetCol);
        case 'r':
            return (rowDiff === 0 || colDiff === 0) && isPathClear(fromRow, fromCol, targetRow, targetCol);
        case 'q':
            return (rowDiff === 0 || colDiff === 0 || absRow === absCol) &&
                   isPathClear(fromRow, fromCol, targetRow, targetCol);
        case 'k':
            return absRow <= 1 && absCol <= 1;
        default:
            return false;
    }
}

// Fast reverse-ray attack lookup: check if (targetRow, targetCol) is attacked by `byPlayer`
function isSquareAttacked(targetRow, targetCol, byPlayer) {
    const byWhite = byPlayer === 'white';
    const enemyPawn = byWhite ? 'P' : 'p';
    const enemyKnight = byWhite ? 'N' : 'n';
    const enemyBishop = byWhite ? 'B' : 'b';
    const enemyRook = byWhite ? 'R' : 'r';
    const enemyQueen = byWhite ? 'Q' : 'q';
    const enemyKing = byWhite ? 'K' : 'k';

    // 1. Pawn attacks (a white pawn attacks from targetRow + 1; a black pawn attacks from targetRow - 1)
    const pawnRow = byWhite ? targetRow + 1 : targetRow - 1;
    if (pawnRow >= 0 && pawnRow < 8) {
        if (targetCol > 0 && board[pawnRow][targetCol - 1] === enemyPawn) return true;
        if (targetCol < 7 && board[pawnRow][targetCol + 1] === enemyPawn) return true;
    }

    // 2. Knight attacks
    for (let i = 0; i < 8; i++) {
        const r = targetRow + KNIGHT_OFFSETS[i][0];
        const c = targetCol + KNIGHT_OFFSETS[i][1];
        if (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r][c] === enemyKnight) {
            return true;
        }
    }

    // 3. Orthogonal rays (Rook / Queen)
    for (let d = 0; d < 4; d++) {
        const dr = ROOK_DIRS[d][0];
        const dc = ROOK_DIRS[d][1];
        let r = targetRow + dr;
        let c = targetCol + dc;
        while (r >= 0 && r < 8 && c >= 0 && c < 8) {
            const p = board[r][c];
            if (p) {
                if (p === enemyRook || p === enemyQueen) return true;
                break;
            }
            r += dr;
            c += dc;
        }
    }

    // 4. Diagonal rays (Bishop / Queen)
    for (let d = 0; d < 4; d++) {
        const dr = BISHOP_DIRS[d][0];
        const dc = BISHOP_DIRS[d][1];
        let r = targetRow + dr;
        let c = targetCol + dc;
        while (r >= 0 && r < 8 && c >= 0 && c < 8) {
            const p = board[r][c];
            if (p) {
                if (p === enemyBishop || p === enemyQueen) return true;
                break;
            }
            r += dr;
            c += dc;
        }
    }

    // 5. King attacks
    for (let i = 0; i < 8; i++) {
        const r = targetRow + KING_OFFSETS[i][0];
        const c = targetCol + KING_OFFSETS[i][1];
        if (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r][c] === enemyKing) {
            return true;
        }
    }

    return false;
}

// Check if `player`'s king is currently in check
function isInCheck(player) {
    const kingPos = findKing(player);
    if (!kingPos) return false;
    const opponent = player === 'white' ? 'black' : 'white';
    return isSquareAttacked(kingPos.row, kingPos.col, opponent);
}

// Find king position
function findKing(player) {
    const kingPiece = player === 'white' ? 'K' : 'k';
    for (let row = 0; row < 8; row++) {
        const boardRow = board[row];
        for (let col = 0; col < 8; col++) {
            if (boardRow[col] === kingPiece) {
                return { row, col };
            }
        }
    }
    return null;
}

// Check if path is clear (for rook, bishop, queen)
function isPathClear(fromRow, fromCol, toRow, toCol) {
    const rowStep = toRow > fromRow ? 1 : (toRow < fromRow ? -1 : 0);
    const colStep = toCol > fromCol ? 1 : (toCol < fromCol ? -1 : 0);

    let currentRow = fromRow + rowStep;
    let currentCol = fromCol + colStep;

    while (currentRow !== toRow || currentCol !== toCol) {
        if (board[currentRow][currentCol]) {
            return false;
        }
        currentRow += rowStep;
        currentCol += colStep;
    }

    return true;
}

// Check if castling is possible (pure, zero board deep-cloning)
function canCastle(fromRow, fromCol, toRow, toCol, player = currentPlayer) {
    const homeRow = player === 'white' ? 7 : 0;
    if (fromRow !== homeRow || toRow !== homeRow || fromCol !== 4) return false;

    const expectedKing = player === 'white' ? 'K' : 'k';
    if (board[homeRow][4] !== expectedKing) return false;

    const isKingside = toCol > fromCol;
    const rights = player === 'white' ? castlingRights.white : castlingRights.black;
    if (isKingside && !rights.kingside) return false;
    if (!isKingside && !rights.queenside) return false;

    // Verify the corresponding rook is actually on its starting corner square
    const rookCol = isKingside ? 7 : 0;
    const expectedRook = player === 'white' ? 'R' : 'r';
    if (board[homeRow][rookCol] !== expectedRook) return false;

    // Check if path is clear between king and rook
    const step = isKingside ? 1 : -1;
    for (let col = fromCol + step; col !== rookCol; col += step) {
        if (board[homeRow][col]) return false;
    }

    const opponent = player === 'white' ? 'black' : 'white';

    // King cannot castle out of check
    if (isSquareAttacked(homeRow, fromCol, opponent)) return false;

    // Check if king passes through or lands on an attacked square (in-place test)
    board[homeRow][fromCol] = '';
    try {
        for (let col = fromCol + step; col !== toCol + step; col += step) {
            board[homeRow][col] = expectedKing;
            const attacked = isSquareAttacked(homeRow, col, opponent);
            board[homeRow][col] = '';
            if (attacked) {
                return false;
            }
        }
        return true;
    } finally {
        board[homeRow][fromCol] = expectedKing;
    }
}

// Validate piece movement rules
function isPieceMovementValid(piece, fromRow, fromCol, toRow, toCol, player = currentPlayer) {
    const pieceType = piece.toLowerCase();
    const rowDiff = toRow - fromRow;
    const colDiff = toCol - fromCol;
    const absRow = Math.abs(rowDiff);
    const absCol = Math.abs(colDiff);
    const direction = piece === piece.toUpperCase() ? -1 : 1; // White moves up (-1), black moves down (+1)

    switch (pieceType) {
        case 'p': // Pawn
            // Move forward
            if (colDiff === 0) {
                if (rowDiff === direction && !board[toRow][toCol]) {
                    return true;
                }
                // First move can be 2 squares
                const startRow = piece === 'P' ? 6 : 1;
                if (fromRow === startRow && rowDiff === 2 * direction &&
                    !board[toRow][toCol] && !board[fromRow + direction][fromCol]) {
                    return true;
                }
            }
            // Capture diagonally
            if (absCol === 1 && rowDiff === direction) {
                if (board[toRow][toCol]) {
                    return true;
                }
                // En passant
                if (enPassantTarget && toRow === enPassantTarget.row && toCol === enPassantTarget.col) {
                    return true;
                }
            }
            return false;

        case 'r': // Rook
            if (rowDiff === 0 || colDiff === 0) {
                return isPathClear(fromRow, fromCol, toRow, toCol);
            }
            return false;

        case 'n': // Knight
            return (absRow === 2 && absCol === 1) || (absRow === 1 && absCol === 2);

        case 'b': // Bishop
            if (absRow === absCol) {
                return isPathClear(fromRow, fromCol, toRow, toCol);
            }
            return false;

        case 'q': // Queen
            if (rowDiff === 0 || colDiff === 0 || absRow === absCol) {
                return isPathClear(fromRow, fromCol, toRow, toCol);
            }
            return false;

        case 'k': // King
            // Normal king move (1 square any direction)
            if (absRow <= 1 && absCol <= 1 && (rowDiff !== 0 || colDiff !== 0)) {
                return true;
            }
            // Castling
            if (rowDiff === 0 && absCol === 2) {
                return canCastle(fromRow, fromCol, toRow, toCol, player);
            }
            return false;

        default:
            return false;
    }
}

// Check if move is valid (fast in-place simulation including en passant & castling)
function isValidMove(fromRow, fromCol, toRow, toCol, player = currentPlayer) {
    if (!isOnBoard(fromRow, fromCol) || !isOnBoard(toRow, toCol)) return false;
    if (fromRow === toRow && fromCol === toCol) return false;

    const piece = board[fromRow][fromCol];
    if (!piece) return false;

    // Must move own piece
    if (!isOwnPiece(piece, player)) {
        return false;
    }

    const targetPiece = board[toRow][toCol];

    // Can't capture own piece
    if (targetPiece && isOwnPiece(targetPiece, player)) {
        return false;
    }

    // Check piece-specific movement rules
    if (!isPieceMovementValid(piece, fromRow, fromCol, toRow, toCol, player)) {
        return false;
    }

    // Fast in-place simulation to check if own king would be left in check
    const pieceType = piece.toLowerCase();
    const isEnPassant = pieceType === 'p' && !targetPiece && enPassantTarget &&
                        toRow === enPassantTarget.row && toCol === enPassantTarget.col;
    const epPawnRow = fromRow; // Captured en passant pawn is on the same rank as fromRow
    const epCapturedPawn = isEnPassant ? board[epPawnRow][toCol] : '';

    // Apply move in-place
    board[toRow][toCol] = piece;
    board[fromRow][fromCol] = '';
    if (isEnPassant) {
        board[epPawnRow][toCol] = '';
    }

    const inCheck = isInCheck(player);

    // Restore board in-place
    board[fromRow][fromCol] = piece;
    board[toRow][toCol] = targetPiece;
    if (isEnPassant) {
        board[epPawnRow][toCol] = epCapturedPawn;
    }

    return !inCheck;
}

// Get all legal moves for a single piece at (row, col) using candidate generation
function getLegalMovesForPiece(row, col, player = currentPlayer) {
    const moves = [];
    const piece = board[row][col];
    if (!piece || !isOwnPiece(piece, player)) return moves;

    const pieceType = piece.toLowerCase();

    if (pieceType === 'p') {
        const direction = piece === 'P' ? -1 : 1;
        const startRow = piece === 'P' ? 6 : 1;
        const oneStep = row + direction;

        if (isOnBoard(oneStep, col)) {
            if (isValidMove(row, col, oneStep, col, player)) {
                moves.push({ row: oneStep, col });
            }
            const twoStep = row + 2 * direction;
            if (row === startRow && isOnBoard(twoStep, col) && isValidMove(row, col, twoStep, col, player)) {
                moves.push({ row: twoStep, col });
            }
            // Captures (including en passant)
            if (col > 0 && isValidMove(row, col, oneStep, col - 1, player)) {
                moves.push({ row: oneStep, col: col - 1 });
            }
            if (col < 7 && isValidMove(row, col, oneStep, col + 1, player)) {
                moves.push({ row: oneStep, col: col + 1 });
            }
        }
    } else if (pieceType === 'n') {
        for (let i = 0; i < KNIGHT_OFFSETS.length; i++) {
            const r = row + KNIGHT_OFFSETS[i][0];
            const c = col + KNIGHT_OFFSETS[i][1];
            if (isOnBoard(r, c) && isValidMove(row, col, r, c, player)) {
                moves.push({ row: r, col: c });
            }
        }
    } else if (pieceType === 'k') {
        for (let i = 0; i < KING_OFFSETS.length; i++) {
            const r = row + KING_OFFSETS[i][0];
            const c = col + KING_OFFSETS[i][1];
            if (isOnBoard(r, c) && isValidMove(row, col, r, c, player)) {
                moves.push({ row: r, col: c });
            }
        }
        // Castling candidates
        if (col === 4 && (row === 7 || row === 0)) {
            if (isValidMove(row, 4, row, 6, player)) moves.push({ row, col: 6 });
            if (isValidMove(row, 4, row, 2, player)) moves.push({ row, col: 2 });
        }
    } else {
        const dirs = pieceType === 'r' ? ROOK_DIRS : (pieceType === 'b' ? BISHOP_DIRS : QUEEN_DIRS);
        for (let d = 0; d < dirs.length; d++) {
            const dr = dirs[d][0];
            const dc = dirs[d][1];
            let r = row + dr;
            let c = col + dc;
            while (isOnBoard(r, c)) {
                const target = board[r][c];
                if (target) {
                    if (!isOwnPiece(target, player) && isValidMove(row, col, r, c, player)) {
                        moves.push({ row: r, col: c });
                    }
                    break; // Blocked by piece
                }
                if (isValidMove(row, col, r, c, player)) {
                    moves.push({ row: r, col: c });
                }
                r += dr;
                c += dc;
            }
        }
    }

    return moves;
}

// Get all legal moves for `player`
function getAllLegalMoves(player = currentPlayer) {
    const moves = [];
    for (let fromRow = 0; fromRow < 8; fromRow++) {
        const boardRow = board[fromRow];
        for (let fromCol = 0; fromCol < 8; fromCol++) {
            const piece = boardRow[fromCol];
            if (piece && isOwnPiece(piece, player)) {
                const pieceMoves = getLegalMovesForPiece(fromRow, fromCol, player);
                for (let i = 0; i < pieceMoves.length; i++) {
                    moves.push({
                        from: { row: fromRow, col: fromCol },
                        to: pieceMoves[i]
                    });
                }
            }
        }
    }
    return moves;
}

// Fast in-place move execution for AI search (no JSON.stringify, O(1) allocation)
function makeFastMove(move, player) {
    const fromRow = move.from.row;
    const fromCol = move.from.col;
    const toRow = move.to.row;
    const toCol = move.to.col;
    const piece = board[fromRow][fromCol];
    const pieceType = piece.toLowerCase();
    const capturedPiece = board[toRow][toCol];

    const state = {
        fromRow, fromCol, toRow, toCol,
        piece,
        capturedPiece,
        epCapturedPiece: '',
        epRow: -1,
        wasCastling: false,
        rookFromCol: -1,
        rookToCol: -1,
        oldEnPassantTarget: enPassantTarget,
        oldCurrentPlayer: currentPlayer,
        oldHalfMoveClock: halfMoveClock,
        wk: castlingRights.white.kingside,
        wq: castlingRights.white.queenside,
        bk: castlingRights.black.kingside,
        bq: castlingRights.black.queenside
    };

    // En passant capture
    if (pieceType === 'p' && !capturedPiece && enPassantTarget &&
        toRow === enPassantTarget.row && toCol === enPassantTarget.col) {
        state.epRow = fromRow;
        state.epCapturedPiece = board[fromRow][toCol];
        board[fromRow][toCol] = '';
    }

    // Castling rook move
    if (pieceType === 'k' && Math.abs(toCol - fromCol) === 2) {
        state.wasCastling = true;
        const isKingside = toCol > fromCol;
        state.rookFromCol = isKingside ? 7 : 0;
        state.rookToCol = isKingside ? toCol - 1 : toCol + 1;
        board[fromRow][state.rookToCol] = board[fromRow][state.rookFromCol];
        board[fromRow][state.rookFromCol] = '';
    }

    // Move piece (with promotion support)
    board[toRow][toCol] = piece;
    board[fromRow][fromCol] = '';

    if (pieceType === 'p' && (toRow === 0 || toRow === 7)) {
        const promo = move.promotion ? move.promotion : (player === 'white' ? 'Q' : 'q');
        board[toRow][toCol] = promo;
    }

    // En passant target update
    if (pieceType === 'p' && Math.abs(toRow - fromRow) === 2) {
        enPassantTarget = { row: (fromRow + toRow) >> 1, col: toCol };
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
    } else if (pieceType === 'r') {
        if (player === 'white' && fromRow === 7) {
            if (fromCol === 0) castlingRights.white.queenside = false;
            else if (fromCol === 7) castlingRights.white.kingside = false;
        } else if (player === 'black' && fromRow === 0) {
            if (fromCol === 0) castlingRights.black.queenside = false;
            else if (fromCol === 7) castlingRights.black.kingside = false;
        }
    }

    if (capturedPiece && (capturedPiece === 'R' || capturedPiece === 'r')) {
        if (toRow === 7 && toCol === 0) castlingRights.white.queenside = false;
        else if (toRow === 7 && toCol === 7) castlingRights.white.kingside = false;
        else if (toRow === 0 && toCol === 0) castlingRights.black.queenside = false;
        else if (toRow === 0 && toCol === 7) castlingRights.black.kingside = false;
    }

    if (pieceType === 'p' || capturedPiece || state.epCapturedPiece) {
        halfMoveClock = 0;
    } else {
        halfMoveClock++;
    }

    currentPlayer = player === 'white' ? 'black' : 'white';
    return state;
}

// Fast in-place move unmake for AI search
function unmakeFastMove(state) {
    board[state.fromRow][state.fromCol] = state.piece;
    board[state.toRow][state.toCol] = state.capturedPiece;

    if (state.epRow !== -1) {
        board[state.epRow][state.toCol] = state.epCapturedPiece;
    }

    if (state.wasCastling) {
        board[state.fromRow][state.rookFromCol] = board[state.fromRow][state.rookToCol];
        board[state.fromRow][state.rookToCol] = '';
    }

    enPassantTarget = state.oldEnPassantTarget;
    currentPlayer = state.oldCurrentPlayer;
    halfMoveClock = state.oldHalfMoveClock;
    castlingRights.white.kingside = state.wk;
    castlingRights.white.queenside = state.wq;
    castlingRights.black.kingside = state.bk;
    castlingRights.black.queenside = state.bq;
}

// Make a move - PURE function, returns result object
// Returns: { success: boolean, needsPromotion: boolean, moveInfo: object, gameOverResult: object }
function makeMove(fromRow, fromCol, toRow, toCol, promotionPiece = null) {
    if (!isOnBoard(fromRow, fromCol) || !isOnBoard(toRow, toCol)) {
        return { success: false };
    }
    const piece = board[fromRow][fromCol];
    if (!piece) {
        return { success: false };
    }

    const capturedPiece = board[toRow][toCol];
    const pieceType = piece.toLowerCase();
    const playerMakingMove = currentPlayer;

    // Save old en passant target before clearing
    const oldEnPassantTarget = enPassantTarget;
    enPassantTarget = null;

    // Detect en passant capture before saving state
    let enPassantCapture = null;
    if (pieceType === 'p' && !capturedPiece && oldEnPassantTarget &&
        toRow === oldEnPassantTarget.row && toCol === oldEnPassantTarget.col) {
        const capturedPawnRow = currentPlayer === 'white' ? toRow + 1 : toRow - 1;
        enPassantCapture = board[capturedPawnRow][toCol];
    }

    // Detect castling move
    const wasCastling = pieceType === 'k' && Math.abs(toCol - fromCol) === 2;

    // Save game state for undo
    moveHistory.push({
        from: { row: fromRow, col: fromCol },
        to: { row: toRow, col: toCol },
        piece: piece,
        captured: capturedPiece,
        enPassantCaptured: enPassantCapture,
        wasCastling: wasCastling,
        promotedTo: promotionPiece || null,
        playerSwitchCompleted: false,
        board: board.map(r => r.slice()),
        castlingRights: {
            white: { ...castlingRights.white },
            black: { ...castlingRights.black }
        },
        enPassantTarget: oldEnPassantTarget ? { ...oldEnPassantTarget } : null,
        halfMoveClock: halfMoveClock,
        fullMoveNumber: fullMoveNumber
    });

    // Update halfmove clock (for 50-move rule)
    if (pieceType === 'p' || capturedPiece || enPassantCapture) {
        halfMoveClock = 0;
    } else {
        halfMoveClock++;
    }

    // Handle en passant capture
    if (enPassantCapture) {
        const capturedPawnRow = currentPlayer === 'white' ? toRow + 1 : toRow - 1;
        board[capturedPawnRow][toCol] = '';
        if (isOwnPiece(enPassantCapture, 'white')) {
            capturedPieces.black.push(enPassantCapture);
        } else {
            capturedPieces.white.push(enPassantCapture);
        }
    }

    // Capture piece (normal)
    if (capturedPiece) {
        if (isOwnPiece(capturedPiece, 'white')) {
            capturedPieces.black.push(capturedPiece);
        } else {
            capturedPieces.white.push(capturedPiece);
        }
    }

    // Handle castling - move rook
    if (wasCastling) {
        const isKingside = toCol > fromCol;
        const rookFromCol = isKingside ? 7 : 0;
        const rookToCol = isKingside ? toCol - 1 : toCol + 1;
        const rook = board[fromRow][rookFromCol];
        board[fromRow][rookToCol] = rook;
        board[fromRow][rookFromCol] = '';
    }

    // Move piece
    board[toRow][toCol] = piece;
    board[fromRow][fromCol] = '';

    // Update castling rights when king or rook moves (check BOTH fromRow and fromCol)
    if (pieceType === 'k') {
        if (currentPlayer === 'white') {
            castlingRights.white.kingside = false;
            castlingRights.white.queenside = false;
        } else {
            castlingRights.black.kingside = false;
            castlingRights.black.queenside = false;
        }
    } else if (pieceType === 'r') {
        if (currentPlayer === 'white' && fromRow === 7) {
            if (fromCol === 0) castlingRights.white.queenside = false;
            if (fromCol === 7) castlingRights.white.kingside = false;
        } else if (currentPlayer === 'black' && fromRow === 0) {
            if (fromCol === 0) castlingRights.black.queenside = false;
            if (fromCol === 7) castlingRights.black.kingside = false;
        }
    }

    // Update castling rights when a corner rook is captured (executed BEFORE promotion early return!)
    if (capturedPiece && capturedPiece.toLowerCase() === 'r') {
        if (toRow === 7 && toCol === 0) castlingRights.white.queenside = false;
        if (toRow === 7 && toCol === 7) castlingRights.white.kingside = false;
        if (toRow === 0 && toCol === 0) castlingRights.black.queenside = false;
        if (toRow === 0 && toCol === 7) castlingRights.black.kingside = false;
    }

    // Check for pawn promotion
    if (pieceType === 'p' && (toRow === 0 || toRow === 7)) {
        if (promotionPiece) {
            board[toRow][toCol] = promotionPiece;
        } else {
            // Need to show promotion dialog - don't finalize turn switch yet
            pendingPromotion = { row: toRow, col: toCol };
            return {
                success: true,
                needsPromotion: true,
                moveInfo: {
                    from: { row: fromRow, col: fromCol },
                    to: { row: toRow, col: toCol },
                    piece: piece,
                    captured: capturedPiece,
                    player: playerMakingMove
                }
            };
        }
    }

    // Set en passant target if pawn moved two squares
    if (pieceType === 'p' && Math.abs(toRow - fromRow) === 2) {
        enPassantTarget = { row: (fromRow + toRow) / 2, col: toCol };
    }

    // Update last move
    lastMove = { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } };

    // Build move info for UI
    const moveInfo = {
        from: { row: fromRow, col: fromCol },
        to: { row: toRow, col: toCol },
        piece: piece,
        captured: capturedPiece || enPassantCapture,
        player: playerMakingMove,
        moveNumber: fullMoveNumber,
        promotedTo: promotionPiece || null
    };

    // Switch player
    currentPlayer = currentPlayer === 'white' ? 'black' : 'white';
    moveHistory[moveHistory.length - 1].playerSwitchCompleted = true;

    // Update fullmove number (increments after black's move)
    if (currentPlayer === 'white') {
        fullMoveNumber++;
    }

    // Track position for threefold repetition
    positionHistory.push(getPositionKey());

    // Check game over conditions
    const gameOverResult = checkGameOver();

    return {
        success: true,
        needsPromotion: false,
        moveInfo: moveInfo,
        gameOverResult: gameOverResult
    };
}

// Complete a pending promotion
function completePromotion(promotionPiece) {
    if (!pendingPromotion) return null;

    const row = pendingPromotion.row;
    const col = pendingPromotion.col;
    const playerMakingMove = currentPlayer;

    board[row][col] = promotionPiece;
    pendingPromotion = null;

    // Update the original move info in history so Undo preserves promotedTo
    const lastMoveData = moveHistory[moveHistory.length - 1];
    lastMoveData.promotedTo = promotionPiece;
    lastMoveData.playerSwitchCompleted = true;

    const moveInfo = {
        from: lastMoveData.from,
        to: { row, col },
        piece: lastMoveData.piece,
        captured: lastMoveData.captured,
        player: playerMakingMove,
        moveNumber: fullMoveNumber,
        promotedTo: promotionPiece
    };

    // Update last move
    lastMove = { from: lastMoveData.from, to: { row, col } };

    // Switch player
    currentPlayer = currentPlayer === 'white' ? 'black' : 'white';

    // Update fullmove number (increments after black's move)
    if (currentPlayer === 'white') {
        fullMoveNumber++;
    }

    // Track position for threefold repetition
    positionHistory.push(getPositionKey());

    // Check game over conditions
    const gameOverResult = checkGameOver();

    return {
        success: true,
        moveInfo: moveInfo,
        gameOverResult: gameOverResult
    };
}

// Cancel a pending promotion and revert the uncompleted pawn move
function cancelPendingPromotion() {
    if (!pendingPromotion) return false;
    pendingPromotion = null;
    undoSingleMove();
    return true;
}

// Check if an en passant target actually has a legal en passant capture by `player` (FIDE rule)
function hasLegalEnPassantCapture(player = currentPlayer) {
    if (!enPassantTarget) return false;
    const epRow = enPassantTarget.row;
    const epCol = enPassantTarget.col;
    const pawnRow = player === 'white' ? epRow + 1 : epRow - 1;
    const ownPawn = player === 'white' ? 'P' : 'p';

    if (!isOnBoard(pawnRow, epCol)) return false;

    if (epCol > 0 && board[pawnRow][epCol - 1] === ownPawn) {
        if (isValidMove(pawnRow, epCol - 1, epRow, epCol, player)) return true;
    }
    if (epCol < 7 && board[pawnRow][epCol + 1] === ownPawn) {
        if (isValidMove(pawnRow, epCol + 1, epRow, epCol, player)) return true;
    }
    return false;
}

// Generate position key for threefold repetition (FIDE rules: only include legal en passant)
function getPositionKey() {
    const effectiveEp = hasLegalEnPassantCapture(currentPlayer) ? enPassantTarget : null;
    let boardStr = '';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            boardStr += board[r][c] || '.';
        }
    }
    const cRights = `${castlingRights.white.kingside ? 'K' : ''}${castlingRights.white.queenside ? 'Q' : ''}${castlingRights.black.kingside ? 'k' : ''}${castlingRights.black.queenside ? 'q' : ''}`;
    const epStr = effectiveEp ? `${effectiveEp.row},${effectiveEp.col}` : '-';
    return `${boardStr}|${currentPlayer}|${cRights}|${epStr}`;
}

// Compute 64-bit Zobrist hash ({ lo, hi }) for current position
function computeHash() {
    let lo = 0;
    let hi = 0;
    for (let row = 0; row < 8; row++) {
        const boardRow = board[row];
        for (let col = 0; col < 8; col++) {
            const piece = boardRow[col];
            if (piece) {
                const sq = (row << 3) | col;
                const z = ZOBRIST.pieces[sq][PIECE_INDEX[piece]];
                lo ^= z.lo;
                hi ^= z.hi;
            }
        }
    }
    // Castling rights
    if (castlingRights.white.kingside) {
        lo ^= ZOBRIST.castling[0].lo;
        hi ^= ZOBRIST.castling[0].hi;
    }
    if (castlingRights.white.queenside) {
        lo ^= ZOBRIST.castling[1].lo;
        hi ^= ZOBRIST.castling[1].hi;
    }
    if (castlingRights.black.kingside) {
        lo ^= ZOBRIST.castling[2].lo;
        hi ^= ZOBRIST.castling[2].hi;
    }
    if (castlingRights.black.queenside) {
        lo ^= ZOBRIST.castling[3].lo;
        hi ^= ZOBRIST.castling[3].hi;
    }
    // En passant (only when a legal en passant capture exists, matching FIDE rules)
    if (enPassantTarget && hasLegalEnPassantCapture(currentPlayer)) {
        const zEp = ZOBRIST.enPassant[enPassantTarget.col];
        lo ^= zEp.lo;
        hi ^= zEp.hi;
    }
    // Side to move
    if (currentPlayer === 'black') {
        lo ^= ZOBRIST.side.lo;
        hi ^= ZOBRIST.side.hi;
    }
    return { lo: lo >>> 0, hi: hi >>> 0 };
}

// Check for Insufficient Material draw (FIDE dead positions: K vs K, K+B vs K, K+N vs K, K+B vs K+B same color)
function isInsufficientMaterial() {
    let minorCount = 0;
    let bishopColors = [];

    for (let r = 0; r < 8; r++) {
        const boardRow = board[r];
        for (let c = 0; c < 8; c++) {
            const piece = boardRow[c];
            if (!piece) continue;
            const type = piece.toLowerCase();
            if (type === 'p' || type === 'r' || type === 'q') {
                return false; // Enough mating material exists
            }
            if (type === 'n') {
                minorCount++;
            } else if (type === 'b') {
                minorCount++;
                bishopColors.push((r + c) & 1);
            }
            if (minorCount > 2) return false;
        }
    }

    // K vs K, K+N vs K, K+B vs K
    if (minorCount <= 1) return true;

    // Two minor pieces: only insufficient if both are bishops on the same color square
    if (minorCount === 2 && bishopColors.length === 2 && bishopColors[0] === bishopColors[1]) {
        return true;
    }

    return false;
}

// Check if game is over - PURE function, returns result object
// Returns: { isOver: boolean, reason: string, message: string, winner: string|null }
function checkGameOver() {
    // 1. Check for Insufficient Material draw
    if (isInsufficientMaterial()) {
        gameOver = true;
        selectedSquare = null;
        gameOverReason = 'Draw by Insufficient Material';
        return {
            isOver: true,
            reason: 'Insufficient Material',
            message: 'Neither player has sufficient material to checkmate. The game is a draw.',
            winner: null
        };
    }

    // 2. Check for 50-move rule (100 half-moves = 50 full moves)
    if (halfMoveClock >= 100) {
        gameOver = true;
        selectedSquare = null;
        gameOverReason = '50-Move Rule Draw';
        return {
            isOver: true,
            reason: '50-Move Rule Draw',
            message: '50 moves without a capture or pawn move. The game is a draw.',
            winner: null
        };
    }

    // 3. Check for threefold repetition
    if (positionHistory.length > 0) {
        const currentPosition = positionHistory[positionHistory.length - 1];
        let repetitions = 0;
        for (let i = 0; i < positionHistory.length; i++) {
            if (positionHistory[i] === currentPosition) repetitions++;
        }
        if (repetitions >= 3) {
            gameOver = true;
            selectedSquare = null;
            gameOverReason = 'Draw by Repetition';
            return {
                isOver: true,
                reason: 'Draw by Repetition',
                message: 'The same position occurred three times. The game is a draw.',
                winner: null
            };
        }
    }

    // 4. Check for Checkmate or Stalemate
    const moves = getAllLegalMoves(currentPlayer);

    if (moves.length === 0) {
        gameOver = true;
        selectedSquare = null;

        if (isInCheck(currentPlayer)) {
            const winner = currentPlayer === 'white' ? 'Black' : 'White';
            gameOverReason = `Checkmate - ${winner} wins!`;
            return {
                isOver: true,
                reason: 'Checkmate!',
                message: `${winner} wins!`,
                winner: winner.toLowerCase()
            };
        } else {
            gameOverReason = 'Stalemate - Draw';
            return {
                isOver: true,
                reason: 'Stalemate!',
                message: 'No legal moves available. The game is a draw.',
                winner: null
            };
        }
    }

    return { isOver: false };
}

// Undo a single move and restore game state - PURE function
// Returns: { success: boolean, undoneMove: object|null }
function undoSingleMove() {
    if (moveHistory.length === 0) return { success: false, undoneMove: null };

    const lastMoveData = moveHistory.pop();
    board = lastMoveData.board;
    castlingRights = lastMoveData.castlingRights;
    enPassantTarget = lastMoveData.enPassantTarget;
    halfMoveClock = lastMoveData.halfMoveClock;
    fullMoveNumber = lastMoveData.fullMoveNumber;
    pendingPromotion = null;

    // Only flip currentPlayer and pop positionHistory if the move had completed its turn switch
    if (lastMoveData.playerSwitchCompleted !== false) {
        currentPlayer = currentPlayer === 'white' ? 'black' : 'white';
        if (positionHistory.length > 1) {
            positionHistory.pop();
        }
    }

    // Update captured pieces (normal captures)
    if (lastMoveData.captured) {
        const capturedBy = isOwnPiece(lastMoveData.captured, 'white') ? 'black' : 'white';
        const index = capturedPieces[capturedBy].lastIndexOf(lastMoveData.captured);
        if (index > -1) {
            capturedPieces[capturedBy].splice(index, 1);
        }
    }

    // Update captured pieces (en passant)
    if (lastMoveData.enPassantCaptured) {
        const capturedBy = isOwnPiece(lastMoveData.enPassantCaptured, 'white') ? 'black' : 'white';
        const index = capturedPieces[capturedBy].lastIndexOf(lastMoveData.enPassantCaptured);
        if (index > -1) {
            capturedPieces[capturedBy].splice(index, 1);
        }
    }

    // Update last move
    if (moveHistory.length > 0) {
        lastMove = {
            from: moveHistory[moveHistory.length - 1].from,
            to: moveHistory[moveHistory.length - 1].to
        };
    } else {
        lastMove = null;
    }

    return { success: true, undoneMove: lastMoveData };
}
