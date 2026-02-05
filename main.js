import { createRenderer } from './src/renderer.js';
import { createPhysics } from './src/physics.js';

// Game Constants
const TARGET_ANGLES = [40, 85, 90, 100, 135, 160, 170];
const SCORE_PER_EXACT_HIT = 100;
const ANGLE_TOLERANCE = 2;
const MAX_ROUNDS = 10;

// State
let state = {
    score: 0,
    level: 1, // Acts as round counter
    currentRound: 1,
    targetAngle: 0,
    currentAngle: 180,
    isBending: false,
    gamePhase: 'IDLE', // IDLE, BENDING, STOPPED, RESULT, GAMEOVER
    startTime: 0,
    bendSpeed: 30,
};

// DOM Elements
const canvas = document.getElementById('game-canvas');
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const targetAngleEl = document.getElementById('target-angle');
const currentAngleEl = document.getElementById('current-angle');
const btnAction = document.getElementById('btn-action');
const btnNext = document.getElementById('btn-next');

// Subsystems
const renderer = createRenderer(canvas);
const physics = createPhysics();

// Audio
import soundUrl from './src/sound.mp3';
const machineAudio = new Audio(soundUrl);
machineAudio.loop = true;

function initAudio() {
    // Preload potentially?
    // Modern browsers prevent autoplay but interaction is required for startBending anyway.
}

function startSound() {
    machineAudio.currentTime = 0;
    machineAudio.play().catch(e => console.warn("Audio play failed:", e));
}

function stopSound() {
    machineAudio.pause();
    machineAudio.currentTime = 0;
}

function initGame() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Controls: Single Toggle Button
    btnAction.addEventListener('mousedown', toggleAction);
    btnAction.addEventListener('touchstart', (e) => { e.preventDefault(); toggleAction(); });

    // Next level
    btnNext.addEventListener('click', nextLevel);

    // Initial Setup
    nextLevel();
    loadMiniScoreboard();

    // Game Loop
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
}

function nextLevel() {
    if (state.currentRound > MAX_ROUNDS) {
        endGame();
        return;
    }

    state.gamePhase = 'IDLE';
    state.currentAngle = 180;
    state.isBending = false;
    state.targetAngle = TARGET_ANGLES[Math.floor(Math.random() * TARGET_ANGLES.length)];

    state.level = state.currentRound; // Update UI level display
    updateUI();

    btnAction.innerText = "START / BOCKA"; // Reset text
    btnAction.disabled = false;
    btnAction.classList.remove('stop-btn');
    btnAction.classList.add('start-btn');

    btnNext.style.display = 'none';
}

function endGame() {
    state.gamePhase = 'GAMEOVER';
    btnAction.disabled = true;
    btnNext.style.display = 'none';

    checkHighScore();
}

async function checkHighScore() {
    try {
        const response = await fetch('/api/scores');
        let highScores = [];
        if (response.ok) {
            highScores = await response.json();
            // Parse names to remove timestamp suffix (Format: Name#Timestamp)
            highScores = highScores.map(entry => {
                return {
                    name: entry.name.split('#')[0],
                    score: entry.score
                };
            });
        }

        // Check if score qualifies for top 5 (or top 10 on server)
        // If server returns top 10, we check if we beat the last one or if list is not full
        if (highScores.length < 10 || state.score > highScores[highScores.length - 1].score) {
            showHighScoreInput();
        } else {
            showHighScoreBoard(); // Just show board if we didn't make the cut
        }
    } catch (e) {
        console.error("Could not fetch high scores", e);
        // Fallback or just show board
        showHighScoreBoard();
    }
}

function showHighScoreInput() {
    const modal = document.getElementById('highscore-modal');
    const modalScore = document.getElementById('modal-score');
    modalScore.innerText = state.score;
    modal.style.display = 'flex';
}

function showHighScoreBoard() {
    const board = document.getElementById('scoreboard-modal');
    renderScoreboard();
    board.style.display = 'flex';
}

async function saveScore() {
    const nameInput = document.getElementById('player-name');
    const name = nameInput.value.trim() || "Anonym";
    const btnSave = document.querySelector('#highscore-modal button');

    // Disable button to prevent double submit
    btnSave.disabled = true;
    btnSave.innerText = "SPARAR...";

    try {
        await fetch('/api/scores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, score: state.score })
        });
    } catch (e) {
        console.error("Failed to save score", e);
        alert("Kunde inte spara poäng till molnet. Testa igen.");
        btnSave.disabled = false;
        btnSave.innerText = "SPARA";
        return;
    }

    document.getElementById('highscore-modal').style.display = 'none';

    // Reset button for next time (though we reload/reset usually)
    btnSave.disabled = false;
    btnSave.innerText = "SPARA";

    showHighScoreBoard();
}

// Make saveScore globally accessible or bind it in init
window.saveScore = saveScore;
window.restartGame = restartGame;

function restartGame() {
    state.score = 0;
    state.currentRound = 1;
    state.level = 1;
    document.getElementById('scoreboard-modal').style.display = 'none';
    nextLevel();
}

