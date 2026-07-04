/* PassPath admin dashboard.
 * Signs in with Firebase Auth (email/password REST API — the web apiKey is
 * public by design) and calls the backend /api/admin endpoints, which only
 * authorised admin emails may use. */
(function () {
  'use strict';

  var FIREBASE_API_KEY = 'AIzaSyCa9gVDjyQUnakTkR4Wnj9uiLLxS45u_uo';
  var API = '/api';

  var $ = function (id) { return document.getElementById(id); };
  var token = sessionStorage.getItem('pp.admin.token');
  var email = sessionStorage.getItem('pp.admin.email');

  function show(view) {
    $('login-view').classList.toggle('hidden', view !== 'login');
    $('dash-view').classList.toggle('hidden', view !== 'dash');
    $('logout-btn').classList.toggle('hidden', view !== 'dash');
    $('refresh-btn').classList.toggle('hidden', view !== 'dash');
    $('who').textContent = view === 'dash' && email ? email : 'Not signed in';
  }

  function signIn() {
    var err = $('login-err');
    err.style.display = 'none';
    $('login-btn').textContent = 'Signing in…';
    fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + FIREBASE_API_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: $('email').value.trim(), password: $('password').value, returnSecureToken: true }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.idToken) {
          throw new Error(data.error && data.error.message === 'INVALID_LOGIN_CREDENTIALS' ? 'Wrong email or password.' : 'Sign-in failed.');
        }
        token = data.idToken;
        email = data.email;
        sessionStorage.setItem('pp.admin.token', token);
        sessionStorage.setItem('pp.admin.email', email);
        show('dash');
        loadAll();
      })
      .catch(function (e) {
        err.textContent = e.message || 'Sign-in failed.';
        err.style.display = 'block';
      })
      .finally(function () { $('login-btn').textContent = 'Sign in'; });
  }

  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, opts.headers);
    return fetch(API + path, opts).then(function (r) {
      if (r.status === 401) { signOut(); throw new Error('Session expired — sign in again.'); }
      if (r.status === 403) { throw new Error('This account is not an admin.'); }
      if (!r.ok) { throw new Error('Request failed (' + r.status + ')'); }
      return r.json();
    });
  }

  function signOut() {
    token = null; email = null;
    sessionStorage.removeItem('pp.admin.token');
    sessionStorage.removeItem('pp.admin.email');
    show('login');
  }

  function card(value, label, green) {
    return '<div class="card' + (green ? ' green' : '') + '"><b>' + value + '</b><span>' + label + '</span></div>';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function fmtDate(d) {
    return d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  }

  function renderStats(s) {
    $('user-cards').innerHTML =
      card(s.users.total, 'Total accounts') +
      card(s.users.students, 'Students') +
      card(s.users.parents, 'Parents') +
      card(s.users.onboarded, 'Finished onboarding');
    $('engage-cards').innerHTML =
      card(s.engagement.activeToday, 'Active today', true) +
      card(s.engagement.activeThisWeek, 'Active this week') +
      card(s.engagement.tutorMessages, 'Tutor messages (all time)') +
      card(s.engagement.tutorMessagesThisWeek, 'Tutor messages this week') +
      card(s.engagement.tutorConversations, 'Topics being tutored') +
      card(s.engagement.examAttempts, 'Exam attempts');
    $('revenue-cards').innerHTML =
      card(s.revenue.activeSubscriptions, 'Active subscriptions', true) +
      card('R' + s.revenue.estimatedMrr, 'Monthly revenue (est.)', true) +
      card(s.revenue.priceLabel, 'Premium price') +
      card(s.revenue.paystackConfigured ? 'Connected' : 'Not set up', 'Paystack');
    $('system-cards').innerHTML =
      card(s.content.subjects, 'Subjects') +
      card(s.content.pastPapers, 'Past papers') +
      card(s.content.questions, 'Questions') +
      card(s.content.careers, 'Careers') +
      card(s.system.dbSizeMb != null ? s.system.dbSizeMb + ' MB' : '—', 'Database size (cap 512 MB)') +
      card(esc(s.system.chatModel), 'AI model — ' + esc(s.system.chatProvider)) +
      card(s.system.freeTrial.tutorMessages + ' msgs / ' + s.system.freeTrial.mockExams + ' mock', 'Free trial limits');
  }

  function renderUsers(users) {
    $('users-body').innerHTML = users.map(function (u) {
      var name = u.studentProfile ? esc(u.studentProfile.firstName + ' ' + u.studentProfile.surname)
        : u.parentProfile ? esc(u.parentProfile.firstName + ' ' + u.parentProfile.surname) : '—';
      var grade = u.studentProfile && u.studentProfile.grade ? 'Gr ' + u.studentProfile.grade : '—';
      return '<tr>' +
        '<td>' + esc(u.email) + '</td>' +
        '<td>' + name + '</td>' +
        '<td>' + grade + '</td>' +
        '<td><span class="pill role">' + esc(u.role) + '</span></td>' +
        '<td><span class="pill ' + (u.isActive ? 'ok">Active' : 'off">Suspended') + '</span></td>' +
        '<td class="muted">' + fmtDate(u.createdAt) + '</td>' +
        '<td><button data-id="' + esc(u.id) + '" data-active="' + u.isActive + '">' + (u.isActive ? 'Suspend' : 'Reactivate') + '</button></td>' +
        '</tr>';
    }).join('');
    Array.prototype.forEach.call($('users-body').querySelectorAll('button'), function (btn) {
      btn.addEventListener('click', function () {
        var makeActive = btn.getAttribute('data-active') !== 'true';
        if (!makeActive && !window.confirm('Suspend this user? They will not be able to sign in.')) { return; }
        api('/admin/users/' + btn.getAttribute('data-id') + '/status', {
          method: 'PATCH',
          body: JSON.stringify({ isActive: makeActive }),
        }).then(loadAll).catch(function (e) { window.alert(e.message); });
      });
    });
  }

  function renderAudit(logs) {
    $('audit-body').innerHTML = logs.slice(0, 30).map(function (l) {
      return '<tr>' +
        '<td class="muted">' + fmtDate(l.createdAt) + '</td>' +
        '<td>' + esc(l.actor ? l.actor.email : '') + '</td>' +
        '<td>' + esc(l.action) + '</td>' +
        '<td class="muted">' + esc(l.target || '') + '</td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="4" class="muted">No admin actions yet.</td></tr>';
  }

  function loadAll() {
    $('loading').style.display = 'block';
    $('dash-content').classList.add('hidden');
    Promise.all([api('/admin/stats'), api('/admin/users'), api('/admin/audit-logs')])
      .then(function (res) {
        renderStats(res[0]);
        renderUsers(res[1]);
        renderAudit(res[2]);
        $('loading').style.display = 'none';
        $('dash-content').classList.remove('hidden');
      })
      .catch(function (e) {
        $('loading').textContent = e.message || 'Could not load — try Refresh.';
      });
  }

  $('login-btn').addEventListener('click', signIn);
  $('password').addEventListener('keydown', function (e) { if (e.key === 'Enter') { signIn(); } });
  $('logout-btn').addEventListener('click', signOut);
  $('refresh-btn').addEventListener('click', loadAll);

  if (token) { show('dash'); loadAll(); } else { show('login'); }
})();
