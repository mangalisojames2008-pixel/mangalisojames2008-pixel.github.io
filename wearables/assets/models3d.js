/* =========================================================
   3D models for the wearables, built in code (three.js).
   Each model is a group of named parts. Every part has:
     key, name, info  (shown when "Look inside" is on)
     obj              (the part's own group)
     dir              (where it moves when the product opens up)
   These are NEXERA illustrations: shapes and inner parts are
   simplified and not to scale. No maker logos are drawn.
   Front of every product faces +z. 1 unit is about 10 mm.
   ========================================================= */
import * as THREE from './vendor/three.module.min.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* ---------- materials ---------- */
const metal = (color, rough = 0.32) => new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness: rough, clearcoat: 0.3, clearcoatRoughness: 0.2 });
const plastic = (color, rough = 0.55) => new THREE.MeshPhysicalMaterial({ color, metalness: 0, roughness: rough, clearcoat: 0.15 });
const rubber = color => new THREE.MeshPhysicalMaterial({ color, metalness: 0, roughness: 0.78, sheen: 0.4, sheenColor: new THREE.Color(0x888888) });
const glass = () => new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.22, clearcoat: 1, clearcoatRoughness: 0.02, depthWrite: false });
const glow = (color, k = 2.2) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k, roughness: 0.4 });
const pcb = () => new THREE.MeshStandardMaterial({ color: 0x1f4d3a, roughness: 0.6, metalness: 0.2 });
const chip = () => new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.35, metalness: 0.4 });
const gold = () => metal(0xd4a64a, 0.25);
const foil = () => metal(0xb9bcc2, 0.42);

