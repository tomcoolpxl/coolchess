// Chess pieces Unicode characters
const PIECES = {
    'K': '♚', 'Q': '♛', 'R': '♜', 'B': '♝', 'N': '♞', 'P': '♟',
    'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
};

const PIECES_HOLLOW = {
    'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
    'k': '♔', 'q': '♕', 'r': '♖', 'b': '♗', 'n': '♘', 'p': '♙'
};

// Timing constants (in milliseconds)
const ARROW_FADE_DELAY = 4000;       // Time before move arrow starts fading
const ARROW_FADE_DURATION = 500;     // Duration of fade animation
const HINT_ARROW_DISPLAY_TIME = 1500; // Time hint arrow is shown
const GAME_OVER_DIALOG_DELAY = 2000; // Time game over dialog is shown
const AI_MOVE_DELAY = 500;           // Delay before AI makes a move
const AI_WATCH_DELAY = 1000;         // Delay between AI moves in watch mode
const AI_THINKING_MIN_DISPLAY = 300; // Minimum display time for thinking indicator

// Game state
let board = [];
let selectedSquare = null;
let currentPlayer = 'white';
let gameMode = 'ai';
let aiDifficulty = 2;
let aiDifficultyWhite = 2;
let aiDifficultyBlack = 2;
let showLegalMovesEnabled = true;
let moveHistory = [];
let capturedPieces = { white: [], black: [] };
let gameOver = false;
let castlingRights = { white: { kingside: true, queenside: true }, black: { kingside: true, queenside: true } };
let enPassantTarget = null;
let halfMoveClock = 0;
let fullMoveNumber = 1;
let lastMove = null;
let pendingPromotion = null;
let arrowFadeTimeout = null;
let arrowFadeTimeoutMove = null;
let arrowRemovalTimeout = null; // Track nested timeout for arrow removal
let hintArrowTimeout = null; // Track hint arrow fade timeout
let hintArrowRemovalTimeout = null; // Track hint arrow removal timeout
let positionHistory = [];
let watchMatchRunning = false;
let gameOverReason = '';
let gameOverDialogTimeout = null;
let aiMoveTimeout = null;
let isSyncingUI = false; // Guard flag for UI sync to prevent circular updates

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

// Initialize the game
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

    // Clear SVG arrows
    const svg = document.getElementById('moveArrowSvg');
    if (svg) {
        const arrows = svg.querySelectorAll('line, circle, .hint-arrow');
        arrows.forEach(el => el.remove());
        svg.classList.remove('fade-out');
        svg.style.opacity = '1';
    }

    // Clear all timeouts
    if (arrowFadeTimeout) {
        clearTimeout(arrowFadeTimeout);
        arrowFadeTimeout = null;
    }
    if (arrowRemovalTimeout) {
        clearTimeout(arrowRemovalTimeout);
        arrowRemovalTimeout = null;
    }
    if (hintArrowTimeout) {
        clearTimeout(hintArrowTimeout);
        hintArrowTimeout = null;
    }
    if (hintArrowRemovalTimeout) {
        clearTimeout(hintArrowRemovalTimeout);
        hintArrowRemovalTimeout = null;
    }
    arrowFadeTimeoutMove = null;

    if (gameOverDialogTimeout) {
        clearTimeout(gameOverDialogTimeout);
        gameOverDialogTimeout = null;
    }

    if (aiMoveTimeout) {
        clearTimeout(aiMoveTimeout);
        aiMoveTimeout = null;
    }

    // Ensure all overlays and dialogs are hidden
    document.getElementById('overlay').classList.remove('show');
    document.getElementById('promotionDialog').classList.remove('show');
    document.getElementById('aiThinking').classList.remove('show');
    const mobileAiThinking = document.getElementById('mobileAiThinking');
    if (mobileAiThinking) {
        mobileAiThinking.classList.remove('show');
    }

    renderBoard();
    updateStatus();
    updateCapturedPieces();
    updateEvaluationBar();
    updateMoveCounter();
    updateButtonStates();
    document.getElementById('moveHistory').innerHTML = '';
    document.getElementById('mobileMoveHistory').innerHTML = '';
    document.getElementById('hintText').style.display = 'none';
}

// Render the chessboard
function renderBoard() {
    const boardWrapper = document.querySelector('.board-with-coords');
    const chessboard = document.getElementById('chessboard');
    chessboard.innerHTML = '';

    // Remove old coordinates
    document.querySelectorAll('.coord-label').forEach(el => el.remove());

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.className = 'square ' + ((row + col) % 2 === 0 ? 'light' : 'dark');
            square.dataset.row = row;
            square.dataset.col = col;

            // Highlight last move
            if (lastMove &&
                ((lastMove.from.row === row && lastMove.from.col === col) ||
                 (lastMove.to.row === row && lastMove.to.col === col))) {
                square.classList.add('last-move');
            }

            const piece = board[row][col];
            if (piece) {
                const pieceSpan = document.createElement('span');
                const isWhitePiece = piece === piece.toUpperCase();
                pieceSpan.className = isWhitePiece ? 'piece piece-white' : 'piece piece-black';
                pieceSpan.textContent = PIECES[piece];
                square.appendChild(pieceSpan);
            }

            // Add coordinates to first column and last row
            if (col === 0) {
                const rankLabel = document.createElement('div');
                rankLabel.className = 'coord-label coord-rank';
                rankLabel.textContent = 8 - row;
                square.appendChild(rankLabel);
            }
            if (row === 7) {
                const fileLabel = document.createElement('div');
                fileLabel.className = 'coord-label coord-file';
                fileLabel.textContent = String.fromCharCode(97 + col);
                square.appendChild(fileLabel);
            }

            square.addEventListener('click', () => handleSquareClick(row, col));
            chessboard.appendChild(square);
        }
    }

    // Highlight king if in check
    if (isInCheck(currentPlayer)) {
        const kingPos = findKing(currentPlayer);
        if (kingPos) {
            const kingSquare = document.querySelector(`[data-row="${kingPos.row}"][data-col="${kingPos.col}"]`);
            if (kingSquare) {
                kingSquare.classList.add('check');
            }
        }
    }

    // Draw arrow for last move
    drawMoveArrow();
}

