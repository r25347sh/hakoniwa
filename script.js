/**
 * HAKONIWA — トップページ
 */
(() => {
  "use strict";

  const TOOLS = [
    { id: "quickshare", title: "Quick Share", desc: "ファイルを端末同士で送受信。QRとリンクでつながる。", icon: "📡", href: "tools/quickshare/", tag: "NEW", accent: "#5dade2" },
    { id: "blackboard", title: "黒板", desc: "フルスクリーン黒板。チョーク・消し・複数ページ・ズーム対応。", icon: "✎", href: "tools/blackboard/bb.html", tag: "人気", accent: "#7cb87c" },
    { id: "timer", title: "授業タイマー", desc: "残り時間を大きく表示。プリセットやアラーム付き。", icon: "⏱", href: "tools/timer/", tag: "時間", accent: "#5dade2" },
    { id: "picker", title: "指名・抽選", desc: "名簿や番号からランダムに1人（または複数）を選出。", icon: "🎲", href: "tools/picker/", tag: "参加", accent: "#f5b041" },
    { id: "dice", title: "サイコロ", desc: "1〜6、任意面数、複数個まで。アニメーション付き。", icon: "⚀", href: "tools/dice/", tag: "遊び", accent: "#e74c3c" },
    { id: "scoreboard", title: "スコアボード", desc: "チーム対戦やポイント管理。大きな数字で見やすい。", icon: "🏆", href: "tools/scoreboard/", tag: "評価", accent: "#f4e04d" },
    { id: "groups", title: "グループ分け", desc: "名簿を入力してランダムに班分け。人数指定OK。", icon: "👥", href: "tools/groups/", tag: "班", accent: "#bb8fce" },
    { id: "clock", title: "大きな時計", desc: "教室の壁時計代わり。デジタル／アナログ切替。", icon: "🕐", href: "tools/clock/", tag: "表示", accent: "#58d68d" },
    { id: "notes", title: "付箋メモ", desc: "色つき付箋を並べてメモ。ローカルに自動保存。", icon: "📝", href: "tools/notes/", tag: "記録", accent: "#f1948a" },
    { id: "converter", title: "単位変換", desc: "長さ・質量・温度など、理科・数学で使える変換。", icon: "↔", href: "tools/converter/", tag: "理科", accent: "#5dade2" },
    { id: "stopwatch", title: "ストップウォッチ", desc: "計測・ラップ記録。実験や発表時間に。", icon: "⏲", href: "tools/timer/?mode=stopwatch", tag: "時間", accent: "#85c1e9" },
    { id: "wheel", title: "ルーレット", desc: "選択肢を回して決定。アイスブレイクにも。", icon: "🎡", href: "tools/picker/?mode=wheel", tag: "参加", accent: "#f5b041" },
    { id: "bell", title: "注目ベル", desc: "チャイム音で注目を集める。ワンクリック。", icon: "🔔", href: "tools/timer/?mode=bell", tag: "注意", accent: "#e74c3c" },
  ];

  function renderTools() {
    const grid = document.getElementById("tools-grid");
    if (!grid) return;
    grid.innerHTML = TOOLS.map((t) => `
      <a class="tool-card" href="${t.href}" style="--card-accent:${t.accent}" data-tag="${t.tag || ""}">
        ${t.tag ? `<span class="tool-tag" data-tag="${t.tag}">${t.tag}</span>` : ""}
        <div class="tool-icon" style="background:color-mix(in srgb, ${t.accent} 18%, transparent)">${t.icon}</div>
        <h3>${t.title}</h3>
        <p>${t.desc}</p>
        <span class="tool-link">開く</span>
      </a>
    `).join("");

    const cards = grid.querySelectorAll(".tool-card");
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            io.unobserve(e.target);
          }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
      cards.forEach((c, i) => {
        c.style.transitionDelay = i * 0.05 + "s";
        io.observe(c);
      });
    } else {
      cards.forEach((c) => c.classList.add("visible"));
    }
  }

  function spawnPetals() {
    const box = document.getElementById("petals");
    if (!box || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (let i = 0; i < 14; i++) {
      const p = document.createElement("span");
      p.className = "petal";
      p.style.left = Math.random() * 100 + "%";
      p.style.animationDuration = 12 + Math.random() * 16 + "s";
      p.style.animationDelay = Math.random() * 12 + "s";
      p.style.width = 5 + Math.random() * 7 + "px";
      p.style.height = p.style.width;
      p.style.opacity = String(0.08 + Math.random() * 0.12);
      p.style.background = Math.random() > 0.5 ? "#7cb87c" : "#c4a574";
      box.appendChild(p);
    }
  }

  function bindMenu() {
    const btn = document.getElementById("menu-btn");
    const nav = document.getElementById("nav");
    if (!btn || !nav) return;
    btn.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        nav.classList.remove("open");
        btn.setAttribute("aria-expanded", "false");
      });
    });
  }

  function setYear() {
    const el = document.getElementById("year");
    if (el) el.textContent = String(new Date().getFullYear());
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderTools();
    bindMenu();
    setYear();
    spawnPetals();
  });
})();
