// Rectangle / AABB Ratio Trainer
// Static frontend version converted from the original Tkinter/PIL program.

const CONFIG = {
  CANVAS_W: 760,
  CANVAS_H: 460,

  RECT_LONG_SIDE: 220,
  RECT_LONG_SIDE_AREA_SCALE_MODE: 160,

  LINE_WIDTH: 1,

  AREA_SCALE_MIN: 0.3,
  AREA_SCALE_MAX: 4.0,

  POLYGON_MIN_SIDES: 3,
  POLYGON_MAX_SIDES: 10,

  MIN_VISIBLE_LINE_LENGTH: 42,
  MAX_VISIBLE_LINE_LENGTH: 360,

  DRAW_TOLERANCE: 0.10,

  BG_CANVAS: "#ffffff",
  RECT_COLOR: "#111111",
  POLYGON_FILL: "#f9fafb",
  BBOX_COLOR: "#94a3b8",
  RESTRICT_BOX_COLOR: "#94a3b8",
  USER_BOX_COLOR: "#111111",
  ANSWER_BOX_COLOR: "#2563eb",
  LIGHT_ANSWER_GUIDE_COLOR: "#93c5fd",
  LINE_GUIDE_COLOR: "#2563eb",
  LINE_SHORT_COLOR: "#ef4444",
  LINE_LONG_COLOR: "#2563eb",
  CENTER_MARK: "#9aa3b2",

  BTN_CORRECT_CLASS: "correct",
  BTN_WRONG_CLASS: "wrong",
};

CONFIG.DRAW_LOG_TOLERANCE = Math.log(1.0 + CONFIG.DRAW_TOLERANCE);

const FIXED_RATIOS = [
  [1, 1],
  [4, 5],
  [3, 4],
  [2, 3],
  [1, 2],
  [3, 5],
  [2, 5],
  [1, 3],
  [1, 4],
  [1, 5],
];

const OPTION_LABELS = ["A", "B", "C", "D"];

const DIFFICULTY_MAX_DEN = {
  easy: 4,
  medium: 6,
  hard: 8,
};

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
}

