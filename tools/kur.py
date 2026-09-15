# -*- coding: utf-8 -*-
u"""index.html'i icerikten uretir.

    python tools/kur.py            -> index.html      (content/tr.json)
    python tools/kur.py en         -> en/index.html   (content/en.json)
    python tools/kur.py --hepsi    -> content/ icindeki her dil
    python tools/kur.py --denetim  -> uretmez, mevcut dosyayla karsilastirir

NEDEN BOYLE:
Metin HTML'in icinde kaliyor, JavaScript'le sonradan doldurulmuyor.
Yani arama motorlari ve JS kapali tarayicilar sayfayi tam goruyor,
ceviri de "once Turkce goster sonra degistir" gibi bir zipzip
yapmiyor. Bedeli: metni degistirdikten sonra bu betigi calistirmak
gerekiyor. Uretilen index.html depoda duruyor, yani betigi hic
calistirmasan da site yayinda calisir.

Sablon dili yok, yalnizca {{anahtar}} yer degistirme var. Tekrar
eden yapilar (tablo satirlari, model kartlari...) burada, Python
tarafinda uretiliyor -- ogrenilecek yeni bir sozdizimi olmasin diye.

Ayrica window.NOBET dosyasi sayfaya gomuluyor: scene.js ve ui.js
icindeki durum adlari, bolge etiketleri ve birimler oradan
okunuyor, yani JS dosyalarinda cevrilecek metin kalmiyor.
"""
import io
import json
import os
import sys

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def yol(*p):
    return os.path.join(KOK, *p)


def oku_json(p):
    with io.open(p, encoding='utf-8') as f:
        return json.load(f)


def kacir(t):
    u"""HTML metin dugumu icin: & < > yeterli. Metinlerde kasten
    kullanilan &nbsp; gibi varliklari bozmamak icin & yalniz
    varlik baslangici degilse kacirilir."""
    out = []
    for i, ch in enumerate(t):
        if ch == '&' and not _varlik_mi(t, i):
            out.append('&amp;')
        elif ch == '<':
            out.append('&lt;')
        elif ch == '>':
            out.append('&gt;')
        else:
            out.append(ch)
    return ''.join(out)


def _varlik_mi(t, i):
    son = t.find(';', i + 1, i + 12)
    if son < 0:
        return False
    govde = t[i + 1:son]
    if not govde:
        return False
    if govde[0] == '#':
        return govde[1:].isdigit() or (govde[1:2] in ('x', 'X') and govde[2:].isalnum())
    return govde.isalnum()


def oz(t):
    u"""HTML oznitelik degeri icin"""
    return kacir(t).replace('"', '&quot;')


# ---------------------------------------------------------------
# tekrar eden yapilar
# ---------------------------------------------------------------

def topnav(c):
    s = [u'<nav class="topnav" aria-label="%s">' % oz(c['menu']['etiket'])]
    for o in c['menu']['ogeler']:
        if o.get('masaustu'):
            s.append(u'    <a href="#%s">%s</a>' % (o['id'], kacir(o['ad'])))
    s.append(u'  </nav>')
    return u'\n'.join(s)


def mobnav(c):
    # Numarali isaret YOK: menu bir sira degil, bir liste.
    # (Kurulum adimlari gercek sira; oradaki sayac duruyor.)
    s = [u'<nav class="mobnav-in" aria-label="%s">' % oz(c['menu']['etiket'])]
    for o in c['menu']['ogeler']:
        s.append(u'    <a href="#%s">%s</a>' % (o['id'], kacir(o['ad'])))
    s.append(u'  </nav>')
    s.append(u'  <p class="mobnav-foot"><a href="mailto:%s">%s</a></p>'
             % (oz(c['eposta']), kacir(c['eposta'])))
    return u'\n'.join(s)


def beatler(c):
    sh = c['sahne']
    s = [u'<nav class="beats" id="beats" aria-label="%s">' % oz(sh['beat_etiketi'])]
    for i, b in enumerate(sh['beatler']):
        ek = u' aria-current="true"' if i == 0 else u''
        s.append(u'      <button type="button" data-p="%s"%s>%s</button>'
                 % (b['p'], ek, kacir(b['ad'])))
    s.append(u'    </nav>')
    return u'\n'.join(s)


