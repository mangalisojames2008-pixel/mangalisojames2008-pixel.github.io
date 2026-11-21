/* =========================================================
   NEXERA product showcase
   One shared system behind every product view:
   - the entrance (glow, display word, product, text)
   - free rotation (drag on both axes, momentum, spring back, preset angles)
   - "Look inside" (the product opens into labelled layers)
   - the scroll story (count-up, callouts, screen close-up, colour, finale, compare table)
   Each product family has one settings file in showcase/products/.
   ========================================================= */
import * as S from '../studio.js';
import * as P from './parts.js';
import WATCH from './products/watch.js';
import PHONE from './products/phone.js';
import MAC from './products/mac.js';
import PODS from './products/pods.js';

/* GSAP ships as a classic browser script, so it is added as a <script> the first time the showcase loads. */
const script = src => new Promise((ok, fail) => {
  if (document.querySelector(`script[data-src="${src}"]`)) return ok();
  const s = document.createElement('script');
  s.src = new URL(src, import.meta.url).href; s.dataset.src = src; s.async = false;
  s.onload = ok; s.onerror = () => fail(new Error('Could not load ' + src));
  document.head.append(s);
});
if (!window.gsap) await script('../vendor/gsap.min.js');
if (!window.ScrollTrigger) await script('../vendor/ScrollTrigger.min.js');
const { THREE, PI, lerp, clamp01, seg, ease } = S;
const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
gsap.registerPlugin(ScrollTrigger);

export const CONFIGS = [WATCH, PHONE, MAC, PODS];
/* The settings for one product kind: the family file, with that kind's variant on top (e.g. the foldable). */
export const configFor = art => {
  const base = CONFIGS.find(c => c.arts.includes(art));
  const v = base?.variants?.[art];
  return v ? { ...base, ...v } : base;
};

const smooth = t => t * t * (3 - 2 * t);
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NS = 'http://www.w3.org/2000/svg';
const TILT = 0.52;            // drag tilt limit, about 30 degrees
const IDLE = 3000;            // ms before the product springs back

/* ---------------------------------------------------------
   Words. New text in the showcase never uses Apple's names for
   parts or features. safe() drops existing spec text that does.
   --------------------------------------------------------- */
const APPLE_TERMS = /\b(Apple|iPhone|AirPods|MacBook|Ceramic Shield|MagSafe|Digital Crown|Taptic|Dynamic Island|Force Touch|Center Stage|Fusion|Retina|XDR|Live Translation|Spatial Audio|Lossless|Adaptive Audio|Hearing Aid|Low Power Mode|Active Noise Cancellation|Thunderbolt|H2|A\d{2}(?: Pro)?|M\d(?: Pro| Max)?|S1\d)\b/;
export function safe(text) {
  if (text == null) return null;
  const t = String(text).replace(/\s*\([^)]*\)/g, m => (APPLE_TERMS.test(m) ? '' : m)).trim();
  return t && !APPLE_TERMS.test(t) ? t : null;
}
/* The big faint word behind the product: the model name without the family name. */
export const wordOf = p => p.name.replace(/^(Apple Watch|iPhone|AirPods|MacBook)\s*/, '').replace(/-inch$/, '').trim() || p.name;

/* The glow colour for a finish: keep its hue, make it light enough to glow. */
function tint(hex) {
  const hsl = {}; new THREE.Color(hex).getHSL(hsl);
  if (hsl.s < 0.1) return new THREE.Color().setHSL(0.62, 0.14, Math.max(0.46, Math.min(0.7, hsl.l)));
  return new THREE.Color().setHSL(hsl.h, Math.max(0.42, Math.min(0.78, hsl.s * 1.25)), Math.max(0.46, Math.min(0.66, hsl.l)));
}

/* ---------------------------------------------------------
   Leader lines and labels, drawn over the 3D canvas
   --------------------------------------------------------- */
class Overlay {
  constructor(svg, box) { this.svg = svg; this.box = box; this.items = new Map(); }
  item(key, text, part) {
    let it = this.items.get(key);
    if (it) return it;
    const path = document.createElementNS(NS, 'path'); path.setAttribute('pathLength', '1');
    const dot = document.createElementNS(NS, 'circle'); dot.setAttribute('r', '3.2');
    this.svg.append(path, dot);
    const el = document.createElement(part ? 'button' : 'span');
    el.className = 'pv__label'; el.textContent = text;
    if (part) { el.type = 'button'; el.dataset.part = part; el.setAttribute('aria-pressed', 'false'); el.tabIndex = -1; }
    this.box.append(el);
    it = { key, el, path, dot, on: false, y: null, w: el.offsetWidth || 80, h: el.offsetHeight || 24 };
    this.items.set(key, it);
    return it;
  }
  set(it, on) {
    if (it.on === on) return;
    it.on = on;
    it.el.classList.toggle('is-on', on); it.path.classList.toggle('is-on', on); it.dot.classList.toggle('is-on', on);
    if (it.el.tagName === 'BUTTON') it.el.tabIndex = on ? 0 : -1;
    if (!on) it.y = null;
  }
  /* list: [{ it, x, y, show }] in layer pixels; rect is where the product is. */
  layout(list, rect) {
    const shown = list.filter(l => l.show);
    for (const l of list) this.set(l.it, l.show);
    if (!shown.length) return;
    for (const l of shown) if (!l.it.w || l.it.w < 4) { l.it.w = l.it.el.offsetWidth; l.it.h = l.it.el.offsetHeight; }
    const [rx, ry, rw, rh] = rect, pad = 10, gap = 6;
    const cx = shown.reduce((s, l) => s + l.x, 0) / shown.length;
    const left = [], right = [];
    for (const l of shown) (l.x < cx ? left : right).push(l);
    // keep the two columns roughly balanced
    while (left.length > right.length + 2) { left.sort((a, b) => b.x - a.x); right.push(left.shift()); }
    while (right.length > left.length + 2) { right.sort((a, b) => a.x - b.x); left.push(right.shift()); }
    const top = Math.max(0, ry) + 8, bottom = ry + rh - 8;
    const place = (col, isLeft) => {
      col.sort((a, b) => a.y - b.y);
      let y = -1e9;
      for (const l of col) { const h = l.it.h; l.ty = Math.max(l.y, y + h + gap, top + h / 2); y = l.ty; }
      let lim = bottom;
      for (let i = col.length - 1; i >= 0; i--) { const l = col[i], h = l.it.h; if (l.ty + h / 2 > lim) l.ty = lim - h / 2; lim = l.ty - h / 2 - gap; }
      const edge = isLeft ? Math.min(...col.map(l => l.x)) - 34 : Math.max(...col.map(l => l.x)) + 34;
      for (const l of col) {
        const it = l.it, w = it.w, h = it.h;
        it.y = it.y == null ? l.ty : lerp(it.y, l.ty, 0.35);
        let lx = isLeft ? Math.max(rx + pad, edge - w) : Math.min(rx + rw - pad - w, edge);
        lx = Math.max(4, lx);
        const ax = isLeft ? lx + w + 6 : lx - 6, ex = isLeft ? ax + 14 : ax - 14;
        it.el.style.transform = `translate(${lx.toFixed(1)}px, ${(it.y - h / 2).toFixed(1)}px)`;
        it.path.setAttribute('d', `M${l.x.toFixed(1)},${l.y.toFixed(1)}L${ex.toFixed(1)},${it.y.toFixed(1)}L${ax.toFixed(1)},${it.y.toFixed(1)}`);
        it.dot.setAttribute('cx', l.x.toFixed(1)); it.dot.setAttribute('cy', l.y.toFixed(1));
      }
    };
    place(left, true); place(right, false);
  }
  clear() { this.svg.replaceChildren(); this.box.replaceChildren(); this.items.clear(); }
}

/* ---------------------------------------------------------
   The showcase
   --------------------------------------------------------- */
export class Showcase {
  /* els: the view's elements (see main.js). hooks: { families, products, pickColour(i), add(btn), price(), money } */
  constructor(els, hooks) {
    this.els = els; this.hooks = hooks;
    this.token = 0; this.alive = false; this.raf = 0;
    this.overlay = new Overlay(els.lines, els.labels);
    this.narrowMQ = window.matchMedia('(max-width: 860px)');
    this.triggers = []; this.tweens = [];
    this.bind();
  }