function reduceRatio(a, b) {
  const g = gcd(a, b);
  return [Math.floor(a / g), Math.floor(b / g)];
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function randint(minInclusive, maxInclusive) {
  return Math.floor(rand(minInclusive, maxInclusive + 1));
}

function choice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function samePair(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}

function shuffle(arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; --i) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function sample(arr, n) {
  return shuffle(arr).slice(0, n);
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

class RatioQuizApp {
  constructor() {
    this.canvas = document.getElementById("shapeCanvas");
    this.ctx = this.canvas.getContext("2d");

    this.timeMode = document.getElementById("timeMode");
    this.randomMode = document.getElementById("randomMode");
    this.areaScaleMode = document.getElementById("areaScaleMode");
    this.polygonMode = document.getElementById("polygonMode");
    this.lineMode = document.getElementById("lineMode");
    this.drawMode = document.getElementById("drawMode");
    this.difficultySelect = document.getElementById("difficultySelect");

    this.settingsPanel = document.getElementById("settingsPanel");
    this.settingsSummary = document.getElementById("settingsSummary");

    this.modeLabel = document.getElementById("modeLabel");
    this.timerLabel = document.getElementById("timerLabel");
    this.scoreLabel = document.getElementById("scoreLabel");
    this.questionLabel = document.getElementById("questionLabel");
    this.feedbackLabel = document.getElementById("feedbackLabel");

    this.optionButtons = Array.from(document.querySelectorAll(".option"));
    this.prevBtn = document.getElementById("prevBtn");
    this.nextBtn = document.getElementById("nextBtn");

    this.questionActive = false;
    this.locked = false;

    this.timerId = null;
    this.autoNextId = null;
    this.timeLeft = 10;

    this.currentRatio = 1.0;
    this.currentOptions = [];
    this.correctIndex = 0;
    this.selectedIndex = null;
    this.currentOptionCount = 3;
    this.currentDrawParams = null;
    this.currentQuestionText = "";

    this.scoreTotal = 0;
    this.scoreCorrect = 0;

    this.dragStart = null;
    this.dragCurrent = null;
    this.userDrawBox = null;
    this.answerDrawBox = null;
    this.userDrawLine = null;
    this.answerDrawLine = null;
    this.userDrawLine = null;
    this.answerDrawLine = null;

    this.history = [];
    this.historyIndex = -1;

    this.setupHiDPICanvas();
    this.bindEvents();
    this.applyModeConstraints();
    this.nextQuestion();

    // Refit once after layout is painted. This is important when CSS changes
    // the canvas width after the initial script run.
    requestAnimationFrame(() => {
      this.setupHiDPICanvas();
      this.renderCurrentQuestionCanvas(this.locked);
    });
  }

  setupHiDPICanvas() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    this.dpr = dpr;

    // The app uses a logical coordinate system of 760 x 460.
    // CSS may display the canvas at a different size, especially on desktop
    // after making it align with the full-width option buttons.
    //
    // To avoid blurry strokes, the backing bitmap must match the *displayed*
    // CSS size, not just the logical size.
    const rect = this.canvas.getBoundingClientRect();
    const cssW = Math.max(1, rect.width || CONFIG.CANVAS_W);
    const cssH = Math.max(1, rect.height || cssW * CONFIG.CANVAS_H / CONFIG.CANVAS_W);

    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);

    const sx = cssW / CONFIG.CANVAS_W;
    const sy = cssH / CONFIG.CANVAS_H;

    // Draw all shapes in logical coordinates. The transform maps them to the
    // actual displayed size and device-pixel ratio.
    this.ctx.setTransform(dpr * sx, 0, 0, dpr * sy, 0, 0);
  }

  bindEvents() {
    [this.timeMode, this.randomMode, this.areaScaleMode, this.polygonMode, this.lineMode, this.drawMode]
      .filter(Boolean)
      .forEach(input => input.addEventListener("change", () => this.onModeChange()));

    this.difficultySelect.addEventListener("change", () => this.onModeChange());

    this.optionButtons.forEach((btn, idx) => {
      btn.addEventListener("click", () => this.onAnswer(idx));
    });

    this.prevBtn.addEventListener("click", () => this.previousQuestion());
    this.nextBtn.addEventListener("click", () => this.nextQuestion());

    this.canvas.addEventListener("pointerdown", event => this.onCanvasPointerDown(event));
    this.canvas.addEventListener("pointermove", event => this.onCanvasPointerMove(event));
    this.canvas.addEventListener("pointerup", event => this.onCanvasPointerUp(event));
    this.canvas.addEventListener("pointercancel", event => this.onCanvasPointerUp(event));

    this.resizeTimer = null;
    window.addEventListener("resize", () => {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => {
        this.setupHiDPICanvas();
        this.redrawCurrent();
      }, 80);
    });
  }

  canvasPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * CONFIG.CANVAS_W / rect.width;
    const y = (event.clientY - rect.top) * CONFIG.CANVAS_H / rect.height;
    return [
      Math.max(0, Math.min(CONFIG.CANVAS_W, x)),
      Math.max(0, Math.min(CONFIG.CANVAS_H, y)),
    ];
  }

  onModeChange() {
    this.applyModeConstraints();
    this.cancelTimer();
    this.cancelAutoNext();

    this.history = [];
    this.historyIndex = -1;

    this.questionActive = false;
    this.locked = false;

    this.nextQuestion();
  }

  applyModeConstraints() {
    const drawEnabled = !!this.drawMode?.checked;

    // Draw mode is compatible with Line mode and Impossible mode.
    // Only random scaling is disabled because draw-mode sizes are user-generated.
    const exclusiveInputs = [this.areaScaleMode].filter(Boolean);

    for (const input of exclusiveInputs) {
      if (drawEnabled) input.checked = false;
      input.disabled = drawEnabled;
      input.closest("label")?.classList.toggle("disabled", drawEnabled);
    }

    for (const input of [this.polygonMode, this.lineMode].filter(Boolean)) {
      input.disabled = false;
      input.closest("label")?.classList.remove("disabled");
    }

    this.updateSettingsSummary();
  }


  updateSettingsSummary() {
    if (!this.settingsSummary) return;

    const parts = [];
    parts.push(this.getDifficultyName());

    if (this.drawMode.checked) {
      parts.push(this.lineMode?.checked ? "Draw line" : "Draw");
      if (this.polygonMode.checked) parts.push("Impossible");
    } else {
      parts.push(this.randomMode.checked ? "Random ratio" : "Fixed ratios");
      if (this.areaScaleMode.checked) parts.push("Scale");
      if (this.polygonMode.checked) parts.push("Impossible");
      if (this.lineMode.checked) parts.push("Line");
    }

    if (this.timeMode.checked) parts.push("Timed");

    this.settingsSummary.textContent = parts.join(" · ");
  }

  getDifficultyName() {
    return this.difficultySelect?.value || "medium";
  }

  getDifficultyMaxDen() {
    const name = this.getDifficultyName();
    return DIFFICULTY_MAX_DEN[name] || DIFFICULTY_MAX_DEN.medium;
  }

  getDifficultyRatioCandidates() {
    return this.buildIntegerRatioCandidates(null, this.getDifficultyMaxDen());
  }

  sampleRawRatioForDifficulty() {
    const maxDen = this.getDifficultyMaxDen();

    for (let i = 0; i < 32; ++i) {
      const w = Math.random() * maxDen;
      const v = Math.random() * maxDen;
      const longSide = Math.max(w, v);
      const shortSide = Math.min(w, v);

      if (longSide > 1e-6 && shortSide > 1e-6) {
        return shortSide / longSide;
      }
    }

    return 1.0;
  }

  updateScoreLabel() {
    const accuracy = this.scoreTotal === 0 ? 0 : 100 * this.scoreCorrect / this.scoreTotal;
    this.scoreLabel.textContent = `Score: ${this.scoreCorrect}/${this.scoreTotal}   Accuracy: ${accuracy.toFixed(1)}%`;
  }

  updateNavButtons() {
    this.prevBtn.disabled = this.historyIndex <= 0;
  }

  cancelTimer() {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  cancelAutoNext() {
    if (this.autoNextId !== null) {
      clearTimeout(this.autoNextId);
      this.autoNextId = null;
    }
  }

  startTimer() {
    this.cancelTimer();

    if (this.timeMode.checked && this.questionActive && !this.locked) {
      this.timeLeft = 10;
      this.tick();
    } else {
      this.timerLabel.textContent = "";
    }
  }

  tick() {
    if (!this.questionActive || this.locked) {
      this.timerId = null;
      return;
    }

    this.timerLabel.textContent = `${this.timeLeft}s`;

    if (this.timeLeft <= 0) {
      this.timeoutAnswer();
      this.timerId = null;
      return;
    }

    this.timeLeft -= 1;
    this.timerId = setTimeout(() => this.tick(), 1000);
  }

  makeSnapshot() {
    return {
      currentRatio: this.currentRatio,
      currentOptions: deepClone(this.currentOptions),
      correctIndex: this.correctIndex,
      selectedIndex: this.selectedIndex,
      currentOptionCount: this.currentOptionCount,
      currentDrawParams: deepClone(this.currentDrawParams),
      currentQuestionText: this.currentQuestionText,
      locked: this.locked,
      questionActive: this.questionActive,
      feedback: this.feedbackLabel.textContent,
      modeText: this.modeLabel.textContent,
      userDrawBox: this.userDrawBox ? this.userDrawBox.slice() : null,
      answerDrawBox: this.answerDrawBox ? this.answerDrawBox.slice() : null,
      userDrawLine: this.userDrawLine ? { ...this.userDrawLine } : null,
      answerDrawLine: this.answerDrawLine ? { ...this.answerDrawLine } : null,
    };
  }

  saveCurrentSnapshot() {
    if (this.historyIndex >= 0 && this.historyIndex < this.history.length) {
      this.history[this.historyIndex] = this.makeSnapshot();
    }
  }

  loadSnapshot(snapshot, restartTimer) {
    this.cancelTimer();
    this.cancelAutoNext();

    this.currentRatio = snapshot.currentRatio;
    this.currentOptions = deepClone(snapshot.currentOptions);
    this.correctIndex = snapshot.correctIndex;
    this.selectedIndex = snapshot.selectedIndex;
    this.currentOptionCount = snapshot.currentOptionCount;
    this.currentDrawParams = deepClone(snapshot.currentDrawParams);
    this.currentQuestionText = snapshot.currentQuestionText;

    this.locked = snapshot.locked;
    this.questionActive = snapshot.questionActive && !this.locked;

    this.userDrawBox = snapshot.userDrawBox ? snapshot.userDrawBox.slice() : null;
    this.answerDrawBox = snapshot.answerDrawBox ? snapshot.answerDrawBox.slice() : null;
    this.userDrawLine = snapshot.userDrawLine ? { ...snapshot.userDrawLine } : null;
    this.answerDrawLine = snapshot.answerDrawLine ? { ...snapshot.answerDrawLine } : null;

    if (this.currentDrawParams?.shape === "drawline") {
      this.currentDrawParams.userLine = this.userDrawLine;
      this.currentDrawParams.answerLine = this.answerDrawLine;
    }

    this.dragStart = null;
    this.dragCurrent = null;

    this.questionLabel.textContent = this.currentQuestionText;
    this.modeLabel.textContent = snapshot.modeText;
    this.feedbackLabel.textContent = snapshot.feedback;

    this.resetOptionButtons();
    this.renderCurrentQuestionCanvas(this.locked);

    if (this.locked) {
      this.showResult(this.selectedIndex, this.selectedIndex === null, false);
      this.timerLabel.textContent = "";
    } else if (restartTimer) {
      this.startTimer();
    } else {
      this.timerLabel.textContent = "";
    }

    this.updateScoreLabel();
    this.updateNavButtons();
  }


  nextQuestion() {
    this.cancelTimer();
    this.cancelAutoNext();

    if (this.historyIndex >= 0 && this.historyIndex < this.history.length) {
      this.saveCurrentSnapshot();
    }

    if (this.historyIndex + 1 < this.history.length) {
      this.historyIndex += 1;
      this.loadSnapshot(this.history[this.historyIndex], true);
      requestAnimationFrame(() => this.renderCurrentQuestionCanvas(this.locked));
      return;
    }

    this.locked = false;
    this.questionActive = true;
    this.selectedIndex = null;
    this.feedbackLabel.textContent = "";

    this.dragStart = null;
    this.dragCurrent = null;
    this.userDrawBox = null;
    this.answerDrawBox = null;
    this.userDrawLine = null;
    this.answerDrawLine = null;

    let ratioModeText;
    let shapeText;
    let scaleText;

    if (this.drawMode.checked) {
      this.currentOptionCount = 1;
      ratioModeText = this.lineMode?.checked ? "draw target line ratio" : "draw target ratio";
      this.generateDrawModeQuestion();
      shapeText = this.lineMode?.checked
        ? (this.polygonMode.checked ? "restricted line draw" : "line draw")
        : "blank drawing canvas";
      scaleText = "manual draw";
    } else {
      if (this.randomMode.checked) {
        this.currentOptionCount = 4;
        ratioModeText = "random float ratio • 4 choices";
        this.generateRandomQuestion();
      } else {
        this.currentOptionCount = 3;
        ratioModeText = "fixed ratio set • 3 choices";
        this.generateFixedQuestion();
      }

      scaleText = this.areaScaleMode.checked ? "scale on" : "scale off";

      if (this.lineMode.checked && this.polygonMode.checked) {
        shapeText = "random line-pair";
      } else if (this.lineMode.checked) {
        shapeText = "parallel line-pair";
      } else {
        shapeText = this.polygonMode.checked ? "impossible polygon AABB" : "rectangle";
      }
    }

    this.modeLabel.textContent = `Mode: ${ratioModeText} • ${scaleText} • ${shapeText}`;
    this.updateSettingsSummary();
    this.currentDrawParams = this.generateDrawParams();

    this.resetOptionButtons();
    this.renderCurrentQuestionCanvas(false);

    this.startTimer();
    this.updateScoreLabel();

    this.history.push(this.makeSnapshot());
    this.historyIndex = this.history.length - 1;
    this.updateNavButtons();
  }


  previousQuestion() {
    if (this.historyIndex <= 0) return;

    this.saveCurrentSnapshot();
    this.historyIndex -= 1;
    this.loadSnapshot(this.history[this.historyIndex], false);

    // Some mobile/desktop browsers repaint the resized canvas one frame later.
    // Force a second shape-based redraw so drawline history always shows the
    // given red/blue reference line even before the user interacts.
    requestAnimationFrame(() => this.renderCurrentQuestionCanvas(this.locked));
  }

  generateFixedQuestion() {
    const candidates = this.getDifficultyRatioCandidates();
    const correctPair = choice(candidates);
    this.currentRatio = correctPair[0] / correctPair[1];

    const wrongPool = candidates
      .filter(p => !samePair(p, correctPair))
      .sort((p, q) => Math.abs(p[0] / p[1] - this.currentRatio) -
                      Math.abs(q[0] / q[1] - this.currentRatio));

    const wrongCount = Math.min(2, wrongPool.length);
    const wrongs = sample(wrongPool.slice(0, Math.min(8, wrongPool.length)), wrongCount);

    this.currentOptions = shuffle([...wrongs, correctPair]);
    this.correctIndex = this.currentOptions.findIndex(p => samePair(p, correctPair));

    if (this.lineMode.checked) {
      this.currentQuestionText = "Choose the closest ratio of the two line lengths.";
    } else {
      this.currentQuestionText = this.polygonMode.checked
        ? "Choose the closest ratio of the polygon's axis-aligned bounding box."
        : "Choose the closest ratio of the rectangle.";
    }

    this.questionLabel.textContent = this.currentQuestionText;
  }

  generateRandomQuestion() {
    this.currentRatio = this.sampleRawRatioForDifficulty();

    const candidates = this.buildIntegerRatioCandidates(this.currentRatio, this.getDifficultyMaxDen());
    const correctPair = candidates[0];
    const wrongPool = candidates.slice(1);

    const wrongs = sample(wrongPool.slice(0, Math.min(10, wrongPool.length)), 3);

    this.currentOptions = shuffle([...wrongs, correctPair]);
    this.correctIndex = this.currentOptions.findIndex(p => samePair(p, correctPair));

    if (this.lineMode.checked) {
      this.currentQuestionText = "Choose the closest integer ratio of the two line lengths.";
    } else {
      this.currentQuestionText = this.polygonMode.checked
        ? "Choose the closest integer ratio of the polygon's axis-aligned bounding box."
        : "Choose the closest integer ratio to the shown rectangle.";
    }

    this.questionLabel.textContent = this.currentQuestionText;
  }

  generateDrawModeQuestion() {
    let correctPair;

    if (this.randomMode.checked) {
      const rawRatio = this.sampleRawRatioForDifficulty();
      const candidates = this.buildIntegerRatioCandidates(rawRatio, this.getDifficultyMaxDen());
      correctPair = candidates[0];
    } else {
      correctPair = choice(this.getDifficultyRatioCandidates());
    }

    this.currentOptions = [correctPair];
    this.correctIndex = 0;
    this.currentRatio = correctPair[0] / correctPair[1];

    const [a, b] = correctPair;

    if (this.lineMode?.checked) {
      const startHint = this.polygonMode?.checked
        ? " Start inside the gray dashed region; the endpoint may go outside."
        : "";

      this.currentQuestionText =
        `Given one colored line, draw the other line so that short:long is close to ${a}:${b}. ` +
        `Red means short, blue means long.${startHint} Tolerance: ±${(CONFIG.DRAW_TOLERANCE * 100).toFixed(0)}%.`;
    } else {
      this.currentQuestionText =
        `Draw a rectangle whose short side:long side is close to ${a}:${b}. ` +
        `Tolerance: ±${(CONFIG.DRAW_TOLERANCE * 100).toFixed(0)}%.`;
    }

    this.questionLabel.textContent = this.currentQuestionText;
  }

  buildIntegerRatioCandidates(targetRatio = null, maxDen = 6) {
    const pairs = [];
    const seen = new Set();

    for (let b = 1; b <= maxDen; ++b) {
      for (let a = 1; a <= b; ++a) {
        const [ra, rb] = reduceRatio(a, b);
        const key = `${ra}:${rb}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const value = ra / rb;
        const diff = targetRatio === null ? 0 : Math.abs(value - targetRatio);
        pairs.push({ pair: [ra, rb], diff, value });
      }
    }

    if (targetRatio === null) {
      // Fixed mode is now a free integer-combination pool under the selected
      // denominator precision. Order is stable; the actual question samples
      // from this pool randomly.
      pairs.sort((x, y) => {
        if (x.pair[1] !== y.pair[1]) return x.pair[1] - y.pair[1];
        return x.pair[0] - y.pair[0];
      });
    } else {
      pairs.sort((x, y) => {
        if (x.diff !== y.diff) return x.diff - y.diff;
        if (x.pair[1] !== y.pair[1]) return x.pair[1] - y.pair[1];
        return x.pair[0] - y.pair[0];
      });
    }

    return pairs.map(item => item.pair);
  }

  resetOptionButtons() {
    for (let i = 0; i < this.optionButtons.length; ++i) {
      const btn = this.optionButtons[i];
      btn.classList.remove(CONFIG.BTN_CORRECT_CLASS, CONFIG.BTN_WRONG_CLASS);

      if (i < this.currentOptionCount) {
        const [a, b] = this.currentOptions[i];
        btn.hidden = false;

        if (this.drawMode.checked) {
          btn.textContent = `Target ratio:  ${a}:${b}`;
          btn.disabled = true;
        } else {
          btn.textContent = `${OPTION_LABELS[i]}.  ${a}:${b}`;
          btn.disabled = false;
        }
      } else {
        btn.hidden = true;
      }
    }

    this.canvas.classList.toggle("draw-mode", this.drawMode.checked);
  }

  generateDrawParams() {
    if (this.drawMode.checked) {
      return this.lineMode?.checked
        ? this.generateDrawLineParams()
        : { shape: "draw" };
    }

    if (this.lineMode?.checked) {
      return this.generateLineDrawParams();
    }

    if (this.polygonMode.checked) {
      return this.generatePolygonDrawParams();
    }

    return this.generateRectangleDrawParams();
  }


  getScaledLongSide() {
    if (this.areaScaleMode.checked) {
      const areaScale = rand(CONFIG.AREA_SCALE_MIN, CONFIG.AREA_SCALE_MAX);
      const sideScale = Math.sqrt(areaScale);
      const longSide = CONFIG.RECT_LONG_SIDE_AREA_SCALE_MODE * sideScale;
      return { longSide, areaScale };
    }

    return { longSide: CONFIG.RECT_LONG_SIDE, areaScale: 1.0 };
  }



  normalizeLineLengthsForVisibility(longLen, shortLen, ratio) {
    const minLen = CONFIG.MIN_VISIBLE_LINE_LENGTH;
    const maxLen = CONFIG.MAX_VISIBLE_LINE_LENGTH;

    if (shortLen < minLen) {
      const scale = minLen / Math.max(shortLen, 1e-9);
      longLen *= scale;
      shortLen *= scale;
    }

    if (longLen > maxLen) {
      longLen = maxLen;
      shortLen = longLen * ratio;
    }

    // For very small ratios, re-expand once after clamping.
    if (shortLen < minLen && ratio > 0) {
      shortLen = minLen;
      longLen = Math.min(maxLen, shortLen / ratio);
    }

    return { longLen, shortLen };
  }

  generateDrawLineParams() {
    const ratio = this.currentRatio;
    const baseLong = 210;
    let longLen = baseLong;
    let shortLen = longLen * ratio;
    ({ longLen, shortLen } = this.normalizeLineLengthsForVisibility(longLen, shortLen, ratio));

    const givenRole = Math.random() < 0.5 ? "short" : "long";
    const targetRole = givenRole === "short" ? "long" : "short";
    const givenLength = givenRole === "short" ? shortLen : longLen;
    const targetLength = targetRole === "short" ? shortLen : longLen;
    const color = givenRole === "short" ? CONFIG.LINE_SHORT_COLOR : CONFIG.LINE_LONG_COLOR;

    const angle = rand(0, 2 * Math.PI);
    const givenLine = this.generateRandomLineSegment(givenLength, 44, angle);

    const restrictBox = this.polygonMode?.checked
      ? this.generateDrawLineStartRestrictionBox(givenLine)
      : null;

    return {
      shape: "drawline",
      givenRole,
      targetRole,
      givenLength,
      targetLength,
      longLength: longLen,
      shortLength: shortLen,
      givenLine,
      color,
      restrictBox,
      userLine: null,
      answerLine: null,
    };
  }

  pointInBox(x, y, box) {
    if (!box) return true;
    const [left, top, right, bottom] = box;
    return x >= left && x <= right && y >= top && y <= bottom;
  }

  drawRestrictionBox(box) {
    if (!box) return;
    const [left, top, right, bottom] = box;

    this.ctx.save();
    this.ctx.strokeStyle = CONFIG.RESTRICT_BOX_COLOR || CONFIG.BBOX_COLOR;
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([7, 6]);
    this.ctx.strokeRect(left, top, right - left, bottom - top);
    this.ctx.restore();
  }

  generateDrawLineStartRestrictionBox(givenLine) {
    const candidates = [
      [42, 42, 210, 160],
      [CONFIG.CANVAS_W - 210, 42, CONFIG.CANVAS_W - 42, 160],
      [42, CONFIG.CANVAS_H - 160, 210, CONFIG.CANVAS_H - 42],
      [CONFIG.CANVAS_W - 210, CONFIG.CANVAS_H - 160, CONFIG.CANVAS_W - 42, CONFIG.CANVAS_H - 42],
      [CONFIG.CANVAS_W / 2 - 90, 42, CONFIG.CANVAS_W / 2 + 90, 160],
      [CONFIG.CANVAS_W / 2 - 90, CONFIG.CANVAS_H - 160, CONFIG.CANVAS_W / 2 + 90, CONFIG.CANVAS_H - 42],
    ];

    const scored = candidates
      .map(box => ({ box, distance: this.distanceBetweenSegmentAndBox(givenLine, box) }))
      .sort((a, b) => b.distance - a.distance);

    const farEnough = scored.find(item => item.distance >= 70);
    return (farEnough || scored[0]).box;
  }

  distanceBetweenSegmentAndBox(seg, box) {
    const [left, top, right, bottom] = box;
    const samples = 24;
    let best = Infinity;

    for (let i = 0; i <= samples; ++i) {
      const t = i / samples;
      const x = seg.x1 + (seg.x2 - seg.x1) * t;
      const y = seg.y1 + (seg.y2 - seg.y1) * t;
      const dx = Math.max(left - x, 0, x - right);
      const dy = Math.max(top - y, 0, y - bottom);
      best = Math.min(best, Math.hypot(dx, dy));
    }

    return best;
  }

  generateLineDrawParams() {
    const ratio = this.currentRatio;
    const { longSide, areaScale } = this.getScaledLongSide();
    let longLen = longSide;
    let shortLen = longSide * ratio;
    ({ longLen, shortLen } = this.normalizeLineLengthsForVisibility(longLen, shortLen, ratio));
    const margin = 36;

    if (this.polygonMode.checked) {
      return {
        shape: "linepair",
        mode: "free",
        longLine: this.generateRandomLineSegment(longLen, margin),
        shortLine: this.generateRandomLineSegment(shortLen, margin),
        areaScale,
      };
    }

    const angle = rand(0, 2 * Math.PI);
    const normal = [-Math.sin(angle), Math.cos(angle)];
    const offset = rand(50, 90) * (Math.random() < 0.5 ? -1 : 1);

    for (let i = 0; i < 200; ++i) {
      const cx = rand(margin, CONFIG.CANVAS_W - margin);
      const cy = rand(margin, CONFIG.CANVAS_H - margin);

      const longCenter = [cx + normal[0] * offset / 2, cy + normal[1] * offset / 2];
      const shortCenter = [cx - normal[0] * offset / 2, cy - normal[1] * offset / 2];

      const longLine = this.segmentFromCenter(longCenter[0], longCenter[1], longLen, angle);
      const shortLine = this.segmentFromCenter(shortCenter[0], shortCenter[1], shortLen, angle);

      if (this.segmentInside(longLine, margin) && this.segmentInside(shortLine, margin)) {
        return { shape: "linepair", mode: "parallel", longLine, shortLine, angle, areaScale };
      }
    }

    return {
      shape: "linepair",
      mode: "parallel",
      longLine: this.segmentFromCenter(CONFIG.CANVAS_W / 2, CONFIG.CANVAS_H / 2 - 34, longLen, 0),
      shortLine: this.segmentFromCenter(CONFIG.CANVAS_W / 2, CONFIG.CANVAS_H / 2 + 34, shortLen, 0),
      angle: 0,
      areaScale,
    };
  }

  generateRandomLineSegment(length, margin, forcedAngle = null) {
    for (let i = 0; i < 100; ++i) {
      const angle = forcedAngle ?? rand(0, 2 * Math.PI);
      const halfW = Math.abs(Math.cos(angle)) * length / 2;
      const halfH = Math.abs(Math.sin(angle)) * length / 2;

      const minX = margin + halfW;
      const maxX = CONFIG.CANVAS_W - margin - halfW;
      const minY = margin + halfH;
      const maxY = CONFIG.CANVAS_H - margin - halfH;

      if (minX < maxX && minY < maxY) {
        return this.segmentFromCenter(rand(minX, maxX), rand(minY, maxY), length, angle);
      }
    }

    return this.segmentFromCenter(CONFIG.CANVAS_W / 2, CONFIG.CANVAS_H / 2, length, 0);
  }

  segmentFromCenter(cx, cy, length, angle) {
    const dx = Math.cos(angle) * length / 2;
    const dy = Math.sin(angle) * length / 2;
    return { x1: cx - dx, y1: cy - dy, x2: cx + dx, y2: cy + dy, length, angle };
  }

  segmentCenter(seg) {
    return [(seg.x1 + seg.x2) / 2, (seg.y1 + seg.y2) / 2];
  }

  segmentInside(seg, margin) {
    return (
      seg.x1 >= margin && seg.x1 <= CONFIG.CANVAS_W - margin &&
      seg.x2 >= margin && seg.x2 <= CONFIG.CANVAS_W - margin &&
      seg.y1 >= margin && seg.y1 <= CONFIG.CANVAS_H - margin &&
      seg.y2 >= margin && seg.y2 <= CONFIG.CANVAS_H - margin
    );
  }

  generateRectangleDrawParams() {
    const ratio = this.currentRatio;
    const { longSide, areaScale } = this.getScaledLongSide();
    const shortSide = longSide * ratio;

    let w, h;
    if (Math.random() < 0.5) {
      w = shortSide;
      h = longSide;
    } else {
      w = longSide;
      h = shortSide;
    }

    const angle = rand(0, 2 * Math.PI);

    const bboxW = Math.abs(w * Math.cos(angle)) + Math.abs(h * Math.sin(angle));
    const bboxH = Math.abs(w * Math.sin(angle)) + Math.abs(h * Math.cos(angle));

    const margin = 18;

    const minCx = bboxW / 2 + margin;
    const maxCx = CONFIG.CANVAS_W - bboxW / 2 - margin;
    const minCy = bboxH / 2 + margin;
    const maxCy = CONFIG.CANVAS_H - bboxH / 2 - margin;

    const cx = minCx < maxCx ? rand(minCx, maxCx) : CONFIG.CANVAS_W / 2;
    const cy = minCy < maxCy ? rand(minCy, maxCy) : CONFIG.CANVAS_H / 2;

    return { shape: "rectangle", w, h, angle, cx, cy, areaScale };
  }

  generatePolygonDrawParams() {
    const ratio = this.currentRatio;
    const { longSide, areaScale } = this.getScaledLongSide();
    const shortSide = longSide * ratio;

    let bboxW, bboxH;
    if (Math.random() < 0.5) {
      bboxW = shortSide;
      bboxH = longSide;
    } else {
      bboxW = longSide;
      bboxH = shortSide;
    }

    const margin = 24;

    const minCx = bboxW / 2 + margin;
    const maxCx = CONFIG.CANVAS_W - bboxW / 2 - margin;
    const minCy = bboxH / 2 + margin;
    const maxCy = CONFIG.CANVAS_H - bboxH / 2 - margin;

    const cx = minCx < maxCx ? rand(minCx, maxCx) : CONFIG.CANVAS_W / 2;
    const cy = minCy < maxCy ? rand(minCy, maxCy) : CONFIG.CANVAS_H / 2;

    const n = randint(CONFIG.POLYGON_MIN_SIDES, CONFIG.POLYGON_MAX_SIDES);
    const localPoints = this.generateSimplePolygonPoints(n, bboxW, bboxH);
    const points = localPoints.map(([x, y]) => [x + cx, y + cy]);

    return {
      shape: "polygon",
      points,
      cx,
      cy,
      bboxW,
      bboxH,
      areaScale,
      sideCount: n,
    };
  }

  generateSimplePolygonPoints(n, targetW, targetH) {
    const step = 2 * Math.PI / n;
    const jitter = step * 0.32;
    const start = rand(0, 2 * Math.PI);

    const angles = [];
    for (let i = 0; i < n; ++i) {
      angles.push(start + i * step + rand(-jitter, jitter));
    }
    angles.sort((a, b) => a - b);

    const makeSpiky = n >= 5 && Math.random() < 0.65;
    const points = [];

    for (let i = 0; i < angles.length; ++i) {
      const angle = angles[i];
      let r;

      if (makeSpiky) {
        r = (i % 2 === 0) ? rand(0.78, 1.0) : rand(0.35, 0.72);
      } else {
        r = rand(0.55, 1.0);
      }

      points.push([r * Math.cos(angle), r * Math.sin(angle)]);
    }

    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const srcW = Math.max(maxX - minX, 1e-9);
    const srcH = Math.max(maxY - minY, 1e-9);

    return points.map(([x, y]) => {
      const nx = (x - minX) / srcW;
      const ny = (y - minY) / srcH;
      return [(nx - 0.5) * targetW, (ny - 0.5) * targetH];
    });
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, CONFIG.CANVAS_W, CONFIG.CANVAS_H);
    this.ctx.fillStyle = CONFIG.BG_CANVAS;
    this.ctx.fillRect(0, 0, CONFIG.CANVAS_W, CONFIG.CANVAS_H);
  }

  redrawCurrent() {
    if (!this.currentDrawParams) return;

    if (this.currentDrawParams.shape === "drawline") {
      this.renderCurrentQuestionCanvas(this.locked, this.currentDragLine());
    } else if (this.currentDrawParams.shape === "draw") {
      this.renderCurrentQuestionCanvas(this.locked, this.currentDragBox());
    } else {
      this.renderCurrentQuestionCanvas(this.locked);
    }
  }


  renderCurrentQuestionCanvas(showAnswer = false, preview = null) {
    if (!this.currentDrawParams) return;

    if (this.currentDrawParams.shape === "drawline") {
      this.drawFreehandLineCanvas(showAnswer, preview);
      return;
    }

    if (this.currentDrawParams.shape === "draw") {
      this.drawFreehandAnswerCanvas(showAnswer, preview);
      return;
    }

    this.drawShape(
      this.currentDrawParams,
      showAnswer && this.shouldShowRevealGuide(this.currentDrawParams)
    );
  }


  shouldShowRevealGuide(params) {
    return !!params && (params.shape === "polygon" || params.shape === "linepair");
  }

  drawShape(params, showAabb = false) {
    this.clearCanvas();

    this.ctx.save();
    this.ctx.lineWidth = CONFIG.LINE_WIDTH;
    this.ctx.lineJoin = "round";
    this.ctx.lineCap = "round";

    if (params.shape === "linepair") {
      this.drawLinePair(params, showAabb);
    } else if (params.shape === "polygon") {
      this.drawPolygon(params, showAabb);
    } else {
      this.drawRectangle(params);
    }

    this.ctx.restore();
  }


  drawLinePair(params, showGuide = false) {
    this.ctx.save();
    this.ctx.lineCap = "butt";
    this.ctx.lineJoin = "miter";
    this.ctx.lineWidth = CONFIG.LINE_WIDTH;
    this.ctx.strokeStyle = CONFIG.RECT_COLOR;

    // Normal stage: only draw the two raw black line segments.
    // Keep the same visual weight as rectangle outlines and do not add endpoint ticks.
    this.strokeSegment(params.longLine);
    this.strokeSegment(params.shortLine);

    if (showGuide) {
      this.drawLineSegmentReveal(params);
    }

    this.ctx.restore();
  }

  strokeSegment(seg) {
    this.ctx.beginPath();
    this.ctx.moveTo(seg.x1, seg.y1);
    this.ctx.lineTo(seg.x2, seg.y2);
    this.ctx.stroke();
  }

  drawLineEndpointTicks(seg, color = CONFIG.RECT_COLOR, width = CONFIG.LINE_WIDTH) {
    const angle = Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1);
    const normal = [-Math.sin(angle), Math.cos(angle)];
    const tick = 5;

    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;

    for (const point of [[seg.x1, seg.y1], [seg.x2, seg.y2]]) {
      const [x, y] = point;
      this.ctx.beginPath();
      this.ctx.moveTo(x - normal[0] * tick, y - normal[1] * tick);
      this.ctx.lineTo(x + normal[0] * tick, y + normal[1] * tick);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  drawLineSegmentReveal(params) {
    const [a, b] = this.currentOptions[this.correctIndex];

    // Reveal is drawn directly on top of the original longer line:
    // a units in red + (b-a) units in blue.
    // Example 2:5 -> 2 red unit segments + 3 blue unit segments.
    this.drawRatioSplitOnLine(params.longLine, a, b);

    // Endpoints are shown only during the answer reveal stage.
    this.drawLineEndpointTicks(params.longLine, CONFIG.LINE_LONG_COLOR, 1.5);
    this.drawLineEndpointTicks(params.shortLine, CONFIG.RECT_COLOR, CONFIG.LINE_WIDTH);
  }

  drawRatioSplitOnLine(seg, a, b) {
    const x1 = seg.x1;
    const y1 = seg.y1;
    const x2 = seg.x2;
    const y2 = seg.y2;

    const dx = x2 - x1;
    const dy = y2 - y1;

    if (b <= 0) return;

    const splitT = Math.max(0, Math.min(1, a / b));
    const sx = x1 + dx * splitT;
    const sy = y1 + dy * splitT;

    this.ctx.save();
    this.ctx.lineCap = "butt";
    this.ctx.lineWidth = Math.max(3, CONFIG.LINE_WIDTH * 3);

    this.ctx.strokeStyle = CONFIG.LINE_SHORT_COLOR;
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(sx, sy);
    this.ctx.stroke();

    this.ctx.strokeStyle = CONFIG.LINE_LONG_COLOR;
    this.ctx.beginPath();
    this.ctx.moveTo(sx, sy);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();

    // Unit separators make the ratio reading explicit.
    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = "#ffffff";
    const angle = Math.atan2(dy, dx);
    const normal = [-Math.sin(angle), Math.cos(angle)];
    const sep = 5;

    for (let i = 1; i < b; ++i) {
      const t = i / b;
      const px = x1 + dx * t;
      const py = y1 + dy * t;

      this.ctx.beginPath();
      this.ctx.moveTo(px - normal[0] * sep, py - normal[1] * sep);
      this.ctx.lineTo(px + normal[0] * sep, py + normal[1] * sep);
      this.ctx.stroke();
    }

    // Outer endpoints for the colored reveal line.
    this.ctx.strokeStyle = CONFIG.RECT_COLOR;
    this.ctx.lineWidth = 1;
    for (const point of [[x1, y1], [x2, y2]]) {
      const [px, py] = point;
      this.ctx.beginPath();
      this.ctx.moveTo(px - normal[0] * sep, py - normal[1] * sep);
      this.ctx.lineTo(px + normal[0] * sep, py + normal[1] * sep);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }


  drawRectangle(params) {
    const { w, h, angle, cx, cy } = params;
    const corners = [
      [-w / 2, -h / 2],
      [ w / 2, -h / 2],
      [ w / 2,  h / 2],
      [-w / 2,  h / 2],
    ];

    const points = corners.map(([x, y]) => {
      const rx = x * Math.cos(angle) - y * Math.sin(angle) + cx;
      const ry = x * Math.sin(angle) + y * Math.cos(angle) + cy;
      return [rx, ry];
    });

    this.ctx.strokeStyle = CONFIG.RECT_COLOR;
    this.ctx.beginPath();
    points.forEach(([x, y], i) => {
      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    });
    this.ctx.closePath();
    this.ctx.stroke();

    this.drawCenterMark(cx, cy);
  }

  drawPolygon(params, showAabb = false) {
    const { points, cx, cy } = params;

    this.ctx.fillStyle = CONFIG.POLYGON_FILL;
    this.ctx.strokeStyle = CONFIG.RECT_COLOR;
    this.ctx.lineWidth = CONFIG.LINE_WIDTH;

    this.ctx.beginPath();
    points.forEach(([x, y], i) => {
      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    });
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    if (showAabb) {
      const xs = points.map(p => p[0]);
      const ys = points.map(p => p[1]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      this.ctx.save();
      this.ctx.strokeStyle = CONFIG.BBOX_COLOR;
      this.ctx.lineWidth = CONFIG.LINE_WIDTH;
      this.ctx.setLineDash([10, 6]);
      this.ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
      this.ctx.restore();
    }

    this.drawCenterMark(cx, cy);
  }

  drawCenterMark(cx, cy) {
    const mark = 7;

    this.ctx.save();
    this.ctx.strokeStyle = CONFIG.CENTER_MARK;
    this.ctx.lineWidth = CONFIG.LINE_WIDTH;
    this.ctx.beginPath();
    this.ctx.moveTo(cx - mark, cy);
    this.ctx.lineTo(cx + mark, cy);
    this.ctx.moveTo(cx, cy - mark);
    this.ctx.lineTo(cx, cy + mark);
    this.ctx.stroke();
    this.ctx.restore();
  }

  // =========================
  // Draw target ratio mode
  // =========================

  onCanvasPointerDown(event) {
    if (!this.drawMode.checked) return;
    if (!this.questionActive || this.locked) return;

    event.preventDefault();

    const [x, y] = this.canvasPoint(event);

    if (
      this.currentDrawParams?.shape === "drawline" &&
      this.currentDrawParams.restrictBox &&
      !this.pointInBox(x, y, this.currentDrawParams.restrictBox)
    ) {
      this.feedbackLabel.textContent = "Start inside the gray dashed region. You may drag outside it after starting.";
      this.drawFreehandLineCanvas(false);
      return;
    }

    this.canvas.setPointerCapture(event.pointerId);

    this.dragStart = [x, y];
    this.dragCurrent = [x, y];

    if (this.currentDrawParams?.shape === "drawline") {
      this.userDrawLine = null;
      this.answerDrawLine = null;
      this.drawFreehandLineCanvas(false);
    } else {
      this.userDrawBox = null;
      this.answerDrawBox = null;
      this.drawFreehandAnswerCanvas(false);
    }
  }


  onCanvasPointerMove(event) {
    if (!this.drawMode.checked) return;
    if (!this.questionActive || this.locked) return;
    if (!this.dragStart) return;

    event.preventDefault();

    const [x, y] = this.canvasPoint(event);
    this.dragCurrent = [x, y];

    if (this.currentDrawParams?.shape === "drawline") {
      this.drawFreehandLineCanvas(false, this.currentDragLine());
    } else {
      this.drawFreehandAnswerCanvas(false, this.currentDragBox());
    }
  }

  onCanvasPointerUp(event) {
    if (!this.drawMode.checked) return;
    if (!this.questionActive || this.locked) return;
    if (!this.dragStart) return;

    event.preventDefault();
    if (this.canvas.hasPointerCapture?.(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }

    const [x, y] = this.canvasPoint(event);
    this.dragCurrent = [x, y];

    if (this.currentDrawParams?.shape === "drawline") {
      this.finishDrawLineAnswer();
      return;
    }

    const box = this.currentDragBox();
    this.dragStart = null;
    this.dragCurrent = null;

    if (!box) {
      this.feedbackLabel.textContent = "The rectangle is too small. Please draw a larger one.";
      this.drawFreehandAnswerCanvas(false);
      return;
    }

    this.userDrawBox = box;
    this.answerDrawBox = this.computeExactRatioBoxByAdjustingLongSide(box, this.currentRatio);

    const userRatio = this.boxShortLongRatio(box);
    const logError = Math.abs(Math.log(userRatio / this.currentRatio));
    const success = logError <= CONFIG.DRAW_LOG_TOLERANCE;
    const displayError = (Math.exp(logError) - 1.0) * 100.0;

    this.locked = true;
    this.questionActive = false;
    this.cancelTimer();
    this.cancelAutoNext();

    this.scoreTotal += 1;
    if (success) {
      this.scoreCorrect += 1;
      this.selectedIndex = this.correctIndex;
      this.optionButtons[0].classList.add(CONFIG.BTN_CORRECT_CLASS);
    } else {
      this.selectedIndex = -1;
      this.optionButtons[0].classList.add(CONFIG.BTN_WRONG_CLASS);
    }

    const [a, b] = this.currentOptions[this.correctIndex];
    this.feedbackLabel.textContent =
      `${success ? "Correct." : "Incorrect."} Target: ${a}:${b}. ` +
      `Your ratio: ${userRatio.toFixed(3)}. ` +
      `Log-ratio error: ${displayError.toFixed(1)}%.`;

    this.drawFreehandAnswerCanvas(true);
    this.updateScoreLabel();
    this.saveCurrentSnapshot();
    this.updateNavButtons();
  }


  currentDragLine() {
    if (!this.dragStart || !this.dragCurrent) return null;

    const [x1, y1] = this.dragStart;
    const [x2, y2] = this.dragCurrent;
    const length = Math.hypot(x2 - x1, y2 - y1);

    if (length < 8) return null;

    return {
      x1,
      y1,
      x2,
      y2,
      length,
      angle: Math.atan2(y2 - y1, x2 - x1),
    };
  }

  finishDrawLineAnswer() {
    const line = this.currentDragLine();
    this.dragStart = null;
    this.dragCurrent = null;

    if (!line) {
      this.feedbackLabel.textContent = "The line is too short. Please draw a longer one.";
      this.drawFreehandLineCanvas(false);
      return;
    }

    this.userDrawLine = line;

    const targetLength = this.currentDrawParams.targetLength;
    const userLength = line.length;
    const logError = Math.abs(Math.log(userLength / targetLength));
    const success = logError <= CONFIG.DRAW_LOG_TOLERANCE;
    const displayError = (Math.exp(logError) - 1.0) * 100.0;

    this.answerDrawLine = this.computeLongBaselineGuideFromUserLine(line);

    this.locked = true;
    this.questionActive = false;
    this.cancelTimer();
    this.cancelAutoNext();

    this.scoreTotal += 1;
    if (success) {
      this.scoreCorrect += 1;
      this.selectedIndex = this.correctIndex;
      this.optionButtons[0].classList.add(CONFIG.BTN_CORRECT_CLASS);
    } else {
      this.selectedIndex = -1;
      this.optionButtons[0].classList.add(CONFIG.BTN_WRONG_CLASS);
    }

    const [a, b] = this.currentOptions[this.correctIndex];
    const givenText = this.currentDrawParams.givenRole === "short" ? "given short red line" : "given long blue line";
    const targetText = this.currentDrawParams.targetRole === "short" ? "short line" : "long line";

    this.feedbackLabel.textContent =
      `${success ? "Correct." : "Incorrect."} Target ratio: ${a}:${b}. ` +
      `${givenText}; draw the ${targetText}. ` +
      `Your length: ${userLength.toFixed(1)}. Target length: ${targetLength.toFixed(1)}. ` +
      `The red/blue guide is split on the long-side baseline. ` +
      `Log-ratio error: ${displayError.toFixed(1)}%.`;

    this.drawFreehandLineCanvas(true);
    this.updateScoreLabel();
    this.saveCurrentSnapshot();
    this.updateNavButtons();
  }

  computeLongBaselineGuideFromUserLine(userLine) {
    const longLength = this.currentDrawParams.longLength;
    const angle = Math.atan2(userLine.y2 - userLine.y1, userLine.x2 - userLine.x1);
    const normal = [-Math.sin(angle), Math.cos(angle)];

    // The reveal guide must always be based on the LONG side, even if the user
    // was asked to draw the short side. Therefore the red+blue split is drawn
    // on a line of length `longLength`, parallel to the user's stroke.
    //
    // If the user drew the long side, the guide uses the user's drawn start.
    // If the user drew the short side, the guide is still a nearby long-side
    // reference line, not a split of the short line.
    const offsetCandidates = [18, -18, 28, -28, 38, -38, 0];

    for (const offset of offsetCandidates) {
      const x1 = userLine.x1 + normal[0] * offset;
      const y1 = userLine.y1 + normal[1] * offset;
      const x2 = x1 + Math.cos(angle) * longLength;
      const y2 = y1 + Math.sin(angle) * longLength;

      const candidate = { x1, y1, x2, y2, length: longLength, angle };

      if (this.segmentInside(candidate, 8)) {
        return candidate;
      }
    }

    return {
      x1: userLine.x1,
      y1: userLine.y1,
      x2: userLine.x1 + Math.cos(angle) * longLength,
      y2: userLine.y1 + Math.sin(angle) * longLength,
      length: longLength,
      angle,
    };
  }


  drawFreehandLineCanvas(showAnswer, previewLine = null) {
    this.clearCanvas();

    if (!this.currentDrawParams || this.currentDrawParams.shape !== "drawline") return;

    const given = this.currentDrawParams.givenLine;

    this.drawRestrictionBox(this.currentDrawParams.restrictBox);

    if (given) {
      this.ctx.save();
      this.ctx.lineWidth = Math.max(3, CONFIG.LINE_WIDTH * 3);
      this.ctx.lineCap = "round";
      this.ctx.strokeStyle = this.currentDrawParams.color;
      this.strokeSegment(given);
      this.ctx.restore();
    }

    const lineToDraw = previewLine || this.userDrawLine;
    if (lineToDraw) {
      this.ctx.save();
      this.ctx.strokeStyle = CONFIG.RECT_COLOR;
      this.ctx.lineWidth = CONFIG.LINE_WIDTH;
      this.ctx.lineCap = "round";
      this.strokeSegment(lineToDraw);
      this.ctx.restore();
    }

    if (showAnswer && this.answerDrawLine) {
      this.drawDrawModeRatioGuide(this.answerDrawLine);
    }
  }


  drawDrawModeRatioGuide(seg) {
    const [a, b] = this.currentOptions[this.correctIndex];
    const x1 = seg.x1;
    const y1 = seg.y1;
    const x2 = seg.x2;
    const y2 = seg.y2;

    const dx = x2 - x1;
    const dy = y2 - y1;

    if (b <= 0) return;

    const splitT = Math.max(0, Math.min(1, a / b));
    const sx = x1 + dx * splitT;
    const sy = y1 + dy * splitT;

    const angle = Math.atan2(dy, dx);
    const normal = [-Math.sin(angle), Math.cos(angle)];
    const sep = 5;

    this.ctx.save();
    this.ctx.lineCap = "butt";
    this.ctx.lineWidth = Math.max(3, CONFIG.LINE_WIDTH * 3);

    this.ctx.strokeStyle = CONFIG.LINE_SHORT_COLOR;
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(sx, sy);
    this.ctx.stroke();

    this.ctx.strokeStyle = CONFIG.LINE_LONG_COLOR;
    this.ctx.beginPath();
    this.ctx.moveTo(sx, sy);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();

    // Unit separators.
    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = "#ffffff";
    for (let i = 1; i < b; ++i) {
      const t = i / b;
      const px = x1 + dx * t;
      const py = y1 + dy * t;

      this.ctx.beginPath();
      this.ctx.moveTo(px - normal[0] * sep, py - normal[1] * sep);
      this.ctx.lineTo(px + normal[0] * sep, py + normal[1] * sep);
      this.ctx.stroke();
    }

    // Endpoints only on the answer guide.
    this.ctx.strokeStyle = CONFIG.RECT_COLOR;
    this.ctx.lineWidth = 1;
    for (const point of [[x1, y1], [x2, y2]]) {
      const [px, py] = point;
      this.ctx.beginPath();
      this.ctx.moveTo(px - normal[0] * sep, py - normal[1] * sep);
      this.ctx.lineTo(px + normal[0] * sep, py + normal[1] * sep);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }


  currentDragBox() {
    if (!this.dragStart || !this.dragCurrent) return null;

    const [x0, y0] = this.dragStart;
    const [x1, y1] = this.dragCurrent;

    const left = Math.min(x0, x1);
    const right = Math.max(x0, x1);
    const top = Math.min(y0, y1);
    const bottom = Math.max(y0, y1);

    if (right - left < 8 || bottom - top < 8) return null;
    return [left, top, right, bottom];
  }

  boxShortLongRatio(box) {
    const [left, top, right, bottom] = box;
    const w = Math.max(1e-9, right - left);
    const h = Math.max(1e-9, bottom - top);
    return Math.min(w, h) / Math.max(w, h);
  }

  computeExactRatioBoxByAdjustingLongSide(box, targetRatio) {
    const [left, top, right, bottom] = box;
    const w = right - left;
    const h = bottom - top;

    if (w <= 0 || h <= 0) return box.slice();

    const cx = (left + right) / 2;
    const cy = (top + bottom) / 2;

    let newW, newH;

    // Strict rule:
    // Compare which side is longer, keep the shorter side fixed,
    // and adjust only the longer side to get the exact target ratio.
    if (w >= h) {
      newH = h;
      newW = h / targetRatio;
    } else {
      newW = w;
      newH = w / targetRatio;
    }

    return [
      cx - newW / 2,
      cy - newH / 2,
      cx + newW / 2,
      cy + newH / 2,
    ];
  }

  drawFreehandAnswerCanvas(showAnswer, previewBox = null) {
    this.clearCanvas();

    const boxToDraw = previewBox || this.userDrawBox;

    if (boxToDraw) {
      this.drawBox(boxToDraw, CONFIG.USER_BOX_COLOR, CONFIG.LINE_WIDTH, false);
    }

    if (showAnswer && this.answerDrawBox) {
      this.drawBox(this.answerDrawBox, CONFIG.ANSWER_BOX_COLOR, CONFIG.LINE_WIDTH, false);

      const [a, b] = this.currentOptions[this.correctIndex];
      this.drawAnswerSquareGrid(this.answerDrawBox, a, b, CONFIG.LIGHT_ANSWER_GUIDE_COLOR, CONFIG.LINE_WIDTH);
    }
  }

  drawBox(box, color, width = 1, dashed = false) {
    const [left, top, right, bottom] = box;

    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;

    if (dashed) {
      this.ctx.setLineDash([10, 6]);
    }

    this.ctx.strokeRect(left, top, right - left, bottom - top);
    this.ctx.restore();
  }

  drawAnswerSquareGrid(box, a, b, color, width = 1) {
    const [left, top, right, bottom] = box;
    const w = right - left;
    const h = bottom - top;

    if (w <= 0 || h <= 0) return;

    let cols, rows;

    // Target is a:b = short:long.
    // Landscape: height is short, width is long -> rows=a, cols=b.
    // Portrait: width is short, height is long -> cols=a, rows=b.
    if (w >= h) {
      cols = b;
      rows = a;
    } else {
      cols = a;
      rows = b;
    }

    if (cols <= 0 || rows <= 0) return;

    const cellW = w / cols;
    const cellH = h / rows;

    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.setLineDash([8, 6]);

    for (let i = 1; i < cols; ++i) {
      const x = left + i * cellW;
      this.ctx.beginPath();
      this.ctx.moveTo(x, top);
      this.ctx.lineTo(x, bottom);
      this.ctx.stroke();
    }

    for (let j = 1; j < rows; ++j) {
      const y = top + j * cellH;
      this.ctx.beginPath();
      this.ctx.moveTo(left, y);
      this.ctx.lineTo(right, y);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  // =========================
  // Answer handling
  // =========================

  onAnswer(index) {
    if (this.drawMode.checked) return;
    if (!this.questionActive || this.locked) return;

    this.locked = true;
    this.questionActive = false;
    this.cancelTimer();
    this.cancelAutoNext();

    this.scoreTotal += 1;
    if (index === this.correctIndex) {
      this.scoreCorrect += 1;
    }

    this.selectedIndex = index;
    this.showResult(index, false, true);
    this.updateScoreLabel();
    this.saveCurrentSnapshot();

    this.autoNextId = setTimeout(() => this.nextQuestion(), 900);
  }

  timeoutAnswer() {
    if (!this.questionActive || this.locked) return;

    this.locked = true;
    this.questionActive = false;
    this.cancelTimer();
    this.cancelAutoNext();

    this.scoreTotal += 1;
    this.selectedIndex = null;

    if (this.drawMode.checked) {
      this.optionButtons[0].classList.add(CONFIG.BTN_WRONG_CLASS);
      const [a, b] = this.currentOptions[this.correctIndex];
      this.feedbackLabel.textContent = `Time out. Target ratio was ${a}:${b}.`;
      this.drawFreehandAnswerCanvas(false);
      this.updateScoreLabel();
      this.saveCurrentSnapshot();
      return;
    }

    this.showResult(null, true, true);
    this.updateScoreLabel();
    this.saveCurrentSnapshot();

    this.autoNextId = setTimeout(() => this.nextQuestion(), 1200);
  }

  showResult(selected = null, timeout = false, redraw = true) {
    for (let i = 0; i < this.currentOptionCount; ++i) {
      this.optionButtons[i].disabled = true;
    }

    if (redraw && this.shouldShowRevealGuide(this.currentDrawParams)) {
      this.drawShape(this.currentDrawParams, true);
    }

    if (timeout) {
      for (let i = 0; i < this.currentOptionCount; ++i) {
        if (i === this.correctIndex) {
          this.optionButtons[i].classList.add(CONFIG.BTN_CORRECT_CLASS);
        } else {
          this.optionButtons[i].classList.add(CONFIG.BTN_WRONG_CLASS);
        }
      }

      this.feedbackLabel.textContent =
        "Time out. The correct answer is highlighted in light green; the wrong answers are highlighted in light red.";
      return;
    }

    if (this.correctIndex >= 0 && this.correctIndex < this.optionButtons.length) {
      this.optionButtons[this.correctIndex].classList.add(CONFIG.BTN_CORRECT_CLASS);
    }

    if (selected === this.correctIndex) {
      this.feedbackLabel.textContent = "Correct.";
    } else {
      if (selected !== null && selected >= 0 && selected < this.optionButtons.length) {
        this.optionButtons[selected].classList.add(CONFIG.BTN_WRONG_CLASS);
      }

      const [a, b] = this.currentOptions[this.correctIndex];
      this.feedbackLabel.textContent = `Incorrect. The correct answer is ${a}:${b}.`;
    }
  }
}


function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderInlineMarkdown(text) {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return out;
}

function renderMarkdown(md) {
  const lines = md.trim().split(/\r?\n/);
  const html = [];
  let inList = false;
  let para = [];

  let inDisplayMath = false;
  let displayMathLines = [];

  function flushPara() {
    if (para.length) {
      html.push(`<p>${renderInlineMarkdown(para.join(" "))}</p>`);
      para = [];
    }
  }

  function closeList() {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  }

  function flushDisplayMath() {
    if (displayMathLines.length) {
      // Do not HTML-escape TeX blocks. MathJax needs to see the raw delimiters.
      html.push(`<div class="math-block">${displayMathLines.join("\n")}</div>`);
      displayMathLines = [];
    }
  }

  for (const raw of lines) {
    const line = raw.trim();

    if (inDisplayMath) {
      displayMathLines.push(line);
      if (line.includes("\\]")) {
        inDisplayMath = false;
        flushDisplayMath();
      }
      continue;
    }

    if (line.startsWith("\\[")) {
      flushPara();
      closeList();

      displayMathLines = [line];

      if (line.includes("\\]")) {
        flushDisplayMath();
      } else {
        inDisplayMath = true;
      }
      continue;
    }

    if (!line) {
      flushPara();
      closeList();
      continue;
    }

    if (line === "---") {
      flushPara();
      closeList();
      html.push("<hr>");
      continue;
    }

    if (line.startsWith("### ")) {
      flushPara();
      closeList();
      html.push(`<h3>${renderInlineMarkdown(line.slice(4))}</h3>`);
      continue;
    }

    if (line.startsWith("#### ")) {
      flushPara();
      closeList();
      html.push(`<h4>${renderInlineMarkdown(line.slice(5))}</h4>`);
      continue;
    }

    if (line.startsWith("- ")) {
      flushPara();
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${renderInlineMarkdown(line.slice(2))}</li>`);
      continue;
    }

    para.push(line);
  }

  if (inDisplayMath) {
    flushDisplayMath();
  }

  flushPara();
  closeList();

  return html.join("\n");
}