async function renderScoreboard() {
    const list = document.getElementById('highscore-list');
    list.innerHTML = '<li>Laddar...</li>';

    try {
        const response = await fetch('/api/scores');
        if (response.ok) {
            let highScores = await response.json();
            list.innerHTML = '';

            highScores.forEach((entry, index) => {
                const cleanName = entry.name.split('#')[0];
                const li = document.createElement('li');
                li.innerHTML = `<span>${index + 1}. ${cleanName}</span> <span>${entry.score} p</span>`;
                if (index === 0) li.style.color = '#ffd700';
                list.appendChild(li);
            });
        } else {
            list.innerHTML = '<li>Kunde inte hämta topplistan.</li>';
        }
    } catch (e) {
        list.innerHTML = '<li>Kunde inte hämta topplistan.</li>';
    }
}

async function renderMiniScoreboard() {
    const list = document.getElementById('mini-highscore-list');
    if (!list) return;

    // Optimization: Don't fetch on every frame updateUI relies on.
    // Fetch only periodically or once at start/end of rounds.
    // For now, let's just make sure updateUI doesn't spam this.
    // Actually, updateUI calls this every frame? Wait.
    // YES, updateUI is called in update() which is in gameLoop!
    // BAD! We should NOT allow renderMiniScoreboard inside updateUI if it does network calls.

    // Changing strategy: Call renderMiniScoreboard ONLY on init and round changes.
    // Removing fetch from here or flagging it.
}

// Separate Mini Scoreboard loader
async function loadMiniScoreboard() {
    const list = document.getElementById('mini-highscore-list');
    if (!list) return;

    try {
        const response = await fetch('/api/scores');
        if (response.ok) {
            let highScores = await response.json();
            // Take top 5
            list.innerHTML = '';
            highScores.slice(0, 10).forEach((entry, index) => {
                const cleanName = entry.name.split('#')[0];
                const li = document.createElement('li');
                li.innerHTML = `<span>${index + 1}.</span> <span>${cleanName}</span> <span>${entry.score}</span>`;
                if (index === 0) li.style.color = '#ffd700';
                list.appendChild(li);
            });
        }
    } catch (e) {
        console.log("Mini scoreboard failed load");
    }
}

function toggleAction() {
    if (state.gamePhase === 'IDLE') {
        startBending();
    } else if (state.gamePhase === 'BENDING') {
        stopBending();
    }
}

function startBending() {
    if (state.gamePhase !== 'IDLE') return;

    // Init audio on first user gesture if needed
    // (Audio object handles this naturally on play() after user interaction)

    startSound();

    state.gamePhase = 'BENDING';
    state.isBending = true;
    state.lastTime = performance.now();

    btnAction.innerText = "STOPP";
    btnAction.classList.remove('start-btn');
    btnAction.classList.add('stop-btn');
}

function stopBending() {
    if (state.gamePhase !== 'BENDING') return;

    stopSound();

    state.gamePhase = 'STOPPED';
    state.isBending = false;

    calculateScore();
    state.currentRound++;

    btnAction.innerText = "KLART";
    btnAction.disabled = true;
    btnAction.classList.remove('stop-btn');

    if (state.currentRound > MAX_ROUNDS) {
        btnNext.innerText = "SE RESULTAT";
    } else {
        btnNext.innerText = "NÄSTA PLÅT";
    }
    btnNext.style.display = 'inline-block';
}

function calculateScore() {
    // Gradual scoring logic
    const diff = Math.abs(state.currentAngle - state.targetAngle);
    let points = 0;

    if (diff < 0.5) {
        points = SCORE_PER_EXACT_HIT; // 100
    } else {
        // Linear drop off
        // 100 - (diff * 5) -> 20 deg off is 0 points.
        points = Math.max(0, Math.floor(100 - (diff * 5)));
    }

    state.score += points;
    updateUI();
}

let lastTime = 0;
function gameLoop(timestamp) {
    const deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    update(deltaTime);
    draw();

    requestAnimationFrame(gameLoop);
}

function update(dt) {
    if (state.isBending) {
        state.currentAngle -= state.bendSpeed * dt;

        // Clamp
        if (state.currentAngle < 45) {
            state.currentAngle = 45;
            stopBending(); // Force stop if max bend reached
        }
    }

    // Update UI constantly during bend
    if (state.isBending) {
        currentAngleEl.innerText = "???";
    } else {
        currentAngleEl.innerText = state.currentAngle.toFixed(1) + "°";
        // Highlight result color
        if (state.gamePhase === 'STOPPED') {
            const diff = Math.abs(state.currentAngle - state.targetAngle);
            if (diff < 0.5) currentAngleEl.style.color = '#00ff00';
            else if (diff < 5) currentAngleEl.style.color = '#ffff00';
            else currentAngleEl.style.color = '#ff0000';
        } else {
            currentAngleEl.style.color = 'var(--digital-green)'; // Reset
        }
    }
}

function draw() {
    renderer.render(state);
}

function updateUI() {
    scoreEl.innerText = state.score;
    levelEl.innerText = state.level;
    targetAngleEl.innerText = state.targetAngle + "°";
    // renderMiniScoreboard(); // MOVED: Too expensive for loop
}

initGame();
