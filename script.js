const turnMarker = document.getElementById("turn");
const turnMessage = document.getElementById("turn-message");
const allCells = [...document.querySelectorAll(".cell")];
const settingsModal = document.getElementById("settings-modal");
const openSettingsButton = document.getElementById("open-settings");
const closeSettingsButton = document.getElementById("close-settings");
const restartButton = document.getElementById("restart-game");
const winCount = { X: 0, O: 0 };
const settings = {
  theme: "neon",
  nameX: "غزل",
  nameO: "ريما",
  colorX: "#00f3ff",
  colorO: "#ff007f",
  aiX: false,
  aiO: false
};
let currentPlayer = "X";
let gameOver = false;
let aiTimer = null;

const winningCombinations = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

function playerName(mark) {
  const customName = mark === "X" ? settings.nameX : settings.nameO;
  return customName || (mark === "X" ? "غزل" : "ريما");
}

function renderTurnMessage() {
  const mark = document.createElement("span");
  mark.className = "turn-mark";
  mark.textContent = `${playerName(currentPlayer)} (${currentPlayer})`;
  mark.style.color = currentPlayer === "X" ? settings.colorX : settings.colorO;
  turnMessage.replaceChildren(mark, document.createTextNode(" دورك"));
}

function renderNames() {
  document.getElementById("score-x-name").textContent = playerName("X");
  document.getElementById("score-o-name").textContent = playerName("O");
  document.getElementById("ai-x-label").textContent = `${playerName("X")} تلعب كذكاء اصطناعي (X)`;
  document.getElementById("ai-o-label").textContent = `${playerName("O")} تلعب كذكاء اصطناعي (O)`;
  document.querySelector(".player-x").innerHTML = `<span class="chip-symbol">X</span> ${escapeHtml(playerName("X"))}`;
  document.querySelector(".player-o").innerHTML = `<span class="chip-symbol">O</span> ${escapeHtml(playerName("O"))}`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function renderScore() {
  document.getElementById("score-x").textContent = winCount.X;
  document.getElementById("score-o").textContent = winCount.O;
}

function isAiPlayer(mark) {
  return mark === "X" ? settings.aiX : settings.aiO;
}

function checkWinner() {
  for (const [a, b, c] of winningCombinations) {
    const mark = allCells[a].textContent;
    if (mark && mark === allCells[b].textContent && mark === allCells[c].textContent) return mark;
  }
  return null;
}

function finishRound(result) {
  clearTimeout(aiTimer);
  clearTimeout(aiTimer);
  gameOver = true;
  allCells.forEach((cell) => cell.classList.add("locked"));
  restartButton.hidden = false;
  if (result === "draw") {
    turnMessage.textContent = "تعادل!";
  } else {
    winCount[result] += 1;
    renderScore();
    turnMessage.textContent = `فازت ${playerName(result)}!`;
  }
}

function makeMove(index) {
  if (gameOver || allCells[index].textContent) return;
  const cell = allCells[index];
  cell.textContent = currentPlayer;
  cell.dataset.mark = currentPlayer;

  const winner = checkWinner();
  if (winner) return finishRound(winner);
  if (allCells.every((item) => item.textContent)) return finishRound("draw");

  currentPlayer = currentPlayer === "X" ? "O" : "X";
  renderTurnMessage();
  scheduleAiMove();
}

function getBestAiMove(aiMark) {
  const board = allCells.map((cell) => cell.textContent || "");
  const opponent = aiMark === "X" ? "O" : "X";

  function winnerFor(state) {
    for (const [a, b, c] of winningCombinations) {
      if (state[a] && state[a] === state[b] && state[a] === state[c]) return state[a];
    }
    return null;
  }

  function minimax(state, isMaximizing, depth) {
    const winner = winnerFor(state);
    if (winner === aiMark) return 10 - depth;
    if (winner === opponent) return depth - 10;
    if (state.every(Boolean)) return 0;

    let best = isMaximizing ? -Infinity : Infinity;
    for (let index = 0; index < state.length; index += 1) {
      if (state[index]) continue;
      state[index] = isMaximizing ? aiMark : opponent;
      const score = minimax(state, !isMaximizing, depth + 1);
      state[index] = "";
      best = isMaximizing ? Math.max(best, score) : Math.min(best, score);
    }
    return best;
  }

  let bestScore = -Infinity;
  const bestMoves = [];
  for (let index = 0; index < board.length; index += 1) {
    if (board[index]) continue;
    board[index] = aiMark;
    const score = minimax(board, false, 0);
    board[index] = "";
    if (score > bestScore) {
      bestScore = score;
      bestMoves.length = 0;
      bestMoves.push(index);
    } else if (score === bestScore) {
      bestMoves.push(index);
    }
  }
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

function scheduleAiMove() {
  clearTimeout(aiTimer);
  if (gameOver || !isAiPlayer(currentPlayer)) return;
  aiTimer = setTimeout(() => {
    if (gameOver || !isAiPlayer(currentPlayer)) return;
    const move = getBestAiMove(currentPlayer);
    if (move !== undefined) makeMove(move);
  }, 650);
}

function restartGame() {
  clearTimeout(aiTimer);
  clearTimeout(aiTimer);
  currentPlayer = "X";
  gameOver = false;
  allCells.forEach((cell) => {
    cell.textContent = "";
    delete cell.dataset.mark;
    cell.classList.remove("locked");
  });
  renderTurnMessage();
  restartButton.hidden = true;
  scheduleAiMove();
}

allCells.forEach((cell) => {
  cell.addEventListener("click", () => {
    if (isAiPlayer(currentPlayer)) return;
    makeMove([...allCells].indexOf(cell));
  });
});

restartButton.addEventListener("click", restartGame);

function showSettings() {
  settingsModal.hidden = false;
}

function hideSettings() {
  settingsModal.hidden = true;
  openSettingsButton.focus();
}

openSettingsButton.addEventListener("click", showSettings);
closeSettingsButton.addEventListener("click", hideSettings);
settingsModal.addEventListener("click", (event) => {
  if (event.target === settingsModal) hideSettings();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !settingsModal.hidden) hideSettings();
});

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  document.documentElement.style.setProperty("--x-color", settings.colorX);
  document.documentElement.style.setProperty("--o-color", settings.colorO);
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem("xo-game-settings"));
    if (saved) {
      Object.assign(settings, saved);
      if (!settings.nameX) settings.nameX = "غزل";
      if (!settings.nameO) settings.nameO = "ريما";
      if (!["neon", "gradient", "royal"].includes(settings.theme)) settings.theme = "neon";
    }
  } catch {
    localStorage.removeItem("xo-game-settings");
  }
  document.querySelector(`input[name="theme"][value="${settings.theme}"]`).checked = true;
  document.getElementById("player-x-name").value = settings.nameX;
  document.getElementById("player-o-name").value = settings.nameO;
  document.getElementById("color-x").value = settings.colorX;
  document.getElementById("color-o").value = settings.colorO;
  document.getElementById("ai-x").checked = Boolean(settings.aiX);
  document.getElementById("ai-o").checked = Boolean(settings.aiO);
  applyTheme(settings.theme);
  const initialTurn = document.querySelector(".turn-mark");
  if (initialTurn) initialTurn.style.color = settings.colorX;
  renderNames();
}

document.getElementById("save-settings").addEventListener("click", () => {
  settings.theme = document.querySelector('input[name="theme"]:checked').value;
  settings.nameX = document.getElementById("player-x-name").value.trim();
  settings.nameO = document.getElementById("player-o-name").value.trim();
  if (!settings.nameX) settings.nameX = "غزل";
  if (!settings.nameO) settings.nameO = "ريما";
  settings.colorX = document.getElementById("color-x").value;
  settings.colorO = document.getElementById("color-o").value;
  settings.aiX = document.getElementById("ai-x").checked;
  settings.aiO = document.getElementById("ai-o").checked;
  localStorage.setItem("xo-game-settings", JSON.stringify(settings));
  applyTheme(settings.theme);
  renderNames();
  if (!gameOver) {
    renderTurnMessage();
  } else {
    const winner = checkWinner();
    if (winner) turnMessage.textContent = `فازت ${playerName(winner)}!`;
  }
  scheduleAiMove();
  hideSettings();
});

loadSettings();
renderScore();
scheduleAiMove();
