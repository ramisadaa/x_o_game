const turnMarker = document.getElementById("turn");
const allCells = document.querySelectorAll(".cell");

let currentPlayer = "X";
let gameOver = false;

const winningCombinations = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

function checkWinner() {
  for (const combination of winningCombinations) {
    const [a, b, c] = combination;
    const firstCell = allCells[a].textContent;

    if (
      firstCell &&
      firstCell === allCells[b].textContent &&
      firstCell === allCells[c].textContent
    ) {
      return firstCell;
    }
  }

  return null;
}

allCells.forEach((cell) => {
  cell.addEventListener("click", () => {
    if (cell.textContent || gameOver) return;

    cell.textContent = currentPlayer;
    cell.dataset.mark = currentPlayer;

    const winner = checkWinner();

    if (winner) {
      turnMarker.textContent = `${winner} wins!`;
      gameOver = true;
      allCells.forEach((cell) => cell.classList.add("active"));
      return;
    }

    const isDraw = [...allCells].every((cell) => cell.textContent);

    if (isDraw) {
      turnMarker.textContent = "Draw!";
      gameOver = true;
      allCells.forEach((cell) => cell.classList.add("active"));
      return;
    }

    currentPlayer = currentPlayer === "X" ? "O" : "X";
    turnMarker.textContent = currentPlayer;
  });
});

