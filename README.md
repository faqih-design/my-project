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
- Workspace dark mode modern dengan canvas sebagai fokus utama, sidebar kiri untuk input/header/group info, sidebar kanan untuk font/warna/outline/export, dan top toolbar untuk save/export/undo/redo/zoom/group counter.
- Visual color picker untuk warna teks dan outline, konversi CMYK otomatis, preview warna realtime, recent colors, preset warna cepat, outline auto/manual, font nama, font header, ukuran header, dan letter spacing.
- Preview dan export memakai satu pipeline render yang sama dari data layout, sehingga header dan nama tetap identik antara layar dan PNG.
- Preview visual memakai skala mini `1 cm = 8 px`, ruler cm, grid tipis, dan zoom in/out sehingga ukuran internal tetap real-size tetapi tampilan muat di monitor.
- Debug overlay opsional untuk inspeksi bounding box, posisi x/y, tinggi object, outline, tinggi kolom, dan ukuran hasil resize tanpa mengganggu workflow utama.
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

Test unit mencakup aturan uppercase, auto-resize, konversi warna HEX/RGB/CMYK, metrik bounding box, header template, batas grup, private mode, flow 4 kolom, pemindahan resi utuh ke grup baru, validasi spacing anti-overlap, data object header/nama, sequential balance, dan estimasi area.

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
