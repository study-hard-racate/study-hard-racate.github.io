/* 共享动画播放器：管理步骤序列的播放/暂停/单步/速度 + 键盘快捷键 */
class StepPlayer {
  constructor(opts) {
    this.steps = opts.steps || [];
    this.render = opts.render;          // function(step, index)
    this.code = opts.code || [];
    this.renderCode = opts.renderCode || this._defaultCodeRender;
    this.i = 0;
    this.playing = false;
    this.timer = null;
    this.speed = opts.speed || 800;
    this.onEnd = opts.onEnd || null;
    this.renderCode(this.code, 0);
  }

  setSteps(steps) {
    this.pause();
    this.steps = steps;
    this.i = 0;
    if (this.steps.length) this.render(this.steps[0], 0);
    this.renderCode(this.code, this.steps.length ? this.steps[0].line : -1);
    this._updateInfo();
  }

  play() {
    if (!this.steps.length || this.playing) return;
    /* 已到结尾时从头播放 */
    if (this.i >= this.steps.length - 1) {
      this.i = 0;
      this.render(this.steps[0], 0);
      this.renderCode(this.code, this.steps[0].line);
    }
    this.playing = true;
    this._btn("play", "\u23F8");
    const tick = () => {
      if (this.i >= this.steps.length - 1) {
        this.pause();
        if (this.onEnd) this.onEnd();
        return;
      }
      this.next();
      this.timer = setTimeout(tick, this.speed);
    };
    this.timer = setTimeout(tick, this.speed);
  }

  pause() {
    this.playing = false;
    this._btn("play", "\u25B6");
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }

  next() {
    if (!this.steps.length || this.i >= this.steps.length - 1) return;
    this.i++;
    this.render(this.steps[this.i], this.i);
    this.renderCode(this.code, this.steps[this.i].line);
    this._updateInfo();
  }

  prev() {
    if (!this.steps.length || this.i <= 0) return;
    this.i--;
    this.render(this.steps[this.i], this.i);
    this.renderCode(this.code, this.steps[this.i].line);
    this._updateInfo();
  }

  reset() {
    this.pause();
    this.setSteps(this.steps);
  }

  /* 跳转到指定步骤（进度条用） */
  goToStep(idx) {
    if (!this.steps.length) return;
    idx = Math.max(0, Math.min(this.steps.length - 1, idx));
    this.i = idx;
    this.render(this.steps[this.i], this.i);
    this.renderCode(this.code, this.steps[this.i].line);
    this._updateInfo();
  }

  _updateInfo() {
    const el = document.getElementById("step-info");
    if (el) el.textContent = (this.i + 1) + " / " + this.steps.length;
    /* 更新进度条 */
    const bar = document.getElementById("step-progress");
    if (bar) {
      bar.max = this.steps.length - 1;
      bar.value = this.i;
    }
  }

  _btn(id, glyph) {
    const el = document.getElementById(id);
    if (el) el.textContent = glyph;
  }

  /* 渲染代码面板：把行字符串数组渲染成带行号、可高亮的行。
     代码内容变化（如 playground 粘贴新代码）时整块重建 */
  _defaultCodeRender(code, activeLine) {
    const box = document.getElementById("code-lines");
    if (!box) return;
    const key = code.join("\u0001");
    if (box.dataset.codeKey !== key) {
      box.innerHTML = code.map((l, i) =>
        '<div class="code-line" data-line="' + (i + 1) + '"><span class="ln">' + (i + 1) + "</span>" +
        hlC(l) + "</div>").join("");
      box.dataset.codeKey = key;
      if (!box.dataset.followBound) {
        box.dataset.followBound = "1";
        /* 用户手动滚动代码面板 → 自动取消"跟随高亮"，播放时不再抢滚动 */
        box.addEventListener("scroll", () => {
          if (box.dataset.suppressScroll) return;
          const el = document.getElementById("code-follow");
          if (el && el.checked) el.checked = false;
        });
      }
    }
    box.querySelectorAll(".code-line").forEach(el => el.classList.toggle("hl", +el.dataset.line === activeLine));
    const follow = document.getElementById("code-follow");
    if (follow && !follow.checked) return; /* 已取消跟随：只更新高亮，不滚动 */
    const active = box.querySelector(".code-line.hl");
    if (active && active.scrollIntoView) {
      /* 瞬间定位（对 every 帧的 smooth 滚动正是"一直滚、看不见动画"的元凶），
         且 block:"nearest" 只在当前行滑出视野时才滚 */
      box.dataset.suppressScroll = "1";
      active.scrollIntoView({ block: "nearest" });
      setTimeout(() => { box.dataset.suppressScroll = ""; }, 0);
    }
  }
}

