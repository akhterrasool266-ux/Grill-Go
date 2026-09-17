// js/firebase-init.js — Phase 3
//
// Loaded as a <script type="module">. Does NOT replace config.js / menu-data.js /
// app.js — it overlays live Firestore data onto the existing MENU_CATEGORIES /
// MENU_ITEMS / MENU_OFFERS arrays (by mutating them in place) and onto
// RESTAURANT_CONFIG, so every page and function that already reads those
// globals keeps working untouched.
//
// If Firebase isn't configured yet (placeholder keys) or Firestore is empty
// or unreachable, everything fails silently and the site keeps running on the
// static demo data exactly like Phase 1/2 did.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, getDocs, getDoc, doc, query, orderBy,
  addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

window.RG_FIREBASE_READY = false;
window.rgApp = null;
window.rgDb = null;
window.rgAuth = null;
window.rgGoogleProvider = null;
window.rgSignIn = () => Promise.reject(new Error('Firebase not configured'));
window.rgSignOut = () => Promise.resolve();
window.rgOnAuth = (cb) => cb(null);

const restaurantId = (window.RESTAURANT_CONFIG && RESTAURANT_CONFIG.restaurantId) || 'default';
window.RG_RESTAURANT_ID = restaurantId;

try {
  window.rgApp = initializeApp(RESTAURANT_CONFIG.firebase);
  window.rgDb = getFirestore(window.rgApp);
  window.rgAuth = getAuth(window.rgApp);
  window.rgGoogleProvider = new GoogleAuthProvider();
  window.rgSignIn = () => signInWithPopup(window.rgAuth, window.rgGoogleProvider);
  window.rgSignOut = () => signOut(window.rgAuth);
  window.rgOnAuth = (cb) => onAuthStateChanged(window.rgAuth, cb);
  window.RG_FIREBASE_READY = true;
} catch (e) {
  console.warn('[Grill&Go] Firebase not configured yet — running on static menu-data.js', e);
}

function col(sub) {
  return collection(window.rgDb, `restaurants/${restaurantId}/${sub}`);
}
function docRef(sub) {
  return doc(window.rgDb, `restaurants/${restaurantId}/${sub}`);
}

// Overlays MENU_CATEGORIES / MENU_ITEMS / MENU_OFFERS (declared as top-level
// const/let in menu-data.js) with live Firestore data. Mutates the arrays
// in place (never reassigns the binding) so it works regardless of const/let,
// and so app.js / inline page scripts referencing these globals see the update.
window.rgLoadMenu = async function rgLoadMenu() {
  if (!window.RG_FIREBASE_READY) return false;
  try {
    const [catSnap, itemSnap, offerSnap] = await Promise.all([
      getDocs(query(col('categories'), orderBy('sortOrder', 'asc'))),
      getDocs(query(col('menuItems'), orderBy('sortOrder', 'asc'))),
      getDocs(query(col('offers'), orderBy('sortOrder', 'asc')))
    ]);

    // Nothing seeded in Firestore yet — keep the static demo data untouched.
    if (catSnap.empty && itemSnap.empty) return false;

    const cats = [];
    catSnap.forEach(d => {
      const v = d.data();
      if (v.active === false) return;
      cats.push({ id: d.id, name: v.name, icon: v.icon || '🍽️' });
    });

    const items = [];
    itemSnap.forEach(d => {
      const v = d.data();
      if (v.active === false) return;
      items.push({
        id: d.id,
        name: v.name,
        description: v.description || '',
        price: v.price,
        categoryId: v.categoryId,
        image: v.image || '',
        popular: !!v.popular,
        sizes: v.sizes || [],
        addons: v.addons || []
      });
    });

    const offers = [];
    offerSnap.forEach(d => {
      const v = d.data();
      if (v.active === false) return;
      offers.push({ title: v.title, subtitle: v.subtitle, color: v.color || 'primary' });
    });

    if (typeof MENU_CATEGORIES !== 'undefined') {
      MENU_CATEGORIES.length = 0;
      MENU_CATEGORIES.push(...cats);
    }
    if (typeof MENU_ITEMS !== 'undefined') {
      MENU_ITEMS.length = 0;
      MENU_ITEMS.push(...items);
    }
    if (typeof MENU_OFFERS !== 'undefined' && offers.length) {
      MENU_OFFERS.length = 0;
      MENU_OFFERS.push(...offers);
    }
    return true;
  } catch (e) {
    console.warn('[Grill&Go] Firestore menu load failed — using static menu-data.js', e);
    return false;
  }
};

// Applies owner-editable settings (name, tagline, currency, WhatsApp number)
// from restaurants/{id}/settings/general onto RESTAURANT_CONFIG in place.
window.rgLoadSettings = async function rgLoadSettings() {
  if (!window.RG_FIREBASE_READY) return false;
  try {
    const snap = await getDoc(docRef('settings/general'));
    if (!snap.exists()) return false;
    const v = snap.data();
    if (v.name) RESTAURANT_CONFIG.name = v.name;
    if (v.tagline) RESTAURANT_CONFIG.tagline = v.tagline;
    if (v.currencySymbol) RESTAURANT_CONFIG.currencySymbol = v.currencySymbol;
    if (v.whatsapp) RESTAURANT_CONFIG.whatsapp = v.whatsapp;
    return true;
  } catch (e) {
    console.warn('[Grill&Go] Firestore settings load failed', e);
    return false;
  }
};

// Best-effort order write. Never throws — checkout must still work over
// WhatsApp even if this fails (offline, rules misconfigured, etc.).
window.rgWriteOrder = async function rgWriteOrder(payload) {
  if (!window.RG_FIREBASE_READY) return null;
  try {
    const ref = await addDoc(col('orders'), {
      ...payload,
      status: 'new',
      createdAt: serverTimestamp()
    });
    return ref.id;
  } catch (e) {
    console.warn('[Grill&Go] Could not save order to Firestore (WhatsApp still sent)', e);
    return null;
  }
};

window.rgCheckIsAdmin = async function rgCheckIsAdmin(uid) {
  if (!window.RG_FIREBASE_READY || !uid) return false;
  try {
    const snap = await getDoc(docRef(`admins/${uid}`));
    return snap.exists();
  } catch (e) {
    return false;
  }
};

// Resolves once (never rejects) after attempting to overlay live menu +
// settings data, or after a 4s timeout — whichever comes first — so a slow
// or unreachable Firestore never blocks the page from rendering.
window.rgReady = (async () => {
  const timeout = new Promise((res) => setTimeout(res, 4000));
  await Promise.race([
    Promise.all([window.rgLoadMenu(), window.rgLoadSettings()]),
    timeout
  ]);
})();
