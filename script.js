/**
 * HAKONIWA — トップページ
 */
(() => {
  "use strict";

  const TOOLS = [
    { id: "it", title: "見た目プロトタイプ CMS", desc: "色・フォント・余白・レイアウトを調整してWebサイトの見た目を素早く試作。HTML書き出し対応。", icon: "🎨", href: "it/", tag: "新着", accent: "#4a9a5a" },
    { id: "quickshare", title: "Quick Share", desc: "ファイルを端末同士で送受信。QRとリンクでつながる。", icon: "📡", href: "tools/quickshare/", tag: "共有", accent: "#4a9a5a" },
    { id: "blackboard", title: "黒板", desc: "フルスクリーン黒板。チョーク・消し・複数ページ・ズーム対応。", icon: "✎", href: "tools/blackboard/bb.html", tag: "人気", accent: "#4a9a5a" },
    { id: "timer", title: "授業タイマー", desc: "残り時間を大きく表示。プリセットやアラーム付き。", icon: "⏱", href: "tools/timer/", tag: "時間", accent: "#5dade2" },
    { id: "traffic", title: "信号タイマー", desc: "緑→黄→赤で発表時間を視覚的に管理。", icon: "🚦", href: "tools/traffic/", tag: "時間", accent: "#e74c3c" },
    { id: "picker", title: "指名・抽選", desc: "名簿や番号からランダムに1人（または複数）を選出。", icon: "🎲", href: "tools/picker/", tag: "参加", accent: "#f5b041" },
    { id: "groups", title: "グループ分け", desc: "名簿を入力してランダムに班分け。", icon: "👥", href: "tools/groups/", tag: "班", accent: "#9b59b6" },
    { id: "seating", title: "座席表", desc: "行×列の座席を作って、名簿をシャッフル配置。", icon: "🪑", href: "tools/seating/", tag: "教室", accent: "#7f8c8d" },
    { id: "poll", title: "簡易投票", desc: "その場で選択肢に投票。結果を棒グラフで表示。", icon: "📊", href: "tools/poll/", tag: "参加", accent: "#3498db" },
    { id: "flashcard", title: "フラッシュカード", desc: "表裏カードで暗記。タップで裏返し。", icon: "🃏", href: "tools/flashcard/", tag: "学習", accent: "#e67e22" },
    { id: "dice", title: "サイコロ", desc: "1〜20面・複数個。アニメーション付き。", icon: "⚀", href: "tools/dice/", tag: "遊び", accent: "#e74c3c" },
    { id: "coin", title: "コイントス", desc: "表か裏か。決断・抽選のシンプル手段。", icon: "🪙", href: "tools/coin/", tag: "遊び", accent: "#f1c40f" },
    { id: "rps", title: "じゃんけん", desc: "先生 vs コンピュータ。勝負の決着に。", icon: "✊", href: "tools/rps/", tag: "遊び", accent: "#e91e63" },
    { id: "scoreboard", title: "スコアボード", desc: "チーム点数を大きな数字で管理。", icon: "🏆", href: "tools/scoreboard/", tag: "評価", accent: "#f39c12" },
    { id: "clock", title: "大きな時計", desc: "デジタル／アナログ切替の壁時計。", icon: "🕐", href: "tools/clock/", tag: "表示", accent: "#1abc9c" },
    { id: "metronome", title: "メトロノーム", desc: "BPM指定でクリック音。音楽・リズム練習に。", icon: "🎵", href: "tools/metronome/", tag: "音楽", accent: "#9b59b6" },
    { id: "notes", title: "付箋メモ", desc: "色つき付箋を並べてメモ。自動保存。", icon: "📝", href: "tools/notes/", tag: "記録", accent: "#e91e63" },
    { id: "converter", title: "単位変換", desc: "長さ・質量・温度など理科・数学用。", icon: "↔", href: "tools/converter/", tag: "理科", accent: "#3498db" },
    { id: "stopwatch", title: "ストップウォッチ", desc: "計測・ラップ記録。実験や発表に。", icon: "⏲", href: "tools/timer/?mode=stopwatch", tag: "時間", accent: "#5dade2" },
    { id: "wheel", title: "ルーレット", desc: "選択肢を回して決定。", icon: "🎡", href: "tools/picker/?mode=wheel", tag: "参加", accent: "#f5b041" },
    { id: "bell", title: "注目ベル", desc: "チャイム音で注目を集める。", icon: "🔔", href: "tools/timer/?mode=bell", tag: "注意", accent: "#e74c3c" },
  ];

  function renderTools() {
    const grid = document.getElementById("tools-grid");
    if (!grid) return;
    grid.innerHTML = TOOLS.map((t) => `
      <a class="tool-card" href="${t.href}" style="--card-accent:${t.accent}">
        ${t.tag ? `<span class="tool-tag">${t.tag}</span>` : ""}
        <div class="tool-icon" style="background:color-mix(in srgb, ${t.accent} 16%, transparent)">${t.icon}</div>
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
      }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" });
      cards.forEach((c, i) => {
        c.style.transitionDelay = (i % 8) * 0.04 + "s";
        io.observe(c);
      });
    } else {
      cards.forEach((c) => c.classList.add("visible"));
    }
  }

  function spawnPetals() {
    const box = document.getElementById("petals");
    if (!box || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#8bc48a", "#c4a060", "#a8d4a0", "#e8c878"];
    for (let i = 0; i < 16; i++) {
      const p = document.createElement("span");
      p.className = "petal";
      p.style.left = Math.random() * 100 + "%";
      p.style.animationDuration = 14 + Math.random() * 16 + "s";
      p.style.animationDelay = Math.random() * 14 + "s";
      const s = 5 + Math.random() * 8;
      p.style.width = s + "px";
      p.style.height = s + "px";
      p.style.background = colors[i % colors.length];
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