/* ---------- textures drawn on a canvas ---------- */
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
/* a plain watch face of our own: time, date, an activity ring. No maker design. */
function faceTex({ round = false, accent = '#d8ff3d', lcd = false } = {}) {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = lcd ? '#0b0d0c' : '#000'; g.fillRect(0, 0, w, h);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 18;
    g.beginPath(); g.arc(w / 2, h / 2, round ? 200 : 190, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = accent;
    g.beginPath(); g.arc(w / 2, h / 2, round ? 200 : 190, -Math.PI / 2, Math.PI * 0.9); g.stroke();
    g.fillStyle = '#f4f2ed'; g.font = '600 150px -apple-system, Segoe UI, Roboto, Arial, sans-serif';
    g.fillText('10:08', w / 2, h / 2 - 6);
    g.fillStyle = 'rgba(244,242,237,.65)'; g.font = '500 40px -apple-system, Segoe UI, Roboto, Arial, sans-serif';
    g.fillText('SAT 23', w / 2, h / 2 - 118);
    g.fillStyle = accent; g.font = '500 38px -apple-system, Segoe UI, Roboto, Arial, sans-serif';
    g.fillText('8 412 steps', w / 2, h / 2 + 112);
  });
}
function noiseTex(base, spread, size = 256, sparkle = 0) {
  return canvasTex(size, size, (g, w, h) => {
    const img = g.createImageData(w, h), c = new THREE.Color(base);
    for (let i = 0; i < w * h; i++) {
      const n = (Math.random() - 0.5) * spread + (Math.random() < sparkle ? 0.5 : 0);
      img.data[i * 4] = Math.min(255, Math.max(0, (c.r + n) * 255));
      img.data[i * 4 + 1] = Math.min(255, Math.max(0, (c.g + n) * 255));
      img.data[i * 4 + 2] = Math.min(255, Math.max(0, (c.b + n) * 255));
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });
}
function weaveTex(color) {
  const t = canvasTex(128, 128, (g, w, h) => {
    const c = new THREE.Color(color);
    g.fillStyle = '#' + c.getHexString(); g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) {
      const k = ((x + y) / 8) % 2 ? 0.16 : -0.12;
      g.fillStyle = `rgba(${k > 0 ? '255,255,255' : '0,0,0'},${Math.abs(k)})`;
      g.fillRect(x, y, 8, 4);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 10);
  return t;
}
function woodTex() {
  const t = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#7a4b2a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const y = Math.random() * h, a = Math.random() * 0.18;
      g.strokeStyle = Math.random() < 0.5 ? `rgba(40,20,8,${a})` : `rgba(200,140,90,${a})`;
      g.lineWidth = 1 + Math.random() * 3;
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x / 60 + i) * 4);
      g.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/* ---------- shapes ---------- */
function rrect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
/* rounded slab in the x/y plane, d thick along z, centred */
function slab(w, h, d, r, bevel = 0.04) {
  const b = Math.min(bevel, d / 3);
  const g = new THREE.ExtrudeGeometry(rrect(w - 2 * b, h - 2 * b, Math.max(0.01, r - b)), { depth: d - 2 * b, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 16 });
  g.translate(0, 0, -(d - 2 * b) / 2);
  return g;
}
/* rounded frame (a slab with a hole) */
function frame(w, h, d, r, wall, bevel = 0.05) {
  const s = rrect(w, h, r); s.holes.push(rrect(w - 2 * wall, h - 2 * wall, Math.max(0.02, r - wall)));
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.6, bevelSegments: 3, curveSegments: 20 });
  g.translate(0, 0, -(d - 2 * bevel) / 2);
  return g;
}
/* a flat shape (for screens) whose UVs run 0..1 across it */
function screen(w, h, r) {
  const g = new THREE.ShapeGeometry(rrect(w, h, r), 16);
  const uv = g.attributes.uv, p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h + 0.5);
  return g;
}
/* a watch strap that leaves the case at y=0 and curls back behind the wrist */
function strapGeo(width, length, thick, radius) {
  const g = new THREE.BoxGeometry(width, length, thick, 1, 48, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) + length / 2, z = p.getZ(i);
    const a = y / radius, r = radius - z;
    p.setXYZ(i, p.getX(i), Math.sin(a) * r, -radius + Math.cos(a) * r);
  }
  g.computeVertexNormals();
  return g;
}
/* a ring band: lathe of a profile, axis along z */
function band(profile, segs = 96, start = 0, len = Math.PI * 2) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segs, start, len);
  g.rotateX(Math.PI / 2);
  return g;
}
const tube = (r0, r1, h) => [[r0, -h / 2], [r1, -h / 2], [r1, h / 2], [r0, h / 2], [r0, -h / 2]];

const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m; };

/* ---------- part list helper ---------- */
function kit() {
  const root = new THREE.Group(), parts = [];
  const part = (key, name, info, dir, ...objs) => {
    const g = new THREE.Group(); g.name = key; objs.forEach(o => g.add(o)); root.add(g);
    parts.push({ key, name, info, obj: g, dir: dir.clone ? dir : V(...dir) });
    return g;
  };
  return { root, parts, part };
}

/* =========================================================
   Square smartwatch (Redmi Watch 5 Active, Colmi P71)
   ========================================================= */
