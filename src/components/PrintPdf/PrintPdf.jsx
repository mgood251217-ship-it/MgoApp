import React, { useEffect, useState } from "react";
import { tauriApi } from "../../lib/tauriApi";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import api from "../../api/axios";
import ReceiptContent from "../Receipt/ReceiptContent";
import { getCachedStoreData } from "../../services/apiCache";
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
                    getCachedStoreData(),
                    api.get("", { params: { action: "order_payment", order_id: orderId } })
                ]);
                if (resOrder.data?.data) setData(resOrder.data.data);
                if (resStore) setStore(resStore);
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

    const orderData = data.order || {};

    const handleDownloadPdf = async () => {
        const element = document.getElementById("pdf-content");

        const canvas = await html2canvas(element, {
            scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff"
        });
        const imgData = canvas.toDataURL("image/jpeg", 1.0);

        const pdf = new jsPDF("p", "mm", [80, 200]);
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);

        const safeName = (str) => (str || "File").toString().replace(/[^a-z0-9]/gi, '_');
        const fileName = `${safeName(orderData.customer_name)}_${orderData.operator_initial || 'OP'}_${safeName(orderData.date)}_${safeName(orderData.nomorator)}.pdf`;
        const pdfBlob = pdf.output("blob");

        if (window.electron && window.electron.savePdfData) {
            try {
                const base64Data = pdf.output("datauristring").split(',')[1];
                await window.electron.savePdfData({ filename: fileName, base64Data });
            } catch (error) {
                console.error("Gagal melakukan backup PDF ke Program Data:", error);
            }
        }

        await tauriApi.simpanFile(pdfBlob, fileName, [["PDF", ["pdf"]]]);
    };

    return (
        <div className="print-preview-overlay">
            <div className="print-preview-box" style={{ width: "80mm" }}>
                <div className="print-actions">
                    <button className="btn-print" onClick={handleDownloadPdf}>Download PDF</button>
                    <button className="btn-cancel" onClick={onClose}>Batal</button>
                </div>
                <ReceiptContent data={data} store={store} paymentData={paymentData} />
            </div>
        </div>
    );
}