/* =========================================================
   NEXERA showcase: inside parts, built in code.
   These are simplified illustrations (boards, chips, cells, coils,
   speakers, fans), not the real layout of any product.
   Every builder returns a THREE.Group lying in the XY plane,
   thickness along Z, centred on the origin.
   ========================================================= */
import { THREE, PI, slab, planeRR, canvasTex, mat, rr } from '../studio.js';

/* ---------- tiny seeded random, so every board looks the same each time ---------- */
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/* ---------- textures ---------- */
const cache = new Map();
const once = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };
/* Textures are shared between products, so they must never be disposed with a product. */
const keep = t => { t.userData.shared = true; return t; };

export const TEX = {
  pcb: () => once('pcb', () => keep(canvasTex(512, 512, (ctx, w, h) => {
    const r = rng(7);
    ctx.fillStyle = '#121418'; ctx.fillRect(0, 0, w, h);
    ctx.lineCap = 'round';
    for (let i = 0; i < 90; i++) {
      let x = r() * w, y = r() * h;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) { if (r() < 0.5) x += (r() - 0.5) * 160; else y += (r() - 0.5) * 160; ctx.lineTo(x, y); }
      ctx.strokeStyle = r() < 0.18 ? 'rgba(196,160,92,.55)' : 'rgba(70,78,92,.6)'; ctx.lineWidth = 1 + r() * 1.6; ctx.stroke();
    }
    for (let i = 0; i < 160; i++) { ctx.fillStyle = r() < 0.5 ? 'rgba(201,166,96,.8)' : 'rgba(120,128,140,.6)'; ctx.fillRect(r() * w, r() * h, 3, 3); }
  }))),
  chip: () => once('chip', () => keep(canvasTex(128, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#26282e'); g.addColorStop(1, '#0d0e11');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 2; ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.arc(22, 22, 5, 0, PI * 2); ctx.fill();
  }))),
  cell: () => once('cell', () => keep(canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#2b2d33'; ctx.fillRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(255,255,255,.05)'); g.addColorStop(0.5, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(255,255,255,.03)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 2; ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    for (let i = 0; i < 4; i++) ctx.fillRect(30, 40 + i * 18, 70 + i * 22, 6);
    ctx.font = '600 34px system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillText('+', w - 60, h - 36);
  }))),
  coil: () => once('coil', () => keep(canvasTex(512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < 22; i++) {
      const rad = 92 + i * 7.2;
      ctx.beginPath(); ctx.arc(w / 2, h / 2, rad, 0, PI * 2);
      ctx.strokeStyle = i % 2 ? '#c06a3a' : '#e39a62'; ctx.lineWidth = 5; ctx.stroke();
    }
  }))),
  grille: () => once('grille', () => keep(canvasTex(256, 64, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#0a0a0c';
    for (let x = 8; x < w; x += 14) for (let y = 10; y < h; y += 14) { ctx.beginPath(); ctx.arc(x + ((y / 14) % 2) * 7, y, 3.6, 0, PI * 2); ctx.fill(); }
  }))),
  ring: () => once('ring', () => keep(canvasTex(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2 - 6, 0, PI * 2); ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 3; ctx.stroke();
    for (let i = 0; i < 48; i++) { const a = i / 48 * PI * 2; ctx.fillStyle = i % 4 ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.9)'; ctx.fillRect(w / 2 + Math.cos(a) * (w / 2 - 20) - 1.5, h / 2 + Math.sin(a) * (w / 2 - 20) - 1.5, 3, 3); }
  }))),
  glow: () => once('glow', () => keep(canvasTex(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }))),
  /* Keyboard backlight: the same key layout as the keyboard texture, with light around each key. */
  keyglow: () => once('keyglow', () => keep(canvasTex(1600, 640, (ctx, w, h) => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    const rows = 6, cols = 14, gap = 12, kh = (h - gap * (rows + 1)) / rows, kw = (w - gap * (cols + 1)) / cols;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let x = gap + c * (kw + gap), y = gap + r * (kh + gap), ww = kw, hh = r === 0 ? kh * 0.6 : kh;
        if (r === 0) y += kh * 0.4;
        if (r === 5 && c > 3 && c < 9) { if (c > 4) continue; ww = kw * 5 + gap * 4; }
        rr(ctx, x - 3, y - 3, ww + 6, hh + 6, 13); ctx.fillStyle = 'rgba(255,240,220,.55)'; ctx.fill();
        rr(ctx, x + 2, y + 2, ww - 4, hh - 4, 9); ctx.fillStyle = '#000'; ctx.fill();
        ctx.fillStyle = 'rgba(255,244,230,.8)'; ctx.fillRect(x + ww * 0.3, y + hh * 0.42, ww * 0.4, 3);
      }
    }
  })))
};

