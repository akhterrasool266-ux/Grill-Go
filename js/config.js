
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

  // Firebase — live keys (project: grill-n-go)
  firebase: {
    apiKey: "AIzaSyAcWymN25JklZESDKnHrAJTeRC8TY3oN5M",
    authDomain: "grill-n-go.firebaseapp.com",
    projectId: "grill-n-go",
    storageBucket: "grill-n-go.firebasestorage.app",
    messagingSenderId: "583403142699",
    appId: "1:583403142699:web:9e75cec8c7cd9fc265b46e"
  }
};
