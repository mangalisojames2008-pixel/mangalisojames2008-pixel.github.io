/* =========================================================
   NEXERA studio: every device is modelled here in code.
   Used two ways:
   1. tools/render.html renders the still product images in assets/products/
   2. the product view opens a live Stage with a display animation
   ========================================================= */
import * as THREE from './vendor/three.module.min.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

const PI = Math.PI;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = v => Math.max(0, Math.min(1, v));
const seg = (p, a, b) => clamp01((p - a) / (b - a));
export const ease = {
  out: t => 1 - Math.pow(1 - t, 3),
  outQuint: t => 1 - Math.pow(1 - t, 5),
  inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: t => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
};

/* ---------------------------------------------------------
   Geometry helpers
   --------------------------------------------------------- */
function rrShape(w, h, r) {
  const [tl, tr, br, bl] = Array.isArray(r) ? r : [r, r, r, r];
  const x = -w / 2, y = -h / 2;
  const s = new THREE.Shape();
  s.moveTo(x + bl, y);
  s.lineTo(x + w - br, y);
  s.absarc(x + w - br, y + br, br, -PI / 2, 0, false);
  s.lineTo(x + w, y + h - tr);
  s.absarc(x + w - tr, y + h - tr, tr, 0, PI / 2, false);
  s.lineTo(x + tl, y + h);
  s.absarc(x + tl, y + h - tl, tl, PI / 2, PI, false);
  s.lineTo(x, y + bl);
  s.absarc(x + bl, y + bl, bl, PI, PI * 1.5, false);
  return s;
}

/* Smooth normals inside each material group, keep hard creases between groups. */
function smoothGroups(geo, creaseDeg = 50) {
  const pos = geo.attributes.position, n = pos.count, faces = n / 3;
  const fGroup = new Int8Array(faces);
  for (const g of geo.groups) for (let f = g.start / 3; f < (g.start + g.count) / 3; f++) fGroup[f] = g.materialIndex;
  const fn = new Float32Array(faces * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let f = 0; f < faces; f++) {
    a.fromBufferAttribute(pos, f * 3); b.fromBufferAttribute(pos, f * 3 + 1); c.fromBufferAttribute(pos, f * 3 + 2);
    c.sub(b); a.sub(b); c.cross(a);
    fn[f * 3] = c.x; fn[f * 3 + 1] = c.y; fn[f * 3 + 2] = c.z;
  }
  const buckets = new Map();
  for (let i = 0; i < n; i++) {
    const k = Math.round(pos.getX(i) * 1e4) + '_' + Math.round(pos.getY(i) * 1e4) + '_' + Math.round(pos.getZ(i) * 1e4);
    let arr = buckets.get(k);
    if (!arr) buckets.set(k, (arr = []));
    arr.push(i);
  }
  const cos = Math.cos(creaseDeg * PI / 180);
  const out = new Float32Array(n * 3);
  const t = new THREE.Vector3(), u = new THREE.Vector3();
  for (const arr of buckets.values()) {
    for (const i of arr) {
      const f = (i / 3) | 0;
      t.set(fn[f * 3], fn[f * 3 + 1], fn[f * 3 + 2]).normalize();
      let sx = 0, sy = 0, sz = 0;
      for (const j of arr) {
        const g = (j / 3) | 0;
        if (fGroup[g] !== fGroup[f]) continue;
        u.set(fn[g * 3], fn[g * 3 + 1], fn[g * 3 + 2]);
        const len = u.length();
        if (!len || u.dot(t) / len < cos) continue;
        sx += u.x; sy += u.y; sz += u.z;
      }
      u.set(sx, sy, sz);
      if (u.lengthSq() === 0) u.copy(t); else u.normalize();
      out[i * 3] = u.x; out[i * 3 + 1] = u.y; out[i * 3 + 2] = u.z;
    }
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(out, 3));
}

/* A rounded slab: rounded-rectangle outline in XY, thickness d along Z, soft edges. Groups: 0 faces, 1 sides. */
function slab(w, h, d, r, bevel) {
  const b = Math.min(bevel ?? d * 0.3, d / 2 - 1e-4, Math.min(w, h) / 2 - 1e-3);
  const radii = (Array.isArray(r) ? r : [r, r, r, r]).map(x => Math.max(x - b, 0.0006));
  const depth = Math.max(d - 2 * b, 1e-4);
  const geo = new THREE.ExtrudeGeometry(rrShape(w - 2 * b, h - 2 * b, radii), {
    depth, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 7, curveSegments: 30
  });
  geo.translate(0, 0, -depth / 2);
  smoothGroups(geo);
  return geo;
}

/* A flat rounded rectangle with 0..1 UVs (or a slice of them). */
function planeRR(w, h, r, u0 = 0, u1 = 1, v0 = 0, v1 = 1) {
  const g = new THREE.ShapeGeometry(rrShape(w, h, r), 32);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, lerp(u0, u1, (p.getX(i) + w / 2) / w), lerp(v0, v1, (p.getY(i) + h / 2) / h));
  return g;
}

/* ---------------------------------------------------------
   Materials
   --------------------------------------------------------- */
