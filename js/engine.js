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

// Initialize the game to starting position
function initGame() {
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
    castlingRights = { white: { kingside: true, queenside: true }, black: { kingside: true, queenside: true } };
    enPassantTarget = null;
    halfMoveClock = 0;
    fullMoveNumber = 1;
    lastMove = null;
    pendingPromotion = null;
    positionHistory = [];
}

// Check if piece belongs to player
function isOwnPiece(piece, player) {
    if (player === 'white') {
        return piece === piece.toUpperCase();
    } else {
        return piece === piece.toLowerCase();
    }
}

// Get all legal moves for a piece
function getLegalMovesForPiece(row, col) {
    const moves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (isValidMove(row, col, r, c)) {
                moves.push({ row: r, col: c });
            }
        }
    }
    return moves;
}

// Check if move is valid
function isValidMove(fromRow, fromCol, toRow, toCol) {
    // Can't move to same square
    if (fromRow === toRow && fromCol === toCol) return false;

    const piece = board[fromRow][fromCol];
    if (!piece) return false;

    // Must move own piece
    if (!isOwnPiece(piece, currentPlayer)) {
        return false;
    }

    const targetPiece = board[toRow][toCol];

    // Can't capture own piece
    if (targetPiece && isOwnPiece(targetPiece, currentPlayer)) {
        return false;
    }

    // Check piece-specific movement rules
    if (!isPieceMovementValid(piece, fromRow, fromCol, toRow, toCol)) {
        return false;
    }

    // Simulate move and check if king would be in check
    const tempBoard = JSON.parse(JSON.stringify(board));
    board[toRow][toCol] = board[fromRow][fromCol];
    board[fromRow][fromCol] = '';

    const inCheck = isInCheck(currentPlayer);

    // Restore board
    board = tempBoard;

    return !inCheck;
}

