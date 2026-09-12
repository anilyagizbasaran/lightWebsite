/* İki tonlu siren — WebAudio ile sentezlenir, ses dosyası yok.
   Tarayıcı kuralı gereği yalnızca kullanıcı "sesi aç" dedikten sonra çalar. */

window.Siren = (function () {
  var ctx = null, master = null;
  var osc = null, lfo = null, lfoGain = null, shaper = null;
  var enabled = false, playing = false;

  var RATE = 1.724;   // Hz — flaşörle aynı tempo
  var LOW  = 720;     // alçak ton
  var HIGH = 1320;    // yüksek ton
  var PEAK = 0.17;    // ana ses seviyesi

  function build() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();

    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // gövde: kare dalga, biraz yumuşatılmış
    osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = (LOW + HIGH) / 2;

    shaper = ctx.createBiquadFilter();
    shaper.type = 'bandpass';
    shaper.frequency.value = 1100;
    shaper.Q.value = 1.1;

    // kare LFO tonu iki kademe arasında atlatır
    lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = RATE;
    lfoGain = ctx.createGain();
    lfoGain.gain.value = (HIGH - LOW) / 2;
    lfo.connect(lfoGain).connect(osc.frequency);

    osc.connect(shaper).connect(master);
    osc.start();
    lfo.start();
    return true;
  }

  function ramp(to, secs) {
    if (!ctx) return;
    var t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(to, t + secs);
  }

  return {
    isEnabled: function () { return enabled; },

    enable: function () {
      if (!ctx && !build()) return false;
      if (ctx.state === 'suspended') ctx.resume();
      enabled = true;
      if (playing) ramp(PEAK, 0.12);
      return true;
    },

    disable: function () {
      enabled = false;
      ramp(0, 0.1);
    },

    start: function () {
      playing = true;
      if (enabled) ramp(PEAK, 0.08);
    },

    stop: function () {
      playing = false;
      ramp(0, 0.22);
    }
  };
})();