function watchSquare(o) {
  const { w = 3.9, h = 4.6, d = 1.05, r = 0.95, color = 0x2a2c31, strap = 0x1c1d21, accent = '#d8ff3d', calls = true, woven = false } = o;
  const { root, parts, part } = kit();
  const face = faceTex({ accent });

  part('glass', 'Cover glass', 'Hardened glass over the screen. Takes the knocks and keeps out dust and sweat.', [0, 0, 3.0],
    mesh(slab(w - 0.12, h - 0.12, 0.12, r - 0.06, 0.05), glass(), 0, 0, d / 2 + 0.04));
  part('display', 'Display', 'The screen and its touch layer. Shows time, workouts and messages.', [0, 0, 2.1],
    mesh(slab(w - 0.36, h - 0.36, 0.06, r - 0.18, 0.02), plastic(0x050506, 0.3), 0, 0, d / 2 - 0.06),
    mesh(screen(w - 0.52, h - 0.52, r - 0.26), new THREE.MeshBasicMaterial({ map: face, toneMapped: false }), 0, 0, d / 2 - 0.025));
  part('frame', 'Case', 'The outer shell that holds every part and takes the strap.', [0, 0, 0],
    mesh(frame(w, h, d, r, 0.2), metal(color, 0.38)),
    mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.22, 20).rotateZ(Math.PI / 2), metal(color, 0.3), w / 2 + 0.06, h * 0.12, 0.05));
  part('board', 'Main board', 'The chip, memory and Bluetooth radio that run the watch and talk to your phone.', [0, 0, 1.1],
    mesh(slab(w - 0.8, h - 1.3, 0.07, 0.4, 0.02), pcb(), 0, 0, 0.12),
    mesh(new THREE.BoxGeometry(0.75, 0.75, 0.12), chip(), -0.4, 0.3, 0.2),
    mesh(new THREE.BoxGeometry(0.45, 0.3, 0.1), chip(), 0.6, 0.55, 0.19),
    mesh(new THREE.BoxGeometry(0.35, 0.35, 0.08), gold(), 0.55, -0.45, 0.18));
  part('battery', 'Battery', 'A flat rechargeable cell. Charges through the contacts on the back.', [0, 0, -0.9],
    mesh(slab(w - 1.0, h - 1.5, 0.32, 0.25, 0.06), foil(), 0, 0, -0.18));
  part('motor', 'Vibration motor', 'Taps your wrist for alerts, alarms and lap markers.', [2.3, -0.4, 0],
    mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.22, 24).rotateX(Math.PI / 2), foil(), w / 2 - 0.62, -h / 2 + 0.78, 0.0));
  if (calls) part('speaker', 'Speaker and microphones', 'Lets you take Bluetooth calls on your wrist while the phone stays in your bag.', [-2.3, -0.6, 0],
    mesh(new THREE.BoxGeometry(0.95, 0.32, 0.2), chip(), -w / 2 + 0.85, -h / 2 + 0.55, -0.05),
    mesh(new THREE.BoxGeometry(0.8, 0.12, 0.02), metal(0x888b92, 0.5), -w / 2 + 0.85, -h / 2 + 0.55, 0.06));
  const sensor = new THREE.Group();
  sensor.add(mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.16, 48).rotateX(Math.PI / 2), plastic(0x101114, 0.25), 0, 0, 0));
  [[-0.28, 0.18], [0.28, 0.18]].forEach(([x, y]) => sensor.add(mesh(new THREE.BoxGeometry(0.16, 0.16, 0.04), glow(0x22dd66), x, y, -0.09)));
  sensor.add(mesh(new THREE.BoxGeometry(0.22, 0.22, 0.04), glow(0xdd2222, 1.4), 0, -0.25, -0.09));
  [[-0.55, -0.55], [0.55, -0.55]].forEach(([x, y]) => sensor.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 16).rotateX(Math.PI / 2), gold(), x, y, -0.09)));
  sensor.position.z = -d / 2 - 0.08;
  part('back', 'Back and sensor', 'The light sensor reads your pulse through the skin for wellness tracking. The gold dots are the charging contacts.', [0, 0, -2.0],
    mesh(slab(w - 0.3, h - 0.3, 0.16, r - 0.15, 0.06), plastic(0x17181c, 0.4), 0, 0, -d / 2 + 0.02), sensor);
  const sMat = woven ? new THREE.MeshPhysicalMaterial({ map: weaveTex(strap), roughness: 0.9, sheen: 0.6, sheenColor: new THREE.Color(0xffffff) }) : rubber(strap);
  const sw = Math.min(2.2, w * 0.56);
  const top = mesh(strapGeo(sw, 3.0, 0.24, 2.7), sMat, 0, h / 2 - 0.1, -0.05);
  const bot = mesh(strapGeo(sw, 3.0, 0.24, 2.7), sMat.clone(), 0, -h / 2 + 0.1, -0.05); bot.rotation.z = Math.PI;
  part('strapTop', 'Strap', woven ? 'Woven nylon: light, breathes, dries quickly after a run.' : 'Soft strap that clips off, so you can swap colours.', [0, 1.6, 0], top);
  part('strapBottom', 'Strap', woven ? 'Hook-side strap of the woven band.' : 'The buckle side of the strap.', [0, -1.6, 0], bot);
  return { root, parts, size: Math.max(w, h + 3) };
}