  /* ---------------- events ---------------- */
  bind() {
    const e = this.els;
    e.layer.addEventListener('pointerdown', ev => this.onDown(ev));
    window.addEventListener('pointermove', ev => this.onMove(ev), { passive: true });
    window.addEventListener('pointerup', ev => this.onUp(ev, false));
    window.addEventListener('pointercancel', ev => this.onUp(ev, true));
    e.layer.addEventListener('keydown', ev => this.onKey(ev));
    e.views.addEventListener('click', ev => { const b = ev.target.closest('[data-angle]'); if (b) this.view(b.dataset.angle); });
    e.inside.addEventListener('click', () => this.toggleInside());
    e.lid.addEventListener('click', () => this.toggleLid());
    e.replay.addEventListener('click', () => this.replay());
    e.labels.addEventListener('click', ev => { const b = ev.target.closest('[data-part]'); if (b) this.select(this.sel?.id === b.dataset.part ? null : b.dataset.part); });
    e.partClose.addEventListener('click', () => this.select(null));
    e.cue.addEventListener('click', () => e.panel.scrollTo({ top: e.story.offsetTop, behavior: this.reduced ? 'auto' : 'smooth' }));
    e.story.addEventListener('click', ev => {
      const sw = ev.target.closest('[data-sx-colour]');
      if (sw) { this.hooks.pickColour(+sw.dataset.sxColour); return; }
      const add = ev.target.closest('[data-sx-add]');
      if (add) { this.hooks.add(add); return; }
      if (ev.target.closest('[data-sx-top]')) e.panel.scrollTo({ top: 0, behavior: this.reduced ? 'auto' : 'smooth' });
    });
    const resize = () => { if (this.alive) this.resize(); };
    window.addEventListener('resize', resize);
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(e.panel);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && this.alive) this.last = performance.now(); });
  }
  onDown(ev) {
    if (!this.alive || ev.button > 0 || ev.target.closest('button, a, .pv__part')) return;
    this.ptr = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, sx: ev.clientX, sy: ev.clientY, t: performance.now(), moved: 0, mode: ev.pointerType === 'mouse' ? 'rotate' : 'pending' };
    if (this.ptr.mode === 'rotate') this.beginRotate();
  }
  beginRotate() {
    const r = this.rot; r.vy = r.vp = 0; r.mode = 'free'; r.fast = false;
    this.els.root.classList.add('is-dragging', 'is-hinted');
    this.markView(null);
  }
  onMove(ev) {
    const p = this.ptr;
    if (!p || ev.pointerId !== p.id) return;
    const dx = ev.clientX - p.x, dy = ev.clientY - p.y;
    if (p.mode === 'pending') {
      const tx = ev.clientX - p.sx, ty = ev.clientY - p.sy;
      if (Math.abs(tx) > 6 && Math.abs(tx) > Math.abs(ty) * 1.1) { p.mode = 'rotate'; this.beginRotate(); }
      else if (Math.abs(ty) > 8) { this.ptr = null; return; }      // a vertical swipe: let the page scroll
      else return;
    }
    p.moved += Math.abs(dx) + Math.abs(dy);
    const now = performance.now(), dt = Math.max(8, now - p.t) / 1000, r = this.rot;
    const over = Math.abs(r.pitch) > TILT && Math.sign(dy) === Math.sign(r.pitch) ? 0.3 : 1;
    r.yaw += dx * 0.0095; r.pitch += dy * 0.0075 * over;
    r.vy = lerp(r.vy, dx * 0.0095 / dt, 0.5); r.vp = lerp(r.vp, dy * 0.0075 * over / dt, 0.5);
    p.x = ev.clientX; p.y = ev.clientY; p.t = now; r.last = now;
  }
  onUp(ev, cancelled) {
    const p = this.ptr;
    if (!p || ev.pointerId !== p.id) return;
    this.ptr = null;
    this.els.root.classList.remove('is-dragging');
    const now = performance.now();
    if (p.mode === 'rotate') { this.rot.last = now; if (now - p.t > 90) { this.rot.vy = 0; this.rot.vp = 0; } }
    if (!cancelled && p.moved < 6 && p.mode !== 'pending' && this.sel) this.select(null);
  }
  onKey(ev) {
    if (!this.alive || ev.target !== this.canvas) return;
    const r = this.rot, k = { ArrowLeft: [-2.6, 0], ArrowRight: [2.6, 0], ArrowUp: [0, -1.6], ArrowDown: [0, 1.6] }[ev.key];
    if (!k) return;
    ev.preventDefault(); r.mode = 'free'; r.vy += k[0]; r.vp += k[1]; r.last = performance.now(); this.markView(null);
  }

  /* ---------------- open ---------------- */
  async open(product, pick, { reduced = false } = {}) {
    this.close();
    const token = ++this.token;
    const cfg = configFor(product.art);
    if (!cfg) throw new Error('No showcase settings for ' + product.art);
    const e = this.els;
    Object.assign(this, { product, cfg, reduced, pick, inside: false, sel: null, storyW: 0 });
    e.root.classList.add('is-sc');
    e.root.classList.toggle('is-reduced', reduced);
    e.root.classList.remove('is-inside', 'is-hinted');
    e.lid.hidden = !cfg.lid; e.lid.textContent = 'Close lid'; e.lid.setAttribute('aria-pressed', 'false');
    e.inside.setAttribute('aria-pressed', 'false');
    // a fresh canvas each time, so the old WebGL context can be released completely
    const old = e.layer.querySelector('canvas');
    const canvas = this.canvas = old.cloneNode(false);
    old.replaceWith(canvas);
    this.layout();
    this.dpr = this.dprCap = Math.min(window.devicePixelRatio || 1, 2);
    const stage = this.stage = new S.Stage(canvas, { dpr: this.dpr });
    stage.setSize(this.W, this.H);
    stage.camera.fov = 26;
    // the product, on a pivot so it turns about its own centre
    const hex = product.colours[pick.c][1];
    const p = this.p = S.build(product.art, hex);
    this.col = { from: hex, to: hex, t: 1, now: hex };
    this.pivot = new THREE.Group(); stage.holder.add(this.pivot); this.pivot.add(p.group);
    const x = this.x = this.context();
    cfg.build?.(x);
    const model = cfg.models?.[product.art];
    if (model) {
      cfg.entrance.play(p, 1, x);   // models are placed in the resting pose, the same pose tools/export.html saves
      try { await this.loadModel(model); } catch (err) { console.warn('NEXERA showcase: model not loaded, using the built-in one.', err); }
    }
    if (token !== this.token) { this.dispose(); return; }
    this.makeParts();
    this.makeMaterials();
    cfg.entrance.play(p, 1, x);
    this.measure();
    this.makeZoom();
    this.makeAngles();
    this.buildStory();
    this.word();
    // the explode timeline (staggered, reversible)
    this.ex = { v: 0 };
    const xtl = this.xtl = gsap.timeline({ paused: true });
    this.parts.forEach((pt, i) => xtl.to(pt, { k: 1, duration: 1.05, ease: 'power3.inOut' }, (pt.spec.at ?? i) * 0.075));
    xtl.to(this.ex, { v: 1, duration: Math.max(0.6, xtl.duration() * 0.85), ease: 'power2.inOut' }, 0);
    // state
    this.rot = { yaw: 0, pitch: 0, vy: 0, vp: 0, ty: 0, tp: 0, mode: 'settle', fast: false, last: 0 };
    this.cur = null; this.glowCol = tint(hex); this.sway = 0;
    this.fx = { t: reduced ? 1 : 0, glow: reduced ? 1 : 0, word: reduced ? 1 : 0, wordX: 0 };
    this.markView(null);
    cfg.entrance.play(p, this.fx.t, x);
    this.alive = true;
    this.last = performance.now();
    this.perf = { acc: 0, n: 0, slow: 0, good: 0 };
    e.root.classList.remove('is-sc-wait');
    if (!reduced) this.playEntrance(); else this.showInfo();
    this.precompile();
    this.raf = requestAnimationFrame(t => this.tick(t));
    e.root.classList.add('is-3d');
    if (/nexera-debug/.test(location.search)) window.__showcase = this;
    setTimeout(() => { if (this.alive && token === this.token) this.resize(); }, 900);
  }

  /* Prepare the shaders for the hidden parts too, so the first "Look inside" does not stutter. */
  precompile() {
    const hidden = [];
    this.stage.scene.traverse(o => { if (!o.visible && (o.isMesh || o.isGroup)) { hidden.push(o); o.visible = true; } });
    this.layerBox = this.els.layer.getBoundingClientRect();
    this.frame(this.cur || this.heroState());
    const done = this.stage.renderer.compileAsync ? this.stage.renderer.compileAsync(this.stage.scene, this.stage.camera) : null;
    hidden.forEach(o => { o.visible = false; });
    done?.catch(() => {});
  }

  /* What the product settings files can use. */
  context() {
    const self = this, p = this.p, product = this.product;
    const find = (name, scope = p.group) => { let hit = null; scope.traverse(o => { if (!hit && o.name === name) hit = o; }); return hit; };
    return {
      THREE, PI, S, P, product, art: product.art, p, size: p.size, state: {},
      node: (name, within) => find(name, within ? find(within) || p.group : p.group),
      add(obj, id, { parent, internal = true } = {}) {
        obj.name = id;
        const host = typeof parent === 'string' ? find(parent) : parent || p.group;
        (host || p.group).add(obj);
        if (internal) obj.userData.internal = true;
        return obj;
      },
      spec: key => product.specs?.[key] ?? null,
      fact: re => product.facts.find(f => re.test(f)) ?? null,
      safe,
      /* "6.3-inch" from "6.3-inch Super Retina XDR" */
      inch: text => (String(text || '').match(/^[\d.]+-inch/) || [null])[0],
      paint: (i, r) => self.paint(i, r),
      get storyW() { return self.storyW; },
      get explode() { return self.ex ? self.ex.v : 0; },
      get done() { return self.fx ? self.fx.t >= 1 : true; },
      get now() { return performance.now(); }
    };
  }

  /* Paint a screen texture with some parts faded, only when something changed. */
  paint(i, r, force) {
    const tex = this.p.tex[i];
    if (!tex) return;
    if (!force && this.zoom?.on && i === (this.zoom.spec.tex || 0)) return;   // the close-up owns this screen
    const key = r ? Object.keys(r).map(k => k + (Math.round(r[k] * 40) / 40)).join() : 'full';
    tex.userData.key ??= 'full';
    if (tex.userData.key === key) return;
    tex.userData.key = key;
    tex.userData.paint(r);
  }

  /* Swap built-in parts for parts from a .glb file (see models/README.md). */
  async loadModel(spec) {
    const { GLTFLoader } = await import('../vendor/GLTFLoader.js');
    const gltf = await new GLTFLoader().loadAsync(new URL(spec.url, document.baseURI).href);
    const root = gltf.scene, p = this.p, cfg = this.cfg;
    if (spec.scale) root.scale.setScalar(spec.scale);
    if (spec.position) root.position.fromArray(spec.position);
    if (spec.rotation) root.rotation.fromArray(spec.rotation);
    p.group.add(root); p.group.updateMatrixWorld(true);
    // materials named "body" follow the colour swatches; "screen" shows the animated lock screen
    const body = p.recolor[0], screen = p.screens[0];
    root.traverse(o => {
      if (!o.isMesh) return;
      const swap = m => (m.name === 'body' && body) ? body : (m.name === 'screen' && screen) ? screen : m;
      o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    });
    const ids = [...cfg.parts.map(s => s.id), ...(cfg.swappable || [])];
    let used = 0;
    for (const id of ids) {
      const g = root.getObjectByName(id);
      if (!g) continue;
      const spec2 = cfg.parts.find(s => s.id === id);
      const scope = (spec2?.within && this.x.node(spec2.within)) || p.group;
      const names = new Set([id, ...(spec2?.nodes || [])]);
      const built = [];
      scope.traverse(o => { if (names.has(o.name) && !o.userData.replaced && !isInside(o, root)) built.push(o); });
      if (!built.length) continue;
      const first = built[0], internal = !!first.userData.internal;
      if (first.isGroup && built.length === 1 && first.children.length && !internal) {
        // a moving group (a hinge, a lid, an earbud): keep it and its motion, swap what is inside
        first.children.slice().forEach(c => { c.visible = false; c.userData.replaced = true; c.name = (c.name || 'part') + ':built-in'; });
        g.children.slice().forEach(c => first.add(c));
      } else {
        built.forEach(o => { o.visible = false; o.userData.replaced = true; o.name = id + ':built-in'; });
        first.parent.attach(g);
        if (internal) g.userData.internal = true;
      }
      used++;
    }
    console.info(`NEXERA showcase: ${used} parts loaded from ${spec.url}`);
  }

  /* Collect the named parts listed in the settings file. */
  makeParts() {
    const p = this.p, x = this.x;
    this.parts = []; this.partOf = new Map();
    const make = spec => ({ spec, id: spec.id, label: spec.label || null, group: spec.group || null, nodes: [], home: [], k: 0, dim: 0, dimT: 0, cache: new Map() });
    for (const spec of this.cfg.parts) {
      if (spec.only && !spec.only(x)) continue;
      const pt = make(spec);
      const scope = spec.within ? x.node(spec.within) || p.group : p.group;
      const names = new Set([spec.id, ...(spec.nodes || [])]);
      const visit = o => { if (names.has(o.name) && !o.userData.replaced) { pt.nodes.push(o); return; } o.children.forEach(visit); };
      visit(scope);
      if (!pt.nodes.length) continue;
      pt.home = pt.nodes.map(n => n.position.clone());
      pt.off = new THREE.Vector3().fromArray(spec.off || [0, 0, 0]);
      pt.internal = pt.nodes.map(n => !!n.userData.internal);
      pt.desc = typeof spec.desc === 'function' ? spec.desc(x) : spec.desc;
      if (!pt.desc) pt.desc = spec.generic || '';
      pt.nodes.forEach(n => this.partOf.set(n, pt));
      this.parts.push(pt);
    }
    this.rest = make({ id: '__rest' });
    // internals stay hidden until the product opens up
    this.applyParts();
  }
  applyParts() {
    for (const pt of this.parts) {
      const k = pt.k;
      pt.nodes.forEach((n, i) => {
        n.position.copy(pt.home[i]).addScaledVector(pt.off, k);
        if (pt.internal[i]) n.visible = k > 0.002;
      });
      if (pt.faces) for (const f of pt.faces) f.mesh.material[0] = k > 0.002 ? f.mid : f.orig;
      pt.spec.update?.(k, this.x, pt);
    }
  }

  /* Every part gets its own copies of its materials, so one part can be highlighted while the rest fade.
     The originals stay the source of truth (colour changes and screens write to them). */
  makeMaterials() {
    this.pairs = [];
    const ownerOf = o => { for (let a = o; a; a = a.parent) { const pt = this.partOf.get(a); if (pt) return pt; if (a === this.p.group) break; } return this.rest; };
    const cloneFor = (pt, m) => {
      let c = pt.cache.get(m);
      if (!c) { c = m.clone(); pt.cache.set(m, c); this.pairs.push({ o: m, c, pt }); }
      return c;
    };
    this.p.group.traverse(o => {
      if (!o.isMesh) return;
      const pt = ownerOf(o);
      const list = Array.isArray(o.material) ? o.material : [o.material];
      const out = list.map(m => cloneFor(pt, m));
      o.material = Array.isArray(o.material) ? out : out[0];
      // frames turn into a plain midplate when the product opens (the back glass flies off separately)
      if (pt.spec.faces && o.userData.role === 'body' && Array.isArray(o.material)) {
        pt.faces ??= [];
        const mid = cloneFor(pt, this.x.midplate ??= new THREE.MeshPhysicalMaterial({ color: 0x9ea2a8, metalness: 0.9, roughness: 0.34 }));
        pt.faces.push({ mesh: o, orig: o.material[0], mid });
      }
    });
  }
  syncMaterials() {
    for (const { o, c, pt } of this.pairs) {
      c.color.copy(o.color);
      if (o.emissive) { c.emissive.copy(o.emissive); c.emissiveIntensity = o.emissiveIntensity; }
      const d = pt.dim;
      c.opacity = o.opacity * (1 - 0.88 * d);
      const tr = o.transparent || d > 0.003;
      if (c.transparent !== tr) { c.transparent = tr; c.needsUpdate = true; }
      c.depthWrite = o.depthWrite && d < 0.5;
    }
  }

  /* Measure the resting and the opened-up product, and centre it on the pivot. */
  measure() {
    const holder = this.stage.holder;
    holder.rotation.set(0, 0, 0); this.pivot.position.set(0, 0, 0);
    this.p.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.p.group);
    const c = box.getCenter(new THREE.Vector3());
    this.pivot.position.copy(c).negate();
    holder.updateMatrixWorld(true);
    this.box0 = box.clone().translate(c.clone().negate());
    this.sph0 = this.box0.getBoundingSphere(new THREE.Sphere());
    this.sph0.radius *= this.cfg.fit ?? 1;
    for (const pt of this.parts) pt.k = 1;
    this.applyParts(); holder.updateMatrixWorld(true);
    const b1 = new THREE.Box3();
    this.pivot.traverse(o => { if (o.isMesh && o.visible) b1.expandByObject(o); });
    this.sph1 = b1.getBoundingSphere(new THREE.Sphere());
    this.sph1.radius *= this.cfg.fitInside ?? 0.84;
    for (const pt of this.parts) pt.k = 0;
    this.applyParts(); holder.updateMatrixWorld(true);
    // label anchors: the middle of each part, in its parent's space
    for (const pt of this.parts) {
      const b = new THREE.Box3(), n0 = pt.nodes[0];
      pt.nodes.forEach(n => b.expandByObject(n));
      pt.anchor = pt.spec.anchor ? new THREE.Vector3().fromArray(pt.spec.anchor) : n0.parent.worldToLocal(b.getCenter(new THREE.Vector3()));
    }
    const lift = this.cfg.lift ?? 0.14;
    this.camDir = new THREE.Vector3(0, lift, 1).normalize();
  }

  /* The screen (or detail) close-up: floating layers that come apart. */
  makeZoom() {
    const z = this.cfg.zoom, x = this.x;
    this.zoom = null;
    if (!z) return;
    const zs = typeof z === 'function' ? z(x) : z;
    if (!zs) return;
    const target = zs.screen ? findAll(this.p.group, o => o.userData.role === 'screen' && o.material?.emissiveMap === this.p.tex[zs.tex || 0])
      : [x.node(zs.node, zs.within)].filter(Boolean);
    if (!target.length) return;
    const zoom = this.zoom = { spec: zs, meshes: target, layers: [], rings: [], on: false };
    const n0 = target[0];
    // where the detail is and which way it faces, with the product at rest
    const box = new THREE.Box3(); target.forEach(m => box.expandByObject(m));
    zoom.center = this.stage.holder.worldToLocal(box.getCenter(new THREE.Vector3()));
    zoom.radius = (zs.radius ?? box.getBoundingSphere(new THREE.Sphere()).radius) / (zs.fill ?? 0.9);
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(n0.getWorldQuaternion(new THREE.Quaternion()));
    if (zs.normal) n.fromArray(zs.normal).applyQuaternion(n0.getWorldQuaternion(new THREE.Quaternion())).normalize();
    const yaw = -Math.atan2(n.x, n.z);
    const n1 = n.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    zoom.face = [yaw, Math.atan2(n1.y, n1.z) - Math.atan2(this.camDir.y, this.camDir.z)];
    if (zs.screen) {
      const tex = this.p.tex[zs.tex || 0], [w, h] = tex.userData.size, draw = tex.userData.draw;
      const keys = zs.keys, off = Object.fromEntries(keys.map(k => [k, 0]));
      zoom.base = { ...off, ...(zs.keep || {}) };
      keys.forEach((k, i) => {
        const r = { ...off, bg: 0, [k]: 1, ...(zs.with?.[k] || {}) };
        const lt = S.canvasTex(w, h, (ctx, W, H) => draw(ctx, W, H, r));
        const m = new THREE.MeshBasicMaterial({ map: lt, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 - i, polygonOffsetUnits: -6 - i * 2 });
        for (const sm of target) {
          const lm = new THREE.Mesh(sm.geometry, m);
          lm.position.copy(sm.position); lm.quaternion.copy(sm.quaternion); lm.scale.copy(sm.scale);
          lm.userData.layer = { i, base: sm.position.clone(), n: new THREE.Vector3(0, 0, 1).applyQuaternion(sm.quaternion) };
          lm.visible = false; lm.renderOrder = 2 + i;
          sm.parent.add(lm); zoom.layers.push(lm);
        }
      });
    }
    if (zs.rings) {
      for (let i = 0; i < zs.rings; i++) {
        const ring = P.hudRing(1, i % 2 ? 0xff8a73 : 0xffffff);
        ring.visible = false; ring.renderOrder = 5;
        this.stage.scene.add(ring); zoom.rings.push(ring);
      }
    }
  }

  /* Preset angles and the angles used by the story. All are turns of the holder, on top of the resting pose. */
  makeAngles() {
    const r = this.cfg.rest, base = [-r.yaw, -r.pitch];
    this.angles = Object.assign({
      front: base,
      side: [base[0] - PI / 2, base[1]],
      back: [base[0] + PI, base[1]],
      top: [base[0], base[1] + 1.2]
    }, this.cfg.views?.(base, this.x) || {});
  }

  /* ---------------- the scroll story ---------------- */
  buildStory() {
    const e = this.els, p = this.product, cfg = this.cfg, x = this.x, h = this.hooks;
    const fam = h.families[p.family], mates = h.products.filter(q => q.family === p.family);
    const pick = this.pick;
    const out = [];
    const count = cfg.count?.[p.id];
    if (count) {
      const [src, key] = count.line;
      const line = src === 'facts' ? p.facts[key] : src === 'specs' ? p.specs[key] : p.tag;
      const dec = count.dec ?? 0;
      out.push(['count', n => `
        <section class="sx sx--count" data-sx="count" style="--len:2.3">
          <div class="sx__pin"><div class="sx__copy">
            <p class="sx__eyebrow" data-rv>${n} · In numbers</p>
            <p class="sx__num" data-rv><b data-count="${count.n}" data-dec="${dec}">${this.reduced ? count.n.toFixed(dec) : (0).toFixed(dec)}</b><span${count.unit.startsWith('-') ? ' class="is-tight"' : ''}>${esc(count.unit)}</span></p>
            <p class="sx__line" data-rv>${esc(line)}</p>
            ${src === 'specs' ? `<p class="sx__src" data-rv>From the specs: ${esc(key)}</p>` : ''}
          </div></div>
        </section>`]);
    }
    const calls = (typeof cfg.callouts === 'function' ? cfg.callouts(x) : cfg.callouts || []).filter(c => c && (!c.only || c.only(x)));
    this.callouts = calls;
    if (calls.length) out.push(['features', n => `
      <section class="sx sx--features" data-sx="features" style="--len:3">
        <div class="sx__pin"><div class="sx__copy">
          <p class="sx__eyebrow" data-rv>${n} · Up close</p>
          <h3 class="sx__title" data-rv>${esc(p.tag)}</h3>
          <ul class="sx__keys" data-rv>${calls.map(c => `<li>${esc(c.label)}</li>`).join('')}</ul>
        </div></div>
      </section>`]);
    if (this.zoom) {
      const zs = this.zoom.spec, val = p.specs?.[zs.spec];
      out.push(['zoom', n => `
        <section class="sx sx--zoom" data-sx="zoom" style="--len:2.8">
          <div class="sx__pin"><div class="sx__copy sx__copy--low">
            <p class="sx__eyebrow" data-rv>${n} · ${zs.screen ? 'On screen' : 'In focus'}</p>
            ${val ? `<h3 class="sx__title" data-rv>${esc(val)}</h3><p class="sx__src" data-rv>${esc(zs.spec)}</p>` : `<h3 class="sx__title" data-rv>${esc(p.tag)}</h3>`}
          </div></div>
        </section>`]);
    }
    if (p.colours.length > 1) out.push(['colour', n => `
      <section class="sx sx--colour" data-sx="colour" style="--len:2.2">
        <div class="sx__pin"><div class="sx__copy sx__copy--low sx__copy--center">
          <p class="sx__eyebrow" data-rv>${n} · Colour</p>
          <h3 class="sx__title" data-rv data-sx-name>${esc(p.colours[pick.c][0])}</h3>
          <div class="swatches sx__swatches" role="radiogroup" aria-label="Colour" data-rv>${p.colours.map(([nm, hex], i) =>
            `<button type="button" class="swatch" role="radio" aria-checked="${i === pick.c}" aria-label="${esc(nm)}" title="${esc(nm)}" data-sx-colour="${i}" style="--sw:${hex}"></button>`).join('')}</div>
        </div></div>
      </section>`]);
    out.push(['finale', n => `
      <section class="sx sx--finale" data-sx="finale" style="--len:1.9">
        <div class="sx__pin"><div class="sx__copy sx__copy--low sx__copy--center">
          <p class="sx__eyebrow" data-rv>${n} · NEXERA</p>
          <h3 class="sx__title" data-rv>${esc(p.name)}</h3>
          <p class="sx__line" data-rv>Shop smarter. Live better.</p>
          <div class="sx__buy" data-rv><span class="price" data-sx-price>${h.price()}</span><button class="btn btn--light add" type="button" data-sx-add>Add to bag</button></div>
          <button class="sx__top" type="button" data-sx-top data-rv>Back to the top</button>
        </div></div>
      </section>`]);
    if (mates.length > 1) {
      const keys = Object.keys(p.specs || {});
      out.push(['table', n => `
        <section class="sx sx--table" data-sx="table">
          <div class="sx__wrap">
            <p class="sx__eyebrow" data-rv>${n} · Compare</p>
            <h3 class="sx__title" data-rv>${esc(fam.name)} side by side</h3>
            <div class="sx__scroll" tabindex="0" role="region" aria-label="${esc(fam.name)} comparison">
              <table class="sx__table">
                <thead><tr data-row><th scope="col"><span class="sr-only">Spec</span></th>${mates.map(q => `<th scope="col"${q.id === p.id ? ' class="is-current"' : ''}>${esc(q.name)}</th>`).join('')}</tr></thead>
                <tbody>${keys.map(k => `<tr data-row><th scope="row">${esc(k)}</th>${mates.map(q => `<td${q.id === p.id ? ' class="is-current"' : ''}>${esc(q.specs?.[k] ?? 'Not listed')}</td>`).join('')}</tr>`).join('')}</tbody>
              </table>
            </div>
          </div>
        </section>`]);
    }
    e.story.innerHTML = out.map((s, i) => s[1](String(i + 1).padStart(2, '0'))).join('');
    this.measureSections();
    this.makeTriggers();
    // callout labels
    this.calls = calls.map((c, i) => ({ c, it: this.overlay.item('co' + i, c.label), node: c.node ? x.node(c.node, c.within) : null, at: new THREE.Vector3().fromArray(c.at), n: c.n ? new THREE.Vector3().fromArray(c.n) : null }));
    this.plabels = this.parts.filter(pt => pt.label).map(pt => ({ pt, it: this.overlay.item('pt' + pt.id, pt.label, pt.id) }));
  }
  measureSections() {
    const story = this.els.story, top = story.offsetTop;
    this.secs = [...story.querySelectorAll('.sx')].filter(s => s.dataset.sx !== 'table').map(el => ({ el, type: el.dataset.sx, top: top + el.offsetTop, h: el.offsetHeight }));
    // unwrap yaw so each section turns the short way from the one before
    let prev = 0;
    for (const s of this.secs) {
      s.yawOff = 0;
      const a = this.secState(s, 0).yaw;
      s.yawOff = PI * 2 * Math.round((prev - a) / (PI * 2));
      prev = this.secState(s, 1).yaw;
    }
  }
  makeTriggers() {
    this.killTriggers();
    if (this.reduced || !ScrollTrigger) return;
    const scroller = this.els.panel, T = o => { const t = ScrollTrigger.create({ scroller, ...o }); this.triggers.push(t); return t; };
    for (const sec of this.els.story.querySelectorAll('.sx')) {
      const rv = sec.querySelectorAll('[data-rv]');
      if (!rv.length) continue;
      const tw = gsap.fromTo(rv, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: 'power3.out', stagger: 0.07, paused: true });
      this.tweens.push(tw);
      T({ trigger: sec, start: sec.dataset.sx === 'table' ? 'top 80%' : 'top 45%', onEnter: () => tw.play(), onEnterBack: () => tw.play(), onLeaveBack: () => tw.reverse() });
    }
    const num = this.els.story.querySelector('[data-count]');
    if (num) {
      const target = +num.dataset.count, dec = +num.dataset.dec, o = { v: 0 };
      const tw = gsap.to(o, { v: target, ease: 'power1.out', paused: true, onUpdate: () => { num.textContent = o.v.toFixed(dec); } });
      this.tweens.push(tw);
      T({ trigger: num.closest('.sx'), start: 'top 35%', end: () => '+=' + this.H * 0.7, scrub: 0.6, animation: tw });
    }
    const table = this.els.story.querySelector('.sx__table');
    if (table) {
      const rows = table.querySelectorAll('[data-row]');
      const tw = gsap.fromTo(rows, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out', stagger: 0.06, paused: true });
      this.tweens.push(tw);
      T({ trigger: table, start: 'top 88%', onEnter: () => tw.play(), onLeaveBack: () => tw.reverse() });
    }
  }
  killTriggers() {
    this.triggers.forEach(t => t.kill()); this.triggers = [];
    this.tweens.forEach(t => t.kill()); this.tweens = [];
  }

  /* Where the product sits and how it is turned, for any scroll position. */
  heroState() {
    const L = this.layerBox, s = this.els.stage.getBoundingClientRect(), tl = this.els.tools.getBoundingClientRect();
    const top = s.top - L.top + (this.narrow ? 46 : 22), bottom = Math.min(s.bottom, tl.top - 4) - L.top;
    const full = this.heroFull = [s.left - L.left, top, s.width, Math.max(80, bottom - top)];
    // on narrow screens the opened-up product moves to the middle, leaving the sides for its labels
    const inset = this.narrow ? full[2] * 0.2 * (this.ex?.v || 0) : 0;
    return { rect: [full[0] + inset, full[1], full[2] - inset * 2, full[3]], yaw: 0, pitch: 0, zoom: 1, focus: 0, layers: 0, word: 1, callouts: 0 };
  }
  secState(sec, p) {
    const c = this.cfg.story, R = this.rects, off = sec.yawOff || 0;
    const base = { rect: R.side, yaw: 0, pitch: 0, zoom: 1, focus: 0, layers: 0, word: 0, callouts: 0 };
    let s;
    switch (sec.type) {
      case 'count': s = { ...base, yaw: c.count[0] + 0.55 * smooth(p), pitch: c.count[1] }; break;
      case 'features': {
        const path = c.features, n = path.length - 1, f = clamp01(p) * n, i = Math.min(n - 1, Math.floor(f)), t = smooth(seg(f - i, 0.3, 1));
        s = { ...base, yaw: lerp(path[i][0], path[i + 1][0], t), pitch: lerp(path[i][1], path[i + 1][1], t), callouts: p > 0.03 && p < 0.97 ? 1 : 0 };
        break;
      }
      case 'zoom': {
        const z = this.zoom, fo = smooth(seg(p, 0.04, 0.3)) * (1 - smooth(seg(p, 0.84, 1))), la = smooth(seg(p, 0.3, 0.48)) * (1 - smooth(seg(p, 0.66, 0.82)));
        const [fy, fp] = z ? z.face : [0, 0], tilt = c.zoomTilt || [-0.5, 0.14];
        s = { ...base, rect: R.zoom, yaw: fy + (1 - fo) * -0.6 + tilt[0] * la, pitch: fp + (1 - fo) * 0.12 + tilt[1] * la, focus: fo, layers: la, zoom: lerp(1, c.zoomIn ?? 1, fo) };
        break;
      }
      case 'colour': s = { ...base, rect: R.center, yaw: c.colour[0] + 0.9 * p, pitch: c.colour[1] }; break;
      case 'finale': s = { ...base, rect: R.finale, yaw: c.finale[0] + 0.75 * p, pitch: c.finale[1], word: smooth(seg(p, 0, 0.3)) }; break;
      default: s = base;
    }
    s.yaw += off;
    return s;
  }
  director() {
    const hero = this.heroState();
    this.secNow = null;
    if (this.reduced || !this.secs?.length) { this.storyW = 0; return hero; }
    const sc = this.els.panel.scrollTop, H = this.H;
    let prev = hero, w = 0;
    for (const sec of this.secs) {
      const enter = sec.top - H, pin = Math.max(1, sec.h - H);
      if (sc < enter) break;
      if (sc < sec.top) { const t = smooth((sc - enter) / H); w = Math.max(w, t); this.storyW = w; return mix(prev, this.secState(sec, 0), t); }
      w = 1;
      if (sc <= sec.top + pin) { this.storyW = 1; this.secNow = sec; return this.secState(sec, (sc - sec.top) / pin); }
      prev = this.secState(sec, 1);
    }
    this.storyW = w;
    return prev;
  }

  /* ---------------- frame loop ---------------- */
  tick(now) {
    if (!this.alive) return;
    this.raf = requestAnimationFrame(t => this.tick(t));
    const dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000));
    this.last = now;
    const p = this.p, x = this.x, cfg = this.cfg;
    this.layerBox = this.els.layer.getBoundingClientRect();
    // where the scroll story wants the product
    const target = this.director();
    if (!this.cur) this.cur = clone(target);
    else ease_(this.cur, target, this.reduced ? 1 : 1 - Math.exp(-10 * dt), this.narrow && this.storyW < 0.01);
    const st = this.cur;
    if (this.storyW > 0.3) {
      if (this.inside) this.toggleInside(false);
      if (this.rot.ty !== 0 || this.rot.tp !== 0) { this.rot.ty = 0; this.rot.tp = 0; this.markView(null); }
    }
    this.updateRot(dt, now);
    // product animation: entrance, then any idle motion
    cfg.entrance.play(p, this.fx.t, x);
    cfg.idle?.(p, now, x, dt);
    this.applyParts();
    for (const pt of this.parts) pt.dim = damp(pt.dim, pt.dimT, 9, dt);
    this.rest.dim = damp(this.rest.dim, this.rest.dimT, 9, dt);
    // colour blend
    const col = this.col;
    if (col.t < 1) {
      col.t = Math.min(1, col.t + dt / 0.55);
      S.recolorMix(p, col.from, col.to, ease.out(col.t));
      col.now = '#' + new THREE.Color(col.from).lerp(new THREE.Color(col.to), ease.out(col.t)).getHexString();
    }
    // screens follow the clock
    const m = new Date().getMinutes();
    if (m !== this.minute) { if (this.minute != null && this.fx.t >= 1 && !this.zoom?.on) p.tex.forEach(t => { t.userData.key = null; t.userData.redraw?.(); }); this.minute = m; }
    this.updateZoom(st, now);
    this.syncMaterials();
    // turn the product
    const r = this.rot, settled = r.mode === 'settle' && Math.abs(r.vy) < 0.02 && now - r.last > 4500;
    this.sway = damp(this.sway, settled && !this.inside && !this.reduced && this.storyW < 0.05 && this.fx.t >= 1 ? 1 : 0, 1.2, dt);
    const swayY = Math.sin(now / 2600) * 0.16 * this.sway, swayP = Math.sin(now / 3300) * 0.03 * this.sway;
    this.stage.holder.rotation.set(st.pitch + r.pitch + swayP, st.yaw + r.yaw + swayY, 0);
    this.stage.holder.position.y = Math.sin(now / 1900) * 0.01 * this.sway * this.sph0.radius;
    this.stage.holder.updateMatrixWorld(true);
    const visible = this.frame(st);
    if (visible && !this.covered()) this.stage.render();
    this.place(st, now);
    this.perfCheck(dt);
  }

  frame(st) {
    const cam = this.stage.camera, [rx, ry, rw, rh] = st.rect;
    if (rw < 4 || rh < 4 || ry > this.H || ry + rh < 0) return false;
    cam.aspect = rw / rh;
    const e = this.ex.v;
    const c = new THREE.Vector3().lerpVectors(this.sph0.center, this.sph1.center, e).applyEuler(this.stage.holder.rotation);
    c.y += this.stage.holder.position.y;
    let rad = lerp(this.sph0.radius, this.sph1.radius, e);
    if (st.focus > 0.001 && this.zoom) {
      const f = this.zoom.center.clone().applyEuler(this.stage.holder.rotation);
      c.lerp(f, st.focus); rad = lerp(rad, this.zoom.radius, st.focus);
    }
    const vfov = cam.fov * PI / 180, hfov = 2 * Math.atan(Math.tan(vfov / 2) * cam.aspect);
    const dist = rad * (this.cfg.margin ?? 1.1) / Math.sin(Math.min(vfov, hfov) / 2) * st.zoom;
    cam.position.copy(c).addScaledVector(this.camDir, dist);
    cam.lookAt(c);
    cam.near = Math.max(0.005, dist * 0.04); cam.far = dist + rad * 8;
    cam.setViewOffset(rw, rh, -rx, -ry, this.W, this.H);
    cam.updateProjectionMatrix();
    this.focusDist = dist;
    const sh = this.stage.shadow;
    if (sh) {
      const b = this.box0, s = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) * 1.2;
      sh.position.set(this.sph0.center.x, b.min.y - 0.02 + this.stage.holder.position.y * 0.3, this.sph0.center.z);
      sh.scale.set(s, s * 0.62, 1);
      sh.material.opacity = (1 - e) * (1 - st.focus) * clamp01(1 - Math.abs(this.stage.holder.rotation.x) * 1.4) * this.fx.glow;
      sh.visible = sh.material.opacity > 0.01;
    }
    return true;
  }
  /* Skip drawing while something opaque covers the whole product. */
  covered() {
    const L = this.layerBox;
    if (this.narrow && this.storyW < 0.02) { const ib = this.els.info.getBoundingClientRect(); if (ib.top - L.top < 30) return true; }
    const tb = this.els.story.querySelector('.sx--table');
    if (tb) { const r = tb.getBoundingClientRect(); if (r.top - L.top <= 0) return true; }
    return false;
  }

  updateRot(dt, now) {
    const r = this.rot;
    if (this.ptr?.mode === 'rotate') return;
    if (r.mode === 'free' && now - r.last < IDLE) {
      r.yaw += r.vy * dt; r.pitch += r.vp * dt;
      const f = Math.exp(-3.4 * dt); r.vy *= f; r.vp *= f;
      if (Math.abs(r.pitch) > TILT) { r.pitch = damp(r.pitch, Math.sign(r.pitch) * TILT, 9, dt); r.vp *= 0.7; }
      return;
    }
    r.mode = 'settle';
    const ty = r.ty + PI * 2 * Math.round((r.yaw - r.ty) / (PI * 2)), w = r.fast ? 6.5 : 3.6;
    if (this.reduced) { r.yaw = ty; r.pitch = r.tp; r.vy = r.vp = 0; return; }
    r.vy += (-w * w * (r.yaw - ty) - 2 * w * r.vy) * dt; r.yaw += r.vy * dt;
    r.vp += (-w * w * (r.pitch - r.tp) - 2 * w * r.vp) * dt; r.pitch += r.vp * dt;
  }

  updateZoom(st, now) {
    const z = this.zoom;
    if (!z) return;
    const la = st.layers;
    if (z.layers.length) {
      const on = la > 0.004;
      if (on !== z.on) {
        z.on = on;
        this.paint(z.spec.tex || 0, on ? z.base : null, true);
        z.layers.forEach(l => { l.visible = on; });
      }
      if (on) for (const l of z.layers) {
        const d = l.userData.layer;
        l.position.copy(d.base).addScaledVector(d.n, (d.i + 1) * (z.spec.gap ?? 0.05) * la);
        l.material.opacity = 1;
      }
    }
    if (z.rings.length) {
      const f = z.center.clone().applyEuler(this.stage.holder.rotation), cam = this.stage.camera;
      const dir = cam.position.clone().sub(f).normalize();
      z.rings.forEach((ring, i) => {
        ring.visible = st.focus > 0.05;
        const k = la, rad = z.radius * (0.55 + i * 0.28) * lerp(0.8, 1, k);
        ring.position.copy(f).addScaledVector(dir, (i - 0.6) * (z.spec.gap ?? 0.08) * k);
        ring.quaternion.copy(cam.quaternion);
        ring.rotateZ(now / (2400 + i * 900) * (i % 2 ? -1 : 1));
        ring.scale.setScalar(rad);
        ring.material.opacity = st.focus * (0.25 + 0.55 * k) * (i % 2 ? 0.8 : 1);
      });
    }
  }

  /* Glow, display word, leader lines and labels. */
  place(st, now) {
    const e = this.els, [rx, ry, rw, rh] = st.rect, cx = rx + rw / 2, cy = ry + rh / 2;
    // glow: the selected finish, or every finish in turn in the colour section
    let want = this.col.to;
    const sec = this.secNow;
    if (this.storyW > 0.5 && sec?.type === 'colour') {
      const cols = this.product.colours, f = clamp01((this.els.panel.scrollTop - sec.top) / Math.max(1, sec.h - this.H)) * (cols.length - 1);
      const i = Math.min(cols.length - 2, Math.floor(f));
      want = '#' + tint(cols[i][1]).lerp(tint(cols[i + 1][1]), smooth(f - i)).getHexString();
    }
    const tc = want === this.col.to ? tint(want) : new THREE.Color(want);
    this.glowCol.lerp(tc, 0.08);
    const g = e.glow, size = Math.max(rw, rh) * 1.25;
    g.style.width = g.style.height = size.toFixed(0) + 'px';
    g.style.transform = `translate(${(cx - size / 2).toFixed(1)}px, ${(cy - size / 2).toFixed(1)}px)`;
    g.style.opacity = (this.fx.glow * (1 - 0.5 * this.ex.v)).toFixed(3);
    g.style.setProperty('--g', `${Math.round(this.glowCol.r * 255)} ${Math.round(this.glowCol.g * 255)} ${Math.round(this.glowCol.b * 255)}`);
    // display word, a little parallax against the rotation
    const w = e.word, a = st.word * this.fx.word * (1 - this.ex.v);
    w.style.opacity = a.toFixed(3);
    if (a > 0.001) {
      const fs = this.wordSize(rw, rh);
      if (w.dataset.fs !== String(fs)) { w.dataset.fs = fs; w.style.fontSize = fs + 'px'; }
      const par = -(this.rot.yaw + Math.sin(now / 2600) * 0.16 * this.sway) * 26 + this.fx.wordX;
      w.style.transform = `translate(${(cx + par).toFixed(1)}px, ${(ry + rh * 0.5).toFixed(1)}px) translate(-50%, -50%)`;
    }
    // labels
    const cam = this.stage.camera, v = new THREE.Vector3(), nw = new THREE.Vector3(), q = new THREE.Quaternion(), list = [];
    const toPx = wp => { v.copy(wp).project(cam); return [(v.x + 1) / 2 * this.W, (1 - v.y) / 2 * this.H, v.z]; };
    const showCalls = st.callouts > 0.5 && this.ex.v < 0.05 && !this.reduced;
    for (const k of this.calls) {
      let show = showCalls, px = [0, 0];
      if (show) {
        const host = k.node || this.p.group;
        const wp = host.localToWorld(k.at.clone());
        px = toPx(wp);
        if (k.n) { nw.copy(k.n).applyQuaternion(host.getWorldQuaternion(q)).normalize(); show = nw.dot(cam.position.clone().sub(wp).normalize()) > 0.18; }
      }
      list.push({ it: k.it, x: px[0], y: px[1], show });
    }
    for (const l of this.plabels) {
      const pt = l.pt, show = this.inside && pt.k > 0.6;
      let px = [0, 0];
      if (show) px = toPx(pt.nodes[0].parent.localToWorld(pt.anchor.clone().addScaledVector(pt.off, pt.k)));
      list.push({ it: l.it, x: px[0], y: px[1], show });
    }
    this.overlay.layout(list, this.inside && this.storyW < 0.5 && this.heroFull ? this.heroFull : st.rect);
  }
  wordSize(rw, rh) {
    const key = Math.round(rw / 8);
    if (this.wordKey === key) return this.wordFs;
    const ctx = (this.measureCtx ??= document.createElement('canvas').getContext('2d'));
    ctx.font = '700 100px Sora, "DM Sans", system-ui, sans-serif';
    const wd = Math.max(1, ctx.measureText(this.els.word.textContent.toUpperCase()).width);
    this.wordKey = key;
    this.wordFs = Math.round(Math.max(48, Math.min(rh * 0.62, rw * 1.04 / wd * 100)));
    return this.wordFs;
  }
  word() {
    const w = this.els.word;
    w.textContent = wordOf(this.product);
    this.wordKey = null;
  }

  perfCheck(dt) {
    const f = this.perf;
    f.acc += dt; f.n++;
    if (f.acc < 1) return;
    const avg = f.acc / f.n * 1000;
    f.acc = 0; f.n = 0;
    if (avg > 24) { f.slow++; f.good = 0; } else if (avg < 14) { f.good++; f.slow = 0; } else { f.slow = 0; f.good = 0; }
    let next = this.dpr;
    if (f.slow >= 2 && this.dpr > 1) next = Math.max(1, this.dpr - 0.25);
    if (f.good >= 4 && this.dpr < this.dprCap) next = Math.min(this.dprCap, this.dpr + 0.25);
    if (next !== this.dpr) { this.dpr = next; f.slow = f.good = 0; this.stage.renderer.setPixelRatio(next); this.stage.setSize(this.W, this.H); }
  }

  /* ---------------- controls ---------------- */
  playEntrance() {
    const e = this.els, d = this.cfg.entrance.duration;
    this.entTl?.kill();
    Object.assign(this.fx, { t: 0, glow: 0, word: 0, wordX: 90 });
    const info = this.infoEls();
    const tl = this.entTl = gsap.timeline();
    tl.to(this.fx, { t: 1, duration: d, ease: 'none' }, 0.05);
    tl.to(this.fx, { glow: 1, duration: 1.3, ease: 'power2.out' }, 0);
    tl.to(this.fx, { word: 1, wordX: 0, duration: 1.7, ease: 'power3.out' }, 0.2);
    tl.fromTo(info, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.06 }, Math.min(0.9, d * 0.32));
    tl.fromTo(e.tools, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, Math.min(1.6, d * 0.62));
  }
  infoEls() {
    const i = this.els.info;
    return [...i.querySelectorAll(':scope > .label, :scope > h2, :scope > .pv__tag, :scope > .pv__facts, .pv__facts li, :scope > .opt:not([hidden]), :scope > .pv__buy, :scope > .pv__cue')];
  }
  showInfo() { gsap.set(this.infoEls().concat(this.els.tools), { clearProps: 'opacity,transform' }); }

  replay() {
    if (!this.alive) return;
    this.select(null);
    const go = () => {
      Object.assign(this.rot, { yaw: 0, pitch: 0, vy: 0, vp: 0, ty: 0, tp: 0, mode: 'settle', fast: false, last: 0 });
      this.markView(null);
      if (this.cfg.lid) { this.lidTw?.kill(); this.x.state.lid = 1; this.lidLabel(true); }
      this.els.panel.scrollTo({ top: 0 });
      if (this.reduced) return;
      this.playEntrance();
    };
    if (this.inside) {
      this.inside = false; this.insideUI();
      this.xtl.eventCallback('onReverseComplete', () => { this.xtl.eventCallback('onReverseComplete', null); go(); });
      this.xtl.timeScale(2.2).reverse();
    } else go();
  }

  view(name) {
    const a = this.angles[name];
    if (!a || !this.alive) return;
    const r = this.rot;
    r.ty = a[0]; r.tp = a[1]; r.mode = 'settle'; r.fast = true; r.last = 0;
    this.markView(name);
  }
  markView(name) {
    this.viewName = name;
    this.els.views.querySelectorAll('[data-angle]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.angle === name)));
  }

  toggleInside(force) {
    if (!this.alive) return;
    const on = force ?? !this.inside;
    if (on === this.inside) return;
    this.inside = on;
    this.select(null);
    this.insideUI();
    const r = this.rot;
    this.xtl.eventCallback('onReverseComplete', null);
    if (on) {
      if (this.cfg.lid && this.x.state.lid < 1) this.toggleLid(true);
      this.before = [r.ty, r.tp, this.viewName];
      const v = this.cfg.insideView || [this.angles.front[0] - 0.85, this.angles.front[1] + 0.3];
      r.ty = v[0]; r.tp = v[1]; r.mode = 'settle'; r.fast = true; r.last = 0; this.markView(null);
      if (this.reduced) this.xtl.progress(1).pause(); else this.xtl.timeScale(1).play();
    } else {
      const [ty, tp, name] = this.before || [0, 0, null];
      r.ty = ty; r.tp = tp; r.mode = 'settle'; r.fast = true; r.last = 0; this.markView(name);
      if (this.reduced) this.xtl.progress(0).pause(); else this.xtl.timeScale(1.3).reverse();
    }
  }
  insideUI() {
    this.els.inside.setAttribute('aria-pressed', String(this.inside));
    this.els.inside.textContent = this.inside ? 'Put it back' : 'Look inside';
    this.els.root.classList.toggle('is-inside', this.inside);
  }

  toggleLid(force) {
    if (!this.alive || !this.cfg.lid) return;
    const s = this.x.state, open = force ?? s.lid < 0.5;
    if (!open && this.inside) this.toggleInside(false);
    this.lidTw?.kill();
    if (this.reduced) s.lid = open ? 1 : 0;
    else this.lidTw = gsap.to(s, { lid: open ? 1 : 0, duration: 1.2, ease: 'power2.inOut' });
    this.lidLabel(open);
  }
  lidLabel(open) { this.els.lid.textContent = open ? 'Close lid' : 'Open lid'; this.els.lid.setAttribute('aria-pressed', String(!open)); }

  select(id) {
    const sel = this.sel = id ? this.parts.find(pt => pt.id === id) || null : null;
    for (const pt of this.parts) pt.dimT = !sel ? 0 : (pt === sel || pt.group === sel.id) ? 0 : 1;
    if (this.rest) this.rest.dimT = sel ? 1 : 0;
    this.overlay.items.forEach(it => { if (it.el.dataset.part) { it.el.setAttribute('aria-pressed', String(!!sel && it.el.dataset.part === sel.id)); it.el.classList.toggle('is-sel', !!sel && it.el.dataset.part === sel.id); } });
    const box = this.els.part;
    if (sel) { box.querySelector('b').textContent = sel.label; box.querySelector('span').textContent = sel.desc; box.hidden = false; }
    else box.hidden = true;
  }

  /* From the info panel or the story swatches. */
  setColour(i) {
    if (!this.alive) return;
    const hex = this.product.colours[i][1];
    this.pick.c = i;
    if (hex !== this.col.to) Object.assign(this.col, { from: this.col.now, to: hex, t: 0 });
    this.els.story.querySelectorAll('[data-sx-colour]').forEach(b => b.setAttribute('aria-checked', String(+b.dataset.sxColour === i)));
    const nm = this.els.story.querySelector('[data-sx-name]');
    if (nm) nm.textContent = this.product.colours[i][0];
  }
  setOption() {
    const el = this.els.story.querySelector('[data-sx-price]');
    if (el) el.innerHTML = this.hooks.price();
  }

  /* ---------------- sizes ---------------- */
  layout() {
    const panel = this.els.panel, W = panel.clientWidth, H = panel.clientHeight;
    this.W = W; this.H = H;
    panel.style.setProperty('--ph', H + 'px');
    const n = this.narrow = this.narrowMQ.matches;
    this.rects = {
      side: n ? [0, H * 0.05, W, H * 0.5] : [W * 0.4, H * 0.06, W * 0.58, H * 0.88],
      center: n ? [0, H * 0.06, W, H * 0.54] : [W * 0.16, H * 0.05, W * 0.68, H * 0.72],
      zoom: n ? [0, H * 0.05, W, H * 0.6] : [W * 0.1, H * 0.04, W * 0.8, H * 0.8],
      finale: n ? [0, H * 0.07, W, H * 0.46] : [W * 0.2, H * 0.05, W * 0.6, H * 0.6]
    };
    this.els.lines.setAttribute('viewBox', `0 0 ${W} ${H}`);
  }
  resize() {
    this.layout();
    this.stage?.setSize(this.W, this.H);
    this.wordKey = null;
    this.measureSections();
    if (ScrollTrigger) ScrollTrigger.refresh();
  }

  /* ---------------- close ---------------- */
  close() {
    if (!this.p && !this.stage && !this.els.root.classList.contains('is-sc')) return;
    this.alive = false; this.token++;
    cancelAnimationFrame(this.raf);
    this.entTl?.kill(); this.xtl?.kill(); this.lidTw?.kill();
    this.killTriggers();
    gsap.set(this.infoEls().concat(this.els.tools), { clearProps: 'opacity,transform' });
    this.overlay.clear();
    this.els.story.innerHTML = '';
    this.els.part.hidden = true;
    this.els.word.style.opacity = 0; this.els.glow.style.opacity = 0;
    this.els.root.classList.remove('is-inside', 'is-dragging', 'is-sc', 'is-reduced');
    this.ptr = null; this.secs = null; this.secNow = null; this.cur = null;
    this.dispose();
  }
  dispose() {
    const done = new Set();
    const tex = t => { if (t && !t.userData?.shared && !done.has(t)) { done.add(t); t.dispose(); } };
    const mat = m => { if (!m || done.has(m)) return; done.add(m); tex(m.map); tex(m.emissiveMap); m.dispose(); };
    if (this.stage) {
      this.stage.scene.traverse(o => {
        if (o.geometry && !done.has(o.geometry)) { done.add(o.geometry); o.geometry.dispose(); }
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(mat);
      });
      (this.pairs || []).forEach(pr => mat(pr.o));
      this.p?.tex.forEach(tex);
      this.stage.scene.environment?.dispose();
      this.stage.renderer.dispose();
      this.stage.renderer.forceContextLoss();
    }
    this.stage = null; this.p = null; this.pairs = null; this.parts = []; this.zoom = null;
  }
}

/* ---------------- small helpers ---------------- */
function findAll(root, test) { const out = []; root.traverse(o => { if (test(o)) out.push(o); }); return out; }
function isInside(o, root) { for (let a = o; a; a = a.parent) if (a === root) return true; return false; }
function clone(s) { return { ...s, rect: s.rect.slice() }; }
function mix(a, b, t) {
  const o = {};
  for (const k in b) o[k] = k === 'rect' ? a.rect.map((v, i) => lerp(v, b.rect[i], t)) : lerp(a[k] ?? 0, b[k], t);
  return o;
}
/* Move the current state toward the target. The hero rect follows the page exactly. */
function ease_(cur, tgt, k, snapRect) {
  for (const key in tgt) {
    if (key === 'rect') { for (let i = 0; i < 4; i++) cur.rect[i] = snapRect ? tgt.rect[i] : lerp(cur.rect[i], tgt.rect[i], k); }
    else cur[key] = lerp(cur[key] ?? 0, tgt[key], k);
  }
}
