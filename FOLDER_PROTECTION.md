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

**Catatan:** Menghapus folder dari daftar tidak mencabut proteksi. Reinstall tidak mengembalikan data yang sudah dihapus.

## Menggunakan Folder Lewat LAN

1. Pasang installer terbaru pada server dengan mencentang **Komputer server**. Pada komputer klien, pasang aplikasi tanpa mencentang layanan server.
2. Pada server, buka **Settings → Folder Protection LAN → Komputer server**. Pilih folder yang sudah dilindungi, misalnya `D:\TEST PATH FOLDER`, lalu isi nama server (misalnya `DEV`).
3. MGO mengisi path share khusus, misalnya `\\DEV\MGOFP_<id>`. Klik **Buat kode dengan administrator** dan setujui UAC. MGO membuat SMB share yang menunjuk langsung ke folder tersebut, memberi izin share baca-saja kepada **Authenticated Users**, dan mengizinkan SMB TCP 445 hanya dari subnet lokal. Izin NTFS tetap membatasi hasil akhirnya.
4. Dalam 10 menit, pada MGO komputer klien, tempel kode di **Folder Protection LAN**, lalu klik **Sambungkan dan simpan koneksi**. Ulangi pada klien lain yang dipercaya; IP klien boleh berubah dalam subnet LAN. Setelah terdaftar, koneksi tetap berlaku sampai dicabut.
5. Isi **Path Folder Produksi** klien dengan path jaringan persis seperti pada koneksi, lalu simpan. Untuk Explorer, buka **Siapkan akses baca Explorer** pada koneksi MGO, masukkan akun Windows baca-saja di server satu kali, lalu klik **Simpan akses aman & buka Explorer**. Kredensial tersimpan di Windows Credential Manager untuk akun Windows client yang sedang login; tombol **Buka di Explorer** memakai kredensial tersebut. `D:\TEST PATH FOLDER` adalah path lokal server, bukan alamat jaringan.
6. Klik **Uji akses Windows dan CRUD LAN**. CRUD MGO harus lulus, sedangkan perubahan melalui Explorer harus ditolak. Jalankan pengujian dari komputer klien, bukan hanya server.

Operasi MGO pada folder terdaftar—termasuk mencari folder pesanan, memeriksa status, membuat folder, dan menganalisis file—berjalan melalui layanan TLS Folder Protection; MGO tidak memerlukan akses SMB untuk operasi tersebut. Akses Explorer adalah jalur SMB terpisah dan hanya baca. Jangan aktifkan akses guest/anonim atau memberi izin tulis `Everyone`; gunakan akun Windows server standar dengan akses baca saja. Kredensial Explorer tidak dipakai untuk CRUD MGO.

Bagikan kode hanya kepada pengguna yang dipercaya. Klien memakai izin CRUD operator server pembuat kode. Membuat kode baru mencabut kode dan pendaftaran klien lama untuk folder yang sama: semua klien folder itu perlu disambungkan kembali. **Cabut akses LAN** memutus akses MGO untuk folder itu dan menghapus share Explorer khusus yang dibuat MGO. Share Windows lain yang dipilih manual tidak diubah. Pengaturan server memulai ulang layanan, jadi selesaikan pekerjaan file dahulu.

Koneksi MGO memakai TLS, identitas perangkat, dan firewall TCP 42765 untuk subnet lokal; Explorer memakai SMB TCP 445 pada subnet lokal. Izin tulis share tidak diberikan kepada **Authenticated Users** atau **Everyone**. Kunci pribadi klien disimpan terenkripsi untuk akun Windows yang memasukkannya. Program yang berjalan sebagai akun Windows yang sama tetap berada dalam batas kepercayaan akun itu.
