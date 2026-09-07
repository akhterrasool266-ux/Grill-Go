# Grill & Go — Phase 1 & 2 (Demo Build)

Ye Phase 1 (Firebase foundation) aur Phase 2 (customer-facing PWA) ka working demo hai.
Abhi ye **static/dummy data** (`js/menu-data.js`) se chal raha hai — deploy karke seedha test kar sakte ho.

## Is build mein kya hai
- Home, Menu, Cart, Offers, Login pages (bottom nav ke sath)
- Item modal — quantity, size, addons, special instructions
- Cart — localStorage based, WhatsApp checkout (temporary, Phase 3 mein Firestore order ban jayega)
- PWA installable — manifest.json + sw.js + install banner
- Google Sign-In wired via Firebase Auth (config keys daalte hi live ho jayega)
- Push notification handler service worker mein ready hai (Phase 4)
- Poora system `js/config.js` se customize hota hai — naya client onboard karne ke liye sirf ye file badalni hai

## Deploy karne ka tareeqa (tumhara existing workflow)
1. Is zip ko extract karo
2. GitHub repo mein purani files delete karo, ye naye upload kar do
3. Cloudflare Pages auto-deploy kar dega

## Firebase connect karna (zaroori — abhi placeholder hai)
1. https://console.firebase.google.com pe naya project banao
2. Authentication → Sign-in method → Google enable karo
3. Firestore Database create karo
4. Project Settings → General → "Your apps" → Web app add karo, config copy karo
5. `js/config.js` mein `firebase: {...}` section ke andar apni keys paste karo

Jab tak ye keys placeholder hain, Login page pe click karne se ek friendly alert aayega —
crash nahi hoga.

## Naya client onboard karna (future)
Sirf `js/config.js` change karo:
- naam, tagline, colors, currency, whatsapp number
- Firebase keys (agar har client ka apna Firebase project ho)

Baaki poori site (HTML/CSS/JS) same rahegi.

## Agla phase
- Phase 3: Admin panel (menu edit, orders dekhna) + Firestore se live menu
- Phase 4: Push notifications (offers) + installed-customer counter
