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
  nameX: "",
  nameO: "",
  colorX: "#00f3ff",
  colorO: "#ff007f"
};
let currentPlayer = "X";
let gameOver = false;

const winningCombinations = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

function playerName(mark) {
  const customName = mark === "X" ? settings.nameX : settings.nameO;
  return customName || (mark === "X" ? "Player One (X)" : "Player Two (O)");
}

function renderNames() {
  document.getElementById("score-x-name").textContent = playerName("X");
  document.getElementById("score-o-name").textContent = playerName("O");
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

function checkWinner() {
  for (const [a, b, c] of winningCombinations) {
    const mark = allCells[a].textContent;
    if (mark && mark === allCells[b].textContent && mark === allCells[c].textContent) return mark;
  }
  return null;
}

function finishRound(result) {
  gameOver = true;
  allCells.forEach((cell) => cell.classList.add("locked"));
  restartButton.hidden = false;
  if (result === "draw") {
    turnMessage.textContent = "It's a draw!";
  } else {
    winCount[result] += 1;
    renderScore();
    turnMessage.textContent = `${playerName(result)} wins!`;
  }
}

function restartGame() {
  currentPlayer = "X";
  gameOver = false;
  allCells.forEach((cell) => {
    cell.textContent = "";
    delete cell.dataset.mark;
    cell.classList.remove("locked");
  });
  turnMessage.innerHTML = `It's <span class="turn-mark">X</span>'s turn`;
  turnMessage.querySelector(".turn-mark").style.color = settings.colorX;
  restartButton.hidden = true;
}

allCells.forEach((cell) => {
  cell.addEventListener("click", () => {
    if (gameOver || cell.textContent) return;
    cell.textContent = currentPlayer;
    cell.dataset.mark = currentPlayer;

    const winner = checkWinner();
    if (winner) {
      finishRound(winner);
      return;
    }
    if (allCells.every((item) => item.textContent)) {
      finishRound("draw");
      return;
    }

    currentPlayer = currentPlayer === "X" ? "O" : "X";
    turnMessage.innerHTML = `It's <span class="turn-mark">${currentPlayer}</span>'s turn`;
    turnMessage.querySelector(".turn-mark").style.color = currentPlayer === "X" ? settings.colorX : settings.colorO;
  });
});

restartButton.addEventListener("click", restartGame);

function showSettings() {
  settingsModal.hidden = false;
  document.getElementById("player-x-name").focus();
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
    if (saved) Object.assign(settings, saved);
  } catch {
    localStorage.removeItem("xo-game-settings");
  }
  document.querySelector(`input[name="theme"][value="${settings.theme}"]`).checked = true;
  document.getElementById("player-x-name").value = settings.nameX;
  document.getElementById("player-o-name").value = settings.nameO;
  document.getElementById("color-x").value = settings.colorX;
  document.getElementById("color-o").value = settings.colorO;
  applyTheme(settings.theme);
  const initialTurn = document.querySelector(".turn-mark");
  if (initialTurn) initialTurn.style.color = settings.colorX;
  renderNames();
}

document.getElementById("save-settings").addEventListener("click", () => {
  settings.theme = document.querySelector('input[name="theme"]:checked').value;
  settings.nameX = document.getElementById("player-x-name").value.trim();
  settings.nameO = document.getElementById("player-o-name").value.trim();
  settings.colorX = document.getElementById("color-x").value;
  settings.colorO = document.getElementById("color-o").value;
  localStorage.setItem("xo-game-settings", JSON.stringify(settings));
  applyTheme(settings.theme);
  renderNames();
  if (!gameOver) {
    const marker = document.getElementById("turn");
    if (marker) marker.style.color = currentPlayer === "X" ? settings.colorX : settings.colorO;
    else {
      turnMessage.innerHTML = `It's <span class="turn-mark">${currentPlayer}</span>'s turn`;
      turnMessage.querySelector(".turn-mark").style.color = currentPlayer === "X" ? settings.colorX : settings.colorO;
    }
  }
  hideSettings();
});

loadSettings();
renderScore();
