/* =========================================================
   NEXERA showcase settings: WATCH (Series 12 and SE 3 use 'watch', Ultra 4 uses 'ultra')
   Part names here are also the node names a .glb model must use (see models/README.md).
   Text marked TODO is a generic placeholder: replace it when you have the real detail.
   ========================================================= */
import { THREE, PI, lerp, seg, ease, setScreen } from '../../studio.js';
import * as P from '../parts.js';

const REST = { yaw: -0.32, pitch: 0.06 };

export default {
  family: 'watch',
  arts: ['watch', 'ultra'],
  /* Drop-in models. Put the file in nexera/models/ and set, e.g. watch: { url: 'models/watch.glb' } */
  models: { watch: null, ultra: null },
  rest: REST,
  lift: 0.1,
  margin: 1.12,

  /* Rises from below with a 34 degree turn, the face lights up, the time ticks in, then the rest of the face. */
  entrance: {
    duration: 2.3,
    play(m, t, x) {
      const g = m.group;
      g.position.y = lerp(-0.62, 0, ease.out(seg(t, 0, 0.6)));
      g.rotation.y = lerp(REST.yaw + 0.6, REST.yaw, ease.outQuint(seg(t, 0, 0.8)));
      g.rotation.x = lerp(REST.pitch + 0.24, REST.pitch, ease.out(seg(t, 0, 0.8)));
      g.rotation.z = 0;
      setScreen(m, ease.out(seg(t, 0.36, 0.56)));
      x.paint(0, t >= 1 ? null : {
        bg: 1, time: seg(t, 0.44, 0.74), mark: ease.out(seg(t, 0.62, 0.78)),
        bar: ease.out(seg(t, 0.68, 0.84)), fill: ease.out(seg(t, 0.72, 0.98)), text: ease.out(seg(t, 0.78, 0.94))
      });
    }
  },

  /* Inside parts, built in code. All start hidden inside the case. */
  build(x) {
    const { W, H, D, R } = x.size, ultra = x.art === 'ultra';
    const front = D / 2 + (ultra ? 0.0145 : 0.0006);
    const put = (obj, id, pos, opts) => { obj.position.set(...pos); return x.add(obj, id, opts); };
    // outside: speaker and mic openings on the left side (part of the case)
    const holes = P.slots([[0, 0, 0.06, 0.012], [0, -0.032, 0.06, 0.012]]);
    holes.rotation.y = -PI / 2;
    put(holes, 'case-shell', [-W / 2 - 0.0012, ultra ? -0.02 : 0.0, 0], { internal: false });
    // inside
    put(P.glass(W - 0.02, H - 0.02, 0.012, R - 0.012), 'cover-glass', [0, 0, front + 0.007]);
    put(P.panel(W - 0.05, H - 0.05, 0.008, R - 0.03), 'display', [0, 0, front - 0.006]);
    put(P.board(W * 0.7, H * 0.6, 0.007, { chips: [[0, 0.02, 0.11, 0.11, 'main'], [-0.1, -0.075, 0.06, 0.04], [0.095, -0.075, 0.05, 0.05], [0.09, 0.09, 0.04, 0.03, 'small']], seed: 11, bits: 18 }), 'main-board', [0, 0, 0.02]);
    put(P.cell(W * 0.62, H * 0.5, 0.02), 'battery', [0, -0.01, -0.004]);
    put(P.motor(0.12, 0.05, 0.026), 'haptic-motor', [-0.06, -0.15, -0.014]);
    put(P.speaker(0.13, 0.042, 0.026), 'speaker-mic', [-0.08, 0.15, -0.014]);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.09, 16), P.M.steel());
    shaft.rotation.z = PI / 2;
    put(shaft, 'crown-assembly', [W / 2 - 0.035, 0.07, 0]);
    put(P.sensorArray(0.1), 'sensor-array', [0, 0, -D / 2 + 0.008]);
    put(P.glass(0.27, 0.27, 0.01, 0.135), 'back-glass', [0, 0, -D / 2 - 0.004]);
  },

  /* "Look inside": layers move apart along the depth axis, front to back. Offsets are in model units.
     desc: 1 or 2 short lines. Functions read the product's own data; plain strings are generic. */
  parts: [
    { id: 'cover-glass', label: 'Cover glass', off: [0, 0, 0.64], desc: 'Protects the display.' /* TODO: real glass detail */ },
    { id: 'display', label: 'Display panel', off: [0, 0, 0.52], desc: x => x.safe(x.fact(/nits/)) || 'The screen you read and tap.' /* TODO for Series 12 and SE 3 */ },
    { id: 'main-board', label: 'Main chip board', off: [0, 0, 0.4], desc: 'Holds the main chip and memory.' /* TODO */ },
    { id: 'battery', label: 'Battery', off: [0, 0, 0.28], desc: x => { const v = x.safe(x.spec('Battery')); return v ? `${v} of battery life.` : 'Powers the watch.'; } },
    { id: 'haptic-motor', label: 'Haptic motor', off: [-0.07, -0.05, 0.17], desc: 'Makes the taps you feel on your wrist.' /* TODO */ },
    { id: 'speaker-mic', label: 'Speaker and mic', off: [-0.12, 0.06, 0.06], desc: 'For calls, alerts and voice.' /* TODO */ },
    { id: 'crown-assembly', label: 'Crown and button', nodes: ['crown', 'side-button'], off: [0.32, 0, 0], desc: 'Turn the crown to scroll. Press it or the button to act.' /* TODO */ },
    { id: 'sensor-array', label: 'Health sensors', off: [0, 0, -0.26], desc: 'Light sensors on the back read your wrist.' /* TODO */ },
    { id: 'back-glass', label: 'Back glass', off: [0, 0, -0.4], desc: 'Covers the sensors on the back.' /* TODO */ },
    { id: 'case-shell', label: 'Case', nodes: ['action-button'], off: [0, 0, -0.06], desc: x => [x.safe(x.spec('Materials')), x.safe(x.fact(/Water resistant/))].filter(Boolean).join('. ') + '.' },
    { id: 'band-top', label: 'Bands', off: [0, 0.36, -0.03], desc: 'Slide out to swap bands.' /* TODO */ },
    { id: 'band-bottom', group: 'band-top', off: [0, -0.36, -0.03] }
  ],
  insideView: null, // default: a three-quarter view from the right, looking slightly down

  /* Story callouts (the product as it is, no parts moved). at/n are in model space; n = which way the spot faces. */
  callouts: x => {
    const { W, D } = x.size;
    return [
      { label: 'Crown', at: [W / 2 + 0.046, 0.07, 0], n: [1, 0, 0] },
      { label: 'Side button', at: [W / 2 + 0.016, -0.07, 0], n: [1, 0, 0] },
      { label: 'Speaker and mic', at: [-W / 2 - 0.002, x.art === 'ultra' ? -0.036 : -0.016, 0], n: [-1, 0, 0] },
      { label: 'Sensors', at: [0, 0.04, -D / 2 - 0.004], n: [0, 0, -1] }
    ];
  },

  /* Screen close-up: these parts of the face float apart (see DRAW.watch in studio.js). */
  zoom: { screen: true, tex: 0, keys: ['mark', 'time', 'bar', 'text'], gap: 0.05, fill: 0.92, spec: 'Case' },

  /* Holder turns for each story section: [yaw, pitch] in radians. */
  story: {
    count: [-0.7, 0.12],
    features: [[-0.95, 0.06], [-2.75, 0.12], [-4.25, 0.06]],
    colour: [-0.2, 0.08],
    finale: [-0.25, 0.06],
    zoomTilt: [-0.5, 0.16]
  },

  /* The big number. line: which existing text sits under it. */
  count: {
    'watch-series-12': { n: 24, unit: 'hours', line: ['facts', 0] },
    'watch-ultra-4': { n: 50, unit: 'hours', line: ['facts', 0] },
    'watch-se-3': { n: 18, unit: 'hours', line: ['facts', 1] }
  }
};
