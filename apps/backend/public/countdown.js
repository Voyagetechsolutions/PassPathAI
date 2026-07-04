/* Launch countdown. Change LAUNCH_DATE to move the launch — the banner
 * updates itself and switches to "We're live" once the moment passes. */
(function () {
  'use strict';

  var LAUNCH_DATE = new Date('2026-08-01T09:00:00+02:00'); // 1 Aug 2026, 09:00 SAST

  var box = document.getElementById('countdown');
  if (!box) { return; }

  var units = ['days', 'hours', 'mins', 'secs'];

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function tick() {
    var diff = LAUNCH_DATE.getTime() - Date.now();
    if (diff <= 0) {
      box.innerHTML = '<div class="cd-live">We’re live! 🎉</div>';
      clearInterval(timer);
      return;
    }
    var s = Math.floor(diff / 1000);
    var vals = [Math.floor(s / 86400), Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60];
    for (var i = 0; i < units.length; i++) {
      var el = document.getElementById('cd-' + units[i]);
      if (el) { el.textContent = pad(vals[i]); }
    }
  }

  var timer = setInterval(tick, 1000);
  tick();
})();
