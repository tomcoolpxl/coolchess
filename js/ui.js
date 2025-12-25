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
let selectedDialogMode = 'ai'; // For new game dialog

// ============================================================================
// RENDERING
// ============================================================================

// Render the chessboard
function renderBoard() {
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
        if (arrowFadeTimeout) {
            clearTimeout(arrowFadeTimeout);
            arrowFadeTimeout = null;
            arrowFadeTimeoutMove = null;
        }
        return;
    }

    // Check if this is a new move
    const moveKey = `${lastMove.from.row},${lastMove.from.col}->${lastMove.to.row},${lastMove.to.col}`;
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
                // Remove last-move highlighting from squares
                document.querySelectorAll('.square.last-move').forEach(sq => sq.classList.remove('last-move'));
                arrowRemovalTimeout = null;
            }, ARROW_FADE_DURATION);
        }, ARROW_FADE_DELAY);
    }

    // Get actual square size from rendered board
    const boardSquare = document.querySelector('.square');
    const squareSize = boardSquare ? boardSquare.offsetWidth : 70;
    const fromX = lastMove.from.col * squareSize + squareSize / 2;
    const fromY = lastMove.from.row * squareSize + squareSize / 2;
    const toX = lastMove.to.col * squareSize + squareSize / 2;
    const toY = lastMove.to.row * squareSize + squareSize / 2;

    // Scale arrow elements based on square size
    const circleRadius = squareSize / 8.75;
    const strokeWidth = squareSize / 14;

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

// Draw hint arrow in different color
function drawHintArrow(fromRow, fromCol, toRow, toCol) {
    const svg = document.getElementById('moveArrowSvg');

    const boardSquare = document.querySelector('.square');
    const squareSize = boardSquare ? boardSquare.offsetWidth : 70;
    const fromX = fromCol * squareSize + squareSize / 2;
    const fromY = fromRow * squareSize + squareSize / 2;
    const toX = toCol * squareSize + squareSize / 2;
    const toY = toRow * squareSize + squareSize / 2;

    // Create arrow line (red dashed)
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', fromX);
    line.setAttribute('y1', fromY);
    line.setAttribute('x2', toX);
    line.setAttribute('y2', toY);
    line.setAttribute('stroke', '#FF0000');
    line.setAttribute('stroke-width', '4');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('stroke-dasharray', '8,12');
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

// Highlight legal moves for selected piece
function highlightLegalMoves(row, col) {
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
            dialog.classList.remove('show');
            overlay.classList.remove('show');

            // Use the engine's completePromotion and UI wrapper
            executePromotionWithUI(piece);

            // Trigger AI if needed
            if (!gameOver) {
                if (gameMode === 'ai' && currentPlayer === 'black') {
                    setTimeout(() => { if (!gameOver) makeAIMove(); }, AI_MOVE_DELAY);
                } else if (gameMode === 'watch' && watchMatchRunning) {
                    setTimeout(() => { if (!gameOver && watchMatchRunning) makeAIMove(); }, AI_WATCH_DELAY);
                }
            }
        };
        piecesContainer.appendChild(div);
    });

    overlay.classList.add('show');
    dialog.classList.add('show');
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
    document.getElementById('whiteCaptured').innerHTML =
        capturedPieces.white.map(p => PIECES[p]).join(' ');
    document.getElementById('blackCaptured').innerHTML =
        capturedPieces.black.map(p => PIECES_HOLLOW[p]).join(' ');
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
    let displayText = `Move ${fullMoveNumber}`;

    if (halfMoveClock > 20) {
        displayText += ` | Draw in ${100 - halfMoveClock} moves`;
    }

    counter.textContent = displayText;
}

// Update button states based on game mode and history
function updateButtonStates() {
    const undoBtn = document.getElementById('undoBtn');
    const hintBtn = document.getElementById('hintBtn');

    if (undoBtn) {
        const canUndo = gameMode !== 'watch' && moveHistory.length > 0;
        undoBtn.disabled = !canUndo;
        undoBtn.style.opacity = canUndo ? '1' : '0.5';
        undoBtn.style.cursor = canUndo ? 'pointer' : 'not-allowed';
    }

    if (hintBtn) {
        const canHint = gameMode !== 'watch' && !gameOver;
        hintBtn.disabled = !canHint;
        hintBtn.style.opacity = canHint ? '1' : '0.5';
        hintBtn.style.cursor = canHint ? 'pointer' : 'not-allowed';
    }
}

