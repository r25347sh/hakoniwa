/**
 * 黒板アプリ (Blackboard) v2
 * チョーク / 蛍光ペン / 黒板消し / 図形 / テキスト
 * 複数ページ・ズーム・パン・テーマ・方眼・画像取込・自動保存
 */
(() => {
  "use strict";

  const STORAGE_KEY = "hakoniwa-blackboard-v2";
  const BOARD_W = 1600;
  const BOARD_H = 1000;
  const MAX_UNDO = 50;
  const MAX_PAGES = 30;
  const AUTO_SAVE_MS = 700;
  const THEMES = ["green", "black", "navy"];
  const THEME_LABELS = { green: "緑黒板", black: "黒黒板", navy: "紺黒板" };

  const COLORS = [
    { id: "white",  hex: "#f5f5dc", name: "白" },
    { id: "yellow", hex: "#f4e04d", name: "黄" },
    { id: "red",    hex: "#e74c3c", name: "赤" },
    { id: "blue",   hex: "#5dade2", name: "青" },
    { id: "green",  hex: "#58d68d", name: "緑" },
    { id: "pink",   hex: "#f1948a", name: "桃" },
    { id: "orange", hex: "#f5b041", name: "橙" },
    { id: "purple", hex: "#bb8fce", name: "紫" },
  ];

  const state = {
    pages: [], currentPage: 0, tool: "chalk", color: COLORS[0].hex, size: 8,
    zoom: 1, panX: 0, panY: 0, isDrawing: false, lastX: 0, lastY: 0, startX: 0, startY: 0,
    dirty: false, saveTimer: null, spaceDown: false, isPanning: false,
    panStartX: 0, panStartY: 0, panOriginX: 0, panOriginY: 0,
    fillShapes: false, showGrid: false, theme: "green", shiftDown: false,
  };

  const $ = (sel) => document.querySelector(sel);
  const board = $("#board");
  const overlay = $("#overlay");
  const ctx = board.getContext("2d", { willReadFrequently: true });
  const octx = overlay.getContext("2d");
  const canvasContainer = $("#canvas-container");
  const canvasWrapper = $("#canvas-wrapper");
  const chalkCursor = $("#chalk-cursor");
  const sidePanel = $("#side-panel");
  const pageList = $("#page-list");
  const toastEl = $("#toast");
  const textInput = $("#text-input");
  const helpModal = $("#help-modal");

  function setupCanvas() {
    board.width = BOARD_W; board.height = BOARD_H;
    overlay.width = BOARD_W; overlay.height = BOARD_H;
    canvasContainer.style.width = BOARD_W + "px";
    canvasContainer.style.height = BOARD_H + "px";
  }

  function getBoardBg() {
    return getComputedStyle(document.documentElement).getPropertyValue("--board-bg").trim() || "#1a2f1a";
  }

  function createEmptyPage() {
    return { id: "p_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7), dataURL: null, undo: [], redo: [] };
  }

  function ensurePages() {
    if (state.pages.length === 0) { state.pages.push(createEmptyPage()); state.currentPage = 0; }
  }

  function getCurrent() { return state.pages[state.currentPage]; }
  function snapshot() { return board.toDataURL("image/png"); }

  function pushUndo() {
    const page = getCurrent();
    if (!page) return;
    page.undo.push(snapshot());
    if (page.undo.length > MAX_UNDO) page.undo.shift();
    page.redo = [];
    state.dirty = true;
    scheduleSave();
    updateUndoButtons();
  }

  function loadPage(index, skipSave = false) {
    if (!skipSave && state.dirty) {
      const cur = getCurrent();
      if (cur) cur.dataURL = snapshot();
    }
    if (index < 0 || index >= state.pages.length) return;
    state.currentPage = index;
    const page = getCurrent();
    clearBoard(false);
    if (page.dataURL) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        if (state.showGrid) drawGrid();
        state.dirty = false;
        updateUI();
      };
      img.src = page.dataURL;
    } else {
      if (state.showGrid) drawGrid();
      state.dirty = false;
      updateUI();
    }
  }

  function addPage() {
    if (state.pages.length >= MAX_PAGES) { showToast("ページ上限です（" + MAX_PAGES + "）"); return; }
    const cur = getCurrent();
    if (cur) cur.dataURL = snapshot();
    state.pages.push(createEmptyPage());
    loadPage(state.pages.length - 1, true);
    showToast("ページを追加しました");
    scheduleSave();
  }

  function duplicatePage() {
    if (state.pages.length >= MAX_PAGES) { showToast("ページ上限です"); return; }
    const cur = getCurrent();
    if (cur) cur.dataURL = snapshot();
    const copy = createEmptyPage();
    copy.dataURL = cur ? cur.dataURL : null;
    state.pages.splice(state.currentPage + 1, 0, copy);
    loadPage(state.currentPage + 1, true);
    showToast("ページを複製しました");
    scheduleSave();
  }

  function deletePage() {
    if (state.pages.length <= 1) { showToast("最後のページは削除できません"); return; }
    if (!confirm("このページを削除しますか？")) return;
    state.pages.splice(state.currentPage, 1);
    if (state.currentPage >= state.pages.length) state.currentPage = state.pages.length - 1;
    loadPage(state.currentPage, true);
    scheduleSave();
    showToast("ページを削除しました");
  }

  function clearCurrentPage() {
    if (!confirm("このページをすべて消しますか？")) return;
    pushUndo();
    clearBoard(true);
    if (state.showGrid) drawGrid();
    state.dirty = true;
    scheduleSave();
    showToast("クリアしました");
  }

  function clearBoard(withTexture = true) {
    ctx.fillStyle = getBoardBg();
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);
    if (withTexture) drawBoardTexture();
  }

  function drawBoardTexture() {
    try {
      const imgData = ctx.getImageData(0, 0, BOARD_W, BOARD_H);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 16) {
        const n = (Math.random() - 0.5) * 5;
        d[i] = Math.min(255, Math.max(0, d[i] + n));
        d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + n));
        d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + n));
      }
      ctx.putImageData(imgData, 0, 0);
    } catch (_) {}
  }

  function drawGrid() {
    const step = 40;
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = step; x < BOARD_W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, BOARD_H); }
    for (let y = step; y < BOARD_H; y += step) { ctx.moveTo(0, y); ctx.lineTo(BOARD_W, y); }
    ctx.stroke();
    ctx.restore();
  }

  function toggleGrid() {
    state.showGrid = !state.showGrid;
    const el = $("#show-grid");
    if (el) el.checked = state.showGrid;
    const page = getCurrent();
    if (page && page.dataURL) {
      const img = new Image();
      img.onload = () => {
        clearBoard(false);
        ctx.drawImage(img, 0, 0);
        if (state.showGrid) drawGrid();
        state.dirty = true;
        scheduleSave();
      };
      img.src = page.dataURL;
    } else {
      clearBoard(true);
      if (state.showGrid) drawGrid();
      state.dirty = true;
      scheduleSave();
    }
    showToast(state.showGrid ? "方眼ON" : "方眼OFF");
  }

  function getPos(e) {
    const rect = board.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const scale = state.zoom;
    return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
  }

  function constrainShape(x0, y0, x1, y1, tool) {
    if (!state.shiftDown) return { x1, y1 };
    if (tool === "line") {
      const dx = x1 - x0, dy = y1 - y0;
      const angle = Math.atan2(dy, dx);
      const snap = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
      const len = Math.hypot(dx, dy);
      return { x1: x0 + Math.cos(snap) * len, y1: y0 + Math.sin(snap) * len };
    }
    if (tool === "rect" || tool === "circle") {
      const dx = x1 - x0, dy = y1 - y0;
      const s = Math.max(Math.abs(dx), Math.abs(dy));
      return { x1: x0 + Math.sign(dx || 1) * s, y1: y0 + Math.sign(dy || 1) * s };
    }
    return { x1, y1 };
  }

  function setChalkStyle(alpha = null) {
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = alpha != null ? alpha : 0.85 + Math.random() * 0.12;
    ctx.strokeStyle = state.color; ctx.fillStyle = state.color;
    ctx.lineWidth = state.size;
  }

  function setHighlighterStyle() {
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = state.color; ctx.fillStyle = state.color;
    ctx.lineWidth = state.size * 2.8;
  }

  function setEraserStyle() {
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.strokeStyle = getBoardBg(); ctx.fillStyle = getBoardBg();
    ctx.lineWidth = state.size * 2.5;
  }

  function drawChalkStroke(x0, y0, x1, y1) {
    setChalkStyle();
    for (let i = 0; i < 3; i++) {
      const offset = (Math.random() - 0.5) * state.size * 0.25;
      ctx.beginPath();
      ctx.moveTo(x0 + offset, y0 + offset);
      ctx.lineTo(x1 + offset, y1 + offset);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawHighlighterStroke(x0, y0, x1, y1) {
    setHighlighterStyle();
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawEraserStroke(x0, y0, x1, y1) {
    setEraserStyle();
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    const r = (state.size * 2.5) / 2;
    ctx.beginPath(); ctx.arc(x1, y1, r, 0, Math.PI * 2); ctx.fill();
  }

  function drawShape(c, tool, x0, y0, x1, y1, fill) {
    const constrained = constrainShape(x0, y0, x1, y1, tool);
    x1 = constrained.x1; y1 = constrained.y1;
    c.beginPath();
    if (tool === "line") { c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
    else if (tool === "rect") {
      const w = x1 - x0, h = y1 - y0;
      if (fill) c.fillRect(x0, y0, w, h);
      c.strokeRect(x0, y0, w, h);
    } else if (tool === "circle") {
      const rx = (x1 - x0) / 2, ry = (y1 - y0) / 2;
      c.ellipse(x0 + rx, y0 + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
      if (fill) c.fill();
      c.stroke();
    }
  }

  function startDraw(e) {
    if (state.spaceDown || state.isPanning) return;
    if (state.tool === "text") { placeTextInput(e); return; }
    e.preventDefault();
    const pos = getPos(e);
    state.isDrawing = true;
    state.lastX = pos.x; state.lastY = pos.y;
    state.startX = pos.x; state.startY = pos.y;
    if (state.tool === "chalk" || state.tool === "highlighter" || state.tool === "eraser") {
      pushUndo();
      if (state.tool === "chalk") {
        setChalkStyle();
        ctx.beginPath(); ctx.arc(pos.x, pos.y, state.size / 2, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      } else if (state.tool === "highlighter") {
        setHighlighterStyle();
        ctx.beginPath(); ctx.arc(pos.x, pos.y, (state.size * 2.8) / 2, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      } else if (state.tool === "eraser") {
        setEraserStyle();
        const r = (state.size * 2.5) / 2;
        ctx.beginPath(); ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function moveDraw(e) {
    const pos = getPos(e);
    updateCursor(e);
    updateCoords(pos);
    if (state.isPanning) {
      const dx = (e.clientX || e.touches[0].clientX) - state.panStartX;
      const dy = (e.clientY || e.touches[0].clientY) - state.panStartY;
      state.panX = state.panOriginX + dx;
      state.panY = state.panOriginY + dy;
      applyTransform();
      return;
    }
    if (!state.isDrawing) return;
    e.preventDefault();
    if (state.tool === "chalk") {
      drawChalkStroke(state.lastX, state.lastY, pos.x, pos.y);
      if (Math.random() < 0.06) spawnDust(pos.x, pos.y);
    } else if (state.tool === "highlighter") {
      drawHighlighterStroke(state.lastX, state.lastY, pos.x, pos.y);
    } else if (state.tool === "eraser") {
      drawEraserStroke(state.lastX, state.lastY, pos.x, pos.y);
    } else if (state.tool === "line" || state.tool === "rect" || state.tool === "circle") {
      octx.clearRect(0, 0, BOARD_W, BOARD_H);
      octx.lineCap = "round"; octx.lineJoin = "round";
      octx.strokeStyle = state.color; octx.fillStyle = state.color;
      octx.lineWidth = state.size; octx.globalAlpha = 0.75;
      drawShape(octx, state.tool, state.startX, state.startY, pos.x, pos.y, state.fillShapes);
      octx.globalAlpha = 1;
    }
    state.lastX = pos.x; state.lastY = pos.y;
    state.dirty = true;
  }

  function endDraw(e) {
    if (state.isPanning) { state.isPanning = false; return; }
    if (!state.isDrawing) return;
    state.isDrawing = false;
    if (state.tool === "line" || state.tool === "rect" || state.tool === "circle") {
      const pos = e ? getPos(e) : { x: state.lastX, y: state.lastY };
      pushUndo();
      setChalkStyle(0.9);
      drawShape(ctx, state.tool, state.startX, state.startY, pos.x, pos.y, state.fillShapes);
      ctx.globalAlpha = 1;
      octx.clearRect(0, 0, BOARD_W, BOARD_H);
      state.dirty = true;
    }
    scheduleSave();
  }

  function spawnDust(x, y) {
    const rect = board.getBoundingClientRect();
    const scale = state.zoom;
    const el = document.createElement("div");
    el.className = "dust-particle";
    el.style.left = rect.left + x * scale + "px";
    el.style.top = rect.top + y * scale + "px";
    el.style.background = state.color;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 500);
  }

  function placeTextInput(e) {
    const pos = getPos(e);
    const rect = board.getBoundingClientRect();
    const scale = state.zoom;
    textInput.hidden = false;
    textInput.style.left = (rect.left + pos.x * scale) + "px";
    textInput.style.top = (rect.top + pos.y * scale) + "px";
    textInput.style.fontSize = Math.max(14, state.size * 2.2 * scale) + "px";
    textInput.style.color = state.color;
    textInput.value = "";
    textInput.focus();
    textInput.dataset.bx = pos.x;
    textInput.dataset.by = pos.y;
  }

  function commitText() {
    const text = textInput.value;
    if (!text.trim()) { textInput.hidden = true; return; }
    const x = parseFloat(textInput.dataset.bx);
    const y = parseFloat(textInput.dataset.by);
    pushUndo();
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = state.color;
    ctx.font = Math.max(14, state.size * 2.2) + "px " + getComputedStyle(document.body).fontFamily;
    ctx.textBaseline = "top";
    const lines = text.split("\n");
    const lineH = Math.max(14, state.size * 2.2) * 1.3;
    lines.forEach((line, i) => { ctx.fillText(line, x, y + i * lineH); });
    ctx.restore();
    textInput.hidden = true;
    textInput.value = "";
    state.dirty = true;
    scheduleSave();
  }

  function undo() {
    const page = getCurrent();
    if (!page || page.undo.length === 0) return;
    page.redo.push(snapshot());
    const prev = page.undo.pop();
    const img = new Image();
    img.onload = () => {
      clearBoard(false); ctx.drawImage(img, 0, 0);
      state.dirty = true; scheduleSave(); updateUndoButtons();
    };
    img.src = prev;
  }

  function redo() {
    const page = getCurrent();
    if (!page || page.redo.length === 0) return;
    page.undo.push(snapshot());
    const next = page.redo.pop();
    const img = new Image();
    img.onload = () => {
      clearBoard(false); ctx.drawImage(img, 0, 0);
      state.dirty = true; scheduleSave(); updateUndoButtons();
    };
    img.src = next;
  }

  function updateUndoButtons() {
    const page = getCurrent();
    $("#btn-undo").disabled = !page || page.undo.length === 0;
    $("#btn-redo").disabled = !page || page.redo.length === 0;
  }

  function applyTransform() {
    canvasContainer.style.transform =
      "translate(calc(-50% + " + state.panX + "px), calc(-50% + " + state.panY + "px)) scale(" + state.zoom + ")";
    $("#zoom-indicator").textContent = Math.round(state.zoom * 100) + "%";
  }

  function zoomBy(delta) {
    state.zoom = Math.min(4, Math.max(0.25, state.zoom + delta));
    applyTransform();
  }
  function zoomIn() { zoomBy(0.15); }
  function zoomOut() { zoomBy(-0.15); }
  function zoomReset() { state.zoom = 1; state.panX = 0; state.panY = 0; applyTransform(); }

  function updateCursor(e) {
    if (!e) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    chalkCursor.style.left = clientX + "px";
    chalkCursor.style.top = clientY + "px";
    chalkCursor.classList.add("visible");
    let size = state.size;
    if (state.tool === "eraser") size = state.size * 2.5;
    else if (state.tool === "highlighter") size = state.size * 2.8;
    chalkCursor.style.width = Math.max(8, size * state.zoom) + "px";
    chalkCursor.style.height = Math.max(8, size * state.zoom) + "px";
    chalkCursor.style.background = state.tool === "eraser" ? "rgba(180,160,120,0.3)" : state.color;
    chalkCursor.classList.toggle("eraser", state.tool === "eraser");
    if (state.tool === "text") chalkCursor.classList.remove("visible");
  }

  function hideCursor() { chalkCursor.classList.remove("visible"); }
  function updateCoords(pos) { $("#status-coords").textContent = Math.round(pos.x) + ", " + Math.round(pos.y); }

  function setTool(tool) {
    state.tool = tool;
    document.querySelectorAll("[data-tool]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tool === tool);
    });
    const names = { chalk: "チョーク", highlighter: "蛍光ペン", eraser: "黒板消し", line: "直線", rect: "四角", circle: "円", text: "テキスト" };
    $("#status-tool").textContent = names[tool] || tool;
    if (tool !== "text") textInput.hidden = true;
    updateStatusColor();
  }

  function setColor(hex) {
    state.color = hex;
    document.querySelectorAll(".color-swatch").forEach((s) => {
      s.classList.toggle("active", s.dataset.color === hex);
    });
    const cc = $("#custom-color");
    if (cc) cc.value = hex;
    updateStatusColor();
  }

  function setSize(v) {
    state.size = Number(v);
    $("#size-slider").value = state.size;
    $("#size-value").textContent = state.size;
    $("#status-size").textContent = "サイズ: " + state.size;
  }

  function updateStatusColor() {
    const c = COLORS.find((x) => x.hex === state.color);
    $("#status-color").textContent = c ? c.name : "カスタム";
    $("#status-color").style.color = state.color;
  }

  function setTheme(name) {
    state.theme = name;
    document.body.dataset.theme = name;
    const st = $("#status-theme");
    if (st) st.textContent = THEME_LABELS[name] || name;
    scheduleSave();
  }

  function cycleTheme() {
    const i = THEMES.indexOf(state.theme);
    const next = THEMES[(i + 1) % THEMES.length];
    setTheme(next);
    showToast(THEME_LABELS[next]);
  }

  function importImageFile(file) {
    if (!file || !file.type.startsWith("image/")) { showToast("画像ファイルを選んでください"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        pushUndo();
        const margin = 40;
        const maxW = BOARD_W - margin * 2, maxH = BOARD_H - margin * 2;
        let w = img.width, h = img.height;
        const scale = Math.min(maxW / w, maxH / h, 1);
        w *= scale; h *= scale;
        ctx.drawImage(img, (BOARD_W - w) / 2, (BOARD_H - h) / 2, w, h);
        state.dirty = true;
        scheduleSave();
        showToast("画像を取り込みました");
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function scheduleSave() {
    state.dirty = true;
    $("#status-save").textContent = "保存中…";
    $("#status-save").classList.add("saving");
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(saveAll, AUTO_SAVE_MS);
  }

  function saveAll() {
    const cur = getCurrent();
    if (cur) cur.dataURL = snapshot();
    const payload = {
      version: 2,
      currentPage: state.currentPage,
      theme: state.theme,
      showGrid: state.showGrid,
      pages: state.pages.map((p) => ({ id: p.id, dataURL: p.dataURL })),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      $("#status-save").textContent = "保存済";
      $("#status-save").classList.remove("saving");
      state.dirty = false;
    } catch (err) {
      console.error(err);
      $("#status-save").textContent = "保存失敗";
      showToast("保存に失敗しました（容量不足の可能性）");
    }
  }

  function loadAll() {
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) raw = localStorage.getItem("hakoniwa-blackboard-v1");
      if (!raw) { ensurePages(); clearBoard(true); return; }
      const data = JSON.parse(raw);
      if (!data.pages || !Array.isArray(data.pages) || data.pages.length === 0) {
        ensurePages(); clearBoard(true); return;
      }
      state.pages = data.pages.map((p) => ({
        id: p.id || createEmptyPage().id, dataURL: p.dataURL || null, undo: [], redo: [],
      }));
      state.currentPage = Math.min(data.currentPage || 0, state.pages.length - 1);
      if (data.theme) setTheme(data.theme);
      if (data.showGrid) {
        state.showGrid = true;
        const el = $("#show-grid");
        if (el) el.checked = true;
      }
      loadPage(state.currentPage, true);
    } catch (err) {
      console.error(err);
      ensurePages();
      clearBoard(true);
    }
  }

  function clearStorage() {
    if (!confirm("すべての黒板データを削除します。よろしいですか？")) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("hakoniwa-blackboard-v1");
    state.pages = [createEmptyPage()];
    state.currentPage = 0;
    clearBoard(true);
    updateUI();
    showToast("全データを削除しました");
  }

  function downloadCurrent() {
    const cur = getCurrent();
    if (cur) cur.dataURL = snapshot();
    const a = document.createElement("a");
    a.download = "blackboard-page" + (state.currentPage + 1) + "-" + Date.now() + ".png";
    a.href = board.toDataURL("image/png");
    a.click();
    showToast("画像をダウンロードしました");
  }

  async function exportAllZip() {
    const cur = getCurrent();
    if (cur) cur.dataURL = snapshot();
    showToast("各ページを順にダウンロードします…");
    for (let i = 0; i < state.pages.length; i++) {
      const p = state.pages[i];
      if (!p.dataURL) continue;
      const a = document.createElement("a");
      a.download = "blackboard-page" + (i + 1) + ".png";
      a.href = p.dataURL;
      a.click();
      await new Promise((r) => setTimeout(r, 350));
    }
    showToast("ダウンロード完了");
  }

  function updateUI() {
    $("#page-indicator").textContent = (state.currentPage + 1) + " / " + state.pages.length;
    updateUndoButtons();
    renderPageList();
  }

  function renderPageList() {
    pageList.innerHTML = "";
    state.pages.forEach((p, i) => {
      const div = document.createElement("div");
      div.className = "page-thumb" + (i === state.currentPage ? " active" : "");
      const canvas = document.createElement("canvas");
      canvas.width = 96; canvas.height = 60;
      const tctx = canvas.getContext("2d");
      tctx.fillStyle = getBoardBg();
      tctx.fillRect(0, 0, 96, 60);
      if (p.dataURL) {
        const img = new Image();
        img.onload = () => tctx.drawImage(img, 0, 0, 96, 60);
        img.src = p.dataURL;
      }
      const info = document.createElement("div");
      info.className = "page-thumb-info";
      info.innerHTML = "<strong>ページ " + (i + 1) + "</strong><small>" + (p.dataURL ? "保存済" : "空") + "</small>";
      div.appendChild(canvas);
      div.appendChild(info);
      div.addEventListener("click", () => { loadPage(i); sidePanel.classList.remove("open"); });
      pageList.appendChild(div);
    });
  }

  function showToast(msg, ms) {
    ms = ms || 2200;
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toastEl.classList.remove("show"), ms);
  }

  function buildColorPalette() {
    const pal = $("#color-palette");
    pal.innerHTML = "";
    COLORS.forEach((c) => {
      const sw = document.createElement("button");
      sw.className = "color-swatch" + (c.hex === state.color ? " active" : "");
      sw.style.background = c.hex;
      sw.dataset.color = c.hex;
      sw.title = c.name;
      sw.setAttribute("aria-label", c.name);
      sw.addEventListener("click", () => setColor(c.hex));
      pal.appendChild(sw);
    });
  }

  function toggleHelp() { helpModal.hidden = !helpModal.hidden; }

  function bindEvents() {
    board.addEventListener("mousedown", startDraw);
    board.addEventListener("mousemove", moveDraw);
    board.addEventListener("mouseup", endDraw);
    board.addEventListener("mouseleave", (e) => { endDraw(e); hideCursor(); });
    board.addEventListener("mouseenter", updateCursor);
    board.addEventListener("touchstart", startDraw, { passive: false });
    board.addEventListener("touchmove", moveDraw, { passive: false });
    board.addEventListener("touchend", endDraw);
    board.addEventListener("touchcancel", endDraw);

    canvasWrapper.addEventListener("wheel", (e) => {
      e.preventDefault();
      zoomBy(e.deltaY > 0 ? -0.08 : 0.08);
    }, { passive: false });

    canvasWrapper.addEventListener("dragover", (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; });
    canvasWrapper.addEventListener("drop", (e) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) importImageFile(file);
    });

    window.addEventListener("keydown", (e) => {
      if (e.code === "Space" && !state.spaceDown && e.target.tagName !== "TEXTAREA") {
        state.spaceDown = true; canvasWrapper.style.cursor = "grab";
      }
      if (e.key === "Shift") state.shiftDown = true;
    });
    window.addEventListener("keyup", (e) => {
      if (e.code === "Space") {
        state.spaceDown = false; state.isPanning = false; canvasWrapper.style.cursor = "none";
      }
      if (e.key === "Shift") state.shiftDown = false;
    });

    canvasWrapper.addEventListener("mousedown", (e) => {
      if (state.spaceDown || e.button === 1) {
        state.isPanning = true;
        state.panStartX = e.clientX; state.panStartY = e.clientY;
        state.panOriginX = state.panX; state.panOriginY = state.panY;
        canvasWrapper.style.cursor = "grabbing";
      }
    });
    window.addEventListener("mouseup", () => {
      if (state.isPanning) {
        state.isPanning = false;
        canvasWrapper.style.cursor = state.spaceDown ? "grab" : "none";
      }
    });
    window.addEventListener("mousemove", (e) => {
      if (state.isPanning) {
        state.panX = state.panOriginX + (e.clientX - state.panStartX);
        state.panY = state.panOriginY + (e.clientY - state.panStartY);
        applyTransform();
      }
    });

    $("#btn-chalk").addEventListener("click", () => setTool("chalk"));
    $("#btn-highlighter").addEventListener("click", () => setTool("highlighter"));
    $("#btn-eraser").addEventListener("click", () => setTool("eraser"));
    $("#btn-line").addEventListener("click", () => setTool("line"));
    $("#btn-rect").addEventListener("click", () => setTool("rect"));
    $("#btn-circle").addEventListener("click", () => setTool("circle"));
    $("#btn-text").addEventListener("click", () => setTool("text"));

    $("#size-slider").addEventListener("input", (e) => setSize(e.target.value));
    $("#custom-color").addEventListener("input", (e) => setColor(e.target.value));
    $("#fill-shapes").addEventListener("change", (e) => {
      state.fillShapes = e.target.checked;
      showToast(state.fillShapes ? "図形塗りつぶしON" : "図形線のみ");
    });
    $("#show-grid").addEventListener("change", () => toggleGrid());

    $("#btn-undo").addEventListener("click", undo);
    $("#btn-redo").addEventListener("click", redo);
    $("#btn-clear").addEventListener("click", clearCurrentPage);
    $("#btn-zoom-in").addEventListener("click", zoomIn);
    $("#btn-zoom-out").addEventListener("click", zoomOut);
    $("#btn-zoom-reset").addEventListener("click", zoomReset);
    $("#btn-download").addEventListener("click", downloadCurrent);
    $("#btn-fullscreen").addEventListener("click", toggleFullscreen);
    $("#btn-theme").addEventListener("click", cycleTheme);
    $("#btn-import").addEventListener("click", () => $("#file-import").click());
    $("#file-import").addEventListener("change", (e) => {
      const f = e.target.files[0];
      if (f) importImageFile(f);
      e.target.value = "";
    });
    $("#btn-help").addEventListener("click", toggleHelp);
    $("#btn-close-help").addEventListener("click", () => { helpModal.hidden = true; });
    helpModal.addEventListener("click", (e) => { if (e.target === helpModal) helpModal.hidden = true; });

    $("#btn-prev").addEventListener("click", () => loadPage(state.currentPage - 1));
    $("#btn-next").addEventListener("click", () => loadPage(state.currentPage + 1));
    $("#btn-add-page").addEventListener("click", addPage);
    $("#btn-dup-page").addEventListener("click", duplicatePage);
    $("#btn-del-page").addEventListener("click", deletePage);

    $("#btn-menu").addEventListener("click", () => { sidePanel.classList.toggle("open"); renderPageList(); });
    $("#btn-close-panel").addEventListener("click", () => sidePanel.classList.remove("open"));
    $("#btn-export-all").addEventListener("click", exportAllZip);
    $("#btn-clear-storage").addEventListener("click", clearStorage);

    textInput.addEventListener("blur", commitText);
    textInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { textInput.hidden = true; textInput.value = ""; }
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitText(); }
    });

    window.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === "z") { e.preventDefault(); undo(); return; }
      if (ctrl && (e.key === "y" || (e.shiftKey && e.key === "Z"))) { e.preventDefault(); redo(); return; }
      if (ctrl && e.key === "s") { e.preventDefault(); downloadCurrent(); return; }
      switch (e.key.toLowerCase()) {
        case "c": setTool("chalk"); break;
        case "h": setTool("highlighter"); break;
        case "e": setTool("eraser"); break;
        case "l": setTool("line"); break;
        case "r": setTool("rect"); break;
        case "o": setTool("circle"); break;
        case "t": setTool("text"); break;
        case "d": duplicatePage(); break;
        case "g": toggleGrid(); break;
        case "arrowleft": loadPage(state.currentPage - 1); break;
        case "arrowright": loadPage(state.currentPage + 1); break;
        case "+": case "=": if (!ctrl) zoomIn(); break;
        case "-": if (!ctrl) zoomOut(); break;
        case "0": zoomReset(); break;
        case "f": toggleFullscreen(); break;
        case "m": sidePanel.classList.toggle("open"); renderPageList(); break;
        case "?": toggleHelp(); break;
        case "[": setSize(Math.max(2, state.size - 2)); break;
        case "]": setSize(Math.min(80, state.size + 2)); break;
      }
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= COLORS.length) setColor(COLORS[num - 1].hex);
    });

    board.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("resize", () => applyTransform());
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.() || document.documentElement.webkitRequestFullscreen?.();
    } else {
      document.exitFullscreen?.() || document.webkitExitFullscreen?.();
    }
  }

  function init() {
    setupCanvas();
    buildColorPalette();
    setTool("chalk");
    setColor(COLORS[0].hex);
    setSize(8);
    setTheme("green");
    loadAll();
    applyTransform();
    bindEvents();
    updateUI();
    const fit = Math.min((window.innerWidth - 40) / BOARD_W, (window.innerHeight - 100) / BOARD_H);
    state.zoom = Math.min(1, Math.max(0.4, fit * 0.92));
    applyTransform();
    showToast("黒板 v2 ✎  ? でヘルプ / H 蛍光ペン / T テキスト");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
