/* =========================================================
   The 3D view (loaded only when someone taps "View in 3D").
   - entrance: the product rises and turns to face you
   - drag (or arrow keys) to turn, with momentum; springs back after 3 s
   - Front, Side, Back, Top
   - Look inside: the product opens into labelled parts; tap a label
     or a part to read what it does
   Everything is cleared when the view closes.
   ========================================================= */
import { build, THREE } from './models3d.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

const NS = 'http://www.w3.org/2000/svg';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const easeOut = t => 1 - Math.pow(1 - t, 3);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

let active = null;

export function open(product, { inside = false, storeName = 'NEXERA', opener = document.activeElement } = {}) {
  if (active) active.close();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- DOM ---------- */
  const el = document.createElement('div');
  el.className = 'v3d';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'v3dName');
  el.innerHTML = `
    <div class="v3d__top">
      <div><p class="v3d__kicker">3D view</p><h2 class="v3d__name" id="v3dName">${esc(product.name)}</h2></div>
      <button class="v3d__close" type="button" aria-label="Close 3D view"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
    </div>
    <div class="v3d__stage">
      <canvas class="v3d__canvas" tabindex="0" aria-label="3D model of ${esc(product.name)}. Drag, or use the arrow keys, to turn it."></canvas>
      <svg class="v3d__lines" aria-hidden="true"></svg>
      <div class="v3d__labels"></div>
      <p class="v3d__hint" aria-hidden="true">Drag to turn</p>
      <div class="v3d__part" role="status" hidden><div><b></b><span></span></div><button type="button" class="v3d__x" aria-label="Close part details">×</button></div>
    </div>
    <div class="v3d__bar">
      <div class="v3d__views" role="group" aria-label="Viewing angle">
        <button type="button" data-view="front" aria-pressed="true">Front</button><button type="button" data-view="side" aria-pressed="false">Side</button><button type="button" data-view="back" aria-pressed="false">Back</button><button type="button" data-view="top" aria-pressed="false">Top</button>
      </div>
      <div class="v3d__acts">
        <button type="button" class="v3d__inside" aria-pressed="false">Look inside</button>
        <button type="button" class="v3d__replay">Replay</button>
      </div>
    </div>
    <p class="v3d__note">Illustration by ${esc(storeName)}. Shapes and inner parts are simplified and not to scale. Tap a part to read what it does.</p>`;
  document.body.appendChild(el);
  const $ = q => el.querySelector(q);
  const stage = $('.v3d__stage'), canvas = $('.v3d__canvas'), svg = $('.v3d__lines'), labelBox = $('.v3d__labels');
  const partBox = $('.v3d__part'), insideBtn = $('.v3d__inside');
  const prevOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';

  /* ---------- three.js ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-4, 6, 8); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 0.8); rim.position.set(5, 2, -6); scene.add(rim);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);

  const model = build(product.model || {});
  const pivot = new THREE.Group(); pivot.add(model.root); scene.add(pivot);
  /* centre the model */
  const box0 = new THREE.Box3().setFromObject(model.root), c0 = box0.getCenter(new THREE.Vector3());
  model.root.position.sub(c0);
  model.parts.forEach(p => { p.base = p.obj.position.clone(); });

  /* soft contact shadow on the floor */
  const shTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  })();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  const span = box0.getSize(new THREE.Vector3());
  shadow.scale.set(span.x * 1.3 + 1, (model.flat ? span.z : span.z + 1.5) * 1.3, 1);
  shadow.position.y = -span.y / 2 - 0.25;
  scene.add(shadow);

  /* ---------- angles ---------- */
  const isRing = product.model && product.model.kind === 'ring';
  const base = model.flat ? { rx: 0.5, ry: -0.35 } : isRing ? { rx: 0.15, ry: -0.55 } : { rx: 0.05, ry: -0.25 };
  const VIEWS = {
    front: { rx: base.rx, ry: base.ry },
    side: { rx: model.flat ? 0.25 : 0.05, ry: -Math.PI / 2 },
    back: { rx: model.flat ? 0.4 : 0.05, ry: Math.PI },
    top: { rx: Math.PI / 2 - 0.05, ry: 0 }
  };
  const INSIDE = model.flat ? { rx: 0.42, ry: -0.55 } : isRing ? { rx: 0.35, ry: -0.95 } : { rx: 0.22, ry: -1.0 };
  let view = 'front';
  const cur = { rx: base.rx, ry: base.ry }, target = { ...cur }, vel = { rx: 0, ry: 0 };
  let explode = 0, explodeTo = 0, lastTouch = 0, intro = reduce ? 1 : 0, focusKey = null;
  const near = (from, to) => to + Math.round((from - to) / (Math.PI * 2)) * Math.PI * 2;
  function setTarget(t) { target.rx = t.rx; target.ry = near(cur.ry, t.ry); lastTouch = 0; }
  function pickView(v) {
    view = v; setTarget(explodeTo ? (v === 'front' ? INSIDE : VIEWS[v]) : VIEWS[v]);
    el.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
  }

  /* ---------- size ---------- */
  let W = 1, H = 1;
  function resize() {
    const r = stage.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  }
  const ro = new ResizeObserver(resize); ro.observe(stage); resize();
  const fitDist = k => {
    const f = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const s = model.size * k;
    return Math.max(s / (2 * f), s / (2 * f * camera.aspect)) * 1.12;
  };

  /* ---------- labels ---------- */
  const shown = []; const seen = new Set();
  model.parts.forEach(p => { if (!seen.has(p.name)) { seen.add(p.name); shown.push(p); } });
  const labels = shown.map(p => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'v3d__label'; b.textContent = p.name; b.dataset.key = p.key; b.tabIndex = -1;
    b.addEventListener('click', () => focusPart(p.key));
    labelBox.appendChild(b);
    const path = document.createElementNS(NS, 'path'), dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('r', '3'); svg.append(path, dot);
    return { p, b, path, dot };
  });
  const tmpBox = new THREE.Box3(), tmpV = new THREE.Vector3();
  function placeLabels(alpha) {
    const vis = alpha > 0.02;
    labelBox.style.opacity = alpha; svg.style.opacity = alpha;
    labels.forEach(l => { l.b.tabIndex = vis ? 0 : -1; l.b.setAttribute('aria-hidden', String(!vis)); });
    if (!vis) return;
    const pts = labels.map(l => {
      tmpBox.setFromObject(l.p.obj); tmpBox.getCenter(tmpV); tmpV.project(camera);
      return { l, x: (tmpV.x + 1) / 2 * W, y: (1 - tmpV.y) / 2 * H };
    });
    const mid = W / 2, pad = 8, gap = W < 560 ? 30 : 36, top = 12, bottom = H - 12;
    for (const side of ['L', 'R']) {
      const col = pts.filter(q => (q.x < mid) === (side === 'L')).sort((a, b) => a.y - b.y);
      let y = top;
      col.forEach(q => { q.ly = Math.max(y, Math.min(bottom, q.y)); y = q.ly + gap; });
      for (let i = col.length - 1, lim = bottom; i >= 0; i--) { col[i].ly = Math.min(col[i].ly, lim); lim = col[i].ly - gap; }
      col.forEach(q => {
        const bw = q.l.b.offsetWidth, bh = q.l.b.offsetHeight;
        const lx = side === 'L' ? pad : W - pad - bw;
        q.l.b.style.transform = `translate(${lx.toFixed(1)}px, ${(q.ly - bh / 2).toFixed(1)}px)`;
        const ex = side === 'L' ? lx + bw + 4 : lx - 4;
        const elbow = side === 'L' ? ex + 16 : ex - 16;
        q.l.path.setAttribute('d', `M${ex.toFixed(1)} ${q.ly.toFixed(1)} H${elbow.toFixed(1)} L${q.x.toFixed(1)} ${q.y.toFixed(1)}`);
        q.l.dot.setAttribute('cx', q.x.toFixed(1)); q.l.dot.setAttribute('cy', q.y.toFixed(1));
        const on = focusKey === q.l.p.key || (focusKey && model.parts.find(pp => pp.key === focusKey)?.name === q.l.p.name);
        q.l.b.classList.toggle('is-on', !!on); q.l.b.setAttribute('aria-pressed', String(!!on));
        q.l.path.classList.toggle('is-on', !!on);
      });
    }
  }

  /* ---------- focus one part ---------- */
  const mats = [];
  model.root.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.userData.op = o.material.opacity; o.userData.tr = o.material.transparent; mats.push(o); } });
  function focusPart(k) {
    focusKey = focusKey === k ? null : k;
    const p = model.parts.find(pp => pp.key === focusKey);
    const name = p && p.name;
    model.parts.forEach(pp => pp.obj.traverse(o => {
      if (!o.isMesh) return;
      const dim = name && pp.name !== name;
      o.material.transparent = dim ? true : o.userData.tr;
      o.material.opacity = dim ? 0.12 : o.userData.op;
      o.material.depthWrite = !dim && !o.userData.tr;
      o.material.needsUpdate = true;
    }));
    partBox.hidden = !p;
    if (p) { partBox.querySelector('b').textContent = p.name; partBox.querySelector('span').textContent = p.info; }
  }
  $('.v3d__x').addEventListener('click', () => focusPart(focusKey));

  /* ---------- input ---------- */
  let drag = null, moved = 0;
  canvas.addEventListener('pointerdown', e => {
    drag = { x: e.clientX, y: e.clientY, t: performance.now() }; moved = 0;
    canvas.setPointerCapture(e.pointerId); lastTouch = performance.now(); vel.rx = vel.ry = 0;
    el.classList.add('is-dragging');
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y, now = performance.now(), dt = Math.max(1, now - drag.t);
    moved += Math.abs(dx) + Math.abs(dy);
    cur.ry += dx * 0.01; cur.rx = clamp(cur.rx + dy * 0.008, -1.0, 1.6);
    vel.ry = dx * 0.01 / dt * 16; vel.rx = dy * 0.008 / dt * 16;
    drag = { x: e.clientX, y: e.clientY, t: now }; lastTouch = now;
  });
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  canvas.addEventListener('pointerup', e => {
    el.classList.remove('is-dragging');
    if (drag && moved < 6) {           /* a tap: which part is under the finger? */
      const r = canvas.getBoundingClientRect();
      ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(model.root.children, true).find(h => h.object.material.opacity > 0.15);
      if (hit) { let o = hit.object; while (o.parent && o.parent !== model.root) o = o.parent; const p = model.parts.find(pp => pp.obj === o); if (p) focusPart(p.key); }
    }
    drag = null; lastTouch = performance.now();
  });
  canvas.addEventListener('pointercancel', () => { drag = null; el.classList.remove('is-dragging'); });
  canvas.addEventListener('keydown', e => {
    const k = { ArrowLeft: [0, -0.25], ArrowRight: [0, 0.25], ArrowUp: [-0.2, 0], ArrowDown: [0.2, 0] }[e.key];
    if (!k) return; e.preventDefault();
    target.rx = clamp(cur.rx + k[0], -1.0, 1.6); target.ry = cur.ry + k[1]; lastTouch = 0;
  });
  el.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => pickView(b.dataset.view)));
  function setInside(on) {
    explodeTo = on ? 1 : 0;
    insideBtn.setAttribute('aria-pressed', String(on)); insideBtn.textContent = on ? 'Put it back' : 'Look inside';
    if (!on) focusPart(null);
    pickView('front');
    if (reduce) explode = explodeTo;
  }
  insideBtn.addEventListener('click', () => setInside(!explodeTo));
  $('.v3d__replay').addEventListener('click', () => { setInside(false); focusPart(null); intro = reduce ? 1 : 0; Object.assign(cur, VIEWS.front); });

  /* ---------- close ---------- */
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === 'Tab') {               /* keep keyboard focus inside the dialog */
      const f = [...el.querySelectorAll('button, canvas')].filter(x => x.tabIndex >= 0 && x.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
    }
  }
  document.addEventListener('keydown', onKey);
  $('.v3d__close').addEventListener('click', () => close());
  let raf = 0, dead = false;
  function close() {
    if (dead) return; dead = true;
    cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('keydown', onKey);
    scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(m => { Object.values(m).forEach(v => v && v.isTexture && v.dispose()); m.dispose(); });
    });
    envTex.dispose(); pmrem.dispose(); renderer.dispose(); renderer.forceContextLoss();
    el.remove(); document.documentElement.style.overflow = prevOverflow;
    active = null;
    if (opener && opener.focus) opener.focus();
  }

  /* ---------- loop ---------- */
  let last = performance.now();
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (intro < 1) intro = Math.min(1, intro + dt / 1.6);
    const e = easeOut(intro);

    if (!drag) {
      cur.ry += vel.ry; cur.rx = clamp(cur.rx + vel.rx, -1.0, 1.6);
      vel.ry *= 0.92; vel.rx *= 0.92;
      if (now - lastTouch > (lastTouch ? 3000 : 0)) {
        if (lastTouch) { target.ry = near(cur.ry, target.ry); lastTouch = 0; }   /* spring back the short way round */
        cur.rx = damp(cur.rx, target.rx, 4, dt); cur.ry = damp(cur.ry, target.ry, 4, dt);
      }
    }
    explode = reduce ? explodeTo : damp(explode, explodeTo, 5, dt);
    model.parts.forEach(p => p.obj.position.copy(p.base).addScaledVector(p.dir, explode));

    pivot.rotation.set(cur.rx, cur.ry - (1 - e) * 1.4, 0);
    pivot.position.y = -(1 - e) * model.size * 0.25;
    pivot.scale.setScalar(0.82 + 0.18 * e);
    shadow.material.opacity = e * (1 - explode * 0.6);

    const dist = fitDist(1 + explode * 0.55);
    camera.position.set(0, model.flat ? dist * 0.05 : 0, dist);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    placeLabels(Math.max(0, (explode - 0.6) / 0.4) * e);
  }
  raf = requestAnimationFrame(frame);

  if (inside) setInside(true);
  $('.v3d__close').focus({ preventScroll: true });
  active = { close };
  return active;
}
