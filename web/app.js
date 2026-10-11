/* Pixel Pet — offline care game. localStorage only. Kid-safe soft fails. */
(function () {
  "use strict";

  const STORAGE_KEY = "pixel-pet.state.v1";
  const DECAY_MS = 60 * 1000; // apply decay units per minute of real time
  const MAX_JOURNAL = 40;

  const FALLBACK = {
    version: 1,
    label: "EXAMPLE catalog",
    pets: [
      {
        id: "blippo",
        name: "Blippo",
        tagline: "A bouncy blueberry blob who loves snacks",
        palette: ["#3b82f6", "#93c5fd", "#1e3a8a", "#fef08a"],
        shape: "blob",
        favoriteFood: "berry-bites",
        baseStats: { hungerDecay: 0.35, energyDecay: 0.28, moodDecay: 0.22, cleanDecay: 0.18 },
      },
      {
        id: "sproutlet",
        name: "Sproutlet",
        tagline: "A leafy sprout who naps in sunbeams",
        palette: ["#22c55e", "#86efac", "#14532d", "#fde68a"],
        shape: "sprout",
        favoriteFood: "leaf-crisp",
        baseStats: { hungerDecay: 0.3, energyDecay: 0.32, moodDecay: 0.2, cleanDecay: 0.25 },
      },
      {
        id: "emberwick",
        name: "Emberwick",
        tagline: "A tiny ember fox who sparkles when happy",
        palette: ["#f97316", "#fdba74", "#7c2d12", "#fef3c7"],
        shape: "fox",
        favoriteFood: "crackle-crunch",
        baseStats: { hungerDecay: 0.38, energyDecay: 0.26, moodDecay: 0.24, cleanDecay: 0.2 },
      },
    ],
    hats: [
      { id: "none", name: "No hat", level: 1, emoji: "·", css: "" },
      { id: "beanie", name: "Cozy Beanie", level: 2, emoji: "🧢", css: "hat-beanie" },
      { id: "crown", name: "Paper Crown", level: 3, emoji: "👑", css: "hat-crown" },
      { id: "sprout-cap", name: "Sprout Cap", level: 4, emoji: "🌱", css: "hat-sprout" },
      { id: "star-band", name: "Star Band", level: 5, emoji: "⭐", css: "hat-star" },
      { id: "rainbow", name: "Rainbow Ribbon", level: 6, emoji: "🌈", css: "hat-rainbow" },
      { id: "wizard", name: "Wizard Cone", level: 8, emoji: "🪄", css: "hat-wizard" },
      { id: "astronaut", name: "Astro Cap", level: 10, emoji: "🚀", css: "hat-astro" },
    ],
    xpPerLevel: [0, 30, 70, 120, 180, 260, 360, 480, 620, 800],
    foods: [
      { id: "berry-bites", name: "Berry Bites", hunger: 28, mood: 6, emoji: "🫐", xp: 4 },
      { id: "leaf-crisp", name: "Leaf Crisp", hunger: 24, mood: 8, emoji: "🥬", xp: 4 },
      { id: "crackle-crunch", name: "Crackle Crunch", hunger: 30, mood: 5, emoji: "🍪", xp: 5 },
      { id: "rainbow-toast", name: "Rainbow Toast", hunger: 35, mood: 12, emoji: "🍞", xp: 8 },
      { id: "moon-milk", name: "Moon Milk", hunger: 18, energy: 10, mood: 10, emoji: "🥛", xp: 6 },
    ],
  };

  const DATA = Object.assign({}, FALLBACK, window.__PIXEL_PET__ || {});
  if (window.__PIXEL_PET__) {
    if (window.__PIXEL_PET__.pets) DATA.pets = window.__PIXEL_PET__.pets;
    if (window.__PIXEL_PET__.hats) DATA.hats = window.__PIXEL_PET__.hats;
    if (window.__PIXEL_PET__.xpPerLevel) DATA.xpPerLevel = window.__PIXEL_PET__.xpPerLevel;
    if (window.__PIXEL_PET__.foods) DATA.foods = window.__PIXEL_PET__.foods;
    else if (window.__PIXEL_PET__.items && window.__PIXEL_PET__.items.foods)
      DATA.foods = window.__PIXEL_PET__.items.foods;
  }

  /** @type {null | object} */
  let state = null;
  let animFrame = 0;
  let animTimer = null;
  let gameTimer = null;
  let gameRunning = false;
  let gameScore = 0;
  let gameLeft = 15;

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function now() {
    return Date.now();
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !s.petId) return null;
      return s;
    } catch (_) {
      return null;
    }
  }

  function saveState() {
    if (!state) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {}
  }

  function defaultMeters() {
    return { hunger: 88, energy: 90, mood: 92, clean: 95 };
  }

  function hatchPet(petId) {
    const pet = DATA.pets.find((p) => p.id === petId);
    if (!pet) return;
    state = {
      petId,
      name: pet.name,
      hatId: "none",
      xp: 0,
      level: 1,
      meters: defaultMeters(),
      lastTick: now(),
      hatchedAt: now(),
      totals: { feed: 0, play: 0, nap: 0, wash: 0, xp: 0 },
      journal: [
        {
          t: now(),
          text: "Hatched " + pet.name + "! Ready for snacks and play.",
        },
      ],
      sleepy: false,
    };
    saveState();
    showHatch(false);
    route();
    speak("Hi!");
    renderAll();
  }

  function petDef() {
    return DATA.pets.find((p) => p.id === state.petId) || DATA.pets[0];
  }

  function applyDecay() {
    if (!state) return;
    const elapsed = Math.max(0, now() - (state.lastTick || now()));
    const minutes = elapsed / DECAY_MS;
    if (minutes < 0.05) return;
    const d = petDef().baseStats;
    const m = state.meters;
    m.hunger = clamp(m.hunger - d.hungerDecay * minutes, 0, 100);
    m.energy = clamp(m.energy - d.energyDecay * minutes, 0, 100);
    m.mood = clamp(m.mood - d.moodDecay * minutes, 0, 100);
    m.clean = clamp(m.clean - d.cleanDecay * minutes, 0, 100);
    state.lastTick = now();
    // Soft fail: sleepy when average low — never death
    const avg = (m.hunger + m.energy + m.mood + m.clean) / 4;
    state.sleepy = avg < 28;
    if (state.sleepy && m.energy < 15) {
      m.mood = clamp(m.mood - 0.5, 5, 100); // soft floor at 5
    }
    // Soft floors — kid-friendly
    m.hunger = Math.max(5, m.hunger);
    m.energy = Math.max(5, m.energy);
    m.mood = Math.max(5, m.mood);
    m.clean = Math.max(5, m.clean);
    saveState();
  }

  function addXp(n) {
    state.xp += n;
    state.totals.xp += n;
    const thresholds = DATA.xpPerLevel;
    let lvl = 1;
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (state.xp >= thresholds[i]) {
        lvl = i + 1;
        break;
      }
    }
    if (lvl > state.level) {
      state.level = lvl;
      logJournal("Level up! Now level " + lvl + " 🎉");
      speak("Yay!");
    }
    saveState();
  }

  function logJournal(text) {
    state.journal.unshift({ t: now(), text });
    if (state.journal.length > MAX_JOURNAL) state.journal.length = MAX_JOURNAL;
  }

  function moodWord() {
    const m = state.meters;
    const avg = (m.hunger + m.energy + m.mood + m.clean) / 4;
    if (state.sleepy) return "sleepy";
    if (avg >= 80) return "sparkly";
    if (avg >= 60) return "happy";
    if (avg >= 40) return "okay";
    if (avg >= 25) return "tired";
    return "needs care";
  }

  /* —— Pixel drawing —— */
  function px(ctx, x, y, s, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * s, y * s, s, s);
  }

  function drawPet(canvas, shape, palette, frame, sleepy) {
    const ctx = canvas.getContext("2d");
    const s = 8;
    const W = canvas.width / s;
    const H = canvas.height / s;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const [c1, c2, c3, c4] = palette;
    const bob = sleepy ? 0 : (frame % 2 === 0 ? 0 : -1);

    function bodyBlob() {
      // round blob body
      const pts = [
        [6, 8], [7, 7], [8, 6], [9, 6], [10, 6], [11, 7], [12, 8],
        [13, 9], [13, 10], [13, 11], [13, 12], [12, 13], [11, 14],
        [10, 14], [9, 14], [8, 14], [7, 13], [6, 12], [5, 11], [5, 10], [5, 9],
      ];
      for (let y = 7 + bob; y <= 14 + bob; y++) {
        for (let x = 5; x <= 13; x++) {
          const cx = 9, cy = 10.5 + bob;
          const dx = x - cx, dy = y - cy;
          if (dx * dx * 0.7 + dy * dy * 1.1 < 22) px(ctx, x, y, s, c1);
        }
      }
      // highlight
      px(ctx, 7, 8 + bob, s, c2);
      px(ctx, 8, 8 + bob, s, c2);
      // eyes
      if (sleepy) {
        px(ctx, 7, 10 + bob, s, c3);
        px(ctx, 8, 10 + bob, s, c3);
        px(ctx, 10, 10 + bob, s, c3);
        px(ctx, 11, 10 + bob, s, c3);
      } else {
        px(ctx, 7, 10 + bob, s, c3);
        px(ctx, 8, 10 + bob, s, "#fff");
        px(ctx, 10, 10 + bob, s, c3);
        px(ctx, 11, 10 + bob, s, "#fff");
        // smile
        px(ctx, 8, 12 + bob, s, c3);
        px(ctx, 9, 12 + bob, s, c3);
        px(ctx, 10, 12 + bob, s, c3);
      }
      // cheeks
      px(ctx, 6, 11 + bob, s, c4);
      px(ctx, 12, 11 + bob, s, c4);
    }

    function bodySprout() {
      // stem
      for (let y = 10 + bob; y <= 15 + bob; y++) {
        px(ctx, 9, y, s, c3);
        px(ctx, 10, y, s, c1);
      }
      // pot-ish feet
      for (let x = 7; x <= 12; x++) px(ctx, x, 16 + bob, s, "#b45309");
      for (let x = 8; x <= 11; x++) px(ctx, x, 17 + bob, s, "#92400e");
      // leafy head
      for (let y = 5 + bob; y <= 10 + bob; y++) {
        for (let x = 5; x <= 14; x++) {
          const cx = 9.5, cy = 7.5 + bob;
          const dx = x - cx, dy = y - cy;
          if (dx * dx + dy * dy * 1.2 < 18) px(ctx, x, y, s, (x + y) % 3 === 0 ? c2 : c1);
        }
      }
      // leaf points
      px(ctx, 4, 7 + bob, s, c1);
      px(ctx, 3, 8 + bob, s, c2);
      px(ctx, 15, 7 + bob, s, c1);
      px(ctx, 16, 8 + bob, s, c2);
      // eyes
      if (sleepy) {
        px(ctx, 7, 8 + bob, s, c3);
        px(ctx, 8, 8 + bob, s, c3);
        px(ctx, 11, 8 + bob, s, c3);
        px(ctx, 12, 8 + bob, s, c3);
      } else {
        px(ctx, 7, 8 + bob, s, c3);
        px(ctx, 8, 8 + bob, s, "#fff");
        px(ctx, 11, 8 + bob, s, c3);
        px(ctx, 12, 8 + bob, s, "#fff");
        px(ctx, 9, 10 + bob, s, c3);
        px(ctx, 10, 10 + bob, s, c3);
      }
      px(ctx, 6, 9 + bob, s, c4);
      px(ctx, 13, 9 + bob, s, c4);
    }

    function bodyFox() {
      // body
      for (let y = 9 + bob; y <= 15 + bob; y++) {
        for (let x = 6; x <= 13; x++) {
          const cx = 9.5, cy = 12 + bob;
          if ((x - cx) * (x - cx) + (y - cy) * (y - cy) * 0.9 < 16) px(ctx, x, y, s, c1);
        }
      }
      // head
      for (let y = 5 + bob; y <= 10 + bob; y++) {
        for (let x = 6; x <= 13; x++) {
          const cx = 9.5, cy = 7.5 + bob;
          if ((x - cx) * (x - cx) * 0.9 + (y - cy) * (y - cy) < 14) px(ctx, x, y, s, c1);
        }
      }
      // ears
      px(ctx, 6, 4 + bob, s, c1);
      px(ctx, 7, 3 + bob, s, c1);
      px(ctx, 7, 4 + bob, s, c2);
      px(ctx, 12, 4 + bob, s, c1);
      px(ctx, 13, 3 + bob, s, c1);
      px(ctx, 12, 4 + bob, s, c2);
      // snout
      px(ctx, 9, 9 + bob, s, c2);
      px(ctx, 10, 9 + bob, s, c2);
      px(ctx, 9, 10 + bob, s, c3);
      // eyes
      if (sleepy) {
        px(ctx, 7, 7 + bob, s, c3);
        px(ctx, 8, 7 + bob, s, c3);
        px(ctx, 11, 7 + bob, s, c3);
        px(ctx, 12, 7 + bob, s, c3);
      } else {
        px(ctx, 7, 7 + bob, s, c3);
        px(ctx, 8, 7 + bob, s, "#fff");
        px(ctx, 11, 7 + bob, s, c3);
        px(ctx, 12, 7 + bob, s, "#fff");
      }
      // tail
      px(ctx, 14, 12 + bob, s, c1);
      px(ctx, 15, 11 + bob, s, c1);
      px(ctx, 16, 10 + bob, s, c2);
      px(ctx, 15, 10 + bob, s, c4);
      // feet
      px(ctx, 7, 16 + bob, s, c3);
      px(ctx, 8, 16 + bob, s, c3);
      px(ctx, 11, 16 + bob, s, c3);
      px(ctx, 12, 16 + bob, s, c3);
    }

    if (shape === "sprout") bodySprout();
    else if (shape === "fox") bodyFox();
    else bodyBlob();
  }

  function redrawPet() {
    if (!state) return;
    const pet = petDef();
    const canvas = document.getElementById("petCanvas");
    const closet = document.getElementById("closetCanvas");
    drawPet(canvas, pet.shape, pet.palette, animFrame, state.sleepy);
    if (closet) drawPet(closet, pet.shape, pet.palette, 0, false);
    const hat = DATA.hats.find((h) => h.id === state.hatId) || DATA.hats[0];
    const slot = document.getElementById("hatSlot");
    if (slot) slot.textContent = hat.id === "none" ? "" : hat.emoji;
  }

  function speak(msg) {
    const el = document.getElementById("speech");
    if (!el) return;
    el.hidden = false;
    el.textContent = msg;
    clearTimeout(speak._t);
    speak._t = setTimeout(() => {
      el.hidden = true;
    }, 1800);
  }

  function animateOnce(cls) {
    const wrap = document.getElementById("petWrap");
    if (!wrap) return;
    wrap.classList.remove("bounce", "sleep", "wash", "eat");
    void wrap.offsetWidth;
    wrap.classList.add(cls);
    setTimeout(() => wrap.classList.remove(cls), 700);
  }

  /* —— UI —— */
  function setMeter(key, val) {
    const fill = document.getElementById(
      "m" + key.charAt(0).toUpperCase() + key.slice(1)
    );
    const lab = document.getElementById(
      "v" + key.charAt(0).toUpperCase() + key.slice(1)
    );
    const v = Math.round(val);
    if (fill) {
      fill.style.width = v + "%";
      fill.classList.toggle("low", v < 30);
      fill.classList.toggle("warn", v >= 30 && v < 50);
    }
    if (lab) lab.textContent = String(v);
  }

  function renderMeters() {
    if (!state) return;
    const m = state.meters;
    setMeter("hunger", m.hunger);
    setMeter("energy", m.energy);
    setMeter("mood", m.mood);
    setMeter("clean", m.clean);
    document.getElementById("petName").textContent = state.name;
    document.getElementById("petMoodLabel").textContent = moodWord();
    document.getElementById("levelPill").textContent = "Lv " + state.level;
    document.getElementById("xpPill").textContent = state.xp + " XP";
    const banner = document.getElementById("softBanner");
    if (state.sleepy) {
      banner.hidden = false;
      document.getElementById("softBannerText").textContent =
        state.name + " is sleepy — a nap, wash, or snack will help!";
      document.getElementById("petWrap").classList.add("sleep");
    } else {
      banner.hidden = true;
      document.getElementById("petWrap").classList.remove("sleep");
    }
  }

  function renderFoods() {
    const row = document.getElementById("foodRow");
    row.innerHTML = "";
    DATA.foods.forEach((f) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "food-chip";
      b.innerHTML = f.emoji + " " + f.name;
      b.addEventListener("click", () => doFeed(f));
      row.appendChild(b);
    });
  }

  function renderHats() {
    const grid = document.getElementById("hatGrid");
    grid.innerHTML = "";
    const equipped = state ? state.hatId : "none";
    DATA.hats.forEach((h) => {
      const locked = !state || state.level < h.level;
      const b = document.createElement("button");
      b.type = "button";
      b.className =
        "hat-card" +
        (locked ? " locked" : "") +
        (equipped === h.id ? " equipped" : "");
      b.innerHTML =
        '<span class="he">' +
        (h.id === "none" ? "∅" : h.emoji) +
        '</span><div class="hn">' +
        h.name +
        '</div><div class="hl">' +
        (locked ? "Unlock Lv " + h.level : "Lv " + h.level) +
        "</div>";
      if (!locked) {
        b.addEventListener("click", () => {
          state.hatId = h.id;
          saveState();
          renderHats();
          redrawPet();
          document.getElementById("equippedHatName").textContent = h.name;
          speak(h.id === "none" ? "Fresh!" : "Cute!");
        });
      }
      grid.appendChild(b);
    });
    if (state) {
      const hat = DATA.hats.find((h) => h.id === state.hatId) || DATA.hats[0];
      document.getElementById("equippedHatName").textContent = hat.name;
      const thresholds = DATA.xpPerLevel;
      const cur = thresholds[state.level - 1] || 0;
      const next = thresholds[state.level] || cur + 100;
      const pct = clamp(((state.xp - cur) / Math.max(1, next - cur)) * 100, 0, 100);
      document.getElementById("xpFill").style.width = pct + "%";
      document.getElementById("xpProgressHint").textContent =
        state.level >= thresholds.length
          ? "Max level — all hats unlocked!"
          : state.xp + " / " + next + " XP to level " + (state.level + 1);
    }
  }

  function renderJournal() {
    if (!state) return;
    const stats = document.getElementById("journalStats");
    const t = state.totals;
    stats.innerHTML = [
      ["Feeds", t.feed],
      ["Plays", t.play],
      ["Naps", t.nap],
      ["Washes", t.wash],
      ["XP", t.xp],
      ["Level", state.level],
    ]
      .map(
        ([l, n]) =>
          '<div class="j-stat"><span class="n">' + n + '</span><span class="l">' + l + "</span></div>"
      )
      .join("");
    const list = document.getElementById("journalList");
    list.innerHTML = state.journal
      .map((j) => {
        const d = new Date(j.t);
        const when =
          d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
          " " +
          d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
        return (
          "<li><span>" +
          escapeHtml(j.text) +
          '</span><span class="when">' +
          when +
          "</span></li>"
        );
      })
      .join("");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderHatchGrid() {
    const grid = document.getElementById("hatchGrid");
    grid.innerHTML = "";
    DATA.pets.forEach((p) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "hatch-card";
      const c = document.createElement("canvas");
      c.width = 120;
      c.height = 120;
      drawPet(c, p.shape, p.palette, 0, false);
      card.appendChild(c);
      const h = document.createElement("h3");
      h.textContent = p.name;
      card.appendChild(h);
      const desc = document.createElement("p");
      desc.textContent = p.tagline;
      card.appendChild(desc);
      card.addEventListener("click", () => hatchPet(p.id));
      grid.appendChild(card);
    });
  }

  function showHatch(show) {
    const hatch = document.getElementById("view-hatch");
    const home = document.getElementById("view-home");
    if (show) {
      hatch.hidden = false;
      hatch.classList.add("active");
      document.querySelectorAll(".view:not(#view-hatch)").forEach((v) => {
        v.classList.remove("active");
        v.hidden = true;
      });
      renderHatchGrid();
    } else {
      hatch.hidden = true;
      hatch.classList.remove("active");
    }
  }

  function renderAll() {
    if (!state) {
      showHatch(true);
      return;
    }
    applyDecay();
    renderMeters();
    redrawPet();
    renderHats();
    renderJournal();
    updateDayNight();
  }

  /* —— Actions —— */
  function doFeed(food) {
    if (!state) return;
    const m = state.meters;
    const fav = petDef().favoriteFood === food.id ? 1.25 : 1;
    m.hunger = clamp(m.hunger + food.hunger * fav, 0, 100);
    m.mood = clamp(m.mood + (food.mood || 0) * fav, 0, 100);
    if (food.energy) m.energy = clamp(m.energy + food.energy, 0, 100);
    state.totals.feed++;
    addXp(Math.round(food.xp * fav));
    logJournal("Fed " + food.name + (fav > 1 ? " (favorite!)" : ""));
    document.getElementById("foodTray").hidden = true;
    animateOnce("eat");
    speak(fav > 1 ? "Yum!!" : "Nom");
    state.sleepy = false;
    saveState();
    renderAll();
  }

  function doNap() {
    if (!state) return;
    const m = state.meters;
    m.energy = clamp(m.energy + 35, 0, 100);
    m.mood = clamp(m.mood + 8, 0, 100);
    state.totals.nap++;
    addXp(5);
    logJournal("Took a cozy nap");
    animateOnce("sleep");
    speak("Zzz…");
    state.sleepy = false;
    saveState();
    renderAll();
  }

  function doWash() {
    if (!state) return;
    const m = state.meters;
    m.clean = clamp(m.clean + 40, 0, 100);
    m.mood = clamp(m.mood + 6, 0, 100);
    state.totals.wash++;
    addXp(5);
    logJournal("Sparkle wash!");
    animateOnce("wash");
    speak("Clean!");
    state.sleepy = false;
    saveState();
    renderAll();
  }

  function careBoost() {
    if (!state) return;
    const m = state.meters;
    m.hunger = clamp(m.hunger + 25, 0, 100);
    m.energy = clamp(m.energy + 25, 0, 100);
    m.mood = clamp(m.mood + 25, 0, 100);
    m.clean = clamp(m.clean + 25, 0, 100);
    state.sleepy = false;
    addXp(3);
    logJournal("Care boost — feeling better!");
    speak("Thanks!");
    animateOnce("bounce");
    saveState();
    renderAll();
  }

  /* —— Mini-game —— */
  function startGame() {
    if (!state || gameRunning) return;
    gameRunning = true;
    gameScore = 0;
    gameLeft = 15;
    document.getElementById("gameIdle").hidden = true;
    document.getElementById("btnStartGame").hidden = true;
    document.getElementById("btnStopGame").hidden = false;
    document.getElementById("gameScore").textContent = "Score 0";
    document.getElementById("gameTime").textContent = "15s";
    const arena = document.getElementById("gameArena");
    arena.querySelectorAll(".bubble").forEach((b) => b.remove());

    function spawn() {
      if (!gameRunning) return;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bubble";
      b.setAttribute("aria-label", "Pop bubble");
      const size = 36 + Math.random() * 28;
      b.style.width = size + "px";
      b.style.height = size + "px";
      b.style.left = 8 + Math.random() * 78 + "%";
      b.style.bottom = "8%";
      b.style.animationDuration = 1.6 + Math.random() * 1.2 + "s";
      b.addEventListener("click", (e) => {
        e.preventDefault();
        if (!gameRunning || b.classList.contains("pop")) return;
        b.classList.add("pop");
        gameScore += 1;
        document.getElementById("gameScore").textContent = "Score " + gameScore;
        setTimeout(() => b.remove(), 250);
      });
      arena.appendChild(b);
      setTimeout(() => {
        if (b.parentNode && !b.classList.contains("pop")) b.remove();
      }, 2400);
    }

    const spawner = setInterval(spawn, 480);
    spawn();
    gameTimer = setInterval(() => {
      gameLeft--;
      document.getElementById("gameTime").textContent = gameLeft + "s";
      if (gameLeft <= 0) {
        clearInterval(spawner);
        endGame();
      }
    }, 1000);
    startGame._spawner = spawner;
  }

  function endGame() {
    if (!gameRunning) return;
    gameRunning = false;
    clearInterval(gameTimer);
    if (startGame._spawner) clearInterval(startGame._spawner);
    document.getElementById("btnStartGame").hidden = false;
    document.getElementById("btnStopGame").hidden = true;
    document.getElementById("gameIdle").hidden = false;
    document.getElementById("gameIdle").textContent =
      "Nice! Score " + gameScore + " — mood + energy up.";
    if (state) {
      const m = state.meters;
      const bonus = Math.min(30, gameScore * 2);
      m.mood = clamp(m.mood + 10 + bonus * 0.4, 0, 100);
      m.energy = clamp(m.energy - 8 + Math.min(15, gameScore), 5, 100);
      m.hunger = clamp(m.hunger - 4, 5, 100);
      state.totals.play++;
      addXp(5 + gameScore);
      logJournal("Bubble Pop score " + gameScore);
      state.sleepy = false;
      animateOnce("bounce");
      speak(gameScore >= 10 ? "Wow!" : "Fun!");
      saveState();
      renderAll();
    }
  }

  /* —— Day / night —— */
  function updateDayNight() {
    const h = new Date().getHours();
    document.body.classList.remove("night", "eve");
    let mode = "day";
    if (h >= 20 || h < 6) {
      document.body.classList.add("night");
      mode = "night";
    } else if (h >= 17) {
      document.body.classList.add("eve");
      mode = "evening";
    }
    const clock = document.getElementById("clockLabel");
    if (clock) {
      clock.textContent =
        new Date().toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        }) +
        " · " +
        mode;
    }
  }

  /* —— Routing —— */
  function route() {
    const hash = (location.hash || "#home").replace("#", "") || "home";
    if (!state && hash !== "about") {
      showHatch(true);
      document.querySelectorAll(".tab").forEach((t) => {
        t.classList.toggle("active", t.dataset.view === "home");
        t.setAttribute("aria-selected", t.dataset.view === "home" ? "true" : "false");
      });
      return;
    }
    showHatch(false);
    const views = ["home", "closet", "game", "journal", "about"];
    const view = views.includes(hash) ? hash : "home";
    document.querySelectorAll(".view").forEach((v) => {
      if (v.id === "view-hatch") return;
      const on = v.id === "view-" + view;
      v.classList.toggle("active", on);
      v.hidden = !on;
    });
    document.querySelectorAll(".tab").forEach((t) => {
      const on = t.dataset.view === view;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    if (view === "closet") renderHats();
    if (view === "journal") renderJournal();
    if (view === "home") redrawPet();
  }

  function bind() {
    document.querySelectorAll(".tab").forEach((t) => {
      t.addEventListener("click", () => {
        location.hash = t.dataset.view;
      });
    });
    window.addEventListener("hashchange", route);

    document.getElementById("btnFeed").addEventListener("click", () => {
      document.getElementById("foodTray").hidden = false;
    });
    document.getElementById("btnCloseFood").addEventListener("click", () => {
      document.getElementById("foodTray").hidden = true;
    });
    document.getElementById("btnPlay").addEventListener("click", () => {
      location.hash = "game";
    });
    document.getElementById("btnNap").addEventListener("click", doNap);
    document.getElementById("btnWash").addEventListener("click", doWash);
    document.getElementById("btnRevive").addEventListener("click", careBoost);
    document.getElementById("btnStartGame").addEventListener("click", startGame);
    document.getElementById("btnStopGame").addEventListener("click", endGame);

    document.getElementById("btnResetPet").addEventListener("click", () => {
      if (!confirm("Reset pet and start over? This clears local save.")) return;
      localStorage.removeItem(STORAGE_KEY);
      state = null;
      location.hash = "home";
      showHatch(true);
      renderHatchGrid();
    });

    document.getElementById("btnExportSave").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(state || {}, null, 2)], {
        type: "application/json",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "pixel-pet-save.json";
      a.click();
      URL.revokeObjectURL(a.href);
    });

    renderFoods();
  }

  function tickAnim() {
    animFrame = (animFrame + 1) % 4;
    if (state) redrawPet();
  }

  function wantsDemo() {
    try {
      const q = new URLSearchParams(location.search);
      if (q.get("demo") === "1") return true;
      if ((location.hash || "").includes("demo")) return true;
    } catch (_) {}
    return false;
  }

  function demoState() {
    return {
      petId: "blippo",
      name: "Blippo",
      hatId: "crown",
      xp: 95,
      level: 3,
      meters: { hunger: 78, energy: 82, mood: 88, clean: 70 },
      lastTick: now(),
      hatchedAt: now() - 86400000,
      totals: { feed: 5, play: 3, nap: 2, wash: 2, xp: 95 },
      journal: [
        { t: now() - 3600000, text: "Fed Berry Bites (favorite!)" },
        { t: now() - 7200000, text: "Bubble Pop score 12" },
        { t: now() - 86400000, text: "Hatched Blippo! Ready for snacks and play." },
      ],
      sleepy: false,
    };
  }

  function init() {
    // Merge foods from embedded data if present as separate items blob
    if (window.__PIXEL_PET__ && window.__PIXEL_PET__.items) {
      const items = window.__PIXEL_PET__.items;
      if (items.foods) DATA.foods = items.foods;
    }
    bind();
    if (wantsDemo()) {
      state = demoState();
    } else {
      state = loadState();
    }
    if (state) applyDecay();
    renderAll();
    route();
    animTimer = setInterval(tickAnim, 500);
    setInterval(() => {
      if (state) {
        applyDecay();
        renderMeters();
        updateDayNight();
      }
    }, 15000);
    updateDayNight();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