// ============================================================================
// USER INPUT HANDLING
// ============================================================================

// Add move to history display
function addMoveToHistory(moveInfo) {
    const piece = moveInfo.piece;
    const from = moveInfo.from;
    const to = moveInfo.to;
    const moveNumber = moveInfo.moveNumber;
    const promotedTo = moveInfo.promotedTo;

    const isWhite = piece === piece.toUpperCase();
    const pieceSymbol = isWhite ? PIECES_HOLLOW[piece] : PIECES[piece];
    let moveNotation = `${pieceSymbol} ${String.fromCharCode(97 + from.col)}${8 - from.row} → ${String.fromCharCode(97 + to.col)}${8 - to.row}`;

    if (promotedTo) {
        moveNotation += `=${PIECES[promotedTo]}`;
    }

    const moveDiv = document.createElement('div');
    moveDiv.textContent = `${moveNumber}. ${moveNotation}`;
    const mobileMoveDiv = moveDiv.cloneNode(true);

    document.getElementById('moveHistory').appendChild(moveDiv);
    document.getElementById('moveHistory').scrollTop = document.getElementById('moveHistory').scrollHeight;
    document.getElementById('mobileMoveHistory').appendChild(mobileMoveDiv);
    document.getElementById('mobileMoveHistory').scrollTop = document.getElementById('mobileMoveHistory').scrollHeight;
}

// Show game over dialog
function showGameOverDialog(gameOverResult) {
    const gameOverDialog = document.getElementById('gameOver');
    const overlay = document.getElementById('overlay');
    const title = document.getElementById('gameOverTitle');
    const message = document.getElementById('gameOverMessage');

    title.textContent = gameOverResult.reason;
    message.textContent = gameOverResult.message;

    overlay.classList.add('show');
    gameOverDialog.classList.add('show');

    // Auto-close dialog after 2 seconds
    if (gameOverDialogTimeout) {
        clearTimeout(gameOverDialogTimeout);
    }
    gameOverDialogTimeout = setTimeout(() => {
        gameOverDialog.classList.remove('show');
        overlay.classList.remove('show');
        gameOverDialogTimeout = null;
    }, 2000);
}

