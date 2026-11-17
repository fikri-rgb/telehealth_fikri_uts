# RuangSehat — Frontend Self-Assessment Telehealth

Frontend pasien berbasis **React + Vite + CSS**. Backend, validasi, penyimpanan, perhitungan hasil, peninjauan, dan tindak lanjut tetap menggunakan API dari dosen.

## Identitas proyek
- NIM: `C2C023103`
- Nama: `Muhammad Zaenal Fikri`
- Kelas: `Telehealth-B`
- Akun uji yang direncanakan: `P-003` (Andi Wijaya)
- API: `https://telehealth.informatikaunimus.site/api`

## Menjalankan di Windows
1. Install Node.js versi LTS dari https://nodejs.org/
2. Ekstrak ZIP ini.
3. Buka folder `telehealth-frontend` di VS Code.
4. Buka Terminal, jalankan:

   ```bash
   npm install
   npm run dev
   ```

5. Buka alamat lokal yang ditampilkan Vite, biasanya `http://localhost:5173`.

## Pengaturan token
1. Buka menu **Pengaturan** di aplikasi.
2. Pastikan NIM, nama, dan kelas benar.
3. Tempel token pasien yang diberikan dosen untuk akun P-003.
4. Klik **Simpan & uji koneksi**.

Token hanya disimpan di `localStorage` browser. Token tidak ditulis ke source code, `.env`, atau repository. Jangan pernah commit token ke GitHub. Jika menggunakan komputer bersama, hapus token dari Pengaturan setelah selesai.

## Build untuk deployment
```bash
npm run build
npm run preview
```
Hasil build ada di folder `dist/`. Folder `dist/` dapat di-deploy ke layanan hosting static seperti Vercel atau Netlify.

## Fitur yang tersedia
- Pengaturan identitas dan token serta tes koneksi `GET /me?nim=...`
- Beranda: profil, statistik, daftar formulir, dan status UTS
- Petunjuk dan persetujuan sebelum mulai
- Formulir dinamis berdasarkan `GET /forms/{form_id}` (bagian, pertanyaan, opsi, `show_if`)
- Input teks, textarea, pilihan tunggal/ganda, skala, angka, dan tanggal
- Simpan draf, lanjutkan draf, hapus draf
- Validasi sebelum kirim dan ringkasan jawaban
- Kirim asesmen, riwayat berdasarkan NIM, hasil, status dan timeline
- Jawab klarifikasi dan lihat tindak lanjut
- Kuesioner GAD-7 sebagai fitur bonus
- Penanganan respons API 401, 409, dan 422

## Catatan
- Hasil self-assessment **bukan diagnosis**.
- Fitur klarifikasi dan tindak lanjut baru dapat diuji setelah dosen meninjau laporan.
- Frontend mengambil definisi formulir dari API, bukan menyimpan daftar pertanyaan sebagai data tetap.
- Jika struktur respons API yang diterima berbeda dari asumsi tampilan, periksa `src/App.jsx` dan respons di DevTools → Network.
