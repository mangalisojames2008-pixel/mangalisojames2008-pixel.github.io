/* =========================================================
   NEXERA showcase settings: LAPTOP ('mac-air' and 'mac-pro')
   Part names here are also the node names a .glb model must use (see models/README.md).
   Text marked TODO is a generic placeholder: replace it when you have the real detail.
   ========================================================= */
import { THREE, PI, lerp, clamp01, seg, ease, setScreen } from '../../studio.js';
import * as P from '../parts.js';

const REST = { yaw: -0.5, pitch: 0.08 };
const OPEN = 1.025;   // about 110 degrees

const flat = obj => { obj.rotation.x = -PI / 2; return obj; };

export default {
  family: 'mac',
  arts: ['mac-air', 'mac-pro'],
  /* Drop-in models. Put the file in nexera/models/ and set, e.g. 'mac-pro': { url: 'models/laptop-pro.glb' } */
  models: { 'mac-air': null, 'mac-pro': null },
  rest: REST,
  lift: 0.48,
  margin: 1.1,
  lid: true,   // shows the Close lid / Open lid button

  /* Starts closed. The lid opens to about 110 degrees, the keyboard light comes on, then the screen and wallpaper. */
  entrance: {
    duration: 2.5,
    play(m, t, x) {
      const g = m.group, s = x.state;
      g.position.y = lerp(-0.35, 0, ease.out(seg(t, 0, 0.5)));
      g.rotation.y = lerp(REST.yaw + 0.6, REST.yaw, ease.outQuint(seg(t, 0, 0.85)));
      g.rotation.x = REST.pitch;
      const lid = Math.max(s.lid ?? 1, x.storyW);
      const open = ease.inOut(seg(t, 0.18, 0.72)) * OPEN * lid;
      m.setOpen(open);
      const lit = clamp01((open - 0.55) / 0.35);
      setScreen(m, ease.out(seg(t, 0.55, 0.76)) * lit);
      if (t < 1) x.paint(0, { bg: ease.out(seg(t, 0.56, 0.8)), menu: ease.out(seg(t, 0.72, 0.86)), mark: ease.out(seg(t, 0.74, 0.9)), title: ease.out(seg(t, 0.78, 0.93)), sub: ease.out(seg(t, 0.82, 0.96)), dock: ease.out(seg(t, 0.85, 0.99)) });
      else x.paint(0, null);
      x.state.keys.emissiveIntensity = ease.out(seg(t, 0.38, 0.75)) * 0.5 * clamp01((open - 0.25) / 0.5);
    }
  },

  build(x) {
    const { W, D: Dz, T } = x.size, pro = x.art === 'mac-pro', body = x.p.recolor[0];
    x.state.lid = 1;
    // keyboard backlight (off until the lid opens)
    const k = x.state.keys = x.p.keys.material;
    k.emissive = new THREE.Color(0xfff7ee); k.emissiveMap = P.TEX.keyglow(); k.emissiveIntensity = 0; k.needsUpdate = true;
    const put = (obj, id, pos, internal = true) => { obj.position.set(...pos); return x.add(obj, id, { internal }); };
    // outside: ports on both sides, and speaker grilles beside the keyboard on the Pro (part of the bottom case)
    const left = P.slots([[-0.82, 0, 0.16, T * 0.26], [-0.56, 0, 0.13, T * 0.3], [-0.37, 0, 0.13, T * 0.3]], 0); left.rotation.y = -PI / 2;
    put(left, 'bottom-case', [-W / 2 - 0.0015, 0, 0], false);
    const right = P.slots(pro ? [[0.42, 0, 0.13, T * 0.3], [0.68, 0, 0.16, T * 0.26], [0.86, 0, 0.06, T * 0.3]] : [[0.8, 0, 0.06, T * 0.3]], 0); right.rotation.y = PI / 2;
    put(right, 'bottom-case', [W / 2 + 0.0015, 0, 0], false);
    if (pro) for (const s of [-1, 1]) {
      const g = P.grille(0.92, 0.12); g.rotation.set(-PI / 2, 0, PI / 2);
      put(g, 'bottom-case', [s * (W / 2 - 0.085), T / 2 + 0.0016, -0.36], false);
    }
    // inside
    put(flat(P.plate(W - 0.03, Dz - 0.03, 0.018, 0.15, body)), 'keyboard-deck', [0, T / 2 - 0.011, 0]);
    put(flat(P.board(2.3, 0.6, 0.02, {
      chips: [[0, 0.02, 0.26, 0.26, 'main'], [-0.32, 0.04, 0.17, 0.2], [0.32, 0.04, 0.17, 0.2], [-0.62, -0.14, 0.14, 0.12, 'small'], [0.62, -0.14, 0.12, 0.12, 'small']],
      ports: [[-1.12, -0.04, 0.05, 0.34], [1.12, -0.04, 0.05, 0.34]], seed: 21, bits: 40
    })), 'logic-board', [0, 0, -0.5]);
    const cells = new THREE.Group();
    for (const cx of [-0.74, 0, 0.74]) for (const cz of [0.25, 0.72]) { const c = flat(P.cell(0.64, 0.42, 0.045)); c.position.set(cx, 0, cz); cells.add(c); }
    put(cells, 'battery', [0, -0.01, 0]);
    if (pro) {
      const fans = new THREE.Group(); x.state.rotors = [];
      for (const s of [-1, 1]) { const f = P.fan(0.22, 0.06); f.position.set(s * 1.02, 0, -0.62); fans.add(f); x.state.rotors.push(f.userData.rotor); }
      put(fans, 'fans', [0, 0, 0]);
    } else {
      put(P.heatPlate(0.8, 0.42, 0.012), 'cooling', [0, 0, -0.5]);
    }
    const spk = new THREE.Group();
    for (const s of [-1, 1]) { const b = flat(P.speaker(0.22, 0.86, 0.05)); b.position.set(s * 1.34, 0, -0.3); spk.add(b); }
    put(spk, 'speakers', [0, 0, 0]);
    put(flat(P.plate(1.3, 0.8, 0.03, 0.05, P.M.panel())), 'trackpad', [0, T / 2 - 0.02, 0.52]);
  },

  /* Fans spin while the laptop is opened up. */
  idle(m, now, x, dt) {
    if (x.state.rotors && x.explode > 0.01) x.state.rotors.forEach((r, i) => { r.rotation.y += dt * 9 * x.explode * (i ? -1 : 1); });
  },

  /* "Look inside": the lid lifts away, the base separates top to bottom. */
  parts: [
    { id: 'lid', label: 'Display lid', off: [0, 1.85, -0.6], desc: x => { const v = x.spec('Display'), s = x.safe(v) || x.inch(v); return s ? `${s} display.` : 'The display.'; } },
    { id: 'keyboard-deck', label: 'Keyboard deck', nodes: ['keyboard'], off: [0, 1.36, 0], desc: 'The top case with the backlit keys.' /* TODO */ },
    { id: 'logic-board', label: 'Logic board', off: [0, 1.04, 0], desc: 'Main chip and memory. The ports sit on its edges.' /* TODO */ },
    { id: 'battery', label: 'Battery cells', off: [0, 0.75, 0], desc: x => { const v = x.safe(x.spec('Battery')); return v ? `${v} of battery life.` : 'The battery cells.'; } },
    { id: 'fans', label: 'Fans and cooling', off: [0, 0.48, 0], desc: 'Move air to keep the chip cool.' /* TODO */ },
    { id: 'cooling', label: 'Cooling plate', off: [0, 0.48, 0], desc: 'Spreads heat away from the chip.' /* TODO */ },
    { id: 'speakers', label: 'Speakers', off: [0, 0.23, 0], desc: 'Speakers on both sides of the keyboard.' /* TODO */ },
    { id: 'trackpad', label: 'Trackpad', off: [0, -0.2, 0.72], desc: 'A large glass trackpad.' /* TODO */ },
    { id: 'bottom-case', label: 'Bottom case', off: [0, -0.6, 0], desc: x => (x.safe(x.spec('Connectivity')) ? `Ports on both sides. ${x.safe(x.spec('Connectivity'))}.` : 'Ports on both sides.') }
  ],
  insideView: [-REST.yaw - 0.55, -REST.pitch - 0.14],
  views: base => ({ top: [base[0], base[1] + 0.95] }),

  callouts: x => {
    const { W, D: Dz, T, H: Hl } = x.size, pro = x.art === 'mac-pro';
    return [
      { label: 'Display', node: 'lid-display', at: [0.75, 0.2, 0.01], n: [0, 0, 1] },
      { label: 'Camera', node: 'lid-display', at: [0, (Hl - 0.26) / 2 + 0.007, 0.006], n: [0, 0, 1] },
      { label: 'Keyboard', at: [-0.55, T / 2 + 0.003, -0.36], n: [0, 1, 0] },
      { label: 'Trackpad', at: [0.32, T / 2 + 0.003, 0.5], n: [0, 1, 0] },
      { label: 'Ports', at: [-W / 2 - 0.003, 0, -0.55], n: [-1, 0, 0] },
      { label: 'Speakers', at: pro ? [W / 2 - 0.085, T / 2 + 0.003, -0.5] : [1.0, T / 2 + 0.02, -Dz / 2 + 0.07], n: [0, 1, 0] }
    ];
  },

  zoom: { screen: true, tex: 0, keys: ['menu', 'mark', 'title', 'sub', 'dock'], gap: 0.14, fill: 0.96, spec: 'Display' },

  story: {
    count: [-0.2, 0.04],
    features: [[0.35, 0.02], [0.5, 0.22], [1.75, 0.08]],
    colour: [0.1, 0.04],
    finale: [0.05, 0.02],
    zoomTilt: [-0.45, 0.1]
  },

  count: {
    'macbook-air-13': { n: 18, unit: 'hours', line: ['specs', 'Battery'] },
    'macbook-air-15': { n: 18, unit: 'hours', line: ['facts', 2] },
    'macbook-pro-14': { n: 24, unit: 'hours', line: ['facts', 1] },
    'macbook-pro-16': { n: 40, unit: '-core GPU', line: ['facts', 1] }
  }
};