/* =========================================================
   Fitness band (Smart Band 10): a slim capsule
   ========================================================= */
function bandTracker(o) {
  const m = watchSquare({ w: 2.15, h: 4.6, d: 1.0, r: 1.07, color: o.color ?? 0x1b1c20, strap: o.strap ?? 0x141518, accent: '#6ad1ff', calls: false });
  return { ...m, size: 7 };
}

/* =========================================================
   Round outdoor watch (Spovan PR3)
   ========================================================= */
function watchRound(o) {
  const { R = 2.25, d = 1.3, color = 0x23252a, strap = 0x1b1c1f } = o;
  const { root, parts, part } = kit();
  const ring = (r0, r1, h, mat, z = 0, segs = 72) => mesh(band(tube(r0, r1, h), segs), mat, 0, 0, z);
  part('glass', 'Cover glass', 'Mineral glass over the screen.', [0, 0, 3.0],
    mesh(new THREE.CylinderGeometry(R - 0.45, R - 0.45, 0.1, 64).rotateX(Math.PI / 2), glass(), 0, 0, d / 2 + 0.08));
  const bezel = new THREE.Group();
  bezel.add(ring(R - 0.45, R + 0.05, 0.3, metal(0x2f3238, 0.45), d / 2 - 0.02));
  for (let i = 0; i < 60; i += 5) { const a = i / 60 * Math.PI * 2; bezel.add(mesh(new THREE.BoxGeometry(0.05, i % 15 ? 0.14 : 0.24, 0.02), plastic(0xe8e6e1, 0.4), Math.sin(a) * (R - 0.2), Math.cos(a) * (R - 0.2), d / 2 + 0.14)); bezel.children.at(-1).rotation.z = -a; }
  part('bezel', 'Bezel', 'A raised ring that protects the glass when you knock the watch on rock or gym kit.', [0, 0, 2.3], bezel);
  part('display', 'Display', 'A bright screen you can read in direct sun.', [0, 0, 1.6],
    mesh(new THREE.CircleGeometry(R - 0.55, 64), new THREE.MeshBasicMaterial({ map: faceTex({ round: true, accent: '#ffb020', lcd: true }), toneMapped: false }), 0, 0, d / 2 - 0.08));
  const fr = new THREE.Group();
  fr.add(ring(R - 0.25, R, d, plastic(color, 0.6)));
  [[1, 0.6], [1, -0.6], [-1, 0.6], [-1, -0.6]].forEach(([s, y]) => fr.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.36, 20).rotateZ(Math.PI / 2), metal(0x9a9ca2, 0.35), s * (R + 0.08), y * R * 0.7, 0)));
  fr.add(mesh(new THREE.BoxGeometry(1.4, 0.6, d * 0.8), plastic(color, 0.6), 0, R, -0.05));
  fr.add(mesh(new THREE.BoxGeometry(1.4, 0.6, d * 0.8), plastic(color, 0.6), 0, -R, -0.05));
  part('frame', 'Case and buttons', 'A tough resin case with four buttons you can press with sweaty or gloved hands.', [0, 0, 0], fr);
  part('board', 'Main board', 'Runs the timer, alarms, step count and the Bluetooth link.', [0, 0, 0.9],
    mesh(new THREE.CylinderGeometry(R - 0.5, R - 0.5, 0.07, 48).rotateX(Math.PI / 2), pcb(), 0, 0, 0.1),
    mesh(new THREE.BoxGeometry(0.7, 0.7, 0.12), chip(), 0.3, 0.3, 0.18));
  part('battery', 'Battery', 'A flat cell sized for weeks between charges or swaps, depending on the version.', [0, 0, -1.0],
    mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.32, 48).rotateX(Math.PI / 2), foil(), 0, 0, -0.25));
  part('back', 'Back cover', 'Screwed-down back that seals the case against water and dust.', [0, 0, -2.0],
    mesh(new THREE.CylinderGeometry(R - 0.25, R - 0.3, 0.2, 64).rotateX(Math.PI / 2), metal(0x8d9096, 0.45), 0, 0, -d / 2 - 0.02));
  const sm = rubber(strap);
  const top = mesh(strapGeo(2.6, 3.1, 0.3, 2.8), sm, 0, R + 0.2, -0.1);
  const bot = mesh(strapGeo(2.6, 3.1, 0.3, 2.8), sm.clone(), 0, -R - 0.2, -0.1); bot.rotation.z = Math.PI;
  part('strapTop', 'Strap', '26 mm strap with a wide buckle.', [0, 1.5, 0], top);
  part('strapBottom', 'Strap', 'The buckle side of the strap.', [0, -1.5, 0], bot);
  return { root, parts, size: 2 * R + 3 };
}

