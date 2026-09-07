// ============================================================
// RESTAURANT CONFIG
// Har naye client ke liye SIRF ye file badalni hai.
// Baaki poora system (HTML/CSS/JS) same rehta hai.
// ============================================================

const RESTAURANT_CONFIG = {
  // Unique ID — restaurant owner ki Gmail se Firebase Auth login
  // ke baad ye uid yahan set ho jayega. Abhi demo ke liye fixed hai.
  restaurantId: "demo-grillgo-001",

  // Branding
  name: "Grill & Go",
  tagline: "Fast fire, fast food",
  logoText: "G&G",          // agar image logo na ho to text fallback
  logoImage: "",            // future: Firebase Storage URL
  currencySymbol: "Rs",

  // Theme — colors change per client
  theme: {
    primary: "#E8531C",     // charcoal-ember orange
    primaryDark: "#B93E10",
    dark: "#1B1B1B",
    cream: "#FFF8F0",
    accent: "#2D9C5A"
  },

  // Feature toggles — per-client customization
  features: {
    tableOrder: false,
    delivery: true,
    pickup: true,
    offers: true
  },

  // Contact
  whatsapp: "923160000000",

  // Firebase — replace with the client's real project keys before deploy
  firebase: {
    apiKey: "REPLACE_ME",
    authDomain: "REPLACE_ME.firebaseapp.com",
    projectId: "REPLACE_ME",
    storageBucket: "REPLACE_ME.appspot.com",
    messagingSenderId: "REPLACE_ME",
    appId: "REPLACE_ME"
  }
};
