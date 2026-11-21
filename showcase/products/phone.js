/* =========================================================
   NEXERA showcase settings: PHONE ('pro', 'air', 'dual', 'e') and the foldable ('duo', a variant below)
   Part names here are also the node names a .glb model must use (see models/README.md).
   Text marked TODO is a generic placeholder: replace it when you have the real detail.
   ========================================================= */
import { THREE, PI, lerp, seg, ease, setScreen, intro } from '../../studio.js';
import * as P from '../parts.js';

const REST = { yaw: -0.35, pitch: 0.06 };
const DUO_REST = { yaw: -0.36, pitch: 0.12 };   // the same as the Duo's existing resting pose

const displayDesc = x => { const v = x.spec('Display'), s = x.safe(v), i = x.inch(v); return s ? `${s} display.` : i ? `${i} display.` : 'The screen you see and touch.'; };
const cameraDesc = x => { const v = x.spec('Rear camera'), s = x.safe(v), mp = (String(v || '').match(/^\d+MP/) || [])[0]; return s ? `${s}.` : mp ? `${mp} rear camera.` : 'The rear cameras.'; };
const batteryDesc = x => { const v = x.safe(x.spec('Video playback')); return v ? `Video playback: ${v.charAt(0).toLowerCase()}${v.slice(1)}.` : 'Powers the phone all day.'; };
const lockScreen = t => ({
  bg: 1, status: ease.out(seg(t, 0.55, 0.7)), time: seg(t, 0.56, 0.8),
  line: ease.out(seg(t, 0.7, 0.84)), mark: ease.out(seg(t, 0.74, 0.9)), dock: ease.out(seg(t, 0.8, 0.97))
});

