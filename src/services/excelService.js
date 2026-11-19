import { tauriApi } from "../lib/tauriApi";
import { authStore } from "./session";
import { formatTanggalId } from "./helpers";

const createWorkbook = async () => {
    const { default: ExcelJS } = await import("exceljs");
    return new ExcelJS.Workbook();
};

const saveWorkbook = async (workbook, fileName) => {
    const buffer = await workbook.xlsx.writeBuffer();
    await tauriApi.simpanFile(new Blob([buffer]), fileName, [["Excel", ["xlsx"]]]);
};

const formatMoneyCell = (cell, withCurrency = false) => {
    const value = cell.value?.result ?? cell.value;
    if (typeof value !== "number" || !Number.isFinite(value)) return;
    const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
    const format = Number.isInteger(rounded) ? "#,##0" : "#,##0.00";
    cell.numFmt = (withCurrency ? '"Rp "' : "") + format;
};

const formatStockCell = (cell) => {
    const value = Number(cell.value);
    cell.numFmt = Number.isInteger(Math.round(value * 10000) / 10000) ? "#,##0" : "#,##0.####";
};

const setCellBorder = (cell) => {
    cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
};

const styleTableRow = (row, { header = false, wrapText = false, includeEmpty = false } = {}) => {
    row.eachCell({ includeEmpty }, (cell) => {
        if (header) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCE5FF" } };
        cell.alignment = { horizontal: "center", vertical: "middle", ...(wrapText ? { wrapText: true } : {}) };
        setCellBorder(cell);
    });
};

export const generateExcelHeader = (sheet, endColLetter, reportTitle, dateString, store = authStore.getUser()?.store) => {
    const storeName = store?.name ?? "Mgo Store";
    const storeAddress = store?.address ?? "Cicaheum";
    sheet.mergeCells(`A1:${endColLetter}1`);
    sheet.getCell("A1").value = storeName || "NAMA TOKO";
    sheet.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
    sheet.getCell("A1").font = { bold: true, size: 16 };

    sheet.mergeCells(`A2:${endColLetter}2`);
    sheet.getCell("A2").value = storeAddress || "-";
    sheet.getCell("A2").alignment = { vertical: "middle", horizontal: "center" };

    sheet.addRow([]);

    sheet.mergeCells(`A4:${endColLetter}4`);
    sheet.getCell("A4").value = reportTitle;
    sheet.getCell("A4").alignment = { vertical: "middle", horizontal: "center" };
    sheet.getCell("A4").font = { bold: true, size: 14 };

    sheet.mergeCells(`A5:${endColLetter}5`);
    sheet.getCell("A5").value = dateString;
    sheet.getCell("A5").alignment = { vertical: "middle", horizontal: "center" };

    sheet.addRow([]);

    return 7;
};

