// ============================================================================
// UI - Rendering and user interface controls
// ============================================================================

// UI state variables (global)
let arrowFadeTimeout = null;
let arrowFadeTimeoutMove = null;
let arrowRemovalTimeout = null;
let hintArrowTimeout = null;
let hintArrowRemovalTimeout = null;
let gameOverDialogTimeout = null;
let aiMoveTimeout = null;
let watchMatchRunning = false;
let watchMatchPausedByDialog = false;
let selectedDialogMode = 'ai'; // For new game dialog

// Logical square size matching viewBox="0 0 560 560" on #moveArrowSvg (8 * 70 = 560)
const LOGICAL_SQUARE_SIZE = 70;

// ============================================================================
// RENDERING
// ============================================================================

// Render the chessboard
function renderBoard() {
    const chessboard = document.getElementById('chessboard');
    if (!chessboard) return;
    chessboard.innerHTML = '';

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

// Draw arrow showing last move using resolution-independent viewBox="0 0 560 560"
function drawMoveArrow() {
    const svg = document.getElementById('moveArrowSvg');
    if (!svg) return;

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
        if (arrowFadeTimeout) {
            clearTimeout(arrowFadeTimeout);
            arrowFadeTimeout = null;
            arrowFadeTimeoutMove = null;
        }
        return;
    }

    // Check if this is a new move
    const moveKey = `${lastMove.from.row},${lastMove.from.col}->${lastMove.to.row},${lastMove.to.col}@${moveHistory.length}`;
    const isNewMove = moveKey !== arrowFadeTimeoutMove;

    if (isNewMove) {
        if (arrowFadeTimeout) clearTimeout(arrowFadeTimeout);
        if (arrowRemovalTimeout) clearTimeout(arrowRemovalTimeout);
        svg.classList.remove('fade-out');
        svg.style.opacity = '1';
        arrowFadeTimeoutMove = moveKey;

        arrowFadeTimeout = setTimeout(() => {
            svg.classList.add('fade-out');
            arrowRemovalTimeout = setTimeout(() => {
                const arrows = svg.querySelectorAll('line, circle');
                arrows.forEach(el => el.remove());
                svg.classList.remove('fade-out');
                document.querySelectorAll('.square.last-move').forEach(sq => sq.classList.remove('last-move'));
                arrowRemovalTimeout = null;
            }, ARROW_FADE_DURATION);
        }, ARROW_FADE_DELAY);
    }

    const fromX = lastMove.from.col * LOGICAL_SQUARE_SIZE + LOGICAL_SQUARE_SIZE / 2;
    const fromY = lastMove.from.row * LOGICAL_SQUARE_SIZE + LOGICAL_SQUARE_SIZE / 2;
    const toX = lastMove.to.col * LOGICAL_SQUARE_SIZE + LOGICAL_SQUARE_SIZE / 2;
    const toY = lastMove.to.row * LOGICAL_SQUARE_SIZE + LOGICAL_SQUARE_SIZE / 2;

    const circleRadius = 8;
    const strokeWidth = 5;

    // Draw start circle
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

// Draw hint arrow using logical SVG coordinates
function drawHintArrow(fromRow, fromCol, toRow, toCol) {
    const svg = document.getElementById('moveArrowSvg');
    if (!svg) return;

    // Remove any existing hint arrows first
    svg.querySelectorAll('.hint-arrow').forEach(el => el.remove());

    const fromX = fromCol * LOGICAL_SQUARE_SIZE + LOGICAL_SQUARE_SIZE / 2;
    const fromY = fromRow * LOGICAL_SQUARE_SIZE + LOGICAL_SQUARE_SIZE / 2;
    const toX = toCol * LOGICAL_SQUARE_SIZE + LOGICAL_SQUARE_SIZE / 2;
    const toY = toRow * LOGICAL_SQUARE_SIZE + LOGICAL_SQUARE_SIZE / 2;

    // Create arrow line (red dashed)
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', fromX);
    line.setAttribute('y1', fromY);
    line.setAttribute('x2', toX);
    line.setAttribute('y2', toY);
    line.setAttribute('stroke', '#FF0000');
    line.setAttribute('stroke-width', '4.5');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('stroke-dasharray', '8,10');
    line.setAttribute('marker-end', 'url(#arrowhead-hint)');
    line.classList.add('hint-arrow');

    // Create start circle (red)
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', fromX);
    circle.setAttribute('cy', fromY);
    circle.setAttribute('r', '7');
    circle.setAttribute('fill', '#FF0000');
    circle.classList.add('hint-arrow');

    svg.appendChild(line);
    svg.appendChild(circle);

    // Clear existing hint timeouts
    if (hintArrowTimeout) clearTimeout(hintArrowTimeout);
    if (hintArrowRemovalTimeout) clearTimeout(hintArrowRemovalTimeout);

    // Fade out and remove after delay
    hintArrowTimeout = setTimeout(() => {
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
        }, ARROW_FADE_DURATION);
    }, HINT_ARROW_DISPLAY_TIME);
}