/* =========================================================
   Smart ring (Colmi R10; R12 adds a small display)
   ========================================================= */
function ring(o) {
  const { color = 0x2b2c30, display = false } = o;
  const ri = 1.0, ro = 1.28, wd = 0.8;
  const { root, parts, part } = kit();
  const sparkle = noiseTex(color, 0.28, 256, 0.04);
  sparkle.wrapS = sparkle.wrapT = THREE.RepeatWrapping; sparkle.repeat.set(10, 1);
  const shellMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: sparkle, metalness: 0.85, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.25 });
  const edgeMat = metal(color, 0.18);
  const shell = new THREE.Group();
  shell.add(mesh(band([[ro - 0.12, -wd / 2 + 0.1], [ro, -wd / 2 + 0.12], [ro, wd / 2 - 0.12], [ro - 0.12, wd / 2 - 0.1]]), shellMat));
  shell.add(mesh(band(tube(1.13, ro - 0.06, 0.1)), edgeMat, 0, 0, wd / 2 - 0.05));
  shell.add(mesh(band(tube(1.13, ro - 0.06, 0.1)), edgeMat, 0, 0, -wd / 2 + 0.05));
  part('shell', 'Outer shell', 'Metal shell that protects everything inside. The inside of the ring is sealed resin.', [0, 0, 1.9], shell);

  part('resin', 'Inner resin', 'Clear, smooth resin against your skin. Light from the sensors passes through it.', [0, 0, 0.9],
    mesh(band(tube(ri, 1.13, wd - 0.04)), new THREE.MeshPhysicalMaterial({ color: 0xdde4ea, transparent: true, opacity: 0.28, roughness: 0.05, clearcoat: 1, depthWrite: false })));

  const flex = new THREE.Group();
  flex.add(mesh(band(tube(1.06, 1.08, 0.5), 64, Math.PI * 0.9, Math.PI * 1.2), new THREE.MeshStandardMaterial({ color: 0xc28b2c, roughness: 0.4, metalness: 0.5, side: THREE.DoubleSide })));
  [Math.PI * 1.35, Math.PI * 1.65].forEach(a => { const c = mesh(new THREE.BoxGeometry(0.22, 0.05, 0.22), chip(), Math.cos(a) * 1.04, Math.sin(a) * 1.04, 0); c.rotation.z = a + Math.PI / 2; flex.add(c); });
  part('flex', 'Circuit and chip', 'A thin bendable circuit with the chip and Bluetooth radio, curved to fit the ring.', [0, 0, 0], flex);

  part('battery', 'Battery', 'A curved cell that fills the top of the ring. Charges in the case or on the charger.', [0, 1.1, -0.8],
    mesh(band(tube(1.08, 1.12, 0.46), 48, -Math.PI * 0.2, Math.PI * 0.95), foil()));

  const sens = new THREE.Group();
  const put = (obj, ang, r = 1.02) => { obj.position.set(Math.cos(ang) * r, Math.sin(ang) * r, 0); obj.rotation.z = ang + Math.PI / 2; sens.add(obj); };
  put(mesh(new THREE.BoxGeometry(0.16, 0.04, 0.16), glow(0x22ee66, 2.6)), -Math.PI / 2 - 0.12);
  put(mesh(new THREE.BoxGeometry(0.16, 0.04, 0.16), glow(0x22ee66, 2.6)), -Math.PI / 2 + 0.12);
  put(mesh(new THREE.BoxGeometry(0.18, 0.04, 0.18), glow(0xee2222, 1.8)), -Math.PI / 2 + 0.42);
  put(mesh(new THREE.BoxGeometry(0.2, 0.04, 0.24), chip()), -Math.PI / 2 - 0.42);
  part('sensors', 'Optical sensors', 'Green and red lights with a light sensor. They read pulse, sleep and blood-oxygen trends for wellness tracking.', [0, 0.9, -1.5], sens);

  const pins = new THREE.Group();
  [-0.12, 0.12].forEach(z => { const p = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 16), gold(), 0, 0, z); pins.add(p); });
  pins.position.set(Math.cos(Math.PI * 0.75) * 1.0, Math.sin(Math.PI * 0.75) * 1.0, 0);
  pins.rotation.z = Math.PI * 0.75 + Math.PI / 2;
  part('contacts', 'Charging contacts', 'Two gold contacts that line up with the charger.', [-1.0, 0.4, -1.2], pins);

  if (display) {
    const disp = new THREE.Group();
    const tex = canvasTex(128, 256, (g, w, h) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8f6ff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '600 64px -apple-system, Segoe UI, Roboto, Arial, sans-serif'; g.fillText('10', w / 2, h / 2 - 38); g.fillText('08', w / 2, h / 2 + 38);
    });
    const back = mesh(slab(0.44, 0.78, 0.08, 0.12, 0.03), plastic(0x050506, 0.2)); back.rotation.y = Math.PI / 2; back.position.x = ro + 0.02;
    const scr = mesh(screen(0.36, 0.7, 0.1), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); scr.rotation.y = Math.PI / 2; scr.position.x = ro + 0.065;
    disp.add(back, scr);
    part('display', 'Touch display', 'A small screen on top of the ring. Tap it to see the time, steps and battery.', [1.2, 0, 0.6], disp);
  }
  root.rotation.set(0, 0, 0);
  return { root, parts, size: 3.2 };
}

