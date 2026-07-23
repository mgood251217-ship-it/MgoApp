import React, { useEffect, useState } from "react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import api from "../../api/axios";
import { formatRupiah, formatTime } from "../../services/helpers";
import config from "../../services/config";
import "./PrintPdf.css";

export default function PrintPdf({ orderId, onClose }) {
    const [data, setData] = useState(null);
    const [store, setStore] = useState(null);
    const [paymentData, setPaymentData] = useState(null);

    useEffect(() => {
        if (!orderId) return;
        const fetchData = async () => {
            try {
                const [resOrder, resStore, resPayment] = await Promise.all([
                    api.get("", { params: { action: "order_detail", order_id: orderId } }),
                    api.get("", { params: { action: "store" } }),
                    api.get("", { params: { action: "order_payment", order_id: orderId } })
                ]);
                
                if (resOrder.data?.data) setData(resOrder.data.data);
                if (resStore.data?.data) setStore(resStore.data.data);
                else if (resStore.data) setStore(resStore.data);
                if (resPayment.data?.data) setPaymentData(resPayment.data.data);
                else if (resPayment.data) setPaymentData(resPayment.data);
            } catch (err) {
                console.error("Gagal memuat data:", err);
            }
        };
        fetchData();
    }, [orderId]);

    if (!data || !store || !paymentData) return null;

    const storeId = store.store_id || "";
    const storeName = store.name || store.branch || "MGO Store";
    const storeAddress = store.address || "";
    const storePhone = store.nomor || "";
    
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseUrl = isLocalhost ? config.serverUrl : window.location.origin;
    
    const preferredLogo = store.logo_print || store.logo;
    const logoImg = preferredLogo ? (preferredLogo.startsWith("http") ? preferredLogo : `${baseUrl}/serve_image.php?path=store/${preferredLogo}`) : "";

    const orderData = data.order || {};
    const items = data.items || [];
    const note = data.note || '';
    
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

    const handleDownloadPdf = async () => {
        const element = document.getElementById("pdf-content");
        
        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: "#ffffff"
        });

        const imgData = canvas.toDataURL("image/jpeg", 1.0);
        
        const pdf = new jsPDF("p", "mm", [80, 200]);
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);

        const safeName = (str) => (str || "File").toString().replace(/[^a-z0-9]/gi, '_');
        const fileName = `${safeName(orderData.customer_name)}_${orderData.operator_initial || 'OP'}_${safeName(orderData.date)}_${safeName(orderData.nomorator)}.pdf`;

        pdf.save(fileName);
    };

    return (
        <div className="print-preview-overlay">
            <div className="print-preview-box" style={{ width: "80mm" }}>
                <div className="print-actions">
                    <button className="btn-print" onClick={handleDownloadPdf}>Download PDF</button>
                    <button className="btn-cancel" onClick={onClose}>Batal</button>
                </div>

                <div id="pdf-content" className="receipt">
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
            </div>
        </div>
    );
}