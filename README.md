# Name Layout Generator

Name Layout Generator adalah aplikasi desktop PC untuk membuat layout nama otomatis bagi kebutuhan sablon, printing, bordir, dan produksi custom nama. Aplikasi menyusun nama ke canvas 58 cm, menjaga urutan resi, membagi layout ke 4 kolom, dan mengekspor PNG transparan resolusi tinggi.

## Fitur Utama

- Canvas default 58 cm dengan tinggi dinamis.
- Maksimal 5 grup kode per project, lengkap dengan warning dan counter realtime `GROUP: n / 5`.
- Private unlock mode untuk owner/admin dengan limit custom atau unlimited.
- Sistem 4 kolom tetap: 0.3 cm, 14.5 cm, 29 cm, dan 45 cm.
- Tinggi maksimal kolom 50 cm dengan spacing antar nama 0.7 cm.
- Input nama otomatis uppercase saat ENTER atau multi-line paste.
- Auto-resize berdasarkan jumlah huruf dan jumlah huruf `I` sesuai blueprint.
- Resi tetap utuh dalam satu grup; jika ruang tidak cukup, resi dipindahkan ke grup berikutnya.
- Selesaikan Grup / F1 untuk sequential balance tanpa mengubah urutan nama.
- Header template `(KODE) (NOMOR) (RUKO) (PENGIRIMAN) (TANGGAL)` dengan auto-number.
- Custom warna CMYK, outline auto/manual, font nama, font header, ukuran header, dan letter spacing.
- Export PNG transparan real size dengan pilihan 72, 150, dan 300 DPI.
- Auto-save ke local storage, save project JSON, quick search, undo/redo, shortcut produksi, dan drag manual pada preview.

## Menjalankan Aplikasi

```bash
npm install
npm start
```

## Test

```bash
npm test
```

Test unit mencakup aturan uppercase, auto-resize, header template, batas grup, private mode, flow 4 kolom, pemindahan resi utuh ke grup baru, sequential balance, dan estimasi area.

## Struktur Project

```text
src/main.js          Entry point Electron desktop
src/preload.js       Bridge aman untuk renderer
src/index.html       UI aplikasi
src/styles.css       Styling desktop workflow
src/renderer.js      Interaksi UI, realtime preview, export PNG
src/layoutEngine.js  Engine layout dan aturan produksi
tests/               Unit test layout engine
```