// Draw arrow showing last move
function drawMoveArrow() {
    const svg = document.getElementById('moveArrowSvg');

    // Remove old arrows (including hint arrows)
    const oldArrows = svg.querySelectorAll('line, circle, .hint-arrow');
    oldArrows.forEach(el => el.remove());

    // Clear hint arrow timeouts when move is made
    if (hintArrowTimeout) {
        clearTimeout(hintArrowTimeout);
        hintArrowTimeout = null;
    }
    if (hintArrowRemovalTimeout) {
        clearTimeout(hintArrowRemovalTimeout);
        hintArrowRemovalTimeout = null;
    }

    // Clear hint text when a move is made
    const hintText = document.getElementById('hintText');
    if (hintText) {
        hintText.style.display = 'none';
        hintText.textContent = '';
    }

    if (!lastMove) {
        // Clear timeout if no move to show
        if (arrowFadeTimeout) {
            clearTimeout(arrowFadeTimeout);
            arrowFadeTimeout = null;
            arrowFadeTimeoutMove = null;
        }
        return;
    }

    // Check if this is a new move (different from the one we set timeout for)
    const moveKey = `${lastMove.from.row},${lastMove.from.col}->${lastMove.to.row},${lastMove.to.col}`;
    const isNewMove = moveKey !== arrowFadeTimeoutMove;

    if (isNewMove) {
        // Clear old timeouts and reset opacity for new move
        if (arrowFadeTimeout) {
            clearTimeout(arrowFadeTimeout);
        }
        if (arrowRemovalTimeout) {
            clearTimeout(arrowRemovalTimeout);
        }
        svg.classList.remove('fade-out');
        svg.style.opacity = '1';
        arrowFadeTimeoutMove = moveKey;

        // Set new timeout for this move
        arrowFadeTimeout = setTimeout(() => {
            svg.classList.add('fade-out');
            // Remove arrows after fade completes
            arrowRemovalTimeout = setTimeout(() => {
                const arrows = svg.querySelectorAll('line, circle');
                arrows.forEach(el => el.remove());
                svg.classList.remove('fade-out');
                arrowRemovalTimeout = null;
            }, 500); // Wait for 0.5s fade transition to complete
        }, 4000);
    }

    // Get actual square size from rendered board
    const boardSquare = document.querySelector('.square');
    const squareSize = boardSquare ? boardSquare.offsetWidth : 70;
    const fromX = lastMove.from.col * squareSize + squareSize / 2;
    const fromY = lastMove.from.row * squareSize + squareSize / 2;
    const toX = lastMove.to.col * squareSize + squareSize / 2;
    const toY = lastMove.to.row * squareSize + squareSize / 2;

    // Scale arrow elements based on square size
    const circleRadius = squareSize / 8.75; // 8 for 70px squares
    const strokeWidth = squareSize / 14; // 5 for 70px squares

    // Draw a circle at the start position
    const startCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    startCircle.setAttribute('cx', fromX);
    startCircle.setAttribute('cy', fromY);
    startCircle.setAttribute('r', circleRadius.toString());
    startCircle.setAttribute('fill', 'rgba(255, 170, 0, 0.5)');
    startCircle.setAttribute('stroke', 'rgba(255, 140, 0, 0.7)');
    startCircle.setAttribute('stroke-width', '1.5');
    svg.appendChild(startCircle);

    // Draw arrow line
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    arrow.setAttribute('x1', fromX);
    arrow.setAttribute('y1', fromY);
    arrow.setAttribute('x2', toX);
    arrow.setAttribute('y2', toY);
    arrow.setAttribute('stroke', 'rgba(255, 170, 0, 0.7)');
    arrow.setAttribute('stroke-width', strokeWidth.toString());
    arrow.setAttribute('marker-end', 'url(#arrowhead)');
    arrow.setAttribute('stroke-linecap', 'round');
    svg.appendChild(arrow);
}

// Handle square click
function handleSquareClick(row, col) {
    if (gameOver) return;
    if (gameMode === 'watch') return;
    if (gameMode === 'ai' && currentPlayer === 'black') return;

    const piece = board[row][col];

    if (selectedSquare) {
        const fromRow = selectedSquare.row;
        const fromCol = selectedSquare.col;

        // Try to make the move
        if (isValidMove(fromRow, fromCol, row, col)) {
            makeMove(fromRow, fromCol, row, col);
            selectedSquare = null;
            renderBoard();

            if (!gameOver) {
                if (gameMode === 'ai' && currentPlayer === 'black') {
                    setTimeout(() => {
                        if (!gameOver) makeAIMove();
                    }, 500);
                } else if (gameMode === 'watch' && watchMatchRunning) {
                    setTimeout(() => {
                        if (!gameOver && watchMatchRunning) makeAIMove();
                    }, 1000);
                }
            }
        } else {
            // If clicking on own piece, select it instead
            if (piece && isOwnPiece(piece, currentPlayer)) {
                selectedSquare = { row, col };
                renderBoard();
                highlightLegalMoves(row, col);
            } else {
                selectedSquare = null;
                renderBoard();
            }
        }
    } else {
        // Select piece
        if (piece && isOwnPiece(piece, currentPlayer)) {
            selectedSquare = { row, col };
            renderBoard();
            highlightLegalMoves(row, col);
        }
    }
}

