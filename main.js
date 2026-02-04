import { createRenderer } from './src/renderer.js';
import { createPhysics } from './src/physics.js';

// Game Constants
const TARGET_ANGLES = [90, 100, 135, 170];
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

// Audio Context
let audioCtx;
let oscillator;
let gainNode;

function initAudio() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
    }
}

function startSound() {
    if (!audioCtx) initAudio();
    if (oscillator) return;

    oscillator = audioCtx.createOscillator();
    gainNode = audioCtx.createGain();

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(50, audioCtx.currentTime); // Low hum

    // Fade in
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.1);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
}

function stopSound() {
    if (oscillator) {
        const now = audioCtx.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.1);

        oscillator.stop(now + 0.1);
        oscillator = null;
    }
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

    // Game Loop
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);

    // Call initAudio on user interaction
    document.body.addEventListener('click', initAudio, { once: true });
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

function checkHighScore() {
    const highScores = JSON.parse(localStorage.getItem('kantpress_highScores')) || [];
    // Sort high scores
    highScores.sort((a, b) => b.score - a.score);

    // Check if score qualifies for top 5
    if (highScores.length < 5 || state.score > highScores[highScores.length - 1].score) {
        showHighScoreInput();
    } else {
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

function saveScore() {
    const nameInput = document.getElementById('player-name');
    const name = nameInput.value.trim() || "Anonym";

    const highScores = JSON.parse(localStorage.getItem('kantpress_highScores')) || [];
    highScores.push({ name: name, score: state.score, date: new Date().toISOString() });
    highScores.sort((a, b) => b.score - a.score);

    // Keep top 5
    if (highScores.length > 5) highScores.length = 5;

    localStorage.setItem('kantpress_highScores', JSON.stringify(highScores));

    document.getElementById('highscore-modal').style.display = 'none';
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

function renderScoreboard() {
    const list = document.getElementById('highscore-list');
    list.innerHTML = '';
    const highScores = JSON.parse(localStorage.getItem('kantpress_highScores')) || [];

    highScores.forEach((entry, index) => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${index + 1}. ${entry.name}</span> <span>${entry.score} p</span>`;
        list.appendChild(li);
    });
}

function renderMiniScoreboard() {
    const list = document.getElementById('mini-highscore-list');
    if (!list) return;
    list.innerHTML = '';
    const highScores = JSON.parse(localStorage.getItem('kantpress_highScores')) || [];

    highScores.slice(0, 5).forEach((entry, index) => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${index + 1}.</span> <span>${entry.name}</span> <span>${entry.score}</span>`;
        if (index === 0) li.style.color = '#ffd700';
        list.appendChild(li);
    });
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
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

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
    renderMiniScoreboard();
}

initGame();