export const exportMeteranExcel = async ({ dataState, category, startDate, endDate }) => {
    if (!dataState) return;

    const categoryLabelMap = {
        meter_pakaian_finishing_pakaian: "Tekstil + Finishing Tekstil",
        meter_components: "Komponen Produksi",
        meter_akrilik_merchandise_akrilik: "Akrilik + Merchandise Akrilik",
        meter_laser: "Laser A3",
        meter_pelengkap: "Pelengkap"
    };

    const formattedCategory =
        categoryLabelMap[category] ||
        category
            .replace("meter_", "")
            .split("_")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join("_");

    const categoryTitle = formattedCategory.replace("_", " ");
    const tanggal = startDate && endDate ? `Tanggal ${startDate} s.d. ${endDate}` : "Tanggal -";

    const workbook = await createWorkbook();
    const sheet = workbook.addWorksheet(formattedCategory);

    let currentRow = generateExcelHeader(sheet, "E", `Laporan Penggunaan Bahan - ${categoryTitle.toUpperCase()}`, tanggal);

    const createTable = (title, columns, rowsData, totalLabel, totalValue) => {
        sheet.mergeCells(`A${currentRow}:E${currentRow}`);
        const titleCell = sheet.getCell(`A${currentRow}`);
        titleCell.value = title;
        titleCell.font = { bold: true, size: 12 };
        titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE599" } };
        currentRow++;

        const headerRow = sheet.addRow(columns);
        headerRow.font = { bold: true };
        styleTableRow(headerRow, { header: true });
        currentRow++;

        rowsData.forEach((rowData) => {
            const row = sheet.addRow(rowData);
            styleTableRow(row);
            if (rowData[1] && isNaN(rowData[1]) && isNaN(parseFloat(rowData[1]))) {
                row.getCell(2).alignment = { vertical: "middle", horizontal: "left" };
            }
            currentRow++;
        });

        sheet.mergeCells(`A${currentRow}:D${currentRow}`);
        const labelCell = sheet.getCell(`A${currentRow}`);
        labelCell.value = totalLabel;
        labelCell.alignment = { horizontal: "right", vertical: "middle" };
        labelCell.font = { bold: true };
        setCellBorder(labelCell);

        const totalCell = sheet.getCell(`E${currentRow}`);
        totalCell.value = totalValue;
        totalCell.font = { bold: true };
        totalCell.alignment = { horizontal: "center", vertical: "middle" };
        setCellBorder(totalCell);

        if (typeof totalValue === "number") {
            totalCell.numFmt = "#,##0.00";
        }
        currentRow++;

        sheet.addRow([]);
        currentRow++;
    };

    const exportGroupedSection = (title, source) => {
        if (!source || typeof source !== "object") return;

        if (source.meteran !== undefined || source.kiloan !== undefined) {
            const totalMeteran = (source.meteran || []).reduce((sum, product) => {
                if (!Array.isArray(product?.rows)) return sum;
                return sum + product.rows.reduce((acc, row) => acc + (Number(row?.m2) || 0), 0);
            }, 0);
            const totalKiloan = (source.kiloan || []).reduce((sum, product) => {
                if (!Array.isArray(product?.rows)) return sum;
                return sum + product.rows.reduce((acc, row) => acc + (Number(row?.kg_total) || 0), 0);
            }, 0);

            sheet.mergeCells(`A${currentRow}:E${currentRow}`);
            sheet.getCell(`A${currentRow}`).value = title;
            sheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };
            sheet.getCell(`A${currentRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE599" } };
            currentRow += 2;

            sheet.mergeCells(`A${currentRow}:E${currentRow}`);
            sheet.getCell(`A${currentRow}`).value = `Total Keseluruhan Bahan Sublim: ${totalMeteran} M² | ${totalKiloan} Kg`;
            sheet.getCell(`A${currentRow}`).font = { bold: true };
            currentRow += 2;

            if (source.meteran && source.meteran.length > 0) {
                source.meteran.forEach((p) => {
                    if (!p.rows || p.rows.length === 0) return;
                    let no = 1;
                    let totalM2 = 0;
                    const rowsData = p.rows.map((r) => {
                        totalM2 += r.m2 || 0;
                        return [no++, r.p, r.l, r.qty, r.m2];
                    });
                    createTable(`Bahan Meteran - ${p.name}`, ["No", "P", "L", "Qty", "Total (M²)"], rowsData, "Total M²", totalM2);
                });
            }

            if (source.kiloan && source.kiloan.length > 0) {
                source.kiloan.forEach((p) => {
                    if (!p.rows || p.rows.length === 0) return;
                    let no = 1;
                    let totalKg = 0;
                    const rowsData = p.rows.map((r) => {
                        totalKg += r.kg_total || 0;
                        return [no++, `${r.kg} Kg`, "-", r.qty, r.kg_total];
                    });
                    createTable(`Bahan Kiloan - ${p.name}`, ["No", "Berat (Kg)", "-", "Qty", "Total (Kg)"], rowsData, "Total Kg", totalKg);
                });
            }
            return;
        }

        if (source.product_data && Array.isArray(source.product_data) && source.product_data[0]?.rows !== undefined) {
            const totalKey = Object.keys(source).find((key) => key.startsWith("total_all_m2"));
            const totalAllM2 = totalKey ? source[totalKey] : 0;

            sheet.mergeCells(`A${currentRow}:E${currentRow}`);
            sheet.getCell(`A${currentRow}`).value = title;
            sheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };
            sheet.getCell(`A${currentRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE599" } };
            currentRow += 2;

            if (totalAllM2 !== undefined && totalAllM2 !== null) {
                sheet.mergeCells(`A${currentRow}:E${currentRow}`);
                sheet.getCell(`A${currentRow}`).value = `Total Keseluruhan Penggunaan: ${totalAllM2} M²`;
                sheet.getCell(`A${currentRow}`).font = { bold: true };
                currentRow += 2;
            }

            source.product_data.forEach((p) => {
                if (!p.rows || p.rows.length === 0) return;
                let no = 1;
                let calculatedTotal = 0;
                const rowsData = p.rows.map((r) => {
                    calculatedTotal += r.m2 || 0;
                    return [no++, r.p, r.l, r.qty, r.m2];
                });
                const finalTotal = source.total_m2_product?.[p.name] !== undefined ? source.total_m2_product[p.name] : calculatedTotal;
                createTable(p.name, ["No", "P", "L", "Qty", "Total (M²)"], rowsData, "Total M²", finalTotal);
            });
            return;
        }

        let normalizedData = [];
        if (source.data && Array.isArray(source.data)) {
            normalizedData = source.data;
        } else if (source.product_data) {
            normalizedData = Array.isArray(source.product_data)
                ? source.product_data
                : Object.keys(source.product_data).map((key) => ({ name: key, total_qty: source.product_data[key] }));
        } else if (Array.isArray(source)) {
            normalizedData = source;
        } else if (typeof source === "object") {
            normalizedData = Object.keys(source).map((key) => ({ name: key, total_qty: source[key] }));
        }

        const totalQty = source.total_all_qty ?? source.total_all ?? normalizedData.reduce((acc, curr) => acc + (curr.total_qty || 0), 0);
        sheet.mergeCells(`A${currentRow}:E${currentRow}`);
        sheet.getCell(`A${currentRow}`).value = title;
        sheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };
        sheet.getCell(`A${currentRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE599" } };
        currentRow += 2;

        sheet.mergeCells(`A${currentRow}:E${currentRow}`);
        sheet.getCell(`A${currentRow}`).value = `Total Keseluruhan Qty: ${totalQty}`;
        sheet.getCell(`A${currentRow}`).font = { bold: true };
        currentRow += 2;

        let no = 1;
        const rowsData = normalizedData.map((item) => [no++, item.name, "-", "-", item.total_qty]);
        createTable(title, ["No", "Nama Produk", "-", "-", "Total Qty"], rowsData, "Total Qty", totalQty);
    };

    if (dataState.grouped_sections && Array.isArray(dataState.grouped_sections)) {
        dataState.grouped_sections.forEach((section) => exportGroupedSection(section.title, section.source));
    } else if (dataState.meteran !== undefined || dataState.kiloan !== undefined) {
        if (dataState.meteran && dataState.meteran.length > 0) {
            dataState.meteran.forEach((p) => {
                if (!p.rows || p.rows.length === 0) return;
                let no = 1;
                let totalM2 = 0;
                const rowsData = p.rows.map((r) => {
                    totalM2 += r.m2 || 0;
                    return [no++, r.p, r.l, r.qty, r.m2];
                });
                createTable(`Meteran - ${p.name}`, ["No", "P", "L", "Qty", "Total (M²)"], rowsData, "Total M²", totalM2);
            });
        }
        if (dataState.kiloan && dataState.kiloan.length > 0) {
            dataState.kiloan.forEach((p) => {
                if (!p.rows || p.rows.length === 0) return;
                let no = 1;
                let totalKg = 0;
                const rowsData = p.rows.map((r) => {
                    totalKg += r.kg_total || 0;
                    return [no++, `${r.kg} Kg`, "-", r.qty, r.kg_total];
                });
                createTable(`Kiloan - ${p.name}`, ["No", "Berat (Kg)", "-", "Qty", "Total (Kg)"], rowsData, "Total Kg", totalKg);
            });
        }
    } else if (dataState.total_panjang_dtf !== undefined) {
        sheet.mergeCells(`A${currentRow}:E${currentRow}`);
        sheet.getCell(`A${currentRow}`).value =
            `Total Panjang DTF: ${dataState.total_panjang_dtf || 0} | Total Panjang DTF UV: ${dataState.total_panjang_dtf_uv || 0}`;
        sheet.getCell(`A${currentRow}`).font = { bold: true };
        currentRow += 2;

        (dataState.product_data || []).forEach((p) => {
            if (!p.rows || p.rows.length === 0) return;
            let no = 1;
            let total = 0;
            const title = `${p.name} ${p.isUV ? "(UV)" : ""}`.trim();
            const rowsData = p.rows.map((r) => {
                total += r.total || 0;
                return [no++, p.isA3 || p.isUV_A3 ? "A3" : r.p, "-", r.qty, r.total];
            });
            createTable(title, ["No", "Panjang / Tipe", "-", "Qty", "Total"], rowsData, "Total", total);
        });
    } else if (category === "meter_akrilik_merchandise_akrilik") {
        const hasM2 =
            Array.isArray(dataState.product_data) && dataState.product_data.some((p) => Array.isArray(p.rows) && p.rows.length > 0);
        const hasQty = Array.isArray(dataState.data) && dataState.data.length > 0;

        if (hasM2) {
            const totalKey = Object.keys(dataState).find((key) => key.startsWith("total_all_m2"));
            const totalAllM2 = totalKey ? dataState[totalKey] : 0;

            sheet.mergeCells(`A${currentRow}:E${currentRow}`);
            sheet.getCell(`A${currentRow}`).value = `Total Keseluruhan Penggunaan: ${totalAllM2} M²`;
            sheet.getCell(`A${currentRow}`).font = { bold: true };
            currentRow += 2;

            dataState.product_data.forEach((p) => {
                if (!p.rows || p.rows.length === 0) return;
                let no = 1;
                let calculatedTotal = 0;
                const rowsData = p.rows.map((r) => {
                    calculatedTotal += r.m2 || 0;
                    return [no++, r.p, r.l, r.qty, r.m2];
                });
                const finalTotal =
                    dataState.total_m2_product?.[p.name] !== undefined ? dataState.total_m2_product[p.name] : calculatedTotal;
                createTable(p.name, ["No", "P", "L", "Qty", "Total (M²)"], rowsData, "Total M²", finalTotal);
            });
        }

        if (hasQty) {
            sheet.mergeCells(`A${currentRow}:E${currentRow}`);
            sheet.getCell(`A${currentRow}`).value = `Merchandise Akrilik`;
            sheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };
            sheet.getCell(`A${currentRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE599" } };
            currentRow++;

            const qtyRows = dataState.data.map((item, index) => [index + 1, item.name, "-", "-", item.total_qty]);
            createTable(
                "Merchandise Akrilik",
                ["No", "Nama Produk", "-", "-", "Total Qty"],
                qtyRows,
                "Total Qty",
                dataState.data.reduce((sum, item) => sum + Number(item.total_qty || 0), 0)
            );
        }
    } else if (dataState.product_data && Array.isArray(dataState.product_data) && dataState.product_data[0]?.rows !== undefined) {
        const totalKey = Object.keys(dataState).find((key) => key.startsWith("total_all_m2"));
        const totalAllM2 = totalKey ? dataState[totalKey] : 0;

        sheet.mergeCells(`A${currentRow}:E${currentRow}`);
        sheet.getCell(`A${currentRow}`).value = `Total Keseluruhan Penggunaan: ${totalAllM2} M²`;
        sheet.getCell(`A${currentRow}`).font = { bold: true };
        currentRow += 2;

        dataState.product_data.forEach((p) => {
            if (!p.rows || p.rows.length === 0) return;
            let no = 1;
            let calculatedTotal = 0;
            const rowsData = p.rows.map((r) => {
                calculatedTotal += r.m2 || 0;
                return [no++, r.p, r.l, r.qty, r.m2];
            });
            const finalTotal = dataState.total_m2_product?.[p.name] !== undefined ? dataState.total_m2_product[p.name] : calculatedTotal;
            createTable(p.name, ["No", "P", "L", "Qty", "Total (M²)"], rowsData, "Total M²", finalTotal);
        });
    } else {
        let normalizedData = [];
        if (dataState.data && Array.isArray(dataState.data)) {
            normalizedData = dataState.data;
        } else if (dataState.product_data) {
            normalizedData = Array.isArray(dataState.product_data)
                ? dataState.product_data
                : Object.keys(dataState.product_data).map((key) => ({ name: key, total_qty: dataState.product_data[key] }));
        } else if (Array.isArray(dataState)) {
            normalizedData = dataState;
        } else if (typeof dataState === "object") {
            normalizedData = Object.keys(dataState).map((key) => ({ name: key, total_qty: dataState[key] }));
        }

        const totalQty =
            dataState.total_all_qty ?? dataState.total_all ?? normalizedData.reduce((acc, curr) => acc + (curr.total_qty || 0), 0);

        sheet.mergeCells(`A${currentRow}:E${currentRow}`);
        sheet.getCell(`A${currentRow}`).value = `Total Keseluruhan Qty: ${totalQty}`;
        sheet.getCell(`A${currentRow}`).font = { bold: true };
        currentRow += 2;

        let no = 1;
        const rowsData = normalizedData.map((item) => [no++, item.name, "-", "-", item.total_qty]);
        createTable("Data Qty", ["No", "Nama Produk", "-", "-", "Total Qty"], rowsData, "Total Qty", totalQty);
    }

    sheet.columns = [
        { key: "col1", width: 6 },
        { key: "col2", width: 25 },
        { key: "col3", width: 12 },
        { key: "col4", width: 12 },
        { key: "col5", width: 15 }
    ];

    const safeCategoryName = formattedCategory.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
    const fileName = `Laporan_Meteran_${safeCategoryName}_${startDate}_sd_${endDate}.xlsx`;
    await saveWorkbook(workbook, fileName);
};

export const createOrderBackupExcel = async ({ orders, store, date }) => {
    const workbook = await createWorkbook();
    const sheet = workbook.addWorksheet("Order");
    const dateLabel = `Tanggal order ${date} - data dari cache lokal`;
    const headerRow = generateExcelHeader(sheet, "H", "BACKUP ORDER", dateLabel, store);
    const styleHeader = (row) => {
        row.font = { bold: true };
        row.eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCE5FF" } };
            cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        });
    };
    styleHeader(sheet.addRow(["ID Order", "Nomor Nota", "Tanggal", "Pelanggan", "Operator", "Total", "Dibayar", "Sisa"]));

    const totalsFor = (order) => {
        const total = Number(order.total) || 0;
        const paid = order.total_paid == null ? null : Number(order.total_paid) || 0;
        const remaining = paid === null ? null : Math.max(0, Math.round((total - paid) * 100) / 100);
        return { total, paid, remaining };
    };
    for (const order of orders) {
        const { total, paid, remaining } = totalsFor(order);
        sheet.addRow([
            order.order_id,
            String(order.nomorator ?? ""),
            order.date,
            order.customer_name,
            order.operator || "-",
            total,
            paid,
            remaining
        ]);
    }
    sheet.columns.forEach((column, index) => {
        column.width = [12, 16, 22, 32, 22, 18, 18, 18][index];
        if (index >= 5) column.eachCell({ includeEmpty: false }, (cell) => formatMoneyCell(cell));
    });
    sheet.autoFilter = { from: `A${headerRow}`, to: `H${sheet.rowCount}` };

    const detail = workbook.addWorksheet("Detail Order");
    generateExcelHeader(detail, "G", "BACKUP DETAIL ORDER", dateLabel, store);
    detail.columns = [{ width: 6 }, { width: 45 }, { width: 25 }, { width: 14 }, { width: 10 }, { width: 18 }, { width: 18 }];
    for (const order of orders) {
        const titleRow = detail.addRow([`Order #${order.nomorator ?? ""} - ${order.customer_name || "-"} (${order.date || "-"})`]);
        detail.mergeCells(titleRow.number, 1, titleRow.number, 7);
        titleRow.font = { bold: true, size: 12 };
        titleRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE599" } };
        titleRow.getCell(1).alignment = { wrapText: true, vertical: "middle" };
        if (Array.isArray(order.items) && order.items.length) {
            styleHeader(detail.addRow(["No", "Nama Item", "Finishing", "Ukuran", "Qty", "Harga Satuan", "Jumlah"]));
            order.items.forEach((item, index) => {
                const name = [
                    item.judul,
                    item.variant_label ? `Varian: ${item.variant_label}` : "",
                    item.laser_material_name ? `Bahan: ${item.laser_material_name}` : ""
                ]
                    .filter(Boolean)
                    .join("\n");
                const row = detail.addRow([
                    index + 1,
                    name,
                    item.finishing_names || "-",
                    item.size || "-",
                    Number(item.quantity) || 0,
                    Number(item.unit) || 0,
                    Number(item.amount) || 0
                ]);
                row.eachCell((cell) => {
                    cell.alignment = { vertical: "middle", wrapText: true };
                    setCellBorder(cell);
                });
                formatMoneyCell(row.getCell(6));
                formatMoneyCell(row.getCell(7));
            });
        } else {
            const row = detail.addRow([
                Array.isArray(order.items) ? "Tidak ada item pada cache order ini." : "Rincian item belum tersedia di cache lokal."
            ]);
            detail.mergeCells(row.number, 1, row.number, 7);
            row.font = { italic: true };
        }
        const { total, paid, remaining } = totalsFor(order);
        for (const [label, value] of [
            ["Total Tagihan", total],
            ["Dibayar", paid],
            ["Sisa", remaining]
        ]) {
            const row = detail.addRow([label, null, null, null, null, null, value]);
            detail.mergeCells(row.number, 1, row.number, 6);
            row.getCell(1).alignment = { horizontal: "right" };
            formatMoneyCell(row.getCell(7));
            row.font = { bold: true };
        }
        if (paid === null) {
            const row = detail.addRow(["Pembayaran belum tersedia di cache lokal."]);
            detail.mergeCells(row.number, 1, row.number, 7);
            row.font = { italic: true };
        }
        detail.addRow([]);
    }
    return workbook.xlsx.writeBuffer();
};

