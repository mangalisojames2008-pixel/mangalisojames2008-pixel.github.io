/* NEXERA help centre: ONE place for every business detail and policy number.
   WhatsApp, email, phone and hours are also in ../config.js (the store): change both.
   Change a value here and every page updates. Values in [BRACKETS] must be filled in before launch.
   The same defaults are written into help/index.html, so the pages still read correctly without JavaScript. */
window.NXH = {
  // ---- business identity (ECT Act s43 requires these on the site) ----
  storeName:      "NEXERA",
  // ---- kept for the owner's records, NOT shown on the site (owner, 23 Nov 2026) ----
  legalName:      "[Registered business name, e.g. NEXERA (Pty) Ltd, or your full name if a sole proprietor]",
  legalStatus:    "[Private company / sole proprietor]",
  regNumber:      "[CIPC registration number, or 'Not applicable: sole proprietor']",
  officeBearers:  "[Director name(s)]",
  // ---- shown on the site ----
  physicalAddress:"Rustenburg, North West, South Africa",
    vatNumber:      "[VAT number, or 'Not VAT registered']",
  email:          "nexeracommerce@gmail.com",
  phone:          "074 659 2098",
  whatsapp:       "27746592098",                 // digits only, with country code, no + or spaces
  hours:          "Monday to Friday, 08:30–17:00 · Saturday, 09:00–13:00",
  website:        "https://mangalisojames2008-pixel.github.io/wearables/",
  infoOfficer:    "[Name of Information Officer: the owner, if a small business]",
  lastUpdated:    "23 November 2026",

  // ---- delivery ----
  feeLocker:      "R60",
  feeDoor:        "R99",
  freeOver:       "R1 000",
  // no courier names and no fixed delivery times on the site (owner, 23 Nov 2026)

  // ---- returns & warranty ----
  changeOfMindDays: "7",                        // ECTA s44: 7 days after receipt (owner: keep 7, the same as the store)
  refundDays:     "30",                         // ECTA s44(3): refund within 30 days of cancellation
  warrantyMonths: "6",                          // CPA s56 minimum; raise it if your supplier backs you for longer
};
