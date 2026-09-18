import React, { useEffect, useState, useRef } from "react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { tauriApi } from "../../lib/tauriApi";
import api from "../../api/axios";
import ReceiptContent from "../Receipt/ReceiptContent";
import { getCachedStoreData } from "../../services/apiCache";
import "./PrintStruk.css";

export default function PrintStruk({ orderId, onClose }) {
    const [data, setData] = useState(null);
    const [store, setStore] = useState(null);
    const [paymentData, setPaymentData] = useState(null);
    const hasPrintedRef = useRef(false);

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
            } catch (err) {}
        };
        fetchData();
    }, [orderId]);

    const orderData = data?.order || {};

    const handlePrint = async () => {
        try {
            if (window.electron && window.electron.savePdfData) {
                const element = document.querySelector(".receipt");
                if (element) {
                    const canvas = await html2canvas(element, {
                        scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff"
                    });
                    const imgData = canvas.toDataURL("image/jpeg", 1.0);

                    const tempPdf = new jsPDF("p", "mm", [80, 200]);
                    const imgProps = tempPdf.getImageProperties(imgData);
                    const pdfWidth = tempPdf.internal.pageSize.getWidth();
                    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

                    const finalPdf = new jsPDF("p", "mm", [80, pdfHeight > 200 ? pdfHeight : 200]);
                    finalPdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);

                    const safeName = (str) => (str || "File").toString().replace(/[^a-z0-9]/gi, '_');
                    const fileName = `Struk_${safeName(orderData.customer_name)}_${orderData.operator_initial || 'OP'}_${safeName(orderData.date)}_${safeName(orderData.nomorator)}.pdf`;
                    const base64Data = finalPdf.output("datauristring").split(',')[1];

                    await window.electron.savePdfData({ filename: fileName, base64Data });
                }
            }
        } catch (error) {
            console.error("Gagal menyimpan backup struk PDF:", error);
        }

        try {
            await tauriApi.cetakStruk();
        } catch (error) {
            console.error("Gagal membuka dialog print:", error);
        }

        if (onClose) onClose();
    };

    useEffect(() => {
        if (hasPrintedRef.current) return;
        if (!data || !store || !paymentData) return;
        hasPrintedRef.current = true;
        handlePrint();
    }, [data, store, paymentData]);

    if (!data || !store || !paymentData) return null;

    return (
        <div className="receipt-print-container">
            <ReceiptContent data={data} store={store} paymentData={paymentData} />
        </div>
    );
}