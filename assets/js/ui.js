/* Mobil menü ve algılama geometrisi hesabı */

(function () {
  'use strict';

  /* ---------------- mobil bölüm menüsü ---------------- */
  /* Geometri bloguna girmeden ONCE durmali: orada erken bir return var,
     asagiya yazilan her sey #hRange yoksa hic calismaz. */
  var mBtn = document.getElementById('menuBtn');
  var mNav = document.getElementById('mobileNav');

  function setMenu(open) {
    mNav.hidden = !open;
    mBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    /* Panel acikken arkadaki 45 ekranlik sayfa kaymasin. */
    document.documentElement.style.overflow = open ? 'hidden' : '';
  }

  if (mBtn && mNav) {
    mBtn.addEventListener('click', function () { setMenu(mNav.hidden); });
    mNav.addEventListener('click', function (e) {
      /* Baglantiya basilinca kapanmali, yoksa hedef bolum panelin
         arkasinda kaliyor. Bos alana basmak da kapatir. */
      var a = e.target.closest('a');
      if (!a && e.target !== mNav) return;
      /* Sayfada scroll-behavior: smooth var. Menuden Teknik'e atlamak
         6700 px demek: yumusak kaydirma saniyeler suruyor ve butun sahne
         gozun onunden gecip gidiyor. Menu atlamalari aninda olmali.
         Global stili gecici degistirip geri almak yerine (bir kare sonra
         geri alma denendi, tetiklenmeyince sayfa smooth'u kalici kaybetti)
         kaydirmayi burada kendimiz yapiyoruz. Hash sonra yaziliyor:
         adres cubugu ve geri tusu normal calismaya devam ediyor. */
      var href = a && a.getAttribute('href');
      var target = href && href.charAt(0) === '#' && document.querySelector(href);
      if (target) {
        e.preventDefault();
        setMenu(false);
        /* 'auto' CSS'teki scroll-behavior'a duser, yani smooth olur.
           Aninda atlamanin anahtar kelimesi 'instant'. */
        target.scrollIntoView({ behavior: 'instant', block: 'start' });
        location.hash = href;
        return;
      }
      setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !mNav.hidden) { setMenu(false); mBtn.focus(); }
    });
    /* Genis ekrana donerken panel acik kalmasin: .menu-btn orada gizli,
       yani kapatacak dugme de ortadan kayboluyor. */
    window.addEventListener('resize', function () {
      if (!mNav.hidden && window.innerWidth > 760) setMenu(false);
    });
  }

  /* ---------------- algılama geometrisi (üstten görünüm) ---------------- */
  var range = document.getElementById('hRange');
  if (!range) return;

  var CX = 260, CY = 42;
  var HALF = 55 * Math.PI / 180;   // 110 derecenin yarısı
  var SPAN = 1.91986;              // 110 derece radyan
  var SCALE = 21.5;                // px / metre

  var out   = document.getElementById('hOut');
  var wedge = document.getElementById('geoWedge');
  var edgeL = document.getElementById('geoEdgeL');
  var edgeR = document.getElementById('geoEdgeR');
  var arc   = document.getElementById('geoArc');
  var blind = document.getElementById('geoBlind');
  var dim   = document.getElementById('geoReachLabel');
  var fReach = document.getElementById('figReach');
  var fArea  = document.getElementById('figArea');
  var fBlind = document.getElementById('figBlind');

  function pt(r, theta) {
    return [CX + r * Math.sin(theta), CY + r * Math.cos(theta)];
  }
  function tr(n, d) { return n.toFixed(d).replace('.', ','); }

  /* 5 m ve 10 m mesafe halkaları */
  (function grid() {
    var g = document.getElementById('geoGrid');
    if (!g) return;
    var ns = 'http://www.w3.org/2000/svg';
    [5, 10].forEach(function (m) {
      var r = m * SCALE;
      var a = pt(r, -HALF), b = pt(r, HALF);
      var p = document.createElementNS(ns, 'path');
      p.setAttribute('d', 'M' + a[0].toFixed(1) + ',' + a[1].toFixed(1) +
        ' A' + r.toFixed(1) + ',' + r.toFixed(1) + ' 0 0 1 ' + b[0].toFixed(1) + ',' + b[1].toFixed(1));
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', '#16202F');
      p.setAttribute('stroke-dasharray', '3 5');
      g.appendChild(p);

      var t = document.createElementNS(ns, 'text');
      t.setAttribute('x', (CX + 6).toFixed(1));
      t.setAttribute('y', (CY + r - 5).toFixed(1));
      t.textContent = m + ' m';
      g.appendChild(t);
    });
  })();

  function update() {
    var h = parseFloat(range.value);
    var reach = 11 + (h - 2) * 2;          // m
    var rb = h * 0.42;                     // kör daire yarıçapı, m
    var area = 0.5 * SPAN * (reach * reach - rb * rb);

    var R = reach * SCALE;
    var a = pt(R, -HALF), b = pt(R, HALF);
    var arcD = 'A' + R.toFixed(1) + ',' + R.toFixed(1) + ' 0 0 1 ' + b[0].toFixed(1) + ',' + b[1].toFixed(1);

    if (wedge) wedge.setAttribute('d', 'M' + CX + ',' + CY + ' L' + a[0].toFixed(1) + ',' + a[1].toFixed(1) + ' ' + arcD + ' Z');
    if (arc)   arc.setAttribute('d', 'M' + a[0].toFixed(1) + ',' + a[1].toFixed(1) + ' ' + arcD);
    if (edgeL) edgeL.setAttribute('d', 'M' + CX + ',' + CY + ' L' + a[0].toFixed(1) + ',' + a[1].toFixed(1));
    if (edgeR) edgeR.setAttribute('d', 'M' + CX + ',' + CY + ' L' + b[0].toFixed(1) + ',' + b[1].toFixed(1));
    if (blind) blind.setAttribute('r', (rb * SCALE).toFixed(1));

    if (dim) {
      dim.setAttribute('y', (CY + R + 18).toFixed(1));
      dim.textContent = tr(reach, 1) + ' m';
    }
    if (out)    out.textContent = tr(h, 1) + ' m';
    if (fReach) fReach.textContent = tr(reach, 1) + ' m';
    if (fArea)  fArea.textContent = Math.round(area) + ' m²';
    if (fBlind) fBlind.textContent = tr(rb, 1) + ' m';
  }

  range.addEventListener('input', update);
  update();
})();
