/* Sahne motoru: sayfa kaydırması kamerayı kapıya doğru yaklaştırır.
   Yaklaşan şey ziyaretçinin kendisi — sahnede insan figürü yok.
   Dönüş yok: kamera sadece karşıdan gelir. Düz cephede bu, viewBox'ı
   daraltmaktan başka bir şey değil, o yüzden 3D'ye gerek kalmıyor.

   0.00  16 m, tüm cephe kadrajda
   0.18  14 m: PIR tetiklenir, ışık tam güce
   0.58  6 m: uyarı, ışık nabız gibi
   0.72  3 m: ihlal, flaşör + siren, kamera sarsılır
   0.90  geri itilir, menzil dışı
   1.00  yeniden bekleme */

(function () {
  'use strict';

  var art    = document.getElementById('art');
  var stage  = document.getElementById('stage');
  var tunnel = document.getElementById('tunnel');
  if (!art || !stage || !tunnel) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- kamera ----------
     Uzak kadraj tüm sahne; yakın kadraj kapıya odaklı. İkisinin de oranı
     16:9 olmalı, yoksa preserveAspectRatio kırpması zoom'u kaydırır. */
  /* Iki kadraj da kapi eksenine (x=386) ortali: kadraj daralirken kapi
     yerinden kipirdamaz, zoom merkezi kapinin kendisi olur.
     Uzak kadraj ust kat pencerelerinin basini (y=161) da iceriyor. */
  /* Zemin alti sadelestigi icin altta genis bos bant tutmanin anlami
     kalmadi: kadraj eve daha yakin sarildi. Ev y 20..676; kadraj
     -100..780, yani ustte gokyuzu altta 1 m zemin payi. */
  var VB_FAR  = { x: -396, y: -100, w: 1564, h: 880 };
  /* Kapi merkezi x=386. Yakin kadrajda kapiyi sola aliyoruz ki sagdaki
     kopya kolonu karanlik kalsin — ortada dururken aydinlatilmis kapinin
     ustune biniyordu ve metin okunmuyordu. */
  /* Yakin kadraj artik kapiya dalmiyor. Maksat urunu tanitmak ve iki katin
     alarmda bile gorunur kalmasi; bu yuzden zoom 1742 -> 1280, yani sadece
     1,36 kat. Sakin ve surekli bir yaklasma. */
  var VB_NEAR = { x: -254, y: 10, w: 1280, h: 720 };

  /* Tum ev (iki kat, garaj, kapi ve isik kaynagi) zoom boyunca HER ZAMAN
     kadrajda kalmali. Sayilarin denk gelmesine guvenmek yerine kadraj bu
     kutuyu icine alacak sekilde kaydiriliyor — zoom degismez, sadece pan.
     Kutu 1064 x 672; en dar kadraj 1280 x 720, yani her zaman siger. */
  var MUST = { x0: -146, y0: 20, x1: 918, y1: 692 };

  var D_START = 19.0;   // m — başlangıç, menzilin iyice dışı
  var D_TRIP  = 3.0;    // m — ihlal eşiği
  var D_BACK  = 16.5;   // m — geri itildikten sonra, menzil dışı

  var T = {
    dolly:    [0.04, 0.72],
    trip:     0.72,
    alarmEnd: 0.90,
    push:     [0.80, 0.90]
  };

  /* ---------- yardımcılar ---------- */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function track(p, a, b) { return clamp01((p - a) / (b - a)); }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function fmt(n) { return n.toFixed(1).replace('.', ','); }

  /* ---------- yıldızlar ---------- */
  (function stars() {
    var g = document.getElementById('stars');
    if (!g) return;
    var seed = 7, SVGNS = 'http://www.w3.org/2000/svg';
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < 46; i++) {
      var c = document.createElementNS(SVGNS, 'circle');
      c.setAttribute('cx', (40 + rnd() * 1360).toFixed(1));
      c.setAttribute('cy', (30 + rnd() * 400).toFixed(1));
      c.setAttribute('r', (0.7 + rnd() * 1.5).toFixed(2));
      c.setAttribute('opacity', (0.12 + rnd() * 0.42).toFixed(2));
      g.appendChild(c);
    }
  })();

  /* ---------- düğümler ---------- */
  var el = {
    beamW:  document.getElementById('beamW'),
    poolW:  document.getElementById('poolW'),
    lens:   document.getElementById('lens'),
    glow:   document.getElementById('lensGlow'),
    pir:    document.getElementById('pir'),
    winLit: document.getElementById('winLit'),
    acts:   Array.prototype.slice.call(document.querySelectorAll('.act')),
    hud:      document.getElementById('hud'),
    hudState: document.getElementById('hudState'),
    hudDist:  document.getElementById('hudDist'),
    hudZone:  document.getElementById('hudZone'),
    hudBar:   document.getElementById('hudBar'),
    hint:     document.getElementById('soundHint'),
    beats:  Array.prototype.slice.call(document.querySelectorAll('#beats button'))
  };

  /* ---------- durum ---------- */
  var progress = 0, alarmOn = false, actIndex = -1, nearOn = null;
  var lastState = '', lastZone = '', lastDist = '', lastDetected = null;
  /* Pencere isigi gercek zamanli gecikmeyle yanar: alarm baslar,
     1 sn sonra ev sahibi lambaya basar. Kaydirma hizindan bagimsiz. */
  var alarmT0 = 0, WIN_DELAY = 1000, WIN_FADE = 450;

  /* metre cinsinden kamera mesafesi */
  function cameraDistance(p) {
    if (p <= T.dolly[0]) return D_START;
    if (p < T.dolly[1])  return lerp(D_START, D_TRIP, easeInOut(track(p, T.dolly[0], T.dolly[1])));
    if (p < T.push[1])   return lerp(D_TRIP, D_BACK, easeOut(track(p, T.push[0], T.push[1])));
    return D_BACK;
  }

  /* Eşikler kameranın gerçekten o mesafeye vardığı noktalara bağlı.
     D_START=19, D_TRIP=3, dolly [0.04,0.72] ve easeInOut ile:
     14 m -> p=0.31, 6 m -> p=0.51, ihlal 0.72.
     D_START değişirse bunlar da yeniden türetilmeli. */
  function actFor(p) {
    if (p < 0.31) return 0;
    if (p < 0.51) return 1;
    if (p < T.trip) return 2;
    if (p < T.alarmEnd) return 3;
    return 4;
  }

  function render(now) {
    var p = progress;
    var dist = cameraDistance(p);
    var alarm = p >= T.trip && p < T.alarmEnd;

    /* Yaklaşma oranı: 16 m uzak kadraj, 3 m yakın kadraj. */
    var zoom = clamp01((D_START - dist) / (D_START - D_TRIP));

    /* ihlal anında kamera sarsılır */
    var shakeX = 0, shakeY = 0;
    if (alarm && !reduced) {
      /* 14 cok fazlaydi; sadece hissedilecek kadar */
      var amp = 3 * (1 - track(p, T.trip, T.alarmEnd));
      shakeX = Math.sin(now * 0.045) * amp;
      shakeY = Math.cos(now * 0.061) * amp * 0.6;
    }

    var vw = lerp(VB_FAR.w, VB_NEAR.w, zoom);
    var vh = lerp(VB_FAR.h, VB_NEAR.h, zoom);
    var vx = lerp(VB_FAR.x, VB_NEAR.x, zoom) + shakeX;
    var vy = lerp(VB_FAR.y, VB_NEAR.y, zoom) + shakeY;

    /* kapi + armatur kutusunu kadraja zorla */
    vx = Math.max(Math.min(vx, MUST.x0), MUST.x1 - vw);
    vy = Math.max(Math.min(vy, MUST.y0), MUST.y1 - vh);
    art.setAttribute('viewBox',
      vx.toFixed(1) + ' ' + vy.toFixed(1) + ' ' + vw.toFixed(1) + ' ' + vh.toFixed(1));

    /* yakın planda ürün etiketi dev gibi büyümesin */
    var near = zoom > 0.55;
    if (near !== nearOn) { nearOn = near; stage.classList.toggle('is-near', near); }

    /* algılama: 14 m eşiği */
    var detected = dist <= 14 && p > T.dolly[0];
    var inWarn   = dist <= 6;

    /* ışık gücü: kısık -> tam -> uyarı nabzı */
    var gain = detected ? 1 : 0.42;
    if (inWarn && !alarm && !reduced) gain *= 0.76 + 0.24 * Math.sin(now * 0.009);
    /* Cakar carken beyaz huzme tam guctte kalirsa rengi seyreltiyor. */
    if (alarm) gain *= 0.5;
    if (el.beamW) el.beamW.setAttribute('opacity', gain.toFixed(3));
    if (el.poolW) el.poolW.setAttribute('opacity', gain.toFixed(3));
    if (el.glow)  el.glow.setAttribute('opacity', (0.3 + 0.5 * gain).toFixed(3));
    if (el.lens)  el.lens.setAttribute('opacity', (0.5 + 0.5 * gain).toFixed(3));
    if (el.pir && detected !== lastDetected) {
      lastDetected = detected;
      el.pir.setAttribute('stroke', detected ? '#FF2B45' : '#3C5470');
    }

    /* alarm durumu — pencere zamanlayıcısı buradan kuruluyor */
    if (alarm !== alarmOn) {
      alarmOn = alarm;
      if (alarm) alarmT0 = now;
      stage.classList.toggle('is-alarm', alarm);
      if (el.hud) el.hud.classList.toggle('is-alarm', alarm);
      if (window.Siren) alarm ? window.Siren.start() : window.Siren.stop();
    }

    /* Evin ışığı: alarmdan 1 sn sonra yanar. "Geri çekildi" boyunca YANIK
       KALIR — ev sahibi lambayı davetsiz misafir gidince hemen kapatmaz.
       Yalnızca sahne bekleme moduna dönerken (p 0.97 -> 1.00) söner. */
    var glow;
    if (alarm)                 glow = clamp01((now - alarmT0 - WIN_DELAY) / WIN_FADE);
    else if (p < T.alarmEnd)   glow = 0;
    else                       glow = alarmT0 ? (1 - track(p, 0.97, 1.0)) : 0;
    if (el.winLit) el.winLit.setAttribute('opacity', glow.toFixed(3));

    /* telemetri */
    var state, zone;
    if (alarm)                            { state = 'Alarm';         zone = dist <= 6 ? 'İhlal' : '—'; }
    else if (p >= T.alarmEnd && p < 0.97) { state = 'Geri çekildi';  zone = '—'; }
    else if (!detected)                   { state = 'Bekleme';       zone = '—'; }
    else if (dist <= 3.2)                 { state = 'Uyarı';         zone = 'B1 / 3 m'; }
    else if (inWarn)                      { state = 'Yaklaşıyor';    zone = 'B2 / 6 m'; }
    else                                  { state = 'Algılandı';     zone = 'B3 / 14 m'; }

    var distText = dist <= 14.2 && p > T.dolly[0] ? fmt(dist) + ' m' : '—';
    if (el.hudState && state !== lastState)   { el.hudState.textContent = state; lastState = state; }
    if (el.hudZone  && zone  !== lastZone)    { el.hudZone.textContent  = zone;  lastZone  = zone; }
    if (el.hudDist  && distText !== lastDist) { el.hudDist.textContent = distText; lastDist = distText; }
    if (el.hudBar)  el.hudBar.style.width = (p * 100).toFixed(1) + '%';

    /* kopya katmanları */
    var ai = actFor(p);
    if (ai !== actIndex) {
      actIndex = ai;
      el.acts.forEach(function (a, i) { a.classList.toggle('is-on', i === ai); });
      el.beats.forEach(function (b, i) {
        if (i === ai) b.setAttribute('aria-current', 'true');
        else b.removeAttribute('aria-current');
      });
    }

    /* sesi aç ipucu yalnızca ses kapalıyken */
    if (el.hint) {
      el.hint.classList.toggle('is-hidden', !(window.Siren && !window.Siren.isEnabled()));
    }
  }

  /* ---------- kaydırma -> ilerleme ---------- */
  function readProgress() {
    var r = tunnel.getBoundingClientRect();
    var span = r.height - window.innerHeight;
    progress = span > 0 ? clamp01(-r.top / span) : 0;
  }

  function inView() {
    var r = tunnel.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  }

  /* Tek kalıcı rAF döngüsü. Sahne görünürden çıkınca durur, kaydırma
     yeniden başlatır — her scroll olayında yeni döngü açılmaz. */
  var running = false, frozen = false;

  function frame(now) {
    if (!inView()) {
      running = false;
      if (alarmOn) {
        alarmOn = false;
        stage.classList.remove('is-alarm');
        if (el.hud) el.hud.classList.remove('is-alarm');
        if (window.Siren) window.Siren.stop();
      }
      return;
    }
    if (!frozen) readProgress();
    render(now);
    requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }

  /* göstergeye tıklanınca o ana kaydır */
  el.beats.forEach(function (b) {
    b.addEventListener('click', function () {
      var r = tunnel.getBoundingClientRect();
      var span = r.height - window.innerHeight;
      window.scrollTo({
        top: window.scrollY + r.top + span * parseFloat(b.dataset.p),
        behavior: reduced ? 'auto' : 'smooth'
      });
    });
  });

  window.addEventListener('scroll', start, { passive: true });
  window.addEventListener('resize', start);
  readProgress();
  render(0);
  start();

  window.NobetScene = {
    jumpToAlarm: function () {
      var r = tunnel.getBoundingClientRect();
      var span = r.height - window.innerHeight;
      window.scrollTo({ top: window.scrollY + r.top + span * 0.78, behavior: reduced ? 'auto' : 'smooth' });
    },
    /* Sahneyi kaydırmadan belirli bir ana dondurur — test ve ince ayar için. */
    renderAt: function (p) {
      frozen = true;
      progress = clamp01(p);
      render(typeof performance !== 'undefined' ? performance.now() : 0);
      start();
      return progress;
    },
    unfreeze: function () { frozen = false; start(); }
  };
})();
