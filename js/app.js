// ============================================================
// APP.JS — shared across all pages
// ============================================================

const CART_KEY = `ezy_cart_${RESTAURANT_CONFIG.restaurantId}`;

function applyTheme() {
  const t = RESTAURANT_CONFIG.theme;
  const root = document.documentElement.style;
  root.setProperty('--primary', t.primary);
  root.setProperty('--primary-dark', t.primaryDark);
  root.setProperty('--dark', t.dark);
  root.setProperty('--cream', t.cream);
  root.setProperty('--accent', t.accent);
}
applyTheme();

// ---------- Cart storage ----------
function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch { return []; }
}
function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
}
function addToCart(entry) {
  const cart = getCart();
  cart.push(entry);
  saveCart(cart);
}
function removeFromCart(index) {
  const cart = getCart();
  cart.splice(index, 1);
  saveCart(cart);
}
function cartCount() {
  return getCart().reduce((sum, i) => sum + i.qty, 0);
}
function updateCartBadge() {
  const badge = document.getElementById('cartBadge');
  if (!badge) return;
  const count = cartCount();
  badge.textContent = count;
  badge.style.display = count > 0 ? 'flex' : 'none';
}

// ---------- Item modal ----------
let activeItem = null;
let modalState = { qty: 1, size: null, addons: {} };

function openItemModal(itemId) {
  const item = MENU_ITEMS.find(i => i.id === itemId);
  if (!item) return;
  activeItem = item;
  modalState = {
    qty: 1,
    size: item.sizes.length ? item.sizes[0].id : null,
    addons: {}
  };
  renderModal();
  document.getElementById('modalOverlay').style.display = 'flex';
}

function closeItemModal() {
  document.getElementById('modalOverlay').style.display = 'none';
  activeItem = null;
}

function calcModalTotal() {
  let total = activeItem.price;
  if (modalState.size) {
    const s = activeItem.sizes.find(s => s.id === modalState.size);
    if (s) total += s.extra;
  }
  activeItem.addons.forEach(a => {
    if (modalState.addons[a.id]) total += a.price * modalState.addons[a.id];
  });
  return total * modalState.qty;
}

function renderModal() {
  const item = activeItem;
  const cur = RESTAURANT_CONFIG.currencySymbol;
  let sizesHtml = '';
  if (item.sizes.length) {
    sizesHtml = `<div class="modal-label">Size</div>` + item.sizes.map(s => `
      <div class="option-row ${modalState.size === s.id ? 'selected' : ''}" onclick="selectSize('${s.id}')">
        <div class="option-left"><span class="radio-dot"></span>${s.name}</div>
        <div class="option-extra">${s.extra > 0 ? '+' + cur + s.extra : ''}</div>
      </div>
    `).join('');
  }

  let addonsHtml = '';
  if (item.addons.length) {
    addonsHtml = `<div class="modal-label">Addons</div>` + item.addons.map(a => `
      <div class="option-row ${modalState.addons[a.id] ? 'selected' : ''}" onclick="toggleAddon('${a.id}')">
        <div class="option-left"><span class="check-box"></span>${a.name}</div>
        <div class="option-extra">${cur}${a.price}</div>
      </div>
    `).join('');
  }

  document.getElementById('modalBody').innerHTML = `
    <button class="modal-close" onclick="closeItemModal()">✕</button>
    <div class="modal-img">${item.image ? `<img src="${item.image}">` : ''}</div>
    <div class="modal-title">${item.name}</div>
    <div class="modal-desc">${item.description}</div>
    <div class="modal-price">${cur}${item.price}</div>

    <div class="modal-label">Quantity</div>
    <div class="qty-row">
      <button class="qty-btn" onclick="changeQty(-1)">−</button>
      <span class="qty-val" id="qtyVal">${modalState.qty}</span>
      <button class="qty-btn" onclick="changeQty(1)">+</button>
    </div>

    ${sizesHtml}
    ${addonsHtml}

    <div class="modal-label">Special Instructions</div>
    <textarea class="note-input" rows="2" id="noteInput" placeholder="Add note (extra spicy, no onions, etc.)"></textarea>

    <button class="modal-cta" onclick="confirmAddToCart()">
      <span>Add to Cart</span>
      <span id="modalTotal">${cur}${calcModalTotal()}</span>
    </button>
  `;
}

function changeQty(delta) {
  modalState.qty = Math.max(1, modalState.qty + delta);
  document.getElementById('qtyVal').textContent = modalState.qty;
  document.getElementById('modalTotal').textContent = RESTAURANT_CONFIG.currencySymbol + calcModalTotal();
}
function selectSize(sizeId) {
  modalState.size = sizeId;
  renderModal();
}
function toggleAddon(addonId) {
  modalState.addons[addonId] = modalState.addons[addonId] ? 0 : 1;
  renderModal();
}

function confirmAddToCart() {
  const cur = RESTAURANT_CONFIG.currencySymbol;
  const size = activeItem.sizes.find(s => s.id === modalState.size);
  const addonNames = activeItem.addons
    .filter(a => modalState.addons[a.id])
    .map(a => a.name);
  const note = document.getElementById('noteInput').value;

  addToCart({
    itemId: activeItem.id,
    name: activeItem.name,
    qty: modalState.qty,
    sizeName: size ? size.name : null,
    addonNames,
    note,
    unitTotal: calcModalTotal() / modalState.qty,
    lineTotal: calcModalTotal()
  });

  closeItemModal();
  toast('Added to cart');
}

// ---------- Toast ----------
function toast(msg) {
  let el = document.getElementById('toastEl');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toastEl';
    el.style.cssText = `position:fixed;bottom:90px;left:50%;transform:translateX(-50%);
      background:var(--dark);color:#fff;padding:10px 18px;border-radius:20px;
      font-size:13px;z-index:60;opacity:0;transition:opacity .2s;`;
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => el.style.opacity = '0', 1600);
}

// ---------- PWA install prompt ----------
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const banner = document.getElementById('installBanner');
  if (banner) banner.classList.add('show');
});

function triggerInstall() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(() => {
    deferredPrompt = null;
    const banner = document.getElementById('installBanner');
    if (banner) banner.classList.remove('show');
    // Phase 4: increment Firestore install counter here
  });
}

// ---------- Init on every page ----------
document.addEventListener('DOMContentLoaded', () => {
  updateCartBadge();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
});
