/* Early-access waitlist form → POST /api/waitlist */
(function () {
  'use strict';
  var form = document.getElementById('signup-form');
  if (!form) { return; }
  var msg = document.getElementById('signup-msg');
  var btn = document.getElementById('signup-btn');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = document.getElementById('signup-email').value.trim();
    var grade = document.getElementById('signup-grade').value;
    if (!email) { return; }
    btn.disabled = true;
    btn.textContent = 'Joining…';
    msg.className = 'signup-msg';
    fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(grade ? { email: email, grade: parseInt(grade, 10) } : { email: email }),
    })
      .then(function (r) {
        if (!r.ok) { throw new Error('bad status'); }
        msg.textContent = "You're on the list! We'll email you before launch. 🎉";
        msg.className = 'signup-msg ok';
        form.reset();
      })
      .catch(function () {
        msg.textContent = 'Could not sign you up just now — try again in a minute.';
        msg.className = 'signup-msg err';
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = 'Get early access';
      });
  });
})();