// Validate piece movement rules
function isPieceMovementValid(piece, fromRow, fromCol, toRow, toCol) {
    const pieceType = piece.toLowerCase();
    const rowDiff = toRow - fromRow;
    const colDiff = toCol - fromCol;
    const direction = piece === piece.toUpperCase() ? -1 : 1; // White moves up, black moves down

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
            if (Math.abs(colDiff) === 1 && rowDiff === direction) {
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
            return (Math.abs(rowDiff) === 2 && Math.abs(colDiff) === 1) ||
                   (Math.abs(rowDiff) === 1 && Math.abs(colDiff) === 2);

        case 'b': // Bishop
            if (Math.abs(rowDiff) === Math.abs(colDiff)) {
                return isPathClear(fromRow, fromCol, toRow, toCol);
            }
            return false;

        case 'q': // Queen
            if (rowDiff === 0 || colDiff === 0 || Math.abs(rowDiff) === Math.abs(colDiff)) {
                return isPathClear(fromRow, fromCol, toRow, toCol);
            }
            return false;

        case 'k': // King
            // Normal king move (but not staying in place)
            if (Math.abs(rowDiff) <= 1 && Math.abs(colDiff) <= 1 && (rowDiff !== 0 || colDiff !== 0)) {
                return true;
            }
            // Castling
            if (rowDiff === 0 && Math.abs(colDiff) === 2) {
                return canCastle(fromRow, fromCol, toRow, toCol);
            }
            return false;

        default:
            return false;
    }
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

// Check if castling is possible
function canCastle(fromRow, fromCol, toRow, toCol) {
    const player = currentPlayer;
    const isKingside = toCol > fromCol;

    // Check castling rights
    if (player === 'white') {
        if (isKingside && !castlingRights.white.kingside) return false;
        if (!isKingside && !castlingRights.white.queenside) return false;
    } else {
        if (isKingside && !castlingRights.black.kingside) return false;
        if (!isKingside && !castlingRights.black.queenside) return false;
    }

    // Check if king is in check
    if (isInCheck(player)) return false;

    // Check if path is clear between king and rook
    const rookCol = isKingside ? 7 : 0;
    const step = isKingside ? 1 : -1;
    for (let col = fromCol + step; col !== rookCol; col += step) {
        if (board[fromRow][col]) return false;
    }

    // Check if king passes through or ends in check
    const originalBoard = JSON.parse(JSON.stringify(board));
    const king = player === 'white' ? 'K' : 'k';

    try {
        for (let col = fromCol; col !== toCol + step; col += step) {
            const testBoard = JSON.parse(JSON.stringify(originalBoard));
            testBoard[fromRow][fromCol] = '';
            testBoard[fromRow][col] = king;

            board = testBoard;
            if (isInCheck(player)) {
                board = originalBoard;
                return false;
            }
        }
        board = originalBoard;
        return true;
    } catch (error) {
        board = originalBoard;
        return false;
    }
}

// Make a move - PURE function, returns result object
// Returns: { success: boolean, needsPromotion: boolean, moveInfo: object }
function makeMove(fromRow, fromCol, toRow, toCol, promotionPiece = null) {
    const piece = board[fromRow][fromCol];
    const capturedPiece = board[toRow][toCol];
    const pieceType = piece.toLowerCase();
    const playerMakingMove = currentPlayer;

    // Save old en passant target before clearing
    const oldEnPassantTarget = enPassantTarget;
    enPassantTarget = null;

    // Detect en passant capture before saving state
    let enPassantCapture = null;
    if (pieceType === 'p' && oldEnPassantTarget && toRow === oldEnPassantTarget.row && toCol === oldEnPassantTarget.col) {
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
        board: JSON.parse(JSON.stringify(board)),
        castlingRights: JSON.parse(JSON.stringify(castlingRights)),
        enPassantTarget: oldEnPassantTarget,
        halfMoveClock: halfMoveClock,
        fullMoveNumber: fullMoveNumber
    });

    // Update halfmove clock (for 50-move rule)
    if (pieceType === 'p' || capturedPiece) {
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
    if (pieceType === 'k' && Math.abs(toCol - fromCol) === 2) {
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

    // Check for pawn promotion
    if (pieceType === 'p' && (toRow === 0 || toRow === 7)) {
        if (promotionPiece) {
            board[toRow][toCol] = promotionPiece;
        } else {
            // Need to show promotion dialog - don't finalize move yet
            pendingPromotion = { row: toRow, col: toCol };
            return {
                success: true,
                needsPromotion: true,
                moveInfo: {
                    from: { row: fromRow, col: fromCol },
                    to: { row: toRow, col: toCol },
                    piece: piece,
                    player: playerMakingMove
                }
            };
        }
    }

    // Set en passant target if pawn moved two squares
    if (pieceType === 'p' && Math.abs(toRow - fromRow) === 2) {
        enPassantTarget = { row: (fromRow + toRow) / 2, col: toCol };
    }

    // Update castling rights when king or rook moves
    if (pieceType === 'k') {
        if (currentPlayer === 'white') {
            castlingRights.white.kingside = false;
            castlingRights.white.queenside = false;
        } else {
            castlingRights.black.kingside = false;
            castlingRights.black.queenside = false;
        }
    }
    if (pieceType === 'r') {
        if (currentPlayer === 'white') {
            if (fromCol === 0) castlingRights.white.queenside = false;
            if (fromCol === 7) castlingRights.white.kingside = false;
        } else {
            if (fromCol === 0) castlingRights.black.queenside = false;
            if (fromCol === 7) castlingRights.black.kingside = false;
        }
    }

    // Update castling rights when rook is captured
    if (capturedPiece && capturedPiece.toLowerCase() === 'r') {
        if (toRow === 7 && toCol === 0) castlingRights.white.queenside = false;
        if (toRow === 7 && toCol === 7) castlingRights.white.kingside = false;
        if (toRow === 0 && toCol === 0) castlingRights.black.queenside = false;
        if (toRow === 0 && toCol === 7) castlingRights.black.kingside = false;
    }

    // Update last move
    lastMove = { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } };

    // Build move info for UI
    const moveInfo = {
        from: { row: fromRow, col: fromCol },
        to: { row: toRow, col: toCol },
        piece: piece,
        player: playerMakingMove,
        moveNumber: fullMoveNumber
    };

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

    // Get the original move info from history
    const lastMoveData = moveHistory[moveHistory.length - 1];
    const moveInfo = {
        from: lastMoveData.from,
        to: { row, col },
        piece: lastMoveData.piece,
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

// Check if king is in check
function isInCheck(player) {
    const kingPos = findKing(player);
    if (!kingPos) return false;

    const opponent = player === 'white' ? 'black' : 'white';

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece && isOwnPiece(piece, opponent)) {
                if (isPieceMovementValid(piece, row, col, kingPos.row, kingPos.col)) {
                    return true;
                }
            }
        }
    }

    return false;
}