/* ---------- materials ---------- */
export const M = {
  pcb: () => new THREE.MeshStandardMaterial({ map: TEX.pcb(), roughness: 0.62, metalness: 0.2 }),
  edge: () => new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.6, metalness: 0.2 }),
  chip: () => new THREE.MeshPhysicalMaterial({ map: TEX.chip(), roughness: 0.3, metalness: 0.25, clearcoat: 0.7, clearcoatRoughness: 0.2 }),
  dark: () => new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.55, metalness: 0.35 }),
  black: () => new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.7, metalness: 0.1 }),
  steel: () => mat.steel(),
  brushed: () => new THREE.MeshPhysicalMaterial({ color: 0xbfc3c9, metalness: 1, roughness: 0.36, clearcoat: 0.2 }),
  gold: () => new THREE.MeshPhysicalMaterial({ color: 0xd8b26a, metalness: 1, roughness: 0.3 }),
  copper: () => new THREE.MeshPhysicalMaterial({ color: 0xcf7d4a, metalness: 1, roughness: 0.28 }),
  cell: () => new THREE.MeshPhysicalMaterial({ map: TEX.cell(), metalness: 0.45, roughness: 0.36, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
  cellSide: () => new THREE.MeshPhysicalMaterial({ color: 0x24262c, metalness: 0.5, roughness: 0.4 }),
  flex: () => new THREE.MeshStandardMaterial({ color: 0xc8862e, roughness: 0.45, metalness: 0.3 }),
  glass: () => new THREE.MeshPhysicalMaterial({ color: 0xe8eef8, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.26, clearcoat: 1, clearcoatRoughness: 0.03, depthWrite: false, side: THREE.DoubleSide }),
  panel: () => new THREE.MeshPhysicalMaterial({ color: 0x0f1116, metalness: 0.4, roughness: 0.25, clearcoat: 0.8 }),
  led: (hex = 0x46e37a) => new THREE.MeshBasicMaterial({ color: hex }),
  accent: () => new THREE.MeshStandardMaterial({ color: 0xff6a5a, emissive: 0xff4f3e, emissiveIntensity: 0.9, roughness: 0.4 }),
  rubber: hex => new THREE.MeshStandardMaterial({ color: hex ?? 0xd9dadd, roughness: 0.62, metalness: 0 }),
  grille: () => new THREE.MeshStandardMaterial({ map: TEX.grille(), transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2, depthWrite: false })
};

const mesh = (geo, m) => new THREE.Mesh(geo, m);
const box = (w, h, d, r = Math.min(w, h, d) * 0.18) => slab(w, h, d, r, Math.min(d * 0.3, r));

/* ---------- builders ---------- */

/* A circuit board with chips. chips: [x, y, w, h, kind] where kind is 'main', 'mem' or 'small'.
   ports: [x, y, w, h] blocks on the edge, lit in the accent colour. */
export function board(w, h, t, { chips = [], ports = [], r = 0.012, seed = 3, bits = 26 } = {}) {
  const g = new THREE.Group();
  g.add(mesh(slab(w, h, t, r, t * 0.3), [M.pcb(), M.edge()]));
  const chipM = M.chip(), memM = M.dark(), smallM = M.black();
  for (const [x, y, cw, ch, kind = 'mem'] of chips) {
    const d = kind === 'main' ? t * 1.6 : kind === 'small' ? t * 0.7 : t * 1.1;
    const m = mesh(box(cw, ch, d), kind === 'main' ? chipM : kind === 'small' ? smallM : memM);
    m.position.set(x, y, t / 2 + d / 2 - 0.0005); g.add(m);
    if (kind === 'main') { // a metal lid on the main chip
      const lid = mesh(box(cw * 0.74, ch * 0.74, d * 0.3), M.brushed()); lid.position.set(x, y, t / 2 + d + d * 0.12); g.add(lid);
    }
  }
  // many tiny components in one draw call
  const rand = rng(seed), unit = Math.min(w, h);
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.dark(), bits);
  const o = new THREE.Object3D();
  for (let i = 0; i < bits; i++) {
    const s = unit * (0.03 + rand() * 0.05);
    o.position.set((rand() - 0.5) * w * 0.86, (rand() - 0.5) * h * 0.86, t / 2 + s * 0.3);
    o.scale.set(s, s * (0.5 + rand()), s * 0.6); o.updateMatrix(); inst.setMatrixAt(i, o.matrix);
  }
  g.add(inst);
  for (const [x, y, pw, ph] of ports) {
    const m = mesh(box(pw, ph, t * 1.4, Math.min(pw, ph) * 0.3), M.accent()); m.position.set(x, y, t * 0.7); g.add(m);
  }
  return g;
}

