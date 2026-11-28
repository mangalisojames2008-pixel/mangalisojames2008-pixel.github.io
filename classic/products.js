/* =========================================================
   NEXERA store data: settings and products.
   Edit this file to change prices, contact details or the range.
   ========================================================= */

/* ---------------------------------------------------------
   STORE SETTINGS: fill these in to switch ordering on.
   whatsapp: country code + number, digits only (e.g. "27821234567")
   email:    the inbox orders go to
   --------------------------------------------------------- */
const CONFIG = {
  whatsapp: '',
  email: 'nexeracommerce@gmail.com',
  phone: '',
  address: '',
  hours: '',
  instagram: '',          // full link, e.g. "https://instagram.com/yourpage"
  locale: 'en-ZA',
  currency: 'ZAR',
  spotlight: 'iphone-duo'
};

/* ---------------------------------------------------------
   PRODUCTS
   Facts come from Apple's own product and spec pages (read Nov 2026).
   price: null shows "Price on request". To show a price, use a number,
   or an object per option, e.g. price: { '256GB': 24999, '512GB': 28999 }.
   --------------------------------------------------------- */
const FAMILIES = {
  iphone:  { name: 'iPhone',      line: 'From the foldable iPhone Duo to iPhone 17e.' },
  airpods: { name: 'AirPods',     line: 'Noise cancellation in every size.' },
  mac:     { name: 'MacBook',     line: 'MacBook Air and MacBook Pro.' },
  watch:   { name: 'Apple Watch', line: 'Series 12, Ultra 4 and SE 3.' }
};