// Highlight legal moves for selected piece (including en passant captures)
function highlightLegalMoves(row, col) {
    const piece = board[row][col];
    const isPawn = piece && piece.toLowerCase() === 'p';
    const moves = getLegalMovesForPiece(row, col);

    moves.forEach(move => {
        const square = document.querySelector(`[data-row="${move.row}"][data-col="${move.col}"]`);
        if (!square) return;
        const isEnPassantCapture = isPawn && !board[move.row][move.col] &&
            enPassantTarget && move.row === enPassantTarget.row && move.col === enPassantTarget.col;

        if (board[move.row][move.col] || isEnPassantCapture) {
            square.classList.add('legal-capture');
        } else {
            square.classList.add('legal-move');
        }
    });

    const selectedSq = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (selectedSq) {
        selectedSq.classList.add('selected');
    }
}

// Show promotion dialog with properly colored pieces & cancel support
function showPromotionDialog(row, col) {
    const isWhite = currentPlayer === 'white';
    const pieces = isWhite ? ['Q', 'R', 'B', 'N'] : ['q', 'r', 'b', 'n'];
    const pieceNames = { 'q': 'Queen', 'r': 'Rook', 'b': 'Bishop', 'n': 'Knight' };
    const dialog = document.getElementById('promotionDialog');
    const overlay = document.getElementById('overlay');
    const piecesContainer = document.getElementById('promotionPieces');

    piecesContainer.innerHTML = '';
    pieces.forEach(piece => {
        const div = document.createElement('div');
        div.className = `promotion-piece ${isWhite ? 'piece-white' : 'piece-black'}`;
        div.textContent = PIECES[piece];
        div.title = pieceNames[piece.toLowerCase()];
        div.onclick = () => {
            dialog.classList.remove('show');
            overlay.classList.remove('show');

            executePromotionWithUI(piece);

            // Trigger AI if needed
            if (!gameOver) {
                if (gameMode === 'ai' && currentPlayer === 'black') {
                    aiMoveTimeout = setTimeout(() => {
                        aiMoveTimeout = null;
                        if (!gameOver) makeAIMove();
                    }, AI_MOVE_DELAY);
                } else if (gameMode === 'watch' && watchMatchRunning) {
                    aiMoveTimeout = setTimeout(() => {
                        aiMoveTimeout = null;
                        if (!gameOver && watchMatchRunning) makeAIMove();
                    }, AI_WATCH_DELAY);
                }
            }
        };
        piecesContainer.appendChild(div);
    });

    overlay.classList.add('show');
    dialog.classList.add('show');
}

// Cancel pending pawn promotion and restore board
function cancelPromotion() {
    const dialog = document.getElementById('promotionDialog');
    const overlay = document.getElementById('overlay');
    if (dialog) dialog.classList.remove('show');
    if (overlay) overlay.classList.remove('show');

    if (typeof cancelPendingPromotion === 'function' && cancelPendingPromotion()) {
        selectedSquare = null;
        renderBoard();
        updateStatus();
        updateCapturedPieces();
        updateEvaluationBar();
        updateMoveCounter();
        updateButtonStates();
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
        const evaluatedCount = (typeof nodesEvaluated === 'number') ? nodesEvaluated : 0;
        const formattedNodes = evaluatedCount.toLocaleString();
        statusText += `<br>AI positions evaluated: ${formattedNodes}`;
    } else {
        if (gameMode === 'watch') {
            const stateLabel = watchMatchRunning ? 'to move' : '(Paused)';
            statusText = `${currentPlayer === 'white' ? 'White' : 'Black'} ${stateLabel}`;
        } else {
            statusText = `${currentPlayer === 'white' ? 'White' : 'Black'}'s Turn`;
        }
        statusClass = `status ${currentPlayer}-turn`;

        if (isInCheck(currentPlayer)) {
            statusText += ' - Check!';
        }

        if (typeof lastMoveNodesEvaluated === 'number' && lastMoveNodesEvaluated > 0) {
            const formattedLast = lastMoveNodesEvaluated.toLocaleString();
            statusText += `<br>AI positions evaluated: ${formattedLast}`;
        }
    }

    if (status) {
        status.innerHTML = statusText;
        status.className = statusClass;
    }
    if (mobileStatus) {
        mobileStatus.innerHTML = statusText;
        mobileStatus.className = statusClass;
    }
}