export const createPaymentBackupExcel = async ({ payments, store, date }) => {
    const workbook = await createWorkbook();
    const sheet = workbook.addWorksheet("Pembayaran");
    const headerRow = generateExcelHeader(sheet, "H", "BACKUP PEMBAYARAN", `Tanggal pembayaran ${date} - data dari cache lokal`, store);
    const header = sheet.addRow(["ID Pembayaran", "ID Order", "Nomor Nota", "Pelanggan", "Tanggal Bayar", "Nominal", "Metode", "Status"]);
    header.font = { bold: true };
    header.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCE5FF" } };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    });
    let total = 0;
    for (const payment of payments) {
        const nominal = Number(payment.nominal) || 0;
        total += nominal;
        sheet.addRow([
            payment.payment_id,
            payment.order_id,
            String(payment.nomorator ?? ""),
            payment.customer_name || "-",
            payment.date,
            nominal,
            payment.payment_method || "-",
            payment.status || "-"
        ]);
    }
    sheet.autoFilter = { from: `A${headerRow}`, to: `H${sheet.rowCount}` };
    sheet.addRow([]);
    const totalRow = sheet.addRow(["Total Pembayaran", null, null, null, null, Math.round(total * 100) / 100]);
    sheet.mergeCells(totalRow.number, 1, totalRow.number, 5);
    totalRow.font = { bold: true };
    totalRow.getCell(1).alignment = { horizontal: "right" };
    sheet.columns.forEach((column, index) => {
        column.width = [18, 14, 18, 32, 23, 20, 16, 16][index];
        if (index === 5) column.eachCell({ includeEmpty: false }, (cell) => formatMoneyCell(cell));
    });
    return workbook.xlsx.writeBuffer();
};

export const exportTransaksiDetailExcel = async ({ orders, itemsByOrder, startDate, endDate }) => {
    if (!orders || orders.length === 0) return;

    const tanggal = startDate && endDate ? `Tanggal ${startDate} s.d. ${endDate}` : "Tanggal -";

    const workbook = await createWorkbook();
    const sheet = workbook.addWorksheet("Detail Transaksi");

    let currentRow = generateExcelHeader(sheet, "G", "LAPORAN DETAIL TRANSAKSI", tanggal);

    orders.forEach((order) => {
        sheet.mergeCells(`A${currentRow}:G${currentRow}`);
        const titleCell = sheet.getCell(`A${currentRow}`);
        titleCell.value = `Order #${order.nomorator} - ${order.customer_name} (${order.date})`;
        titleCell.font = { bold: true, size: 12 };
        titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE599" } };
        currentRow++;

        const columns = ["No", "Nama Item", "Finishing", "Ukuran", "Qty", "Satuan", "Jumlah"];
        const headerRow = sheet.addRow(columns);
        headerRow.font = { bold: true };
        styleTableRow(headerRow, { header: true });
        currentRow++;

        const rawItems = itemsByOrder[order.order_id] || [];
        let no = 1;

        rawItems.forEach((item) => {
            const row = sheet.addRow([
                no++,
                item.judul,
                item.finishing_names || "-",
                item.size || "-",
                item.quantity,
                Number(item.unit),
                Number(item.amount)
            ]);
            styleTableRow(row);
            row.getCell(2).alignment = { vertical: "middle", horizontal: "left" };
            formatMoneyCell(row.getCell(6));
            formatMoneyCell(row.getCell(7));
            currentRow++;
        });

        sheet.mergeCells(`A${currentRow}:F${currentRow}`);
        const labelCell = sheet.getCell(`A${currentRow}`);
        labelCell.value = "Total Tagihan";
        labelCell.alignment = { horizontal: "right", vertical: "middle" };
        labelCell.font = { bold: true };
        setCellBorder(labelCell);

        const totalCell = sheet.getCell(`G${currentRow}`);
        totalCell.value = Number(order.total);
        totalCell.font = { bold: true };
        totalCell.alignment = { horizontal: "center", vertical: "middle" };
        setCellBorder(totalCell);
        formatMoneyCell(totalCell);

        currentRow++;
        sheet.addRow([]);
        currentRow++;
    });

    sheet.columns = [
        { key: "col1", width: 6 },
        { key: "col2", width: 30 },
        { key: "col3", width: 20 },
        { key: "col4", width: 12 },
        { key: "col5", width: 8 },
        { key: "col6", width: 15 },
        { key: "col7", width: 15 }
    ];

    const fileName = `Laporan_Detail_Transaksi_${startDate}_sd_${endDate}.xlsx`;
    await saveWorkbook(workbook, fileName);
};

export const exportTransaksiHarianExcel = async ({ harianData, summary, startDate, endDate }) => {
    if (!harianData || harianData.length === 0) return;

    const tanggal = startDate && endDate ? `Tanggal ${startDate} s.d. ${endDate}` : "Tanggal -";

    const workbook = await createWorkbook();
    const sheet = workbook.addWorksheet("Transaksi Harian");

    let currentRow = generateExcelHeader(sheet, "F", "LAPORAN TRANSAKSI HARIAN", tanggal);

    const columns = ["No", "Nomorator", "Nama Konsumen", "Nominal", "Metode", "Status"];
    const headerRow = sheet.addRow(columns);
    headerRow.font = { bold: true };
    styleTableRow(headerRow, { header: true });
    currentRow++;

    harianData.forEach((row, index) => {
        const excelRow = sheet.addRow([
            index + 1,
            row.nomorator,
            row.customer_name,
            Number(row.nominal),
            row.payment_method,
            row.status_label
        ]);
        styleTableRow(excelRow);
        formatMoneyCell(excelRow.getCell(4));
        currentRow++;
    });

    currentRow += 2;
    sheet.getCell(`E${currentRow}`).value = "Total Cash:";
    sheet.getCell(`F${currentRow}`).value = Number(summary.total_cash);
    formatMoneyCell(sheet.getCell(`F${currentRow}`));
    currentRow++;

    sheet.getCell(`E${currentRow}`).value = "Total Transfer:";
    sheet.getCell(`F${currentRow}`).value = Number(summary.total_tf);
    formatMoneyCell(sheet.getCell(`F${currentRow}`));
    currentRow++;

    sheet.getCell(`E${currentRow}`).value = "Grand Total:";
    sheet.getCell(`F${currentRow}`).value = Number(summary.grand_total);
    sheet.getCell(`F${currentRow}`).font = { bold: true };
    formatMoneyCell(sheet.getCell(`F${currentRow}`));

    sheet.columns = [
        { key: "col1", width: 6 },
        { key: "col2", width: 15 },
        { key: "col3", width: 30 },
        { key: "col4", width: 15 },
        { key: "col5", width: 12 },
        { key: "col6", width: 15 }
    ];

    const fileName = `Laporan_Harian_${startDate}_sd_${endDate}.xlsx`;
    await saveWorkbook(workbook, fileName);
};

