/* Research map — force-directed, with a quiet sense of play. */
(() => {
  const app = document.getElementById("rmap-app");
  if (!app) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobileMq = window.matchMedia("(max-width: 719px)");

  const stage = document.getElementById("rmap-stage");
  const svgEl = document.getElementById("rmap-svg");
  const canvas = document.getElementById("rmap-particles");
  const ctx = canvas ? canvas.getContext("2d") : null;
  const cardEl = document.getElementById("rmap-card");
  const narrateEl = document.getElementById("rmap-narrate");
  const counterEl = document.getElementById("rmap-counter");
  const tipEl = document.getElementById("rmap-tip");
  const helpEl = document.getElementById("rmap-help");
  const searchForm = app.querySelector(".rmap-search");
  const searchInput = document.getElementById("rmap-q");
  const hitsEl = document.getElementById("rmap-hits");
  const pathBtn = document.getElementById("rmap-path");
  const playBtn = document.getElementById("rmap-play");
  const yearInput = document.getElementById("rmap-year");
  const yearLabel = document.getElementById("rmap-year-label");
  const mobileEl = document.getElementById("rmap-mobile");

  let data = null;
  let nodes = [];
  let links = [];
  let nodeById = new Map();
  let adj = new Map();
  let sim = null;
  let zoom = null;
  let svg = null;
  let gRoot = null;
  let gWorld = null;
  let gLinks = null;
  let gLinkHits = null;
  let gNodes = null;
  let width = 0;
  let height = 0;
  let monthMax = 0;
  let monthIndex = 0;
  let months = [];
  let hover = null;
  let selected = null;
  let clusterFocus = null;
  let pathMode = false;
  let pathPicks = [];
  let pathNodeSet = new Set();
  let pathLinkSet = new Set();
  let pathNarration = [];
  let playing = false;
  let playTimer = null;
  let particles = [];
  let theme = "#1857a4";
  let ink = "#1b1f24";
  let transform = null;
  let entrance = reduced ? 1 : 0;
  let entered = reduced;
  let lastTick = performance.now();
  let readyResolve = null;
  const ready = new Promise((r) => {
    readyResolve = r;
  });

  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function ymOf(p) {
    return (p.year || 0) * 12 + (p.month || 12);
  }

  function formatYM(year, month) {
    const name = MONTH_NAMES[Math.max(1, Math.min(12, month || 12)) - 1];
    return `${name} ${year}`;
  }

  function formatPaperDate(p) {
    return formatYM(p.year, p.month || 12);
  }

  function buildMonths() {
    const seen = new Map();
    (data.papers || []).forEach((p) => {
      const ym = ymOf(p);
      if (!seen.has(ym)) seen.set(ym, { year: p.year, month: p.month || 12, ym, label: formatPaperDate(p) });
    });
    months = [...seen.values()].sort((a, b) => a.ym - b.ym);
    monthIndex = Math.max(0, months.length - 1);
    monthMax = months.length ? months[monthIndex].ym : 0;
    if (yearInput) {
      yearInput.min = "0";
      yearInput.max = String(Math.max(0, months.length - 1));
      yearInput.step = "1";
      yearInput.value = String(monthIndex);
      yearInput.setAttribute("aria-label", "Show papers up to month");
    }
    if (yearLabel && months.length) yearLabel.textContent = months[monthIndex].label;
  }

  function cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function refreshTheme() {
    theme = cssVar("--global-theme-color", "#1857a4");
    ink = cssVar("--global-text-color", "#1b1f24");
  }

  function hashHue(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) >>> 0;
    return (h % 1000) / 1000;
  }

  function waitForD3() {
    return new Promise((resolve) => {
      const go = () => (window.d3 ? resolve(window.d3) : requestAnimationFrame(go));
      go();
    });
  }

  function isAlive(n) {
    if (!n) return false;
    if (n.type === "paper") return ymOf(n) <= monthMax;
    if (n.type === "keyword") {
      return n.papers.some((p) => nodeById.get(p) && ymOf(nodeById.get(p)) <= monthMax);
    }
    if (n.type === "area") {
      const fromKw = (n.keywords || []).some((k) => isAlive(nodeById.get(k)));
      const fromPapers = (n.papers || []).some((pid) => isAlive(nodeById.get(pid)));
      return fromKw || fromPapers;
    }
    return true;
  }

  function linkId(a, b) {
    return a < b ? `${a}~~${b}` : `${b}~~${a}`;
  }

  function addAdj(a, b, meta) {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a).push({ id: b, ...meta });
  }

  function buildGraph() {
    nodes = [];
    links = [];
    nodeById = new Map();
    adj = new Map();

    data.areas.forEach((a, i) => {
      const n = {
        ...a,
        type: "area",
        r: 44,
        index0: i,
        keywords: data.keywords.filter((k) => k.area === a.id).map((k) => k.id),
        papers: [],
      };
      nodes.push(n);
    });

    data.keywords.forEach((k) => {
      const papers = data.edges.paper_keyword.filter((e) => e.target === k.id).map((e) => e.source);
      const n = { ...k, type: "keyword", r: 4, papers };
      nodes.push(n);
    });

    data.papers.forEach((p) => {
      const n = { ...p, type: "paper", r: 22 };
      nodes.push(n);
    });

    nodes.forEach((n) => nodeById.set(n.id, n));

    data.areas.forEach((a) => {
      const area = nodeById.get(a.id);
      const fromKw = (area.keywords || []).flatMap((kid) => (nodeById.get(kid) && nodeById.get(kid).papers) || []);
      const fromPapers = data.papers.filter((p) => (p.areas || []).includes(a.id)).map((p) => p.id);
      area.papers = [...new Set([...fromKw, ...fromPapers])];
    });

    const pushLink = (source, target, kind, strength, shared) => {
      const s = typeof source === "string" ? source : source.id;
      const t = typeof target === "string" ? target : target.id;
      const rec = { source: s, target: t, kind, strength: strength || 1, shared: shared || [], id: linkId(s, t) };
      links.push(rec);
      addAdj(s, t, { kind, strength: rec.strength, shared: rec.shared, link: rec.id });
      addAdj(t, s, { kind, strength: rec.strength, shared: rec.shared, link: rec.id });
    };

    data.edges.keyword_area.forEach((e) => pushLink(e.source, e.target, "ka", 1));
    data.edges.paper_keyword.forEach((e) => pushLink(e.source, e.target, "pk", 1));
    (data.edges.paper_area || []).forEach((e) => pushLink(e.source, e.target, "pa", 1));
    data.edges.paper_paper.forEach((e) => {
      if (e.strength >= 1) pushLink(e.source, e.target, "pp", e.strength, e.shared);
    });

    placeSeeds();
  }

  function placeSeeds() {
    // Positions are set by computeLayout once the stage size is known.
    nodes.forEach((n) => {
      n.x = n.x || 0;
      n.y = n.y || 0;
      n.homeX = n.x;
      n.homeY = n.y;
      n.showLabel = n.type !== "keyword" ? true : true;
      n.labelX = 0;
      n.labelY = n.type === "paper" ? n.r + 14 : 0;
      n.labelAnchor = "middle";
    });
  }

  function measureText(text, font) {
    if (!measureText.ctx) measureText.ctx = document.createElement("canvas").getContext("2d");
    measureText.ctx.font = font;
    return measureText.ctx.measureText(text || "").width;
  }

  const FONT_AREA = '600 12.5px "Source Serif 4", "Source Serif Pro", Georgia, serif';
  const FONT_KW = "500 10.5px Inter, system-ui, sans-serif";
  const FONT_PAPER = "500 10px Inter, system-ui, sans-serif";
  const BOX_GAP = 8;

  function keywordSize(d) {
    const tw = measureText(d.label, FONT_KW);
    return { w: tw + 16, h: 18 };
  }

  function paperLabelSize(d) {
    const tw = measureText(d.short, FONT_PAPER);
    return { w: tw + 6, h: 13 };
  }

  function reservedRects() {
    return [
      // legend
      { x1: -width / 2 + 8, y1: height / 2 - 156, x2: -width / 2 + 208, y2: height / 2 - 8, id: "legend" },
      // year counter band
      { x1: -130, y1: -height / 2 + 4, x2: 130, y2: -height / 2 + 56, id: "counter" },
    ];
  }

  function clampToStage(n, r) {
    const xMax = width / 2 - 28 - r;
    const yMax = height / 2 - 28 - r;
    const yMin = -height / 2 + 58 + r;
    n.x = Math.max(-xMax, Math.min(xMax, n.x));
    n.y = Math.max(yMin, Math.min(yMax, n.y));
  }

  function paperLabelSlots(d) {
    const sz = paperLabelSize(d);
    const r = d.r;
    return [
      { labelX: 0, labelY: r + 14, anchor: "middle", w: sz.w, h: sz.h },
      { labelX: 0, labelY: -(r + 10), anchor: "middle", w: sz.w, h: sz.h },
      { labelX: r + 8, labelY: 4, anchor: "start", w: sz.w, h: sz.h },
      { labelX: -(r + 8), labelY: 4, anchor: "end", w: sz.w, h: sz.h },
    ];
  }

  function labelBoxForSlot(d, slot) {
    let x1;
    if (slot.anchor === "middle") x1 = d.x + slot.labelX - slot.w / 2;
    else if (slot.anchor === "start") x1 = d.x + slot.labelX;
    else x1 = d.x + slot.labelX - slot.w;
    const y1 = d.y + slot.labelY - slot.h / 2 - 1;
    return { x1, y1, x2: x1 + slot.w, y2: y1 + slot.h };
  }

  function inflate(b, p) {
    return { x1: b.x1 - p, y1: b.y1 - p, x2: b.x2 + p, y2: b.y2 + p };
  }

  function rectsOverlap(a, b, pad) {
    const p = pad || 0;
    return !(a.x2 + p <= b.x1 || b.x2 + p <= a.x1 || a.y2 + p <= b.y1 || b.y2 + p <= a.y1);
  }

  function circleRectOverlap(cx, cy, r, b, pad) {
    const p = pad || 0;
    const qx = Math.max(b.x1, Math.min(cx, b.x2));
    const qy = Math.max(b.y1, Math.min(cy, b.y2));
    const dx = cx - qx;
    const dy = cy - qy;
    return dx * dx + dy * dy < (r + p) * (r + p);
  }

  function collectBoxes(opts) {
    const includeHiddenKw = opts && opts.includeHiddenKw;
    const items = [];
    for (const n of nodes) {
      if (!isAlive(n)) continue;
      if (n.type === "area") {
        items.push({ id: n.id, kind: "circle", role: "body", node: n, x: n.x, y: n.y, r: n.r });
      } else if (n.type === "paper") {
        items.push({ id: n.id, kind: "circle", role: "body", node: n, x: n.x, y: n.y, r: n.r });
        const slot = { labelX: n.labelX, labelY: n.labelY, anchor: n.labelAnchor, ...paperLabelSize(n) };
        const b = labelBoxForSlot(n, slot);
        items.push({ id: n.id + ":label", kind: "rect", role: "label", node: n, ...b });
      } else if (n.type === "keyword") {
        if (n.showLabel || includeHiddenKw) {
          const sz = keywordSize(n);
          items.push({
            id: n.id,
            kind: "rect",
            role: "label",
            node: n,
            x1: n.x - sz.w / 2,
            y1: n.y - sz.h / 2,
            x2: n.x + sz.w / 2,
            y2: n.y + sz.h / 2,
          });
        } else {
          items.push({ id: n.id, kind: "circle", role: "dot", node: n, x: n.x, y: n.y, r: 3.5 });
        }
      }
    }
    return items;
  }

  function itemHits(a, b, pad) {
    if (a.node === b.node && (a.role === "body" || b.role === "body") && (a.role === "label" || b.role === "label")) {
      // A paper's own label may sit close to its thumbnail, but must not cover it.
      pad = Math.max(pad || 0, 2);
    } else if (a.node === b.node) {
      return false;
    }
    if (a.kind === "circle" && b.kind === "circle") {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const min = a.r + b.r + (pad || 0);
      return dx * dx + dy * dy < min * min - 0.01;
    }
    if (a.kind === "rect" && b.kind === "rect") return rectsOverlap(a, b, pad);
    const c = a.kind === "circle" ? a : b;
    const r = a.kind === "rect" ? a : b;
    return circleRectOverlap(c.x, c.y, c.r, r, pad);
  }

  function hitsReserved(box) {
    for (const r of reservedRects()) {
      if (box.kind === "circle") {
        if (circleRectOverlap(box.x, box.y, box.r, r, BOX_GAP)) return true;
      } else if (rectsOverlap(box, r, BOX_GAP)) return true;
    }
    // stage bounds
    const m = 22;
    const stage = { x1: -width / 2 + m, y1: -height / 2 + 56, x2: width / 2 - m, y2: height / 2 - m };
    if (box.kind === "circle") {
      if (box.x - box.r < stage.x1 || box.x + box.r > stage.x2 || box.y - box.r < stage.y1 || box.y + box.r > stage.y2) return true;
    } else {
      if (box.x1 < stage.x1 || box.x2 > stage.x2 || box.y1 < stage.y1 || box.y2 > stage.y2) return true;
    }
    return false;
  }

  function boxOverlapScore(box, others, pad) {
    let s = hitsReserved(box) ? 25 : 0;
    for (const o of others) {
      if (itemHits(box, o, pad)) s += 1;
    }
    return s;
  }

  function keywordCandidateBox(n, x, y) {
    const sz = keywordSize(n);
    return {
      id: n.id,
      kind: "rect",
      role: "label",
      node: n,
      x1: x - sz.w / 2,
      y1: y - sz.h / 2,
      x2: x + sz.w / 2,
      y2: y + sz.h / 2,
    };
  }


  function lineRectTs(x1, y1, x2, y2, b, pad) {
    const minX = b.x1 - (pad || 0);
    const maxX = b.x2 + (pad || 0);
    const minY = b.y1 - (pad || 0);
    const maxY = b.y2 + (pad || 0);
    const dx = x2 - x1;
    const dy = y2 - y1;
    let t0 = 0;
    let t1 = 1;
    const clip = (p, q) => {
      if (Math.abs(p) < 1e-9) return q >= 0;
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
      return true;
    };
    if (!clip(-dx, x1 - minX)) return null;
    if (!clip(dx, maxX - x1)) return null;
    if (!clip(-dy, y1 - minY)) return null;
    if (!clip(dy, maxY - y1)) return null;
    if (t1 < t0) return null;
    return [t0, t1];
  }

  function segmentHitsRect(x1, y1, x2, y2, b, pad) {
    return !!lineRectTs(x1, y1, x2, y2, b, pad);
  }

  function clippedLinkPath(x1, y1, x2, y2, rects, pad) {
    const hits = [];
    for (const r of rects) {
      const ts = lineRectTs(x1, y1, x2, y2, r, pad);
      if (ts) hits.push(ts);
    }
    if (!hits.length) return `M${x1},${y1}L${x2},${y2}`;
    hits.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const h of hits) {
      if (!merged.length || h[0] > merged[merged.length - 1][1]) merged.push([h[0], h[1]]);
      else merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], h[1]);
    }
    let path = "";
    let t = 0;
    const pt = (tt) => [x1 + (x2 - x1) * tt, y1 + (y2 - y1) * tt];
    for (const [a, b] of merged) {
      if (a - t > 0.03) {
        const p = pt(t);
        const q = pt(a);
        path += `M${p[0]},${p[1]}L${q[0]},${q[1]}`;
      }
      t = b;
    }
    if (1 - t > 0.03) {
      const p = pt(t);
      const q = pt(1);
      path += `M${p[0]},${p[1]}L${q[0]},${q[1]}`;
    }
    return path || `M${x1},${y1}L${x2},${y2}`;
  }

  function edgeCrossCount(box, exceptNode) {
    let c = 0;
    for (const l of links) {
      if (l.kind === "pp" && l.strength < 2) continue;
      const a = typeof l.source === "object" ? l.source : nodeById.get(l.source);
      const b = typeof l.target === "object" ? l.target : nodeById.get(l.target);
      if (!a || !b || !isAlive(a) || !isAlive(b)) continue;
      if (exceptNode && (a === exceptNode || b === exceptNode)) continue;
      if (segmentHitsRect(a.x, a.y, b.x, b.y, box, 3)) c += 1;
    }
    return c;
  }

  function worldLabelRects(coord) {
    const rects = [];
    for (const n of nodes) {
      if (!isAlive(n)) continue;
      const x = coord ? coord(n).x : n.x;
      const y = coord ? coord(n).y : n.y;
      if (n.type === "keyword" && n.showLabel) {
        const sz = keywordSize(n);
        rects.push({ x1: x - sz.w / 2, y1: y - sz.h / 2, x2: x + sz.w / 2, y2: y + sz.h / 2 });
      } else if (n.type === "paper") {
        const slot = { labelX: n.labelX, labelY: n.labelY, anchor: n.labelAnchor, ...paperLabelSize(n) };
        const fake = { x, y };
        rects.push(labelBoxForSlot(fake, slot));
      }
    }
    return rects;
  }

  function computeLayout() {
    if (!width || !height || !nodes.length) return;
    const hx = width / 2 - 88;
    const hy = height / 2 - 88;

    const areaPos = {
      "area-opt": { fx: -0.62, fy: -0.42 },
      "area-medai": { fx: 0.14, fy: -0.42 },
      "area-agentic": { fx: 0.66, fy: 0.02 },
      "area-uncertainty": { fx: 0.16, fy: 0.50 },
      "area-bioinfo": { fx: -0.64, fy: 0.22 },
    };
    const layoutScale = Math.min(width / 1000, height / 780, 1);

    const areas = nodes.filter((n) => n.type === "area");
    areas.forEach((n) => {
      const p = areaPos[n.id] || { fx: 0, fy: 0 };
      n.x = p.fx * hx;
      n.y = p.fy * hy;
      n.r = Math.round(42 + 8 * Math.max(0.7, layoutScale));
      clampToStage(n, n.r);
      n.homeX = n.x;
      n.homeY = n.y;
    });

    // Papers: around the primary area, biased outward, evenly spaced.
    const papersByArea = {};
    nodes
      .filter((n) => n.type === "paper")
      .forEach((n) => {
        const aid = (n.areas && n.areas[0]) || "area-medai";
        (papersByArea[aid] || (papersByArea[aid] = [])).push(n);
      });

    Object.entries(papersByArea).forEach(([aid, papers]) => {
      const area = nodeById.get(aid);
      if (!area) return;
      const out = Math.atan2(area.y, area.x);
      const n = papers.length;
      const spread = n === 1 ? 0 : Math.min(2.45, 0.9 + n * 0.42);
      const s = Math.max(0.72, layoutScale);
      const dist = (n === 1 ? 128 : n === 2 ? 138 : 154) * s;
      papers.forEach((p, i) => {
        const t = n === 1 ? 0 : (i / (n - 1) - 0.5) * spread;
        const ang = out + t;
        p.x = area.x + Math.cos(ang) * dist;
        p.y = area.y + Math.sin(ang) * dist;
        p.r = 22;
        clampToStage(p, p.r + 16);
        p.labelX = 0;
        p.labelY = p.r + 14;
        p.labelAnchor = "middle";
      });
    });

    // Keywords: sit beside the home-area cluster, not at a cross-graph centroid.
    const keywords = nodes.filter((n) => n.type === "keyword");
    keywords.forEach((k) => {
      const papers = (k.papers || []).map((id) => nodeById.get(id)).filter(Boolean);
      const area = nodeById.get(k.area);
      const local = papers.filter((p) => (p.areas && p.areas[0]) === k.area);
      const group = local.length ? local : papers;
      let cx, cy;
      if (group.length) {
        cx = group.reduce((s, p) => s + p.x, 0) / group.length;
        cy = group.reduce((s, p) => s + p.y, 0) / group.length;
      } else if (area) {
        cx = area.x;
        cy = area.y;
      } else {
        cx = 0;
        cy = 0;
      }
      if (area) {
        let dx = cx - area.x;
        let dy = cy - area.y;
        let d = Math.hypot(dx, dy);
        if (d < 8) {
          const ang = Math.atan2(area.y, area.x) + (hashHue(k.id) - 0.5) * 1.8;
          dx = Math.cos(ang);
          dy = Math.sin(ang);
          d = 1;
        }
        const min = area.r + 52;
        if (d < min) {
          cx = area.x + (dx / d) * min;
          cy = area.y + (dy / d) * min;
        }
      }
      areas.forEach((a) => {
        const dx = cx - a.x;
        const dy = cy - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const min = a.r + 40;
        if (d < min) {
          cx = a.x + (dx / d) * min;
          cy = a.y + (dy / d) * min;
        }
      });
      k.x = cx;
      k.y = cy;
      k.showLabel = true;
    });

    // Choose paper label slots, then keyword slots, then iterate.
    function currentOthers(exceptId) {
      return collectBoxes({ includeHiddenKw: false }).filter((b) => b.id !== exceptId && b.id !== exceptId + ":label");
    }

    nodes
      .filter((n) => n.type === "paper")
      .forEach((p) => {
        const slots = paperLabelSlots(p);
        let best = slots[0];
        let bestS = Infinity;
        const others = currentOthers(p.id);
        // Temporarily ignore this paper's label.
        const rest = others.filter((o) => o.node !== p || o.role === "body");
        for (const slot of slots) {
          const box = { id: p.id + ":label", kind: "rect", role: "label", node: p, ...labelBoxForSlot(p, slot) };
          // Don't test against own body with huge pad; use 2px.
          const s = boxOverlapScore(box, rest, BOX_GAP);
          if (s < bestS) {
            bestS = s;
            best = slot;
            if (s === 0) break;
          }
        }
        p.labelX = best.labelX;
        p.labelY = best.labelY;
        p.labelAnchor = best.anchor;
      });

    const radii = [0, 28, 44, 64, 86, 110, 136, 164];
    const dirs = 16;
    keywords.forEach((k) => {
      const sz = keywordSize(k);
      let best = { x: k.x, y: k.y, s: Infinity };
      const others = collectBoxes({ includeHiddenKw: false }).filter((b) => b.node !== k);
      for (const rad of radii) {
        const count = rad === 0 ? 1 : dirs;
        for (let i = 0; i < count; i++) {
          const ang = (i / count) * Math.PI * 2 + (hashHue(k.id) - 0.5) * 0.25;
          const x = k.x + Math.cos(ang) * rad;
          const y = k.y + Math.sin(ang) * rad;
          const box = keywordCandidateBox(k, x, y);
          const overlap = boxOverlapScore(box, others, BOX_GAP);
          const crossings = edgeCrossCount(box, k);
          const s = overlap * 12 + crossings;
          if (s < best.s) best = { x, y, s, overlap, crossings };
        }
      }
      k.x = best.x;
      k.y = best.y;
      clampToStage(k, Math.max(sz.w, sz.h) / 2);
      k.showLabel = true;
      k._edgeCross = best.crossings || 0;
    });

    // Iterative separation: move keywords first, then papers slightly; areas stay put.
    for (let iter = 0; iter < 280; iter++) {
      const boxes = collectBoxes({ includeHiddenKw: false });
      let moved = 0;
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const A = boxes[i];
          const B = boxes[j];
          if (!itemHits(A, B, BOX_GAP)) continue;
          const ca = A.kind === "circle" ? { x: A.x, y: A.y } : { x: (A.x1 + A.x2) / 2, y: (A.y1 + A.y2) / 2 };
          const cb = B.kind === "circle" ? { x: B.x, y: B.y } : { x: (B.x1 + B.x2) / 2, y: (B.y1 + B.y2) / 2 };
          let dx = ca.x - cb.x;
          let dy = ca.y - cb.y;
          let d = Math.hypot(dx, dy);
          if (d < 1e-3) {
            dx = 0.6;
            dy = 0.4;
            d = 1;
          }
          const ux = dx / d;
          const uy = dy / d;
          const weight = (box) => {
            const t = box.node.type;
            if (t === "area") return 0;
            if (t === "paper" && box.role === "body") return 0.25;
            if (t === "paper") return 0.4;
            return 1; // keywords
          };
          const wa = weight(A);
          const wb = weight(B);
          const tot = wa + wb;
          if (tot === 0) continue;
          const step = 2.4;
          if (wa > 0) {
            A.node.x += ux * step * (wa / tot);
            A.node.y += uy * step * (wa / tot);
            moved += wa;
          }
          if (wb > 0) {
            B.node.x -= ux * step * (wb / tot);
            B.node.y -= uy * step * (wb / tot);
            moved += wb;
          }
        }
      }
      // Push anything sitting in reserved regions.
      nodes.forEach((n) => {
        if (n.type === "area" || !isAlive(n)) return;
        const r = n.type === "paper" ? n.r + 8 : n.type === "keyword" ? keywordSize(n).w / 2 : 20;
        clampToStage(n, r);
        reservedRects().forEach((zone) => {
          const box =
            n.type === "paper"
              ? { kind: "circle", x: n.x, y: n.y, r: n.r }
              : keywordCandidateBox(n, n.x, n.y);
          if ((box.kind === "circle" && circleRectOverlap(box.x, box.y, box.r, zone, BOX_GAP)) || (box.kind === "rect" && rectsOverlap(box, zone, BOX_GAP))) {
            n.y -= 8;
            n.x += n.x < 0 ? -4 : 4;
            moved += 1;
          }
        });
      });
      // Re-pick paper label slots after bodies moved.
      if (iter % 8 === 7) {
        nodes
          .filter((n) => n.type === "paper")
          .forEach((p) => {
            const others = collectBoxes({ includeHiddenKw: false }).filter((o) => o.node !== p || o.role === "body");
            let best = null;
            let bestS = Infinity;
            for (const slot of paperLabelSlots(p)) {
              const box = { id: p.id + ":label", kind: "rect", role: "label", node: p, ...labelBoxForSlot(p, slot) };
              const s = boxOverlapScore(box, others, BOX_GAP);
              if (s < bestS) {
                bestS = s;
                best = slot;
              }
            }
            if (best) {
              p.labelX = best.labelX;
              p.labelY = best.labelY;
              p.labelAnchor = best.anchor;
            }
          });
      }
      if (moved < 0.15) break;
    }

    // Hide keyword labels that still collide, or that sit on a busy edge corridor.
    keywords.forEach((k) => {
      const others = collectBoxes({ includeHiddenKw: false }).filter((b) => b.node !== k);
      const box = keywordCandidateBox(k, k.x, k.y);
      const s = boxOverlapScore(box, others, BOX_GAP - 2);
      const crossings = edgeCrossCount(box, k);
      k._edgeCross = crossings;
      if (s > 0 || crossings >= 5) k.showLabel = false;
      else k.showLabel = true;
    });

    nodes.forEach((n) => {
      n.homeX = n.x;
      n.homeY = n.y;
      n.vx = 0;
      n.vy = 0;
    });
  }

  function overlapsReport() {
    const boxes = collectBoxes({ includeHiddenKw: false });
    const hits = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        if (itemHits(boxes[i], boxes[j], 0.5)) {
          hits.push([boxes[i].id, boxes[j].id]);
        }
      }
      if (hitsReserved(boxes[i])) hits.push([boxes[i].id, "reserved"]);
    }
    return hits;
  }

  function boxesForCheck() {
    // Stage-pixel axis-aligned boxes of visible labels and nodes, after the world transform (no zoom assumed at identity).
    const t = transform || { x: 0, y: 0, k: 1 };
    const toStage = (x, y) => ({ x: t.k * (x + width / 2) + t.x, y: t.k * (y + height / 2) + t.y });
    const out = [];
    collectBoxes({ includeHiddenKw: false }).forEach((b) => {
      if (b.kind === "circle") {
        const p = toStage(b.x, b.y);
        const r = b.r * t.k;
        out.push({
          id: b.id,
          type: b.node.type,
          role: b.role,
          text: b.node.short || b.node.label || "",
          x: p.x - r,
          y: p.y - r,
          w: r * 2,
          h: r * 2,
          circle: true,
          cx: p.x,
          cy: p.y,
          r,
        });
      } else {
        const p1 = toStage(b.x1, b.y1);
        const p2 = toStage(b.x2, b.y2);
        out.push({
          id: b.id,
          type: b.node.type,
          role: b.role,
          text: b.node.short || b.node.label || "",
          x: Math.min(p1.x, p2.x),
          y: Math.min(p1.y, p2.y),
          w: Math.abs(p2.x - p1.x),
          h: Math.abs(p2.y - p1.y),
        });
      }
    });
    return out;
  }

  function visibleLinks() {
    return links.filter((l) => {
      const a = typeof l.source === "object" ? l.source : nodeById.get(l.source);
      const b = typeof l.target === "object" ? l.target : nodeById.get(l.target);
      if (!isAlive(a) || !isAlive(b)) return false;
      if (l.kind === "pp" && l.strength < 2) return false;
      return true;
    });
  }

  function homeForce(alpha) {
    const k = 0.2 * alpha;
    for (const n of nodes) {
      if (!isAlive(n)) {
        n.vx = 0;
        n.vy = 0;
        n.x = n.homeX;
        n.y = n.homeY;
        continue;
      }
      if (n.fx != null) continue;
      n.vx += (n.homeX - n.x) * k;
      n.vy += (n.homeY - n.y) * k;
    }
  }

  function startSim() {
    const d3 = window.d3;
    computeLayout();
    sim = d3
      .forceSimulation(nodes)
      .force("home", homeForce)
      .velocityDecay(0.28)
      .alphaDecay(0.05)
      .alpha(0);
    sim.on("tick", ticked);
  }

  function sizeStage() {
    const rect = stage.getBoundingClientRect();
    width = Math.max(320, Math.floor(rect.width));
    height = Math.max(400, Math.floor(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    svgEl.setAttribute("width", width);
    svgEl.setAttribute("height", height);
    svgEl.removeAttribute("viewBox");
    if (gWorld) gWorld.attr("transform", `translate(${width / 2},${height / 2})`);
    if (canvas) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function setupSvg() {
    const d3 = window.d3;
    svg = d3.select(svgEl);
    svg.selectAll("*").remove();
    const defs = svg.append("defs");

    const glow = defs.append("filter").attr("id", "rmap-glow").attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%");
    glow.append("feGaussianBlur").attr("stdDeviation", "3.5").attr("result", "blur");
    const merge = glow.append("feMerge");
    merge.append("feMergeNode").attr("in", "blur");
    merge.append("feMergeNode").attr("in", "SourceGraphic");

    data.papers.forEach((p) => {
      const pat = defs
        .append("pattern")
        .attr("id", `rmap-thumb-${p.id}`)
        .attr("width", 1)
        .attr("height", 1)
        .attr("patternContentUnits", "objectBoundingBox");
      pat
        .append("image")
        .attr("href", p.preview)
        .attr("width", 1)
        .attr("height", 1)
        .attr("preserveAspectRatio", "xMidYMid slice");
    });

    gRoot = svg.append("g").attr("class", "rmap-zoom");
    gWorld = gRoot.append("g").attr("class", "rmap-world").attr("transform", `translate(${width / 2},${height / 2})`);
    gLinks = gWorld.append("g").attr("class", "links");
    gLinkHits = gWorld.append("g").attr("class", "link-hits");
    gNodes = gWorld.append("g").attr("class", "nodes");

    zoom = d3
      .zoom()
      .scaleExtent([0.45, 3.2])
      .on("zoom", (event) => {
        transform = event.transform;
        gRoot.attr("transform", transform);
      });
    svg.call(zoom);
    svg.on("dblclick.zoom", null);
    transform = d3.zoomIdentity;
    svg.call(zoom.transform, transform);

    svg.on("click", (event) => {
      if (event.target === svgEl) {
        clearSelection();
      }
    });

    const drag = d3
      .drag()
      .filter((event) => !event.button)
      .on("start", (event, d) => {
        if (reduced) return;
        d.wasDragged = false;
        d._px = event.x;
        d._py = event.y;
        if (!event.active) sim.alphaTarget(0.18).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        const dx = event.x - d._px;
        const dy = event.y - d._py;
        if (Math.hypot(dx, dy) > 3) d.wasDragged = true;
        d.fx = event.x;
        d.fy = event.y;
        d.vx = event.x - (d._lx ?? event.x);
        d.vy = event.y - (d._ly ?? event.y);
        d._lx = event.x;
        d._ly = event.y;
      })
      .on("end", (event, d) => {
        d.fx = null;
        d.fy = null;
        d._lx = d._ly = undefined;
        if (!event.active) sim.alphaTarget(0);
        if (d.wasDragged) {
          sim.alpha(Math.min(0.35, 0.12 + Math.hypot(d.vx || 0, d.vy || 0) * 0.04)).restart();
        }
      });

    const nodeSel = gNodes
      .selectAll("g.node")
      .data(nodes, (d) => d.id)
      .join((enter) => {
        const g = enter.append("g").attr("class", (d) => `node node-${d.type}`).attr("data-id", (d) => d.id);
        g.append("circle").attr("class", "glow");
        g.append("rect").attr("class", "pill");
        g.append("circle").attr("class", "dot");
        g.append("circle").attr("class", "body");
        g.append("circle").attr("class", "ring");
        g.append("text").attr("class", "label");
        return g;
      });

    nodeSel.call(drag);

    nodeSel
      .on("pointerenter", (event, d) => {
        if (d.wasDragged) return;
        setHover(d);
        showTipForNode(event, d);
      })
      .on("pointerleave", (event, d) => {
        if (hover && hover.id === d.id) setHover(null);
        hideTip();
      })
      .on("click", (event, d) => {
        event.stopPropagation();
        if (d.wasDragged) {
          d.wasDragged = false;
          return;
        }
        onNodeClick(d);
      });

    drawStaticAttributes();
    bindLinks();
  }

  function bindLinks() {
    const vis = visibleLinks();
    const line = gLinks.selectAll("path.link").data(vis, (d) => d.id);
    line.join(
      (enter) =>
        enter
          .append("path")
          .attr("class", (d) => `link link-${d.kind}`)
          .attr("fill", "none")
          .attr("stroke-linecap", "round"),
      (update) => update,
      (exit) => exit.remove()
    );

    const hits = gLinkHits.selectAll("path.link-hit").data(
      vis.filter((d) => d.kind === "pp"),
      (d) => d.id
    );
    hits.join(
      (enter) =>
        enter
          .append("path")
          .attr("class", "link-hit")
          .attr("fill", "none")
          .attr("stroke", "transparent")
          .attr("stroke-width", 18)
          .on("pointerenter", (event, d) => {
            setHover({ type: "edge", link: d });
            showTipForEdge(event, d);
          })
          .on("pointerleave", () => {
            setHover(null);
            hideTip();
          }),
      (update) => update,
      (exit) => exit.remove()
    );
  }


  function splitAreaLabel(text) {
    if (!text) return [""];
    if (text.length <= 14) return [text];
    if (text.includes(" & ")) {
      const [a, b] = text.split(" & ");
      return [a.trim(), "& " + b.trim()];
    }
    const words = text.split(" ");
    if (words.length === 1) return [text];
    let best = 1;
    let bestDiff = Infinity;
    for (let i = 1; i < words.length; i++) {
      const d = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length);
      if (d < bestDiff) {
        best = i;
        bestDiff = d;
      }
    }
    return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
  }

  function drawStaticAttributes() {
    gNodes.selectAll("g.node").each(function (d) {
      const g = window.d3.select(this);
      const body = g.select("circle.body");
      const ring = g.select("circle.ring");
      const glow = g.select("circle.glow");
      const label = g.select("text.label");

      glow.attr("r", d.r + (d.type === "area" ? 10 : 6)).attr("fill", theme).attr("opacity", 0);
      ring.attr("fill", "none");
      if (d.type !== "keyword") g.select("rect.pill").attr("width", 0).attr("height", 0).attr("stroke", "none");

      if (d.type === "area") {
        body.attr("r", d.r).attr("fill", "var(--rmap-area-fill, transparent)");
        ring.attr("r", d.r).attr("stroke-width", 1.5);
        label
          .attr("text-anchor", "middle")
          .attr("font-family", "Source Serif 4, Source Serif Pro, Georgia, serif")
          .attr("font-size", 12.5)
          .attr("font-weight", 600);
        const lines = splitAreaLabel(d.label);
        label.text(null);
        lines.forEach((line, i) => {
          label
            .append("tspan")
            .attr("x", 0)
            .attr("dy", i === 0 ? (lines.length === 1 ? "0.35em" : `${-0.55 * (lines.length - 1)}em`) : "1.2em")
            .text(line);
        });
      } else if (d.type === "keyword") {
        body.attr("r", 0);
        ring.attr("r", 0);
        g.select("rect.pill")
          .attr("rx", 8)
          .attr("ry", 8)
          .attr("fill", colorMix(theme, 0.12))
          .attr("stroke", colorMix(theme, 0.45))
          .attr("stroke-width", 1);
        g.select("circle.dot").attr("r", 3.5).attr("fill", theme).attr("opacity", 0);
        label
          .attr("text-anchor", "middle")
          .attr("dy", "0.32em")
          .attr("font-family", "Inter, sans-serif")
          .attr("font-size", 10.5)
          .attr("font-weight", 500)
          .text(d.label);
      } else {
        body.attr("r", d.r).attr("fill", `url(#rmap-thumb-${d.id})`);
        ring.attr("r", d.r).attr("stroke-width", 2);
        label
          .attr("text-anchor", d.labelAnchor || "middle")
          .attr("x", d.labelX || 0)
          .attr("y", d.labelY || d.r + 14)
          .attr("dy", "0.35em")
          .attr("font-family", "Inter, sans-serif")
          .attr("font-size", 10)
          .attr("font-weight", 500)
          .attr("paint-order", "stroke")
          .attr("stroke-width", 5)
          .attr("stroke-linejoin", "round")
          .text(d.short);
        g.select("circle.dot").attr("r", 0);
      }
    });
  }

  function endpoints(d) {
    const a = typeof d.source === "object" ? d.source : nodeById.get(d.source);
    const b = typeof d.target === "object" ? d.target : nodeById.get(d.target);
    return [a, b];
  }

  function visualPos(d, now) {
    const u = entranceEase(entrance);
    const ph = hashHue(d.id) * Math.PI * 2;
    const s = !reduced && d.type === "area" && isAlive(d) ? 1 + 0.012 * Math.sin(now / 1800 + ph) : 1;
    return { x: d.x * u, y: d.y * u, s };
  }

  function entranceEase(t) {
    const x = Math.max(0, Math.min(1, t));
    return 1 - Math.pow(1 - x, 3);
  }

  function neighborhood(id) {
    const set = new Set([id]);
    (adj.get(id) || []).forEach((n) => {
      if (n.kind === "pp" && n.strength < 2) return;
      set.add(n.id);
    });
    return set;
  }

  function highlightSet() {
    if (pathNodeSet.size) return pathNodeSet;
    if (hover && hover.type === "edge") {
      const [a, b] = endpoints(hover.link);
      return new Set([a.id, b.id]);
    }
    const id = (hover && hover.id) || (selected && selected.id) || clusterFocus;
    if (id) return neighborhood(id);
    return null;
  }

  function linkHighlighted(d, hi) {
    if (pathLinkSet.size) return pathLinkSet.has(d.id);
    if (!hi) return true;
    const [a, b] = endpoints(d);
    return hi.has(a.id) && hi.has(b.id);
  }

  function ticked() {
    const now = performance.now();
    paint(now);
  }

  function paint(now) {
    if (!gNodes) return;
    const hi = highlightSet();
    const u = entranceEase(entrance);

    gNodes.selectAll("g.node").each(function (d) {
      const el = window.d3.select(this);
      const alive = isAlive(d);
      const pos = visualPos(d, now);
      const on = !hi || hi.has(d.id);
      const dim = alive && on ? 1 : alive ? 0.14 : 0;
      el.attr("transform", `translate(${pos.x},${pos.y}) scale(${pos.s})`);
      el.attr("opacity", dim * (d.type === "paper" || d.type === "area" ? u : Math.max(0, (u - 0.18) / 0.82)));
      el.attr("pointer-events", alive && u > 0.2 ? "auto" : "none");

      const glow = el.select("circle.glow");
      const ring = el.select("circle.ring");
      const body = el.select("circle.body");
      const label = el.select("text.label");

      const emphasis = (selected && selected.id === d.id) || (hover && hover.id === d.id) || pathNodeSet.has(d.id);
      glow.attr("fill", theme).attr("opacity", emphasis ? 0.28 : 0);
      if (d.type === "area") {
        body.attr("fill", colorMix(theme, 0.16)).attr("stroke", "none");
        ring.attr("stroke", theme).attr("stroke-opacity", emphasis ? 0.95 : 0.7);
        label.attr("fill", ink);
      } else if (d.type === "keyword") {
        const show = d.showLabel || on;
        const tw = (label.node() && label.node().getComputedTextLength()) || d.label.length * 6.2;
        el.select("rect.pill")
          .attr("x", -tw / 2 - 8)
          .attr("y", -9)
          .attr("width", show ? tw + 16 : 0)
          .attr("height", show ? 18 : 0)
          .attr("fill", cssVar("--global-card-bg-color", "#fff"))
          .attr("stroke", theme)
          .attr("stroke-opacity", show ? (emphasis ? 0.95 : 0.55) : 0);
        label.attr("fill", theme).attr("opacity", show ? 1 : 0);
        el.select("circle.dot")
          .attr("r", show ? 0 : 3.5)
          .attr("fill", theme)
          .attr("opacity", show ? 0 : dim > 0 ? 0.7 : 0);
      } else {
        ring.attr("stroke", theme).attr("stroke-opacity", emphasis ? 1 : 0.85);
        label
          .attr("fill", ink)
          .attr("stroke", cssVar("--global-card-bg-color", "#fff"))
          .attr("x", d.labelX || 0)
          .attr("y", d.labelY || d.r + 14)
          .attr("text-anchor", d.labelAnchor || "middle");
      }
      if (emphasis) el.attr("filter", "url(#rmap-glow)");
      else el.attr("filter", null);
    });

    const dashIn = reduced ? 1 : Math.max(0, Math.min(1, (u - 0.42) / 0.58));
    const paintLabelRects = worldLabelRects((n) => visualPos(n, now));

    gLinks.selectAll("path.link").each(function (d) {
      const [a, b] = endpoints(d);
      const pa = visualPos(a, now);
      const pb = visualPos(b, now);
      const straight = `M${pa.x},${pa.y}L${pb.x},${pb.y}`;
      const el = window.d3.select(this);
      const len = Math.hypot(pb.x - pa.x, pb.y - pa.y);
      const path = dashIn < 1 ? straight : clippedLinkPath(pa.x, pa.y, pb.x, pb.y, paintLabelRects, 2);
      const on = linkHighlighted(d, hi);
      const isPath = pathLinkSet.has(d.id);
      let stroke = theme;
      let w = 1;
      let op = 0.28;
      if (d.kind === "pp") {
        w = d.strength >= 3 ? 2.4 : 1.6;
        op = 0.55;
      } else if (d.kind === "ka") {
        w = 1.15;
        op = 0.32;
      } else if (d.kind === "pa") {
        w = 1.05;
        op = 0.22;
      } else {
        w = 1;
        op = 0.28;
      }
      if (hi && !on) op *= 0.12;
      if (isPath) {
        w = Math.max(w, 2.6);
        op = 0.95;
      }
      el.attr("d", path)
        .attr("stroke", stroke)
        .attr("stroke-width", w)
        .attr("stroke-opacity", op * dashIn);
      if (!reduced && dashIn < 1) {
        el.attr("stroke-dasharray", `${len}`).attr("stroke-dashoffset", len * (1 - dashIn));
      } else if (isPath && !reduced) {
        el.attr("stroke-dasharray", "7 8").attr("stroke-dashoffset", -(now / 30) % 15);
      } else {
        el.attr("stroke-dasharray", null).attr("stroke-dashoffset", null);
      }
    });

    gLinkHits.selectAll("path.link-hit").each(function (d) {
      const [a, b] = endpoints(d);
      const pa = visualPos(a, now);
      const pb = visualPos(b, now);
      window.d3.select(this).attr("d", `M${pa.x},${pa.y}L${pb.x},${pb.y}`);
    });

    drawParticles(now);
  }

  function colorMix(color, a) {
    // Let the browser mix when possible; fallback to a transparent theme.
    return `color-mix(in srgb, ${color} ${Math.round(a * 100)}%, transparent)`;
  }

  function drawParticles(now) {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    if (reduced || entrance < 0.5) return;

    const hi = highlightSet();
    const source = hover && hover.id ? hover : selected;
    if (source && source.id && !pathNodeSet.size) {
      const edges = visibleLinks().filter((l) => {
        const [a, b] = endpoints(l);
        return a.id === source.id || b.id === source.id;
      });
      if (Math.random() < 0.65) {
        edges.forEach((l) => {
          const [a, b] = endpoints(l);
          const from = a.id === source.id ? a : b;
          const to = from === a ? b : a;
          particles.push({
            from: from.id,
            to: to.id,
            t: 0,
            speed: 0.006 + Math.random() * 0.01,
            r: 1.1 + Math.random() * 1.2,
            life: 1,
          });
        });
      }
    }
    if (pathNodeSet.size && Math.random() < 0.8) {
      links
        .filter((l) => pathLinkSet.has(l.id))
        .forEach((l) => {
          const [a, b] = endpoints(l);
          particles.push({
            from: a.id,
            to: b.id,
            t: 0,
            speed: 0.01 + Math.random() * 0.012,
            r: 1.4 + Math.random(),
            life: 1,
          });
        });
    }

    if (particles.length > 220) particles = particles.slice(-160);

    const t = transform || { x: 0, y: 0, k: 1 };
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.scale(t.k, t.k);
    ctx.translate(width / 2, height / 2);

    particles = particles.filter((p) => {
      p.t += p.speed * Math.min((now - lastTick) / 16.67, 2.5);
      p.life -= 0.01;
      if (p.t >= 1 || p.life <= 0) return false;
      const a = nodeById.get(p.from);
      const b = nodeById.get(p.to);
      if (!a || !b || !isAlive(a) || !isAlive(b)) return false;
      if (hi && !(hi.has(a.id) && hi.has(b.id))) return false;
      const pa = visualPos(a, now);
      const pb = visualPos(b, now);
      const e = 1 - Math.pow(1 - p.t, 2);
      const x = pa.x + (pb.x - pa.x) * e;
      const y = pa.y + (pb.y - pa.y) * e;
      ctx.beginPath();
      ctx.fillStyle = theme;
      ctx.globalAlpha = Math.min(0.9, p.life) * 0.85;
      ctx.arc(x, y, p.r, 0, Math.PI * 2);
      ctx.fill();
      return true;
    });
    ctx.globalAlpha = 1;
    ctx.restore();
    lastTick = now;
  }

  function loop(now) {
    if (!entered && !reduced) {
      entrance = Math.min(1, entrance + (now - lastTick) / 1400);
      if (entrance >= 1) entered = true;
      if (sim) sim.alpha(Math.max(sim.alpha(), 0.08));
    }
    if (sim && sim.alpha() < 0.02 && entered && !hover && !particles.length && !pathNodeSet.size && !playing) {
      // Still breathe a little.
      paint(now);
    } else {
      paint(now);
    }
    lastTick = now;
    requestAnimationFrame(loop);
  }

  function setHover(d) {
    hover = d;
    paint(performance.now());
  }

  function showTipForNode(event, d) {
    if (!tipEl || d.type === "edge") return;
    const text =
      d.type === "paper"
        ? `<strong>${escapeHtml(d.short)}</strong> · ${formatPaperDate(d)}${d.pubtype === "preprint" ? " · Preprint" : d.venue ? " · " + escapeHtml(d.venue) : ""}`
        : d.type === "keyword"
          ? `<strong>${escapeHtml(d.label)}</strong>`
          : `<strong>${escapeHtml(d.label)}</strong><br>${escapeHtml(d.description || "")}`;
    placeTip(event, text);
  }

  function showTipForEdge(event, d) {
    const [a, b] = endpoints(d);
    const pts = (d.shared || []).slice(0, 2).map((s) => `<div>• ${escapeHtml(s)}</div>`).join("");
    placeTip(event, `<strong>${escapeHtml(a.short)} → ${escapeHtml(b.short)}</strong><div>Strength ${d.strength}</div>${pts}`);
  }

  function placeTip(event, html) {
    if (!tipEl) return;
    tipEl.innerHTML = html;
    tipEl.hidden = false;
    tipEl.classList.add("is-on");
    tipEl.style.left = "0px";
    tipEl.style.top = "0px";
    const rect = stage.getBoundingClientRect();
    const tw = tipEl.offsetWidth || 260;
    const th = tipEl.offsetHeight || 80;
    let x = event.clientX - rect.left + 14;
    let y = event.clientY - rect.top + 16;
    if (x + tw > rect.width - 10) x = event.clientX - rect.left - tw - 14;
    if (y + th > rect.height - 10) y = event.clientY - rect.top - th - 16;
    x = Math.max(10, Math.min(x, rect.width - tw - 10));
    y = Math.max(10, Math.min(y, rect.height - th - 10));
    tipEl.style.left = `${x}px`;
    tipEl.style.top = `${y}px`;
  }

  function hideTip() {
    if (!tipEl) return;
    tipEl.classList.remove("is-on");
    tipEl.hidden = true;
  }

  function onNodeClick(d) {
    if (pathMode && d.type === "paper") {
      pickPath(d);
      return;
    }
    if (d.type === "paper") {
      openCard(d);
      flyToNodes([d], 1.35, 700, { padRight: 360 });
      return;
    }
    // Area or keyword: re-center and zoom. Homes stay put so labels cannot collide.
    clusterFocus = d.id;
    selected = null;
    closeCard();
    const members = [d, ...(adj.get(d.id) || []).map((x) => nodeById.get(x.id)).filter(Boolean)].filter((n) => isAlive(n));
    flyToNodes(members, d.type === "area" ? 1.25 : 1.55, 900);
  }

  function pickPath(d) {
    if (pathPicks.length === 1 && pathPicks[0].id === d.id) return;
    pathPicks.push(d);
    if (pathPicks.length === 1) {
      narrate(`<strong>${escapeHtml(d.short)}</strong> selected. Click a second paper to find the path.`);
      selected = d;
      closeCard();
      paint(performance.now());
      return;
    }
    const [a, b] = pathPicks;
    const result = shortestPath(a.id, b.id);
    pathPicks = [];
    if (!result) {
      pathNodeSet = new Set([a.id, b.id]);
      pathLinkSet = new Set();
      narrate(
        `No research path joins <strong>${escapeHtml(a.short)}</strong> and <strong>${escapeHtml(b.short)}</strong> on this map — their questions do not meet.`
      );
      paint(performance.now());
      return;
    }
    pathNodeSet = new Set(result.nodes);
    pathLinkSet = new Set(result.links);
    narrate(result.html);
    flyToNodes(
      result.nodes.map((id) => nodeById.get(id)).filter(Boolean),
      1.25,
      900,
      { padBottom: 210 }
    );
    paint(performance.now());
  }

  function shortestPath(start, goal) {
    // Dijkstra over papers, keywords, and areas.
    // Prefer stronger paper–paper edges; keyword/area hops cost a little more.
    const dist = new Map([[start, 0]]);
    const prev = new Map();
    const via = new Map();
    const pq = [[0, start]];
    while (pq.length) {
      pq.sort((a, b) => a[0] - b[0]);
      const [cost, u] = pq.shift();
      if (u === goal) break;
      if (cost !== dist.get(u)) continue;
      for (const e of adj.get(u) || []) {
        const vNode = nodeById.get(e.id);
        const uNode = nodeById.get(u);
        if (!isAlive(vNode) || !isAlive(uNode)) continue;
        let w = 3;
        if (e.kind === "pp") w = e.strength >= 3 ? 1 : e.strength >= 2 ? 1.4 : 2.2;
        else if (e.kind === "pk") w = 1.8;
        else if (e.kind === "ka") w = 2.1;
        else if (e.kind === "pa") w = 2.0;
        const nc = cost + w;
        if (nc < (dist.get(e.id) ?? Infinity)) {
          dist.set(e.id, nc);
          prev.set(e.id, u);
          via.set(e.id, e);
          pq.push([nc, e.id]);
        }
      }
    }
    if (!prev.has(goal) && start !== goal) return null;
    const nodesPath = [goal];
    const linkPath = [];
    const hops = [];
    for (let cur = goal; cur !== start; cur = prev.get(cur)) {
      const e = via.get(cur);
      linkPath.push(e.link);
      hops.push({ from: prev.get(cur), to: cur, e });
      nodesPath.push(prev.get(cur));
    }
    nodesPath.reverse();
    hops.reverse();
    const a = nodeById.get(start);
    const b = nodeById.get(goal);
    const parts = [];
    hops.forEach((h) => {
      const from = nodeById.get(h.from);
      const to = nodeById.get(h.to);
      if (h.e.kind === "pp") {
        const pts = (h.e.shared || []).map((s) => `<li>${escapeHtml(s)}</li>`).join("");
        parts.push(
          `<p><strong>${escapeHtml(from.short)}</strong> and <strong>${escapeHtml(to.short)}</strong> share research directly (strength ${h.e.strength}).</p>${
            pts ? `<ol>${pts}</ol>` : ""
          }`
        );
      } else if (to.type === "keyword" || from.type === "keyword") {
        const kw = to.type === "keyword" ? to : from;
        parts.push(`<p>They meet at the keyword <strong>${escapeHtml(kw.label)}</strong>.</p>`);
      } else if (to.type === "area" || from.type === "area") {
        const area = to.type === "area" ? to : from;
        parts.push(`<p>They sit together in <strong>${escapeHtml(area.label)}</strong>.</p>`);
      }
    });
    // Deduplicate consecutive identical keyword sentences.
    const html = `<p>Path from <strong>${escapeHtml(a.short)}</strong> to <strong>${escapeHtml(b.short)}</strong>.</p>${parts.join("")}`;
    return { nodes: nodesPath, links: linkPath, html };
  }

  function flyToNodes(list, scale, dur, opts = {}) {
    if (!zoom || !list.length) return;
    const d3 = window.d3;
    const now = performance.now();
    const xs = list.map((n) => visualPos(n, now).x);
    const ys = list.map((n) => visualPos(n, now).y);
    const padB = opts.padBottom || 0;
    const padL = opts.padLeft || 0;
    const padR = opts.padRight || 0;
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2 + padB / (2.8 * Math.max(scale, 1));
    const bw = Math.max(120, Math.max(...xs) - Math.min(...xs) + 220 + padL + padR);
    const bh = Math.max(120, Math.max(...ys) - Math.min(...ys) + 220 + padB);
    const usableW = Math.max(200, width - padL - padR);
    const usableH = Math.max(200, height - padB);
    const k = Math.max(0.62, Math.min(scale, Math.min(usableW / bw, usableH / bh) * 0.9));
    const targetX =
      list.length === 1 && list[0].type === "paper" ? width * 0.32 : width / 2 + (padL - padR) / 3;
    const targetY = (height - padB) / 2;
    const t = d3.zoomIdentity
      .translate(targetX - k * (width / 2 + cx), targetY - k * (height / 2 + cy))
      .scale(k);
    const sel = d3.select(svgEl);
    if (reduced) {
      sel.call(zoom.transform, t);
    } else {
      sel.transition().duration(dur || 800).ease(d3.easeCubicInOut).call(zoom.transform, t);
    }
  }

  function resetCamera(dur) {
    const d3 = window.d3;
    clusterFocus = null;
    if (!zoom) return;
    const sel = d3.select(svgEl);
    if (reduced) sel.call(zoom.transform, d3.zoomIdentity);
    else sel.transition().duration(dur || 600).ease(d3.easeCubicInOut).call(zoom.transform, d3.zoomIdentity);
  }

  function venueLine(p) {
    if (p.pubtype === "preprint") return `${formatPaperDate(p)} · Preprint`;
    const bits = [formatPaperDate(p), p.venue];
    let extra = "";
    if (p.impact_factor) extra += `<mark title="Journal impact factor">IF ${p.impact_factor}</mark>`;
    if (p.badge) extra += ` <mark>${escapeHtml(p.badge)}</mark>`;
    return `${bits.filter(Boolean).join(" · ")}${extra ? " · " + extra : ""}`;
  }

  function openCard(p) {
    selected = p;
    const links = [];
    if (p.links.paper) links.push(`<a href="${p.links.paper}" target="_blank" rel="noopener">Paper</a>`);
    if (p.links.code) links.push(`<a href="${p.links.code}" target="_blank" rel="noopener">Code</a>`);
    if (p.links.project) links.push(`<a href="${p.links.project}">Project</a>`);
    cardEl.innerHTML = `
      <button type="button" class="rmap-card-close" id="rmap-card-close" aria-label="Close">×</button>
      <img class="rmap-card-thumb" src="${p.preview}" alt="">
      <p class="rmap-card-kicker">${escapeHtml(p.short)}</p>
      <h2>${escapeHtml(p.title)}</h2>
      <p class="rmap-card-meta">${venueLine(p)}</p>
      <p>${escapeHtml(p.summary)}</p>
      <div class="rmap-card-links">${links.join("")}</div>`;
    cardEl.hidden = false;
    requestAnimationFrame(() => cardEl.classList.add("is-open"));
    cardEl.querySelector("#rmap-card-close").addEventListener("click", (e) => {
      e.stopPropagation();
      closeCard();
    });
  }

  function closeCard() {
    selected = null;
    cardEl.classList.remove("is-open");
    window.setTimeout(() => {
      if (!cardEl.classList.contains("is-open")) cardEl.hidden = true;
    }, 280);
  }

  function narrate(html) {
    narrateEl.innerHTML = html;
    narrateEl.hidden = false;
    requestAnimationFrame(() => narrateEl.classList.add("is-open"));
  }

  function closeNarrate() {
    narrateEl.classList.remove("is-open");
    window.setTimeout(() => {
      if (!narrateEl.classList.contains("is-open")) narrateEl.hidden = true;
    }, 280);
  }

  function clearPath() {
    pathMode = false;
    pathPicks = [];
    pathNodeSet = new Set();
    pathLinkSet = new Set();
    pathBtn.classList.remove("is-on");
    pathBtn.setAttribute("aria-pressed", "false");
    closeNarrate();
  }

  function clearSelection() {
    clearPath();
    closeCard();
    clusterFocus = null;
    hover = null;
    hideTip();
    hideHits();
    if (helpEl) helpEl.hidden = true;
    paint(performance.now());
  }

  function setMonthIndex(i, opts = {}) {
    if (!months.length) return;
    i = Math.max(0, Math.min(months.length - 1, +i));
    const next = months[i].ym;
    const prev = monthMax;
    monthIndex = i;
    monthMax = next;
    if (yearInput) yearInput.value = String(i);
    if (yearLabel) yearLabel.textContent = months[i].label;
    if (opts.counter) {
      counterEl.textContent = months[i].label;
      counterEl.classList.add("is-on");
    } else if (!playing) {
      counterEl.classList.remove("is-on");
    }
    if (next !== prev) {
      const newborn = nodes.filter((n) => n.type === "paper" && ymOf(n) === next && next > prev);
      if (!reduced && newborn.length) {
        newborn.forEach((n) => {
          n.x = n.homeX * 0.15;
          n.y = n.homeY * 0.15;
          n.vx = (n.homeX - n.x) * 0.04;
          n.vy = (n.homeY - n.y) * 0.04;
        });
      }
      bindLinks();
      if (sim) sim.alpha(0.5).restart();
    }
    if (opts.frame) {
      const vis = nodes.filter((n) => isAlive(n));
      if (vis.length && vis.length < nodes.length) flyToNodes(vis, vis.length <= 8 ? 1.18 : 1.05, opts.frameDur || 850);
      else resetCamera(opts.frameDur || 850);
    }
    paint(performance.now());
  }

  // Compat: treat a bare year as "through the last month of that year".
  function setYear(y, opts = {}) {
    if (!months.length) return;
    let i = months.length - 1;
    for (let k = months.length - 1; k >= 0; k--) {
      if (months[k].year <= +y) {
        i = k;
        break;
      }
      if (k === 0) i = 0;
    }
    setMonthIndex(i, opts);
  }

  function playTimeline() {
    if (playing) {
      stopPlay();
      return;
    }
    if (!months.length) return;
    playing = true;
    playBtn.classList.add("is-on");
    playBtn.setAttribute("aria-pressed", "true");
    playBtn.textContent = "Pause";
    let i = 0;
    setMonthIndex(0, { counter: true, frame: true, frameDur: reduced ? 1 : 800 });
    const step = () => {
      i += 1;
      if (i >= months.length) {
        stopPlay();
        return;
      }
      setMonthIndex(i, { counter: true, frame: true, frameDur: reduced ? 1 : 800 });
      playTimer = window.setTimeout(step, reduced ? 200 : 1250);
    };
    playTimer = window.setTimeout(step, reduced ? 200 : 1200);
  }

  function stopPlay() {
    playing = false;
    playBtn.classList.remove("is-on");
    playBtn.setAttribute("aria-pressed", "false");
    playBtn.textContent = "Play timeline";
    if (playTimer) window.clearTimeout(playTimer);
    playTimer = null;
    window.setTimeout(() => counterEl.classList.remove("is-on"), 900);
  }

  function fuzzyScore(q, n) {
    const query = q.trim().toLowerCase();
    if (!query) return 0;
    const name = (n.short || n.label || "").toLowerCase();
    const title = (n.title || n.description || "").toLowerCase();
    const hay = `${name} ${title} ${(n.keywords || []).join(" ")}`.toLowerCase();
    if (name === query || title === query) return 100;
    if (name.startsWith(query) || title.startsWith(query)) return 86;
    if (name.includes(query) || title.includes(query)) return 70;
    if (hay.includes(query)) return 58;
    // Subsequence
    let i = 0;
    for (const ch of hay) {
      if (ch === query[i]) i += 1;
      if (i === query.length) return 40;
    }
    if (query.length >= 3 && levenshtein(query, name) <= 1) return 50;
    return 0;
  }

  function levenshtein(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 99;
    const m = [];
    for (let i = 0; i <= a.length; i++) {
      m[i] = [i];
      for (let j = 1; j <= b.length; j++) {
        if (i === 0) m[0][j] = j;
        else {
          const cost = a[i - 1] === b[j - 1] ? 0 : 1;
          m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + cost);
        }
      }
    }
    return m[a.length][b.length];
  }

  function renderHits(q) {
    const items = nodes
      .map((n) => ({ n, s: fuzzyScore(q, n) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 8);
    if (!items.length) {
      hitsEl.hidden = true;
      hitsEl.innerHTML = "";
      return;
    }
    hitsEl.hidden = false;
    hitsEl.innerHTML = items
      .map(
        (x, i) =>
          `<li><button type="button" role="option" data-id="${x.n.id}" aria-selected="${i === 0 ? "true" : "false"}">${escapeHtml(
            x.n.short || x.n.label
          )}<span class="rmap-hit-k">${escapeHtml(x.n.type === "paper" ? x.n.title : x.n.type)}</span></button></li>`
      )
      .join("");
  }

  function hideHits() {
    hitsEl.hidden = true;
  }

  function goToId(id) {
    const n = nodeById.get(id);
    if (!n) return;
    hideHits();
    searchInput.blur();
    if (n.type === "paper" && ymOf(n) > monthMax) {
      const i = months.findIndex((m) => m.ym === ymOf(n));
      if (i >= 0) setMonthIndex(i);
    }
    if (n.type === "paper") {
      openCard(n);
      flyToNodes([n], 1.38, 800, { padRight: 360 });
    } else {
      onNodeClick(n);
    }
  }

  function togglePathMode() {
    if (pathMode) {
      clearPath();
      paint(performance.now());
      return;
    }
    pathMode = true;
    pathPicks = [];
    pathNodeSet = new Set();
    pathLinkSet = new Set();
    pathBtn.classList.add("is-on");
    pathBtn.setAttribute("aria-pressed", "true");
    narrate("Path finder is on. Click two papers to trace the shortest research path between them.");
  }

  function buildMobile() {
    if (!mobileEl) return;
    mobileEl.innerHTML = data.areas
      .map((area) => {
        const papers = data.papers
          .filter((p) => (p.areas || []).includes(area.id))
          .sort((a, b) => ymOf(a) - ymOf(b) || a.short.localeCompare(b.short));
        if (!papers.length) return "";
        return `<section><h2>${escapeHtml(area.label)}</h2>${papers
          .map(
            (p) => `<article>
              <img src="${p.preview}" alt="">
              <div>
                <h3>${escapeHtml(p.short)}</h3>
                <p>${p.pubtype === "preprint" ? formatPaperDate(p) + " · Preprint" : `${formatPaperDate(p)} · ${escapeHtml(p.venue || "")}`}. ${escapeHtml(p.summary)}</p>
              </div>
            </article>`
          )
          .join("")}</section>`;
      })
      .join("");
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function bindUi() {
    pathBtn.addEventListener("click", togglePathMode);
    playBtn.addEventListener("click", playTimeline);
    yearInput.addEventListener("input", () => {
      stopPlay();
      setMonthIndex(+yearInput.value, { counter: true, frame: true, frameDur: reduced ? 1 : 700 });
    });
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const first = hitsEl.querySelector("button");
      if (first) goToId(first.dataset.id);
    });
    searchInput.addEventListener("input", () => renderHits(searchInput.value));
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        hideHits();
        searchInput.blur();
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const buttons = [...hitsEl.querySelectorAll("button")];
        if (!buttons.length) return;
        let i = buttons.findIndex((b) => b.getAttribute("aria-selected") === "true");
        i = e.key === "ArrowDown" ? (i + 1) % buttons.length : (i - 1 + buttons.length) % buttons.length;
        buttons.forEach((b, j) => b.setAttribute("aria-selected", j === i ? "true" : "false"));
      }
    });
    hitsEl.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-id]");
      if (btn) goToId(btn.dataset.id);
    });
    document.addEventListener("click", (e) => {
      if (!searchForm.contains(e.target)) hideHits();
    });

    const homeMode = app.classList.contains("rmap-app--home");
    const mapIsActive = () =>
      app.contains(document.activeElement) || app.matches(":hover") || (helpEl && !helpEl.hidden);

    document.addEventListener("keydown", (e) => {
      const tag = (e.target && e.target.tagName) || "";
      const typing = tag === "INPUT" || tag === "TEXTAREA";
      if (homeMode && !mapIsActive()) return;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      } else if (e.key === "?" && !typing) {
        e.preventDefault();
        helpEl.hidden = !helpEl.hidden;
      } else if ((e.key === "p" || e.key === "P") && !typing) {
        e.preventDefault();
        togglePathMode();
      } else if (e.key === " " && !typing) {
        e.preventDefault();
        playTimeline();
      } else if ((e.key === "r" || e.key === "R") && !typing) {
        e.preventDefault();
        resetCamera();
      } else if (e.key === "Escape") {
        clearSelection();
        resetCamera(400);
      }
    });

    new MutationObserver(refreshTheme).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-accent", "data-mode"],
    });

    const ro = new ResizeObserver(() => {
      const prevW = width;
      const prevH = height;
      sizeStage();
      if (nodes.length && (width !== prevW || height !== prevH)) computeLayout();
      paint(performance.now());
    });
    ro.observe(stage);
  }

  async function setup() {
    refreshTheme();
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (e) {}
    }
    sizeStage();
    buildGraph();
    setupSvg();
    startSim();
    bindLinks();
    bindUi();
    lastTick = performance.now();
    requestAnimationFrame(loop);
    if (readyResolve) readyResolve();
  }

  async function init() {
    try {
      const res = await fetch(app.dataset.src);
      data = await res.json();
    } catch (err) {
      if (stage) stage.innerHTML = "<p class='rmap-lede'>The research map could not be loaded.</p>";
      return;
    }
    buildMonths();
    buildMobile();
    if (mobileMq.matches) {
      if (readyResolve) readyResolve();
      return;
    }
    await waitForD3();
    await setup();
  }

  window.__rmap = {
    ready,
    playTimeline,
    togglePathMode,
    setYear,
    setMonthIndex,
    months: () => months,
    goToId,
    resetCamera,
    clearSelection,
    openCard: (id) => nodeById.get(id) && openCard(nodeById.get(id)),
    startPath: async (a, b) => {
      await ready;
      if (!pathMode) togglePathMode();
      pathPicks = [];
      pickPath(nodeById.get(a));
      pickPath(nodeById.get(b));
    },
    hover: (id) => {
      const n = nodeById.get(id);
      if (n) setHover(n);
    },
    get nodes() {
      return nodes;
    },
    replayEntrance() {
      entrance = 0;
      entered = false;
      particles = [];
    },
    getBoxes: boxesForCheck,
    checkOverlaps: overlapsReport,
    computeLayout,
    hiddenKeywords() {
      return nodes.filter((n) => n.type === "keyword" && !n.showLabel).map((n) => n.label);
    },
  };

  init();
})();