// Update captured pieces display (sorted by value + material advantage badge)
function updateCapturedPieces() {
    const sortFn = (a, b) => (CAPTURE_SORT_ORDER[a] || 99) - (CAPTURE_SORT_ORDER[b] || 99);
    const whiteCapturesSorted = capturedPieces.white.slice().sort(sortFn);
    const blackCapturesSorted = capturedPieces.black.slice().sort(sortFn);

    const whiteEl = document.getElementById('whiteCaptured');
    const blackEl = document.getElementById('blackCaptured');
    if (whiteEl) {
        whiteEl.innerHTML = whiteCapturesSorted.map(p => PIECES[p]).join(' ');
    }
    if (blackEl) {
        blackEl.innerHTML = blackCapturesSorted.map(p => PIECES_HOLLOW[p]).join(' ');
    }

    // Calculate material advantage from remaining pieces on the board
    const matValues = { 'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 0 };
    let whiteMat = 0;
    let blackMat = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (!p) continue;
            const v = matValues[p.toLowerCase()] || 0;
            if (p === p.toUpperCase()) whiteMat += v;
            else blackMat += v;
        }
    }

    const diff = whiteMat - blackMat;
    const whiteAdvEl = document.getElementById('whiteAdvantage');
    const blackAdvEl = document.getElementById('blackAdvantage');

    if (whiteAdvEl) {
        if (diff > 0) {
            whiteAdvEl.textContent = `+${diff}`;
            whiteAdvEl.classList.add('active');
        } else {
            whiteAdvEl.textContent = '';
            whiteAdvEl.classList.remove('active');
        }
    }
    if (blackAdvEl) {
        if (diff < 0) {
            blackAdvEl.textContent = `+${Math.abs(diff)}`;
            blackAdvEl.classList.add('active');
        } else {
            blackAdvEl.textContent = '';
            blackAdvEl.classList.remove('active');
        }
    }
}

// Update evaluation bar
function updateEvaluationBar() {
    const evaluation = evaluateBoard();
    const maxEval = 2000;
    const normalized = Math.max(-maxEval, Math.min(maxEval, evaluation));
    const percentage = ((normalized + maxEval) / (2 * maxEval)) * 100;

    const evalFill = document.getElementById('evalFill');
    const evalText = document.getElementById('evalText');
    if (!evalFill || !evalText) return;

    evalFill.style.height = percentage + '%';

    const evalScore = (evaluation / 100).toFixed(1);
    if (Math.abs(evaluation) < 50) {
        evalText.textContent = '=';
        evalText.title = 'Position is equal';
    } else {
        evalText.textContent = evaluation > 0 ? `+${evalScore}` : evalScore;
        evalText.title = evaluation > 0
            ? `White is winning by ${evalScore}`
            : `Black is winning by ${Math.abs(evalScore)}`;
    }
}

// Update move counter
function updateMoveCounter() {
    const counter = document.getElementById('moveCounter');
    if (!counter) return;
    let displayText = `Move ${fullMoveNumber}`;

    if (halfMoveClock > 20) {
        displayText += ` | Draw in ${Math.ceil((100 - halfMoveClock) / 2)} moves`;
    }

    counter.textContent = displayText;
}

// Update button states based on game mode and history
function updateButtonStates() {
    const undoBtn = document.getElementById('undoBtn');
    const hintBtn = document.getElementById('hintBtn');
    const playerActionRow = document.getElementById('playerActionRow');
    const watchActionRow = document.getElementById('watchActionRow');
    const watchPauseBtn = document.getElementById('watchPauseBtn');
    const quickAutoBattleBtn = document.getElementById('quickAutoBattleBtn');
    const quickActionsTitle = document.getElementById('quickActionsTitle');

    if (playerActionRow && watchActionRow) {
        playerActionRow.style.display = gameMode === 'watch' ? 'none' : 'grid';
        watchActionRow.style.display = gameMode === 'watch' ? 'grid' : 'none';
    }

    if (quickAutoBattleBtn) {
        quickAutoBattleBtn.style.display = gameMode === 'watch' ? 'none' : 'block';
    }

    if (quickActionsTitle) {
        quickActionsTitle.textContent = gameMode === 'watch' ? 'Auto-Battle Controls' : 'Quick Actions';
    }

    if (watchPauseBtn && gameMode === 'watch') {
        watchPauseBtn.disabled = gameOver;
        watchPauseBtn.textContent = watchMatchRunning ? '⏸ Pause' : '▶ Resume';
    }

    if (undoBtn) {
        const canUndo = gameMode !== 'watch' && moveHistory.length > 0;
        undoBtn.disabled = !canUndo;
        undoBtn.style.opacity = canUndo ? '1' : '0.5';
        undoBtn.style.cursor = canUndo ? 'pointer' : 'not-allowed';
    }

    if (hintBtn) {
        const canHint = gameMode !== 'watch' && !gameOver && currentPlayer === 'white';
        hintBtn.disabled = !canHint;
        hintBtn.style.opacity = canHint ? '1' : '0.5';
        hintBtn.style.cursor = canHint ? 'pointer' : 'not-allowed';
    }
}

