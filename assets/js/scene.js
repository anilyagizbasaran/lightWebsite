/* Sahne motoru: sayfa kaydırması kamerayı kapıya doğru yaklaştırır.
   Yaklaşan şey ziyaretçinin kendisi — sahnede insan figürü yok.
   Dönüş yok: kamera sadece karşıdan gelir. Düz cephede bu, viewBox'ı
   daraltmaktan başka bir şey değil, o yüzden 3D'ye gerek kalmıyor.

   0.00  16 m, tüm cephe kadrajda
   0.18  14 m: PIR tetiklenir, ışık tam güce
   0.58  6 m: uyarı, ışık nabız gibi
   0.72  3 m: ihlal, flaşör + siren
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
  /* ZOOM KAPALI. Kaydirma kadraji degistirmiyor; sahne bastan sona
     ayni kareden izleniyor ve hikayeyi ISIGIN kendisi anlatiyor:
     kisik beyaz -> tam guc -> kirmizi/mavi cakar -> evin isigi.
     Sabit kamera bir guvenlik kamerasi gorusu gibi de okunuyor.
     Yan fayda: ornekleme orani da sabit kaliyor, yani hicbir anda
     resim buyutulmuyor. VB_NEAR = VB_FAR oldugu icin asagidaki lerp
     hep FAR'i veriyor; dolly geri istenirse buraya daha dar bir
     kadraj yazmak yeterli (orn. w 1280, h 720). */
  var VB_NEAR = VB_FAR;

  /* Tum ev (iki kat, garaj, kapi ve isik kaynagi) zoom boyunca HER ZAMAN
     kadrajda kalmali. Sayilarin denk gelmesine guvenmek yerine kadraj bu
     kutuyu icine alacak sekilde kaydiriliyor — zoom degismez, sadece pan.
     Kutu 1064 x 672; en dar kadraj 1280 x 720, yani her zaman siger. */
  var MUST = { x0: -146, y0: 20, x1: 918, y1: 692 };

  /* ============================================================
     MOBIL KADRAJ. Telefonda tum cepheyi kadrajda tutmak sahneyi
     ekranin %26'sina sikistiriyordu; konu orada giris ve isik, tum
     bina degil. Iki kural her zoom seviyesinde ayni:
       - kapi ekseni (x=386) yatayda TAM ORTADA,
       - isik havuzunun alt kenari (y=710) ekran yuksekliginin %86'sinda.
     Ikinci kural olmadan FAR karesinde havuzun altinda 250 birimlik
     bos zemin kaliyordu; telefonda ekranin dortte biri hicbir sey.
     Kareler bu iki kuraldan uretiliyor, elle koordinat girilmiyor.
     ============================================================ */
  var DOOR_X = 386, POOL_Y = 710, POOL_AT = 0.86, MASP = 960 / 720;
  function mframe(w) {
    var h = w * MASP;
    return { x: DOOR_X - w / 2, y: POOL_Y - POOL_AT * h, w: w, h: h };
  }
  /* Mobil dolly miktari. 1 = hic zoom yok: telefonda kaydirma kadraji
     degistirmiyor, kare bastan sona sabit duruyor. Karar boyle verildi;
     dar ekranda kayan kadraj rahatsiz ediyordu. Yaklasmayi artik kopya,
     mesafe sayaci ve isigin kendisi anlatiyor. Masaustunde dolly duruyor
     (1,22x, VB_FAR -> VB_NEAR). Mobilde tekrar istenirse: 1.3 iyi bir
     baslangic, gerisi asagidaki mframe'den kendini ayarlar. */
  var MZOOM    = 1;
  /* 720 = sabit mobil karenin genisligi. Kucultmek sahneyi yakinlastirir
     (600 belirgin sekilde daha yakin), buyutmek uzaklastirir. Zoom kapali
     oldugu icin ziyaretcinin bastan sona gordugu kare bu tek sayi. */
  var MVB_FAR  = mframe(720);
  var MVB_NEAR = mframe(720 / MZOOM);
  /* Kutu isigin CIKTIGI yeri (armatur govdesi y=430) ve DUSTUGU yeri
     (zemin 676 + isik havuzu 710) ikisini de payla kapsiyor: y 400-730.
     Yukaridaki iki kuralla bu kutu zaten hep kadrajda; kelepce mobilde
     devreye girmiyor, sadece emniyet kemeri olarak duruyor. */
  var MMUST    = { x0: 330, y0: 400, x1: 446, y1: 730 };

  var isMobile = false, FAR = VB_FAR, NEAR = VB_NEAR, BOX = MUST;
  var lastVB = '';
  function measureViewport() {
    /* innerWidth 0 ise olcu henuz yok (gizli sekme, kapanmis panel);
       0 <= 760 oldugu icin sahne kendini mobil saniyordu. */
    var vw = window.innerWidth || 1280, vh = window.innerHeight || 800;
    isMobile = vw <= 760 || (vw / vh) < 1.3;
    FAR  = isMobile ? MVB_FAR  : VB_FAR;
    NEAR = isMobile ? MVB_NEAR : VB_NEAR;
    BOX  = isMobile ? MMUST    : MUST;
  }

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


  /* ---------- düğümler ---------- */
  var el = {
    /* Isik artik SVG ile cizilmiyor: ayni kameradan uretilmis uc
       fotogercekci kare arasinda gecis yapiliyor. Kareler 1 px icinde
       ortusuyor (olculdu), o yuzden capraz gecis hayalet yapmiyor. */
    /* Isik artik fotograf degil, sahnenin uzerine cizilen rig.
       Taban karede kapi isigi ZATEN acik; lWhite onun USTUNE ekliyor,
       yani beklemede hicbir sey cizilmiyor, ekranda sadece fotograf
       var. killWhite ise tersi: alarmda pismis beyazi bastiriyor. */
    white:  document.getElementById('lWhite'),
    kill:   document.getElementById('killWhite'),
    win:    document.getElementById('lWin'),
    acts:   Array.prototype.slice.call(document.querySelectorAll('.act')),
    hud:      document.getElementById('hud'),
    hudState: document.getElementById('hudState'),
    hudDist:  document.getElementById('hudDist'),
    hudZone:  document.getElementById('hudZone'),
    hudBar:   document.getElementById('hudBar'),
    beats:  Array.prototype.slice.call(document.querySelectorAll('#beats button'))
  };

  /* ---------- durum ---------- */
  var progress = 0, alarmOn = false, actIndex = -1, nearOn = null;
  var lastState = '', lastZone = '', lastDist = '';
  /* Pencere isigi gercek zamanli gecikmeyle yanar: alarm baslar,
     1 sn sonra ev sahibi lambaya basar. Kaydirma hizindan bagimsiz. */
  var alarmT0 = 0, WIN_DELAY = 1000, WIN_FADE = 450;
  /* Beyazin cakara devri: ani kesme "isik kayboldu" gibi okunuyordu. */
  var WHITE_FADE = 180;

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

    var vw = lerp(FAR.w, NEAR.w, zoom);
    var vh = lerp(FAR.h, NEAR.h, zoom);
    var vx = lerp(FAR.x, NEAR.x, zoom);
    var vy = lerp(FAR.y, NEAR.y, zoom);

    /* kapi + armatur kutusunu kadraja zorla */
    vx = Math.max(Math.min(vx, BOX.x0), BOX.x1 - vw);
    vy = Math.max(Math.min(vy, BOX.y0), BOX.y1 - vh);
    /* Ayni kareyi tekrar yazmak yok. Mobilde MZOOM=1 oldugundan kare
       hic degismiyor; her karede setAttribute cagirmak telefonda bosa
       harcanan bir SVG yeniden cizimi demek. */
    var vbStr = vx.toFixed(1) + ' ' + vy.toFixed(1) + ' ' +
                vw.toFixed(1) + ' ' + vh.toFixed(1);
    if (vbStr !== lastVB) { lastVB = vbStr; art.setAttribute('viewBox', vbStr); }

    /* yakın planda ürün etiketi dev gibi büyümesin */
    /* Kadraj sabit oldugu icin etiket artik buyumuyor; yine de
       alarma dogru gizleniyor, sahnenin onunde durmasin. */
    var near = zoom > 0.55;
    if (near !== nearOn) { nearOn = near; stage.classList.toggle('is-near', near); }

    /* Alarm durumu. Işık hesabından ÖNCE kurulmalı: alarmT0 sonra
       atanınca ilk karede eski değer okunuyor ve beyaz ışık sıfıra
       düşüp bir kare sonra yukarı zıplıyordu. */
    if (alarm !== alarmOn) {
      alarmOn = alarm;
      if (alarm) alarmT0 = now;
      stage.classList.toggle('is-alarm', alarm);
      if (el.hud) el.hud.classList.toggle('is-alarm', alarm);
    }

    /* algılama: 14 m eşiği */
    var detected = dist <= 14 && p > T.dolly[0];
    var inWarn   = dist <= 6;

    /* ışık gücü: kısık -> tam -> uyarı nabzı */
    /* Kisik seviye 0,42'den 0,55'e cikti: SVG huzmesinde 0,42 "kisik
       ama yanik" okunuyordu, foto gecisinde ise neredeyse kapali
       gorunuyor. Kapali kare gercekten karanlik, aradaki fark buyuk. */
    var gain = detected ? 1 : 0.55;
    /* Uyari nabzi. Genlik bilerek kisik: eklenen isik 0,55-1,0
       aralligini 0-1'e actigi icin buradaki her carpan ekranda
       buyutulmus gorunuyor. 0,76+-0,24 ile deneyince isik tam gucten
       kisiga inip cikiyordu, nabiz degil ariza gibi okunuyordu. */
    if (inWarn && !alarm && !reduced) gain *= 0.91 + 0.09 * Math.sin(now * 0.009);
    /* Çakar çalarken beyaz söner — ama ANİDEN değil. Sıfıra kesince
       "ışık kaynağı yok oldu, yerine başka bir şey çıktı" gibi
       okunuyordu. 180 ms'de sönüyor: aynı armatürün mod değiştirmesi.
       Lens ağzı (lensBody) hiç kaybolmuyor, sadece yayım söner. */
    if (alarm) gain *= clamp01(1 - (now - alarmT0) / WHITE_FADE);
    /* gain 0,55 (kisik) -> 1,0 (tam guc). Kisik hali fotografin
       kendisi oldugu icin eklenen isik 0'dan baslamali: 0,55'te sifir,
       1,0'da tam. Alarmda gain zaten 0'a dusuyor, yani rig kapaniyor.
       killWhite ters yonde: gain dustukce pismis beyazi bastiriyor. */
    var add = clamp01((gain - 0.55) / 0.45);
    if (el.white) el.white.setAttribute('opacity', add.toFixed(3));
    if (el.kill)  el.kill.setAttribute('opacity', (clamp01(1 - gain / 0.55) * 0.82).toFixed(3));

    /* Evin ışığı: alarmdan 1 sn sonra yanar. "Geri çekildi" boyunca YANIK
       KALIR — ev sahibi lambayı davetsiz misafir gidince hemen kapatmaz.
       Yalnızca sahne bekleme moduna dönerken (p 0.97 -> 1.00) söner. */
    var glow;
    if (alarm)                 glow = clamp01((now - alarmT0 - WIN_DELAY) / WIN_FADE);
    else if (p < T.alarmEnd)   glow = 0;
    else                       glow = alarmT0 ? (1 - track(p, 0.97, 1.0)) : 0;
    if (el.win) el.win.setAttribute('opacity', glow.toFixed(3));

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
  window.addEventListener('resize', function () {
    measureViewport();
    lastVB = '';   /* olcu degisti, onbellekteki kare artik gecersiz */
    start();
  });
  measureViewport();
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
