# Nöbet N1 — ürün sayfası

Tek sayfalık statik site. Bağımlılık yok, derleme zinciri yok; yalnızca
metni içerikten üreten küçük bir Python betiği var.

## Dosyalar ne işe yarıyor

| Dosya | Ne |
|---|---|
| `index.html` | **Üretilen** sayfa. Elle düzenlemeyin; `content/` + `templates/` düzenlenir. Depoda duruyor, yani betiği hiç çalıştırmasanız da site yayında çalışır. |
| `content/tr.json` | Sayfadaki **bütün metin**. Bir yazıyı değiştirmek istiyorsanız burası. |
| `content/kaynaklar.json` | Dilden bağımsız ayarlar: arka plan resmi, ölçümü ve önbellek sürümü. |
| `templates/index.tmpl` | Sayfa iskeleti; `{{anahtar}}` yer tutucuları. Yapı (SVG, bölüm sırası) burada. |
| `tools/kur.py` | Üretici. |
| `assets/css/style.css` | Tüm görünüm. |
| `assets/js/scene.js` | Kaydırma motoru ve ışık. |
| `assets/js/ui.js` | Mobil menü ve algılama geometrisi hesabı. |
| `assets/art/sahne.webp` | Sahnenin tek görseli. |
| `nginx.conf` | Geliştirme sunucusu ayarı; önbellek kapalı, kaydet-yenile çalışır. `docker-compose.yml` bunu bağlar. |
| `nginx.prod.conf` | Yayın ayarı; `Dockerfile` bunu kopyalar. `?v=` sürümlü CSS, JS ve sahne resmi 1 yıl önbellekte kalır. Bu dosyalardan biri değişince `content/kaynaklar.json` içindeki `surum`u artırıp `kur.py`yi çalıştırın. |

## Metni değiştirmek

1. `content/tr.json` içinde ilgili değeri düzenle.
2. Üret:

```bash
python tools/kur.py
```

`index.html` yeniden yazılır. Anahtar adlarını ve yapıyı bozmayın, yalnızca
değer tarafını değiştirin. Başında `_` olan alanlar not; üretime girmez.

Sayfayı yerelde görmek için:

```bash
python -m http.server 8731
```

## İngilizce (ya da başka bir dil) eklemek

Taslak bir çeviri `content/en.json.taslak` olarak hazır duruyor —
**gözden geçirilmemiş** durumda, o yüzden `.taslak` uzantısıyla bekliyor
(üretici `.json` olmayan dosyaya bakmaz).

1. İçeriği gözden geçir, düzelt.
2. `content/en.json` olarak yeniden adlandır.
3. Üret:

```bash
python tools/kur.py --hepsi
```

`en/index.html` oluşur; ana dil kökte kalır. Varlık yolları (`assets/...`)
alt klasör için kendiliğinden `../` ile öneklenir.

Dile bağlı üç ayrıntı JSON'da duruyor, kodda değil:

- `sahne.ondalik` — ondalık ayracı (`,` / `.`)
- `sahne.birim_metre`, `algilama.birim_alan` — birimler
- `sahne.durumlar`, `sahne.bolgeler` — telemetri panelinin durum adları

Bunlar sayfaya gömülü `window.NOBET` paketiyle `scene.js` ve `ui.js`'e
geçiyor, yani **JS dosyalarında çevrilecek metin yok**.

Sahnedeki etiketlerin arkasındaki gölge plakalarının genişliği metne göre
otomatik hesaplanıyor (`scene.js`, `plakalariOlc`), o yüzden uzayan çeviri
kırpılmıyor.

## Arka plan resmini değiştirmek

Yeni render'ı `assets/art/` içine koy, sonra `content/kaynaklar.json`
içindeki `sahne` bloğunu yeni resme göre doldur:

- `dosya` — yeni dosya yolu
- `resim_px` — resmin piksel boyutu
- `olcum.px_metre` — bir metrenin kaç piksel olduğu (en kolayı kapıyı
  ölçmek: kapı yüksekliği px ÷ gerçek yüksekliği m)
- `olcum.kapi_ekseni_px` — kapının düşey orta ekseninin yatay pikseli
- `olcum.zemin_px` — kapının zemine değdiği satırın pikseli

`kur.py` görselin SVG yerleşimini (`x`/`y`/`width`/`height`) bu dört
sayıdan hesaplıyor; elle koordinat girmeniz gerekmiyor.

`sahne.dunya` bloğuna dokunmayın: ışık, flaşör ve etiketler o koordinat
sistemine göre yerleşmiş durumda. Yeni resimdeki kapı ve zemin eski
sahnenin kapı ekseni (386) ve zemin çizgisiyle (676) hizalanır; ışığın
konumu böyle korunur.

Işığın kendisi resimde değil, SVG'de sentezleniyor — armatürün
konumu `templates/index.tmpl` içindeki `#lRed` / `#lBlue` gruplarında,
ölçülmüş dünya koordinatlarıyla duruyor.

## Teknik değerler

Kanonik liste `content/tr.json` → `teknik.satirlar`. Aynı sayı kapak
değer şeridinde, sahne etiketlerinde ve kopyada da görünüyor;
`templates/index.tmpl` başındaki yorum bloğu her değerin nerelerde
geçtiğini sayıyor.

Bu sayılar şimdilik **tasarım değeri**; gerçek ürün ölçümleriyle
doğrulanmadı.

## Sürüm / önbellek

`content/kaynaklar.json` → `surum`. CSS veya JS değiştiğinde artırın;
`kur.py` bunu `?v=...` olarak yazıyor.

## Denetim

```bash
python tools/kur.py --denetim
```

Üretmeden, diskteki dosyanın içerikle uyumlu olup olmadığını söyler.
Bir şeyi elle `index.html` içinde düzenlediyseniz burada yakalanır.