/* A battery cell: wrapped in dark foil with a plain label. */
export function cell(w, h, d, r = Math.min(w, h) * 0.12) {
  const g = new THREE.Group();
  g.add(mesh(slab(w, h, d, r, d * 0.3), [M.cell(), M.cellSide()]));
  const tab = mesh(box(w * 0.22, h * 0.08, d * 0.3), M.gold()); tab.position.set(0, h / 2 + h * 0.03, 0); g.add(tab);
  return g;
}

/* A round button cell (earbuds). */
export function buttonCell(r, d) {
  const g = new THREE.Group();
  const c = mesh(new THREE.CylinderGeometry(r, r, d, 40), M.brushed()); c.rotation.x = PI / 2; g.add(c);
  const top = mesh(new THREE.CircleGeometry(r * 0.8, 32), M.dark()); top.position.z = d / 2 + 0.0005; g.add(top);
  return g;
}

/* A wireless charging coil: copper rings on a black disc. */
export function coil(rad) {
  const g = new THREE.Group();
  const back = mesh(new THREE.CylinderGeometry(rad * 1.04, rad * 1.04, rad * 0.04, 64), M.black()); back.rotation.x = PI / 2; g.add(back);
  const ring = mesh(new THREE.PlaneGeometry(rad * 2.2, rad * 2.2), new THREE.MeshPhysicalMaterial({ map: TEX.coil(), transparent: true, alphaTest: 0.3, metalness: 0.9, roughness: 0.3, color: 0xffffff }));
  ring.position.z = rad * 0.021; g.add(ring);
  const tail = mesh(box(rad * 0.22, rad * 0.9, rad * 0.03), M.flex()); tail.position.set(rad * 0.55, -rad * 1.1, 0); g.add(tail);
  return g;
}

/* A speaker driver facing +Z: basket, cone, dust cap and magnet. */
export function driver(rad, depth = rad * 0.5) {
  const g = new THREE.Group();
  const ring = mesh(new THREE.TorusGeometry(rad, rad * 0.08, 12, 48), M.dark()); g.add(ring);
  const pts = [new THREE.Vector2(rad * 0.24, -depth * 0.5), new THREE.Vector2(rad * 0.5, -depth * 0.25), new THREE.Vector2(rad * 0.94, 0)];
  const cone = mesh(new THREE.LatheGeometry(pts, 48), new THREE.MeshStandardMaterial({ color: 0x2a2c31, roughness: 0.75, side: THREE.DoubleSide })); cone.rotation.x = PI / 2; g.add(cone);
  const cap = mesh(new THREE.SphereGeometry(rad * 0.26, 24, 12, 0, PI * 2, 0, PI / 2), M.brushed()); cap.rotation.x = PI / 2; cap.position.z = -depth * 0.42; g.add(cap);
  const magnet = mesh(new THREE.CylinderGeometry(rad * 0.46, rad * 0.46, depth * 0.6, 32), M.steel()); magnet.rotation.x = PI / 2; magnet.position.z = -depth * 0.8; g.add(magnet);
  return g;
}

/* A haptic motor: a small brushed block with a flex tail. */
export function motor(w, h, d) {
  const g = new THREE.Group();
  g.add(mesh(box(w, h, d), M.brushed()));
  const band = mesh(box(w * 0.2, h * 1.02, d * 1.02), M.dark()); band.position.x = w * 0.2; g.add(band);
  const tail = mesh(box(w * 0.32, h * 0.5, d * 0.2), M.flex()); tail.position.set(-w * 0.62, 0, 0); g.add(tail);
  return g;
}

/* A small speaker box with a grille on the front. */
export function speaker(w, h, d) {
  const g = new THREE.Group();
  g.add(mesh(box(w, h, d), M.dark()));
  const gr = mesh(new THREE.PlaneGeometry(w * 0.84, h * 0.6), M.grille()); gr.position.z = d / 2 + 0.0008; g.add(gr);
  return g;
}

/* Microphone capsules in a row. */
export function mics(n, r, gap) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const m = mesh(new THREE.CylinderGeometry(r, r, r * 0.9, 24), M.brushed()); m.rotation.x = PI / 2; m.position.x = (i - (n - 1) / 2) * gap; g.add(m);
    const top = mesh(new THREE.CircleGeometry(r * 0.62, 20), M.black()); top.position.set(m.position.x, 0, r * 0.46); g.add(top);
  }
  return g;
}

