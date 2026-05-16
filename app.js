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

  DRAW_TOLERANCE: 0.10,

  BG_CANVAS: "#ffffff",
  RECT_COLOR: "#111111",
  POLYGON_FILL: "#f9fafb",
  BBOX_COLOR: "#94a3b8",
  USER_BOX_COLOR: "#111111",
  ANSWER_BOX_COLOR: "#2563eb",
  LIGHT_ANSWER_GUIDE_COLOR: "#93c5fd",
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
    this.drawMode = document.getElementById("drawMode");

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
      this.redrawCurrent();
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
    [this.timeMode, this.randomMode, this.areaScaleMode, this.polygonMode, this.drawMode]
      .forEach(input => input.addEventListener("change", () => this.onModeChange()));

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
    const drawEnabled = this.drawMode.checked;
    const exclusiveInputs = [this.areaScaleMode, this.polygonMode];

    // Draw target ratio mode uses a blank canvas and one target ratio,
    // so shape-generation options are mutually exclusive with it.
    for (const input of exclusiveInputs) {
      if (drawEnabled) input.checked = false;
      input.disabled = drawEnabled;
      input.closest("label")?.classList.toggle("disabled", drawEnabled);
    }

    this.updateSettingsSummary();
  }

  updateSettingsSummary() {
    if (!this.settingsSummary) return;

    const parts = [];

    if (this.drawMode.checked) {
      parts.push("Draw");
    } else {
      parts.push(this.randomMode.checked ? "Random ratio" : "Fixed ratios");
      if (this.areaScaleMode.checked) parts.push("Area scale");
      if (this.polygonMode.checked) parts.push("Polygon");
    }

    if (this.timeMode.checked) parts.push("Timed");

    this.settingsSummary.textContent = parts.join(" · ");
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
    this.dragStart = null;
    this.dragCurrent = null;

    this.questionLabel.textContent = this.currentQuestionText;
    this.modeLabel.textContent = snapshot.modeText;
    this.feedbackLabel.textContent = snapshot.feedback;

    this.resetOptionButtons();

    if (this.currentDrawParams?.shape === "draw") {
      this.drawFreehandAnswerCanvas(this.locked);
    } else {
      this.drawShape(this.currentDrawParams, this.locked && this.currentDrawParams?.shape === "polygon");
    }

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

    let ratioModeText;
    let shapeText;
    let scaleText;

    if (this.drawMode.checked) {
      this.currentOptionCount = 1;
      ratioModeText = "draw target ratio";
      this.generateDrawModeQuestion();
      shapeText = "blank drawing canvas";
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

      scaleText = this.areaScaleMode.checked ? "area scale on" : "area scale off";
      shapeText = this.polygonMode.checked ? "complex polygon AABB" : "rectangle";
    }

    this.modeLabel.textContent = `Mode: ${ratioModeText} • ${scaleText} • ${shapeText}`;
    this.updateSettingsSummary();
    this.currentDrawParams = this.generateDrawParams();

    this.resetOptionButtons();

    if (this.drawMode.checked) {
      this.drawFreehandAnswerCanvas(false);
    } else {
      this.drawShape(this.currentDrawParams);
    }

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
  }

  generateFixedQuestion() {
    const correctPair = choice(FIXED_RATIOS);
    this.currentRatio = correctPair[0] / correctPair[1];

    const candidates = FIXED_RATIOS
      .filter(p => !samePair(p, correctPair))
      .sort((p, q) => Math.abs(p[0] / p[1] - this.currentRatio) -
                      Math.abs(q[0] / q[1] - this.currentRatio));

    const wrongs = sample(candidates.slice(0, 5), 2);
    this.currentOptions = shuffle([...wrongs, correctPair]);
    this.correctIndex = this.currentOptions.findIndex(p => samePair(p, correctPair));

    this.currentQuestionText = this.polygonMode.checked
      ? "Choose the closest ratio of the polygon's axis-aligned bounding box."
      : "Choose the closest ratio of the rectangle.";

    this.questionLabel.textContent = this.currentQuestionText;
  }

  generateRandomQuestion() {
    this.currentRatio = rand(0.1, 1.0);

    const candidates = this.buildIntegerRatioCandidates(this.currentRatio, 12);
    const correctPair = candidates[0];
    const wrongs = sample(candidates.slice(1, 10), 3);

    this.currentOptions = shuffle([...wrongs, correctPair]);
    this.correctIndex = this.currentOptions.findIndex(p => samePair(p, correctPair));

    this.currentQuestionText = this.polygonMode.checked
      ? "Choose the closest integer ratio of the polygon's axis-aligned bounding box."
      : "Choose the closest integer ratio to the shown rectangle.";

    this.questionLabel.textContent = this.currentQuestionText;
  }

  generateDrawModeQuestion() {
    let correctPair;

    if (this.randomMode.checked) {
      const rawRatio = rand(0.1, 1.0);
      const candidates = this.buildIntegerRatioCandidates(rawRatio, 12);
      correctPair = candidates[0];
    } else {
      correctPair = choice(FIXED_RATIOS);
    }

    this.currentOptions = [correctPair];
    this.correctIndex = 0;
    this.currentRatio = correctPair[0] / correctPair[1];

    const [a, b] = correctPair;
    this.currentQuestionText =
      `Draw a rectangle whose short side:long side is close to ${a}:${b}. ` +
      `Tolerance: ±${(CONFIG.DRAW_TOLERANCE * 100).toFixed(0)}%.`;

    this.questionLabel.textContent = this.currentQuestionText;
  }

  buildIntegerRatioCandidates(targetRatio, maxDen = 12) {
    const pairs = [];
    const seen = new Set();

    for (let b = 1; b <= maxDen; ++b) {
      for (let a = 1; a <= b; ++a) {
        const [ra, rb] = reduceRatio(a, b);
        const key = `${ra}:${rb}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const value = ra / rb;
        const diff = Math.abs(value - targetRatio);
        pairs.push({ pair: [ra, rb], diff });
      }
    }

    pairs.sort((x, y) => {
      if (x.diff !== y.diff) return x.diff - y.diff;
      if (x.pair[1] !== y.pair[1]) return x.pair[1] - y.pair[1];
      return x.pair[0] - y.pair[0];
    });

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
      return { shape: "draw" };
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

    if (this.currentDrawParams.shape === "draw") {
      this.drawFreehandAnswerCanvas(this.locked, this.currentDragBox());
    } else {
      this.drawShape(this.currentDrawParams, this.locked && this.currentDrawParams.shape === "polygon");
    }
  }

  drawShape(params, showAabb = false) {
    this.clearCanvas();

    this.ctx.save();
    this.ctx.lineWidth = CONFIG.LINE_WIDTH;
    this.ctx.lineJoin = "round";
    this.ctx.lineCap = "round";

    if (params.shape === "polygon") {
      this.drawPolygon(params, showAabb);
    } else {
      this.drawRectangle(params);
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
    this.canvas.setPointerCapture(event.pointerId);

    const [x, y] = this.canvasPoint(event);
    this.dragStart = [x, y];
    this.dragCurrent = [x, y];
    this.userDrawBox = null;
    this.answerDrawBox = null;

    this.drawFreehandAnswerCanvas(false);
  }

  onCanvasPointerMove(event) {
    if (!this.drawMode.checked) return;
    if (!this.questionActive || this.locked) return;
    if (!this.dragStart) return;

    event.preventDefault();

    const [x, y] = this.canvasPoint(event);
    this.dragCurrent = [x, y];

    this.drawFreehandAnswerCanvas(false, this.currentDragBox());
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

    if (redraw && this.currentDrawParams?.shape === "polygon") {
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

  for (const raw of lines) {
    const line = raw.trim();

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

    // Keep TeX display blocks intact for MathJax.
    if (line.startsWith("\\[") || line.endsWith("\\]")) {
      flushPara();
      closeList();
      html.push(`<p>${line}</p>`);
      continue;
    }

    para.push(line);
  }

  flushPara();
  closeList();

  return html.join("\n");
}

function setupHelpModal() {
  const helpBtn = document.getElementById("helpBtn");
  const modal = document.getElementById("helpModal");
  const closeBtn = document.getElementById("helpCloseBtn");
  const content = document.getElementById("helpContent");

  if (!helpBtn || !modal || !closeBtn || !content) return;

  let loaded = false;
  let cachedMarkdown = "";

  async function loadHelpMarkdown() {
    if (loaded) return cachedMarkdown;

    try {
      const response = await fetch("./helper.md", { cache: "no-cache" });
      if (!response.ok) {
        throw new Error(`Failed to load helper.md: ${response.status}`);
      }
      cachedMarkdown = await response.text();
    } catch (error) {
      cachedMarkdown = [
        "### Help file could not be loaded",
        "",
        "The app tried to read `helper.md`, but the file was not available.",
        "",
        "When previewing locally, use a small static server instead of opening `index.html` directly:",
        "",
        "`python -m http.server 8080`",
      ].join("\n");
      console.warn(error);
    }

    loaded = true;
    return cachedMarkdown;
  }

  const openHelp = async () => {
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    content.innerHTML = "<p>Loading help...</p>";
    closeBtn.focus();

    const markdown = await loadHelpMarkdown();
    content.innerHTML = renderMarkdown(markdown);

    if (window.MathJax?.typesetPromise) {
      window.MathJax.typesetPromise([content]).catch(() => {});
    }
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

window.addEventListener("DOMContentLoaded", () => {
  setupHelpModal();
  new RatioQuizApp();
});