// Highlight legal moves
function highlightLegalMoves(row, col) {
    if (!showLegalMovesEnabled) return;

    const moves = getLegalMovesForPiece(row, col);
    moves.forEach(move => {
        const square = document.querySelector(`[data-row="${move.row}"][data-col="${move.col}"]`);
        if (board[move.row][move.col]) {
            square.classList.add('legal-capture');
        } else {
            square.classList.add('legal-move');
        }
    });

    const selectedSq = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    selectedSq.classList.add('selected');
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
    // For kingside: check f, g (cols 5, 6)
    // For queenside: check d, c, b (cols 3, 2, 1) - rook at col 0 needs b1 clear to pass
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
            // Create test position without mutating original
            const testBoard = JSON.parse(JSON.stringify(originalBoard));
            testBoard[fromRow][fromCol] = '';
            testBoard[fromRow][col] = king;

            // Temporarily set board for check test
            board = testBoard;
            if (isInCheck(player)) {
                board = originalBoard;
                return false;
            }
        }
        // Restore original board
        board = originalBoard;
        return true;
    } catch (error) {
        // Ensure board is always restored on error
        board = originalBoard;
        return false;
    }
}

// Make a move
function makeMove(fromRow, fromCol, toRow, toCol, promotionPiece = null) {
    const piece = board[fromRow][fromCol];
    const capturedPiece = board[toRow][toCol];
    const pieceType = piece.toLowerCase();

    // Save old en passant target before clearing
    const oldEnPassantTarget = enPassantTarget;
    // Clear en passant target (will be set again if pawn moves two squares)
    enPassantTarget = null;

    // Detect en passant capture before saving state (use old target)
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
        enPassantTarget: oldEnPassantTarget, // Save the old target before it was cleared
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
            // Need to show promotion dialog
            pendingPromotion = { row: toRow, col: toCol };
            showPromotionDialog(toRow, toCol);
            return; // Don't continue until promotion is chosen
        }
    }

    // Set en passant target if pawn moved two squares
    if (pieceType === 'p' && Math.abs(toRow - fromRow) === 2) {
        enPassantTarget = { row: (fromRow + toRow) / 2, col: toCol };
    }
    // Otherwise enPassantTarget remains null (was cleared at start of function)

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
        // White rooks at starting positions
        if (toRow === 7 && toCol === 0) castlingRights.white.queenside = false;
        if (toRow === 7 && toCol === 7) castlingRights.white.kingside = false;
        // Black rooks at starting positions
        if (toRow === 0 && toCol === 0) castlingRights.black.queenside = false;
        if (toRow === 0 && toCol === 7) castlingRights.black.kingside = false;
    }

    // Update last move
    lastMove = { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } };

    // Add to move history display (both desktop and mobile)
    // Use hollow pieces for White's moves, solid for Black's moves
    const pieceSymbol = currentPlayer === 'white' ? PIECES_HOLLOW[piece] : PIECES[piece];
    const moveNotation = `${pieceSymbol} ${String.fromCharCode(97 + fromCol)}${8 - fromRow} → ${String.fromCharCode(97 + toCol)}${8 - toRow}`;
    const moveDiv = document.createElement('div');
    moveDiv.textContent = `${fullMoveNumber}. ${moveNotation}`;
    const mobileMoveDiv = moveDiv.cloneNode(true);
    document.getElementById('moveHistory').appendChild(moveDiv);
    document.getElementById('moveHistory').scrollTop = document.getElementById('moveHistory').scrollHeight;
    document.getElementById('mobileMoveHistory').appendChild(mobileMoveDiv);
    document.getElementById('mobileMoveHistory').scrollTop = document.getElementById('mobileMoveHistory').scrollHeight;

    // Switch player
    currentPlayer = currentPlayer === 'white' ? 'black' : 'white';

    // Update fullmove number (increments after black's move)
    if (currentPlayer === 'white') {
        fullMoveNumber++;
    }

    // Track position for threefold repetition
    positionHistory.push(getPositionKey());

    // Check game over conditions
    checkGameOver();

    updateStatus();
    updateCapturedPieces();
    updateEvaluationBar();
    updateMoveCounter();
}

