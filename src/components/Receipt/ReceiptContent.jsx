import React from "react";
import { formatRupiah, formatTime, titleCase } from "../../services/helpers";
import config from "../../services/config";
import "../PrintPdf/PrintPdf.css";

export default function ReceiptContent({ data, store, paymentData, id = "pdf-content" }) {
    if (!data || !store || !paymentData) return null;

    const storeId = store.store_id || "";
    const storeName = titleCase(store.name || store.branch || "MGO Store");
    const storeAddress = store.address || "";
    const storePhone = store.nomor || "";
    const baseUrl = config.serverUrl;

    const preferredLogo = store.logo_print || store.logo;
    const logoImg = preferredLogo
        ? (preferredLogo.startsWith("http")
            ? preferredLogo
            : `${baseUrl}/api/?action=store_logo&path=store/${preferredLogo}`)
        : "";

    const orderData = data.order || {};
    const items = data.items || [];
    const note = data.note || "";

    const payments = paymentData.payments || [];
    const totalBayar = parseFloat(paymentData.paid || 0);
    let adaLunas = paymentData.is_lunas || false;
    let adaDp = false;

    payments.forEach((pay) => {
        if ((pay.status || "").toUpperCase() === "DP") adaDp = true;
        if ((pay.status || "").toUpperCase() === "LUNAS") adaLunas = true;
    });

    const outdoor = {};
    const luasKurangDariSatu = {};
    items.forEach((item) => {
        if ((item.category || "").toUpperCase() === "OUTDOOR" && item.product_id) {
            const pid = item.product_id;
            const match = item.size?.match(/^([\d.]+)[xX]([\d.]+)$/);
            const luas = match ? (parseFloat(match[1]) * parseFloat(match[2])) : 0;
            const pad = Math.max((item.price || 0) - (item.diskon || 0), 0);
            if (!outdoor[pid]) outdoor[pid] = { luas: 0, min_pad: pad };
            outdoor[pid].luas += (luas * item.quantity);
            outdoor[pid].min_pad = Math.min(outdoor[pid].min_pad, pad);
        }
    });
    Object.keys(outdoor).forEach((pid) => {
        if (outdoor[pid].luas < 1) luasKurangDariSatu[pid] = outdoor[pid].min_pad;
    });

    const printedPriceFor = [];

    return (
        <div id={id} className="receipt">
            <div className="center" style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "92%", margin: "0 auto" }}>
                {logoImg && (
                    <img
                        src={logoImg}
                        crossOrigin="anonymous"
                        style={{ maxHeight: "30px", marginBottom: "2px", maxWidth: "70px" }}
                        alt="Logo"
                    />
                )}
                <div style={{ fontFamily: "'Brush Script MT', cursive", fontSize: "16px" }}>{storeName}</div>
            </div>

            <table className="center" style={{ fontSize: "10px", width: "92%", margin: "0 auto" }}>
                <tbody>
                    <tr><td>{storeId == 8 || storeId == 25 ? "Print Sublim | Jersey | DTF | Spanduk | Stiker" : "Spanduk | Banner Kain | Baligho | Stiker One Way | Stiker Outdoor | Backlite | X-Banner | Roll Banner | ID Card | dll"}</td></tr>
                    <tr><td>{storeAddress}</td></tr>
                    <tr><td style={{ fontSize: "12px" }}>Telp: {storePhone}</td></tr>
                </tbody>
            </table>

            <div className="line"></div>

            <table style={{ width: "100%", tableLayout: "fixed" }}>
                <tbody>
                    <tr>
                        <td style={{ width: "80%", verticalAlign: "top" }}>
                            <table style={{ width: "90%", margin: "0 auto", fontSize: "13px" }}>
                                <tbody>
                                    <tr><td width="35%">Tanggal</td><td>: {formatTime(orderData.date)}</td></tr>
                                    <tr><td>Kepada Yth</td><td>: {orderData.customer_name}</td></tr>
                                    <tr><td>Nota No.</td><td>: {orderData.nomorator}</td></tr>
                                    <tr><td>Deadline</td><td>: {formatTime(orderData.deadline)}</td></tr>
                                    <tr><td>Operator</td><td>: {orderData.operator_initial || "-"}</td></tr>
                                </tbody>
                            </table>
                        </td>
                        <td style={{ width: "20%", textAlign: "center", verticalAlign: "middle", padding: 0 }}>
                            <div style={{ transform: "rotate(270deg)", fontWeight: "bold", lineHeight: "90%", fontSize: "15px" }}>
                                <span dangerouslySetInnerHTML={{ __html: adaLunas ? "LUNAS" : "BELUM <br> LUNAS" }}></span>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>

            <div className="line"></div>

            <table style={{ fontSize: "11px", marginTop: "10px", width: "92%", margin: "10px auto 0" }}>
                <tbody>
                    {items.map((item, idx) => {
                        const pid = item.product_id;
                        let hidePrice = false;
                        let customPrice = null;
                        if ((item.category || "").toUpperCase() === "OUTDOOR" && luasKurangDariSatu[pid]) {
                            if (printedPriceFor.includes(pid)) hidePrice = true;
                            else { customPrice = luasKurangDariSatu[pid]; printedPriceFor.push(pid); }
                        }
                        const harga = customPrice !== null ? customPrice : item.amount;
                        return (
                            <React.Fragment key={idx}>
                                <tr style={{ borderTop: "0.5px solid #000" }}>
                                    <td width="45%">{item.judul || item.product_name || "-"}</td>
                                    <td width="20%">{item.size}</td>
                                    <td width="35%" className="text-end">{hidePrice ? "" : formatRupiah(harga)}</td>
                                </tr>
                                <tr style={{ borderBottom: "0.5px solid #000" }}>
                                    <td colSpan="3">
                                        {item.finishing_names && item.finishing_names.trim() !== "" ? `${item.finishing_names} | ` : ""}
                                        {item.quantity} x {hidePrice ? "" : formatRupiah(harga / item.quantity)}
                                    </td>
                                </tr>
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>

            {note && <div style={{ display: "flex", fontStyle: "italic", width: "92%", margin: "5px auto 0" }}>Catatan: {note}</div>}

            <div className="line"></div>

            <table style={{ width: "92%", margin: "0 auto" }}>
                <tbody>
                    <tr><td className="text-end"><strong>TOTAL: {formatRupiah(orderData.total)}</strong></td></tr>
                    {totalBayar > 0 && !adaLunas && (
                        <>
                            <tr><td className="text-end">{adaDp ? "Uang Muka" : "Total Bayar"}: {formatRupiah(totalBayar)}</td></tr>
                            <tr><td className="text-end">Sisa: {formatRupiah(orderData.total - totalBayar)}</td></tr>
                        </>
                    )}
                </tbody>
            </table>

            <div className="line"></div>

            <div style={{ fontSize: "9px", margin: "10px auto 0", width: "92%", lineHeight: "1.4" }}>
                - Periksalah kembali barang pesanan anda saat pengambilan, kami tidak menerima komplen setelah barang diambil<br />
                - Apabila pesanan di atas tidak diambil setelah satu bulan, kami tidak bertanggung jawab atas kehilangan/kerusakan barang tersebut
            </div>

            <table style={{ textAlign: "center", fontSize: "11px", marginTop: "10px", width: "92%", margin: "10px auto 0" }}>
                <tbody>
                    <tr><td>Hormat Kami</td><td>TTD Pemesan</td></tr>
                    <tr>
                        <td style={{ height: "60px" }}><div style={{ borderTop: "1px solid #000", width: "70%", margin: "30px auto 0" }}></div></td>
                        <td style={{ height: "60px" }}><div style={{ borderTop: "1px solid #000", width: "70%", margin: "30px auto 0" }}></div></td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}