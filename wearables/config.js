/* =========================================================
   STORE SETTINGS: change these, nothing else needs to change.
   Prices and products live in products.json.
   ========================================================= */
window.STORE = {
  /* The store name, shown in the logo, page titles, footer and WhatsApp message */
  name: 'NEXERA',

  /* WhatsApp number for orders: country code + number, digits only.
     Example: '27821234567' for 082 123 4567. Leave the X's until you have it. */
  whatsapp: '27XXXXXXXXX',

  /* Shown on the contact page. Leave '' to hide a line. */
  email: 'nexeracommerce@gmail.com',
  phone: '',
  hours: '[OPENING HOURS]',
  area: 'South Africa',

  /* Delivery. Fee in rand, or null to say "confirmed on WhatsApp" */
  deliveryFee: null,
  freeDeliveryFrom: null,          /* e.g. 1500 for free delivery over R1 500 */
  deliveryTime: '[2 to 5 working days]',
  courier: '[COURIER NAME]',

  /* Bundle builder: rand off when a watch, strap set and case are bought together. 0 = no discount */
  bundleDiscount: 0,

  /* Online payments, for later. Leave false until a PayFast or Yoco account is set up.
     The marked slot in cart.html shows the button once one is switched on. */
  payments: {
    payfast: false,   /* PAYFAST SLOT: merchant_id and merchant_key go in cart.html, see NOTES.md */
    yoco: false       /* YOCO SLOT: payment link goes here as a string, e.g. 'https://pay.yoco.com/...' */
  }
};
