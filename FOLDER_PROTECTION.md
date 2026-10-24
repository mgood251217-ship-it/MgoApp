# Panduan Folder Protection

Folder Protection membatasi perubahan file langsung dari Explorer untuk akun Windows biasa. Pengguna tetap bisa membaca file, sedangkan pekerjaan tambah, ubah, dan hapus file dilakukan melalui MGO.

## Persiapan Sekali Saja

Saat memasang MgoDesktop pada komputer penyimpanan, centang **Komputer server: pasang / perbarui layanan Folder Protection**. Isi akun Windows pengguna MGO, meskipun persetujuan pemasangan memakai akun administrator lain.

Jika layanan sudah terpasang dan berjalan, langsung lanjut ke langkah berikut. Pengguna tidak perlu mengetik perintah PowerShell.

Installer memakai satu lokasi aplikasi: `C:\ProgramData\MgoDesktop`. Instalasi lama di AppData pengguna diperiksa dan dimigrasikan otomatis, termasuk ketika UAC memakai akun administrator lain. Pengaturan pengguna dipertahankan. Jika migrasi gagal, installer menampilkan error; tutup MGO di semua akun dan periksa rincian instalasi sebelum mencoba lagi.

## Mengaktifkan Folder

1. Buka **Settings → Custom Folder Protection**.
2. Klik **Tambah folder**, isi nama, lalu **Pilih folder**. Contoh: `D:\Indoor`. Pilih folder yang sudah ada, bukan seluruh drive `D:\`.
3. Klik **Simpan daftar folder**, lalu **Periksa folder**.
4. Klik **Aktifkan dengan administrator**. Masukkan sandi administrator saat diminta Windows, lalu setujui lokasi folder pada dialog konfirmasi.
5. Klik **Uji CRUD melalui MGO** dan pastikan pengujian berhasil.
6. Pada bagian **Path Folder Produksi**, pilih lokasi yang sama untuk kategori yang sesuai, lalu simpan pengaturan.

Ulangi langkah tersebut untuk folder lain, misalnya `D:\Outdoor`.

## Memastikan Sudah Berhasil

- **Belum diaktifkan:** folder baru masuk daftar; proteksi belum aktif.
- **Terdaftar pada layanan lokal:** folder sudah terdaftar; jalankan pengujian untuk memastikan aksesnya.
- **Pengujian lokal berhasil:** pengujian akses Windows dan operasi melalui MGO lulus untuk akun yang sedang digunakan.

Untuk pekerjaan sehari-hari, jalankan MGO dengan akun Windows biasa. Explorer tetap bisa membaca file, tetapi perubahan langsung harus ditolak. Administrator yang menjalankan tindakan dengan hak administrator tetap dapat mengubah izin.

## Jika Aktivasi Gagal

Baca pesan di bawah folder atau pada dialog administrator. Jika tombol aktivasi belum bisa diklik, klik **Periksa folder** dan lihat alasan yang ditampilkan. Catat pesan error lengkap agar penyebabnya bisa diperiksa; jangan menghapus folder atau mengubah izin seluruh drive untuk mencoba memperbaikinya.

**Catatan:** Menghapus folder dari daftar tidak mencabut proteksi. Reinstall tidak mengembalikan data yang sudah dihapus. Fitur ini saat ini berlaku untuk folder lokal; koneksi layanan melalui LAN belum tersedia.