export const exportTransaksiBulananExcel = async ({ bulananData, summary, startDate, endDate }) => {
    if (!bulananData || bulananData.length === 0) return;

    const tanggal = startDate && endDate ? `Periode ${startDate} s.d. ${endDate}` : "Periode -";

    const workbook = await createWorkbook();
    const sheet = workbook.addWorksheet("Transaksi Bulanan");

    let currentRow = generateExcelHeader(sheet, "G", "LAPORAN TRANSAKSI BULANAN", tanggal);

    const columns = ["No", "Tanggal", "Jml Order", "Jml Transaksi", "CASH", "TRANSFER", "Total Nominal"];
    const headerRow = sheet.addRow(columns);
    headerRow.font = { bold: true };
    styleTableRow(headerRow, { header: true });
    currentRow++;

    bulananData.forEach((row, index) => {
        const excelRow = sheet.addRow([
            index + 1,
            row.tanggal,
            row.jumlah_order,
            row.jumlah_transaksi,
            Number(row.CASH),
            Number(row.TF),
            Number(row.total_nominal)
        ]);
        styleTableRow(excelRow);
        formatMoneyCell(excelRow.getCell(5));
        formatMoneyCell(excelRow.getCell(6));
        formatMoneyCell(excelRow.getCell(7));
        currentRow++;
    });

    currentRow += 2;
    sheet.getCell(`F${currentRow}`).value = "Total Cash:";
    sheet.getCell(`G${currentRow}`).value = Number(summary.total_cash);
    formatMoneyCell(sheet.getCell(`G${currentRow}`));
    currentRow++;

    sheet.getCell(`F${currentRow}`).value = "Total Transfer:";
    sheet.getCell(`G${currentRow}`).value = Number(summary.total_tf);
    formatMoneyCell(sheet.getCell(`G${currentRow}`));
    currentRow++;

    sheet.getCell(`F${currentRow}`).value = "Grand Total:";
    sheet.getCell(`G${currentRow}`).value = Number(summary.grand_total);
    sheet.getCell(`G${currentRow}`).font = { bold: true };
    formatMoneyCell(sheet.getCell(`G${currentRow}`));

    sheet.columns = [
        { key: "col1", width: 6 },
        { key: "col2", width: 15 },
        { key: "col3", width: 12 },
        { key: "col4", width: 15 },
        { key: "col5", width: 15 },
        { key: "col6", width: 15 },
        { key: "col7", width: 18 }
    ];

    const fileName = `Laporan_Bulanan_${startDate}_sd_${endDate}.xlsx`;
    await saveWorkbook(workbook, fileName);
};

export const exportTransaksiPerItemExcel = async ({ transaksiItemData, startDate, endDate }) => {
    if (!transaksiItemData || Object.keys(transaksiItemData).length === 0) return;

    const tanggal = startDate && endDate ? `Periode ${startDate} s.d. ${endDate}` : "Periode -";

    const workbook = await createWorkbook();
    const sheet = workbook.addWorksheet("Transaksi Per Item");

    let currentRow = generateExcelHeader(sheet, "I", "LAPORAN TRANSAKSI PER ITEM", tanggal);

    Object.entries(transaksiItemData).forEach(([namaProduk, daftarOrder]) => {
        sheet.mergeCells(`A${currentRow}:I${currentRow}`);
        const titleCell = sheet.getCell(`A${currentRow}`);
        titleCell.value = namaProduk;
        titleCell.font = { bold: true, size: 12 };
        titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE599" } };
        currentRow++;

        const columns = ["No", "Nomorator", "Nama", "Ukuran", "Finishing", "Harga Produk", "Qty", "Subtotal", "Tanggal"];
        const headerRow = sheet.addRow(columns);
        headerRow.font = { bold: true };
        styleTableRow(headerRow, { header: true });
        currentRow++;

        let totalSubtotal = 0;
        daftarOrder.forEach((row, index) => {
            totalSubtotal += Number(row.amount);
            const excelRow = sheet.addRow([
                index + 1,
                row.nomorator,
                row.customer_name,
                row.size || "-",
                row.finishing_names || "-",
                Number(row.price),
                row.quantity,
                Number(row.amount),
                formatTanggalId(row.date)
            ]);
            styleTableRow(excelRow);
            excelRow.getCell(3).alignment = { horizontal: "left" };
            formatMoneyCell(excelRow.getCell(6));
            formatMoneyCell(excelRow.getCell(8));
            currentRow++;
        });

        sheet.mergeCells(`A${currentRow}:G${currentRow}`);
        const labelCell = sheet.getCell(`A${currentRow}`);
        labelCell.value = "Total Subtotal Produk";
        labelCell.alignment = { horizontal: "right", vertical: "middle" };
        labelCell.font = { bold: true };
        setCellBorder(labelCell);

        const totalCell = sheet.getCell(`H${currentRow}`);
        totalCell.value = totalSubtotal;
        totalCell.font = { bold: true };
        totalCell.alignment = { horizontal: "center", vertical: "middle" };
        setCellBorder(totalCell);
        formatMoneyCell(totalCell);

        currentRow += 2;
    });

    sheet.columns = [
        { key: "col1", width: 6 },
        { key: "col2", width: 15 },
        { key: "col3", width: 25 },
        { key: "col4", width: 12 },
        { key: "col5", width: 15 },
        { key: "col6", width: 15 },
        { key: "col7", width: 8 },
        { key: "col8", width: 15 },
        { key: "col9", width: 15 }
    ];

    const fileName = `Laporan_Per_Item_${startDate}_sd_${endDate}.xlsx`;
    await saveWorkbook(workbook, fileName);
};

export const exportTransaksiPerKonsumenExcel = async ({ transaksiKonsumenData, startDate, endDate }) => {
    if (!transaksiKonsumenData || Object.keys(transaksiKonsumenData).length === 0) return;

    const tanggal = startDate && endDate ? `Periode ${startDate} s.d. ${endDate}` : "Periode -";

    const workbook = await createWorkbook();
    const sheet = workbook.addWorksheet("Transaksi Per Konsumen");

    let currentRow = generateExcelHeader(sheet, "I", "LAPORAN TRANSAKSI PER KONSUMEN", tanggal);

    Object.entries(transaksiKonsumenData).forEach(([namaKonsumen, daftarOrder]) => {
        sheet.mergeCells(`A${currentRow}:I${currentRow}`);
        const titleCell = sheet.getCell(`A${currentRow}`);
        titleCell.value = `Konsumen: ${namaKonsumen}`;
        titleCell.font = { bold: true, size: 12 };
        titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE599" } };
        currentRow++;

        const columns = ["No", "Nomorator", "Nama Item", "Ukuran", "Finishing", "Harga Produk", "Qty", "Subtotal", "Tanggal"];
        const headerRow = sheet.addRow(columns);
        headerRow.font = { bold: true };
        styleTableRow(headerRow, { header: true });
        currentRow++;

        let totalSubtotal = 0;
        daftarOrder.forEach((row, index) => {
            totalSubtotal += Number(row.amount);
            const excelRow = sheet.addRow([
                index + 1,
                row.nomorator,
                row.judul,
                row.size || "-",
                row.finishing_names || "-",
                Number(row.price),
                row.quantity,
                Number(row.amount),
                formatTanggalId(row.date)
            ]);

            styleTableRow(excelRow);
            excelRow.getCell(3).alignment = { horizontal: "left" };
            formatMoneyCell(excelRow.getCell(6));
            formatMoneyCell(excelRow.getCell(8));
            currentRow++;
        });

        sheet.mergeCells(`A${currentRow}:G${currentRow}`);
        const labelCell = sheet.getCell(`A${currentRow}`);
        labelCell.value = "Total Belanja Konsumen";
        labelCell.alignment = { horizontal: "right", vertical: "middle" };
        labelCell.font = { bold: true };
        setCellBorder(labelCell);

        const totalCell = sheet.getCell(`H${currentRow}`);
        totalCell.value = totalSubtotal;
        totalCell.font = { bold: true };
        totalCell.alignment = { horizontal: "center", vertical: "middle" };
        setCellBorder(totalCell);
        formatMoneyCell(totalCell);

        const emptyCell = sheet.getCell(`I${currentRow}`);
        setCellBorder(emptyCell);

        currentRow += 2;
    });

    sheet.columns = [
        { key: "col1", width: 6 },
        { key: "col2", width: 15 },
        { key: "col3", width: 30 },
        { key: "col4", width: 12 },
        { key: "col5", width: 15 },
        { key: "col6", width: 15 },
        { key: "col7", width: 8 },
        { key: "col8", width: 15 },
        { key: "col9", width: 15 }
    ];

    const fileName = `Laporan_Per_Konsumen_${startDate}_sd_${endDate}.xlsx`;
    await saveWorkbook(workbook, fileName);
};