const mat = {
  alu: (hex, rough = 0.34) => new THREE.MeshPhysicalMaterial({ color: hex, metalness: 0.78, roughness: rough, clearcoat: 0.3, clearcoatRoughness: 0.3 }),
  polished: hex => new THREE.MeshPhysicalMaterial({ color: hex, metalness: 0.92, roughness: 0.16, clearcoat: 0.5, clearcoatRoughness: 0.08 }),
  glass: hex => new THREE.MeshPhysicalMaterial({ color: hex, metalness: 0.12, roughness: 0.5, clearcoat: 0.7, clearcoatRoughness: 0.45 }),
  gloss: hex => new THREE.MeshPhysicalMaterial({ color: hex, metalness: 0, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.16 }),
  matte: (hex, rough = 0.82) => new THREE.MeshStandardMaterial({ color: hex, metalness: 0, roughness: rough }),
  black: () => new THREE.MeshPhysicalMaterial({ color: 0x030405, metalness: 0, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
  lens: () => new THREE.MeshPhysicalMaterial({ color: 0x080b14, metalness: 0.35, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02 }),
  steel: () => new THREE.MeshPhysicalMaterial({ color: 0xd4d6da, metalness: 1, roughness: 0.22 }),
  screen: tex => new THREE.MeshPhysicalMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0, roughness: 0.14, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
  decal: (opts) => new THREE.MeshStandardMaterial({ polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2, ...opts })
};
const dark = (hex, k) => new THREE.Color(hex).multiplyScalar(k);

/* ---------------------------------------------------------
   Screen pictures, drawn on canvases
   --------------------------------------------------------- */
const DISPLAY = '600 ';
const FONT = (w, px) => `${w} ${px}px Sora, "DM Sans", system-ui, sans-serif`;
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function wallpaper(ctx, w, h, angle = 0.6) {
  const g = ctx.createLinearGradient(0, 0, w * angle, h);
  g.addColorStop(0, '#1b1238'); g.addColorStop(0.42, '#55286e'); g.addColorStop(0.78, '#ff5a5f'); g.addColorStop(1, '#ffb26b');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const r1 = ctx.createRadialGradient(w * 0.85, h * 0.2, 0, w * 0.85, h * 0.2, w * 0.7);
  r1.addColorStop(0, 'rgba(124,92,255,.55)'); r1.addColorStop(1, 'rgba(124,92,255,0)');
  ctx.fillStyle = r1; ctx.fillRect(0, 0, w, h);
  const r2 = ctx.createRadialGradient(w * 0.1, h * 0.95, 0, w * 0.1, h * 0.95, w * 0.8);
  r2.addColorStop(0, 'rgba(255,154,77,.45)'); r2.addColorStop(1, 'rgba(255,154,77,0)');
  ctx.fillStyle = r2; ctx.fillRect(0, 0, w, h);
}
function markIcon(ctx, x, y, s, tile = true) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 64, s / 64);
  if (tile) { rr(ctx, 2, 2, 60, 60, 19); ctx.fillStyle = '#111218'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 1; ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(20.5, 45); ctx.lineTo(20.5, 20.5); ctx.lineTo(42.5, 44.5); ctx.lineTo(42.5, 31);
  ctx.strokeStyle = '#f4f2ed'; ctx.lineWidth = 6.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  const g = ctx.createLinearGradient(38, 15, 47, 24); g.addColorStop(0, '#ff9a4d'); g.addColorStop(0.5, '#ff4f6e'); g.addColorStop(1, '#7c5cff');
  ctx.beginPath(); ctx.arc(42.5, 19.8, 4.6, 0, PI * 2); ctx.fillStyle = g; ctx.fill();
  ctx.restore();
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  // paint(r) redraws with some parts faded (see DRAW); redraw() draws everything again
  t.userData.paint = r => { draw(ctx, w, h, r); t.needsUpdate = true; };
  t.userData.redraw = () => t.userData.paint();
  t.userData.draw = draw; t.userData.size = [w, h];
  return t;
}
let fixedTime = null;
const nowText = () => { if (fixedTime) return fixedTime; const d = new Date(); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };

/* Each screen is drawn by one DRAW function. The optional r fades single parts, e.g. { bg: 1, time: 0.5 }:
   0 hides a part, 1 shows it, and for the clock values in between tick the digits in one by one.
   Without r the whole screen is drawn. The 3D showcase uses r to wake screens up and to split them into layers. */
const A = (r, k) => (r && r[k] !== undefined ? r[k] : 1);
function tickText(ctx, text, x, y, k, rise) {
  if (k >= 1) { ctx.fillText(text, x, y); return; }
  if (k <= 0) return;
  const chars = [...text], n = chars.length, ws = chars.map(c => ctx.measureText(c).width);
  const total = ws.reduce((a, b) => a + b, 0), align = ctx.textAlign, a0 = ctx.globalAlpha, d = n > 1 ? 0.5 / (n - 1) : 0;
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  ctx.textAlign = 'left';
  chars.forEach((c, i) => {
    const s = ease.out(clamp01((k - i * d) / 0.5));
    ctx.globalAlpha = a0 * s; ctx.fillText(c, cx, y + (1 - s) * rise); cx += ws[i];
  });
  ctx.textAlign = align; ctx.globalAlpha = a0;
}
function dockDots(ctx, x0, step, y, rad, n) {
  for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.arc(x0 + i * step, y, rad, 0, PI * 2); ctx.fillStyle = `rgba(255,255,255,${i % 3 ? 0.28 : 0.42})`; ctx.fill(); }
}
export const DRAW = {
  phone(ctx, w, h, r) {
    ctx.save(); ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = A(r, 'bg'); wallpaper(ctx, w, h);
    ctx.globalAlpha = A(r, 'status'); ctx.fillStyle = '#fff'; ctx.font = FONT(600, 34); ctx.fillText('9:41', 64, 74);
    ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.font = FONT(600, 150); ctx.fillStyle = 'rgba(255,255,255,.95)'; tickText(ctx, nowText(), w / 2, 330, A(r, 'time'), 70);
    ctx.globalAlpha = A(r, 'line'); ctx.font = FONT(500, 30); ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillText('Shop smarter. Live better.', w / 2, 384);
    ctx.globalAlpha = A(r, 'mark'); markIcon(ctx, w / 2 - 70, 560, 140);
    ctx.globalAlpha = A(r, 'dock'); rr(ctx, 50, h - 170, w - 100, 120, 60); ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fill();
    dockDots(ctx, 120, 107, h - 110, 38, 4);
    ctx.restore();
  },
  cover(ctx, w, h, r) {
    ctx.save(); ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = A(r, 'bg'); wallpaper(ctx, w, h, 0.4);
    ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = FONT(600, 140); tickText(ctx, nowText(), w / 2, 300, A(r, 'time'), 60);
    ctx.globalAlpha = A(r, 'mark'); markIcon(ctx, w / 2 - 60, 520, 120);
    ctx.restore();
  },
  duo(ctx, w, h, r) {
    ctx.save(); ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = A(r, 'bg'); wallpaper(ctx, w, h, 1);
    ctx.globalAlpha = A(r, 'widget'); rr(ctx, 80, 90, 520, 300, 46); ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.font = FONT(600, 120); tickText(ctx, nowText(), 120, 260, A(r, 'time'), 56);
    ctx.globalAlpha = A(r, 'line'); ctx.font = FONT(500, 34); ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillText('Shop smarter. Live better.', 124, 330);
    ctx.globalAlpha = A(r, 'tiles');
    for (let i = 0; i < 2; i++) { rr(ctx, 80 + i * 270, 430, 250, 250, 46); ctx.fillStyle = `rgba(255,255,255,${0.12 + i * 0.06})`; ctx.fill(); }
    ctx.globalAlpha = A(r, 'mark'); markIcon(ctx, 960, 300, 220);
    ctx.globalAlpha = A(r, 'dock'); rr(ctx, 780, h - 200, 540, 130, 65); ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fill();
    dockDots(ctx, 860, 127, h - 135, 42, 4);
    ctx.restore();
  },
  mac(ctx, w, h, r) {
    ctx.save(); ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = A(r, 'bg'); wallpaper(ctx, w, h, 1.2);
    ctx.globalAlpha = A(r, 'menu'); ctx.fillStyle = 'rgba(10,8,20,.32)'; ctx.fillRect(0, 0, w, 34);
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = FONT(600, 19); ctx.fillText('NEXERA', 28, 23);
    ctx.textAlign = 'right'; ctx.fillText(nowText(), w - 28, 23); ctx.textAlign = 'center';
    ctx.globalAlpha = A(r, 'mark'); markIcon(ctx, w / 2 - 90, h / 2 - 170, 180);
    ctx.globalAlpha = A(r, 'title'); ctx.font = FONT(600, 70); ctx.fillStyle = '#fff'; ctx.fillText('Shop smarter.', w / 2, h / 2 + 100);
    ctx.globalAlpha = A(r, 'sub'); ctx.font = FONT(500, 34); ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillText('Live better.', w / 2, h / 2 + 150);
    ctx.globalAlpha = A(r, 'dock'); rr(ctx, w / 2 - 330, h - 120, 660, 96, 30); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fill();
    for (let i = 0; i < 8; i++) { rr(ctx, w / 2 - 300 + i * 76, h - 104, 62, 62, 16); ctx.fillStyle = `rgba(255,255,255,${0.25 + (i % 3) * 0.1})`; ctx.fill(); }
    ctx.restore();
  },
  watch(ctx, w, h, r) {
    ctx.save(); ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = A(r, 'bg'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = A(r, 'mark'); markIcon(ctx, w / 2 - 22, 46, 44, false);
    ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.fillStyle = '#f4f2ed'; ctx.font = FONT(600, 118); tickText(ctx, nowText(), w / 2, 250, A(r, 'time'), 54);
    const g = ctx.createLinearGradient(w / 2 - 90, 0, w / 2 + 90, 0); g.addColorStop(0, '#ff9a4d'); g.addColorStop(0.5, '#ff4f6e'); g.addColorStop(1, '#7c5cff');
    ctx.globalAlpha = A(r, 'bar'); rr(ctx, w / 2 - 90, 300, 180, 14, 7); ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fill();
    const fill = A(r, 'fill');
    if (fill > 0) { rr(ctx, w / 2 - 90, 300, Math.max(14, 124 * fill), 14, 7); ctx.fillStyle = g; ctx.fill(); }
    ctx.globalAlpha = A(r, 'text'); ctx.font = FONT(500, 26); ctx.fillStyle = '#a3a4ad'; ctx.fillText('NEXERA', w / 2, 360);
    ctx.restore();
  }
};
const SCREENS = {
  phone: () => canvasTex(560, 1180, DRAW.phone),
  cover: () => canvasTex(520, 1040, DRAW.cover),
  duo: () => canvasTex(1400, 1000, DRAW.duo),
  mac: () => canvasTex(1440, 940, DRAW.mac),
  keyboard: (pro) => canvasTex(1600, 640, (ctx, w, h) => {
    ctx.fillStyle = pro ? '#0b0b0d' : '#1a1b1f'; ctx.fillRect(0, 0, w, h);
    const rows = 6, cols = 14, gap = 12, kh = (h - gap * (rows + 1)) / rows, kw = (w - gap * (cols + 1)) / cols;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let x = gap + c * (kw + gap), y = gap + r * (kh + gap), ww = kw, hh = r === 0 ? kh * 0.6 : kh;
        if (r === 0) y += kh * 0.4;
        if (r === 5 && c > 3 && c < 9) { if (c > 4) continue; ww = kw * 5 + gap * 4; }
        rr(ctx, x, y, ww, hh, 10); ctx.fillStyle = '#060607'; ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(x + 6, y + 3, ww - 12, 2);
      }
    }
  }),
  watch: () => canvasTex(360, 420, DRAW.watch),
  cavity: () => canvasTex(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#d9d9d6'; ctx.fillRect(0, 0, w, h);
    for (const x of [w * 0.3, w * 0.7]) {
      const g = ctx.createRadialGradient(x, h * 0.5, 0, x, h * 0.5, 70);
      g.addColorStop(0, '#2a2b2e'); g.addColorStop(0.75, '#5a5b5e'); g.addColorStop(1, 'rgba(160,160,160,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, h * 0.5, 72, 60, 0, 0, PI * 2); ctx.fill();
    }
  })
};

