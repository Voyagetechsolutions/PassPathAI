/* PassPath Premium purchase page. Signs into the student's own account
 * (Firebase Auth REST — the web apiKey is public by design), then starts a
 * Paystack checkout via the backend. Paystack redirects back here after
 * payment; the backend webhook is what actually activates Premium. */
(function () {
  'use strict';

  var FIREBASE_API_KEY = 'AIzaSyCa9gVDjyQUnakTkR4Wnj9uiLLxS45u_uo';
  var API = '/api';

  var $ = function (id) { return document.getElementById(id); };
  var token = sessionStorage.getItem('pp.premium.token');

  // Paystack appends ?trxref=…&reference=… when it redirects back.
  var params = new URLSearchParams(window.location.search);
  if (params.has('trxref') || params.has('reference') || params.has('paid')) {
    $('paid-view').classList.remove('hidden');
  }

  function showErr(id, msg) {
    var el = $(id);
    el.textContent = msg;
    el.style.display = 'block';
  }

  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, opts.headers);
    return fetch(API + path, opts).then(function (r) {
      return r.json().then(function (body) {
        if (!r.ok) {
          var msg = body && body.message ? (Array.isArray(body.message) ? body.message[0] : body.message) : 'Request failed';
          var e = new Error(msg);
          e.status = r.status;
          throw e;
        }
        return body;
      });
    });
  }

  function signIn() {
    $('login-err').style.display = 'none';
    $('login-btn').textContent = 'Signing in…';
    fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + FIREBASE_API_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: $('email').value.trim(), password: $('password').value, returnSecureToken: true }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.idToken) { throw new Error('Wrong email or password.'); }
        token = data.idToken;
        sessionStorage.setItem('pp.premium.token', token);
        loadStatus(data.email);
      })
      .catch(function (e) { showErr('login-err', e.message || 'Sign-in failed.'); })
      .finally(function () { $('login-btn').textContent = 'Sign in'; });
  }

  function loadStatus(email) {
    api('/subscription/me')
      .then(function (s) {
        $('login-view').classList.add('hidden');
        $('sub-view').classList.remove('hidden');
        $('sub-who').textContent = 'Signed in' + (email ? ' as ' + email : '') + '.';
        if (s.priceLabel) {
          $('price').innerHTML = s.priceLabel.replace('/month', '') + '<span> /month</span>';
          $('pay-btn').textContent = 'Get Premium — ' + s.priceLabel;
        }
        $('sub-free').classList.toggle('hidden', s.isPremium);
        $('sub-premium').classList.toggle('hidden', !s.isPremium);
        if (s.isPremium && s.currentPeriodEnd) {
          var d = new Date(s.currentPeriodEnd).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
          $('sub-renews').textContent = (s.cancelAtPeriodEnd ? 'Ends on ' : 'Renews on ') + d + '.';
          $('cancel-btn').classList.toggle('hidden', Boolean(s.cancelAtPeriodEnd));
        }
      })
      .catch(function (e) {
        if (e.status === 401) {
          sessionStorage.removeItem('pp.premium.token');
          token = null;
          return;
        }
        showErr('login-err', e.message);
      });
  }

  function checkout() {
    $('sub-err').style.display = 'none';
    $('pay-btn').disabled = true;
    $('pay-btn').textContent = 'Opening secure checkout…';
    api('/subscription/checkout', {
      method: 'POST',
      body: JSON.stringify({ callbackUrl: window.location.origin + window.location.pathname }),
    })
      .then(function (res) { window.location.href = res.authorizationUrl; })
      .catch(function (e) {
        showErr('sub-err', e.message || 'Could not start checkout.');
        $('pay-btn').disabled = false;
        $('pay-btn').textContent = 'Get Premium — secure checkout';
      });
  }

  function cancel() {
    if (!window.confirm('Cancel Premium? You keep it until the end of the period you already paid for.')) { return; }
    $('sub-err').style.display = 'none';
    api('/subscription/cancel', { method: 'POST' })
      .then(function () { loadStatus(); })
      .catch(function (e) { showErr('sub-err', e.message); });
  }

  $('login-btn').addEventListener('click', signIn);
  $('password').addEventListener('keydown', function (e) { if (e.key === 'Enter') { signIn(); } });
  $('pay-btn').addEventListener('click', checkout);
  $('cancel-btn').addEventListener('click', cancel);

  if (token) { loadStatus(); }
})();