// Toggle Pause / Resume in AI vs AI Watch Mode
function toggleWatchPause() {
    if (gameMode !== 'watch' || gameOver) return;
    watchMatchRunning = !watchMatchRunning;
    updateButtonStates();
    updateStatus();

    if (watchMatchRunning) {
        makeAIMove();
    } else {
        if (aiMoveTimeout) {
            clearTimeout(aiMoveTimeout);
            aiMoveTimeout = null;
        }
        hideAIThinking();
    }
}

// ============================================================================
// MOVE HISTORY & USER INPUT HANDLING
// ============================================================================

// Format a single half-move for move history display
function formatSingleMoveNotation(move) {
    const piece = move.piece;
    const from = move.from;
    const to = move.to;
    const promotedTo = move.promotedTo;
    const isWhite = piece === piece.toUpperCase();
    const pieceSymbol = isWhite ? PIECES_HOLLOW[piece] : PIECES[piece];
    const captureChar = (move.captured || move.enPassantCaptured) ? '×' : '→';
    let notation = `${pieceSymbol}${String.fromCharCode(97 + from.col)}${8 - from.row}${captureChar}${String.fromCharCode(97 + to.col)}${8 - to.row}`;
    if (promotedTo) {
        notation += `=${isWhite ? PIECES_HOLLOW[promotedTo] : PIECES[promotedTo]}`;
    }
    return notation;
}

// Add move to history display (paired White + Black moves per row)
function addMoveToHistory() {
    updateMoveHistoryDisplay();
}

// Rebuild move history display with paired White/Black columns
function updateMoveHistoryDisplay() {
    const moveHistoryEl = document.getElementById('moveHistory');
    const mobileMoveHistoryEl = document.getElementById('mobileMoveHistory');
    if (!moveHistoryEl || !mobileMoveHistoryEl) return;

    moveHistoryEl.innerHTML = '';
    mobileMoveHistoryEl.innerHTML = '';

    for (let i = 0; i < moveHistory.length; i += 2) {
        const whiteMove = moveHistory[i];
        const blackMove = moveHistory[i + 1];
        const moveNum = whiteMove.fullMoveNumber || Math.floor(i / 2) + 1;

        const rowDiv = document.createElement('div');
        rowDiv.className = 'move-row';

        const numSpan = document.createElement('span');
        numSpan.className = 'move-num';
        numSpan.textContent = `${moveNum}.`;

        const whiteSpan = document.createElement('span');
        whiteSpan.className = 'move-white';
        whiteSpan.textContent = formatSingleMoveNotation(whiteMove);

        const blackSpan = document.createElement('span');
        blackSpan.className = 'move-black';
        blackSpan.textContent = blackMove ? formatSingleMoveNotation(blackMove) : '';

        rowDiv.appendChild(numSpan);
        rowDiv.appendChild(whiteSpan);
        rowDiv.appendChild(blackSpan);

        const mobileRowDiv = rowDiv.cloneNode(true);
        moveHistoryEl.appendChild(rowDiv);
        mobileMoveHistoryEl.appendChild(mobileRowDiv);
    }

    moveHistoryEl.scrollTop = moveHistoryEl.scrollHeight;
    mobileMoveHistoryEl.scrollTop = mobileMoveHistoryEl.scrollHeight;
}

