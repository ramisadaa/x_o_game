(() => {
  "use strict";

  const STORAGE_KEYS = {
    settings: "xo-game:v2:settings",
    stats: "xo-game:v2:stats"
  };
  const AI_DELAYS = [300, 650, 1100];
  const THEMES = ["neon", "gradient", "royal", "light", "contrast"];
  const WIN_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];
  const THEME_COLORS = {
    neon: { x: "#54f0de", o: "#ffad5f", cell: "#1b2a40" },
    gradient: { x: "#83e8ff", o: "#ff87c8", cell: "#47304e" },
    royal: { x: "#60a5fa", o: "#facc15", cell: "#26364d" },
    light: { x: "#075985", o: "#be123c", cell: "#ffffff" },
    contrast: { x: "#0057b8", o: "#b00020", cell: "#ffffff" }
  };
  const DEFAULT_SETTINGS = {
    theme: "neon",
    nameX: "غزل",
    nameO: "ريما",
    colorX: THEME_COLORS.neon.x,
    colorO: THEME_COLORS.neon.o,
    typeX: "human",
    typeO: "human",
    difficulty: "medium",
    starter: "alternate",
    aiDelay: 650
  };
  const DEFAULT_STATS = { records: Object.create(null), draws: 0, rounds: 0, lastWinner: null };

  const $ = (id) => document.getElementById(id);
  const ui = {
    body: document.body,
    dialog: $("settings-modal"),
    form: $("settings-form"),
    openSettings: $("open-settings"),
    cancelSettings: $("cancel-settings"),
    saveSettings: $("save-settings"),
    resetSettings: $("reset-settings"),
    resetColors: $("reset-colors"),
    formMessage: $("form-message"),
    board: $("game-board"),
    cells: [...document.querySelectorAll(".cell")],
    turnMessage: $("turn-message"),
    moveAnnouncer: $("move-announcer"),
    scoreXName: $("score-x-name"),
    scoreOName: $("score-o-name"),
    scoreX: $("score-x"),
    scoreO: $("score-o"),
    scoreDraws: $("score-draws"),
    roundCount: $("round-count"),
    newRound: $("new-round"),
    undo: $("undo-move"),
    hint: $("hint-move"),
    resetScore: $("reset-score"),
    storageNote: $("storage-note"),
    confirmDialog: $("confirm-reset"),
    confirmResetYes: $("confirm-reset-yes"),
    confirmResetNo: $("confirm-reset-no"),
    confirmRoundDialog: $("confirm-new-round"),
    confirmRoundYes: $("confirm-round-yes"),
    confirmRoundNo: $("confirm-round-no"),
    titleX: $("title-x"),
    titleO: $("title-o"),
    themeMeta: document.querySelector('meta[name="theme-color"]')
  };

  const state = {
    settings: { ...DEFAULT_SETTINGS },
    stats: { ...DEFAULT_STATS },
    board: Array(9).fill(""),
    history: [],
    current: "X",
    roundOver: false,
    winnerLine: [],
    lastWinner: null,
    roundIndex: 0,
    aiTimer: null,
    hintTimer: null,
    resetFocus: null
  };

  function safeRead(key) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function safeWrite(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function validColor(value) {
    return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
  }

  function cleanName(value, fallback) {
    if (typeof value !== "string") return fallback;
    const cleaned = Array.from(value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "").trim()).slice(0, 18).join("");
    return cleaned || fallback;
  }

  function normalizeSettings(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) return { ...DEFAULT_SETTINGS };
    const theme = THEMES.includes(input.theme) ? input.theme : DEFAULT_SETTINGS.theme;
    const themeColors = THEME_COLORS[theme];
    return {
      theme,
      nameX: cleanName(input.nameX, DEFAULT_SETTINGS.nameX),
      nameO: cleanName(input.nameO, DEFAULT_SETTINGS.nameO),
      colorX: validColor(input.colorX) ? input.colorX : themeColors.x,
      colorO: validColor(input.colorO) ? input.colorO : themeColors.o,
      typeX: input.typeX === "ai" ? "ai" : "human",
      typeO: input.typeO === "ai" ? "ai" : "human",
      difficulty: ["easy", "medium", "hard"].includes(input.difficulty) ? input.difficulty : "medium",
      starter: ["x", "o", "alternate", "random", "loser"].includes(input.starter) ? input.starter : "alternate",
      aiDelay: AI_DELAYS.includes(Number(input.aiDelay)) ? Number(input.aiDelay) : 650
    };
  }

  function safeCount(value) {
    return Number.isSafeInteger(value) && value >= 0 ? Math.min(value, 1_000_000_000) : 0;
  }

  function normalizeStats(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) return { ...DEFAULT_STATS };
    const records = Object.create(null);
    if (input.records && typeof input.records === "object" && !Array.isArray(input.records)) {
      for (const [name, wins] of Object.entries(input.records).slice(-100)) {
        const safeName = cleanName(name, "");
        if (safeName) records[playerRecordKey(safeName)] = safeCount(wins);
      }
    } else {
      if (input.winsX) records[playerRecordKey(state.settings.nameX)] = safeCount(input.winsX);
      if (input.winsO) records[playerRecordKey(state.settings.nameO)] = safeCount(input.winsO);
    }
    return {
      records,
      draws: safeCount(input.draws),
      rounds: safeCount(input.rounds),
      lastWinner: input.lastWinner === "X" || input.lastWinner === "O" ? input.lastWinner : null
    };
  }

  function persistSettings() {
    const success = safeWrite(STORAGE_KEYS.settings, state.settings);
    showStorageState(success);
    return success;
  }

  function persistStats() {
    const success = safeWrite(STORAGE_KEYS.stats, state.stats);
    showStorageState(success);
    return success;
  }

  function showStorageState(success) {
    ui.storageNote.textContent = success
      ? "الإعدادات والنتائج محفوظة على هذا الجهاز."
      : "تعذّر التخزين في هذا المتصفح؛ التغييرات تعمل لهذه الجلسة فقط.";
    ui.storageNote.dataset.persistence = success ? "saved" : "session";
  }

  function playerName(mark) {
    return mark === "X" ? state.settings.nameX : state.settings.nameO;
  }

  function playerRecordKey(name) {
    return name.normalize("NFKC").toLocaleLowerCase();
  }

  function isAI(mark) {
    return (mark === "X" ? state.settings.typeX : state.settings.typeO) === "ai";
  }

  function setTurnMessage(kind, extraText = "") {
    ui.turnMessage.dataset.kind = kind || "turn";
    ui.turnMessage.replaceChildren();

    if (kind === "win") {
      ui.turnMessage.textContent = `انتهت الجولة بفوز ${playerName(state.current)}!`;
      return;
    }
    if (kind === "draw") {
      ui.turnMessage.textContent = "انتهت الجولة بالتعادل.";
      return;
    }
    if (kind === "match") {
      ui.turnMessage.textContent = extraText;
      return;
    }

    const name = document.createElement("span");
    name.className = "turn-player";
    name.dataset.mark = state.current;
    name.textContent = `${playerName(state.current)} (${state.current})`;
    ui.turnMessage.append(name);
    if (isAI(state.current)) {
      const aiLabel = document.createElement("span");
      aiLabel.className = "turn-ai-tag";
      aiLabel.textContent = " — الذكاء الاصطناعي يفكر";
      ui.turnMessage.append(aiLabel);
    } else {
      ui.turnMessage.append(document.createTextNode(" — دورك"));
    }
  }

  function updateScoreboard() {
    ui.scoreXName.textContent = state.settings.nameX;
    ui.scoreOName.textContent = state.settings.nameO;
    ui.scoreX.textContent = String(state.stats.records[playerRecordKey(state.settings.nameX)] || 0);
    ui.scoreO.textContent = String(state.stats.records[playerRecordKey(state.settings.nameO)] || 0);
    ui.scoreDraws.textContent = String(state.stats.draws);
    ui.roundCount.textContent = `الجولات: ${state.stats.rounds}`;
  }

  function updateCellLabels() {
    ui.cells.forEach((cell, index) => {
      const row = Math.floor(index / 3) + 1;
      const column = (index % 3) + 1;
      const mark = state.board[index];
      const content = mark ? `عليها ${mark}، ${playerName(mark)}` : "فارغة";
      cell.setAttribute("aria-label", `الصف ${row}، العمود ${column}، ${content}`);
      cell.setAttribute("aria-selected", mark ? "true" : "false");
    });
  }

  function updateControls() {
    const aiTurn = !state.roundOver && isAI(state.current);
    ui.board.classList.toggle("ai-thinking", aiTurn);
    let focusIndex = ui.cells.indexOf(document.activeElement);
    if (focusIndex < 0) focusIndex = state.board.findIndex((mark) => !mark);
    if (focusIndex < 0) focusIndex = 0;
    ui.cells.forEach((cell, index) => {
      cell.disabled = false;
      cell.tabIndex = index === focusIndex ? 0 : -1;
      cell.setAttribute("aria-disabled", state.roundOver || Boolean(state.board[index]) || aiTurn ? "true" : "false");
      cell.classList.toggle("winning-cell", state.winnerLine.includes(index));
    });
    const hasHumanMove = state.history.some((move) => !isAI(move.mark));
    ui.undo.disabled = state.roundOver || !hasHumanMove || aiTurn;
    ui.hint.disabled = state.roundOver || aiTurn || !state.board.includes("");
    ui.newRound.disabled = false;
  }

  function renderBoard() {
    ui.cells.forEach((cell, index) => {
      const mark = state.board[index];
      cell.textContent = mark;
      cell.dataset.mark = mark || "";
      cell.classList.remove("hint-cell");
    });
    updateCellLabels();
    updateControls();
  }

  function applyTheme(theme, colors = null) {
    const normalizedTheme = THEMES.includes(theme) ? theme : DEFAULT_SETTINGS.theme;
    const palette = THEME_COLORS[normalizedTheme];
    ui.body.dataset.theme = normalizedTheme;
    ui.body.style.setProperty("--x-color", colors?.x || palette.x);
    ui.body.style.setProperty("--o-color", colors?.o || palette.o);
    ui.titleX.textContent = "X";
    ui.titleO.textContent = "O";
    ui.themeMeta?.setAttribute("content", normalizedTheme === "light" ? "#eaf0f7" : palette.cell === "#ffffff" ? "#000000" : palette.cell);
    updateThemeSelection(normalizedTheme);
  }

  function updateThemeSelection(theme) {
    document.querySelectorAll(".theme-option").forEach((label) => {
      const radio = label.querySelector('input[type="radio"]');
      label.classList.toggle("selected", Boolean(radio?.checked && radio.value === theme));
    });
  }

  function loadSettingsForm(settings = state.settings) {
    const radio = ui.form.querySelector(`input[name="theme"][value="${settings.theme}"]`);
    if (radio) radio.checked = true;
    $("player-x-name").value = settings.nameX;
    $("player-o-name").value = settings.nameO;
    $("color-x").value = settings.colorX;
    $("color-o").value = settings.colorO;
    $("player-x-type").value = settings.typeX;
    $("player-o-type").value = settings.typeO;
    $("ai-difficulty").value = settings.difficulty;
    $("starter").value = settings.starter;
    $("ai-speed").value = String(settings.aiDelay);
    ui.formMessage.textContent = "";
    updateThemeSelection(settings.theme);
  }

  function readFormSettings() {
    const selectedTheme = ui.form.querySelector('input[name="theme"]:checked');
    const input = {
      theme: selectedTheme?.value,
      nameX: cleanName($("player-x-name").value, ""),
      nameO: cleanName($("player-o-name").value, ""),
      colorX: $("color-x").value,
      colorO: $("color-o").value,
      typeX: $("player-x-type").value,
      typeO: $("player-o-type").value,
      difficulty: $("ai-difficulty").value,
      starter: $("starter").value,
      aiDelay: Number($("ai-speed").value)
    };
    return input;
  }

  function luminance(hex) {
    const channels = hex.slice(1).match(/.{2}/g).map((part) => parseInt(part, 16) / 255);
    const linear = channels.map((channel) => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
    return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
  }

  function contrastRatio(first, second) {
    const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
    return (values[0] + .05) / (values[1] + .05);
  }

  function colorsAreDistinct(first, second) {
    const a = first.slice(1).match(/.{2}/g).map((part) => parseInt(part, 16));
    const b = second.slice(1).match(/.{2}/g).map((part) => parseInt(part, 16));
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) >= 90;
  }

  function validateSettings(input) {
    if (!input.nameX || !input.nameO) return "اكتب اسمًا لكل لاعب.";
    if (input.nameX.normalize("NFKC").toLocaleLowerCase() === input.nameO.normalize("NFKC").toLocaleLowerCase()) return "اختر اسمين مختلفين للاعبين.";
    if (!THEMES.includes(input.theme)) return "اختر ثيمًا صحيحًا.";
    if (!validColor(input.colorX) || !validColor(input.colorO)) return "اختر ألوانًا صحيحة.";
    if (!colorsAreDistinct(input.colorX, input.colorO)) return "اختر لونين واضحين ومختلفين لـ X وO.";
    const cellColor = THEME_COLORS[input.theme].cell;
    if (contrastRatio(input.colorX, cellColor) < 4.5 || contrastRatio(input.colorO, cellColor) < 4.5) {
      return "لون أحد الرمزين قريب جدًا من لون الخانات. اختر لونًا أوضح.";
    }
    if (!["human", "ai"].includes(input.typeX) || !["human", "ai"].includes(input.typeO)) return "نوع لاعب غير صالح.";
    if (!["easy", "medium", "hard"].includes(input.difficulty)) return "اختر مستوى صعوبة صحيحًا.";
    if (!["x", "o", "alternate", "random", "loser"].includes(input.starter)) return "اختر طريقة بداية صحيحة.";
    if (!AI_DELAYS.includes(input.aiDelay)) return "اختر سرعة صحيحة للذكاء.";
    return "";
  }

  function findWinningLine(board) {
    for (const line of WIN_LINES) {
      const [a, b, c] = line;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) return { mark: board[a], line };
    }
    return null;
  }

  function chooseStarter() {
    const mode = state.settings.starter;
    if (mode === "x") return "X";
    if (mode === "o") return "O";
    if (mode === "random") return Math.random() < .5 ? "X" : "O";
    if (mode === "loser" && state.lastWinner) return state.lastWinner === "X" ? "O" : "X";
    return state.roundIndex % 2 === 0 ? "X" : "O";
  }

  function completeRound(result, line = []) {
    clearTimeout(state.aiTimer);
    clearTimeout(state.hintTimer);
    state.roundOver = true;
    state.winnerLine = line;
    state.stats.rounds += 1;
    state.lastWinner = result === "draw" ? null : result;
    state.stats.lastWinner = state.lastWinner;
    if (result === "draw") {
      state.stats.draws += 1;
      setTurnMessage("draw");
    } else {
      const recordKey = playerRecordKey(playerName(result));
      state.stats.records[recordKey] = safeCount(state.stats.records[recordKey]) + 1;
      state.current = result;
      setTurnMessage("win");
    }
    updateScoreboard();
    persistStats();
    renderBoard();
  }

  function makeMove(index, source = "human") {
    if (!Number.isInteger(index) || index < 0 || index > 8 || state.roundOver || state.board[index]) return false;
    if (source === "human" && isAI(state.current)) return false;
    const mark = state.current;
    state.board[index] = mark;
    state.history.push({ index, mark });
    if (source === "ai") {
      const row = Math.floor(index / 3) + 1;
      const column = (index % 3) + 1;
      ui.moveAnnouncer.textContent = `${playerName(mark)} لعب في الصف ${row}، العمود ${column}.`;
    }
    const result = findWinningLine(state.board);
    if (result) {
      completeRound(result.mark, result.line);
      return true;
    }
    if (state.board.every(Boolean)) {
      completeRound("draw");
      return true;
    }
    state.current = mark === "X" ? "O" : "X";
    renderBoard();
    setTurnMessage("turn");
    scheduleAiMove();
    return true;
  }

  function getRandomMove(board) {
    const open = board.map((value, index) => value ? -1 : index).filter((index) => index >= 0);
    return open.length ? open[Math.floor(Math.random() * open.length)] : undefined;
  }

  function findImmediateMove(board, mark) {
    for (let index = 0; index < 9; index += 1) {
      if (board[index]) continue;
      board[index] = mark;
      const won = Boolean(findWinningLine(board));
      board[index] = "";
      if (won) return index;
    }
    return undefined;
  }

  function minimaxChoice(mark) {
    const board = [...state.board];
    const opponent = mark === "X" ? "O" : "X";

    function scoreBoard(maximizing, depth, alpha, beta) {
      const win = findWinningLine(board);
      if (win?.mark === mark) return 10 - depth;
      if (win?.mark === opponent) return depth - 10;
      if (board.every(Boolean)) return 0;
      let best = maximizing ? -Infinity : Infinity;
      const movingMark = maximizing ? mark : opponent;
      for (let index = 0; index < 9; index += 1) {
        if (board[index]) continue;
        board[index] = movingMark;
        const score = scoreBoard(!maximizing, depth + 1, alpha, beta);
        board[index] = "";
        if (maximizing) {
          best = Math.max(best, score);
          alpha = Math.max(alpha, best);
        } else {
          best = Math.min(best, score);
          beta = Math.min(beta, best);
        }
        if (beta <= alpha) break;
      }
      return best;
    }

    const choices = [];
    let bestScore = -Infinity;
    for (let index = 0; index < 9; index += 1) {
      if (board[index]) continue;
      board[index] = mark;
      const score = scoreBoard(false, 0, -Infinity, Infinity);
      board[index] = "";
      if (score > bestScore) {
        bestScore = score;
        choices.length = 0;
        choices.push(index);
      } else if (score === bestScore) choices.push(index);
    }
    return choices.length ? choices[Math.floor(Math.random() * choices.length)] : undefined;
  }

  function chooseAiMove(mark) {
    const board = [...state.board];
    if (state.settings.difficulty === "easy") return getRandomMove(board);
    const winNow = findImmediateMove(board, mark);
    if (winNow !== undefined) return winNow;
    const opponent = mark === "X" ? "O" : "X";
    const blockNow = findImmediateMove(board, opponent);
    if (blockNow !== undefined) {
      if (state.settings.difficulty === "medium" && Math.random() < .2) return getRandomMove(board);
      return blockNow;
    }
    if (state.settings.difficulty === "medium" && Math.random() < .38) return getRandomMove(board);
    return minimaxChoice(mark);
  }

  function scheduleAiMove(delay = state.settings.aiDelay) {
    clearTimeout(state.aiTimer);
    if (state.roundOver || !isAI(state.current) || ui.dialog.open || ui.confirmDialog.open) {
      updateControls();
      return;
    }
    updateControls();
    setTurnMessage("turn");
    state.aiTimer = window.setTimeout(() => {
      if (state.roundOver || !isAI(state.current) || ui.dialog.open || ui.confirmDialog.open) return;
      const move = chooseAiMove(state.current);
      if (move !== undefined) makeMove(move, "ai");
    }, delay);
  }

  function newRound() {
    clearTimeout(state.aiTimer);
    clearTimeout(state.hintTimer);
    if (state.history.length || state.roundOver) state.roundIndex += 1;
    state.board = Array(9).fill("");
    state.history = [];
    state.roundOver = false;
    state.winnerLine = [];
    state.current = chooseStarter();
    renderBoard();
    setTurnMessage("turn");
    scheduleAiMove(state.settings.typeX === "ai" && state.settings.typeO === "ai" ? 3000 : state.settings.aiDelay);
  }

  function undoMove() {
    if (state.roundOver || !state.history.length || isAI(state.current)) return;
    clearTimeout(state.aiTimer);
    let removeCount = 1;
    const lastMove = state.history.at(-1);
    if (lastMove && isAI(lastMove.mark) && state.history.length > 1) removeCount = 2;
    let firstUndone = null;
    for (let count = 0; count < removeCount; count += 1) {
      const move = state.history.pop();
      if (!move) break;
      state.board[move.index] = "";
      firstUndone = move;
    }
    if (firstUndone) state.current = firstUndone.mark;
    renderBoard();
    setTurnMessage("turn");
    scheduleAiMove();
  }

  function showHint() {
    if (state.roundOver || isAI(state.current)) return;
    clearTimeout(state.hintTimer);
    const move = chooseAiMove(state.current);
    if (move === undefined) return;
    ui.cells[move].classList.add("hint-cell");
    ui.turnMessage.dataset.kind = "turn";
    ui.turnMessage.textContent = `تلميح: جرّب الخانة في الصف ${Math.floor(move / 3) + 1} والعمود ${(move % 3) + 1}.`;
    state.hintTimer = window.setTimeout(() => {
      ui.cells[move].classList.remove("hint-cell");
      setTurnMessage("turn");
    }, 1800);
  }

  function openSettings() {
    clearTimeout(state.aiTimer);
    state.resetFocus = document.activeElement;
    loadSettingsForm();
    ui.body.classList.add("modal-open");
    ui.openSettings.setAttribute("aria-expanded", "true");
    if (!ui.dialog.open) ui.dialog.showModal();
    $("settings-title").focus();
  }

  function closeSettings() {
    if (ui.dialog.open) ui.dialog.close();
    ui.openSettings.setAttribute("aria-expanded", "false");
    if (state.resetFocus?.isConnected) state.resetFocus.focus();
    else ui.openSettings.focus();
  }

  function cancelSettings() {
    loadSettingsForm();
    closeSettings();
    scheduleAiMove();
  }

  function saveSettings(event) {
    event.preventDefault();
    const next = readFormSettings();
    const error = validateSettings(next);
    if (error) {
      ui.formMessage.textContent = error;
      return;
    }
    state.settings = next;
    applyTheme(next.theme, { x: next.colorX, o: next.colorO });
    updateScoreboard();
    if (!state.roundOver) setTurnMessage("turn");
    else {
      const result = findWinningLine(state.board);
      if (result) {
        state.current = result.mark;
        setTurnMessage("win");
      } else setTurnMessage("draw");
    }
    const stored = persistSettings();
    closeSettings();
    scheduleAiMove(state.settings.typeX === "ai" && state.settings.typeO === "ai" && state.history.length === 0 ? 3000 : state.settings.aiDelay);
    if (!stored) showStorageState(false);
  }

  function setDraftTheme(theme) {
    if (!THEMES.includes(theme)) return;
    const colors = THEME_COLORS[theme];
    $("color-x").value = colors.x;
    $("color-o").value = colors.o;
    updateThemeSelection(theme);
    ui.body.dataset.draftTheme = theme;
    ui.body.style.setProperty("--x-color", colors.x);
    ui.body.style.setProperty("--o-color", colors.o);
    ui.body.dataset.theme = theme;
  }

  function restoreAppliedTheme() {
    delete ui.body.dataset.draftTheme;
    applyTheme(state.settings.theme, { x: state.settings.colorX, o: state.settings.colorO });
  }

  function showConfirmReset() {
    state.resetFocus = document.activeElement;
    clearTimeout(state.aiTimer);
    ui.body.classList.add("modal-open");
    ui.confirmDialog.showModal();
    $("confirm-title").focus();
  }

  function closeConfirmReset() {
    if (ui.confirmDialog.open) ui.confirmDialog.close();
    if (state.resetFocus?.isConnected) state.resetFocus.focus();
    scheduleAiMove();
  }

  function resetScores() {
    state.stats = { ...DEFAULT_STATS, records: Object.create(null) };
    state.lastWinner = null;
    state.stats.lastWinner = null;
    updateScoreboard();
    persistStats();
    if (ui.confirmDialog.open) ui.confirmDialog.close();
    ui.resetScore.focus();
    scheduleAiMove();
  }

  function requestNewRound() {
    if (!state.board.some(Boolean) && !state.roundOver) {
      newRound();
      return;
    }
    state.resetFocus = document.activeElement;
    clearTimeout(state.aiTimer);
    ui.body.classList.add("modal-open");
    ui.confirmRoundDialog.showModal();
    $("confirm-round-title").focus();
  }

  function closeNewRoundConfirmation(start = false) {
    if (ui.confirmRoundDialog.open) ui.confirmRoundDialog.close();
    if (start) {
      ui.newRound.focus();
      newRound();
    }
    else {
      if (state.resetFocus?.isConnected) state.resetFocus.focus();
      scheduleAiMove();
    }
  }

  function onBoardKeydown(event) {
    const index = Number(event.target.dataset.index);
    if (!Number.isInteger(index)) return;
    const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 };
    const offset = offsets[event.key];
    if (offset === undefined) return;
    const next = index + offset;
    if (next < 0 || next > 8) return;
    if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && Math.floor(next / 3) !== Math.floor(index / 3)) return;
    event.preventDefault();
    ui.cells[next].focus();
  }

  function trapDialogTab(event, dialog) {
    if (event.key !== "Tab") return;
    const focusable = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      .filter((element) => element.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  }

  function init() {
    state.settings = normalizeSettings(safeRead(STORAGE_KEYS.settings));
    state.stats = normalizeStats(safeRead(STORAGE_KEYS.stats));
    persistSettings();
    state.lastWinner = state.stats.lastWinner;
    state.roundIndex = state.stats.rounds;
    state.current = chooseStarter();
    applyTheme(state.settings.theme, { x: state.settings.colorX, o: state.settings.colorO });
    loadSettingsForm();
    updateScoreboard();
    renderBoard();
    setTurnMessage("turn");

    ui.cells.forEach((cell) => cell.addEventListener("click", () => makeMove(Number(cell.dataset.index))));
    ui.board.addEventListener("keydown", onBoardKeydown);
    ui.openSettings.addEventListener("click", openSettings);
    ui.cancelSettings.addEventListener("click", cancelSettings);
    ui.form.addEventListener("submit", saveSettings);
    ui.dialog.addEventListener("cancel", (event) => { event.preventDefault(); cancelSettings(); });
    ui.dialog.addEventListener("click", (event) => { if (event.target === ui.dialog) cancelSettings(); });
    ui.dialog.addEventListener("keydown", (event) => trapDialogTab(event, ui.dialog));
    ui.confirmDialog.addEventListener("cancel", (event) => { event.preventDefault(); closeConfirmReset(); });
    ui.confirmDialog.addEventListener("keydown", (event) => trapDialogTab(event, ui.confirmDialog));
    ui.newRound.addEventListener("click", requestNewRound);
    ui.undo.addEventListener("click", undoMove);
    ui.hint.addEventListener("click", showHint);
    ui.resetScore.addEventListener("click", showConfirmReset);
    ui.confirmResetYes.addEventListener("click", resetScores);
    ui.confirmResetNo.addEventListener("click", closeConfirmReset);
    ui.confirmRoundYes.addEventListener("click", () => closeNewRoundConfirmation(true));
    ui.confirmRoundNo.addEventListener("click", () => closeNewRoundConfirmation(false));
    ui.confirmRoundDialog.addEventListener("cancel", (event) => { event.preventDefault(); closeNewRoundConfirmation(false); });
    ui.confirmRoundDialog.addEventListener("keydown", (event) => trapDialogTab(event, ui.confirmRoundDialog));
    ui.resetColors.addEventListener("click", () => {
      const selected = ui.form.querySelector('input[name="theme"]:checked')?.value || state.settings.theme;
      const colors = THEME_COLORS[selected];
      $("color-x").value = colors.x;
      $("color-o").value = colors.o;
      ui.formMessage.textContent = "تمت استعادة ألوان الثيم؛ اضغط حفظ وإغلاق لتطبيقها.";
    });
    ui.resetSettings.addEventListener("click", () => {
      loadSettingsForm(DEFAULT_SETTINGS);
      const defaultThemeRadio = ui.form.querySelector(`input[name="theme"][value="${DEFAULT_SETTINGS.theme}"]`);
      if (defaultThemeRadio) defaultThemeRadio.checked = true;
      setDraftTheme(DEFAULT_SETTINGS.theme);
      ui.formMessage.textContent = "عادت القيم الافتراضية في النموذج. اضغط حفظ وإغلاق لتطبيقها.";
    });
    ui.form.querySelectorAll('input[name="theme"]').forEach((radio) => radio.addEventListener("change", () => setDraftTheme(radio.value)));
    ui.dialog.addEventListener("close", restoreAppliedTheme);
    [ui.dialog, ui.confirmDialog, ui.confirmRoundDialog].forEach((dialog) => dialog.addEventListener("close", () => {
      if (![ui.dialog, ui.confirmDialog, ui.confirmRoundDialog].some((item) => item.open)) ui.body.classList.remove("modal-open");
    }));
    scheduleAiMove(state.settings.typeX === "ai" && state.settings.typeO === "ai" ? 3000 : state.settings.aiDelay);
  }

  init();
})();
