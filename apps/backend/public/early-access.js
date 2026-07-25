/* Early-access signup: name + email (+ optional grade) → POST /api/waitlist */
(function () {
  'use strict';

  var form = document.getElementById('ea-form');
  if (!form) { return; }
  var btn = document.getElementById('ea-btn');
  var msg = document.getElementById('ea-msg');

  function show(kind, text) {
    msg.textContent = text;
    msg.className = 'form-msg ' + kind;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = document.getElementById('ea-name').value.trim();
    var email = document.getElementById('ea-email').value.trim();
    var grade = document.getElementById('ea-grade').value;

    if (!name) { show('err', 'Please tell us your name.'); return; }
    if (!email || email.indexOf('@') < 1) { show('err', 'Please enter a valid email address.'); return; }

    var body = { name: name, email: email };
    if (grade) { body.grade = parseInt(grade, 10); }

    btn.disabled = true;
    btn.textContent = 'Joining…';
    msg.className = 'form-msg';

    fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(function (r) {
        if (!r.ok) { throw new Error('bad status'); }
        // Swap the form for the confirmation, personalised with their name.
        document.getElementById('form-view').classList.add('hide');
        var success = document.getElementById('ea-success');
        var firstName = name.split(' ')[0];
        document.getElementById('ea-success-text').textContent =
          'Thanks ' + firstName + '! We’ll email you as soon as your early access spot is ready. ' +
          'Keep an eye on your inbox — and thank you for helping us build this. 🇿🇦';
        success.classList.add('show');
        success.scrollIntoView({ behavior: 'smooth', block: 'center' });
      })
      .catch(function () {
        show('err', 'Could not sign you up just now — please try again in a minute.');
        btn.disabled = false;
        btn.textContent = 'Get early access';
      });
  });
})();