// Show game over dialog (stays open until user clicks View Board, New Game, or overlay)
function showGameOverDialog(gameOverResult) {
    const gameOverDialog = document.getElementById('gameOver');
    const overlay = document.getElementById('overlay');
    const title = document.getElementById('gameOverTitle');
    const message = document.getElementById('gameOverMessage');

    if (watchMatchRunning) {
        watchMatchRunning = false;
        updateButtonStates();
    }

    title.textContent = gameOverResult.reason;

    const evaluatedCount = (typeof nodesEvaluated === 'number') ? nodesEvaluated : 0;
    const formattedNodes = evaluatedCount.toLocaleString();
    message.innerHTML = `${gameOverResult.message}<br><br>AI positions evaluated: ${formattedNodes}`;

    overlay.classList.add('show');
    gameOverDialog.classList.add('show');
}

// Close game over dialog to inspect the final board
function closeGameOver() {
    document.getElementById('gameOver').classList.remove('show');
    document.getElementById('overlay').classList.remove('show');
}

// UI wrapper for makeMove - handles all UI updates after a move
function executeMoveWithUI(fromRow, fromCol, toRow, toCol, promotionPiece = null) {
    const result = makeMove(fromRow, fromCol, toRow, toCol, promotionPiece);

    if (!result.success) return result;

    // If promotion is needed, render pawn on last rank and show promotion dialog
    if (result.needsPromotion) {
        renderBoard();
        showPromotionDialog(toRow, toCol);
        return result;
    }

    // Update move history and all UI elements
    addMoveToHistory(result.moveInfo);
    renderBoard();
    updateStatus();
    updateCapturedPieces();
    updateEvaluationBar();
    updateMoveCounter();
    updateButtonStates();

    // Handle game over
    if (result.gameOverResult && result.gameOverResult.isOver) {
        showGameOverDialog(result.gameOverResult);
    }

    return result;
}

// UI wrapper for completePromotion - handles all UI updates after promotion
function executePromotionWithUI(promotionPiece) {
    const result = completePromotion(promotionPiece);

    if (!result || !result.success) return result;

    addMoveToHistory(result.moveInfo);
    renderBoard();
    updateStatus();
    updateCapturedPieces();
    updateEvaluationBar();
    updateMoveCounter();
    updateButtonStates();

    if (result.gameOverResult && result.gameOverResult.isOver) {
        showGameOverDialog(result.gameOverResult);
    }

    return result;
}

