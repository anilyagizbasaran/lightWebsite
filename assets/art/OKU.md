# Hırsız karakteri — parça dosyaları

Bu klasöre parça dosyaları düştüğü an site otomatik olarak onlara geçer.
`scene.js` açılışta `torso.png`'yi yokluyor: varsa görsel katman açılır, yoksa
elle yazılmış vektör figür yedek olarak kalır. Kod değişikliği gerekmez.

Rig, yürüyüş döngüsü, diz bükümü ve alarm pozu aynen çalışmaya devam eder —
parçalar aynı eklem gruplarının içine giriyor.

## En kolay yol: tek görsel ver, kesmeyi Claude yapsın

Bana **tek bir tam boy karakter görseli** ver, 7 parçaya ben bölerim
(Pillow ile). Böylece parçalar arasında stil tutarsızlığı olmaz.

Görselin şartları:

- **Yandan görünüm (profil), yüzü SOLA bakacak.**
- **Nötr ayakta duruş.** Yürüyen ya da eğilmiş poz OLMAZ — poz parçalara
  gömülür ve rig yanlış görünür. Kollar aşağı, bacaklar düz ve dikey.
- **Kollar gövdeden hafif ayrı**, bacaklar arasında görünür boşluk olsun.
  Üst üste binen parçaları temiz kesemem.
- **Şeffaf zemin** (PNG, alfa kanallı).
- En az **1200 piksel yüksekliğinde**.
- Teçhizat görünsün: kar maskesi/kapüşon, taktik yelek, eldiven,
  kargo pantolon, bot, sırtta çanta.

Dosyayı bu klasöre `kaynak.png` adıyla koy, gerisini ben yaparım.

## Alternatif: parçaları kendin kes

Dosya adları ve kutu ölçüleri (figür birimi; figür 292 birim boyunda,
ayak tabanı y=0, yukarı negatif):

| Dosya | Eklem | Kutu (genişlik × yükseklik) |
|---|---|---|
| `head.png` | — (sabit) | 74 × 74 |
| `torso.png` | — (sabit) | 62 × 92 |
| `bag.png` | — (sabit) | 44 × 72 |
| `upperarm.png` | omuz | 24 × 60 |
| `forearm.png` | dirsek | 26 × 66 (el dahil) |
| `thigh.png` | kalça | 34 × 80 |
| `shin.png` | diz | 42 × 96 (bot dahil) |

**Dönen parçalarda (kol/bacak) eklem, kutunun ÜST-ORTA noktasında olmalı.**
Uyluk görselinin üst kenarının ortası kalça eklemidir; baldırın üst kenarının
ortası diz eklemidir. Bu hizalama yanlışsa uzuvlar dönerken yerinden kopar.

Çözünürlük: 1 birim = 4 piksel (yani `thigh.png` 136 × 320 piksel).
PNG, şeffaf zemin.

Ölçüleri değiştirmek gerekirse `assets/js/scene.js` içindeki `ART` nesnesi.