/* ---------------------------------------------------------
   Shared bits
   --------------------------------------------------------- */
function lensUnit(r, ringMat, depth = 0.03) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.24, r * 1.3, depth, 48), ringMat);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(r, r, depth + 0.004, 48), mat.lens());
  const inner = new THREE.Mesh(new THREE.CircleGeometry(r * 0.42, 40), new THREE.MeshPhysicalMaterial({ color: 0x1d2b4f, metalness: 0.7, roughness: 0.15, clearcoat: 1 }));
  inner.rotation.x = -PI / 2; inner.position.y = depth / 2 + 0.0026;
  const glint = new THREE.Mesh(new THREE.RingGeometry(r * 0.62, r * 0.7, 40), new THREE.MeshBasicMaterial({ color: 0x5a6a96, transparent: true, opacity: 0.35 }));
  glint.rotation.x = -PI / 2; glint.position.y = depth / 2 + 0.0024;
  g.add(ring, glass, inner, glint);
  g.rotation.x = -PI / 2;          // face backwards (-Z)
  return g;
}
/* Name a mesh or group after the product part it belongs to (used by the showcase and by .glb models). */
const nm = (o, name, role) => { o.name = name; if (role) o.userData.role = role; return o; };
function dot(r, color, opts = {}) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 32), new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, metalness: 0, ...opts }));
  return m;
}
function shadowTexture() {
  return canvasTex(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(10,10,20,.55)'); g.addColorStop(0.45, 'rgba(10,10,20,.22)'); g.addColorStop(1, 'rgba(10,10,20,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
}

/* ---------------------------------------------------------
   iPhone (pro, air, dual, e)
   --------------------------------------------------------- */
const PHONES = {
  pro: { W: 0.72, H: 1.5, D: 0.088, R: 0.118, B: 0.03 },
  air: { W: 0.745, H: 1.56, D: 0.058, R: 0.122, B: 0.022 },
  dual: { W: 0.715, H: 1.496, D: 0.08, R: 0.116, B: 0.026 },
  e: { W: 0.715, H: 1.46, D: 0.078, R: 0.112, B: 0.024 }
};
function buildPhone(kind, hex) {
  const { W, H, D, R, B } = PHONES[kind];
  const back = kind === 'pro' ? mat.alu(hex, 0.38) : mat.glass(hex);
  const frame = kind === 'air' ? mat.polished(hex) : mat.alu(hex, 0.26);
  const g = new THREE.Group();
  g.add(nm(new THREE.Mesh(slab(W, H, D, R, B), [back, frame]), 'frame', 'body'));
  const front = nm(new THREE.Mesh(planeRR(W - B * 1.1, H - B * 1.1, R - B * 0.55), mat.black()), 'display');
  front.position.z = D / 2 + 0.0006; g.add(front);
  const tex = SCREENS.phone();
  const screenMat = mat.screen(tex);
  const screen = nm(new THREE.Mesh(planeRR(W - 0.062, H - 0.062, R - 0.036), screenMat), 'display', 'screen');
  screen.position.z = D / 2 + 0.0012; g.add(screen);
  const island = nm(new THREE.Mesh(planeRR(0.19, 0.056, 0.028), new THREE.MeshBasicMaterial({ color: 0x000000 })), 'display');
  island.position.set(0, H / 2 - 0.085, D / 2 + 0.0018); g.add(island);
  const btn = (x, y, h) => { const m = nm(new THREE.Mesh(slab(0.022, h, D * 0.42, 0.01, 0.007), frame), 'frame', 'button'); m.position.set(x, y, 0); g.add(m); };
  btn(-W / 2 - 0.004, 0.43, 0.07); btn(-W / 2 - 0.004, 0.27, 0.12); btn(-W / 2 - 0.004, 0.12, 0.12); btn(W / 2 + 0.004, 0.22, 0.2);
  if (kind !== 'e') btn(W / 2 + 0.004, -0.18, 0.1);

  const zb = -D / 2;
  const ring = kind === 'pro' ? back : frame;
  let lenses = 0;
  const addLens = (x, y, r, z) => { const l = nm(lensUnit(r, ring), 'lens-' + (++lenses)); l.position.set(x, y, z - 0.015); g.add(l); };
  const addDot = (x, y, r, color, z, opts) => { const d = nm(dot(r, color, opts), 'camera-module'); d.position.set(x, y, z - 0.0008); d.rotation.y = PI; g.add(d); };
  if (kind === 'pro') {
    const pw = W - B * 1.2, ph = 0.5, pd = 0.03;
    const plate = nm(new THREE.Mesh(slab(pw, ph, pd, [R - B * 0.6, R - B * 0.6, 0.05, 0.05], 0.012), [back, frame]), 'camera-module');
    const pz = zb - pd / 2 + 0.004;
    plate.position.set(0, H / 2 - B * 0.6 - ph / 2, pz); g.add(plate);
    const face = pz - pd / 2;
    addLens(0.205, 0.6, 0.068, face); addLens(0.205, 0.405, 0.068, face); addLens(0.04, 0.505, 0.068, face);
    addDot(-0.2, 0.61, 0.03, 0xf4ecd8, face, { emissive: 0x332a18 }); addDot(-0.2, 0.4, 0.03, 0x0a0a0c, face); addDot(-0.08, 0.66, 0.008, 0x222222, face);
  } else if (kind === 'air') {
    const pw = W - 0.09, ph = 0.2, pd = 0.024;
    const bar = nm(new THREE.Mesh(slab(pw, ph, pd, 0.1, 0.01), [back, frame]), 'camera-module');
    const pz = zb - pd / 2 + 0.003; bar.position.set(0, H / 2 - 0.18, pz); g.add(bar);
    const face = pz - pd / 2;
    addLens(0.21, H / 2 - 0.18, 0.06, face); addDot(0.04, H / 2 - 0.18, 0.026, 0xf4ecd8, face, { emissive: 0x332a18 }); addDot(-0.06, H / 2 - 0.18, 0.009, 0x222222, face);
  } else if (kind === 'dual') {
    const pill = nm(new THREE.Mesh(slab(0.205, 0.405, 0.022, 0.1025, 0.009), [back, frame]), 'camera-module');
    const pz = zb - 0.011 + 0.003; pill.position.set(0.21, 0.5, pz); g.add(pill);
    const face = pz - 0.011;
    addLens(0.21, 0.585, 0.058, face); addLens(0.21, 0.415, 0.058, face); addDot(0.05, 0.62, 0.025, 0xf4ecd8, face, { emissive: 0x332a18 });
  } else {
    addLens(0.215, 0.6, 0.06, zb); addDot(0.075, 0.63, 0.022, 0xf4ecd8, zb, { emissive: 0x332a18 });
  }
  return { group: g, recolor: [back, frame], screens: [screenMat], tex: [tex], size: { W, H, D }, kind };
}

/* iPhone Duo: two halves on a hinge. fold 0 = open flat, 1 = closed. */
function buildDuo(hex) {
  const W2 = 0.835, H = 1.178, D = 0.052, R = 0.1, B = 0.016, r0 = 0.012;
  const back = mat.glass(hex), frame = mat.alu(hex, 0.24);
  const texIn = SCREENS.duo(), texCover = SCREENS.cover();
  const inner = mat.screen(texIn), cover = mat.screen(texCover);
  const g = new THREE.Group();
  const ws = W2 - 0.03, hs = H - 0.05;

  const left = nm(new THREE.Mesh(slab(W2, H, D, [R, r0, r0, R], B), [back, frame]), 'frame', 'body');
  left.position.x = -W2 / 2; g.add(left);
  const lf = nm(new THREE.Mesh(planeRR(W2 - B, H - B, [R - 0.008, r0, r0, R - 0.008]), mat.black()), 'display'); lf.position.set(-W2 / 2, 0, D / 2 + 0.0006); g.add(lf);
  const ls = nm(new THREE.Mesh(planeRR(ws, hs, [R - 0.03, 0.003, 0.003, R - 0.03], 0, 0.5, 0, 1), inner), 'display', 'screen'); ls.position.set(-0.002 - ws / 2, 0, D / 2 + 0.0012); g.add(ls);
  // rear cameras on the outer edge of the left half
  const pill = nm(new THREE.Mesh(slab(0.19, 0.37, 0.02, 0.095, 0.008), [back, frame]), 'camera-module');
  pill.position.set(-W2 + 0.17, H / 2 - 0.26, -D / 2 - 0.007); g.add(pill);
  let lenses = 0;
  for (const y of [H / 2 - 0.18, H / 2 - 0.34]) { const l = nm(lensUnit(0.055, frame), 'lens-' + (++lenses)); l.position.set(-W2 + 0.17, y, -D / 2 - 0.017 - 0.015); g.add(l); }

  const hinge = new THREE.Group(); hinge.position.z = D / 2; g.add(hinge);
  const right = nm(new THREE.Mesh(slab(W2, H, D, [r0, R, R, r0], B), [back, frame]), 'frame', 'body'); right.position.set(W2 / 2, 0, -D / 2); hinge.add(right);
  const rf = nm(new THREE.Mesh(planeRR(W2 - B, H - B, [r0, R - 0.008, R - 0.008, r0]), mat.black()), 'display'); rf.position.set(W2 / 2, 0, 0.0006); hinge.add(rf);
  const rs = nm(new THREE.Mesh(planeRR(ws, hs, [0.003, R - 0.03, R - 0.03, 0.003], 0.5, 1, 0, 1), inner), 'display', 'screen'); rs.position.set(0.002 + ws / 2, 0, 0.0012); hinge.add(rs);
  const cb = nm(new THREE.Mesh(planeRR(W2 - B, H - B, [r0, R - 0.008, R - 0.008, r0]), mat.black()), 'cover-display'); cb.position.set(W2 / 2, 0, -D - 0.0006); cb.rotation.y = PI; hinge.add(cb);
  const cs = nm(new THREE.Mesh(planeRR(W2 - 0.07, H - 0.07, R - 0.03), cover), 'cover-display', 'screen'); cs.position.set(W2 / 2, 0, -D - 0.0012); cs.rotation.y = PI; hinge.add(cs);
  const crease = nm(new THREE.Mesh(new THREE.PlaneGeometry(0.006, hs), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.06 })), 'display');
  crease.position.z = D / 2 + 0.0016; g.add(crease);

  const spine = nm(new THREE.Group(), 'hinge'); spine.position.z = D / 2; g.add(spine);
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(D * 0.98, D * 0.98, H - 0.03, 40, 1, false, PI / 2, PI), frame);
  spine.add(sp);

  const setFold = f => { const a = -PI * f; hinge.rotation.y = a; spine.rotation.y = a / 2; crease.visible = f < 0.02; };
  setFold(0);
  return { group: g, recolor: [back, frame], screens: [inner, cover], tex: [texIn, texCover], setFold, size: { W: W2 * 2, H, D, W2 }, hinge, kind: 'duo' };
}