// Handle square click
function handleSquareClick(row, col) {
    if (gameOver) return;
    if (pendingPromotion) return;
    if (gameMode === 'watch') return;
    if (gameMode === 'ai' && currentPlayer === 'black') return;

    const piece = board[row][col];

    if (selectedSquare) {
        const fromRow = selectedSquare.row;
        const fromCol = selectedSquare.col;

        if (isValidMove(fromRow, fromCol, row, col)) {
            selectedSquare = null;
            const result = executeMoveWithUI(fromRow, fromCol, row, col);

            // Only trigger AI if move completed (not waiting for promotion)
            if (!result.needsPromotion && !gameOver) {
                if (gameMode === 'ai' && currentPlayer === 'black') {
                    aiMoveTimeout = setTimeout(() => {
                        aiMoveTimeout = null;
                        if (!gameOver) makeAIMove();
                    }, AI_MOVE_DELAY);
                } else if (gameMode === 'watch' && watchMatchRunning) {
                    aiMoveTimeout = setTimeout(() => {
                        aiMoveTimeout = null;
                        if (!gameOver && watchMatchRunning) makeAIMove();
                    }, AI_WATCH_DELAY);
                }
            }
        } else {
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
        if (piece && isOwnPiece(piece, currentPlayer)) {
            selectedSquare = { row, col };
            renderBoard();
            highlightLegalMoves(row, col);
        }
    }
}

// Get hint for current player without polluting game-wide AI nodesEvaluated
function getHint() {
    if (gameOver) return;
    if (gameMode === 'watch') return;
    if (currentPlayer !== 'white') return;

    const hintBtn = document.getElementById('hintBtn');
    const hintText = document.getElementById('hintText');

    if (hintBtn) {
        hintBtn.disabled = true;
        hintBtn.style.opacity = '0.5';
        hintBtn.style.cursor = 'not-allowed';
    }

    hintText.style.display = 'block';
    hintText.textContent = 'Calculating best move...';

    setTimeout(() => {
        if (gameOver || currentPlayer !== 'white') return;

        // Preserve AI node statistics so hints do not inflate game totals
        const savedNodes = nodesEvaluated;
        const hintDepth = Math.min(5, Math.max(aiDifficulty, 3));
        const bestMove = searchBestMoveWithIterativeDeepening(hintDepth, currentPlayer);
        nodesEvaluated = savedNodes;

        if (bestMove && bestMove.move) {
            const piece = board[bestMove.move.from.row][bestMove.move.from.col];
            const fromSquare = String.fromCharCode(97 + bestMove.move.from.col) + (8 - bestMove.move.from.row);
            const toSquare = String.fromCharCode(97 + bestMove.move.to.col) + (8 - bestMove.move.to.row);

            hintText.textContent = `Suggested move: ${PIECES[piece]} from ${fromSquare} to ${toSquare}`;
            drawHintArrow(
                bestMove.move.from.row, bestMove.move.from.col,
                bestMove.move.to.row, bestMove.move.to.col
            );
        } else {
            hintText.textContent = 'No legal moves available.';
        }

        updateButtonStates();
    }, 30);
}

// ============================================================================
// GAME CONTROLS
// ============================================================================

// Start new game (called from game over dialog)
function newGame() {
    document.getElementById('overlay').classList.remove('show');
    document.getElementById('gameOver').classList.remove('show');
    showNewGameDialog();
}

// Instant 1-click Rematch with current mode & difficulty settings
function restartCurrentGame() {
    document.getElementById('overlay').classList.remove('show');
    document.getElementById('gameOver').classList.remove('show');
    document.getElementById('newGameDialog').classList.remove('show');

    clearAllTimeouts();
    watchMatchRunning = false;
    watchMatchPausedByDialog = false;

    ttClear();
    initGame();
    initUI();
    updateGameInfo();

    if (gameMode === 'watch') {
        watchMatchRunning = true;
        updateButtonStates();
        updateStatus();
        aiMoveTimeout = setTimeout(() => {
            aiMoveTimeout = null;
            if (!gameOver && watchMatchRunning) makeAIMove();
        }, AI_MOVE_DELAY);
    }
}

// 1-click transition directly into AI vs AI Auto-Battle mode
function startInstantAutoBattle() {
    gameMode = 'watch';
    restartCurrentGame();
}

// Undo move(s) - always returns cleanly to White's turn
function undoMove() {
    if (gameMode === 'watch') return;

    // Cancel any in-flight AI move timer
    if (aiMoveTimeout) {
        clearTimeout(aiMoveTimeout);
        aiMoveTimeout = null;
    }
    hideAIThinking();

    // If promotion dialog is open, cancel the pending promotion first
    if (pendingPromotion) {
        cancelPromotion();
        return;
    }

    if (moveHistory.length === 0) return;

    // If it's currently Black's turn (e.g. AI hasn't moved yet or Black was checkmated),
    // undo 1 move to return to White's turn. If it's White's turn, undo 2 moves (AI + White).
    if (currentPlayer === 'black' || moveHistory.length === 1) {
        const result = undoSingleMove();
        if (!result.success) return;
    } else {
        const result1 = undoSingleMove();
        if (!result1.success) return;
        const result2 = undoSingleMove();
        if (!result2.success) return;
    }

    selectedSquare = null;
    gameOver = false;
    gameOverReason = '';
    lastMoveNodesEvaluated = 0;
    document.getElementById('overlay').classList.remove('show');
    document.getElementById('gameOver').classList.remove('show');
    document.getElementById('promotionDialog').classList.remove('show');

    updateMoveHistoryDisplay();
    renderBoard();
    updateStatus();
    updateCapturedPieces();
    updateEvaluationBar();
    updateMoveCounter();
    updateButtonStates();
}

// ============================================================================
// NEW GAME DIALOG
// ============================================================================

// Show the new game dialog
function showNewGameDialog() {
    // Pause AI vs AI if running and remember if it was active
    watchMatchPausedByDialog = false;
    if (gameMode === 'watch' && watchMatchRunning) {
        watchMatchPausedByDialog = true;
        watchMatchRunning = false;
        if (aiMoveTimeout) {
            clearTimeout(aiMoveTimeout);
            aiMoveTimeout = null;
        }
        hideAIThinking();
        updateButtonStates();
        updateStatus();
    }

    syncNewGameDialog();

    document.getElementById('gameOver').classList.remove('show');
    document.getElementById('overlay').classList.add('show');
    document.getElementById('newGameDialog').classList.add('show');
}

// Sync dialog values with current game settings
function syncNewGameDialog() {
    selectedDialogMode = gameMode;
    document.getElementById('modePlayerVsAI').classList.toggle('active', gameMode === 'ai');
    document.getElementById('modeAIvsAI').classList.toggle('active', gameMode === 'watch');

    document.getElementById('singleAISection').style.display = gameMode === 'ai' ? 'block' : 'none';
    document.getElementById('dualAISection').style.display = gameMode === 'watch' ? 'block' : 'none';

    document.getElementById('newGameDifficulty').value = aiDifficulty;
    document.getElementById('newGameWhiteAI').value = aiDifficultyWhite;
    document.getElementById('newGameBlackAI').value = aiDifficultyBlack;
}

// Handle mode selection in dialog
function selectGameMode(mode) {
    selectedDialogMode = mode;

    document.getElementById('modePlayerVsAI').classList.toggle('active', mode === 'ai');
    document.getElementById('modeAIvsAI').classList.toggle('active', mode === 'watch');

    document.getElementById('singleAISection').style.display = mode === 'ai' ? 'block' : 'none';
    document.getElementById('dualAISection').style.display = mode === 'watch' ? 'block' : 'none';
}

// Cancel new game dialog
function cancelNewGame() {
    document.getElementById('overlay').classList.remove('show');
    document.getElementById('newGameDialog').classList.remove('show');

    // Resume AI vs AI if it was paused by opening the dialog (works even on Move 1!)
    if (gameMode === 'watch' && watchMatchPausedByDialog && !gameOver) {
        watchMatchPausedByDialog = false;
        watchMatchRunning = true;
        updateButtonStates();
        updateStatus();
        aiMoveTimeout = setTimeout(() => {
            aiMoveTimeout = null;
            if (!gameOver && watchMatchRunning) makeAIMove();
        }, AI_MOVE_DELAY);
    }
}

// Start new game with dialog settings
function startNewGame() {
    gameMode = selectedDialogMode;

    if (gameMode === 'watch') {
        aiDifficultyWhite = parseInt(document.getElementById('newGameWhiteAI').value, 10);
        aiDifficultyBlack = parseInt(document.getElementById('newGameBlackAI').value, 10);
    } else {
        aiDifficulty = parseInt(document.getElementById('newGameDifficulty').value, 10);
    }

    document.getElementById('overlay').classList.remove('show');
    document.getElementById('newGameDialog').classList.remove('show');

    clearAllTimeouts();
    watchMatchRunning = false;
    watchMatchPausedByDialog = false;

    // Clear transposition table and search heuristics for fresh game
    ttClear();

    // Reset and start
    initGame();
    initUI();
    updateGameInfo();

    // Start AI vs AI match automatically
    if (gameMode === 'watch') {
        watchMatchRunning = true;
        updateButtonStates();
        updateStatus();
        aiMoveTimeout = setTimeout(() => {
            aiMoveTimeout = null;
            if (!gameOver && watchMatchRunning) makeAIMove();
        }, AI_MOVE_DELAY);
    }
}

// Update game info display (shows current mode and difficulty)
function updateGameInfo() {
    const gameInfoEl = document.getElementById('gameInfo');
    const mobileGameInfoEl = document.getElementById('mobileGameInfo');
    const diffNames = typeof DIFFICULTY_NAMES !== 'undefined'
        ? DIFFICULTY_NAMES
        : ['Beginner', 'Easy', 'Medium', 'Hard', 'Expert', 'Master', 'Grandmaster'];

    let infoText;
    if (gameMode === 'watch') {
        const whiteName = diffNames[aiDifficultyWhite - 1] || `Depth ${aiDifficultyWhite}`;
        const blackName = diffNames[aiDifficultyBlack - 1] || `Depth ${aiDifficultyBlack}`;
        infoText = `AI vs AI: ${whiteName} vs ${blackName}`;
    } else {
        const diffName = diffNames[aiDifficulty - 1] || `Depth ${aiDifficulty}`;
        infoText = `Player vs AI (${diffName})`;
    }

    if (gameInfoEl) gameInfoEl.textContent = infoText;
    if (mobileGameInfoEl) mobileGameInfoEl.textContent = infoText;
}

// ============================================================================
// AI THINKING INDICATOR
// ============================================================================

function showAIThinking(currentDifficulty) {
    const thinkingDialog = document.getElementById('aiThinking');
    const thinkingText = document.getElementById('aiThinkingText');
    const mobileThinkingDialog = document.getElementById('mobileAiThinking');
    const mobileThinkingText = document.getElementById('mobileAiThinkingText');
    const difficultyNames = typeof DIFFICULTY_NAMES !== 'undefined'
        ? DIFFICULTY_NAMES
        : ['Beginner', 'Easy', 'Medium', 'Hard', 'Expert', 'Master', 'Grandmaster'];
    const difficultyName = difficultyNames[currentDifficulty - 1] || 'Unknown';
    const thinkingMessage = `${difficultyName} (depth ${currentDifficulty})`;

    if (thinkingText) thinkingText.textContent = thinkingMessage;
    if (thinkingDialog) thinkingDialog.classList.add('show');
    if (mobileThinkingText) mobileThinkingText.textContent = thinkingMessage;
    if (mobileThinkingDialog) mobileThinkingDialog.classList.add('show');
}

function hideAIThinking() {
    const thinkingDialog = document.getElementById('aiThinking');
    const mobileThinkingDialog = document.getElementById('mobileAiThinking');
    if (thinkingDialog) thinkingDialog.classList.remove('show');
    if (mobileThinkingDialog) mobileThinkingDialog.classList.remove('show');

    updateStatus();
}

// ============================================================================
// DIALOGS & KEYBOARD ACCESSIBILITY
// ============================================================================

function showInfo() {
    document.getElementById('overlay').classList.add('show');
    document.getElementById('infoDialog').classList.add('show');
}

function closeInfo() {
    document.getElementById('overlay').classList.remove('show');
    document.getElementById('infoDialog').classList.remove('show');
}

function handleOverlayClick() {
    const mobileMenu = document.getElementById('mobileMenu');
    const infoDialog = document.getElementById('infoDialog');
    const newGameDialog = document.getElementById('newGameDialog');
    const gameOverDialog = document.getElementById('gameOver');
    const promotionDialog = document.getElementById('promotionDialog');

    if (mobileMenu && mobileMenu.classList.contains('show')) {
        closeMobileMenu();
    } else if (infoDialog && infoDialog.classList.contains('show')) {
        closeInfo();
    } else if (newGameDialog && newGameDialog.classList.contains('show')) {
        cancelNewGame();
    } else if (gameOverDialog && gameOverDialog.classList.contains('show')) {
        closeGameOver();
    } else if (promotionDialog && promotionDialog.classList.contains('show')) {
        cancelPromotion();
    }
}

function openMobileMenu() {
    document.getElementById('overlay').classList.add('show');
    document.getElementById('mobileMenu').classList.add('show');
}

function closeMobileMenu() {
    document.getElementById('overlay').classList.remove('show');
    document.getElementById('mobileMenu').classList.remove('show');
}

// Support Escape key to dismiss active dialogs and Enter key to start/rematch
if (typeof document !== 'undefined') {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const overlay = document.getElementById('overlay');
            if (overlay && overlay.classList.contains('show')) {
                handleOverlayClick();
            } else if (selectedSquare) {
                selectedSquare = null;
                renderBoard();
            }
        } else if (e.key === 'Enter') {
            const newGameDialog = document.getElementById('newGameDialog');
            const gameOverDialog = document.getElementById('gameOver');
            if (newGameDialog && newGameDialog.classList.contains('show')) {
                e.preventDefault();
                startNewGame();
            } else if (gameOverDialog && gameOverDialog.classList.contains('show')) {
                e.preventDefault();
                restartCurrentGame();
            }
        }
    });
}