/* C 代码行高亮（极简 token 着色） */
function hlC(line) {
  return line
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/("[^"]*")/g, '<span class="str">$1</span>')
    .replace(/\/\/.*|^\/\*.*\*\/$/g, m => '<span class="cm">' + m + "</span>")
    .replace(/\b(if|else|for|while|return|int|struct|void|char|typedef|break|continue|sizeof)\b/g,
      '<span class="kw">$1</span>')
    .replace(/\b(\d+)\b/g, '<span class="num">$1</span>');
}

/* 绑定播放器按钮 + 键盘快捷键 */
function bindPlayer(p) {
  document.getElementById("btn-play").addEventListener("click", () => p.playing ? p.pause() : p.play());
  document.getElementById("btn-next").addEventListener("click", () => { p.pause(); p.next(); });
  document.getElementById("btn-prev").addEventListener("click", () => { p.pause(); p.prev(); });
  document.getElementById("btn-reset").addEventListener("click", () => p.reset());

  /* 步骤进度条 */
  const progressBar = document.getElementById("step-progress");
  if (progressBar) {
    progressBar.addEventListener("input", e => {
      const idx = parseInt(e.target.value, 10);
      p.goToStep(idx);
    });
  }

  /* 速度滑块 */
  const speedSlider = document.getElementById("speed-slider");
  const speedValue = document.getElementById("speed-value");
  const speedLabels = { 2200: "极慢", 1500: "慢", 1000: "中慢", 700: "中", 450: "快", 250: "极快" };
  function getSpeedLabel(val) {
    if (val >= 2000) return "极慢";
    if (val >= 1300) return "慢";
    if (val >= 850) return "中慢";
    if (val >= 550) return "中";
    if (val >= 350) return "快";
    return "极快";
  }
  if (speedSlider) {
    speedSlider.addEventListener("input", e => {
      const val = +e.target.value;
      p.speed = val;
      if (speedValue) speedValue.textContent = getSpeedLabel(val);
    });
  }

  /* 代码面板折叠 */
  const collapseBtn = document.getElementById("code-collapse-btn");
  const codePanel = document.getElementById("code-panel");
  if (collapseBtn && codePanel) {
    collapseBtn.addEventListener("click", () => {
      codePanel.classList.toggle("collapsed");
      collapseBtn.textContent = codePanel.classList.contains("collapsed") ? "▶" : "◀";
    });
  }

  /* 代码面板拖拽调整宽度 */
  const resizeHandle = document.getElementById("code-resize-handle");
  if (resizeHandle && codePanel) {
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    
    resizeHandle.addEventListener("mousedown", (e) => {
      isResizing = true;
      startX = e.clientX;
      startWidth = codePanel.offsetWidth;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      e.preventDefault();
    });
    
    document.addEventListener("mousemove", (e) => {
      if (!isResizing) return;
      const dx = e.clientX - startX;
      const newWidth = Math.max(200, Math.min(800, startWidth + dx));
      codePanel.style.flex = "0 0 " + newWidth + "px";
    });
    
    document.addEventListener("mouseup", () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    });
  }

  document.addEventListener("keydown", e => {
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    if (e.code === "Space") { e.preventDefault(); p.playing ? p.pause() : p.play(); }
    else if (e.code === "ArrowRight") { p.pause(); p.next(); }
    else if (e.code === "ArrowLeft") { p.pause(); p.prev(); }
    else if (e.code === "KeyR") { p.reset(); }
  });
}