const PRODUCTS = [
  /* ---------------- iPhone ---------------- */
  {
    id: 'iphone-duo', family: 'iphone', name: 'iPhone Duo', isNew: true, art: 'duo',
    tag: 'The largest iPhone display ever, in a titanium foldable design.',
    facts: ['7.6-inch inner and 5.4-inch outer display', 'A20 Pro chip', '48MP Dual Fusion camera system'],
    colours: [['Night Sky', '#23283a'], ['Star White', '#ecebe5']],
    option: { label: 'Storage', values: ['256GB', '512GB', '1TB', '2TB'] },
    price: null,
    specs: { Display: '7.6-inch folding inner, 5.4-inch outer', Chip: 'A20 Pro', 'Rear camera': '48MP Dual Fusion system', 'Video playback': 'Up to 31 hours (inner), 44 hours (outer)', Storage: '256GB, 512GB, 1TB, 2TB', Build: 'Titanium foldable design, IP68' }
  },
  {
    id: 'iphone-18-pro', family: 'iphone', name: 'iPhone 18 Pro', isNew: true, art: 'pro',
    tag: 'A20 Pro and a 48MP Fusion Main camera with variable aperture.',
    facts: ['6.3-inch display', 'A20 Pro chip', 'Up to 36 hours video playback'],
    colours: [['Burgundy', '#5c1e2c'], ['Glacier', '#cfdde4'], ['Silver', '#dcdcda'], ['Black', '#2a2b2f']],
    option: { label: 'Storage', values: ['256GB', '512GB', '1TB', '2TB'] },
    price: null,
    specs: { Display: '6.3-inch OLED', Chip: 'A20 Pro', 'Rear camera': '48MP Fusion Main, variable aperture', 'Video playback': 'Up to 36 hours', Storage: '256GB, 512GB, 1TB, 2TB', Build: 'Pro design' }
  },
  {
    id: 'iphone-18-pro-max', family: 'iphone', name: 'iPhone 18 Pro Max', isNew: true, art: 'pro', start: 1,
    tag: 'The big-screen Pro, with up to 45 hours of video playback.',
    facts: ['6.9-inch display', 'A20 Pro chip', 'Up to 45 hours video playback'],
    colours: [['Burgundy', '#5c1e2c'], ['Glacier', '#cfdde4'], ['Silver', '#dcdcda'], ['Black', '#2a2b2f']],
    option: { label: 'Storage', values: ['256GB', '512GB', '1TB', '2TB'] },
    price: null,
    specs: { Display: '6.9-inch OLED', Chip: 'A20 Pro', 'Rear camera': '48MP Fusion Main, variable aperture', 'Video playback': 'Up to 45 hours', Storage: '256GB, 512GB, 1TB, 2TB', Build: 'Pro design' }
  },
  {
    id: 'iphone-air', family: 'iphone', name: 'iPhone Air', art: 'air',
    tag: 'Just 5.64 mm thin, with the A19 Pro chip inside.',
    facts: ['6.5-inch display', 'A19 Pro chip', '48MP Fusion camera system'],
    colours: [['Sky Blue', '#cddfee'], ['Light Gold', '#e8d8b9'], ['Cloud White', '#f2f1ec'], ['Space Black', '#2b2c30']],
    option: { label: 'Storage', values: ['256GB', '512GB', '1TB'] },
    price: null,
    specs: { Display: '6.5-inch OLED', Chip: 'A19 Pro', 'Rear camera': '48MP Fusion system', 'Video playback': 'Up to 27 hours', Storage: '256GB, 512GB, 1TB', Build: '5.64 mm thin, 165 g' }
  },
  {
    id: 'iphone-17', family: 'iphone', name: 'iPhone 17', art: 'dual', start: 2,
    tag: 'Two 48MP Fusion cameras and an 18MP Center Stage front camera.',
    facts: ['6.3-inch display', 'A19 chip', 'Up to 30 hours video playback'],
    colours: [['Lavender', '#cfc2e2'], ['Mist Blue', '#a9bdd0'], ['Sage', '#b5c0a7'], ['White', '#f3f2ee'], ['Black', '#2b2c30']],
    option: { label: 'Storage', values: ['256GB', '512GB'] },
    price: null,
    specs: { Display: '6.3-inch OLED', Chip: 'A19', 'Rear camera': '48MP Dual Fusion system', 'Video playback': 'Up to 30 hours', Storage: '256GB, 512GB', Build: '7.95 mm, 177 g' }
  },
  {
    id: 'iphone-17e', family: 'iphone', name: 'iPhone 17e', art: 'e',
    tag: 'The A19 chip and a 48MP Fusion camera, with storage from 256GB.',
    facts: ['6.1-inch display', 'A19 chip', 'Up to 26 hours video playback'],
    colours: [['Soft Pink', '#f0d4d6'], ['White', '#f3f2ee'], ['Black', '#2b2c30']],
    option: { label: 'Storage', values: ['256GB'] },
    price: null,
    specs: { Display: '6.1-inch Super Retina XDR', Chip: 'A19', 'Rear camera': '48MP Fusion, 2x Telephoto', 'Video playback': 'Up to 26 hours', Storage: 'From 256GB', Build: 'Black, white or soft pink' }
  },

  /* ---------------- AirPods ---------------- */
  {
    id: 'airpods-pro-3', family: 'airpods', name: 'AirPods Pro 3', art: 'pods-pro',
    tag: 'Up to 2x more Active Noise Cancellation than AirPods Pro 2.',
    facts: ['Heart rate sensing during workouts', 'Up to 8 hours listening with ANC', 'IP57 rated, H2 chip'],
    colours: [['White', '#f5f5f3']],
    option: null,
    price: null,
    specs: { Type: 'In-ear', Chip: 'H2', 'Noise cancellation': 'Up to 2x more than AirPods Pro 2', Battery: 'Up to 8 hours (24 with case)', Highlights: 'Heart rate sensing, Hearing Aid feature', 'Water and dust': 'IP57' }
  },
  {
    id: 'airpods-5', family: 'airpods', name: 'AirPods 5', isNew: true, art: 'pods',
    tag: 'Up to 1.5x more Active Noise Cancellation than the previous generation.',
    facts: ['H2 chip', 'Live Translation', 'IP57 rated'],
    colours: [['White', '#f5f5f3']],
    option: { label: 'Case', values: ['USB-C Charging Case', 'Wireless Charging Case'] },
    price: null,
    specs: { Type: 'Open fit', Chip: 'H2', 'Noise cancellation': 'Up to 1.5x more than the previous generation', Battery: 'Up to 22 hours total with ANC (wireless case)', Highlights: 'Live Translation, Personalized Spatial Audio', 'Water and dust': 'IP57' }
  },
  {
    id: 'airpods-max-2', family: 'airpods', name: 'AirPods Max 2', art: 'max',
    tag: 'Over-ear sound with the H2 chip and Lossless Audio over USB-C.',
    facts: ['Up to 1.5x more Active Noise Cancellation', 'Up to 20 hours with ANC on', 'Five colours'],
    colours: [['Midnight', '#2d313a'], ['Starlight', '#e7e0d3'], ['Blue', '#9fb5cd'], ['Purple', '#c8b8da'], ['Orange', '#f0b38d']],
    option: null,
    price: null,
    specs: { Type: 'Over-ear', Chip: 'H2', 'Noise cancellation': 'Up to 1.5x more than the previous generation', Battery: 'Up to 20 hours with ANC', Highlights: 'Lossless Audio via USB-C, Adaptive Audio', 'Water and dust': 'Not stated' }
  },

  /* ---------------- MacBook ---------------- */
  {
    id: 'macbook-air-13', family: 'mac', name: 'MacBook Air 13-inch', art: 'mac-air',
    tag: 'The M5 chip, up to 18 hours of battery and 512GB as standard.',
    facts: ['13.6-inch Liquid Retina display', 'M5 chip with 10-core CPU', '12MP Center Stage camera'],
    colours: [['Sky Blue', '#c5d4e0'], ['Silver', '#dadbdc'], ['Starlight', '#e5ddce'], ['Midnight', '#2e3440']],
    option: { label: 'Storage', values: ['512GB', '1TB', '2TB', '4TB'] },
    price: null,
    specs: { Display: '13.6-inch Liquid Retina', Chip: 'M5', Battery: 'Up to 18 hours', Storage: '512GB, up to 4TB', Connectivity: 'Wi-Fi 7, Bluetooth 6', Camera: '12MP Center Stage' }
  },
  {
    id: 'macbook-air-15', family: 'mac', name: 'MacBook Air 15-inch', art: 'mac-air', start: 3,
    tag: 'More screen, same M5 chip and all-day battery.',
    facts: ['15.3-inch Liquid Retina display', 'M5 chip with 10-core CPU', 'Up to 18 hours battery'],
    colours: [['Sky Blue', '#c5d4e0'], ['Silver', '#dadbdc'], ['Starlight', '#e5ddce'], ['Midnight', '#2e3440']],
    option: { label: 'Storage', values: ['512GB', '1TB', '2TB', '4TB'] },
    price: null,
    specs: { Display: '15.3-inch Liquid Retina', Chip: 'M5', Battery: 'Up to 18 hours', Storage: '512GB, up to 4TB', Connectivity: 'Wi-Fi 7, Bluetooth 6', Camera: '12MP Center Stage' }
  },
  {
    id: 'macbook-pro-14', family: 'mac', name: 'MacBook Pro 14-inch', art: 'mac-pro',
    tag: 'Choose the M6, M5 Pro or M5 Max chip.',
    facts: ['14.2-inch XDR display', 'Up to 24 hours battery', 'Thunderbolt, HDMI, MagSafe 3, SDXC'],
    colours: [['Space Black', '#2b2c2f'], ['Silver', '#d9dadb']],
    option: { label: 'Chip', values: ['M6', 'M5 Pro', 'M5 Max'] },
    price: null,
    specs: { Display: '14.2-inch XDR', Chip: 'M6, M5 Pro or M5 Max', Battery: 'Up to 24 hours', Storage: 'M5 Pro from 1TB, M5 Max from 2TB', Connectivity: 'Wi-Fi 7, Bluetooth 6', Camera: 'Not listed here' }
  },
  {
    id: 'macbook-pro-16', family: 'mac', name: 'MacBook Pro 16-inch', art: 'mac-pro',
    tag: 'The biggest MacBook Pro, with M5 Pro or M5 Max.',
    facts: ['16-inch XDR display', 'M5 Max with up to 40-core GPU', 'Up to 24 hours battery'],
    colours: [['Space Black', '#2b2c2f'], ['Silver', '#d9dadb']],
    option: { label: 'Chip', values: ['M5 Pro', 'M5 Max'] },
    price: null,
    specs: { Display: '16-inch XDR', Chip: 'M5 Pro or M5 Max', Battery: 'Up to 24 hours', Storage: 'M5 Pro from 1TB, M5 Max from 2TB', Connectivity: 'Wi-Fi 7, Bluetooth 6', Camera: 'Not listed here' }
  },

  /* ---------------- Apple Watch ---------------- */
  {
    id: 'watch-series-12', family: 'watch', name: 'Apple Watch Series 12', isNew: true, art: 'watch',
    tag: 'The S11 chip and Ceramic Shield 2 on aluminium cases.',
    facts: ['Up to 24 hours battery (38 in Low Power Mode)', '15 minutes charge for up to 12 hours', 'Water resistant to 50 m'],
    colours: [['Black aluminium', '#2b2c2e'], ['Space Gray aluminium', '#6c6f74'], ['Light Gold aluminium', '#e6d4b5'], ['Dark Bronze aluminium', '#6f5342'], ['Natural titanium', '#cac4b9'], ['Radiant Gold titanium', '#d8b97c'], ['Pearl White ceramic', '#f1efe9'], ['Night Blue ceramic', '#202b45']],
    option: { label: 'Case size', values: ['42mm', '46mm'] },
    price: null,
    specs: { Case: '42mm or 46mm', Chip: 'S11', Battery: 'Up to 24 hours (38 in Low Power Mode)', Water: '50 m, IP6X', Materials: 'Aluminium, titanium or ceramic' }
  },
  {
    id: 'watch-ultra-4', family: 'watch', name: 'Apple Watch Ultra 4', isNew: true, art: 'ultra',
    tag: 'A 49mm titanium case, sapphire crystal and up to 50 hours of battery.',
    facts: ['Up to 50 hours battery (84 in Low Power Mode)', 'Water resistant to 100 m', '3000 nits peak brightness'],
    colours: [['Natural', '#cfc8bc'], ['Black', '#2a2a2d']],
    option: { label: 'Case size', values: ['49mm'] },
    price: null,
    specs: { Case: '49mm titanium', Chip: 'S11', Battery: 'Up to 50 hours (84 in Low Power Mode)', Water: '100 m, IP6X', Materials: 'Grade 5 titanium' }
  },
  {
    id: 'watch-se-3', family: 'watch', name: 'Apple Watch SE 3', art: 'watch',
    tag: 'The S10 chip and up to 18 hours of battery, in two matte finishes.',
    facts: ['S10 chip', 'Up to 18 hours battery (32 in Low Power Mode)', 'Water resistant to 50 m'],
    colours: [['Midnight', '#2d3340'], ['Starlight', '#e4ddd0']],
    option: { label: 'Case size', values: ['40mm', '44mm'] },
    price: null,
    specs: { Case: '40mm or 44mm', Chip: 'S10', Battery: 'Up to 18 hours (32 in Low Power Mode)', Water: '50 m', Materials: 'Aluminium' }
  }
];