// ============================================================================
// INITIALIZATION HELPERS
// ============================================================================

// Clear all UI timeouts
function clearAllTimeouts() {
    if (arrowFadeTimeout) { clearTimeout(arrowFadeTimeout); arrowFadeTimeout = null; }
    if (arrowRemovalTimeout) { clearTimeout(arrowRemovalTimeout); arrowRemovalTimeout = null; }
    if (hintArrowTimeout) { clearTimeout(hintArrowTimeout); hintArrowTimeout = null; }
    if (hintArrowRemovalTimeout) { clearTimeout(hintArrowRemovalTimeout); hintArrowRemovalTimeout = null; }
    if (gameOverDialogTimeout) { clearTimeout(gameOverDialogTimeout); gameOverDialogTimeout = null; }
    if (aiMoveTimeout) { clearTimeout(aiMoveTimeout); aiMoveTimeout = null; }
    arrowFadeTimeoutMove = null;
}

// Initialize UI elements after game init
function initUI() {
    const svg = document.getElementById('moveArrowSvg');
    if (svg) {
        const arrows = svg.querySelectorAll('line, circle, .hint-arrow');
        arrows.forEach(el => el.remove());
        svg.classList.remove('fade-out');
        svg.style.opacity = '1';
    }

    document.getElementById('overlay').classList.remove('show');
    document.getElementById('promotionDialog').classList.remove('show');
    document.getElementById('gameOver').classList.remove('show');
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
    updateGameInfo();
    document.getElementById('moveHistory').innerHTML = '';
    document.getElementById('mobileMoveHistory').innerHTML = '';
    document.getElementById('hintText').style.display = 'none';
}