// UI wrapper for makeMove - handles all UI updates after a move
function executeMoveWithUI(fromRow, fromCol, toRow, toCol, promotionPiece = null) {
    const result = makeMove(fromRow, fromCol, toRow, toCol, promotionPiece);

    if (!result.success) return result;

    // If promotion is needed, show dialog and return
    if (result.needsPromotion) {
        showPromotionDialog(toRow, toCol);
        return result;
    }

    // Add move to history
    addMoveToHistory(result.moveInfo);

    // Update all UI elements
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

    // Add move to history
    addMoveToHistory(result.moveInfo);

    // Update all UI elements
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

// Handle square click
function handleSquareClick(row, col) {
    if (gameOver) return;
    if (gameMode === 'watch') return;
    if (gameMode === 'ai' && currentPlayer === 'black') return;

    const piece = board[row][col];

    if (selectedSquare) {
        const fromRow = selectedSquare.row;
        const fromCol = selectedSquare.col;

        if (isValidMove(fromRow, fromCol, row, col)) {
            const result = executeMoveWithUI(fromRow, fromCol, row, col);
            selectedSquare = null;

            // Only trigger AI if move completed (not waiting for promotion)
            if (!result.needsPromotion && !gameOver) {
                if (gameMode === 'ai' && currentPlayer === 'black') {
                    setTimeout(() => { if (!gameOver) makeAIMove(); }, AI_MOVE_DELAY);
                } else if (gameMode === 'watch' && watchMatchRunning) {
                    setTimeout(() => { if (!gameOver && watchMatchRunning) makeAIMove(); }, AI_WATCH_DELAY);
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

// Get hint for current player
function getHint() {
    if (gameOver) return;
    if (gameMode === 'watch') return;

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
        const bestMove = minimax(Math.min(aiDifficulty, 2), currentPlayer, -Infinity, Infinity, currentPlayer === 'white');

        if (bestMove.move) {
            const piece = board[bestMove.move.from.row][bestMove.move.from.col];
            const fromSquare = String.fromCharCode(97 + bestMove.move.from.col) + (8 - bestMove.move.from.row);
            const toSquare = String.fromCharCode(97 + bestMove.move.to.col) + (8 - bestMove.move.to.row);

            hintText.textContent = `Suggested move: ${PIECES[piece]} from ${fromSquare} to ${toSquare}`;
            drawHintArrow(bestMove.move.from.row, bestMove.move.from.col,
                         bestMove.move.to.row, bestMove.move.to.col);
        } else {
            hintText.textContent = 'No legal moves available.';
        }

        if (hintBtn) {
            hintBtn.disabled = false;
            hintBtn.style.opacity = '1';
            hintBtn.style.cursor = 'pointer';
        }
    }, 100);
}

// ============================================================================
// GAME CONTROLS
// ============================================================================

// Start new game (called from game over dialog)
function newGame() {
    document.getElementById('overlay').classList.remove('show');
    document.getElementById('gameOver').classList.remove('show');

    // Show new game dialog to let user configure options
    showNewGameDialog();
}

// Undo move(s) - undoes 2 moves to return to player's turn
function undoMove() {
    if (gameMode === 'watch') return;

    // Undo 2 moves (AI + player) or just 1 if only 1 exists
    if (moveHistory.length < 2) {
        const result = undoSingleMove();
        if (!result.success) return;
    } else {
        const result1 = undoSingleMove();
        if (!result1.success) return;
        const result2 = undoSingleMove();
        if (!result2.success) return;
    }

    gameOver = false;
    gameOverReason = '';
    document.getElementById('overlay').classList.remove('show');
    document.getElementById('gameOver').classList.remove('show');

    // Remove last move(s) from history display
    updateMoveHistoryDisplay();

    renderBoard();
    updateStatus();
    updateCapturedPieces();
    updateEvaluationBar();
    updateMoveCounter();
    updateButtonStates();
}

// Update move history display to match current state
function updateMoveHistoryDisplay() {
    const moveHistoryEl = document.getElementById('moveHistory');
    const mobileMoveHistoryEl = document.getElementById('mobileMoveHistory');

    // Rebuild move history from scratch
    moveHistoryEl.innerHTML = '';
    mobileMoveHistoryEl.innerHTML = '';

    moveHistory.forEach(move => {
        const piece = move.piece;
        const from = move.from;
        const to = move.to;

        const isWhite = piece === piece.toUpperCase();
        const pieceSymbol = isWhite ? PIECES_HOLLOW[piece] : PIECES[piece];
        const moveNotation = `${pieceSymbol} ${String.fromCharCode(97 + from.col)}${8 - from.row} → ${String.fromCharCode(97 + to.col)}${8 - to.row}`;

        const moveNumber = move.fullMoveNumber;
        const moveDiv = document.createElement('div');
        moveDiv.textContent = `${moveNumber}. ${moveNotation}`;
        const mobileMoveDiv = moveDiv.cloneNode(true);

        moveHistoryEl.appendChild(moveDiv);
        mobileMoveHistoryEl.appendChild(mobileMoveDiv);
    });

    moveHistoryEl.scrollTop = moveHistoryEl.scrollHeight;
    mobileMoveHistoryEl.scrollTop = mobileMoveHistoryEl.scrollHeight;
}

// ============================================================================
// NEW GAME DIALOG
// ============================================================================

// Show the new game dialog
function showNewGameDialog() {
    // Pause AI vs AI if running
    if (gameMode === 'watch') {
        watchMatchRunning = false;
    }

    // Sync dialog with current settings
    syncNewGameDialog();

    document.getElementById('overlay').classList.add('show');
    document.getElementById('newGameDialog').classList.add('show');
}

// Sync dialog values with current game settings
function syncNewGameDialog() {
    // Set mode toggle
    selectedDialogMode = gameMode;
    document.getElementById('modePlayerVsAI').classList.toggle('active', gameMode === 'ai');
    document.getElementById('modeAIvsAI').classList.toggle('active', gameMode === 'watch');

    // Show/hide appropriate difficulty sections
    document.getElementById('singleAISection').style.display = gameMode === 'ai' ? 'block' : 'none';
    document.getElementById('dualAISection').style.display = gameMode === 'watch' ? 'block' : 'none';

    // Set difficulty values
    document.getElementById('newGameDifficulty').value = aiDifficulty;
    document.getElementById('newGameWhiteAI').value = aiDifficultyWhite;
    document.getElementById('newGameBlackAI').value = aiDifficultyBlack;
}

// Handle mode selection in dialog
function selectGameMode(mode) {
    selectedDialogMode = mode;

    // Update toggle buttons
    document.getElementById('modePlayerVsAI').classList.toggle('active', mode === 'ai');
    document.getElementById('modeAIvsAI').classList.toggle('active', mode === 'watch');

    // Show/hide appropriate difficulty sections
    document.getElementById('singleAISection').style.display = mode === 'ai' ? 'block' : 'none';
    document.getElementById('dualAISection').style.display = mode === 'watch' ? 'block' : 'none';
}

// Cancel new game dialog
function cancelNewGame() {
    document.getElementById('overlay').classList.remove('show');
    document.getElementById('newGameDialog').classList.remove('show');

    // Resume AI vs AI if was running and game not over
    if (gameMode === 'watch' && !gameOver && moveHistory.length > 0) {
        watchMatchRunning = true;
        setTimeout(makeAIMove, AI_MOVE_DELAY);
    }
}

// Start new game with dialog settings
function startNewGame() {
    // Read dialog values
    gameMode = selectedDialogMode;

    if (gameMode === 'watch') {
        aiDifficultyWhite = parseInt(document.getElementById('newGameWhiteAI').value);
        aiDifficultyBlack = parseInt(document.getElementById('newGameBlackAI').value);
    } else {
        aiDifficulty = parseInt(document.getElementById('newGameDifficulty').value);
    }

    // Close dialog
    document.getElementById('overlay').classList.remove('show');
    document.getElementById('newGameDialog').classList.remove('show');

    // Clear UI state
    clearAllTimeouts();
    watchMatchRunning = false;

    // Clear transposition table for fresh game
    ttClear();

    // Reset and start
    initGame();
    initUI();
    updateGameInfo();

    // Start AI vs AI match automatically
    if (gameMode === 'watch') {
        watchMatchRunning = true;
        setTimeout(makeAIMove, AI_MOVE_DELAY);
    }
}

// Update game info display (shows current mode and difficulty)
function updateGameInfo() {
    const gameInfoEl = document.getElementById('gameInfo');
    const mobileGameInfoEl = document.getElementById('mobileGameInfo');
    const diffNames = ['Beginner', 'Easy', 'Medium', 'Hard'];

    let infoText;
    if (gameMode === 'watch') {
        const whiteName = diffNames[aiDifficultyWhite - 1];
        const blackName = diffNames[aiDifficultyBlack - 1];
        infoText = `AI vs AI: ${whiteName} vs ${blackName}`;
    } else {
        const diffName = diffNames[aiDifficulty - 1];
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
}

function hideAIThinking() {
    const thinkingDialog = document.getElementById('aiThinking');
    const mobileThinkingDialog = document.getElementById('mobileAiThinking');
    thinkingDialog.classList.remove('show');
    if (mobileThinkingDialog) {
        mobileThinkingDialog.classList.remove('show');
    }
}

// ============================================================================
// DIALOGS
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

    if (mobileMenu && mobileMenu.classList.contains('show')) {
        closeMobileMenu();
    } else if (infoDialog && infoDialog.classList.contains('show')) {
        closeInfo();
    } else if (newGameDialog && newGameDialog.classList.contains('show')) {
        cancelNewGame();
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
    // Clear SVG arrows
    const svg = document.getElementById('moveArrowSvg');
    if (svg) {
        const arrows = svg.querySelectorAll('line, circle, .hint-arrow');
        arrows.forEach(el => el.remove());
        svg.classList.remove('fade-out');
        svg.style.opacity = '1';
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
    updateGameInfo();
    document.getElementById('moveHistory').innerHTML = '';
    document.getElementById('mobileMoveHistory').innerHTML = '';
    document.getElementById('hintText').style.display = 'none';
}
