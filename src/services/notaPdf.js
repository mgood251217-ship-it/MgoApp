import { createRoot } from "react-dom/client";
import React from "react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import api from "../api/axios";
import { getCachedStoreData } from "./apiCache";
import ReceiptContent from "../components/Receipt/ReceiptContent";

function waitForImages(container) {
    const imgs = Array.from(container.querySelectorAll("img"));
    return Promise.all(imgs.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
        });
    }));
}

function safeName(str) {
    return (str || "File").toString().replace(/[^a-z0-9]/gi, "_");
}

export async function generateNotaBase64(orderId, format = "pdf") {
    if (!["pdf", "jpg"].includes(format)) throw new Error("Format nota harus PDF atau JPG.");
    const [resOrder, resStore, resPayment] = await Promise.all([
        api.get("", { params: { action: "order_detail", order_id: orderId } }),
        getCachedStoreData(),
        api.get("", { params: { action: "order_payment", order_id: orderId } })
    ]);

    const data = resOrder.data?.data;
    const store = resStore?.data ?? resStore;
    const paymentData = resPayment.data?.data ?? resPayment.data;

    if (!data || !store || !paymentData) {
        throw new Error("Data order/store/payment tidak lengkap.");
    }

    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.style.width = "80mm";
    document.body.appendChild(container);

    const root = createRoot(container);
    try {
        await new Promise((resolve) => {
            root.render(React.createElement(ReceiptContent, { data, store, paymentData, id: "pdf-content-nota" }));
            setTimeout(resolve, 50);
        });
        await waitForImages(container);

        const element = container.querySelector("#pdf-content-nota");
        if (!element) throw new Error("Tampilan nota belum tersedia.");
        const canvas = await html2canvas(element, {
            scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff"
        });
        const imgData = canvas.toDataURL("image/jpeg", 1.0);
        const orderData = data.order || {};
        const fileName = `NOTA_${safeName(orderData.customer_name)}_${safeName(orderData.operator_initial || "OP")}_${safeName(orderData.date)}_${safeName(orderData.nomorator)}.${format}`;

        if (format === "jpg") {
            return { base64Data: imgData.split(",")[1], fileName };
        }

        const pdfWidth = 80;
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        const pdf = new jsPDF("p", "mm", [pdfWidth, Math.max(200, pdfHeight)]);
        pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
        return { base64Data: pdf.output("datauristring").split(",")[1], fileName };
    } finally {
        root.unmount();
        container.remove();
    }
}