/* ---------------------------------------------------------
   MacBook. open 0 = closed, 1 = open about 108 degrees.
   --------------------------------------------------------- */
function buildMac(pro, hex) {
  const W = 3.04, Dz = 2.15, T = pro ? 0.15 : 0.11, R = 0.17, L = 0.05, Hl = Dz - 0.05;
  const body = mat.alu(hex, pro ? 0.42 : 0.36);
  const g = new THREE.Group();
  const base = nm(new THREE.Mesh(slab(W, Dz, T, R, T * 0.32), [body, body]), 'bottom-case', 'body');
  base.rotation.x = -PI / 2; g.add(base);
  const kb = SCREENS.keyboard(pro);
  const keys = nm(new THREE.Mesh(planeRR(2.62, 0.98, 0.05), mat.decal({ map: kb, roughness: 0.7, metalness: 0.1 })), 'keyboard');
  keys.rotation.x = -PI / 2; keys.position.set(0, T / 2 + 0.002, -0.36); g.add(keys);
  const pad = nm(new THREE.Mesh(planeRR(1.32, 0.82, 0.05), new THREE.MeshPhysicalMaterial({ color: dark(hex, 0.92), metalness: 0.5, roughness: 0.24, clearcoat: 0.6, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 })), 'trackpad');
  pad.rotation.x = -PI / 2; pad.position.set(0, T / 2 + 0.002, 0.52); g.add(pad);
  const lip = nm(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.012, 0.03), new THREE.MeshStandardMaterial({ color: dark(hex, 0.5), roughness: 0.6 })), 'bottom-case');
  lip.position.set(0, T / 2 - 0.004, Dz / 2 - 0.004); g.add(lip);

  const hinge = nm(new THREE.Group(), 'lid'); hinge.position.set(0, T / 2, -Dz / 2 + 0.035); g.add(hinge);
  const lid = new THREE.Group(); hinge.add(lid);
  const shell = nm(new THREE.Mesh(slab(W, Hl, L, R, L * 0.4), [body, body]), 'lid-shell', 'body'); shell.position.set(0, Hl / 2, -L / 2); lid.add(shell);
  const bezel = nm(new THREE.Mesh(planeRR(W - 0.05, Hl - 0.05, R - 0.03), mat.black()), 'lid-display'); bezel.position.set(0, Hl / 2, 0.002); lid.add(bezel);
  const tex = SCREENS.mac();
  const screenMat = mat.screen(tex);
  const screen = nm(new THREE.Mesh(planeRR(W - 0.2, Hl - 0.26, 0.04), screenMat), 'lid-display', 'screen'); screen.position.set(0, Hl / 2 + 0.03, 0.004); lid.add(screen);
  const notch = new THREE.Mesh(planeRR(0.2, 0.07, [0, 0, 0.025, 0.025]), new THREE.MeshBasicMaterial({ color: 0x000000 })); notch.position.set(0, Hl - 0.13 + 0.035 - 0.035 + 0.03 - 0.0, 0.002);
  notch.position.y = Hl / 2 + 0.03 + (Hl - 0.26) / 2 - 0.035; notch.position.z = 0.005; lid.add(notch);
  const cam = nm(dot(0.012, 0x1a1d29), 'lid-display', 'camera'); cam.position.set(0, notch.position.y + 0.012, 0.006); lid.add(cam);
  nm(notch, 'lid-display');

  const setOpen = o => { hinge.rotation.x = lerp(PI / 2, -0.3, o); };
  setOpen(1);
  return { group: g, recolor: [body], screens: [screenMat], tex: [tex], setOpen, hinge, keys, size: { W, H: Hl, D: Dz, T }, kind: pro ? 'mac-pro' : 'mac-air' };
}

