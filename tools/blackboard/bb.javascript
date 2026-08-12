/**
 * 黒板アプリ (Blackboard)
 * - フルスクリーン黒板
 * - チョーク / 黒板消し / 図形ツール
 * - 複数ページ（未表示ページも localStorage 保存）
 * - ズーム・パン
 * - 色・サイズ変更
 * - Undo / Redo
 * - 画像ダウンロード
 * - タッチ対応
 * - キーボードショートカット
 */

(() => {
  "use strict";

  // ========== Constants ==========
  const STORAGE_KEY = "hakoniwa-blackboard-v1";
  const BOARD_W = 1600;
  const BOARD_H = 1000;
  const MAX_UNDO = 40;
  const MAX_PAGES = 30;
  const AUTO_SAVE_MS = 800;

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

  // ========== State ==========
  const state = {
    pages: [],
    currentPage: 0,
    tool: "chalk",
    color: COLORS[0].hex,
    size: 8,
    zoom: 1,
    panX: 0,
    panY: 0,
    isDrawing: false,
    lastX: 0,
    lastY: 0,
    startX: 0,
    startY: 0,
    shapePreview: null,
    dirty: false,
    saveTimer: null,
    spaceDown: false,
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    panOriginX: 0,
    panOriginY: 0,
  };

  // ========== DOM ==========
  const $ = (sel) => document.querySelector(sel);
  const board = $("#board");
  const overlay = $("#overlay");
  const ctx = board.getContext("2d", { willReadFrequently: true });
  const octx = overlay.getContext("2d");
  const canvasContainer = $("#canvas-container");
  const canvasWrapper = $("#canvas-wrapper");
  const chalkCursor = $("#chalk-cursor");
  const toolbar = $("#toolbar");
  const sidePanel = $("#side-panel");
  const pageList = $("#page-list");
  const toastEl = $("#toast");

  // ========== Init Canvas Size ==========
  function setupCanvas() {
    board.width = BOARD_W;
    board.height = BOARD_H;
    overlay.width = BOARD_W;
    overlay.height = BOARD_H;
    canvasContainer.style.width = BOARD_W + "px";
    canvasContainer.style.height = BOARD_H + "px";
  }

  // ========== Page Management ==========
  function createEmptyPage() {
    const id = "p_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
    return {
      id,
      dataURL: null,
      undo: [],
      redo: [],
    };
  }

  function ensurePages() {
    if (state.pages.length === 0) {
      state.pages.push(createEmptyPage());
      state.currentPage = 0;
    }
  }

  function getCurrent() {
    return state.pages[state.currentPage];
  }

  function snapshot() {
    return board.toDataURL("image/png");
  }

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
    clearBoard();
    if (page.dataURL) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        state.dirty = false;
        updateUI();
      };
      img.src = page.dataURL;
    } else {
      state.dirty = false;
      updateUI();
    }
  }

  function addPage() {
    if (state.pages.length >= MAX_PAGES) {
      showToast("ページ上限です（" + MAX_PAGES + "）");
      return;
    }
    const cur = getCurrent();
    if (cur) cur.dataURL = snapshot();
    state.pages.push(createEmptyPage());
    loadPage(state.pages.length - 1, true);
    showToast("ページを追加しました");
    scheduleSave();
  }

  function deletePage() {
    if (state.pages.length <= 1) {
      showToast("最後のページは削除できません");
      return;
    }
    if (!confirm("このページを削除しますか？")) return;
    state.pages.splice(state.currentPage, 1);
    if (state.currentPage >= state.pages.length) {
      state.currentPage = state.pages.length - 1;
    }
    loadPage(state.currentPage, true);
    scheduleSave();
    showToast("ページを削除しました");
  }

  function clearCurrentPage() {
    if (!confirm("このページをすべて消しますか？")) return;
    pushUndo();
    clearBoard();
    state.dirty = true;
    scheduleSave();
    showToast("クリアしました");
  }

  function clearBoard() {
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--board-bg").trim() || "#1a2f1a";
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);
    drawBoardTexture();
  }

  function drawBoardTexture() {
    const imgData = ctx.getImageData(0, 0, BOARD_W, BOARD_H);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 6;
      d[i] = Math.min(255, Math.max(0, d[i] + n));
      d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + n));
      d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + n));
    }
    ctx.putImageData(imgData, 0, 0);
  }

  // ========== Drawing ==========
  function getPos(e) {
    const rect = board.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const scale = state.zoom;
    const x = (clientX - rect.left) / scale;
    const y = (clientY - rect.top) / scale;
    return { x, y };
  }

  function setChalkStyle() {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 0.85 + Math.random() * 0.12;
    ctx.strokeStyle = state.color;
    ctx.fillStyle = state.color;
    ctx.lineWidth = state.size;
  }

  function setEraserStyle() {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = "destination-out";
    ctx.globalAlpha = 1;
    ctx.lineWidth = state.size * 2.2;
  }

  function drawChalkStroke(x0, y0, x1, y1) {
    setChalkStyle();
    const passes = 3;
    for (let i = 0; i < passes; i++) {
      const offset = (Math.random() - 0.5) * state.size * 0.25;
      ctx.beginPath();
      ctx.moveTo(x0 + offset, y0 + offset);
      ctx.lineTo(x1 + offset, y1 + offset);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawEraserStroke(x0, y0, x1, y1) {
    setEraserStyle();
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }

  function startDraw(e) {
    if (state.spaceDown || state.isPanning) return;
    e.preventDefault();
    const pos = getPos(e);
    state.isDrawing = true;
    state.lastX = pos.x;
    state.lastY = pos.y;
    state.startX = pos.x;
    state.startY = pos.y;

    if (state.tool === "chalk" || state.tool === "eraser") {
      pushUndo();
      if (state.tool === "chalk") {
        setChalkStyle();
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, state.size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
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
      if (Math.random() < 0.08) spawnDust(pos.x, pos.y);
    } else if (state.tool === "eraser") {
      drawEraserStroke(state.lastX, state.lastY, pos.x, pos.y);
    } else {
      octx.clearRect(0, 0, BOARD_W, BOARD_H);
      octx.lineCap = "round";
      octx.lineJoin = "round";
      octx.strokeStyle = state.color;
      octx.lineWidth = state.size;
      octx.globalAlpha = 0.7;
      drawShape(octx, state.tool, state.startX, state.startY, pos.x, pos.y);
      octx.globalAlpha = 1;
    }

    state.lastX = pos.x;
    state.lastY = pos.y;
    state.dirty = true;
  }

  function endDraw(e) {
    if (state.isPanning) {
      state.isPanning = false;
      return;
    }
    if (!state.isDrawing) return;
    state.isDrawing = false;

    if (state.tool === "line" || state.tool === "rect" || state.tool === "circle") {
      const pos = e ? getPos(e) : { x: state.lastX, y: state.lastY };
      pushUndo();
      setChalkStyle();
      ctx.globalAlpha = 0.9;
      drawShape(ctx, state.tool, state.startX, state.startY, pos.x, pos.y);
      ctx.globalAlpha = 1;
      octx.clearRect(0, 0, BOARD_W, BOARD_H);
      state.dirty = true;
    }
    scheduleSave();
  }

  function drawShape(c, tool, x0, y0, x1, y1) {
    c.beginPath();
    if (tool === "line") {
      c.moveTo(x0, y0);
      c.lineTo(x1, y1);
      c.stroke();
    } else if (tool === "rect") {
      c.strokeRect(x0, y0, x1 - x0, y1 - y0);
    } else if (tool === "circle") {
      const rx = (x1 - x0) / 2;
      const ry = (y1 - y0) / 2;
      const cx = x0 + rx;
      const cy = y0 + ry;
      c.ellipse(cx, cy, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
      c.stroke();
    }
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

  // ========== Undo / Redo ==========
  function undo() {
    const page = getCurrent();
    if (!page || page.undo.length === 0) return;
    page.redo.push(snapshot());
    const prev = page.undo.pop();
    const img = new Image();
    img.onload = () => {
      clearBoard();
      ctx.drawImage(img, 0, 0);
      state.dirty = true;
      scheduleSave();
      updateUndoButtons();
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
      clearBoard();
      ctx.drawImage(img, 0, 0);
      state.dirty = true;
      scheduleSave();
      updateUndoButtons();
    };
    img.src = next;
  }

  function updateUndoButtons() {
    const page = getCurrent();
    $("#btn-undo").disabled = !page || page.undo.length === 0;
    $("#btn-redo").disabled = !page || page.redo.length === 0;
  }

  // ========== Zoom & Pan ==========
  function applyTransform() {
    canvasContainer.style.transform =
      `translate(calc(-50% + ${state.panX}px), calc(-50% + ${state.panY}px)) scale(${state.zoom})`;
    $("#zoom-indicator").textContent = Math.round(state.zoom * 100) + "%";
  }

  function zoomBy(delta) {
    state.zoom = Math.min(4, Math.max(0.25, state.zoom + delta));
    applyTransform();
  }

  function zoomIn() { zoomBy(0.15); }
  function zoomOut() { zoomBy(-0.15); }
  function zoomReset() {
    state.zoom = 1;
    state.panX = 0;
    state.panY = 0;
    applyTransform();
  }

  // ========== Cursor ==========
  function updateCursor(e) {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    chalkCursor.style.left = clientX + "px";
    chalkCursor.style.top = clientY + "px";
    chalkCursor.classList.add("visible");

    const size = state.tool === "eraser" ? state.size * 2.2 : state.size;
    chalkCursor.style.width = Math.max(8, size * state.zoom) + "px";
    chalkCursor.style.height = Math.max(8, size * state.zoom) + "px";
    chalkCursor.style.background = state.tool === "eraser" ? "rgba(180,160,120,0.3)" : state.color;
    chalkCursor.classList.toggle("eraser", state.tool === "eraser");
  }

  function hideCursor() {
    chalkCursor.classList.remove("visible");
  }

  function updateCoords(pos) {
    $("#status-coords").textContent = `${Math.round(pos.x)}, ${Math.round(pos.y)}`;
  }

  // ========== Tool / Color / Size ==========
  function setTool(tool) {
    state.tool = tool;
    document.querySelectorAll("[data-tool]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tool === tool);
    });
    const names = { chalk: "チョーク", eraser: "黒板消し", line: "直線", rect: "四角", circle: "円" };
    $("#status-tool").textContent = names[tool] || tool;
    updateStatusColor();
  }

  function setColor(hex) {
    state.color = hex;
    document.querySelectorAll(".color-swatch").forEach((s) => {
      s.classList.toggle("active", s.dataset.color === hex);
    });
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
    $("#status-color").textContent = c ? c.name : state.color;
    $("#status-color").style.color = state.color;
  }

  // ========== Storage ==========
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
      version: 1,
      currentPage: state.currentPage,
      pages: state.pages.map((p) => ({
        id: p.id,
        dataURL: p.dataURL,
      })),
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
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        ensurePages();
        clearBoard();
        return;
      }
      const data = JSON.parse(raw);
      if (!data.pages || !Array.isArray(data.pages) || data.pages.length === 0) {
        ensurePages();
        clearBoard();
        return;
      }
      state.pages = data.pages.map((p) => ({
        id: p.id || createEmptyPage().id,
        dataURL: p.dataURL || null,
        undo: [],
        redo: [],
      }));
      state.currentPage = Math.min(data.currentPage || 0, state.pages.length - 1);
      loadPage(state.currentPage, true);
    } catch (err) {
      console.error(err);
      ensurePages();
      clearBoard();
    }
  }

  function clearStorage() {
    if (!confirm("すべての黒板データを削除します。よろしいですか？")) return;
    localStorage.removeItem(STORAGE_KEY);
    state.pages = [createEmptyPage()];
    state.currentPage = 0;
    clearBoard();
    updateUI();
    showToast("全データを削除しました");
  }

  // ========== Export ==========
  function downloadCurrent() {
    const cur = getCurrent();
    if (cur) cur.dataURL = snapshot();
    const a = document.createElement("a");
    a.download = `blackboard-page${state.currentPage + 1}-${Date.now()}.png`;
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
      a.download = `blackboard-page${i + 1}.png`;
      a.href = p.dataURL;
      a.click();
      await new Promise((r) => setTimeout(r, 300));
    }
    showToast("ダウンロード完了");
  }

  // ========== UI Updates ==========
  function updateUI() {
    $("#page-indicator").textContent = `${state.currentPage + 1} / ${state.pages.length}`;
    updateUndoButtons();
    renderPageList();
  }

  function renderPageList() {
    pageList.innerHTML = "";
    state.pages.forEach((p, i) => {
      const div = document.createElement("div");
      div.className = "page-thumb" + (i === state.currentPage ? " active" : "");
      const canvas = document.createElement("canvas");
      canvas.width = 96;
      canvas.height = 60;
      const tctx = canvas.getContext("2d");
      tctx.fillStyle = "#1a2f1a";
      tctx.fillRect(0, 0, 96, 60);
      if (p.dataURL) {
        const img = new Image();
        img.onload = () => tctx.drawImage(img, 0, 0, 96, 60);
        img.src = p.dataURL;
      }
      const info = document.createElement("div");
      info.className = "page-thumb-info";
      info.innerHTML = `<strong>ページ ${i + 1}</strong><small>${p.dataURL ? "保存済" : "空"}</small>`;
      div.appendChild(canvas);
      div.appendChild(info);
      div.addEventListener("click", () => {
        loadPage(i);
        sidePanel.classList.remove("open");
      });
      pageList.appendChild(div);
    });
  }

  function showToast(msg, ms = 2200) {
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

  // ========== Events ==========
  function bindEvents() {
    board.addEventListener("mousedown", startDraw);
    board.addEventListener("mousemove", moveDraw);
    board.addEventListener("mouseup", endDraw);
    board.addEventListener("mouseleave", (e) => {
      endDraw(e);
      hideCursor();
    });
    board.addEventListener("mouseenter", updateCursor);

    board.addEventListener("touchstart", startDraw, { passive: false });
    board.addEventListener("touchmove", moveDraw, { passive: false });
    board.addEventListener("touchend", endDraw);
    board.addEventListener("touchcancel", endDraw);

    canvasWrapper.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      zoomBy(delta);
    }, { passive: false });

    window.addEventListener("keydown", (e) => {
      if (e.code === "Space" && !state.spaceDown) {
        state.spaceDown = true;
        canvasWrapper.style.cursor = "grab";
      }
    });
    window.addEventListener("keyup", (e) => {
      if (e.code === "Space") {
        state.spaceDown = false;
        state.isPanning = false;
        canvasWrapper.style.cursor = "none";
      }
    });

    canvasWrapper.addEventListener("mousedown", (e) => {
      if (state.spaceDown || e.button === 1) {
        state.isPanning = true;
        state.panStartX = e.clientX;
        state.panStartY = e.clientY;
        state.panOriginX = state.panX;
        state.panOriginY = state.panY;
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
        const dx = e.clientX - state.panStartX;
        const dy = e.clientY - state.panStartY;
        state.panX = state.panOriginX + dx;
        state.panY = state.panOriginY + dy;
        applyTransform();
      }
    });

    $("#btn-chalk").addEventListener("click", () => setTool("chalk"));
    $("#btn-eraser").addEventListener("click", () => setTool("eraser"));
    $("#btn-line").addEventListener("click", () => setTool("line"));
    $("#btn-rect").addEventListener("click", () => setTool("rect"));
    $("#btn-circle").addEventListener("click", () => setTool("circle"));

    $("#size-slider").addEventListener("input", (e) => setSize(e.target.value));

    $("#btn-undo").addEventListener("click", undo);
    $("#btn-redo").addEventListener("click", redo);
    $("#btn-clear").addEventListener("click", clearCurrentPage);
    $("#btn-zoom-in").addEventListener("click", zoomIn);
    $("#btn-zoom-out").addEventListener("click", zoomOut);
    $("#btn-zoom-reset").addEventListener("click", zoomReset);
    $("#btn-download").addEventListener("click", downloadCurrent);
    $("#btn-fullscreen").addEventListener("click", toggleFullscreen);

    $("#btn-prev").addEventListener("click", () => loadPage(state.currentPage - 1));
    $("#btn-next").addEventListener("click", () => loadPage(state.currentPage + 1));
    $("#btn-add-page").addEventListener("click", addPage);
    $("#btn-del-page").addEventListener("click", deletePage);

    $("#btn-menu").addEventListener("click", () => {
      sidePanel.classList.toggle("open");
      renderPageList();
    });
    $("#btn-close-panel").addEventListener("click", () => sidePanel.classList.remove("open"));
    $("#btn-export-all").addEventListener("click", exportAllZip);
    $("#btn-clear-storage").addEventListener("click", clearStorage);

    window.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT") return;
      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key === "z") { e.preventDefault(); undo(); return; }
      if (ctrl && (e.key === "y" || (e.shiftKey && e.key === "Z"))) { e.preventDefault(); redo(); return; }
      if (ctrl && e.key === "s") { e.preventDefault(); downloadCurrent(); return; }

      switch (e.key.toLowerCase()) {
        case "c": setTool("chalk"); break;
        case "e": setTool("eraser"); break;
        case "l": setTool("line"); break;
        case "r": setTool("rect"); break;
        case "o": setTool("circle"); break;
        case "arrowleft": loadPage(state.currentPage - 1); break;
        case "arrowright": loadPage(state.currentPage + 1); break;
        case "+": case "=": if (!ctrl) zoomIn(); break;
        case "-": if (!ctrl) zoomOut(); break;
        case "0": zoomReset(); break;
        case "f": toggleFullscreen(); break;
        case "m": sidePanel.classList.toggle("open"); renderPageList(); break;
        case "[": setSize(Math.max(2, state.size - 2)); break;
        case "]": setSize(Math.min(60, state.size + 2)); break;
      }

      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= COLORS.length) {
        setColor(COLORS[num - 1].hex);
      }
    });

    board.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("resize", () => applyTransform());
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.() ||
        document.documentElement.webkitRequestFullscreen?.();
    } else {
      document.exitFullscreen?.() || document.webkitExitFullscreen?.();
    }
  }

  // ========== Boot ==========
  function init() {
    setupCanvas();
    buildColorPalette();
    setTool("chalk");
    setColor(COLORS[0].hex);
    setSize(8);
    loadAll();
    applyTransform();
    bindEvents();
    updateUI();

    const fit = Math.min(
      (window.innerWidth - 40) / BOARD_W,
      (window.innerHeight - 100) / BOARD_H
    );
    state.zoom = Math.min(1, Math.max(0.4, fit * 0.92));
    applyTransform();

    showToast("黒板へようこそ ✎  ショートカット: C/E/L/R/O, Ctrl+Z, ←→");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