export default {
  family: 'phone',
  arts: ['pro', 'air', 'dual', 'e', 'duo'],
  /* Drop-in models. Put the file in nexera/models/ and set, e.g. pro: { url: 'models/phone-pro.glb' } */
  models: { pro: null, air: null, dual: null, e: null, duo: null },
  rest: REST,
  lift: 0.12,
  margin: 1.1,

  /* Rises in slightly tilted, turns to face you, then the lock screen wakes: time first, then the rest. */
  entrance: {
    duration: 2.4,
    play(m, t, x) {
      const g = m.group;
      g.position.y = lerp(-0.75, 0, ease.out(seg(t, 0, 0.6)));
      g.rotation.z = lerp(0.24, 0, ease.out(seg(t, 0, 0.78)));
      g.rotation.y = lerp(REST.yaw + 1.1, REST.yaw, ease.outQuint(seg(t, 0, 0.85)));
      g.rotation.x = lerp(REST.pitch + 0.32, REST.pitch, ease.out(seg(t, 0, 0.85)));
      setScreen(m, ease.out(seg(t, 0.5, 0.66)));
      x.paint(0, t >= 1 ? null : lockScreen(t));
    }
  },

  build(x) {
    const { W, H, D } = x.size, R = W * 0.163, zf = D / 2, zb = -D / 2;
    const put = (obj, id, pos, opts) => { obj.position.set(...pos); return x.add(obj, id, opts); };
    // outside: charging port and speaker grilles on the bottom edge (part of the frame)
    const bottom = new THREE.Group();
    bottom.add(P.slots([[0, 0, 0.09, 0.026]], 0));
    for (const s of [-1, 1]) { const gr = P.grille(0.12, 0.02); gr.position.x = s * 0.17; bottom.add(gr); }
    bottom.rotation.x = PI / 2;
    put(bottom, 'frame', [0, -H / 2 - 0.0012, 0], { internal: false });
    // inside
    put(P.glass(W - 0.01, H - 0.01, 0.012, R - 0.004), 'cover-glass', [0, 0, zf + 0.007]);
    put(P.panel(W - 0.04, H - 0.04, 0.01, R - 0.02), 'display', [0, 0, zf - 0.008]);
    put(P.board(W * 0.6, H * 0.3, 0.01, { chips: [[0.02, 0.03, 0.15, 0.15, 'main'], [-0.14, -0.08, 0.1, 0.07], [0.14, -0.09, 0.08, 0.06], [-0.15, 0.12, 0.06, 0.05, 'small']], seed: 5 }), 'logic-board', [W * 0.08, H * 0.25, 0.006]);
    put(P.cell(W * 0.78, H * 0.46, 0.03), 'battery', [0, -H * 0.17, -0.006]);
    const sh = new THREE.Group();
    const spk = P.speaker(0.22, 0.07, 0.03); spk.position.x = -0.16;
    const mot = P.motor(0.17, 0.07, 0.03); mot.position.x = 0.16;
    sh.add(spk, mot);
    put(sh, 'speakers-haptic', [0, -H / 2 + 0.09, 0]);
    put(P.coil(0.2), 'charging-coil', [0, -0.05, zb + 0.012]);
    put(P.plate(W - 0.024, H - 0.024, 0.01, R - 0.012, x.p.recolor[0]), 'back-glass', [0, 0, zb - 0.002]);
  },

  /* "Look inside": front to back along the depth axis. The camera lenses lift out one by one. */
  parts: [
    { id: 'cover-glass', label: 'Cover glass', off: [0, 0, 1.12], desc: 'Protects the display.' /* TODO */ },
    { id: 'display', label: 'Display panel', off: [0, 0, 0.85], desc: displayDesc },
    { id: 'frame', label: 'Frame and midplate', faces: true, off: [0, 0, 0.55], desc: 'The metal frame and plate that hold it all.' /* TODO */ },
    { id: 'logic-board', label: 'Main logic board', off: [0, 0, 0.24], desc: 'The main chip, memory and storage.' /* TODO */ },
    { id: 'battery', label: 'Battery', off: [0, 0, -0.08], desc: batteryDesc },
    { id: 'camera-module', label: 'Camera module', off: [0, 0, -0.4], desc: cameraDesc },
    { id: 'lens-1', group: 'camera-module', off: [0, 0, -0.55] },
    { id: 'lens-2', group: 'camera-module', off: [0, 0, -0.64] },
    { id: 'lens-3', group: 'camera-module', off: [0, 0, -0.73] },
    { id: 'speakers-haptic', label: 'Speakers and haptic motor', off: [0, -0.06, -0.72], desc: 'Sound out, and the taps you feel.' /* TODO */ },
    { id: 'charging-coil', label: 'Wireless charging coil', off: [0, 0, -0.94], desc: 'Charges the phone without a cable.' /* TODO: confirm per model */ },
    { id: 'back-glass', label: 'Back glass', off: [0, 0, -1.16], desc: 'The coloured back panel.' /* TODO */ }
  ],
  insideView: [-REST.yaw - 1.15, -REST.pitch + 0.2],

  callouts: x => {
    const { W, H } = x.size, lens = x.node('lens-1');
    return [
      { label: 'Cameras', at: lens ? lens.position.toArray() : [0.2, 0.55, -0.06], n: [0, 0, -1] },
      { label: 'Side buttons', at: [W / 2 + 0.012, 0.22, 0], n: [1, 0, 0] },
      { label: 'Speaker grilles', at: [-0.17, -H / 2 - 0.002, 0], n: [0, -1, 0] },
      { label: 'Charging port', at: [0, -H / 2 - 0.002, 0], n: [0, -1, 0] }
    ];
  },

  zoom: { screen: true, tex: 0, keys: ['status', 'time', 'line', 'mark', 'dock'], gap: 0.11, fill: 0.95, spec: 'Display' },

  story: {
    count: [0.5, 0.12],
    features: [[2.95, 0.14], [0.45, -1.15], [-0.95, 0.05]],
    colour: [-0.15, 0.08],
    finale: [-0.2, 0.05],
    zoomTilt: [-0.55, 0.16]
  },

  count: {
    'iphone-18-pro': { n: 36, unit: 'hours', line: ['facts', 2] },
    'iphone-18-pro-max': { n: 45, unit: 'hours', line: ['facts', 2] },
    'iphone-air': { n: 5.64, dec: 2, unit: 'mm', line: ['specs', 'Build'] },
    'iphone-17': { n: 30, unit: 'hours', line: ['facts', 2] },
    'iphone-17e': { n: 26, unit: 'hours', line: ['facts', 2] },
    'iphone-duo': { n: 7.6, dec: 1, unit: 'inch', line: ['facts', 0] }
  },

  /* ---------------- the foldable ---------------- */
  variants: {
    duo: {
      rest: DUO_REST,
      lift: 0.14,
      /* Keeps the Duo's own unfold, then wakes the inner screen piece by piece. */
      entrance: {
        duration: 2.8,
        play(m, t, x) {
          intro(m, 'duo', t);
          if (t > 0.6) x.paint(0, t >= 1 ? null : { bg: 1, widget: ease.out(seg(t, 0.66, 0.8)), time: seg(t, 0.64, 0.84), line: ease.out(seg(t, 0.74, 0.88)), tiles: ease.out(seg(t, 0.78, 0.92)), mark: ease.out(seg(t, 0.8, 0.94)), dock: ease.out(seg(t, 0.84, 0.98)) });
        }
      },
      build(x) {
        const { W2, H, D } = x.size, hinge = x.p.hinge;
        const put = (obj, id, pos, parent) => { obj.position.set(...pos); return x.add(obj, id, { parent }); };
        const bottom = new THREE.Group();
        bottom.add(P.slots([[0, 0, 0.09, 0.022]], 0));
        const gr = P.grille(0.12, 0.018); gr.position.x = -0.2; bottom.add(gr);
        bottom.rotation.x = PI / 2;
        bottom.position.set(-W2 / 2, -H / 2 - 0.0012, 0);
        x.add(bottom, 'frame', { internal: false });
        put(P.glass(W2 * 2 - 0.02, H - 0.02, 0.01, 0.09), 'cover-glass', [0, 0, D / 2 + 0.006]);
        put(P.panel(W2 * 2 - 0.05, H - 0.05, 0.008, 0.08), 'display', [0, 0, D / 2 - 0.006]);
        put(P.board(W2 * 0.6, H * 0.34, 0.01, { chips: [[0.02, 0.03, 0.14, 0.14, 'main'], [-0.14, -0.08, 0.09, 0.07], [0.14, -0.09, 0.08, 0.06]], seed: 9 }), 'logic-board', [-W2 * 0.45, H * 0.2, 0]);
        put(P.cell(W2 * 0.7, H * 0.42, 0.024), 'battery', [-W2 * 0.5, -H * 0.2, -0.004]);
        put(P.cell(W2 * 0.72, H * 0.6, 0.024), 'battery', [W2 / 2, -0.02, -D / 2], hinge);
        const sh = new THREE.Group();
        const spk = P.speaker(0.2, 0.06, 0.026); spk.position.x = -0.12;
        const mot = P.motor(0.15, 0.06, 0.026); mot.position.x = 0.12;
        sh.add(spk, mot);
        put(sh, 'speakers-haptic', [-W2 / 2, -H / 2 + 0.08, 0]);
        put(P.plate(W2 - 0.03, H - 0.03, 0.008, 0.09, x.p.recolor[0]), 'back-glass', [-W2 / 2, 0, -D / 2 - 0.002]);
      },
      parts: [
        { id: 'cover-glass', label: 'Cover glass', off: [0, 0, 1.06], desc: 'Protects the folding display.' /* TODO */ },
        { id: 'display', label: 'Folding display', off: [0, 0, 0.8], desc: displayDesc },
        { id: 'frame', label: 'Frame halves', faces: true, off: [0, 0, 0.52], desc: x => x.safe(x.spec('Build')) ? `${x.safe(x.spec('Build'))}.` : 'The two halves of the frame.' },
        { id: 'logic-board', label: 'Main logic board', off: [0, 0, 0.22], desc: 'The main chip, memory and storage.' /* TODO */ },
        { id: 'battery', label: 'Battery cells', off: [0, 0, -0.08], desc: batteryDesc },
        { id: 'camera-module', label: 'Camera module', off: [0, 0, -0.36], desc: cameraDesc },
        { id: 'lens-1', group: 'camera-module', off: [0, 0, -0.5] },
        { id: 'lens-2', group: 'camera-module', off: [0, 0, -0.59] },
        { id: 'speakers-haptic', label: 'Speakers and haptic motor', off: [0, -0.06, -0.64], desc: 'Sound out, and the taps you feel.' /* TODO */ },
        { id: 'hinge', label: 'Hinge', off: [0, 0, -0.8], desc: 'Lets the two halves fold flat.' /* TODO */ },
        { id: 'cover-display', label: 'Outer display', off: [0, 0, -0.98], desc: x => x.safe(x.fact(/outer/)) ? `${x.safe(x.fact(/outer/))}.` : 'The screen on the outside.' },
        { id: 'back-glass', label: 'Back glass', off: [0, 0, -1.18], desc: 'The coloured back panel.' /* TODO */ }
      ],
      insideView: [-DUO_REST.yaw - 1.0, -DUO_REST.pitch + 0.22],
      callouts: x => {
        const { W2, H } = x.size, lens = x.node('lens-1');
        return [
          { label: 'Cameras', at: lens ? lens.position.toArray() : [-W2 + 0.17, 0.4, -0.06], n: [0, 0, -1] },
          { label: 'Hinge', at: [0, 0.3, x.size.D / 2 + 0.02], n: null },
          { label: 'Speaker grille', at: [-W2 / 2 - 0.2, -H / 2 - 0.002, 0], n: [0, -1, 0] },
          { label: 'Charging port', at: [-W2 / 2, -H / 2 - 0.002, 0], n: [0, -1, 0] }
        ];
      },
      zoom: { screen: true, tex: 0, keys: ['widget', 'time', 'line', 'tiles', 'mark', 'dock'], gap: 0.1, fill: 0.95, spec: 'Display' },
      story: {
        count: [0.45, 0.14],
        features: [[2.9, 0.14], [0.35, 0.5], [0.3, -1.1]],
        colour: [-0.1, 0.1],
        finale: [-0.2, 0.08],
        zoomTilt: [-0.45, 0.14]
      }
    }
  }
};