// Find king position
function findKing(player) {
    const kingPiece = player === 'white' ? 'K' : 'k';
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if (board[row][col] === kingPiece) {
                return { row, col };
            }
        }
    }
    return null;
}

// Generate position key for threefold repetition (FIDE rules)
function getPositionKey() {
    return JSON.stringify({
        board: board,
        player: currentPlayer,
        castling: castlingRights,
        enPassant: enPassantTarget
    });
}

// Compute Zobrist hash for current position
function computeHash() {
    let hash = 0;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece) {
                const sq = row * 8 + col;
                hash ^= ZOBRIST.pieces[sq][PIECE_INDEX[piece]];
            }
        }
    }
    // Castling rights
    if (castlingRights.white.kingside) hash ^= ZOBRIST.castling[0];
    if (castlingRights.white.queenside) hash ^= ZOBRIST.castling[1];
    if (castlingRights.black.kingside) hash ^= ZOBRIST.castling[2];
    if (castlingRights.black.queenside) hash ^= ZOBRIST.castling[3];
    // En passant
    if (enPassantTarget) hash ^= ZOBRIST.enPassant[enPassantTarget.col];
    // Side to move
    if (currentPlayer === 'black') hash ^= ZOBRIST.side;
    return hash >>> 0; // Ensure unsigned
}

// Get all legal moves for current player
function getAllLegalMoves(player) {
    const moves = [];
    for (let fromRow = 0; fromRow < 8; fromRow++) {
        for (let fromCol = 0; fromCol < 8; fromCol++) {
            const piece = board[fromRow][fromCol];
            if (piece && isOwnPiece(piece, player)) {
                for (let toRow = 0; toRow < 8; toRow++) {
                    for (let toCol = 0; toCol < 8; toCol++) {
                        const originalPlayer = currentPlayer;
                        currentPlayer = player;
                        if (isValidMove(fromRow, fromCol, toRow, toCol)) {
                            moves.push({
                                from: { row: fromRow, col: fromCol },
                                to: { row: toRow, col: toCol }
                            });
                        }
                        currentPlayer = originalPlayer;
                    }
                }
            }
        }
    }
    return moves;
}

// Check if game is over - PURE function, returns result object
// Returns: { isOver: boolean, reason: string, winner: string|null }
function checkGameOver() {
    // Check for 50-move rule (100 half-moves = 50 full moves)
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

    // Check for threefold repetition
    if (positionHistory.length > 0) {
        const currentPosition = positionHistory[positionHistory.length - 1];
        const repetitions = positionHistory.filter(pos => pos === currentPosition).length;
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
                message: 'The game is a draw.',
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
    currentPlayer = currentPlayer === 'white' ? 'black' : 'white';

    // Clean up position history
    if (positionHistory.length > 0) {
        positionHistory.pop();
    }

    // Update captured pieces (normal captures)
    if (lastMoveData.captured) {
        const capturedBy = isOwnPiece(lastMoveData.captured, 'white') ? 'black' : 'white';
        const index = capturedPieces[capturedBy].indexOf(lastMoveData.captured);
        if (index > -1) {
            capturedPieces[capturedBy].splice(index, 1);
        }
    }

    // Update captured pieces (en passant)
    if (lastMoveData.enPassantCaptured) {
        const capturedBy = isOwnPiece(lastMoveData.enPassantCaptured, 'white') ? 'black' : 'white';
        const index = capturedPieces[capturedBy].indexOf(lastMoveData.enPassantCaptured);
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