/* A health sensor array: green lights and light sensors around a centre lens. */
export function sensorArray(rad) {
  const g = new THREE.Group();
  const disc = mesh(new THREE.CylinderGeometry(rad, rad, rad * 0.08, 48), M.black()); disc.rotation.x = PI / 2; g.add(disc);
  const lens = mesh(new THREE.CircleGeometry(rad * 0.3, 32), new THREE.MeshPhysicalMaterial({ color: 0x0d1424, metalness: 0.4, roughness: 0.05, clearcoat: 1 })); lens.position.z = rad * 0.045; g.add(lens);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * PI * 2, led = i % 2 === 0;
    const m = mesh(led ? new THREE.CircleGeometry(rad * 0.07, 16) : new THREE.PlaneGeometry(rad * 0.12, rad * 0.12), led ? M.led() : M.dark());
    m.position.set(Math.cos(a) * rad * 0.62, Math.sin(a) * rad * 0.62, rad * 0.046); g.add(m);
  }
  return g;
}

/* A cooling fan lying flat in XZ (axis along Y). Returns the group; the rotor is group.userData.rotor. */
export function fan(rad, h) {
  const g = new THREE.Group();
  const house = mesh(new THREE.CylinderGeometry(rad * 1.08, rad * 1.08, h, 48, 1, true), new THREE.MeshStandardMaterial({ color: 0x1d1f24, roughness: 0.6, metalness: 0.3, side: THREE.DoubleSide })); g.add(house);
  const plate = mesh(new THREE.CylinderGeometry(rad * 1.08, rad * 1.08, h * 0.08, 48), M.dark()); plate.position.y = -h / 2; g.add(plate);
  const rotor = new THREE.Group(); g.add(rotor);
  rotor.add(mesh(new THREE.CylinderGeometry(rad * 0.3, rad * 0.3, h * 0.8, 32), M.brushed()));
  const bladeGeo = new THREE.BoxGeometry(rad * 0.72, h * 0.66, rad * 0.06); bladeGeo.translate(rad * 0.62, 0, 0);
  const blades = new THREE.InstancedMesh(bladeGeo, new THREE.MeshStandardMaterial({ color: 0x30333a, roughness: 0.5, metalness: 0.2 }), 24);
  const o = new THREE.Object3D();
  for (let i = 0; i < 24; i++) { o.rotation.set(0.35, i / 24 * PI * 2, 0); o.updateMatrix(); blades.setMatrixAt(i, o.matrix); }
  rotor.add(blades);
  g.userData.rotor = rotor;
  return g;
}

/* A cooling plate with a heat pipe (fanless designs). Lies flat in XZ. */
export function heatPlate(w, d, t) {
  const g = new THREE.Group();
  const p = mesh(box(w, d, t), M.copper()); p.rotation.x = -PI / 2; g.add(p);
  const pipe = mesh(new THREE.CapsuleGeometry(t * 0.9, w * 0.8, 6, 16), M.copper()); pipe.rotation.z = PI / 2; pipe.position.y = t * 1.2; g.add(pipe);
  return g;
}

/* Thin cover glass. */
export function glass(w, h, t, r) { return mesh(slab(w, h, t, r, t * 0.45), M.glass()); }

/* The display panel seen from the side: a thin dark sheet with a flex cable. */
export function panel(w, h, t, r) {
  const g = new THREE.Group();
  g.add(mesh(slab(w, h, t, r, t * 0.3), [M.panel(), M.edge()]));
  const tail = mesh(box(w * 0.3, h * 0.1, t * 0.6), M.flex()); tail.position.set(0, -h / 2 - h * 0.03, -t * 0.4); g.add(tail);
  return g;
}

/* A flat plate in a given material (frames, midplates, decks, back glass). */
export function plate(w, h, t, r, m) { return mesh(slab(w, h, t, r, t * 0.35), Array.isArray(m) ? m : [m, m]); }

/* Ports: small dark slots, for the outside of a case. Each is [x, y, w, h]. Faces +Z. */
export function slots(list, depth = 0.01) {
  const g = new THREE.Group(), m = M.black();
  for (const [x, y, w, h] of list) { const s = mesh(planeRR(w, h, Math.min(w, h) * 0.45), m); s.position.set(x, y, depth); g.add(s); }
  return g;
}

/* A row of grille holes as one flat decal, facing +Z. */
export function grille(w, h) { return mesh(new THREE.PlaneGeometry(w, h), M.grille()); }

/* A soft additive light, for glows inside cases. */
export function glowSprite(size, hex = 0xffffff, opacity = 0.8) {
  const m = mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: TEX.glow(), color: hex, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  m.userData.glow = true;
  return m;
}

/* Floating HUD rings for detail close-ups. */
export function hudRing(rad, hex = 0xffffff) {
  return mesh(new THREE.PlaneGeometry(rad * 2, rad * 2), new THREE.MeshBasicMaterial({ map: TEX.ring(), color: hex, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
}

/* A thin antenna strip. */
export function antenna(len, w) { return mesh(box(w, len, w * 0.3, w * 0.4), M.gold()); }