def kapak(c):
    k = c['sahne']['kapak']
    # Eyebrow etiketi kasten yok: bkz. content/tr.json -> sahne.kapak._
    s = [u'<h1>%s</h1>' % u'<br>'.join(kacir(x) for x in k['baslik']),
         u'        <p class="cover-lede">%s</p>' % kacir(k['lede']),
         u'        <ul class="cover-spec">']
    for d in k['degerler']:
        s.append(u'          <li><b>%s</b><span>%s</span></li>'
                 % (kacir(d['deger']), kacir(d['etiket'])))
    s.append(u'        </ul>')
    return u'\n'.join(s)


def aktlar(c):
    sh = c['sahne']
    s = []
    for i, a in enumerate(sh['aktlar'], 1):
        if i > 1:
            s.append(u'      <article class="act" data-act="%d">' % i)
        else:
            s.append(u'<article class="act" data-act="%d">' % i)
        s.append(u'        <h2>%s</h2>' % kacir(a['baslik']))
        s.append(u'        <p>%s</p>' % kacir(a['govde']))
        if i == len(sh['aktlar']):
            dug = []
            for b in sh['cta']:
                sinif = u'btn btn-ghost' if b.get('ikincil') else u'btn'
                dug.append(u'<a class="%s" href="%s">%s</a>'
                           % (sinif, oz(b['hedef']), kacir(b['ad'])))
            s.append(u'        <p class="act-cta">%s</p>' % u' '.join(dug))
        s.append(u'      </article>')
    return u'\n'.join(s)


def etiketler(c):
    u"""Sahne etiketlerinin metinleri. Konumlar sablonda sabit
    (olculmus noktalar); yalnizca yazi degisiyor."""
    # (ankor_x, ust_y, alt_y) -- olculmus etiket konumlari
    YER = [(234, 459, 477), (260, 385, 403), (160, 638, 656), (262, 382, 400)]
    out = []
    for (ax, y1, y2), e in zip(YER, c['sahne']['etiketler']):
        out.append(
            u'<text x="%d" y="%d" text-anchor="end">%s</text>\n'
            u'        <text x="%d" y="%d" text-anchor="end" class="anno-sub">%s</text>'
            % (ax, y1, kacir(e['ust']), ax, y2, kacir(e['alt'])))
    return out


def hud(c):
    h = c['sahne']['hud']
    return (u'<div class="hud-row"><span class="hud-k">%s</span>'
            u'<span class="hud-v" id="hudState">%s</span></div>\n'
            u'      <div class="hud-row"><span class="hud-k">%s</span>'
            u'<span class="hud-v" id="hudDist">%s</span></div>\n'
            u'      <div class="hud-row"><span class="hud-k">%s</span>'
            u'<span class="hud-v" id="hudZone">%s</span></div>'
            % (kacir(h['durum']), kacir(c['sahne']['durumlar']['bekleme']),
               kacir(h['mesafe']), kacir(h['bos']),
               kacir(h['bolge']), kacir(h['bos'])))


def kademeler(c):
    s = []
    for i, k in enumerate(c['caydirma']['kademeler'], 1):
        viz = {
            1: u'<span class="v-glow"></span>',
            2: u'<span class="v-glow v-full"></span>',
            3: u'<span class="v-flash v-r"></span><span class="v-flash v-b"></span>',
        }.get(i, u'<span class="v-glow"></span>')
        bas = u'' if i == 1 else u'      '
        s.append(u'%s<li class="step step-%d">' % (bas, i))
        s.append(u'        <div class="step-viz" aria-hidden="true">%s</div>' % viz)
        s.append(u'        <h3>%s</h3>' % kacir(k['ad']))
        s.append(u'        <p class="step-meta">%s</p>' % kacir(k['deger']))
        s.append(u'        <p>%s</p>' % kacir(k['govde']))
        s.append(u'      </li>')
    return u'\n'.join(s)


def geo_figurler(c):
    f = c['algilama']['figurler']
    return (u'<div><dt>%s</dt><dd id="figReach">11,8 m</dd></div>\n'
            u'        <div><dt>%s</dt><dd id="figArea">133 m²</dd></div>\n'
            u'        <div><dt>%s</dt><dd id="figBlind">1,0 m</dd></div>'
            % (kacir(f['menzil']), kacir(f['alan']), kacir(f['kor'])))