/* =========================================================
   Strap and protective case set
   ========================================================= */
function strapSet(o) {
  const { color = 0x3c4a5c } = o;
  const w = 3.9, h = 4.6, r = 0.95;
  const { root, parts, part } = kit();
  const ghost = new THREE.MeshPhysicalMaterial({ color: 0x2c2f35, transparent: true, opacity: 0.35, roughness: 0.4, depthWrite: false });
  part('watch', 'Your watch', 'Shown faint: the set fits around a watch you already own. We check the fit before you pay.', [0, 0, 0],
    mesh(slab(w - 0.2, h - 0.2, 0.9, r, 0.08), ghost));
  part('bumper', 'Protective case', 'A slim case that clips around the watch body and takes the knocks.', [0, 0, 2.0],
    mesh(frame(w + 0.1, h + 0.1, 1.05, r + 0.05, 0.22, 0.06), plastic(color, 0.5)));
  const mat = new THREE.MeshPhysicalMaterial({ map: weaveTex(color), roughness: 0.92, sheen: 0.7, sheenColor: new THREE.Color(0xffffff) });
  const top = mesh(strapGeo(2.2, 3.0, 0.22, 2.7), mat, 0, h / 2 - 0.1, -0.05);
  const bot = mesh(strapGeo(2.2, 3.0, 0.22, 2.7), mat.clone(), 0, -h / 2 + 0.1, -0.05); bot.rotation.z = Math.PI;
  part('strapTop', 'Woven nylon strap', 'Soft woven nylon that breathes and dries quickly.', [0, 1.6, 0], top);
  part('strapBottom', 'Woven nylon strap', 'The fastening side of the strap.', [0, -1.6, 0], bot);
  return { root, parts, size: 9 };
}