/* ---------------------------------------------------------
   Apple Watch (classic and Ultra)
   --------------------------------------------------------- */
function bandColour(hex) {
  const c = new THREE.Color(hex); const hsl = {}; c.getHSL(hsl);
  return new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 0.8 + 0.05), Math.max(0.12, Math.min(0.58, hsl.l * 0.72)));
}
function ultraBand(hex) { const l = new THREE.Color(hex).getHSL({}).l; return new THREE.Color(l > 0.4 ? 0x55624b : 0x24252a); }
function buildWatch(ultra, hex) {
  const W = ultra ? 0.44 : 0.4, H = ultra ? 0.49 : 0.46, D = ultra ? 0.12 : 0.105, R = ultra ? 0.085 : 0.118;
  const caseMat = ultra ? mat.alu(hex, 0.36) : mat.polished(hex);
  if (!ultra) { caseMat.roughness = 0.22; }
  const band = mat.matte(ultra ? ultraBand(hex) : bandColour(hex), ultra ? 0.92 : 0.78);
  const g = new THREE.Group();
  g.add(nm(new THREE.Mesh(slab(W, H, D, R, ultra ? 0.028 : 0.04), [caseMat, caseMat]), 'case-shell', 'body'));
  if (ultra) {
    const rim = nm(new THREE.Mesh(slab(W - 0.03, H - 0.03, 0.02, R - 0.015, 0.006), [caseMat, caseMat]), 'case-shell'); rim.position.z = D / 2 + 0.004; g.add(rim);
  }
  const glass = nm(new THREE.Mesh(planeRR(W - (ultra ? 0.05 : 0.034), H - (ultra ? 0.05 : 0.034), R - 0.02), mat.black()), 'display');
  glass.position.z = D / 2 + (ultra ? 0.0145 : 0.0006); g.add(glass);
  const tex = SCREENS.watch();
  const screenMat = mat.screen(tex);
  const screen = nm(new THREE.Mesh(planeRR(W - (ultra ? 0.08 : 0.06), H - (ultra ? 0.08 : 0.06), R - 0.035), screenMat), 'display', 'screen');
  screen.position.z = glass.position.z + 0.0007; g.add(screen);
  const crown = nm(new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.05, 40), caseMat), 'crown'); crown.rotation.z = PI / 2; crown.position.set(W / 2 + 0.018, 0.07, 0); g.add(crown);
  const side = nm(new THREE.Mesh(slab(0.02, 0.11, 0.034, 0.01, 0.006), caseMat), 'side-button'); side.position.set(W / 2 + 0.004, -0.07, 0); g.add(side);
  if (ultra) {
    const guard = nm(new THREE.Mesh(slab(0.03, 0.2, 0.07, 0.014, 0.01), [caseMat, caseMat]), 'case-shell'); guard.position.set(W / 2 + 0.006, 0.07, 0); g.add(guard);
    const action = nm(new THREE.Mesh(slab(0.022, 0.11, 0.04, 0.01, 0.006), mat.gloss(0xff6a2a)), 'action-button'); action.position.set(-W / 2 - 0.006, 0.08, 0); g.add(action);
  }
  const sensor = nm(new THREE.Mesh(new THREE.CircleGeometry(0.13, 40), mat.black()), 'back-glass'); sensor.position.z = -D / 2 - 0.001; sensor.rotation.y = PI; g.add(sensor);
  // bands: one continuous strap each way, curling back behind the case
  const bw = W * 0.78, bt = 0.036;
  const strap = (dir) => {
    const L = 0.62, n = 48;
    const geo = new THREE.ExtrudeGeometry(rrShape(bw, bt, bt * 0.48), { depth: L, steps: n, bevelEnabled: false, curveSegments: 10 });
    const pos = geo.attributes.position;
    // centreline of the bend, sampled finely
    const samples = 400, Cy = [0], Cz = [0], th = s => 2.35 * Math.pow(s / L, 1.55);
    for (let i = 1; i <= samples; i++) {
      const sM = (i - 0.5) * L / samples, ds = L / samples, a = th(sM);
      Cy.push(Cy[i - 1] + Math.cos(a) * ds); Cz.push(Cz[i - 1] - Math.sin(a) * ds);
    }
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), off = pos.getY(i), sv = pos.getZ(i);
      const k = Math.min(samples, Math.max(0, Math.round(sv / L * samples))), a = th(sv);
      pos.setXYZ(i, x, dir * (Cy[k] + off * Math.sin(a)), Cz[k] + off * Math.cos(a));
    }
    if (dir < 0) geo.scale(1, 1, 1);
    smoothGroups(geo, 60);
    if (dir < 0) { const idx = []; } // mirrored strap keeps outward normals because winding flips with the mirror
    const m = nm(new THREE.Mesh(geo, [band, band]), dir > 0 ? 'band-top' : 'band-bottom');
    m.position.set(0, dir * (H / 2 - 0.05), -0.012);
    if (dir < 0) m.material = [band, band];
    g.add(m);
    if (dir < 0) {
      for (const sv of [0.16, 0.22, 0.28]) {
        const a = th(sv), k = Math.round(sv / L * samples);
        const h = nm(dot(0.011, 0x000000, { roughness: 0.9, side: THREE.DoubleSide }), 'band-bottom');
        h.position.set(0, -(Cy[k] + (bt / 2 + 0.002) * Math.sin(a)) - (H / 2 - 0.05), Cz[k] + (bt / 2 + 0.002) * Math.cos(a) - 0.012);
        h.rotation.x = a; g.add(h);
      }
    }
  };
  strap(1); strap(-1);
  return { group: g, recolor: [caseMat], band, ultra, screens: [screenMat], tex: [tex], size: { W, H, D, R }, kind: ultra ? 'ultra' : 'watch' };
}

