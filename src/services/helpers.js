export const sanitize = (data) => {
    if (typeof data !== "string") return data;
    return data.trim();
};


export const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};


export const formatKeInternasional = (nomor) => {
    if (!nomor) return "";
    let cleaned = nomor.toString().replace(/[^0-9]/g, "");

    if (cleaned.startsWith("0")) {
        cleaned = "62" + cleaned.substring(1);
    }
    return "+" + cleaned;
};

export const formatRupiah = (angka) => {
    const validNumber = Number(angka) || 0;
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(validNumber);
};

export const titleCase = (teks) => {
    if (!teks) return "";
    return teks
        .toLowerCase()
        .split(" ")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
};

export const formatTanggalId = (tanggal) => {
    if (!tanggal) return "-";
    
    const dateObj = new Date(tanggal);
    if (isNaN(dateObj.getTime())) return "-";
    
    const bulan = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    
    const tgl = dateObj.getDate();
    const bln = bulan[dateObj.getMonth()];
    const thn = dateObj.getFullYear();
    
    return `${tgl} ${bln} ${thn}`;
};

export const limitText = (text, limit = 100) => {
    if (!text) return "";
    if (text.length > limit) {
        return text.substring(0, limit) + "...";
    }
    return text;
};

export const makeSlug = (string) => {
    if (!string) return "";
    return string
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9 -]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
};

export const hitungDeadline = (deadlineStr) => {
    if (!deadlineStr) return "-";
    
    const sekarang = new Date();
    const deadline = new Date(deadlineStr);
    
    if (deadline < sekarang) {
        return "Sudah Terlewat";
    }
    
    // Normalisasi jam ke 00:00:00 untuk mencari selisih hari penuh
    const tglSekarang = new Date(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate());
    const tglDeadline = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
    
    const diffTime = Math.abs(tglDeadline - tglSekarang);
    const jumlahHari = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const jam = deadline.getHours();
    let jam12 = jam % 12;
    if (jam12 === 0) jam12 = 12;
    
    let ketWaktu = "Malam";
    if (jam >= 0 && jam < 4) {
        ketWaktu = "Dini Hari";
    } else if (jam >= 4 && jam < 10) {
        ketWaktu = "Pagi";
    } else if (jam >= 10 && jam < 15) {
        ketWaktu = "Siang";
    } else if (jam >= 15 && jam < 18) {
        ketWaktu = "Sore";
    }
    
    const formatJam = `Jam ${jam12} ${ketWaktu}`;
    
    if (jumlahHari === 0) {
        return formatJam;
    } else if (jumlahHari === 1) {
        return `${formatJam} Besok`;
    } else {
        return `${jumlahHari} hari lagi`;
    }
};

export const folder = (basePath, storeName, date) => {
    const safeStoreName = (storeName || "Toko").replace(/[^a-zA-Z0-9_-]/g, "_");
    const dateObj = new Date(date);
    
    if (isNaN(dateObj.getTime())) return "";
    
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");
    
    return `/${basePath}/${safeStoreName}/${year}/${month}/${day}/`;
};

export const formatTime = (datetimeStr) => {
    if (!datetimeStr) return "-";
    
    const dateObj = new Date(datetimeStr);
    const bulanIndo = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
    
    const tanggal = dateObj.getDate().toString().padStart(2, '0');
    const bulan = bulanIndo[dateObj.getMonth()];
    const tahun = dateObj.getFullYear();
    
    const jam = dateObj.getHours().toString().padStart(2, '0');
    const menit = dateObj.getMinutes().toString().padStart(2, '0');
    
    return `${tanggal} ${bulan} ${tahun}, ${jam}:${menit}`;
};