/* =========================================================
   Watch cases. These lie flat: x is width, y is height, z is depth.
   ========================================================= */
const flat = geo => geo.rotateX(-Math.PI / 2);
function pillow(len, r, mat) { return mesh(new THREE.CapsuleGeometry(r, len, 8, 24).rotateZ(Math.PI / 2), mat); }

function caseTravel(o) {
  const { color = 0x3a2a22 } = o;
  const W = 3.4, D = 3.4, H = 1.8;
  const { root, parts, part } = kit();
  const leather = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: noiseTex(color, 0.08, 256), roughness: 0.7, clearcoat: 0.25, clearcoatRoughness: 0.5, sheen: 0.3 });
  part('base', 'Base', 'The bottom half, with a stiff wall so the watch is not squashed in a bag.', [0, 0, 0],
    mesh(flat(slab(W, D, H / 2, 0.9, 0.18)), leather, 0, -H / 4, 0));
  part('lid', 'Lid', 'PU leather outside, soft lining inside.', [0, 2.2, 0],
    mesh(flat(slab(W, D, H / 2, 0.9, 0.18)), leather.clone(), 0, H / 4, 0));
  part('zip', 'Zip', 'Runs all the way round so the case opens flat.', [0, 1.1, 0],
    mesh(flat(frame(W + 0.04, D + 0.04, 0.08, 0.92, 0.06, 0.02)), metal(0x9fa2a8, 0.35), 0, 0, 0));
  part('lining', 'Soft lining', 'Velvet-feel lining that will not scratch a screen or metal case.', [0, 0.6, 0],
    mesh(flat(slab(W - 0.3, D - 0.3, 0.06, 0.75, 0.02)), plastic(0x2b2b30, 0.95), 0, 0.02, 0));
  part('cushion', 'Watch cushion', 'The strap wraps round this cushion so the watch sits still.', [0, 1.5, 0],
    pillow(1.4, 0.38, plastic(0x34343a, 0.95)));
  parts.find(p => p.key === 'cushion').obj.position.y = 0.3;
  return { root, parts, size: 4.6, flat: true };
}

