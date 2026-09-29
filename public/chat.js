/* Chat widget — talks to /api/chat. Plain text only (no innerHTML from the model). */
(function () {
  'use strict';
  var S = window.__STORE__ || {};
  var hist = [];
  var busy = false;

  var fab = document.createElement('button');
  fab.className = 'chatfab';
  fab.type = 'button';
  fab.textContent = 'Ask us';
  fab.setAttribute('aria-label', 'Open chat assistant');

  var box = document.createElement('div');
  box.className = 'chatbox';
  box.hidden = true;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', 'Chat assistant');
  box.innerHTML =
    '<div class="chathd"><span></span><button type="button" aria-label="Close chat">×</button></div>' +
    '<div class="chatlog" aria-live="polite"></div>' +
    '<div class="chatnote">AI assistant — not medical advice.</div>' +
    '<form class="chatform"><input type="text" maxlength="500" placeholder="Type your question…" aria-label="Message" autocomplete="off">' +
    '<button type="submit">Send</button></form>';
  box.querySelector('.chathd span').textContent = (S.brand || 'Store') + ' assistant';

  var log = box.querySelector('.chatlog');
  var form = box.querySelector('form');
  var input = box.querySelector('input');

  // Render text; turn /product/... and /track paths into links, nothing else.
  function render(el, text) {
    el.textContent = '';
    text.split(/(\/(?:product\/[a-z0-9-]+|track|cart))/g).forEach(function (part) {
      if (/^\/(?:product\/[a-z0-9-]+|track|cart)$/.test(part)) {
        var a = document.createElement('a'); a.href = part; a.textContent = part; el.appendChild(a);
      } else if (part) { el.appendChild(document.createTextNode(part)); }
    });
  }
  function add(role, text) {
    var d = document.createElement('div');
    d.className = 'chatmsg ' + (role === 'user' ? 'me' : 'bot');
    render(d, text);
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }

  fab.addEventListener('click', function () {
    box.hidden = false; fab.hidden = true;
    if (!log.children.length) add('assistant', 'Assalam o Alaikum! Ask me about products, delivery, or your order (send order number + last 6 digits of your phone).');
    input.focus();
  });
  box.querySelector('.chathd button').addEventListener('click', function () {
    box.hidden = true; fab.hidden = false;
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text || busy) return;
    input.value = '';
    add('user', text);
    hist.push({ role: 'user', content: text });
    busy = true;
    var wait = add('assistant', '…');
    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: hist.slice(-8) })
    }).then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (d) {
        var t = d && d.ok ? d.reply : (d && d.error === 'too_many'
          ? 'Too many messages — please wait a minute.'
          : 'Sorry, chat is unavailable right now. Please use WhatsApp.');
        render(wait, t);
        if (d && d.ok) hist.push({ role: 'assistant', content: t });
      })
      .catch(function () { render(wait, 'Connection problem. Please try again.'); })
      .then(function () { busy = false; log.scrollTop = log.scrollHeight; });
  });

  document.body.appendChild(fab);
  document.body.appendChild(box);
})();
