(() => {
  "use strict";

  const root = document.documentElement;
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  function initRing() {
    const ring = $("#deityRing");
    const text = "もう始めてる・BARI REBECHI・パない神・";
    const letters = [...text].map((char, index, arr) => {
      const span = document.createElement("span");
      span.textContent = char;
      span.dataset.angle = String((360 / arr.length) * index);
      ring.appendChild(span);
      return span;
    });

    const positionLetters = () => {
      const radius = Math.min(255, Math.max(145, window.innerWidth * .39));
      letters.forEach(span => {
        span.style.transform = `rotate(${span.dataset.angle}deg) translateY(-${radius}px)`;
      });
    };

    positionLetters();
    window.addEventListener("resize", positionLetters, { passive: true });
  }

  function initSparks() {
    const field = $("#sparkField");
    const colors = ["#ff49d7", "#8dff3f", "#ffe44d", "#63f6ff", "#8b62ff"];
    for (let i = 0; i < 28; i += 1) {
      const spark = document.createElement("i");
      spark.className = "spark";
      spark.style.left = `${Math.random() * 100}%`;
      spark.style.bottom = `${-10 - Math.random() * 60}%`;
      spark.style.background = colors[i % colors.length];
      spark.style.color = colors[i % colors.length];
      spark.style.setProperty("--d", `${7 + Math.random() * 9}s`);
      spark.style.setProperty("--x", `${-80 + Math.random() * 160}px`);
      spark.style.animationDelay = `${-Math.random() * 12}s`;
      field.appendChild(spark);
    }
  }

  function initReveal() {
    const targets = $$(".js-reveal");
    if (!("IntersectionObserver" in window)) {
      targets.forEach(el => el.classList.add("is-inview"));
      return;
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-inview");
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -10% 0px" });
    targets.forEach(el => observer.observe(el));
  }

  function initMotionStop() {
    const button = $(".motion-stop");
    if (!button) return;
    button.addEventListener("click", () => {
      const isOff = root.classList.toggle("is-motion-off");
      button.textContent = isOff ? "アニメーションを再開" : "アニメーションを停止";
      button.setAttribute("aria-pressed", String(isOff));
      $$(".js-reveal").forEach(el => el.classList.add("is-inview"));
    });
  }

  function playChime() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const context = new AudioContext();
      const now = context.currentTime;
      [392, 523.25, 659.25, 783.99].forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = index % 2 ? "triangle" : "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(.12, now + .02 + index * .08);
        gain.gain.exponentialRampToValueAtTime(.001, now + 1.25 + index * .08);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now + index * .08);
        oscillator.stop(now + 1.4 + index * .08);
      });
      setTimeout(() => context.close(), 1900);
    } catch (error) {
      console.info("神楽音は端末都合により省略された。", error);
    }
  }

  function makeWishId() {
    const now = new Date();
    const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("");
    const random = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `BR-${date}-${random}`;
  }

  function initWishTerminal() {
    const form = $("#wishForm");
    const activation = $("#activation");
    const close = $("#activationClose");
    const idle = $("#oracleIdle");
    const active = $("#oracleActive");
    const status = $("#terminalStatus");
    const wishOut = $("#oracleWish");
    const idOut = $("#oracleId");
    const bar = $("#progressBar");
    const value = $("#progressValue");
    const label = $("#progressLabel");
    const log = $("#oracleLog");

    const labels = ["因果へ先回り中", "偶然を再配置中", "必要な縁へ通知中", "ためらいを追い越し中", "現実側の入口を確保中"];
    const logs = ["願いの輪郭を受信", "不要な遠回りを削除", "小さな好機を複数配置", "参拝者側の最初の一歩を確認", "神側の作業は既に進行中"];

    function updateProgress(percent) {
      bar.style.width = `${percent}%`;
      value.textContent = `${percent}%`;
      label.textContent = labels[Math.min(labels.length - 1, Math.floor(percent / 21))];
    }

    function showResult(data) {
      idle.hidden = true;
      active.hidden = false;
      status.textContent = "ALREADY STARTED";
      wishOut.textContent = `${data.name ? data.name + "：" : ""}${data.wish}`;
      idOut.textContent = `WISH ID: ${data.id}`;
      log.innerHTML = "";
      updateProgress(8);
      logs.forEach((message, index) => {
        setTimeout(() => {
          const line = document.createElement("span");
          line.textContent = message;
          log.appendChild(line);
          updateProgress([19, 38, 57, 76, 96][index]);
        }, 450 + index * 480);
      });
    }

    form.addEventListener("submit", event => {
      event.preventDefault();
      const data = {id: makeWishId(), name: $("#wishName").value.trim(), wish: $("#wishText").value.trim(), step: $("#firstStep").value.trim()};
      if (!data.wish || !data.step) return;
      sessionStorage.setItem("bari-rebechi-wish", JSON.stringify(data));
      activation.classList.add("is-open");
      document.body.style.overflow = "hidden";
      playChime();
      showResult(data);
    });

    close.addEventListener("click", () => {
      activation.classList.remove("is-open");
      document.body.style.overflow = "";
      $("#oracle").scrollIntoView({ behavior: root.classList.contains("is-motion-off") ? "auto" : "smooth" });
    });
    activation.addEventListener("click", event => { if (event.target === activation) close.click(); });
    document.addEventListener("keydown", event => { if (event.key === "Escape" && activation.classList.contains("is-open")) close.click(); });
    try {
      const saved = JSON.parse(sessionStorage.getItem("bari-rebechi-wish") || "null");
      if (saved?.wish) showResult(saved);
    } catch (error) { sessionStorage.removeItem("bari-rebechi-wish"); }
  }

  initRing();
  initSparks();
  initReveal();
  initMotionStop();
  initWishTerminal();
})();