function caseDisplay(o) {
  const W = 6.6, D = 3.0, H = 1.5;
  const { root, parts, part } = kit();
  const wt = woodTex(); wt.repeat.set(1.5, 1);
  const wood = new THREE.MeshPhysicalMaterial({ map: wt, roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  const base = new THREE.Group();
  base.add(mesh(flat(frame(W, D, H, 0.2, 0.18, 0.04)), wood, 0, 0, 0));
  base.add(mesh(new THREE.BoxGeometry(W - 0.3, 0.12, D - 0.3), wood.clone(), 0, -H / 2 + 0.06, 0));
  part('base', 'Wooden box', 'A solid wooden box with a lacquered finish.', [0, 0, 0], base);
  const lid = new THREE.Group();
  lid.add(mesh(flat(frame(W, D, 0.25, 0.2, 0.28, 0.04)), wood.clone(), 0, 0, 0));
  lid.add(mesh(new THREE.BoxGeometry(W - 0.5, 0.04, D - 0.5), glass(), 0, 0, 0));
  lid.position.y = H / 2 + 0.13;
  part('lid', 'Glass lid', 'A glass top so your watches stay on show and free of dust.', [0, 2.0, -0.6], lid);
  const cush = new THREE.Group();
  [-2.1, 0, 2.1].forEach(x => cush.add(mesh(flat(slab(1.7, 2.5, 0.9, 0.42, 0.34)), plastic(0xd9d3c7, 0.95), x, 0.05, 0)));
  part('cushions', 'Cushions', 'Removable cushions. Wrap the strap round one so each watch sits upright.', [0, 1.0, 0], cush);
  part('hinge', 'Hinges', 'Metal hinges at the back so the lid lifts open.', [0, 0.6, -1.2],
    mesh(new THREE.BoxGeometry(0.5, 0.18, 0.12), metal(0xc9b37a, 0.3), -1.8, H / 2, -D / 2 - 0.04),
    mesh(new THREE.BoxGeometry(0.5, 0.18, 0.12), metal(0xc9b37a, 0.3), 1.8, H / 2, -D / 2 - 0.04));
  return { root, parts, size: 7.4, flat: true };
}

function caseAlu(o) {
  const { slots = 2 } = o;
  const W = 2.2 + slots * 1.6, D = 3.4, H = 1.3;
  const { root, parts, part } = kit();
  const brushed = noiseTex(0xb7bac0, 0.06, 256); brushed.wrapS = brushed.wrapT = THREE.RepeatWrapping; brushed.repeat.set(1, 18);
  const alu = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: brushed, metalness: 1, roughness: 0.35, clearcoat: 0.2 });
  part('base', 'Aluminium shell', 'A hard aluminium shell that does not crush when a bag gets thrown around.', [0, 0, 0],
    mesh(flat(frame(W, D, H, 0.35, 0.1, 0.04)), alu, 0, 0, 0),
    mesh(new THREE.BoxGeometry(W - 0.2, 0.08, D - 0.2), alu.clone(), 0, -H / 2 + 0.04, 0));
  part('lid', 'Lid', 'Aluminium lid with a seal around the edge.', [0, 2.0, -0.4],
    mesh(flat(slab(W, D, 0.35, 0.35, 0.08)), alu.clone(), 0, H / 2 + 0.18, 0));
  const foam = new THREE.Group();
  const fm = plastic(0x1d1e22, 1);
  foam.add(mesh(new THREE.BoxGeometry(W - 0.25, 0.7, D - 0.25), fm, 0, -0.15, 0));
  for (let i = 0; i < slots; i++) foam.add(pillow(0.7, 0.36, plastic(0x2a2b30, 1)).translateX(-((slots - 1) * 1.6) / 2 + i * 1.6).translateY(0.3));
  foam.children.slice(1).forEach(c => { c.rotation.y = Math.PI / 2; });
  part('foam', 'Foam insert', 'Shaped foam with one slot per watch. Choose 1, 2 or 3 slots.', [0, 1.0, 0], foam);
  part('latches', 'Latches', 'Two clasps keep the lid shut.', [0, 0, 0.9],
    mesh(new THREE.BoxGeometry(0.5, 0.35, 0.1), metal(0x2d2e33, 0.3), -W / 4, H / 2 - 0.05, D / 2 + 0.05),
    mesh(new THREE.BoxGeometry(0.5, 0.35, 0.1), metal(0x2d2e33, 0.3), W / 4, H / 2 - 0.05, D / 2 + 0.05));
  return { root, parts, size: W + 1, flat: true };
}

const KINDS = { 'watch-square': watchSquare, band: bandTracker, 'watch-round': watchRound, ring, 'strap-set': strapSet, 'case-travel': caseTravel, 'case-display': caseDisplay, 'case-alu': caseAlu };

/* product.model is { kind, ...settings } from products.json */
export function build(model) {
  const fn = KINDS[model && model.kind] || watchSquare;
  const toHex = v => (typeof v === 'string' && v[0] === '#' ? parseInt(v.slice(1), 16) : v);
  const o = Object.fromEntries(Object.entries(model || {}).map(([k, v]) => [k, toHex(v)]));
  const m = fn(o);
  m.parts.forEach(p => { p.base = p.obj.position.clone(); });
  return m;
}
export { THREE };
