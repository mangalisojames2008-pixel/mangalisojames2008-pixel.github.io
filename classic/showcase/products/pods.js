/* =========================================================
   NEXERA showcase settings: EARBUDS ('pods-pro' and 'pods') and over-ear HEADPHONES ('max', a variant below)
   The earbuds keep the original case animation (intro() in studio.js) as the first part of the entrance.
   Part names here are also the node names a .glb model must use (see models/README.md).
   Text marked TODO is a generic placeholder: replace it when you have the real detail.
   ========================================================= */
import { THREE, PI, lerp, clamp01, seg, ease, intro } from '../../studio.js';
import * as P from '../parts.js';

const REST = { yaw: -0.32, pitch: 0.2 };        // the same as the existing resting pose
const MAX_REST = { yaw: -0.42, pitch: 0.2 };
const CASE_TIME = 2.8;                          // the original case animation, untouched
const TOTAL = 3.5;                              // plus the glow and the hover

/* The opened earbud's parts fan out along this direction, in the earbud's own space. */
const DIR = new THREE.Vector3(-0.3, 1, 0.22).normalize();
const along = n => DIR.clone().multiplyScalar(n * 0.1).toArray();

export default {
  family: 'pods',
  arts: ['pods-pro', 'pods', 'max'],
  /* Drop-in models. Put the file in nexera/models/ and set, e.g. 'pods-pro': { url: 'models/earbuds-pro.glb' } */
  models: { 'pods-pro': null, pods: null, max: null },
  /* Extra node names a .glb may replace (they are not opened up in "Look inside"). */
  swappable: ['case', 'lid', 'case-led', 'bud-left', 'cushion-left', 'cup-left'],
  rest: REST,
  lift: 0.22,
  margin: 1.08,

  /* 1. The original animation: the case opens and the earbuds rise out (studio.js intro(), unchanged).
     2. Then a soft light comes on inside the case and the earbuds hover above it. */
  entrance: {
    duration: TOTAL,
    play(m, t, x) {
      intro(m, m.kind, Math.min(1, t * TOTAL / CASE_TIME));
      const glow = ease.out(seg(t, CASE_TIME / TOTAL - 0.04, 1));
      x.state.t = t;
      const s = x.state;
      if (s.glow) { s.glow.opacity = 0.9 * glow; s.halo.opacity = 0.32 * glow; }
      if (s.cav) s.cav.emissiveIntensity = 0.55 * glow;
    }
  },

  build(x) {
    const p = x.p, split = p.split;
    // light inside the open case
    const glow = P.glowSprite(0.5, 0xffe2c6, 0); glow.rotation.x = -PI / 2; glow.position.set(0, split + 0.006, 0);
    x.add(glow, 'case-glow', { internal: false });
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: P.TEX.glow(), color: 0xffd9bd, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    halo.scale.set(0.95, 0.75, 1); halo.position.set(0, split + 0.2, -0.05);
    x.add(halo, 'case-glow', { internal: false });
    x.state.glow = glow.material; x.state.halo = halo.material; x.state.cav = p.cav.material;
    const cav = p.cav.material; cav.emissive = new THREE.Color(0xffcfa0); cav.emissiveIntensity = 0;
    // inside the right earbud
    const bud = x.node('bud-right'), pro = p.pro;
    const put = (obj, id, pos, rot) => { obj.position.set(...pos); if (rot) obj.rotation.set(...rot); return x.add(obj, id, { parent: bud }); };
    put(P.driver(0.034, 0.018), 'driver', [0.012, 0.022, 0.03]);
    put(P.board(0.075, 0.05, 0.004, { chips: [[0, 0.003, 0.026, 0.026, 'main'], [0.024, -0.014, 0.012, 0.01, 'small']], bits: 8, r: 0.008, seed: 4 }), 'audio-board', [0, 0.004, 0]);
    put(P.buttonCell(0.026, 0.016), 'battery', [-0.004, 0, -0.022]);
    put(P.mics(2, 0.0065, 0.03), 'microphones', [0.016, pro ? -0.12 : -0.15, 0.012], [0, 0, PI / 2 + 0.12]);
    const sens = new THREE.Group();
    for (const [sx, sy] of [[0, 0], [0.014, 0.008]]) { const d = new THREE.Mesh(new THREE.CircleGeometry(0.006, 16), P.M.led(0x55e08a)); d.position.set(sx, sy, 0.001); sens.add(d); }
    sens.add(new THREE.Mesh(new THREE.CircleGeometry(0.016, 24), P.M.black()));
    put(sens, 'sensors', [-0.03, -0.005, 0.05], [0, -0.5, 0]);
    put(P.antenna(pro ? 0.11 : 0.15, 0.01), 'antenna', [0.018, pro ? -0.1 : -0.12, 0.012], [0, 0, 0.12]);
  },

  /* After the entrance the earbuds hover. The one that opens up turns to show its parts; the other keeps floating. */
  idle(m, now, x) {
    const w = smoothstep(seg(x.state.t ?? 0, 0.86, 1)), e = x.explode, [L, R] = m.buds;
    L.position.y += Math.sin(now / 1150) * 0.014 * w;
    L.rotation.y += Math.sin(now / 1900) * 0.1 * w;
    L.rotation.z += Math.sin(now / 2300) * 0.03 * w;
    R.position.y += Math.sin(now / 1150 + 1.9) * 0.014 * w * (1 - e) - 0.12 * e;
    R.rotation.y += Math.sin(now / 2100 + 1) * 0.1 * w * (1 - e) + 0.55 * e;
    R.rotation.z += -0.3 * e;
    R.position.x += 0.2 * e;
  },

  /* "Look inside": only the right earbud opens. Ear tip first, outer shell last. */
  parts: [
    { id: 'ear-tip', within: 'bud-right', label: 'Ear tip', off: along(7), desc: 'A soft tip that seals the ear.' /* TODO */ },
    { id: 'driver', within: 'bud-right', nodes: ['grille'], label: 'Speaker driver', off: along(6), desc: 'Turns the signal into sound.' /* TODO */ },
    { id: 'audio-board', within: 'bud-right', label: 'Audio chip board', off: along(5), desc: 'Runs the sound and the noise cancellation.' /* TODO */ },
    { id: 'battery', within: 'bud-right', label: 'Battery cell', off: along(4), desc: x => { const v = x.safe(x.spec('Battery')); return v ? `${v}.` : 'Powers the earbud.'; } },
    { id: 'microphones', within: 'bud-right', nodes: ['mic-cap'], label: 'Microphones', off: along(3), desc: 'Pick up your voice and the noise around you.' /* TODO */ },
    { id: 'sensors', within: 'bud-right', label: 'Sensors', off: along(2), desc: x => { const f = x.safe(x.fact(/heart rate/i)); return f ? `${f}.` : 'Sense when the earbud is in your ear.'; } /* TODO for AirPods 5 */ },
    { id: 'antenna', within: 'bud-right', label: 'Stem antenna', off: along(1.1), desc: 'Keeps the wireless link strong.' /* TODO */ },
    { id: 'outer-shell', within: 'bud-right', nodes: ['bud-shell', 'stem'], label: 'Outer shell', off: [0, 0, 0], desc: x => { const v = x.safe(x.spec('Water and dust')); return v ? `${v} rated for water and dust.` : 'The outer shell.'; } }
  ],
  insideView: [-REST.yaw + 0.05, -REST.pitch + 0.08],
  fitInside: 0.8,

  callouts: x => {
    const { a, b, c } = x.size;
    return [
      x.p.pro && { label: 'Ear tip', node: 'ear-tip', within: 'bud-left', at: [-0.03, 0, 0], n: null },
      { label: 'Sensors', node: 'bud-shell', within: 'bud-left', at: [-0.045, -0.01, 0.045], n: null },
      { label: 'Stem and controls', node: 'stem', within: 'bud-right', at: [0, 0.02, 0.02], n: null },
      { label: 'Charging case', at: [-a * 0.62, -b * 0.4, c * 0.92], n: [0, 0, 1] },
      { label: 'Case light', node: 'case-led', at: [0, 0, 0], n: [0, 0, 1] }
    ].filter(Boolean);
  },

  zoom: { node: 'bud-right', rings: 3, radius: 0.34, gap: 0.09, spec: 'Noise cancellation' },

  story: {
    count: [0.45, 0],
    features: [[0.1, 0], [-0.55, 0.06], [0.55, 0.1]],
    colour: [0.1, 0],
    finale: [0.05, 0],
    zoomTilt: [-0.35, 0.1]
  },

  count: {
    'airpods-pro-3': { n: 8, unit: 'hours', line: ['facts', 1] },
    'airpods-5': { n: 22, unit: 'hours', line: ['specs', 'Battery'] },
    'airpods-max-2': { n: 20, unit: 'hours', line: ['facts', 1] }
  },

  /* ---------------- over-ear headphones ---------------- */
  variants: {
    max: {
      rest: MAX_REST,
      lift: 0.14,
      margin: 1.06,
      entrance: { duration: 2.2, play(m, t) { intro(m, 'max', t); } },
      idle: null,
      build(x) {
        const { rad } = x.size;
        const put = (obj, id, pos, ry = PI / 2) => { obj.position.set(...pos); obj.rotation.y = ry; return x.add(obj, id); };
        put(P.driver(0.2, 0.08), 'max-driver', [rad - 0.06, -0.2, 0], -PI / 2);
        put(P.board(0.3, 0.22, 0.012, { chips: [[0, 0.02, 0.08, 0.08, 'main'], [0.09, -0.06, 0.05, 0.04]], bits: 14, seed: 8 }), 'max-board', [rad + 0.02, -0.1, 0]);
        put(P.cell(0.34, 0.24, 0.04), 'max-battery', [rad + 0.06, -0.32, 0]);
      },
      parts: [
        { id: 'cushion-right', label: 'Ear cushion', off: [-0.34, 0, 0], desc: 'Soft cushion that seals around the ear.' /* TODO */ },
        { id: 'max-driver', label: 'Speaker driver', off: [0.22, 0, 0], desc: 'Turns the signal into sound.' /* TODO */ },
        { id: 'max-board', label: 'Audio chip board', off: [0.44, 0.06, 0], desc: 'Runs the sound and the noise cancellation.' /* TODO */ },
        { id: 'max-battery', label: 'Battery', off: [0.64, -0.06, 0], desc: x => { const v = x.safe(x.spec('Battery')); return v ? `${v}.` : 'Powers the headphones.'; } },
        { id: 'cup-right', label: 'Ear cup', nodes: ['controls'], off: [0.88, 0, 0], desc: 'The outer cup, with the controls on top.' /* TODO */ },
        { id: 'headband', label: 'Headband', nodes: ['canopy'], off: [0, 0.42, 0], desc: 'Spreads the weight across your head.' /* TODO */ }
      ],
      insideView: null,
      fitInside: 0.9,
      callouts: x => {
        const { rad, top } = x.size;
        return [
          { label: 'Ear cushion', at: [-(rad - 0.28), -0.25, 0.3], n: null },
          { label: 'Controls', at: [rad + 0.05, 0.3, 0.2], n: [1, 0, 0] },
          { label: 'Headband', at: [0, top + rad - 0.02, 0], n: null },
          { label: 'Ear cup', at: [rad + 0.2, -0.2, 0.1], n: [1, 0, 0] }
        ];
      },
      zoom: { node: 'cup-right', rings: 3, radius: 0.55, gap: 0.2, spec: 'Noise cancellation' },
      story: {
        count: [0.5, 0],
        features: [[-0.2, 0.06], [-1.0, 0.1], [0.9, 0.14]],
        colour: [0.1, 0.04],
        finale: [0, 0],
        zoomTilt: [-0.3, 0.1]
      }
    }
  }
};

function smoothstep(t) { return t * t * (3 - 2 * t); }
