// Isthmus project-page animations.
// Left: time triangle (start r, end t). Right: one-step samples vs 64-step reference.
// Modes map to the paper: standard MeanFlow sampler (no pairs on t=1),
// a corner-point supervision island, and the isthmus along the landing edge.

(function () {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const CAPTIONS = {
    standard:
      "Standard training places pairs in the interior of the time triangle, but none on the landing edge t = 1. Targets from data travel along the diagonal and then left along rows of constant end time, so they never reach the one-step pair (0, 1). One-step samples lose spread and only partly follow the same network’s 64-step samples.",
    island:
      "Supervising the corner (0, 1) alone creates a supervision island: a set of pairs that the self-consistency identity does not connect to the diagonal. The objective no longer uniquely determines the one-step map, and the samples collapse toward the conditional mean.",
    isthmus:
      "An isthmus spends 5% of the training pairs along the whole landing edge (t = 1, r ∼ U(0, 1)), joining the one-step pair to the diagonal. The error of the one-step map is then bounded by the residual along this edge. Uncertainty and agreement with 64-step samples are restored; the network, the loss, and inference are unchanged.",
  };

  // IXI brain MRI (8×), one-step, numbers from the paper (Tables 1–2).
  const METRICS = {
    standard: { vb: "0.67", rho: "0.58", label: "MeanFlow, no extra pairs" },
    island: { vb: "0.26", rho: "0.74", label: "corner point (island)" },
    isthmus: { vb: "0.96", rho: "0.93", label: "isthmus (ours)" },
  };

  const MODES = ["standard", "island", "isthmus"];
  const HOLD_MS = { standard: 4800, island: 4800, isthmus: 6200 };

  const ns = "http://www.w3.org/2000/svg";

  function el(name, attrs, parent) {
    const node = document.createElementNS(ns, name);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    if (parent) parent.appendChild(node);
    return node;
  }

  function svgText(parent, x, y, text, attrs) {
    const t = el("text", Object.assign({ x: x, y: y }, attrs || {}), parent);
    t.textContent = text;
    return t;
  }

  // Deterministic 2-D hash → [0, 1)
  function rand(i, j) {
    const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  // Logit-normal-ish pairs in the upper triangle, none on t = 1.
  function basePairs(n) {
    const pts = [];
    let k = 0;
    let guard = 0;
    while (pts.length < n && guard < n * 20) {
      guard += 1;
      k += 1;
      // Approximate a logit-normal on (0, 1), then enforce r ≤ t and t ≤ 0.97.
      const u1 = rand(k, 1);
      const u2 = rand(k, 2);
      // Box–Muller
      const z1 = Math.sqrt(-2 * Math.log(Math.max(1e-6, u1))) * Math.cos(2 * Math.PI * u2);
      const z2 = Math.sqrt(-2 * Math.log(Math.max(1e-6, u1))) * Math.sin(2 * Math.PI * u2);
      const sig = 1 / (1 + Math.exp(-z1 * 0.85));
      const tau = 1 / (1 + Math.exp(-z2 * 0.85));
      const r = Math.min(sig, tau);
      const t = Math.max(sig, tau);
      if (t > 0.97) continue;
      if (t - r < 0.02 && rand(k, 3) < 0.4) continue;
      pts.push({ r: r, t: t });
    }
    return pts;
  }

  function isthmusPairs(n) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      pts.push({ r: (i + 0.5) / n, t: 1 });
    }
    return pts;
  }

  // ---------- Time triangle ----------
  function buildTriangle(svg) {
    const OX = 62;
    const OY = 318;
    const W = 248;
    const H = 248;

    function xy(r, t) {
      return [OX + r * W, OY - t * H];
    }

    // defs / markers
    const defs = el("defs", null, svg);
    function marker(id, colorVar) {
      const m = el(
        "marker",
        {
          id: id,
          viewBox: "0 0 8 8",
          refX: 7,
          refY: 4,
          markerWidth: "7",
          markerHeight: "7",
          orient: "auto",
        },
        defs
      );
      el("path", { d: "M0 1 L8 4 L0 7 Z", fill: colorVar }, m);
    }
    marker("isth-arrow-muted", "var(--isth-muted)");
    marker("isth-arrow-accent", "var(--isth-accent)");

    // Feasible region t ≥ r (upper triangle) + a faint source band near r = 0
    const region = el("g", { class: "region" }, svg);
    el(
      "polygon",
      {
        class: "region-base",
        points: [xy(0, 0), xy(1, 1), xy(0, 1)].map(function (p) {
          return p.join(",");
        }).join(" "),
      },
      region
    );

    // Axes
    el("line", { class: "axis", x1: xy(0, 0)[0], y1: xy(0, 0)[1], x2: xy(1, 0)[0], y2: xy(1, 0)[1] }, svg);
    el("line", { class: "axis", x1: xy(0, 0)[0], y1: xy(0, 0)[1], x2: xy(0, 1)[0], y2: xy(0, 1)[1] }, svg);
    el(
      "line",
      { class: "landing", x1: xy(0, 1)[0], y1: xy(0, 1)[1], x2: xy(1, 1)[0], y2: xy(1, 1)[1] },
      svg
    );
    el("line", { class: "diagonal", x1: xy(0, 0)[0], y1: xy(0, 0)[1], x2: xy(1, 1)[0], y2: xy(1, 1)[1] }, svg);

    svgText(svg, xy(0, 0)[0] - 6, xy(0, 0)[1] + 16, "0", { class: "tick", "text-anchor": "middle" });
    svgText(svg, xy(1, 0)[0], xy(0, 0)[1] + 16, "1", { class: "tick", "text-anchor": "middle" });
    svgText(svg, xy(0, 0)[0] - 12, xy(0, 0)[1] + 4, "0", { class: "tick", "text-anchor": "end" });
    svgText(svg, xy(0, 1)[0] - 12, xy(0, 1)[1] + 4, "1", { class: "tick", "text-anchor": "end" });
    svgText(svg, xy(0.5, 0)[0], xy(0, 0)[1] + 30, "start time  r  of a jump", {
      class: "label",
      "text-anchor": "middle",
    });
    svgText(svg, xy(0, 0.5)[0] - 34, xy(0, 0.5)[1], "end time  t", {
      class: "label",
      "text-anchor": "middle",
      transform: "rotate(-90 " + (xy(0, 0.5)[0] - 34) + " " + xy(0, 0.5)[1] + ")",
    });
    svgText(svg, xy(0, 0)[0], xy(0, 0)[1] + 42, "source", { class: "label", "text-anchor": "start" });
    svgText(svg, xy(1, 0)[0], xy(0, 0)[1] + 42, "data", { class: "label", "text-anchor": "end" });

    svgText(svg, 8, 18, "Time triangle of training pairs", { class: "title-svg" });
    const edgeLbl = svgText(svg, xy(0.62, 1)[0], xy(0, 1)[1] - 18, "landing edge  t = 1", {
      class: "label",
      "text-anchor": "middle",
      id: "isth-edge-label",
    });

    // Flow arrows along a few rows (targets travel left in r at fixed t)
    const arrowG = el("g", { class: "arrows" }, svg);
    const rows = [0.35, 0.55, 0.75];
    rows.forEach(function (t) {
      const a = xy(t, t);
      const b = xy(0.12, t);
      el(
        "line",
        { class: "flow-arrow row-flow", x1: a[0] - 8, y1: a[1], x2: b[0], y2: b[1] },
        arrowG
      );
    });
    const a1 = xy(0.92, 1);
    const a2 = xy(0.18, 1);
    const landY = a1[1] - 10;
    const landArrow = el("g", { class: "land-flow", opacity: "0" }, arrowG);
    el(
      "line",
      {
        class: "flow-arrow isthmus",
        x1: a1[0],
        y1: landY,
        x2: a2[0] + 8,
        y2: landY,
      },
      landArrow
    );
    el(
      "polygon",
      {
        class: "pair-isthmus",
        points: (a2[0] + 8) + "," + (landY - 4) + " " + a2[0] + "," + landY + " " + (a2[0] + 8) + "," + (landY + 4),
      },
      landArrow
    );

    // Base pairs
    const baseG = el("g", { class: "pairs-base" }, svg);
    const bases = basePairs(70);
    bases.forEach(function (p) {
      const c = xy(p.r, p.t);
      el("circle", { class: "pair-base", cx: c[0], cy: c[1], r: 2.3 }, baseG);
    });

    // Isthmus pairs along t = 1
    const isthG = el("g", { class: "pairs-isthmus", opacity: "0" }, svg);
    isthmusPairs(14).forEach(function (p) {
      const c = xy(p.r, p.t);
      el("circle", { class: "pair-isthmus", cx: c[0], cy: c[1], r: 3.1 }, isthG);
    });

    // Island: a small square at the corner (0, 1)
    const islandG = el("g", { class: "pairs-island", opacity: "0" }, svg);
    const ic = xy(0, 1);
    el(
      "rect",
      {
        class: "pair-island",
        x: ic[0] - 6,
        y: ic[1] - 6,
        width: 12,
        height: 12,
        rx: 1.5,
      },
      islandG
    );

    // Corner highlight
    const corner = el(
      "circle",
      {
        class: "corner-mark",
        cx: ic[0],
        cy: ic[1],
        r: 12,
        opacity: "0.9",
      },
      svg
    );

    const cornerLbl = svgText(svg, ic[0] + 20, ic[1] + 22, "one-step pair  (0, 1)", {
      class: "label",
      "text-anchor": "start",
    });

    const diagLbl = svgText(svg, xy(0.72, 0.72)[0] + 10, xy(0.72, 0.72)[1] + 16, "diagonal  r = t", {
      class: "label",
      "text-anchor": "start",
      transform: "rotate(-45 " + (xy(0.72, 0.72)[0] + 10) + " " + (xy(0.72, 0.72)[1] + 16) + ")",
    });

    // Moving tokens that travel left along rows (and along the isthmus)
    const tokenG = el("g", { class: "tokens" }, svg);
    const tokens = [];
    rows.forEach(function (t, i) {
      const tok = el("circle", { r: 2.6, fill: "var(--isth-muted)", opacity: "0.0" }, tokenG);
      tokens.push({ el: tok, t: t, phase: i / rows.length, kind: "row" });
    });
    const landTok = el("circle", { r: 3.2, fill: "var(--isth-accent)", opacity: "0.0" }, tokenG);
    tokens.push({ el: landTok, t: 1, phase: 0, kind: "land" });

    return {
      xy: xy,
      islandG: islandG,
      isthG: isthG,
      landArrow: landArrow,
      corner: corner,
      edgeLbl: edgeLbl,
      cornerLbl: cornerLbl,
      tokens: tokens,
      diagLbl: diagLbl,
    };
  }

  // ---------- Sample spread (ring = uncertainty) ----------
  function ringPoints(n, cx, cy, rx, ry, jitter, seed) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.15;
      const jx = (rand(seed, i) - 0.5) * jitter;
      const jy = (rand(seed, i + 17) - 0.5) * jitter;
      pts.push({ x: cx + Math.cos(a) * rx + jx, y: cy + Math.sin(a) * ry + jy });
    }
    return pts;
  }

  function meanPoint(pts) {
    let x = 0,
      y = 0;
    pts.forEach(function (p) {
      x += p.x;
      y += p.y;
    });
    return { x: x / pts.length, y: y / pts.length };
  }

  function mix(a, b, s) {
    return { x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s };
  }

  function buildSamples(svg) {
    const N = 18;
    const srcOrigin = { x: 46, y: 175 };
    const dataOrigin = { x: 230, y: 175 };

    svgText(svg, 8, 18, "One-step jump  vs  64-step reference", { class: "title-svg" });
    svgText(svg, srcOrigin.x, 44, "source", { class: "label", "text-anchor": "middle" });
    svgText(svg, dataOrigin.x, 44, "data", { class: "label", "text-anchor": "middle" });

    // Reference ring (64-step)
    const ref = ringPoints(N, dataOrigin.x, dataOrigin.y, 72, 52, 10, 3);
    const mu = meanPoint(ref);

    // Source cloud
    const src = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      src.push({
        x: srcOrigin.x + Math.cos(a) * 16 + (rand(9, i) - 0.5) * 8,
        y: srcOrigin.y + Math.sin(a) * 16 + (rand(11, i) - 0.5) * 8,
      });
    }

    src.forEach(function (p) {
      el("circle", { class: "src-dot", cx: p.x, cy: p.y, r: 2.4 }, svg);
    });

    // faint mean marker in data space
    el("circle", { cx: mu.x, cy: mu.y, r: 2, fill: "var(--isth-muted)", opacity: "0.45" }, svg);
    svgText(svg, mu.x + 6, mu.y - 8, "mean", { class: "label", "text-anchor": "start", "font-size": "9" });

    const refG = el("g", null, svg);
    ref.forEach(function (p) {
      el("circle", { class: "sample-ref", cx: p.x, cy: p.y, r: 5.2 }, refG);
    });

    const landings = {
      // Standard: shrunk + slightly decorrelated (ρ ≈ 0.58, under-dispersed)
      standard: ref.map(function (p, i) {
        const shrunk = mix(mu, p, 0.62);
        const ang = rand(20, i) * Math.PI * 2;
        const d = 10 + rand(21, i) * 10;
        return { x: shrunk.x + Math.cos(ang) * d * 0.35, y: shrunk.y + Math.sin(ang) * d * 0.35 };
      }),
      // Island: collapse toward the conditional mean (V/B = 0.26)
      island: ref.map(function (p, i) {
        const shrunk = mix(mu, p, 0.18);
        const ang = rand(30, i) * Math.PI * 2;
        const d = 3 + rand(31, i) * 4;
        return { x: shrunk.x + Math.cos(ang) * d, y: shrunk.y + Math.sin(ang) * d };
      }),
      // Isthmus: nearly matches the 64-step ring (ρ = 0.93, V/B = 0.96)
      isthmus: ref.map(function (p, i) {
        const shrunk = mix(mu, p, 0.97);
        const ang = rand(40, i) * Math.PI * 2;
        return { x: shrunk.x + Math.cos(ang) * 2.2, y: shrunk.y + Math.sin(ang) * 2.2 };
      }),
    };

    const oneG = el("g", null, svg);
    const dots = src.map(function (p) {
      return el("circle", { class: "sample-one", cx: p.x, cy: p.y, r: 3.6 }, oneG);
    });

    // Legend
    const ly = 318;
    el("circle", { class: "sample-ref", cx: 20, cy: ly, r: 5 }, svg);
    svgText(svg, 30, ly + 3.5, "64-step reference", { class: "label", "text-anchor": "start" });
    el("circle", { class: "sample-one", cx: 160, cy: ly, r: 3.6, id: "isth-leg-one" }, svg);
    svgText(svg, 170, ly + 3.5, "one-step samples", { class: "label", "text-anchor": "start" });

    return {
      src: src,
      landings: landings,
      dots: dots,
      legendOne: svg.getElementById("isth-leg-one"),
    };
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function setModeVisual(tri, samp, mode) {
    const isIsth = mode === "isthmus";
    const isIsland = mode === "island";

    tri.islandG.setAttribute("opacity", isIsland ? "1" : "0");
    tri.isthG.setAttribute("opacity", isIsth ? "1" : "0");
    tri.landArrow.setAttribute("opacity", isIsth ? "1" : "0");
    tri.corner.setAttribute("class", "corner-mark" + (isIsth ? " bridged" : ""));
    tri.edgeLbl.textContent = isIsth
      ? "isthmus along the landing edge"
      : isIsland
        ? "island: corner only, cut off from the diagonal"
        : "landing edge  t = 1  —  no training pairs";

    const cls = "sample-one" + (isIsland ? " island" : isIsth ? "" : " standard");
    samp.dots.forEach(function (d) {
      d.setAttribute("class", cls);
    });
    if (samp.legendOne) samp.legendOne.setAttribute("class", cls);
  }

  function start() {
    const root = document.getElementById("isthmus-stage");
    if (!root) return;

    const cap = document.getElementById("isthmus-caption");
    const metricVB = document.getElementById("isthmus-metric-vb");
    const metricRho = document.getElementById("isthmus-metric-rho");
    const metricLabel = document.getElementById("isthmus-metric-label");
    const buttons = Array.prototype.slice.call(root.querySelectorAll("[data-isthmus-mode]"));

    const triSvg = document.getElementById("isthmus-triangle");
    const sampSvg = document.getElementById("isthmus-samples");
    if (!triSvg || !sampSvg) return;

    const tri = buildTriangle(triSvg);
    const samp = buildSamples(sampSvg);

    let mode = reduceMotion ? "isthmus" : "standard";
    let autoplay = !reduceMotion;
    let holdUntil = 0;
    let anim = null; // {from, to, start, dur, mode}
    let lastTs = 0;
    let visible = true;
    let tokenClock = 0;

    function setCaption(m) {
      if (cap) cap.textContent = CAPTIONS[m];
      const met = METRICS[m];
      if (metricVB) metricVB.textContent = met.vb;
      if (metricRho) metricRho.textContent = met.rho;
      if (metricLabel) metricLabel.textContent = met.label;
      buttons.forEach(function (b) {
        const on = b.getAttribute("data-isthmus-mode") === m;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }

    function placeDots(m, t) {
      const dest = samp.landings[m];
      const src = samp.src;
      const e = easeInOut(Math.max(0, Math.min(1, t)));
      samp.dots.forEach(function (d, i) {
        d.setAttribute("cx", lerp(src[i].x, dest[i].x, e));
        d.setAttribute("cy", lerp(src[i].y, dest[i].y, e));
      });
    }

    function go(next, user) {
      if (user) autoplay = false;
      mode = next;
      setCaption(mode);
      setModeVisual(tri, samp, mode);
      if (reduceMotion) {
        placeDots(mode, 1);
        return;
      }
      anim = { start: performance.now(), dur: 1100, mode: mode };
      holdUntil = performance.now() + 1100 + (HOLD_MS[mode] || 5000);
    }

    buttons.forEach(function (b) {
      b.addEventListener("click", function () {
        go(b.getAttribute("data-isthmus-mode"), true);
      });
    });

    setCaption(mode);
    setModeVisual(tri, samp, mode);
    if (reduceMotion) {
      placeDots(mode, 1);
    } else {
      placeDots(mode, 0);
      anim = { start: performance.now(), dur: 1100, mode: mode };
      holdUntil = performance.now() + 1100 + HOLD_MS[mode];
    }

    function tickTokens(ts) {
      tokenClock = ts;
      tri.tokens.forEach(function (tok) {
        if (tok.kind === "land" && mode !== "isthmus") {
          tok.el.setAttribute("opacity", "0");
          return;
        }
        const period = tok.kind === "land" ? 2200 : 2600;
        const u = ((ts / period + tok.phase) % 1);
        // travel from near the diagonal (r = t) to small r
        const r0 = tok.kind === "land" ? 0.96 : tok.t;
        const r1 = 0.08;
        const r = r0 + (r1 - r0) * u;
        const p = tri.xy(r, tok.t);
        const yOff = tok.kind === "land" ? -10 : 0;
        tok.el.setAttribute("cx", p[0]);
        tok.el.setAttribute("cy", p[1] + yOff);
        // fade at the ends
        const fade = u < 0.08 ? u / 0.08 : u > 0.92 ? (1 - u) / 0.08 : 1;
        tok.el.setAttribute("opacity", String(0.95 * fade));
      });
    }

    function frame(ts) {
      if (!visible) {
        lastTs = ts;
        requestAnimationFrame(frame);
        return;
      }
      if (anim) {
        const u = (ts - anim.start) / anim.dur;
        placeDots(anim.mode, u);
        if (u >= 1) {
          placeDots(anim.mode, 1);
          anim = null;
        }
      }
      if (!reduceMotion) tickTokens(ts);
      if (autoplay && !reduceMotion && !anim && ts >= holdUntil) {
        const idx = MODES.indexOf(mode);
        go(MODES[(idx + 1) % MODES.length], false);
      }
      lastTs = ts;
      requestAnimationFrame(frame);
    }

    if (!reduceMotion) requestAnimationFrame(frame);

    if (typeof IntersectionObserver !== "undefined") {
      const io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (e) {
            if (e.target === root) visible = e.isIntersecting;
          });
        },
        { threshold: 0.15 }
      );
      io.observe(root);
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) visible = false;
      else visible = true;
    });
  }

  function reveal() {
    const nodes = document.querySelectorAll(".isthmus-reveal");
    if (!nodes.length) return;
    if (reduceMotion || typeof IntersectionObserver === "undefined") {
      nodes.forEach(function (n) {
        n.classList.add("is-visible");
      });
      return;
    }
    const io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    nodes.forEach(function (n) {
      io.observe(n);
    });
  }

  function bibCopy() {
    const btn = document.getElementById("isthmus-copy-bib");
    const block = document.getElementById("isthmus-bibtex-text");
    if (!btn || !block) return;
    btn.addEventListener("click", function () {
      const text = block.innerText || block.textContent;
      const done = function () {
        const prev = btn.textContent;
        btn.textContent = "Copied";
        setTimeout(function () {
          btn.textContent = prev;
        }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () {
          window.prompt("Copy BibTeX", text);
        });
      } else {
        window.prompt("Copy BibTeX", text);
      }
    });
  }

  function init() {
    start();
    reveal();
    bibCopy();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