/* ---------------------------------------------------------
   AirPods (Pro and standard). open 0..1 lifts the lid, buds 0..1 floats them out.
   --------------------------------------------------------- */
function buildBud(pro, m) {
  const g = new THREE.Group();
  const head = nm(new THREE.Mesh(new THREE.SphereGeometry(0.07, 40, 28), m), 'bud-shell', 'body'); head.scale.set(1, 0.88, 1.08); g.add(head);
  if (pro) {
    const tip = nm(new THREE.Mesh(new THREE.SphereGeometry(0.048, 32, 20), mat.matte(0xd8d9dc, 0.6)), 'ear-tip'); tip.scale.set(1, 0.9, 0.75); tip.position.set(-0.06, 0.005, 0.02); g.add(tip);
  }
  const grille = nm(new THREE.Mesh(new THREE.CircleGeometry(0.018, 24), new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.8 })), 'grille');
  grille.position.set(0.02, 0.03, 0.074); g.add(grille);
  const stem = nm(new THREE.Mesh(new THREE.CapsuleGeometry(0.021, pro ? 0.12 : 0.17, 8, 20), m), 'stem', 'body');
  stem.position.set(0.018, pro ? -0.105 : -0.13, 0.01); stem.rotation.z = 0.12; g.add(stem);
  const cap = nm(new THREE.Mesh(new THREE.CylinderGeometry(0.0205, 0.0205, 0.012, 20), mat.steel()), 'mic-cap'); cap.position.set(0.018 + (pro ? 0.009 : 0.011), pro ? -0.18 : -0.22, 0.01); cap.rotation.z = 0.12; g.add(cap);
  return g;
}
/* A smooth rounded box (superellipsoid). Vertices above `top` or below `bottom` are flattened onto that plane. */
function pebble(a, b, c, n, top = null, bottom = null) {
  const geo = new THREE.SphereGeometry(1, 120, 80);
  const pos = geo.attributes.position, nrm = geo.attributes.normal, e = 2 / n;
  const pw = (v, k) => Math.sign(v) * Math.pow(Math.abs(v), k);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    let x = a * pw(pos.getX(i), e), y = b * pw(pos.getY(i), e), z = c * pw(pos.getZ(i), e);
    v.set(pw(x / a, n - 1) / a, pw(y / b, n - 1) / b, pw(z / c, n - 1) / c);
    if (top !== null && y > top) { y = top; v.set(0, 1, 0); }
    if (bottom !== null && y < bottom) { y = bottom; v.set(0, -1, 0); }
    v.normalize();
    pos.setXYZ(i, x, y, z); nrm.setXYZ(i, v.x, v.y, v.z);
  }
  return geo;
}
function buildPods(pro, hex) {
  const W = pro ? 0.606 : 0.502, H = pro ? 0.454 : 0.462, D = pro ? 0.218 : 0.212;
  const a = W / 2, b = H / 2, c = D / 2, n = pro ? 3.3 : 3.0;
  const shell = mat.gloss(hex);
  const g = new THREE.Group();
  const split = b - (pro ? 0.14 : 0.15);
  const k = Math.pow(1 - Math.pow(Math.abs(split / b), n), 1 / n);   // cross-section scale at the split
  g.add(nm(new THREE.Mesh(pebble(a, b, c, n, split, null), shell), 'case', 'body'));
  const cav = nm(new THREE.Mesh(planeRR(2 * a * k - 0.09, 2 * c * k - 0.06, 0.05), mat.decal({ map: SCREENS.cavity(), roughness: 0.8 })), 'case', 'cavity');
  cav.rotation.x = -PI / 2; cav.position.y = split + 0.0015; g.add(cav);
  // the seam line where the lid meets the case
  const pts = [];
  for (let i = 0; i <= 120; i++) { const t = i / 120 * PI * 2, ct = Math.cos(t), st = Math.sin(t); pts.push(new THREE.Vector3(a * k * Math.sign(ct) * Math.pow(Math.abs(ct), 2 / n), split, c * k * Math.sign(st) * Math.pow(Math.abs(st), 2 / n))); }
  const seam = nm(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 240, 0.0028, 6, true), new THREE.MeshStandardMaterial({ color: 0x9a9a98, roughness: 0.6 })), 'case');
  g.add(seam);
  const hinge = nm(new THREE.Group(), 'lid'); hinge.position.set(0, split, -c * k + 0.03); g.add(hinge);
  const lid = nm(new THREE.Mesh(pebble(a, b, c, n, null, split), shell), 'lid-shell', 'body'); lid.position.set(0, -split, c * k - 0.03); hinge.add(lid);
  const lidIn = new THREE.Mesh(planeRR(2 * a * k - 0.09, 2 * c * k - 0.06, 0.05), mat.decal({ color: 0xc9c9c6, roughness: 0.7 }));
  lidIn.rotation.x = PI / 2; lidIn.position.set(0, -0.0015, c * k - 0.03); hinge.add(lidIn);
  const ly = split - 0.07, lz = c * Math.pow(1 - Math.pow(Math.abs(ly / b), n), 1 / n);
  const led = nm(new THREE.Mesh(new THREE.CircleGeometry(0.0065, 20), new THREE.MeshBasicMaterial({ color: 0x7fe08f })), 'case-led'); led.position.set(0, ly, lz + 0.001); g.add(led);
  if (pro) {
    const ry = -0.11, rx = a * Math.pow(1 - Math.pow(Math.abs(ry / b), n), 1 / n);
    const loop = nm(new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0055, 12, 24), mat.steel()), 'case'); loop.position.set(rx + 0.008, ry, 0); loop.rotation.y = PI / 2; g.add(loop);
  }
  const budMat = mat.gloss(hex);
  const L = nm(buildBud(pro, budMat), 'bud-left'), Rb = nm(buildBud(pro, budMat), 'bud-right'); L.scale.setScalar(1.12); Rb.scale.set(-1.12, 1.12, 1.12);
  g.add(L, Rb);
  const setOpen = o => { hinge.rotation.x = lerp(0, -1.62, o); seam.visible = o < 0.02; };
  const setBuds = t => {
    L.position.set(lerp(-0.1, -0.24, t), lerp(split - 0.05, split + 0.42, t), lerp(0, 0.06, t));
    Rb.position.set(lerp(0.1, 0.24, t), lerp(split - 0.05, split + 0.42, t), lerp(0, 0.06, t));
    L.rotation.set(lerp(0, -0.15, t), lerp(0, 0.6, t), lerp(0, -0.35, t));
    Rb.rotation.set(lerp(0, -0.15, t), lerp(0, -0.6, t), lerp(0, 0.35, t));
    L.visible = Rb.visible = t > 0.02;
  };
  setOpen(1); setBuds(1);
  return { group: g, recolor: [shell, budMat], screens: [], tex: [], setOpen, setBuds, buds: [L, Rb], split, hinge, cav, led, size: { W, H, D, a, b, c, k, n }, pro, kind: pro ? 'pods-pro' : 'pods' };
}