export const exportStatistikKaryawanExcel = async ({ karyawanData, topPerformers, startDate, endDate }) => {
    if (!karyawanData || karyawanData.length === 0) return;

    const tanggal = startDate && endDate ? `Periode ${startDate} s.d. ${endDate}` : "Periode -";

    const workbook = await createWorkbook();
    const sheet = workbook.addWorksheet("Statistik Karyawan");

    let currentRow = generateExcelHeader(sheet, "F", "LAPORAN STATISTIK KINERJA KARYAWAN", tanggal);

    sheet.mergeCells(`A${currentRow}:F${currentRow}`);
    sheet.getCell(`A${currentRow}`).value = "RINGKASAN TOP PERFORMER";
    sheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };
    sheet.getCell(`A${currentRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE599" } };
    currentRow++;

    const summaryData = [
        [
            "Penerima Terbanyak",
            topPerformers.receiver?.receiver > 0 ? topPerformers.receiver.name : "-",
            topPerformers.receiver?.receiver > 0 ? `${topPerformers.receiver.receiver} Konsumen` : "-"
        ],
        [
            "Setting Terbanyak",
            topPerformers.setting?.setting > 0 ? topPerformers.setting.name : "-",
            topPerformers.setting?.setting > 0 ? `${topPerformers.setting.setting} Kali` : "-"
        ],
        [
            "Pengambilan Barang",
            topPerformers.pickup?.pickup > 0 ? topPerformers.pickup.name : "-",
            topPerformers.pickup?.pickup > 0 ? `${topPerformers.pickup.pickup} Kali` : "-"
        ],
        [
            "Omset Tertinggi",
            topPerformers.omset?.omset > 0 ? topPerformers.omset.name : "-",
            topPerformers.omset?.omset > 0 ? Number(topPerformers.omset.omset) : "-"
        ]
    ];

    summaryData.forEach((item) => {
        sheet.mergeCells(`A${currentRow}:B${currentRow}`);
        sheet.getCell(`A${currentRow}`).value = item[0];

        sheet.mergeCells(`C${currentRow}:D${currentRow}`);
        sheet.getCell(`C${currentRow}`).value = item[1];
        sheet.getCell(`C${currentRow}`).font = { bold: true };

        sheet.mergeCells(`E${currentRow}:F${currentRow}`);
        sheet.getCell(`E${currentRow}`).value = item[2];
        if (item[0] === "Omset Tertinggi" && typeof item[2] === "number") {
            formatMoneyCell(sheet.getCell(`E${currentRow}`), true);
        }
        currentRow++;
    });

    currentRow++;

    const columns = ["No", "Nama Karyawan", "Penerima Konsumen", "Setting", "Pengambilan Barang", "Total Omset"];
    const headerRow = sheet.addRow(columns);
    headerRow.font = { bold: true };
    styleTableRow(headerRow, { header: true });
    currentRow++;

    karyawanData.forEach((row, index) => {
        const excelRow = sheet.addRow([index + 1, row.name, row.receiver, row.setting, row.pickup, Number(row.omset)]);
        styleTableRow(excelRow);
        excelRow.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
        formatMoneyCell(excelRow.getCell(6));
        currentRow++;
    });

    sheet.columns = [
        { key: "col1", width: 6 },
        { key: "col2", width: 30 },
        { key: "col3", width: 22 },
        { key: "col4", width: 15 },
        { key: "col5", width: 22 },
        { key: "col6", width: 20 }
    ];

    const fileName = `Laporan_Statistik_Karyawan_${startDate}_sd_${endDate}.xlsx`;
    await saveWorkbook(workbook, fileName);
};

export const exportPiutangExcel = async ({ piutangData, totalPiutang }) => {
    if (!piutangData || piutangData.length === 0) return;

    const today = new Date().toISOString().split("T")[0];
    const tanggal = `Per Tanggal: ${today}`;

    const workbook = await createWorkbook();
    const sheet = workbook.addWorksheet("Laporan Piutang");

    let currentRow = generateExcelHeader(sheet, "G", "LAPORAN PIUTANG KONSUMEN", tanggal);

    const columns = ["No", "Nomorator", "Nama Konsumen", "Nomor HP", "Piutang", "Operator", "Tanggal"];
    const headerRow = sheet.addRow(columns);
    headerRow.font = { bold: true };
    styleTableRow(headerRow, { header: true });
    currentRow++;

    piutangData.forEach((row, index) => {
        const excelRow = sheet.addRow([
            index + 1,
            row.nomorator,
            row.nama,
            row.nomor || "-",
            Number(row.hutang),
            row.op_initial,
            formatTanggalId(row.date)
        ]);

        styleTableRow(excelRow);
        excelRow.getCell(3).alignment = { horizontal: "left", vertical: "middle" };
        formatMoneyCell(excelRow.getCell(5));
        excelRow.getCell(5).font = { color: { argb: "FFFF0000" }, bold: true };
        currentRow++;
    });

    sheet.mergeCells(`A${currentRow}:F${currentRow}`);
    const labelCell = sheet.getCell(`A${currentRow}`);
    labelCell.value = "Total Keseluruhan Piutang";
    labelCell.alignment = { horizontal: "right", vertical: "middle" };
    labelCell.font = { bold: true, size: 12 };
    setCellBorder(labelCell);

    const totalCell = sheet.getCell(`G${currentRow}`);
    totalCell.value = Number(totalPiutang);
    totalCell.font = { bold: true, size: 12, color: { argb: "FFFF0000" } };
    totalCell.alignment = { horizontal: "center", vertical: "middle" };
    setCellBorder(totalCell);
    formatMoneyCell(totalCell);

    sheet.columns = [
        { key: "col1", width: 6 },
        { key: "col2", width: 15 },
        { key: "col3", width: 30 },
        { key: "col4", width: 20 },
        { key: "col5", width: 20 },
        { key: "col6", width: 15 },
        { key: "col7", width: 20 }
    ];

    const fileName = `Laporan_Piutang_${today}.xlsx`;
    await saveWorkbook(workbook, fileName);
};

export const exportPemakaianBahanExcel = async ({ pemakaianBahanData, startDate, endDate }) => {
    if (!pemakaianBahanData || pemakaianBahanData.length === 0) return;

    const tanggal = startDate && endDate ? `Periode ${startDate} s.d. ${endDate}` : "Periode -";

    const workbook = await createWorkbook();
    const sheet = workbook.addWorksheet("Pemakaian Bahan");

    generateExcelHeader(sheet, "D", "LAPORAN PEMAKAIAN BAHAN", tanggal);

    const columns = ["No", "Nama Barang", "Satuan", "Total Pemakaian"];
    const headerRow = sheet.addRow(columns);
    headerRow.font = { bold: true };
    styleTableRow(headerRow, { header: true });

    pemakaianBahanData.forEach((row, index) => {
        const excelRow = sheet.addRow([index + 1, row.nama_barang, row.satuan, Number(row.total_pemakaian)]);

        styleTableRow(excelRow);

        excelRow.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
        excelRow.getCell(4).numFmt = "#,##0.####";
    });

    sheet.columns = [
        { key: "col1", width: 6 },
        { key: "col2", width: 45 },
        { key: "col3", width: 15 },
        { key: "col4", width: 20 }
    ];

    const fileName = `Laporan_Pemakaian_Bahan_${startDate}_sd_${endDate}.xlsx`;
    await saveWorkbook(workbook, fileName);
};

export const exportPelunasanExcel = async ({ pelunasanData, summary, startDate, endDate }) => {
    if (!pelunasanData || pelunasanData.length === 0) return;

    const tanggal = startDate && endDate ? `Periode ${startDate} s.d. ${endDate}` : "Periode -";

    const workbook = await createWorkbook();
    const sheet = workbook.addWorksheet("Laporan Pelunasan");

    let currentRow = generateExcelHeader(sheet, "I", "LAPORAN PELUNASAN", tanggal);

    const columns = [
        "No",
        "Nomorator",
        "Nama Konsumen",
        "Nominal DP",
        "Metode DP",
        "Tanggal DP",
        "Nominal Lunas",
        "Metode Lunas",
        "Tanggal Pelunasan"
    ];

    const headerRow = sheet.addRow(columns);
    headerRow.font = { bold: true };
    styleTableRow(headerRow, { header: true });
    currentRow++;

    pelunasanData.forEach((row, index) => {
        const excelRow = sheet.addRow([
            index + 1,
            row.nomorator,
            row.customer_name,
            row.dp_nominal ? Number(row.dp_nominal) : "-",
            row.dp_method || "-",
            row.dp_date !== "-" ? row.dp_date : "-",
            Number(row.nominal),
            row.payment_method || "-",
            row.payment_date || "-"
        ]);

        styleTableRow(excelRow);

        excelRow.getCell(3).alignment = { horizontal: "left", vertical: "middle" };

        if (row.dp_nominal) formatMoneyCell(excelRow.getCell(4));
        formatMoneyCell(excelRow.getCell(7));

        currentRow++;
    });

    currentRow += 2;

    sheet.mergeCells(`G${currentRow}:H${currentRow}`);
    const labelCash = sheet.getCell(`G${currentRow}`);
    labelCash.value = "Total CASH (Pelunasan):";
    labelCash.alignment = { horizontal: "right", vertical: "middle" };
    sheet.getCell(`I${currentRow}`).value = Number(summary.total_cash);
    formatMoneyCell(sheet.getCell(`I${currentRow}`));
    currentRow++;

    sheet.mergeCells(`G${currentRow}:H${currentRow}`);
    const labelTf = sheet.getCell(`G${currentRow}`);
    labelTf.value = "Total TF (Pelunasan):";
    labelTf.alignment = { horizontal: "right", vertical: "middle" };
    sheet.getCell(`I${currentRow}`).value = Number(summary.total_tf);
    formatMoneyCell(sheet.getCell(`I${currentRow}`));
    currentRow++;

    sheet.mergeCells(`G${currentRow}:H${currentRow}`);
    const labelGrand = sheet.getCell(`G${currentRow}`);
    labelGrand.value = "Grand Total (Pelunasan):";
    labelGrand.alignment = { horizontal: "right", vertical: "middle" };
    labelGrand.font = { bold: true };

    const valGrand = sheet.getCell(`I${currentRow}`);
    valGrand.value = Number(summary.grand_total);
    formatMoneyCell(valGrand);
    valGrand.font = { bold: true };

    sheet.columns = [
        { key: "col1", width: 6 },
        { key: "col2", width: 15 },
        { key: "col3", width: 30 },
        { key: "col4", width: 18 },
        { key: "col5", width: 12 },
        { key: "col6", width: 18 },
        { key: "col7", width: 18 },
        { key: "col8", width: 15 },
        { key: "col9", width: 18 }
    ];

    const fileName = `Laporan_Pelunasan_${startDate}_sd_${endDate}.xlsx`;
    await saveWorkbook(workbook, fileName);
};

export const exportOmsetPerItemExcel = async ({ omsetItemData, totalOmsetKeseluruhan, startDate, endDate }) => {
    if (!omsetItemData || omsetItemData.length === 0) return;

    const tanggal = startDate && endDate ? `Periode ${startDate} s.d. ${endDate}` : "Periode -";

    const workbook = await createWorkbook();
    const sheet = workbook.addWorksheet("Omset Per Item");

    let currentRow = generateExcelHeader(sheet, "E", "LAPORAN OMSET PER ITEM", tanggal);

    const columns = ["No", "Nama Barang", "Satuan", "Total Terjual", "Total Omset"];
    const headerRow = sheet.addRow(columns);
    headerRow.font = { bold: true };
    styleTableRow(headerRow, { header: true });
    currentRow++;

    omsetItemData.forEach((row, index) => {
        const excelRow = sheet.addRow([index + 1, row.nama_barang, row.satuan || "-", Number(row.total_terjual), Number(row.total_omset)]);

        styleTableRow(excelRow);

        excelRow.getCell(2).alignment = { horizontal: "left", vertical: "middle" };

        excelRow.getCell(4).numFmt = "#,##0.##";
        formatMoneyCell(excelRow.getCell(5));

        currentRow++;
    });

    sheet.mergeCells(`A${currentRow}:D${currentRow}`);
    const labelTotal = sheet.getCell(`A${currentRow}`);
    labelTotal.value = "Total Keseluruhan Omset";
    labelTotal.alignment = { horizontal: "right", vertical: "middle" };
    labelTotal.font = { bold: true, size: 12 };
    setCellBorder(labelTotal);

    const valueTotal = sheet.getCell(`E${currentRow}`);
    valueTotal.value = Number(totalOmsetKeseluruhan);
    valueTotal.font = { bold: true, size: 12, color: { argb: "FFFF0000" } };
    valueTotal.alignment = { horizontal: "center", vertical: "middle" };
    setCellBorder(valueTotal);
    formatMoneyCell(valueTotal);

    sheet.columns = [
        { key: "col1", width: 6 },
        { key: "col2", width: 45 },
        { key: "col3", width: 15 },
        { key: "col4", width: 20 },
        { key: "col5", width: 25 }
    ];

    const fileName = `Laporan_Omset_Per_Item_${startDate}_sd_${endDate}.xlsx`;
    await saveWorkbook(workbook, fileName);
};

export const exportKeuanganExcel = async ({ financeData, expenditureData, expenditureCategories = [], incomeData, startDate, endDate }) => {
    if (!financeData?.length && !expenditureData?.length && !incomeData?.length) return;

    const tanggal = startDate && endDate ? `Periode ${startDate} s.d. ${endDate}` : "Periode -";

    const workbook = await createWorkbook();
    const sheet = workbook.addWorksheet("Laporan Keuangan");

    let currentRow = generateExcelHeader(sheet, "I", "LAPORAN KEUANGAN", tanggal);

    sheet.mergeCells(`A${currentRow}:I${currentRow}`);
    const titleFinance = sheet.getCell(`A${currentRow}`);
    titleFinance.value = "REKAP KEUANGAN";
    titleFinance.font = { bold: true, size: 12 };
    titleFinance.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE599" } };
    currentRow++;

    const financeCols = [
        "No",
        "Tanggal",
        "Omset Offline",
        "Omset Online",
        "Total Omset",
        "Transfer Masuk",
        "Cash Masuk",
        "Pengeluaran",
        "Saldo Cash"
    ];
    const headerRow1 = sheet.addRow(financeCols);
    headerRow1.font = { bold: true };
    styleTableRow(headerRow1, { header: true });
    currentRow++;

    (financeData || []).forEach((row, index) => {
        const excelRow = sheet.addRow([
            index + 1,
            formatTanggalId(row.date),
            Number(row.omset_offline),
            Number(row.omset_online),
            Number(row.total_omset),
            Number(row.transfer),
            Number(row.cash_masuk),
            Number(row.expenditure),
            Number(row.saldo)
        ]);

        styleTableRow(excelRow);

        for (let c = 3; c <= 9; c++) {
            formatMoneyCell(excelRow.getCell(c));
        }

        excelRow.getCell(5).font = { bold: true, color: { argb: "FF1565C0" } };
        excelRow.getCell(8).font = { color: { argb: "FFFF0000" } };

        const saldoCell = excelRow.getCell(9);
        saldoCell.font = { bold: true, color: { argb: row.saldo < 0 ? "FFFF0000" : "FF2E7D32" } };

        currentRow++;
    });

    currentRow += 2;

    sheet.mergeCells(`A${currentRow}:D${currentRow}`);
    const titleExp = sheet.getCell(`A${currentRow}`);
    titleExp.value = "DATA PENGELUARAN";
    titleExp.font = { bold: true, size: 11, color: { argb: "FFFF0000" } };
    titleExp.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE599" } };

    sheet.mergeCells(`F${currentRow}:I${currentRow}`);
    const titleInc = sheet.getCell(`F${currentRow}`);
    titleInc.value = "DATA PEMASUKAN TAMBAHAN";
    titleInc.font = { bold: true, size: 11, color: { argb: "FF2E7D32" } };
    titleInc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE599" } };
    currentRow++;

    const bottomHeaderRow = sheet.addRow(["No", "Tanggal", "Keterangan", "Nominal", "", "No", "Tanggal", "Keterangan", "Nominal"]);

    bottomHeaderRow.font = { bold: true };
    [1, 2, 3, 4, 6, 7, 8, 9].forEach((colIndex) => {
        const cell = bottomHeaderRow.getCell(colIndex);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCE5FF" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        setCellBorder(cell);
    });
    currentRow++;

    const expData = expenditureData || [];
    const incData = incomeData || [];
    const maxRows = Math.max(expData.length, incData.length);

    let totalExp = 0;
    let totalInc = 0;

    for (let i = 0; i < maxRows; i++) {
        const exp = expData[i];
        const inc = incData[i];

        if (exp) totalExp += Number(exp.nominal);
        if (inc) totalInc += Number(inc.nominal);

        const rowData = [
            exp ? i + 1 : "",
            exp ? formatTanggalId(exp.date) : "",
            exp ? exp.information : "",
            exp ? Number(exp.nominal) : "",
            "",
            inc ? i + 1 : "",
            inc ? inc.date : "",
            inc ? inc.information : "",
            inc ? Number(inc.nominal) : ""
        ];

        const dataRow = sheet.addRow(rowData);

        if (exp) {
            [1, 2, 3, 4].forEach((c) => {
                const cell = dataRow.getCell(c);
                setCellBorder(cell);
                cell.alignment = { vertical: "middle", horizontal: c === 3 ? "left" : "center" };
            });
            formatMoneyCell(dataRow.getCell(4));
            dataRow.getCell(4).font = { color: { argb: "FFFF0000" } };
        }

        if (inc) {
            [6, 7, 8, 9].forEach((c) => {
                const cell = dataRow.getCell(c);
                setCellBorder(cell);
                cell.alignment = { vertical: "middle", horizontal: c === 8 ? "left" : "center" };
            });
            formatMoneyCell(dataRow.getCell(9));
            dataRow.getCell(9).font = { color: { argb: "FF2E7D32" } };
        }
        currentRow++;
    }

    sheet.mergeCells(`A${currentRow}:C${currentRow}`);
    const labelTotalExp = sheet.getCell(`A${currentRow}`);
    labelTotalExp.value = "Total Pengeluaran";
    labelTotalExp.alignment = { horizontal: "right", vertical: "middle" };
    labelTotalExp.font = { bold: true };
    setCellBorder(labelTotalExp);

    const valExp = sheet.getCell(`D${currentRow}`);
    valExp.value = totalExp;
    formatMoneyCell(valExp);
    valExp.font = { bold: true, color: { argb: "FFFF0000" } };
    setCellBorder(valExp);

    sheet.mergeCells(`F${currentRow}:H${currentRow}`);
    const labelTotalInc = sheet.getCell(`F${currentRow}`);
    labelTotalInc.value = "Total Pemasukan Tambahan";
    labelTotalInc.alignment = { horizontal: "right", vertical: "middle" };
    labelTotalInc.font = { bold: true };
    setCellBorder(labelTotalInc);

    const valInc = sheet.getCell(`I${currentRow}`);
    valInc.value = totalInc;
    formatMoneyCell(valInc);
    valInc.font = { bold: true, color: { argb: "FF2E7D32" } };
    setCellBorder(valInc);

    sheet.columns = [
        { key: "col1", width: 6 },
        { key: "col2", width: 15 },
        { key: "col3", width: 25 },
        { key: "col4", width: 18 },
        { key: "col5", width: 18 },
        { key: "col6", width: 15 },
        { key: "col7", width: 15 },
        { key: "col8", width: 25 },
        { key: "col9", width: 18 }
    ];

    const groups = new Map();
    expData.forEach((exp) => {
        const categoryId = String(exp.expenditure_category_id ?? "");
        const categoryName =
            categoryId === "0"
                ? "Lainnya"
                : exp.expenditure_category_name ||
                  expenditureCategories.find((category) => String(category.value) === categoryId)?.label ||
                  (categoryId ? `Kategori #${categoryId}` : "Tanpa kategori");
        const key = categoryId || categoryName;
        if (!groups.has(key)) groups.set(key, { name: categoryName, rows: [] });
        groups.get(key).rows.push(exp);
    });

    const styleCategoryRow = (row, bold = false, color = null) => {
        row.eachCell({ includeEmpty: true }, (cell, column) => {
            cell.font = { bold };
            cell.alignment = { vertical: "middle", horizontal: column === 4 ? "right" : "left", wrapText: true };
            cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
            if (color) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
        });
        formatMoneyCell(row.getCell(4));
    };

    const usedSheetNames = new Set(workbook.worksheets.map((item) => item.name.toLowerCase()));
    [...groups.values()]
        .sort((a, b) => a.name.localeCompare(b.name, "id"))
        .forEach((group) => {
            const baseName =
                group.name
                    .replace(/[/\\?*[\]:]/g, " ")
                    .trim()
                    .replace(/^'+|'+$/g, "") || "Kategori";
            let sheetName = baseName.slice(0, 31).replace(/'+$/g, "");
            let suffix = 2;
            while (usedSheetNames.has(sheetName.toLowerCase()) || sheetName.toLowerCase() === "history") {
                const ending = ` (${suffix++})`;
                sheetName = baseName.slice(0, 31 - ending.length) + ending;
            }
            usedSheetNames.add(sheetName.toLowerCase());
            const categorySheet = workbook.addWorksheet(sheetName);
            let categoryRow = generateExcelHeader(categorySheet, "D", "LAPORAN PENGELUARAN", tanggal);
            categorySheet.columns = [{ width: 7 }, { width: 18 }, { width: 55 }, { width: 22 }];
            categorySheet.pageSetup = { orientation: "portrait", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
            categorySheet.mergeCells(`A${categoryRow}:D${categoryRow}`);
            const heading = categorySheet.getCell(`A${categoryRow}`);
            heading.value = group.name;
            heading.font = { bold: true, size: 12 };
            heading.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE599" } };
            heading.alignment = { wrapText: true, vertical: "middle" };
            categorySheet.getRow(categoryRow).height = 28;
            categoryRow++;
            const columns = categorySheet.getRow(categoryRow++);
            columns.values = ["No", "Tanggal", "Keterangan", "Nominal"];
            styleCategoryRow(columns, true, "FFCCE5FF");

            let subtotal = 0;
            group.rows.forEach((exp, index) => {
                const nominal = Number(exp.nominal) || 0;
                subtotal += nominal;
                const row = categorySheet.getRow(categoryRow++);
                row.values = [index + 1, formatTanggalId(exp.date), exp.information || "-", nominal];
                styleCategoryRow(row);
            });
            const totalRow = categorySheet.getRow(categoryRow);
            totalRow.values = [`Total ${group.name}`, "", "", subtotal];
            styleCategoryRow(totalRow, true, "FFF2F2F2");
            categorySheet.mergeCells(`A${categoryRow}:C${categoryRow}`);
        });

    const fileName = `Laporan_Keuangan_${startDate}_sd_${endDate}.xlsx`;
    await saveWorkbook(workbook, fileName);
};

export const exportMaklunExcel = async ({ maklunMasuk, maklunKeluar, startDate, endDate }) => {
    if (!maklunMasuk?.length && !maklunKeluar?.length) return;

    const tanggal = startDate && endDate ? `Periode ${startDate} s.d. ${endDate}` : "Periode -";

    const workbook = await createWorkbook();

    const branches = new Set();
    (maklunMasuk || []).forEach((item) => {
        if (item.branch_name) branches.add(item.branch_name);
    });
    (maklunKeluar || []).forEach((item) => {
        if (item.branch_name) branches.add(item.branch_name);
    });

    const branchList = Array.from(branches);

    if (branchList.length === 0) {
        branchList.push("Semua Cabang");
    }

    const groupAndSortData = (data) => {
        const grouped = data.reduce((acc, item) => {
            const category = item.category || "Tanpa Kategori";
            if (!acc[category]) acc[category] = [];
            acc[category].push(item);
            return acc;
        }, {});

        Object.keys(grouped).forEach((category) => {
            grouped[category].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
        });

        return grouped;
    };

    branchList.forEach((branchName, branchIndex) => {
        const safeSheetName = branchName.replace(/[/\\?*[\]:]/g, "").substring(0, 31);
        const sheet = workbook.addWorksheet(safeSheetName);

        const filteredMasuk = (maklunMasuk || []).filter(
            (item) => item.branch_name === branchName || (branchName === "Semua Cabang" && !item.branch_name)
        );
        const filteredKeluar = (maklunKeluar || []).filter(
            (item) => item.branch_name === branchName || (branchName === "Semua Cabang" && !item.branch_name)
        );

        const groupedMasuk = groupAndSortData(filteredMasuk);
        const groupedKeluar = groupAndSortData(filteredKeluar);

        let currentRow = generateExcelHeader(sheet, "I", `LAPORAN MAKLUN - ${branchName.toUpperCase()}`, tanggal);

        const addTotal = (label, value, color, italic = false) => {
            sheet.mergeCells(`A${currentRow}:G${currentRow}`);
            const labelCell = sheet.getCell(`A${currentRow}`);
            labelCell.value = label;
            labelCell.alignment = { horizontal: "center", vertical: "middle" };
            labelCell.font = { bold: true, ...(italic ? { italic: true } : {}) };
            setCellBorder(labelCell);

            const valueCell = sheet.getCell(`H${currentRow}`);
            valueCell.value = value;
            formatMoneyCell(valueCell);
            valueCell.alignment = { horizontal: "center", vertical: "middle" };
            valueCell.font = { bold: true, color: { argb: color } };
            setCellBorder(valueCell);
            setCellBorder(sheet.getCell(`I${currentRow}`));
        };

        const addSection = (direction, grouped, color, branchHeading) => {
            sheet.mergeCells(`A${currentRow}:I${currentRow}`);
            const title = sheet.getCell(`A${currentRow}`);
            title.value = `MAKLUN ${direction.toUpperCase()}`;
            title.alignment = { horizontal: "center", vertical: "middle" };
            title.font = { bold: true, size: 12, color: { argb: color } };
            title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE599" } };
            currentRow++;
            let total = 0;

            Object.entries(grouped).forEach(([category, items], categoryIndex) => {
                sheet.mergeCells(`A${currentRow}:I${currentRow}`);
                const categoryTitle = sheet.getCell(`A${currentRow}`);
                categoryTitle.value = `Kategori: ${category}`;
                categoryTitle.alignment = { horizontal: "center", vertical: "middle" };
                categoryTitle.font = { bold: true, italic: true };
                categoryTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
                currentRow++;
                let subtotal = 0;
                const rows = items.map((item, index) => {
                    const amount = Number(item.jumlah_harga_calc) || 0;
                    subtotal += amount;
                    total += amount;
                    return [
                        index + 1,
                        formatTanggalId(item.date) || "-",
                        item.judul || "-",
                        item.size || "-",
                        item.finishing_names || "-",
                        Number(item.quantity) || 0,
                        Number(item.harga_satuan_calc) || 0,
                        amount,
                        item.branch_name || "-"
                    ];
                });
                sheet.addTable({
                    name: `Table${direction}_${branchIndex}_${categoryIndex}`,
                    ref: `A${currentRow}`,
                    headerRow: true,
                    style: { theme: "TableStyleLight9", showRowStripes: true },
                    columns: ["No", "Tanggal", "Nama", "Ukuran", "Finishing", "Qty", "Harga Satuan", "Jumlah", branchHeading].map(
                        (name) => ({ name, filterButton: true })
                    ),
                    rows
                });
                for (let index = 0; index <= rows.length; index++) {
                    const row = sheet.getRow(currentRow + index);
                    if (index === 0) row.font = { bold: true };
                    styleTableRow(row, { header: index === 0 });
                    if (index > 0) {
                        row.getCell(6).numFmt = "#,##0";
                        formatMoneyCell(row.getCell(7));
                        formatMoneyCell(row.getCell(8));
                        row.getCell(8).font = { bold: true, color: { argb: color } };
                    }
                }
                currentRow += rows.length + 1;
                addTotal(`Subtotal ${category}`, subtotal, color, true);
                currentRow += 2;
            });
            if (Object.keys(grouped).length === 0) {
                sheet.mergeCells(`A${currentRow}:I${currentRow}`);
                const emptyCell = sheet.getCell(`A${currentRow}`);
                emptyCell.value = `Tidak ada data Maklun ${direction} untuk cabang ini.`;
                emptyCell.alignment = { horizontal: "center", vertical: "middle" };
                setCellBorder(emptyCell);
                currentRow++;
            }
            addTotal(`Total Keseluruhan Maklun ${direction}`, total, color);
        };

        addSection("Masuk", groupedMasuk, "FF1565C0", "Dari Cabang");
        currentRow += 4;
        addSection("Keluar", groupedKeluar, "FFFF0000", "Ke Cabang");

        sheet.columns = [
            { key: "col1", width: 6 },
            { key: "col2", width: 15 },
            { key: "col3", width: 25 },
            { key: "col4", width: 10 },
            { key: "col5", width: 20 },
            { key: "col6", width: 10 },
            { key: "col7", width: 15 },
            { key: "col8", width: 18 },
            { key: "col9", width: 25 }
        ];
    });

    const fileName = `Laporan_Maklun_Per_Cabang_${startDate}_sd_${endDate}.xlsx`;
    await saveWorkbook(workbook, fileName);
};

export const exportFailureExcel = async ({ failures, startDate, endDate }) => {
    if (!failures || failures.length === 0) return;

    const tanggal = startDate && endDate ? `Periode ${startDate} s.d. ${endDate}` : "Periode -";

    const workbook = await createWorkbook();
    const sheet = workbook.addWorksheet("Laporan Kegagalan");

    let currentRow = generateExcelHeader(sheet, "N", "LAPORAN KEGAGALAN PRODUKSI", tanggal);

    sheet.mergeCells(`A${currentRow}:N${currentRow}`);
    const titleTab = sheet.getCell(`A${currentRow}`);
    titleTab.value = "DATA KEGAGALAN (REJECT)";
    titleTab.font = { bold: true, size: 12, color: { argb: "FFFF0000" } };
    titleTab.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE599" } };
    currentRow++;

    const headerCols = [
        "No",
        "Tanggal",
        "Nomorator",
        "Customer",
        "Operator",
        "Mesin",
        "Judul",
        "Ukuran",
        "Qty",
        "Finishing",
        "Detail Gagal",
        "Kerugian",
        "Beban",
        "Keterangan"
    ];

    const headerRow = sheet.addRow(headerCols);
    headerRow.font = { bold: true };
    styleTableRow(headerRow, { header: true });
    currentRow++;

    let totalLoss = 0;

    failures.forEach((row, index) => {
        const kerugian = Number(row.total_loss) || 0;
        totalLoss += kerugian;

        const detailGagalClean = (row.detail_gagal || "-").replace(/<br\s*[/]?>/gi, "\n");

        const excelRow = sheet.addRow([
            index + 1,
            row.formatted_date || "-",
            row.nomorator || "-",
            row.customer_name || "-",
            row.operator_name || "-",
            row.nama_mesin || "-",
            row.judul || "-",
            row.size || "-",
            Number(row.quantity) || 0,
            row.finishing_names_str || "-",
            detailGagalClean,
            kerugian,
            row.loss_burden || "-",
            row.info || "-"
        ]);

        styleTableRow(excelRow, { wrapText: true });

        excelRow.getCell(4).alignment = { vertical: "middle", horizontal: "left", wrapText: true };
        excelRow.getCell(7).alignment = { vertical: "middle", horizontal: "left", wrapText: true };
        excelRow.getCell(11).alignment = { vertical: "middle", horizontal: "left", wrapText: true };
        excelRow.getCell(14).alignment = { vertical: "middle", horizontal: "left", wrapText: true };

        excelRow.getCell(9).numFmt = "#,##0";
        formatMoneyCell(excelRow.getCell(12));
        excelRow.getCell(12).font = { color: { argb: "FFFF0000" } };

        currentRow++;
    });

    sheet.mergeCells(`A${currentRow}:K${currentRow}`);
    const labelTotal = sheet.getCell(`A${currentRow}`);
    labelTotal.value = "Total Nominal Kerugian Produksi";
    labelTotal.alignment = { horizontal: "right", vertical: "middle" };
    labelTotal.font = { bold: true };
    setCellBorder(labelTotal);

    const valTotal = sheet.getCell(`L${currentRow}`);
    valTotal.value = totalLoss;
    formatMoneyCell(valTotal);
    valTotal.font = { bold: true, color: { argb: "FFFF0000" } };
    setCellBorder(valTotal);

    sheet.getCell(`M${currentRow}`).border = { top: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
    sheet.getCell(`N${currentRow}`).border = { top: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };

    sheet.columns = [
        { key: "col1", width: 5 },
        { key: "col2", width: 15 },
        { key: "col3", width: 12 },
        { key: "col4", width: 22 },
        { key: "col5", width: 18 },
        { key: "col6", width: 20 },
        { key: "col7", width: 25 },
        { key: "col8", width: 12 },
        { key: "col9", width: 8 },
        { key: "col10", width: 22 },
        { key: "col11", width: 45 },
        { key: "col12", width: 15 },
        { key: "col13", width: 15 },
        { key: "col14", width: 30 }
    ];

    const fileName = `Laporan_Kegagalan_Produksi_${startDate}_sd_${endDate}.xlsx`;
    await saveWorkbook(workbook, fileName);
};

export const exportGlobalStocksToExcel = async ({ groupedStocks, month }) => {
    if (!groupedStocks || Object.keys(groupedStocks).length === 0) return;

    const tanggal = month ? `Periode Bulan: ${month}` : "Periode -";

    const workbook = await createWorkbook();
    const sheet = workbook.addWorksheet("Laporan Global Stock");

    const endColLetter = "BL";

    let currentRow = generateExcelHeader(sheet, endColLetter, "LAPORAN GLOBAL STOCK BULANAN", tanggal);

    sheet.mergeCells(`A${currentRow}:${endColLetter}${currentRow}`);
    const titleTab = sheet.getCell(`A${currentRow}`);
    titleTab.value = "REKAPITULASI PERGERAKAN STOK GLOBAL (MASUK & KELUAR)";
    titleTab.font = { bold: true, size: 12, color: { argb: "FF002060" } };
    titleTab.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
    titleTab.alignment = { vertical: "middle", horizontal: "center" };
    currentRow++;

    const headerRow1 = ["No", "Item & Ukuran", "Stok Awal"];
    const headerRow2 = ["", "", ""];

    const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);
    daysInMonth.forEach((day) => {
        headerRow1.push(`Tgl ${day}`, "");
        headerRow2.push("M", "K");
    });
    headerRow1.push("Stok Akhir");
    headerRow2.push("");

    const r1 = sheet.addRow(headerRow1);
    r1.font = { bold: true };
    r1.alignment = { horizontal: "center", vertical: "middle" };

    const r2 = sheet.addRow(headerRow2);
    r2.font = { bold: true };
    r2.alignment = { horizontal: "center", vertical: "middle" };

    sheet.mergeCells(`A${currentRow}:A${currentRow + 1}`);
    sheet.mergeCells(`B${currentRow}:B${currentRow + 1}`);
    sheet.mergeCells(`C${currentRow}:C${currentRow + 1}`);

    let colIndex = 4;
    daysInMonth.forEach(() => {
        const startColLet = sheet.getColumn(colIndex).letter;
        const endColLet = sheet.getColumn(colIndex + 1).letter;
        sheet.mergeCells(`${startColLet}${currentRow}:${endColLet}${currentRow}`);
        colIndex += 2;
    });

    const lastColLet = sheet.getColumn(colIndex).letter;
    sheet.mergeCells(`${lastColLet}${currentRow}:${lastColLet}${currentRow + 1}`);

    [r1, r2].forEach((row) => {
        styleTableRow(row, { header: true, wrapText: true, includeEmpty: true });
    });

    currentRow += 2;

    let globalIndex = 1;

    Object.keys(groupedStocks).forEach((categoryName) => {
        sheet.mergeCells(`A${currentRow}:${endColLetter}${currentRow}`);
        const catRow = sheet.getCell(`A${currentRow}`);
        catRow.value = `KATEGORI: ${categoryName.toUpperCase()}`;
        catRow.font = { bold: true, size: 11, color: { argb: "FF000000" } };
        catRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
        catRow.alignment = { vertical: "middle", horizontal: "left" };

        for (let i = 1; i <= 64; i++) {
            setCellBorder(sheet.getCell(currentRow, i));
        }
        currentRow++;

        const categoryProducts = groupedStocks[categoryName];

        Object.keys(categoryProducts).forEach((productName) => {
            const variations = categoryProducts[productName];

            Object.keys(variations).forEach((idKey) => {
                const item = variations[idKey];
                const itemNameSize = `${item.name}${item.size && item.size !== "-" ? ` (${item.size})` : ""}`;

                const rowData = [globalIndex++, itemNameSize, Number(item.sa_awal) || 0];

                daysInMonth.forEach((day) => {
                    const daily = item.daily?.[day] || {};
                    rowData.push(Number(daily.sm) || 0);
                    rowData.push(Number(daily.sk) || 0);
                });

                rowData.push(Number(item.sa_akhir) || 0);

                const excelRow = sheet.addRow(rowData);

                excelRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    setCellBorder(cell);
                    cell.alignment = { vertical: "middle", horizontal: colNumber === 2 ? "left" : "center", wrapText: true };
                });

                formatStockCell(excelRow.getCell(3));
                excelRow.getCell(3).font = { bold: true, color: { argb: "FF002060" } };

                let currC = 4;
                daysInMonth.forEach(() => {
                    formatStockCell(excelRow.getCell(currC));
                    excelRow.getCell(currC).font = { color: { argb: "FF375623" } };

                    formatStockCell(excelRow.getCell(currC + 1));
                    excelRow.getCell(currC + 1).font = { color: { argb: "FFC00000" } };
                    currC += 2;
                });

                formatStockCell(excelRow.getCell(currC));
                excelRow.getCell(currC).font = { bold: true, color: { argb: "FF703AD0" } };

                currentRow++;
            });
        });
    });

    sheet.getColumn(1).width = 5;
    sheet.getColumn(2).width = 30;
    sheet.getColumn(3).width = 12;

    for (let i = 4; i <= 63; i++) {
        sheet.getColumn(i).width = 5;
    }
    sheet.getColumn(64).width = 12;

    const fileName = `Laporan_Global_Stock_${month}.xlsx`;
    await saveWorkbook(workbook, fileName);
};
