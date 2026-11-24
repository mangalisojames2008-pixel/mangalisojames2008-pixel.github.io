/* =========================================================
   STORE SETTINGS: change these, nothing else needs to change.
   Prices and products live in products.json.
   ========================================================= */
window.STORE = {
  /* The store name, shown in the logo, page titles and footer */
  name: 'NEXERA',

  /* CHECKOUT: the cart goes to your Shopify checkout.
     domain: your shop's address without https://, e.g. 'nexera-wearables.myshopify.com'
             (or your own domain once it is connected in Shopify).
     Each product also needs its Shopify variant ID in products.json ("shopify").
     Until domain is filled in, the Checkout button sends the order by email instead.
     Payments (PayFast, Yoco and others) and delivery rates are set up inside Shopify. */
  shopify: {
    domain: 'yeffqm-hk.myshopify.com',
    /* Storefront API public access token (Shopify admin: Settings, Apps, Develop apps / Headless channel).
       It is made to be public: it can only read products and create carts, never see orders or customers. */
    storefrontToken: '73aab0f4171436cc315b1617d797bc5d',
    apiVersion: '2025-10',
    bundleCode: ''    /* optional: a Shopify discount code applied when the cart holds a full bundle */
  },

  /* WhatsApp for questions (contact page, footer, "Ask about this"). Not used for orders.
     Country code + number, digits only: 074 659 2098 is '27746592098'. */
  whatsapp: '27746592098',

  /* Orders go here by email until Shopify is connected. Also shown on the contact page. */
  email: 'nexeracommerce@gmail.com',
  phone: '074 659 2098',
  hours: 'Monday to Friday, 08:30–17:00 · Saturday, 09:00–13:00',
  area: 'South Africa',

  /* Delivery text on the delivery page. Fee in rand, or null for "shown at checkout". */
  deliveryFee: null,
  freeDeliveryFrom: null,          /* e.g. 1500 for free delivery over R1 500 */
  /* Delivery prices shown on the delivery page (set the same rates in Shopify). No courier names or fixed times on the site. */
  deliveryRates: 'Locker R60 · door to door R99 · free on orders over R1 000',

  /* Bundle builder: rand off shown in the builder when a watch, strap set and case are picked.
     With Shopify, create the matching discount code in Shopify and put it in shopify.bundleCode. 0 = no discount */
  bundleDiscount: 0
};