/* AirPods Max */
function buildMax(hex) {
  const cupMat = mat.alu(hex, 0.34);
  const knit = mat.matte(new THREE.Color(hex).lerp(new THREE.Color(0xffffff), 0.25), 0.95);
  const cushion = mat.matte(new THREE.Color(hex).multiplyScalar(0.5), 1);
  const steel = mat.steel();
  const g = new THREE.Group();
  const top = 0.52, rad = 0.7;
  const arc = new THREE.ArcCurve(0, 0, rad, 0.0, PI, false);
  const pts = arc.getPoints(80).map(p => new THREE.Vector3(p.x, p.y + top, 0));
  g.add(nm(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.024, 16), steel), 'headband'));
  const carc = new THREE.ArcCurve(0, 0, rad - 0.075, 0.22, PI - 0.22, false);
  const cpts = carc.getPoints(64).map(p => new THREE.Vector3(p.x, p.y + top, 0));
  const cgeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cpts), 96, 0.045, 20); cgeo.scale(1, 1, 3.2);
  g.add(nm(new THREE.Mesh(cgeo, knit), 'headband'));
  for (const s of [-1, 1]) {
    const side = s > 0 ? 'right' : 'left';
    const arm = nm(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.2, 16), steel), 'headband'); arm.position.set(s * rad, top - 0.08, 0); g.add(arm);
    const yoke = nm(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.016, 12, 24, PI), steel), 'headband'); yoke.position.set(s * rad, top - 0.18, 0); yoke.rotation.y = PI / 2; g.add(yoke);
    const cup = nm(new THREE.Mesh(slab(0.72, 0.86, 0.3, 0.32, 0.1), [cupMat, cupMat]), 'cup-' + side, 'body'); cup.rotation.y = PI / 2; cup.position.set(s * (rad + 0.05), -0.2, 0); g.add(cup);
    const pad = nm(new THREE.Mesh(slab(0.74, 0.88, 0.2, 0.33, 0.08), [cushion, cushion]), 'cushion-' + side); pad.rotation.y = PI / 2; pad.position.set(s * (rad - 0.18), -0.2, 0); g.add(pad);
  }
  const crown = nm(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 28), steel), 'controls'); crown.position.set(rad + 0.05, 0.26, 0.2); g.add(crown);
  const btn = nm(new THREE.Mesh(slab(0.12, 0.03, 0.04, 0.015, 0.01), steel), 'controls'); btn.position.set(rad + 0.05, 0.245, -0.18); g.add(btn);
  return { group: g, recolor: [cupMat], knit, cushion, screens: [], tex: [], size: { W: 1.8, H: 1.8, D: 0.8, rad, top }, kind: 'max' };
}

/* ---------------------------------------------------------
   Build any product by kind
   --------------------------------------------------------- */
export function build(kind, hex) {
  switch (kind) {
    case 'pro': case 'air': case 'dual': case 'e': return buildPhone(kind, hex);
    case 'duo': return buildDuo(hex);
    case 'mac-air': return buildMac(false, hex);
    case 'mac-pro': return buildMac(true, hex);
    case 'watch': return buildWatch(false, hex);
    case 'ultra': return buildWatch(true, hex);
    case 'pods-pro': return buildPods(true, hex);
    case 'pods': return buildPods(false, hex);
    case 'max': return buildMax(hex);
  }
  throw new Error('Unknown product ' + kind);
}
const family = kind => (['pro', 'air', 'dual', 'e'].includes(kind) ? 'phone' : kind.startsWith('mac') ? 'mac' : kind === 'watch' || kind === 'ultra' ? 'watch' : kind === 'duo' ? 'duo' : kind === 'max' ? 'max' : 'pods');

export function recolor(p, hex) {
  const c = new THREE.Color(hex);
  p.recolor.forEach(m => m.color.copy(c));
  if (p.band) p.band.color.copy(p.ultra ? ultraBand(hex) : bandColour(hex));
  if (p.knit) p.knit.color.copy(c).lerp(new THREE.Color(0xffffff), 0.25);
  if (p.cushion) p.cushion.color.copy(c).multiplyScalar(0.5);
}
export function setScreen(p, on) { p.screens.forEach(m => { m.emissiveIntensity = on * 1.05; }); }

/* ---------------------------------------------------------
   Poses and the display animation for each family.
   intro(p, t): t from 0 to 1 over INTRO seconds.
   --------------------------------------------------------- */