def teknik_satirlar(c):
    s = []
    for i, r in enumerate(c['teknik']['satirlar']):
        bas = u'' if i == 0 else u'        '
        s.append(u'%s<tr><th scope="row">%s</th><td>%s</td></tr>'
                 % (bas, kacir(r['ad']), kacir(r['deger'])))
    return u'\n'.join(s)


def modeller(c):
    s = []
    for i, m in enumerate(c['modeller']['kartlar']):
        sinif = u'model model-lead' if m.get('one_cikan') else u'model'
        bas = u'' if i == 0 else u'      '
        s.append(u'%s<article class="%s">' % (bas, sinif))
        s.append(u'        <h3>%s</h3>' % kacir(m['ad']))
        s.append(u'        <p class="model-what">%s</p>' % kacir(m['ne']))
        s.append(u'        <p>%s</p>' % kacir(m['govde']))
        s.append(u'        <p class="model-power">%s</p>' % kacir(m['guc']))
        s.append(u'      </article>')
    return u'\n'.join(s)


def kurulum_adimlar(c):
    s = []
    for i, a in enumerate(c['kurulum']['adimlar']):
        bas = u'' if i == 0 else u'      '
        s.append(u'%s<li><h3>%s</h3><p>%s</p></li>'
                 % (bas, kacir(a['ad']), kacir(a['govde'])))
    return u'\n'.join(s)


def alt(c):
    return (u'<p class="foot-brand">%s</p>\n'
            u'    <p class="foot-note">%s</p>\n'
            u'    <p class="foot-mail"><a href="mailto:%s">%s</a></p>'
            % (kacir(c['marka']), kacir(c['alt']['not']),
               oz(c['eposta']), kacir(c['eposta'])))


# ---------------------------------------------------------------
# sahne resmi: yerlesim OLCUMDEN hesaplaniyor
# ---------------------------------------------------------------

def sahne_resmi(kay, kok_yolu=u''):
    s = kay['sahne']
    o = s['olcum']
    d = s['dunya']
    K = 100.0 / o['px_metre']          # 1 piksel kac dunya birimi
    g = s['resim_px']['genislik'] * K
    y = s['resim_px']['yukseklik'] * K
    x = d['kapi_ekseni'] - o['kapi_ekseni_px'] * K
    ty = d['zemin'] - o['zemin_px'] * K

    def sy(v):
        t = u'%.1f' % v
        return t[:-2] if t.endswith(u'.0') else t

    return (u'<image href="%s%s" x="%s" y="%s"\n'
            u'             width="%s" height="%s" preserveAspectRatio="none"/>'
            % (kok_yolu, oz(s['dosya']), sy(x), sy(ty), sy(g), sy(y)))


# ---------------------------------------------------------------
# JS'e verilen metin paketi
# ---------------------------------------------------------------

def js_paketi(c):
    sh = c['sahne']
    veri = {
        'dil': c['dil'],
        'durumlar': sh['durumlar'],
        'bolgeler': sh['bolgeler'],
        'metre': sh['birim_metre'],
        'alan': c['algilama']['birim_alan'],
        'ondalik': sh['ondalik'],
        'bos': sh['hud']['bos'],
    }
    govde = json.dumps(veri, ensure_ascii=False, sort_keys=True,
                       separators=(u',', u':'))
    # </script> metnin icinde gecerse sayfa boluner
    govde = govde.replace(u'</', u'<\\/')
    return (u'<script>window.NOBET=%s;</script>' % govde)


# ---------------------------------------------------------------
# uret
# ---------------------------------------------------------------