function setupHelpModal() {
  const helpBtn = document.getElementById("helpBtn");
  const modal = document.getElementById("helpModal");
  const closeBtn = document.getElementById("helpCloseBtn");
  const frame = document.getElementById("helpFrame");

  if (!helpBtn || !modal || !closeBtn || !frame) return;

  let loaded = false;

  const openHelp = () => {
    if (!loaded) {
      frame.src = "./helper.html";
      loaded = true;
    }

    modal.hidden = false;
    document.body.style.overflow = "hidden";
    closeBtn.focus();
  };

  const closeHelp = () => {
    modal.hidden = true;
    document.body.style.overflow = "";
    helpBtn.focus();
  };

  helpBtn.addEventListener("click", openHelp);
  closeBtn.addEventListener("click", closeHelp);

  modal.addEventListener("click", event => {
    if (event.target.matches("[data-close-help]")) {
      closeHelp();
    }
  });

  window.addEventListener("keydown", event => {
    if (event.key === "Escape" && !modal.hidden) {
      closeHelp();
    }
  });
}


function setupCookbookModal() {
  const cookbookBtn = document.getElementById("cookbookBtn");
  const modal = document.getElementById("cookbookModal");
  const closeBtn = document.getElementById("cookbookCloseBtn");
  const frame = document.getElementById("cookbookFrame");

  if (!cookbookBtn || !modal || !closeBtn || !frame) return;

  let loaded = false;

  const openCookbook = () => {
    if (!loaded) {
      frame.src = "./tutorial.html";
      loaded = true;
    }

    modal.hidden = false;
    document.body.style.overflow = "hidden";
    closeBtn.focus();
  };

  const closeCookbook = () => {
    modal.hidden = true;
    document.body.style.overflow = "";
    cookbookBtn.focus();
  };

  cookbookBtn.addEventListener("click", openCookbook);
  closeBtn.addEventListener("click", closeCookbook);

  modal.addEventListener("click", event => {
    if (event.target.matches("[data-close-cookbook]")) {
      closeCookbook();
    }
  });

  window.addEventListener("keydown", event => {
    if (event.key === "Escape" && !modal.hidden) {
      closeCookbook();
    }
  });
}

window.addEventListener("DOMContentLoaded", () => {
  setupHelpModal();
  setupCookbookModal();
  new RatioQuizApp();
});