export const FRAMING = { phone: [1.16, 0.12], duo: [1.1, 0.14], mac: [1.14, 0.48], watch: [1.14, 0.1], pods: [1.12, 0.22], max: [1.1, 0.14] };
export const INTRO = { phone: 2.4, duo: 2.8, mac: 2.6, watch: 2.2, pods: 2.8, max: 2.2 };
export const REST = {
  phone: { y: -0.42, x: 0.06 }, duo: { y: -0.36, x: 0.12 }, mac: { y: -0.5, x: 0.08 },
  watch: { y: -0.38, x: 0.05 }, pods: { y: -0.32, x: 0.2 }, max: { y: -0.42, x: 0.2 }
};
export function intro(p, kind, t) {
  const fam = family(kind), r = REST[fam], m = p.group;
  const k = ease.outQuint(t), io = ease.inOut(t);
  m.position.y = lerp(-0.25, 0, ease.out(seg(t, 0, 0.6)));
  if (fam === 'phone') {
    m.rotation.y = lerp(PI * 2 + 0.9, r.y, k);
    m.rotation.x = lerp(0.35, r.x, k);
    setScreen(p, ease.out(seg(t, 0.6, 0.95)));
  } else if (fam === 'duo') {
    p.setFold(1 - ease.inOut(seg(t, 0.28, 0.78)));
    m.rotation.y = lerp(-PI * 0.9, r.y, ease.out(seg(t, 0, 0.75)));
    m.rotation.x = lerp(0.3, r.x, io);
    setScreen(p, seg(t, 0.05, 0.25) * (1 - seg(t, 0.3, 0.4)) + ease.out(seg(t, 0.6, 0.95)));
  } else if (fam === 'mac') {
    p.setOpen(ease.inOut(seg(t, 0.15, 0.75)));
    m.rotation.y = lerp(-1.3, r.y, ease.out(seg(t, 0, 0.85)));
    m.rotation.x = r.x;
    setScreen(p, ease.out(seg(t, 0.62, 0.95)));
  } else if (fam === 'watch') {
    m.rotation.y = lerp(PI * 1.4, r.y, k);
    m.rotation.x = lerp(-0.3, r.x, k);
    setScreen(p, ease.out(seg(t, 0.55, 0.85)));
  } else if (fam === 'pods') {
    p.setOpen(ease.outBack(seg(t, 0.25, 0.55)));
    p.setBuds(ease.out(seg(t, 0.45, 0.95)));
    m.rotation.y = lerp(-PI * 1.1, r.y, ease.out(seg(t, 0, 0.7)));
    m.rotation.x = lerp(0.1, r.x, io);
  } else {
    m.rotation.y = lerp(PI * 1.5, r.y, k);
    m.rotation.x = lerp(0.3, r.x, k);
  }
}
export function rest(p, kind) { intro(p, kind, 1); }

/* ---------------------------------------------------------
   Stage: renderer, studio light, camera framing
   --------------------------------------------------------- */
export class Stage {
  constructor(canvas, { dpr = Math.min(window.devicePixelRatio || 1, 2), shadow = true, capture = false } = {}) {
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: capture, powerPreference: 'high-performance' }));
    r.setPixelRatio(dpr);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.setClearColor(0x000000, 0);
    const scene = (this.scene = new THREE.Scene());
    const pm = new THREE.PMREMGenerator(r);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.035).texture;
    pm.dispose();
    const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-2, 3, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(0xffd6c8, 1.1); rim.position.set(3, 1.5, -3); scene.add(rim);
    const fill = new THREE.DirectionalLight(0xc9c2ff, 0.5); fill.position.set(2, -1, 3); scene.add(fill);
    this.camera = new THREE.PerspectiveCamera(26, 1, 0.01, 60);
    this.holder = new THREE.Group(); scene.add(this.holder);
    if (shadow) {
      this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
      this.shadow.rotation.x = -PI / 2; scene.add(this.shadow);
    }
    this.p = null; this.kind = null;
  }
  setSize(w, h) { this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.w = w; this.h = h; }
  load(kind, hex) {
    this.clear();
    this.kind = kind; this.fam = family(kind);
    this.p = build(kind, hex);
    this.holder.rotation.set(0, 0, 0); this.holder.position.set(0, 0, 0);
    this.holder.add(this.p.group);
    rest(this.p, kind);
    this.measure();
    const f = FRAMING[this.fam]; this.frame(f[0], f[1]);
    return this.p;
  }
  clear() {
    if (!this.p) return;
    this.holder.remove(this.p.group);
    this.p.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      ms.forEach(m => { if (m.map) m.map.dispose(); if (m.emissiveMap) m.emissiveMap.dispose(); m.dispose(); });
    });
    this.p = null;
  }
  /* Measure the product as it is posed now (load() measures the finished, resting pose). */
  measure() {
    this.box = new THREE.Box3().setFromObject(this.holder);
    this.sphere = this.box.getBoundingSphere(new THREE.Sphere());
  }
  /* Fit the camera to the measured product, whatever pose the animation is in. */
  frame(margin = 1.12, lift = 0.16) {
    if (!this.sphere) this.measure();
    const box = this.box, sphere = this.sphere;
    const vfov = this.camera.fov * PI / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    const dist = (sphere.radius * margin) / Math.sin(Math.min(vfov, hfov) / 2);
    this.center = sphere.center.clone();
    this.camera.position.copy(this.center).add(new THREE.Vector3(0, lift, 1).normalize().multiplyScalar(dist));
    this.camera.lookAt(this.center);
    this.camera.near = Math.max(0.01, dist * 0.05); this.camera.far = dist * 5; this.camera.updateProjectionMatrix();
    if (this.shadow) {
      this.shadow.position.set(this.center.x, box.min.y - 0.03, this.center.z);
      const s = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 1.15;
      this.shadow.scale.set(s, s * 0.6, 1);
    }
  }
  render() { this.renderer.render(this.scene, this.camera); }
  dispose() { this.clear(); this.renderer.dispose(); }
}

/* Render one still picture. extra: a second, front-facing phone behind the first. */
export function still(stage, kind, hex, { w = 1000, h = 800, mime = 'image/webp', q = 0.86, pose = 'card' } = {}) {
  stage.setSize(w, h);
  fixedTime = '9:41';
  const p = stage.load(kind, hex);
  const fam = family(kind);
  setScreen(p, 1);
  let second = null;
  if (pose === 'card' && fam === 'phone') {
    p.group.rotation.set(0.04, PI - 0.5, 0.02);
    p.group.position.set(-0.22, 0, 0.12);
    second = build(kind, hex); setScreen(second, 1);
    second.group.rotation.set(0.02, 0.32, 0);
    second.group.position.set(0.36, 0.06, -0.3);
    stage.holder.add(second.group);
  }
  if (pose === 'card' && fam === 'pods') {
    p.setOpen(0); p.setBuds(1);
    const [L, Rb] = p.buds;
    L.position.set(-0.36, -0.06, 0.2); L.rotation.set(0.1, 0.9, -0.1);
    Rb.position.set(0.36, -0.06, 0.2); Rb.rotation.set(0.1, -0.9, 0.1);
    p.group.rotation.set(0.16, -0.18, 0);
  }
  if (pose === 'hero' && fam === 'phone') { p.group.rotation.set(0.05, -0.32, 0); }
  if (pose === 'hero' && fam === 'mac') { p.group.rotation.y = -0.3; }
  stage.measure();
  stage.frame(pose === 'card' ? 1.08 : 1.02, fam === 'mac' ? 0.5 : fam === 'pods' ? 0.2 : 0.12);
  stage.render();
  const url = stage.renderer.domElement.toDataURL(mime, q);
  if (second) { stage.holder.remove(second.group); }
  fixedTime = null;
  return url;
}

export const familyOf = family;
/* Building blocks shared with the 3D showcase (showcase/). */
export { THREE, PI, lerp, clamp01, seg, rrShape, smoothGroups, slab, planeRR, mat, dark, canvasTex, markIcon, wallpaper, FONT, rr, lensUnit, dot, pebble, nm };
/* Blend the product's colour from one finish to another (t from 0 to 1). */
export function recolorMix(p, from, to, t) {
  const c = new THREE.Color(from).lerp(new THREE.Color(to), t);
  recolor(p, '#' + c.getHexString());
}