def uret(dil):
    c = oku_json(yol('content', dil + '.json'))
    kay = oku_json(yol('content', 'kaynaklar.json'))
    tmpl = io.open(yol('templates', 'index.tmpl'), encoding='utf-8').read()

    ana = (dil == c.get('ana_dil', 'tr'))
    kok_yolu = u'' if ana else u'../'
    v = kay['surum']
    et = etiketler(c)

    D = {
        'html_dil':        u'<html lang="%s">' % oz(c['dil']),
        'meta_baslik':     u'<title>%s</title>' % kacir(c['meta']['baslik']),
        'meta_aciklama':   u'<meta name="description" content="%s">' % oz(c['meta']['aciklama']),
        'css':             u'<link rel="stylesheet" href="%sassets/css/style.css?v=%s">' % (kok_yolu, v),
        'atla':            u'<a class="skiplink" href="#%s">%s</a>'
                           % (c['menu']['ogeler'][0]['id'], kacir(c['atla'])),
        'marka':           u'<span class="brand-name">%s</span>' % kacir(c['marka']),
        'topnav':          topnav(c),
        'menu_buton':      u'aria-expanded="false" aria-controls="mobileNav" aria-label="%s">'
                           % oz(c['menu']['buton']),
        'mobnav':          mobnav(c),
        'sahne_resmi':     sahne_resmi(kay, kok_yolu),
        'etiket_1':        et[0],
        'etiket_2':        et[1],
        'etiket_3':        et[2],
        'etiket_4':        et[3],
        'beatler':         beatler(c),
        'kapak':           kapak(c),
        'aktlar':          aktlar(c),
        'hud':             hud(c),
        'caydirma_basi':   u'<h2 class="band-h">%s</h2>\n    <p class="band-lede">%s</p>'
                           % (kacir(c['caydirma']['baslik']), kacir(c['caydirma']['lede'])),
        'kademeler':       kademeler(c),
        'algilama_metin':  u'<h2 class="band-h">%s</h2>\n      <p>%s</p>'
                           % (kacir(c['algilama']['baslik']), kacir(c['algilama']['govde'])),
        'kaydirici':       u'<span class="slider-name">%s</span>' % kacir(c['algilama']['kaydirici']),
        'geo_figurler':    geo_figurler(c),
        'geo_baslik':      u'<title id="geoTitle">%s</title>' % kacir(c['algilama']['gorsel_baslik']),
        'teknik_basi':     u'<h2 class="band-h">%s</h2>' % kacir(c['teknik']['baslik']),
        'teknik_caption':  u'<caption class="sr-only">%s</caption>' % kacir(c['teknik']['caption']),
        'teknik_satirlar': teknik_satirlar(c),
        'modeller_basi':   u'<h2 class="band-h">%s</h2>' % kacir(c['modeller']['baslik']),
        'modeller':        modeller(c),
        'kurulum_basi':    u'<h2 class="band-h">%s</h2>' % kacir(c['kurulum']['baslik']),
        'kurulum_adimlar': kurulum_adimlar(c),
        'alt':             alt(c),
        'betikler':        u'%s\n<script src="%sassets/js/scene.js?v=%s" defer></script>\n'
                           u'<script src="%sassets/js/ui.js?v=%s" defer></script>'
                           % (js_paketi(c), kok_yolu, v, kok_yolu, v),
    }

    out = tmpl
    for k, val in D.items():
        yt = u'{{%s}}' % k
        assert yt in out, u'sablonda yer tutucu yok: ' + k
        out = out.replace(yt, val)

    kalan = [x for x in out.split(u'{{')[1:]]
    assert not kalan, u'doldurulmamis yer tutucu: ' + kalan[0][:40]

    hedef = yol('index.html') if ana else yol(dil, 'index.html')
    return hedef, out


def diller():
    d = []
    for f in sorted(os.listdir(yol('content'))):
        if f.endswith('.json') and f != 'kaynaklar.json':
            d.append(f[:-5])
    return d


def main(argv):
    denetim = '--denetim' in argv
    argv = [a for a in argv if not a.startswith('--')]
    hepsi = '--hepsi' in sys.argv or denetim
    hedefler = diller() if hepsi else (argv or ['tr'])

    kod = 0
    for dil in hedefler:
        hedef, out = uret(dil)
        rel = os.path.relpath(hedef, KOK).replace('\\', '/')
        if denetim:
            eski = io.open(hedef, encoding='utf-8').read() if os.path.exists(hedef) else u''
            if eski == out:
                print(u'ayni      %s' % rel)
            else:
                print(u'FARKLI    %s  (%d -> %d karakter)' % (rel, len(eski), len(out)))
                kod = 1
            continue
        kls = os.path.dirname(hedef)
        if kls and not os.path.isdir(kls):
            os.makedirs(kls)
        io.open(hedef, 'w', encoding='utf-8', newline='\n').write(out)
        print(u'yazildi   %s  (%s, %d karakter)' % (rel, dil, len(out)))
    return kod


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