// Check if king is in check
function isInCheck(player) {
    const kingPos = findKing(player);
    if (!kingPos) return false;

    const opponent = player === 'white' ? 'black' : 'white';

    // Check if any opponent piece can attack the king
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
// Two positions are identical if: same board, same player to move,
// same castling rights, and same en passant possibilities
function getPositionKey() {
    return JSON.stringify({
        board: board,
        player: currentPlayer,
        castling: castlingRights,
        enPassant: enPassantTarget
    });
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

// Check if game is over
function checkGameOver() {
    const overlay = document.getElementById('overlay');
    const gameOverDiv = document.getElementById('gameOver');
    const title = document.getElementById('gameOverTitle');
    const message = document.getElementById('gameOverMessage');

    // Check for 50-move rule (100 half-moves = 50 full moves)
    if (halfMoveClock >= 100) {
        gameOver = true;
        selectedSquare = null; // Clear selection
        gameOverReason = '50-Move Rule Draw';
        title.textContent = '50-Move Rule Draw';
        message.textContent = '50 moves without a capture or pawn move. The game is a draw.';
        overlay.classList.add('show');
        gameOverDiv.classList.add('show');
        // Auto-hide after 2 seconds
        if (gameOverDialogTimeout) clearTimeout(gameOverDialogTimeout);
        gameOverDialogTimeout = setTimeout(() => {
            overlay.classList.remove('show');
            gameOverDiv.classList.remove('show');
        }, 2000);
        return;
    }

    // Check for threefold repetition
    if (positionHistory.length > 0) {
        const currentPosition = positionHistory[positionHistory.length - 1];
        const repetitions = positionHistory.filter(pos => pos === currentPosition).length;
        if (repetitions >= 3) {
            gameOver = true;
            selectedSquare = null; // Clear selection
            gameOverReason = 'Draw by Repetition';
            title.textContent = 'Draw by Repetition';
            message.textContent = 'The same position occurred three times. The game is a draw.';
            overlay.classList.add('show');
            gameOverDiv.classList.add('show');
            // Auto-hide after 2 seconds
            if (gameOverDialogTimeout) clearTimeout(gameOverDialogTimeout);
            gameOverDialogTimeout = setTimeout(() => {
                overlay.classList.remove('show');
                gameOverDiv.classList.remove('show');
            }, 2000);
            return;
        }
    }

    const moves = getAllLegalMoves(currentPlayer);

    if (moves.length === 0) {
        gameOver = true;
        selectedSquare = null; // Clear selection on game over

        if (isInCheck(currentPlayer)) {
            // Checkmate
            const winner = currentPlayer === 'white' ? 'Black' : 'White';
            gameOverReason = `Checkmate - ${winner} wins!`;
            title.textContent = 'Checkmate!';
            message.textContent = `${winner} wins!`;
        } else {
            // Stalemate
            gameOverReason = 'Stalemate - Draw';
            title.textContent = 'Stalemate!';
            message.textContent = 'The game is a draw.';
        }

        overlay.classList.add('show');
        gameOverDiv.classList.add('show');
        // Auto-hide after 2 seconds
        if (gameOverDialogTimeout) clearTimeout(gameOverDialogTimeout);
        gameOverDialogTimeout = setTimeout(() => {
            overlay.classList.remove('show');
            gameOverDiv.classList.remove('show');
        }, 2000);
        updateButtonStates();
    }
}

// Update button states based on game mode and history
function updateButtonStates() {
    const undoBtn = document.getElementById('undoBtn');
    const hintBtn = document.getElementById('hintBtn');

    if (undoBtn) {
        // Disable undo in watch mode or if no moves
        const canUndo = gameMode !== 'watch' && moveHistory.length > 0;
        undoBtn.disabled = !canUndo;
        undoBtn.style.opacity = canUndo ? '1' : '0.5';
        undoBtn.style.cursor = canUndo ? 'pointer' : 'not-allowed';
    }

    if (hintBtn) {
        // Disable hint in watch mode or if game over
        const canHint = gameMode !== 'watch' && !gameOver;
        hintBtn.disabled = !canHint;
        hintBtn.style.opacity = canHint ? '1' : '0.5';
        hintBtn.style.cursor = canHint ? 'pointer' : 'not-allowed';
    }
}

// Update status display
function updateStatus() {
    const status = document.getElementById('status');
    const mobileStatus = document.getElementById('mobileStatus');

    let statusText = '';
    let statusClass = 'status';

    if (gameOver) {
        statusText = gameOverReason || 'Game Over';
    } else {
        // Different wording for watch mode
        if (gameMode === 'watch') {
            statusText = `${currentPlayer === 'white' ? 'White' : 'Black'} to move`;
        } else {
            statusText = `${currentPlayer === 'white' ? 'White' : 'Black'}'s Turn`;
        }
        statusClass = `status ${currentPlayer}-turn`;

        if (isInCheck(currentPlayer)) {
            statusText += ' - Check!';
        }
    }

    status.textContent = statusText;
    status.className = statusClass;

    if (mobileStatus) {
        mobileStatus.textContent = statusText;
        mobileStatus.className = statusClass;
    }
}

// Update captured pieces display
function updateCapturedPieces() {
    // White captures = solid, Black captures = hollow (as requested)
    document.getElementById('whiteCaptured').innerHTML =
        capturedPieces.white.map(p => PIECES[p]).join(' ');
    document.getElementById('blackCaptured').innerHTML =
        capturedPieces.black.map(p => PIECES_HOLLOW[p]).join(' ');
}

// Show promotion dialog
function showPromotionDialog(row, col) {
    const isWhite = currentPlayer === 'white';
    const pieces = isWhite ? ['Q', 'R', 'B', 'N'] : ['q', 'r', 'b', 'n'];
    const dialog = document.getElementById('promotionDialog');
    const overlay = document.getElementById('overlay');
    const piecesContainer = document.getElementById('promotionPieces');

    piecesContainer.innerHTML = '';
    pieces.forEach(piece => {
        const div = document.createElement('div');
        div.className = 'promotion-piece';
        div.textContent = PIECES[piece];
        div.onclick = () => {
            // Immediately hide dialog and overlay
            dialog.classList.remove('show');
            overlay.classList.remove('show');

            // Update the promoted piece on board
            board[row][col] = piece;
            pendingPromotion = null;

            // Get move info from last history entry (saved before early return)
            if (moveHistory.length > 0) {
                const lastHistoryMove = moveHistory[moveHistory.length - 1];
                const fromRow = lastHistoryMove.from.row;
                const fromCol = lastHistoryMove.from.col;
                const originalPiece = lastHistoryMove.piece;

                // Update last move
                lastMove = {
                    from: { row: fromRow, col: fromCol },
                    to: { row, col }
                };

                // Add to move history display (both desktop and mobile)
                const pieceSymbol = currentPlayer === 'white' ? PIECES_HOLLOW[originalPiece] : PIECES[originalPiece];
                const moveNotation = `${pieceSymbol} ${String.fromCharCode(97 + fromCol)}${8 - fromRow} → ${String.fromCharCode(97 + col)}${8 - row}`;
                const moveDiv = document.createElement('div');
                moveDiv.textContent = `${fullMoveNumber}. ${moveNotation}`;
                const mobileMoveDiv = moveDiv.cloneNode(true);
                document.getElementById('moveHistory').appendChild(moveDiv);
                document.getElementById('moveHistory').scrollTop = document.getElementById('moveHistory').scrollHeight;
                document.getElementById('mobileMoveHistory').appendChild(mobileMoveDiv);
                document.getElementById('mobileMoveHistory').scrollTop = document.getElementById('mobileMoveHistory').scrollHeight;
            }

            // Switch player (this was missing!)
            currentPlayer = currentPlayer === 'white' ? 'black' : 'white';

            // Update fullmove number (increments after black's move)
            if (currentPlayer === 'white') {
                fullMoveNumber++;
            }

            // Track position for threefold repetition
            positionHistory.push(getPositionKey());

            // Update UI
            renderBoard();
            updateStatus();
            updateEvaluationBar();
            updateMoveCounter();
            updateCapturedPieces();

            // Check game over
            checkGameOver();

            // Trigger AI move if needed
            if (!gameOver) {
                if (gameMode === 'ai' && currentPlayer === 'black') {
                    setTimeout(() => {
                        if (!gameOver) makeAIMove();
                    }, 500);
                } else if (gameMode === 'watch' && watchMatchRunning) {
                    setTimeout(() => {
                        if (!gameOver && watchMatchRunning) makeAIMove();
                    }, 1000);
                }
            }
        };
        piecesContainer.appendChild(div);
    });

    // Show dialog with overlay
    overlay.classList.add('show');
    dialog.classList.add('show');
}

// Update evaluation bar
function updateEvaluationBar() {
    const evaluation = evaluateBoard();
    const maxEval = 2000;
    const normalized = Math.max(-maxEval, Math.min(maxEval, evaluation));
    const percentage = ((normalized + maxEval) / (2 * maxEval)) * 100;

    const evalFill = document.getElementById('evalFill');
    const evalText = document.getElementById('evalText');

    evalFill.style.height = percentage + '%';

    // Display evaluation from White's perspective (positive = white winning)
    const evalScore = (evaluation / 100).toFixed(1);
    if (Math.abs(evaluation) < 50) {
        evalText.textContent = '=';
        evalText.title = 'Position is equal';
    } else {
        evalText.textContent = evalScore > 0 ? `+${evalScore}` : evalScore;
        evalText.title = evalScore > 0 ? `White is winning by ${evalScore}` : `Black is winning by ${Math.abs(evalScore)}`;
    }
}

// Update move counter
function updateMoveCounter() {
    const counter = document.getElementById('moveCounter');
    // More user-friendly display
    let displayText = `Move ${fullMoveNumber}`;

    // Show 50-move rule progress if getting close
    if (halfMoveClock > 20) {
        displayText += ` | Draw in ${100 - halfMoveClock} moves`;
    }

    counter.textContent = displayText;
}

// AI Move using Minimax algorithm
function makeAIMove() {
    if (gameOver) return;

    // Check opening book
    if (fullMoveNumber <= 3) {
        const bookMove = getOpeningBookMove();
        if (bookMove) {
            makeMove(bookMove.from.row, bookMove.from.col,
                    bookMove.to.row, bookMove.to.col,
                    bookMove.promotion);
            renderBoard();

            if (gameMode === 'watch' && watchMatchRunning && !gameOver) {
                setTimeout(() => {
                    if (!gameOver && watchMatchRunning) makeAIMove();
                }, 1000);
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
    const thinkingDialog = document.getElementById('aiThinking');
    const thinkingText = document.getElementById('aiThinkingText');
    const mobileThinkingDialog = document.getElementById('mobileAiThinking');
    const mobileThinkingText = document.getElementById('mobileAiThinkingText');
    const difficultyNames = ['Beginner', 'Easy', 'Medium', 'Hard'];
    const difficultyName = difficultyNames[currentDifficulty - 1] || 'Unknown';
    const thinkingMessage = `${difficultyName} (depth ${currentDifficulty})`;
    thinkingText.textContent = thinkingMessage;
    thinkingDialog.classList.add('show');
    if (mobileThinkingText) {
        mobileThinkingText.textContent = thinkingMessage;
    }
    if (mobileThinkingDialog) {
        mobileThinkingDialog.classList.add('show');
    }

    // Use setTimeout to let the UI update before blocking
    setTimeout(() => {
        const startTime = Date.now();
        // CRITICAL: White maximizes (true), Black minimizes (false)
        const isMaximizing = currentPlayer === 'white';
        const bestMove = minimax(currentDifficulty, currentPlayer, -Infinity, Infinity, isMaximizing);
        const thinkTime = ((Date.now() - startTime) / 1000).toFixed(2);

        // Ensure minimum 300ms display time for thinking indicator
        const minDisplayTime = 300;
        const elapsed = Date.now() - startTime;
        const delayNeeded = Math.max(0, minDisplayTime - elapsed);

        setTimeout(() => {
            // Hide thinking indicator
            thinkingDialog.classList.remove('show');
            if (mobileThinkingDialog) {
                mobileThinkingDialog.classList.remove('show');
            }

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

                makeMove(bestMove.move.from.row, bestMove.move.from.col,
                        bestMove.move.to.row, bestMove.move.to.col,
                        promotionPiece);
                renderBoard();

                if (gameMode === 'watch' && watchMatchRunning && !gameOver) {
                    setTimeout(() => {
                        if (!gameOver && watchMatchRunning) makeAIMove();
                    }, 1000);
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
        const lastMove = moveHistory[0];
        const key = `${String.fromCharCode(97 + lastMove.from.col)}${8 - lastMove.from.row}${String.fromCharCode(97 + lastMove.to.col)}${8 - lastMove.to.row}`;
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
    const capturedPiece = board[toRow][toCol]; // Save before move

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

// Minimax algorithm with alpha-beta pruning
function minimax(depth, player, alpha, beta, isMaximizing) {
    if (depth === 0) {
        return { score: evaluateBoard() };
    }

    const moves = getAllLegalMoves(player);

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
                    break; // Beta cutoff (finally block will restore state)
                }
            } finally {
                // Always restore game state
                board = originalBoard;
                currentPlayer = originalCurrentPlayer;
                castlingRights = originalCastlingRights;
                enPassantTarget = originalEnPassantTarget;
            }
        }

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
                    break; // Alpha cutoff (finally block will restore state)
                }
            } finally {
                // Always restore game state
                board = originalBoard;
                currentPlayer = originalCurrentPlayer;
                castlingRights = originalCastlingRights;
                enPassantTarget = originalEnPassantTarget;
            }
        }

        return { score: minScore, move: bestMove };
    }
}

// Evaluate board position
function evaluateBoard(depth = 0) {
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
    let whiteMoves = 0;
    let blackMoves = 0;

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
    whiteMoves = getAllLegalMoves('white').length;

    currentPlayer = 'black';
    blackMoves = getAllLegalMoves('black').length;

    currentPlayer = originalPlayer;
    score += (whiteMoves - blackMoves) * 10;

    // King safety - penalize if king is in check
    if (isInCheck('white')) score -= 50;
    if (isInCheck('black')) score += 50;

    return score;
}

// Get hint for current player
// Draw hint arrow in different color
function drawHintArrow(fromRow, fromCol, toRow, toCol) {
    const svg = document.getElementById('moveArrowSvg');

    // Get actual square size from rendered board
    const boardSquare = document.querySelector('.square');
    const squareSize = boardSquare ? boardSquare.offsetWidth : 70;
    const fromX = fromCol * squareSize + squareSize / 2;
    const fromY = fromRow * squareSize + squareSize / 2;
    const toX = toCol * squareSize + squareSize / 2;
    const toY = toRow * squareSize + squareSize / 2;

    // Create arrow line (red color with dotted line for hint)
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', fromX);
    line.setAttribute('y1', fromY);
    line.setAttribute('x2', toX);
    line.setAttribute('y2', toY);
    line.setAttribute('stroke', '#FF0000');
    line.setAttribute('stroke-width', '4');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('stroke-dasharray', '8,4');
    line.setAttribute('marker-end', 'url(#arrowhead-hint)');
    line.classList.add('hint-arrow');

    // Create start circle (red)
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', fromX);
    circle.setAttribute('cy', fromY);
    circle.setAttribute('r', '6');
    circle.setAttribute('fill', '#FF0000');
    circle.classList.add('hint-arrow');

    // Create arrowhead marker for hint if it doesn't exist
    if (!svg.querySelector('#arrowhead-hint')) {
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', 'arrowhead-hint');
        marker.setAttribute('markerWidth', '10');
        marker.setAttribute('markerHeight', '10');
        marker.setAttribute('refX', '9');
        marker.setAttribute('refY', '3');
        marker.setAttribute('orient', 'auto');
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', '0 0, 10 3, 0 6');
        polygon.setAttribute('fill', '#FF0000');
        marker.appendChild(polygon);
        defs.appendChild(marker);
        svg.appendChild(defs);
    }

    svg.appendChild(line);
    svg.appendChild(circle);

    // Clear any existing hint timeouts
    if (hintArrowTimeout) clearTimeout(hintArrowTimeout);
    if (hintArrowRemovalTimeout) clearTimeout(hintArrowRemovalTimeout);

    // Fade out and remove after 1.5 seconds (only hint arrows, not move arrows)
    hintArrowTimeout = setTimeout(() => {
        // Apply fade to hint arrows only using CSS transition on elements
        const hintArrows = svg.querySelectorAll('.hint-arrow');
        hintArrows.forEach(el => {
            el.style.transition = 'opacity 0.5s';
            el.style.opacity = '0';
        });
        hintArrowRemovalTimeout = setTimeout(() => {
            const arrows = svg.querySelectorAll('.hint-arrow');
            arrows.forEach(el => el.remove());
            hintArrowTimeout = null;
            hintArrowRemovalTimeout = null;
        }, 500); // Wait for fade transition
    }, 1500);
}

function getHint() {
    if (gameOver) return;
    if (gameMode === 'watch') return;

    const hintBtn = document.getElementById('hintBtn');
    const hintText = document.getElementById('hintText');

    // Disable button during calculation
    if (hintBtn) {
        hintBtn.disabled = true;
        hintBtn.style.opacity = '0.5';
        hintBtn.style.cursor = 'not-allowed';
    }

    hintText.style.display = 'block';
    hintText.textContent = 'Calculating best move...';

    setTimeout(() => {
        const bestMove = minimax(Math.min(aiDifficulty, 2), currentPlayer, -Infinity, Infinity, currentPlayer === 'white');

        if (bestMove.move) {
            const piece = board[bestMove.move.from.row][bestMove.move.from.col];
            const fromSquare = String.fromCharCode(97 + bestMove.move.from.col) + (8 - bestMove.move.from.row);
            const toSquare = String.fromCharCode(97 + bestMove.move.to.col) + (8 - bestMove.move.to.row);

            hintText.textContent = `Suggested move: ${PIECES[piece]} from ${fromSquare} to ${toSquare}`;

            // Draw hint arrow
            drawHintArrow(bestMove.move.from.row, bestMove.move.from.col,
                         bestMove.move.to.row, bestMove.move.to.col);
        } else {
            hintText.textContent = 'No legal moves available.';
        }

        // Re-enable button
        if (hintBtn) {
            hintBtn.disabled = false;
            hintBtn.style.opacity = '1';
            hintBtn.style.cursor = 'pointer';
        }
    }, 100);
}

// Game controls
function newGame() {
    // Ask for confirmation if game is in progress (moves have been made)
    if (moveHistory.length > 0 && !gameOver) {
        if (!confirm('Start a new game? Current game will be lost.')) {
            return;
        }
    }

    document.getElementById('overlay').classList.remove('show');
    document.getElementById('gameOver').classList.remove('show');
    initGame();

    // Reset watch mode controls if in watch mode
    if (gameMode === 'watch') {
        watchMatchRunning = false;
        document.getElementById('startWatchBtn').style.display = 'block';
        document.getElementById('pauseWatchBtn').style.display = 'none';
        document.getElementById('stopWatchBtn').style.display = 'none';
        document.getElementById('pauseWatchBtn').textContent = 'Pause';

        const mobileStartBtn = document.getElementById('mobileStartWatchBtn');
        const mobilePauseBtn = document.getElementById('mobilePauseWatchBtn');
        const mobileStopBtn = document.getElementById('mobileStopWatchBtn');
        if (mobileStartBtn) mobileStartBtn.style.display = 'block';
        if (mobilePauseBtn) {
            mobilePauseBtn.style.display = 'none';
            mobilePauseBtn.textContent = 'Pause';
        }
        if (mobileStopBtn) mobileStopBtn.style.display = 'none';
    }
}

function undoSingleMove() {
    if (moveHistory.length === 0) return false;

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

    const moveHistoryDiv = document.getElementById('moveHistory');
    if (moveHistoryDiv.lastChild) {
        moveHistoryDiv.removeChild(moveHistoryDiv.lastChild);
    }

    const mobileMoveHistoryDiv = document.getElementById('mobileMoveHistory');
    if (mobileMoveHistoryDiv.lastChild) {
        mobileMoveHistoryDiv.removeChild(mobileMoveHistoryDiv.lastChild);
    }

    return true;
}

function undoMove() {
    // Don't allow undo in AI vs AI watch mode
    if (gameMode === 'watch') {
        return;
    }

    if (gameMode === 'ai') {
        // In AI mode, undo 2 moves (AI's move + your move) to get back to your turn
        if (moveHistory.length < 2) {
            // If less than 2 moves, just undo 1
            if (!undoSingleMove()) return;
        } else {
            // Undo AI's move
            if (!undoSingleMove()) return;
            // Undo your move
            if (!undoSingleMove()) return;
        }
    } else {
        // In PvP mode, just undo 1 move
        if (!undoSingleMove()) return;
    }

    gameOver = false;
    gameOverReason = '';
    document.getElementById('overlay').classList.remove('show');
    document.getElementById('gameOver').classList.remove('show');

    renderBoard();
    updateStatus();
    updateCapturedPieces();
    updateEvaluationBar();
    updateMoveCounter();
    updateButtonStates();
}

function showInfo() {
    document.getElementById('overlay').classList.add('show');
    document.getElementById('infoDialog').classList.add('show');
}

function closeInfo() {
    document.getElementById('overlay').classList.remove('show');
    document.getElementById('infoDialog').classList.remove('show');
}

function setMode(mode) {
    gameMode = mode;

    // Update active class on mode buttons (desktop)
    ['pvp', 'ai', 'watch'].forEach(m => {
        const btn = document.getElementById(`modeBtn-${m}`);
        if (btn) btn.classList.toggle('active', m === mode);
    });

    // Update active class on mode buttons (mobile)
    ['pvp', 'ai', 'watch'].forEach(m => {
        const btn = document.getElementById(`mobileModeBtn-${m}`);
        if (btn) btn.classList.toggle('active', m === mode);
    });

    // Show/hide appropriate difficulty selectors (desktop)
    const singleDiff = document.getElementById('singleAIDifficulty');
    const watchDiff = document.getElementById('watchAIDifficulty');

    // Show/hide appropriate difficulty selectors (mobile)
    const mobileSingleDiff = document.getElementById('mobileSingleAIDifficulty');
    const mobileWatchDiff = document.getElementById('mobileWatchAIDifficulty');

    if (mode === 'watch') {
        singleDiff.style.display = 'none';
        watchDiff.style.display = 'block';
        if (mobileSingleDiff) mobileSingleDiff.style.display = 'none';
        if (mobileWatchDiff) mobileWatchDiff.style.display = 'block';

        // Stop any running match and show Start button
        watchMatchRunning = false;
        document.getElementById('startWatchBtn').style.display = 'block';
        document.getElementById('pauseWatchBtn').style.display = 'none';
        document.getElementById('stopWatchBtn').style.display = 'none';
        const mobileStartBtn = document.getElementById('mobileStartWatchBtn');
        const mobilePauseBtn = document.getElementById('mobilePauseWatchBtn');
        const mobileStopBtn = document.getElementById('mobileStopWatchBtn');
        if (mobileStartBtn) mobileStartBtn.style.display = 'block';
        if (mobilePauseBtn) mobilePauseBtn.style.display = 'none';
        if (mobileStopBtn) mobileStopBtn.style.display = 'none';
    } else {
        singleDiff.style.display = 'block';
        watchDiff.style.display = 'none';
        if (mobileSingleDiff) mobileSingleDiff.style.display = 'block';
        if (mobileWatchDiff) mobileWatchDiff.style.display = 'none';
        watchMatchRunning = false;
    }

    // Clear any pending promotion before mode change
    pendingPromotion = null;
    document.getElementById('overlay').classList.remove('show');
    document.getElementById('promotionDialog').classList.remove('show');

    newGame();
    updateButtonStates();
}

function startWatchMatch() {
    if (gameMode !== 'watch') return;
    if (watchMatchRunning) return; // Already running

    watchMatchRunning = true;

    // Update button visibility (desktop)
    document.getElementById('startWatchBtn').style.display = 'none';
    document.getElementById('pauseWatchBtn').style.display = 'block';
    document.getElementById('stopWatchBtn').style.display = 'block';

    // Update button visibility (mobile)
    const mobileStartBtn = document.getElementById('mobileStartWatchBtn');
    const mobilePauseBtn = document.getElementById('mobilePauseWatchBtn');
    const mobileStopBtn = document.getElementById('mobileStopWatchBtn');
    if (mobileStartBtn) mobileStartBtn.style.display = 'none';
    if (mobilePauseBtn) mobilePauseBtn.style.display = 'block';
    if (mobileStopBtn) mobileStopBtn.style.display = 'block';

    // Start the match
    setTimeout(makeAIMove, 500);
}

function pauseWatchMatch() {
    if (gameMode !== 'watch') return;

    watchMatchRunning = !watchMatchRunning;

    // Update button text (desktop)
    const pauseBtn = document.getElementById('pauseWatchBtn');
    pauseBtn.textContent = watchMatchRunning ? 'Pause' : 'Resume';

    // Update button text (mobile)
    const mobilePauseBtn = document.getElementById('mobilePauseWatchBtn');
    if (mobilePauseBtn) {
        mobilePauseBtn.textContent = watchMatchRunning ? 'Pause' : 'Resume';
    }

    // Resume if needed
    if (watchMatchRunning) {
        setTimeout(makeAIMove, 500);
    }
}

function stopWatchMatch() {
    if (gameMode !== 'watch') return;

    watchMatchRunning = false;

    // Update button visibility (desktop)
    document.getElementById('startWatchBtn').style.display = 'block';
    document.getElementById('pauseWatchBtn').style.display = 'none';
    document.getElementById('stopWatchBtn').style.display = 'none';

    // Update button visibility (mobile)
    const mobileStartBtn = document.getElementById('mobileStartWatchBtn');
    const mobilePauseBtn = document.getElementById('mobilePauseWatchBtn');
    const mobileStopBtn = document.getElementById('mobileStopWatchBtn');
    if (mobileStartBtn) mobileStartBtn.style.display = 'block';
    if (mobilePauseBtn) mobilePauseBtn.style.display = 'none';
    if (mobileStopBtn) mobileStopBtn.style.display = 'none';

    // Reset pause button text
    document.getElementById('pauseWatchBtn').textContent = 'Pause';
    if (mobilePauseBtn) mobilePauseBtn.textContent = 'Pause';

    // Reset the game
    newGame();
}

function updateDifficulty() {
    if (isSyncingUI) return; // Prevent circular updates
    isSyncingUI = true;
    aiDifficulty = parseInt(document.getElementById('difficulty').value);
    // Sync to mobile
    const mobileDifficulty = document.getElementById('mobileDifficulty');
    if (mobileDifficulty) mobileDifficulty.value = aiDifficulty;
    isSyncingUI = false;
}

function updateDifficultyWhite() {
    if (isSyncingUI) return;
    isSyncingUI = true;
    aiDifficultyWhite = parseInt(document.getElementById('difficultyWhite').value);
    // Sync to mobile
    const mobileDifficultyWhite = document.getElementById('mobileDifficultyWhite');
    if (mobileDifficultyWhite) mobileDifficultyWhite.value = aiDifficultyWhite;
    isSyncingUI = false;
}

function updateDifficultyBlack() {
    if (isSyncingUI) return;
    isSyncingUI = true;
    aiDifficultyBlack = parseInt(document.getElementById('difficultyBlack').value);
    // Sync to mobile
    const mobileDifficultyBlack = document.getElementById('mobileDifficultyBlack');
    if (mobileDifficultyBlack) mobileDifficultyBlack.value = aiDifficultyBlack;
    isSyncingUI = false;
}

function updateMobileDifficulty() {
    if (isSyncingUI) return;
    isSyncingUI = true;
    aiDifficulty = parseInt(document.getElementById('mobileDifficulty').value);
    // Sync to desktop
    document.getElementById('difficulty').value = aiDifficulty;
    isSyncingUI = false;
}

function updateMobileDifficultyWhite() {
    if (isSyncingUI) return;
    isSyncingUI = true;
    aiDifficultyWhite = parseInt(document.getElementById('mobileDifficultyWhite').value);
    // Sync to desktop
    document.getElementById('difficultyWhite').value = aiDifficultyWhite;
    isSyncingUI = false;
}

function updateMobileDifficultyBlack() {
    if (isSyncingUI) return;
    isSyncingUI = true;
    aiDifficultyBlack = parseInt(document.getElementById('mobileDifficultyBlack').value);
    // Sync to desktop
    document.getElementById('difficultyBlack').value = aiDifficultyBlack;
    isSyncingUI = false;
}

function toggleLegalMoves() {
    showLegalMovesEnabled = document.getElementById('showLegalMoves').checked;
    // Sync to mobile
    const mobileCheckbox = document.getElementById('mobileShowLegalMoves');
    if (mobileCheckbox) mobileCheckbox.checked = showLegalMovesEnabled;
    renderBoard();
}

function toggleMobileLegalMoves() {
    showLegalMovesEnabled = document.getElementById('mobileShowLegalMoves').checked;
    // Sync to desktop
    document.getElementById('showLegalMoves').checked = showLegalMovesEnabled;
    renderBoard();
}

// Handle overlay click to close certain dialogs
function handleOverlayClick() {
    // Only close mobile menu and info dialog on overlay click
    // Don't close game over or promotion dialogs (require explicit button)
    const mobileMenu = document.getElementById('mobileMenu');
    const infoDialog = document.getElementById('infoDialog');

    if (mobileMenu && mobileMenu.classList.contains('show')) {
        closeMobileMenu();
    } else if (infoDialog && infoDialog.classList.contains('show')) {
        closeInfo();
    }
}

// Mobile menu functions
function openMobileMenu() {
    document.getElementById('overlay').classList.add('show');
    document.getElementById('mobileMenu').classList.add('show');
}

function closeMobileMenu() {
    document.getElementById('overlay').classList.remove('show');
    document.getElementById('mobileMenu').classList.remove('show');
}


// Initialize game on load
initGame();
