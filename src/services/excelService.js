import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { authStore } from "./session";

export const generateExcelHeader = (sheet, endColLetter, reportTitle, dateString) => {
    const session = authStore.getUser();
    const storeName = session?.store?.name ?? 'Mgo Store';
    const storeAddress = session?.store?.address ?? 'Cicaheum';
    sheet.mergeCells(`A1:${endColLetter}1`);
    sheet.getCell("A1").value = storeName || "NAMA TOKO";
    sheet.getCell("A1").alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getCell("A1").font = { bold: true, size: 16 };

    sheet.mergeCells(`A2:${endColLetter}2`);
    sheet.getCell("A2").value = storeAddress || "-";
    sheet.getCell("A2").alignment = { vertical: 'middle', horizontal: 'center' };

    sheet.addRow([]);
    
    sheet.mergeCells(`A4:${endColLetter}4`);
    sheet.getCell("A4").value = reportTitle;
    sheet.getCell("A4").alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getCell("A4").font = { bold: true, size: 14 };

    sheet.mergeCells(`A5:${endColLetter}5`);
    sheet.getCell("A5").value = dateString;
    sheet.getCell("A5").alignment = { vertical: 'middle', horizontal: 'center' };

    sheet.addRow([]);

    return 7;
};

export const exportMeteranExcel = async ({
    dataState,
    category,
    startDate,
    endDate
}) => {
    if (!dataState) return;

    const formattedCategory = category
        .replace("meter_", "")
        .split("_")
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join("_");

    const categoryTitle = formattedCategory.replace("_", " ");
    const tanggal = (startDate && endDate) ? `Tanggal ${startDate} s.d. ${endDate}` : 'Tanggal -';
    
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(formattedCategory);

    let currentRow = generateExcelHeader(
        sheet, 
        "E", 
        `Laporan Penggunaan Bahan - ${categoryTitle.toUpperCase()}`, 
        tanggal
    );

    const createTable = (title, columns, rowsData, totalLabel, totalValue) => {
        sheet.mergeCells(`A${currentRow}:E${currentRow}`);
        const titleCell = sheet.getCell(`A${currentRow}`);
        titleCell.value = title;
        titleCell.font = { bold: true, size: 12 };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE599' } };
        currentRow++;

        const headerRow = sheet.addRow(columns);
        headerRow.font = { bold: true };
        headerRow.eachCell({ includeEmpty: false }, cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCE5FF' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = {
                top: { style: 'thin' }, left: { style: 'thin' },
                bottom: { style: 'thin' }, right: { style: 'thin' }
            };
        });
        currentRow++;

        rowsData.forEach(rowData => {
            const row = sheet.addRow(rowData);
            row.eachCell({ includeEmpty: false }, cell => {
                cell.border = {
                    top: { style: 'thin' }, left: { style: 'thin' },
                    bottom: { style: 'thin' }, right: { style: 'thin' }
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });
            if (rowData[1] && isNaN(rowData[1]) && isNaN(parseFloat(rowData[1]))) {
                row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
            }
            currentRow++;
        });

        sheet.mergeCells(`A${currentRow}:D${currentRow}`);
        const labelCell = sheet.getCell(`A${currentRow}`);
        labelCell.value = totalLabel;
        labelCell.alignment = { horizontal: 'right', vertical: 'middle' };
        labelCell.font = { bold: true };
        labelCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

        const totalCell = sheet.getCell(`E${currentRow}`);
        totalCell.value = totalValue;
        totalCell.font = { bold: true };
        totalCell.alignment = { horizontal: 'center', vertical: 'middle' };
        totalCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        
        if (typeof totalValue === 'number') {
            totalCell.numFmt = '#,##0.00';
        }
        currentRow++;

        sheet.addRow([]);
        currentRow++;
    };

    if (dataState.meteran !== undefined || dataState.kiloan !== undefined) {
        if (dataState.meteran && dataState.meteran.length > 0) {
            dataState.meteran.forEach(p => {
                if (!p.rows || p.rows.length === 0) return;
                let no = 1;
                let totalM2 = 0;
                const rowsData = p.rows.map(r => {
                    totalM2 += (r.m2 || 0);
                    return [no++, r.p, r.l, r.qty, r.m2];
                });
                createTable(`Meteran - ${p.name}`, ['No', 'P', 'L', 'Qty', 'Total (M²)'], rowsData, 'Total M²', totalM2);
            });
        }
        if (dataState.kiloan && dataState.kiloan.length > 0) {
            dataState.kiloan.forEach(p => {
                if (!p.rows || p.rows.length === 0) return;
                let no = 1;
                let totalKg = 0;
                const rowsData = p.rows.map(r => {
                    totalKg += (r.kg_total || 0);
                    return [no++, `${r.kg} Kg`, '-', r.qty, r.kg_total];
                });
                createTable(`Kiloan - ${p.name}`, ['No', 'Berat (Kg)', '-', 'Qty', 'Total (Kg)'], rowsData, 'Total Kg', totalKg);
            });
        }
    } else if (dataState.total_panjang_dtf !== undefined) {
        sheet.mergeCells(`A${currentRow}:E${currentRow}`);
        sheet.getCell(`A${currentRow}`).value = `Total Panjang DTF: ${dataState.total_panjang_dtf || 0} | Total Panjang DTF UV: ${dataState.total_panjang_dtf_uv || 0}`;
        sheet.getCell(`A${currentRow}`).font = { bold: true };
        currentRow += 2;

        (dataState.product_data || []).forEach(p => {
            if (!p.rows || p.rows.length === 0) return;
            let no = 1;
            let total = 0;
            const title = `${p.name} ${p.isUV ? '(UV)' : ''}`.trim();
            const rowsData = p.rows.map(r => {
                total += (r.total || 0);
                return [no++, p.isA3 || p.isUV_A3 ? "A3" : r.p, '-', r.qty, r.total];
            });
            createTable(title, ['No', 'Panjang / Tipe', '-', 'Qty', 'Total'], rowsData, 'Total', total);
        });
    } else if (dataState.product_data && Array.isArray(dataState.product_data) && dataState.product_data[0]?.rows !== undefined) {
        const totalKey = Object.keys(dataState).find(key => key.startsWith("total_all_m2"));
        const totalAllM2 = totalKey ? dataState[totalKey] : 0;
        
        sheet.mergeCells(`A${currentRow}:E${currentRow}`);
        sheet.getCell(`A${currentRow}`).value = `Total Keseluruhan Penggunaan: ${totalAllM2} M²`;
        sheet.getCell(`A${currentRow}`).font = { bold: true };
        currentRow += 2;

        dataState.product_data.forEach(p => {
            if (!p.rows || p.rows.length === 0) return;
            let no = 1;
            let calculatedTotal = 0;
            const rowsData = p.rows.map(r => {
                calculatedTotal += (r.m2 || 0);
                return [no++, r.p, r.l, r.qty, r.m2];
            });
            const finalTotal = dataState.total_m2_product?.[p.name] !== undefined ? dataState.total_m2_product[p.name] : calculatedTotal;
            createTable(p.name, ['No', 'P', 'L', 'Qty', 'Total (M²)'], rowsData, 'Total M²', finalTotal);
        });
    } else {
        let normalizedData = [];
        if (dataState.data && Array.isArray(dataState.data)) {
            normalizedData = dataState.data;
        } else if (dataState.product_data) {
            normalizedData = Array.isArray(dataState.product_data) ? dataState.product_data : Object.keys(dataState.product_data).map(key => ({
                name: key,
                total_qty: dataState.product_data[key]
            }));
        } else if (Array.isArray(dataState)) {
            normalizedData = dataState;
        } else if (typeof dataState === "object") {
            normalizedData = Object.keys(dataState).map(key => ({
                name: key,
                total_qty: dataState[key]
            }));
        }

        const totalQty = dataState.total_all_qty ?? dataState.total_all ?? normalizedData.reduce((acc, curr) => acc + (curr.total_qty || 0), 0);

        sheet.mergeCells(`A${currentRow}:E${currentRow}`);
        sheet.getCell(`A${currentRow}`).value = `Total Keseluruhan Qty: ${totalQty}`;
        sheet.getCell(`A${currentRow}`).font = { bold: true };
        currentRow += 2;

        let no = 1;
        const rowsData = normalizedData.map(item => [no++, item.name, '-', '-', item.total_qty]);
        createTable("Data Qty", ['No', 'Nama Produk', '-', '-', 'Total Qty'], rowsData, 'Total Qty', totalQty);
    }

    sheet.columns = [
        { key: 'col1', width: 6 },
        { key: 'col2', width: 25 },
        { key: 'col3', width: 12 },
        { key: 'col4', width: 12 },
        { key: 'col5', width: 15 }
    ];

    const fileName = `Laporan_Meteran_${formattedCategory}_${startDate}_sd_${endDate}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), fileName);
};

export const exportTransaksiDetailExcel = async ({
    orders,
    itemsByOrder,
    startDate,
    endDate
}) => {
    if (!orders || orders.length === 0) return;

    const tanggal = (startDate && endDate) ? `Tanggal ${startDate} s.d. ${endDate}` : 'Tanggal -';
    
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Detail Transaksi");

    let currentRow = generateExcelHeader(
        sheet, 
        "G", 
        "LAPORAN DETAIL TRANSAKSI", 
        tanggal
    );

    orders.forEach(order => {
        sheet.mergeCells(`A${currentRow}:G${currentRow}`);
        const titleCell = sheet.getCell(`A${currentRow}`);
        titleCell.value = `Order #${order.nomorator} - ${order.customer_name} (${order.date})`;
        titleCell.font = { bold: true, size: 12 };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE599' } };
        currentRow++;

        const columns = ['No', 'Nama Item', 'Finishing', 'Ukuran', 'Qty', 'Satuan', 'Jumlah'];
        const headerRow = sheet.addRow(columns);
        headerRow.font = { bold: true };
        headerRow.eachCell({ includeEmpty: false }, cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCE5FF' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
        currentRow++;

        const rawItems = itemsByOrder[order.order_id] || [];
        let no = 1;

        rawItems.forEach(item => {
            const row = sheet.addRow([
                no++,
                item.judul,
                item.finishing_names || "-",
                item.size || "-",
                item.quantity,
                Number(item.unit),
                Number(item.amount)
            ]);
            row.eachCell({ includeEmpty: false }, cell => {
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });
            row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
            row.getCell(6).numFmt = '#,##0';
            row.getCell(7).numFmt = '#,##0';
            currentRow++;
        });

        sheet.mergeCells(`A${currentRow}:F${currentRow}`);
        const labelCell = sheet.getCell(`A${currentRow}`);
        labelCell.value = "Total Tagihan";
        labelCell.alignment = { horizontal: 'right', vertical: 'middle' };
        labelCell.font = { bold: true };
        labelCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

        const totalCell = sheet.getCell(`G${currentRow}`);
        totalCell.value = Number(order.total);
        totalCell.font = { bold: true };
        totalCell.alignment = { horizontal: 'center', vertical: 'middle' };
        totalCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        totalCell.numFmt = '#,##0';
        
        currentRow++;
        sheet.addRow([]);
        currentRow++;
    });

    sheet.columns = [
        { key: 'col1', width: 6 },
        { key: 'col2', width: 30 },
        { key: 'col3', width: 20 },
        { key: 'col4', width: 12 },
        { key: 'col5', width: 8 },
        { key: 'col6', width: 15 },
        { key: 'col7', width: 15 }
    ];

    const fileName = `Laporan_Detail_Transaksi_${startDate}_sd_${endDate}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), fileName);
};

export const exportTransaksiHarianExcel = async ({
    harianData,
    summary,
    startDate,
    endDate
}) => {
    if (!harianData || harianData.length === 0) return;

    const tanggal = (startDate && endDate) ? `Tanggal ${startDate} s.d. ${endDate}` : 'Tanggal -';
    
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Transaksi Harian");

    let currentRow = generateExcelHeader(
        sheet, 
        "F", 
        "LAPORAN TRANSAKSI HARIAN", 
        tanggal
    );

    const columns = ['No', 'Nomorator', 'Nama Konsumen', 'Nominal', 'Metode', 'Status'];
    const headerRow = sheet.addRow(columns);
    headerRow.font = { bold: true };
    headerRow.eachCell({ includeEmpty: false }, cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCE5FF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
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
        excelRow.eachCell({ includeEmpty: false }, cell => {
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
        excelRow.getCell(4).numFmt = '#,##0';
        currentRow++;
    });

    currentRow += 2;
    sheet.getCell(`E${currentRow}`).value = "Total Cash:";
    sheet.getCell(`F${currentRow}`).value = Number(summary.total_cash);
    sheet.getCell(`F${currentRow}`).numFmt = '#,##0';
    currentRow++;

    sheet.getCell(`E${currentRow}`).value = "Total Transfer:";
    sheet.getCell(`F${currentRow}`).value = Number(summary.total_tf);
    sheet.getCell(`F${currentRow}`).numFmt = '#,##0';
    currentRow++;

    sheet.getCell(`E${currentRow}`).value = "Grand Total:";
    sheet.getCell(`F${currentRow}`).value = Number(summary.grand_total);
    sheet.getCell(`F${currentRow}`).font = { bold: true };
    sheet.getCell(`F${currentRow}`).numFmt = '#,##0';

    sheet.columns = [
        { key: 'col1', width: 6 },
        { key: 'col2', width: 15 },
        { key: 'col3', width: 30 },
        { key: 'col4', width: 15 },
        { key: 'col5', width: 12 },
        { key: 'col6', width: 15 }
    ];

    const fileName = `Laporan_Harian_${startDate}_sd_${endDate}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), fileName);
};

export const exportTransaksiBulananExcel = async ({
    bulananData,
    summary,
    startDate,
    endDate
}) => {
    if (!bulananData || bulananData.length === 0) return;

    const tanggal = (startDate && endDate) ? `Periode ${startDate} s.d. ${endDate}` : 'Periode -';
    
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Transaksi Bulanan");

    let currentRow = generateExcelHeader(
        sheet, 
        "G", 
        "LAPORAN TRANSAKSI BULANAN", 
        tanggal
    );

    const columns = ['No', 'Tanggal', 'Jml Order', 'Jml Transaksi', 'CASH', 'TRANSFER', 'Total Nominal'];
    const headerRow = sheet.addRow(columns);
    headerRow.font = { bold: true };
    headerRow.eachCell({ includeEmpty: false }, cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCE5FF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
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
        excelRow.eachCell({ includeEmpty: false }, cell => {
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
        excelRow.getCell(5).numFmt = '#,##0';
        excelRow.getCell(6).numFmt = '#,##0';
        excelRow.getCell(7).numFmt = '#,##0';
        currentRow++;
    });

    currentRow += 2;
    sheet.getCell(`F${currentRow}`).value = "Total Cash:";
    sheet.getCell(`G${currentRow}`).value = Number(summary.total_cash);
    sheet.getCell(`G${currentRow}`).numFmt = '#,##0';
    currentRow++;

    sheet.getCell(`F${currentRow}`).value = "Total Transfer:";
    sheet.getCell(`G${currentRow}`).value = Number(summary.total_tf);
    sheet.getCell(`G${currentRow}`).numFmt = '#,##0';
    currentRow++;

    sheet.getCell(`F${currentRow}`).value = "Grand Total:";
    sheet.getCell(`G${currentRow}`).value = Number(summary.grand_total);
    sheet.getCell(`G${currentRow}`).font = { bold: true };
    sheet.getCell(`G${currentRow}`).numFmt = '#,##0';

    sheet.columns = [
        { key: 'col1', width: 6 },
        { key: 'col2', width: 15 },
        { key: 'col3', width: 12 },
        { key: 'col4', width: 15 },
        { key: 'col5', width: 15 },
        { key: 'col6', width: 15 },
        { key: 'col7', width: 18 }
    ];

    const fileName = `Laporan_Bulanan_${startDate}_sd_${endDate}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), fileName);
};

export const exportTransaksiPerItemExcel = async ({
    transaksiItemData,
    startDate,
    endDate
}) => {
    if (!transaksiItemData || Object.keys(transaksiItemData).length === 0) return;

    const tanggal = (startDate && endDate) ? `Periode ${startDate} s.d. ${endDate}` : 'Periode -';
    
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Transaksi Per Item");

    let currentRow = generateExcelHeader(
        sheet, 
        "I", 
        "LAPORAN TRANSAKSI PER ITEM", 
        tanggal
    );

    Object.entries(transaksiItemData).forEach(([namaProduk, daftarOrder]) => {
        sheet.mergeCells(`A${currentRow}:I${currentRow}`);
        const titleCell = sheet.getCell(`A${currentRow}`);
        titleCell.value = namaProduk;
        titleCell.font = { bold: true, size: 12 };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE599' } };
        currentRow++;

        const columns = ['No', 'Nomorator', 'Nama', 'Ukuran', 'Finishing', 'Harga Produk', 'Qty', 'Subtotal', 'Tanggal'];
        const headerRow = sheet.addRow(columns);
        headerRow.font = { bold: true };
        headerRow.eachCell({ includeEmpty: false }, cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCE5FF' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
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
                row.date
            ]);
            excelRow.eachCell({ includeEmpty: false }, cell => {
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });
            excelRow.getCell(3).alignment = { horizontal: 'left' }; 
            excelRow.getCell(6).numFmt = '#,##0'; 
            excelRow.getCell(8).numFmt = '#,##0'; 
            currentRow++;
        });

        sheet.mergeCells(`A${currentRow}:G${currentRow}`);
        const labelCell = sheet.getCell(`A${currentRow}`);
        labelCell.value = "Total Subtotal Produk";
        labelCell.alignment = { horizontal: 'right', vertical: 'middle' };
        labelCell.font = { bold: true };
        labelCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

        const totalCell = sheet.getCell(`H${currentRow}`);
        totalCell.value = totalSubtotal;
        totalCell.font = { bold: true };
        totalCell.alignment = { horizontal: 'center', vertical: 'middle' };
        totalCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        totalCell.numFmt = '#,##0';
        
        currentRow += 2;
    });

    sheet.columns = [
        { key: 'col1', width: 6 },
        { key: 'col2', width: 15 },
        { key: 'col3', width: 25 },
        { key: 'col4', width: 12 },
        { key: 'col5', width: 15 },
        { key: 'col6', width: 15 },
        { key: 'col7', width: 8 },
        { key: 'col8', width: 15 },
        { key: 'col9', width: 15 }
    ];

    const fileName = `Laporan_Per_Item_${startDate}_sd_${endDate}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), fileName);
};

export const exportTransaksiPerKonsumenExcel = async ({
    transaksiKonsumenData,
    startDate,
    endDate
}) => {
    if (!transaksiKonsumenData || Object.keys(transaksiKonsumenData).length === 0) return;

    const tanggal = (startDate && endDate) ? `Periode ${startDate} s.d. ${endDate}` : 'Periode -';
    
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Transaksi Per Konsumen");


    let currentRow = generateExcelHeader(
        sheet, 
        "I", 
        "LAPORAN TRANSAKSI PER KONSUMEN", 
        tanggal
    );


    Object.entries(transaksiKonsumenData).forEach(([namaKonsumen, daftarOrder]) => {

        sheet.mergeCells(`A${currentRow}:I${currentRow}`);
        const titleCell = sheet.getCell(`A${currentRow}`);
        titleCell.value = `Konsumen: ${namaKonsumen}`;
        titleCell.font = { bold: true, size: 12 };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE599' } };
        currentRow++;

        const columns = ['No', 'Nomorator', 'Nama Item', 'Ukuran', 'Finishing', 'Harga Produk', 'Qty', 'Subtotal', 'Tanggal'];
        const headerRow = sheet.addRow(columns);
        headerRow.font = { bold: true };
        headerRow.eachCell({ includeEmpty: false }, cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCE5FF' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
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
                row.date
            ]);
            
            excelRow.eachCell({ includeEmpty: false }, cell => {
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });
            excelRow.getCell(3).alignment = { horizontal: 'left' };
            excelRow.getCell(6).numFmt = '#,##0';
            excelRow.getCell(8).numFmt = '#,##0'; 
            currentRow++;
        });

        sheet.mergeCells(`A${currentRow}:G${currentRow}`);
        const labelCell = sheet.getCell(`A${currentRow}`);
        labelCell.value = "Total Belanja Konsumen";
        labelCell.alignment = { horizontal: 'right', vertical: 'middle' };
        labelCell.font = { bold: true };
        labelCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

        const totalCell = sheet.getCell(`H${currentRow}`);
        totalCell.value = totalSubtotal;
        totalCell.font = { bold: true };
        totalCell.alignment = { horizontal: 'center', vertical: 'middle' };
        totalCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        totalCell.numFmt = '#,##0';

        const emptyCell = sheet.getCell(`I${currentRow}`);
        emptyCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

        currentRow += 2; 
    });

    sheet.columns = [
        { key: 'col1', width: 6 },
        { key: 'col2', width: 15 },
        { key: 'col3', width: 30 },
        { key: 'col4', width: 12 },
        { key: 'col5', width: 15 },
        { key: 'col6', width: 15 },
        { key: 'col7', width: 8 },
        { key: 'col8', width: 15 },
        { key: 'col9', width: 15 }
    ];

    const fileName = `Laporan_Per_Konsumen_${startDate}_sd_${endDate}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), fileName);
};

export const exportStatistikKaryawanExcel = async ({
    karyawanData,
    topPerformers,
    startDate,
    endDate
}) => {
    if (!karyawanData || karyawanData.length === 0) return;

    const tanggal = (startDate && endDate) ? `Periode ${startDate} s.d. ${endDate}` : 'Periode -';
    
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Statistik Karyawan");

    let currentRow = generateExcelHeader(
        sheet, 
        "F", 
        "LAPORAN STATISTIK KINERJA KARYAWAN", 
        tanggal
    );

    sheet.mergeCells(`A${currentRow}:F${currentRow}`);
    sheet.getCell(`A${currentRow}`).value = "RINGKASAN TOP PERFORMER";
    sheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };
    sheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE599' } };
    currentRow++;

    const summaryData = [
        ["Penerima Terbanyak", topPerformers.receiver?.receiver > 0 ? topPerformers.receiver.name : "-", topPerformers.receiver?.receiver > 0 ? `${topPerformers.receiver.receiver} Konsumen` : "-"],
        ["Setting Terbanyak", topPerformers.setting?.setting > 0 ? topPerformers.setting.name : "-", topPerformers.setting?.setting > 0 ? `${topPerformers.setting.setting} Kali` : "-"],
        ["Pengambilan Barang", topPerformers.pickup?.pickup > 0 ? topPerformers.pickup.name : "-", topPerformers.pickup?.pickup > 0 ? `${topPerformers.pickup.pickup} Kali` : "-"],
        ["Omset Tertinggi", topPerformers.omset?.omset > 0 ? topPerformers.omset.name : "-", topPerformers.omset?.omset > 0 ? Number(topPerformers.omset.omset) : "-"]
    ];

    summaryData.forEach(item => {
        sheet.mergeCells(`A${currentRow}:B${currentRow}`);
        sheet.getCell(`A${currentRow}`).value = item[0];
        
        sheet.mergeCells(`C${currentRow}:D${currentRow}`);
        sheet.getCell(`C${currentRow}`).value = item[1];
        sheet.getCell(`C${currentRow}`).font = { bold: true };
        
        sheet.mergeCells(`E${currentRow}:F${currentRow}`);
        sheet.getCell(`E${currentRow}`).value = item[2];
        if (item[0] === "Omset Tertinggi" && typeof item[2] === "number") {
            sheet.getCell(`E${currentRow}`).numFmt = 'Rp #,##0';
        }
        currentRow++;
    });

    currentRow++;

    const columns = ['No', 'Nama Karyawan', 'Penerima Konsumen', 'Setting', 'Pengambilan Barang', 'Total Omset'];
    const headerRow = sheet.addRow(columns);
    headerRow.font = { bold: true };
    headerRow.eachCell({ includeEmpty: false }, cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCE5FF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
    currentRow++;

    karyawanData.forEach((row, index) => {
        const excelRow = sheet.addRow([
            index + 1,
            row.name,
            row.receiver,
            row.setting,
            row.pickup,
            Number(row.omset)
        ]);
        excelRow.eachCell({ includeEmpty: false }, cell => {
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
        excelRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' }; 
        excelRow.getCell(6).numFmt = '#,##0'; 
        currentRow++;
    });

    sheet.columns = [
        { key: 'col1', width: 6 },
        { key: 'col2', width: 30 },
        { key: 'col3', width: 22 },
        { key: 'col4', width: 15 },
        { key: 'col5', width: 22 },
        { key: 'col6', width: 20 }
    ];

    const fileName = `Laporan_Statistik_Karyawan_${startDate}_sd_${endDate}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), fileName);
};

export const exportPiutangExcel = async ({
    piutangData,
    totalPiutang
}) => {
    if (!piutangData || piutangData.length === 0) return;

    const today = new Date().toISOString().split("T")[0];
    const tanggal = `Per Tanggal: ${today}`;
    
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Laporan Piutang");

    let currentRow = generateExcelHeader(
        sheet, 
        "G", 
        "LAPORAN PIUTANG KONSUMEN", 
        tanggal
    );

    const columns = ['No', 'Nomorator', 'Nama Konsumen', 'Nomor HP', 'Piutang', 'Operator', 'Tanggal'];
    const headerRow = sheet.addRow(columns);
    headerRow.font = { bold: true };
    headerRow.eachCell({ includeEmpty: false }, cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCE5FF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
    currentRow++;

    piutangData.forEach((row, index) => {
        const excelRow = sheet.addRow([
            index + 1,
            row.nomorator,
            row.nama,
            row.nomor || "-",
            Number(row.hutang),
            row.op_initial,
            row.date
        ]);
        
        excelRow.eachCell({ includeEmpty: false }, cell => {
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
        excelRow.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
        excelRow.getCell(5).numFmt = '#,##0';
        excelRow.getCell(5).font = { color: { argb: 'FFFF0000' }, bold: true }; 
        currentRow++;
    });

    sheet.mergeCells(`A${currentRow}:F${currentRow}`);
    const labelCell = sheet.getCell(`A${currentRow}`);
    labelCell.value = "Total Keseluruhan Piutang";
    labelCell.alignment = { horizontal: 'right', vertical: 'middle' };
    labelCell.font = { bold: true, size: 12 };
    labelCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

    const totalCell = sheet.getCell(`G${currentRow}`);
    totalCell.value = Number(totalPiutang);
    totalCell.font = { bold: true, size: 12, color: { argb: 'FFFF0000' } };
    totalCell.alignment = { horizontal: 'center', vertical: 'middle' };
    totalCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    totalCell.numFmt = '#,##0';

    sheet.columns = [
        { key: 'col1', width: 6 },
        { key: 'col2', width: 15 },
        { key: 'col3', width: 30 },
        { key: 'col4', width: 20 },
        { key: 'col5', width: 20 },
        { key: 'col6', width: 15 },
        { key: 'col7', width: 20 }
    ];

    const fileName = `Laporan_Piutang_${today}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), fileName);
};

export const exportPemakaianBahanExcel = async ({
    pemakaianBahanData,
    startDate,
    endDate
}) => {
    if (!pemakaianBahanData || pemakaianBahanData.length === 0) return;

    const tanggal = (startDate && endDate) ? `Periode ${startDate} s.d. ${endDate}` : 'Periode -';
    
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Pemakaian Bahan");

    let currentRow = generateExcelHeader(
        sheet, 
        "D", 
        "LAPORAN PEMAKAIAN BAHAN", 
        tanggal
    );

    const columns = ['No', 'Nama Barang', 'Satuan', 'Total Pemakaian'];
    const headerRow = sheet.addRow(columns);
    headerRow.font = { bold: true };
    headerRow.eachCell({ includeEmpty: false }, cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCE5FF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
    currentRow++;

    pemakaianBahanData.forEach((row, index) => {
        const excelRow = sheet.addRow([
            index + 1,
            row.nama_barang,
            row.satuan,
            Number(row.total_pemakaian)
        ]);
        
        excelRow.eachCell({ includeEmpty: false }, cell => {
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
        
        excelRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
        excelRow.getCell(4).numFmt = '#,##0.####'; 
        currentRow++;
    });

    sheet.columns = [
        { key: 'col1', width: 6 },
        { key: 'col2', width: 45 },
        { key: 'col3', width: 15 },
        { key: 'col4', width: 20 }
    ];

    const fileName = `Laporan_Pemakaian_Bahan_${startDate}_sd_${endDate}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), fileName);
};

export const exportPelunasanExcel = async ({
    pelunasanData,
    summary,
    startDate,
    endDate
}) => {
    if (!pelunasanData || pelunasanData.length === 0) return;

    const tanggal = (startDate && endDate) ? `Periode ${startDate} s.d. ${endDate}` : 'Periode -';
    
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Laporan Pelunasan");

    let currentRow = generateExcelHeader(
        sheet, 
        "I", 
        "LAPORAN PELUNASAN", 
        tanggal
    );

    const columns = [
        'No', 'Nomorator', 'Nama Konsumen', 
        'Nominal DP', 'Metode DP', 'Tanggal DP', 
        'Nominal Lunas', 'Metode Lunas', 'Tanggal Pelunasan'
    ];
    
    const headerRow = sheet.addRow(columns);
    headerRow.font = { bold: true };
    headerRow.eachCell({ includeEmpty: false }, cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCE5FF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
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
        
        excelRow.eachCell({ includeEmpty: false }, cell => {
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        excelRow.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
        
        if (row.dp_nominal) excelRow.getCell(4).numFmt = '#,##0';
        excelRow.getCell(7).numFmt = '#,##0'; 
        
        currentRow++;
    });

    currentRow += 2;
    
    sheet.mergeCells(`G${currentRow}:H${currentRow}`);
    const labelCash = sheet.getCell(`G${currentRow}`);
    labelCash.value = "Total CASH (Pelunasan):";
    labelCash.alignment = { horizontal: 'right', vertical: 'middle' };
    sheet.getCell(`I${currentRow}`).value = Number(summary.total_cash);
    sheet.getCell(`I${currentRow}`).numFmt = '#,##0';
    currentRow++;

    sheet.mergeCells(`G${currentRow}:H${currentRow}`);
    const labelTf = sheet.getCell(`G${currentRow}`);
    labelTf.value = "Total TF (Pelunasan):";
    labelTf.alignment = { horizontal: 'right', vertical: 'middle' };
    sheet.getCell(`I${currentRow}`).value = Number(summary.total_tf);
    sheet.getCell(`I${currentRow}`).numFmt = '#,##0';
    currentRow++;

    sheet.mergeCells(`G${currentRow}:H${currentRow}`);
    const labelGrand = sheet.getCell(`G${currentRow}`);
    labelGrand.value = "Grand Total (Pelunasan):";
    labelGrand.alignment = { horizontal: 'right', vertical: 'middle' };
    labelGrand.font = { bold: true };
    
    const valGrand = sheet.getCell(`I${currentRow}`);
    valGrand.value = Number(summary.grand_total);
    valGrand.numFmt = '#,##0';
    valGrand.font = { bold: true };

    sheet.columns = [
        { key: 'col1', width: 6 },
        { key: 'col2', width: 15 },
        { key: 'col3', width: 30 },
        { key: 'col4', width: 18 },
        { key: 'col5', width: 12 },
        { key: 'col6', width: 18 },
        { key: 'col7', width: 18 },
        { key: 'col8', width: 15 },
        { key: 'col9', width: 18 }
    ];

    const fileName = `Laporan_Pelunasan_${startDate}_sd_${endDate}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), fileName);
};

export const exportOmsetPerItemExcel = async ({
    omsetItemData,
    totalOmsetKeseluruhan,
    startDate,
    endDate
}) => {
    if (!omsetItemData || omsetItemData.length === 0) return;

    const tanggal = (startDate && endDate) ? `Periode ${startDate} s.d. ${endDate}` : 'Periode -';
    
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Omset Per Item");

    let currentRow = generateExcelHeader(
        sheet, 
        "E", 
        "LAPORAN OMSET PER ITEM", 
        tanggal
    );

    const columns = ['No', 'Nama Barang', 'Satuan', 'Total Terjual', 'Total Omset'];
    const headerRow = sheet.addRow(columns);
    headerRow.font = { bold: true };
    headerRow.eachCell({ includeEmpty: false }, cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCE5FF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
    currentRow++;

    omsetItemData.forEach((row, index) => {
        const excelRow = sheet.addRow([
            index + 1,
            row.nama_barang,
            row.satuan || "-",
            Number(row.total_terjual),
            Number(row.total_omset)
        ]);
        
        excelRow.eachCell({ includeEmpty: false }, cell => {
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
        
        excelRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
        
        excelRow.getCell(4).numFmt = '#,##0.##'; 
        excelRow.getCell(5).numFmt = '#,##0'; 
        
        currentRow++;
    });

    sheet.mergeCells(`A${currentRow}:D${currentRow}`);
    const labelTotal = sheet.getCell(`A${currentRow}`);
    labelTotal.value = "Total Keseluruhan Omset";
    labelTotal.alignment = { horizontal: 'right', vertical: 'middle' };
    labelTotal.font = { bold: true, size: 12 };
    labelTotal.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

    const valueTotal = sheet.getCell(`E${currentRow}`);
    valueTotal.value = Number(totalOmsetKeseluruhan);
    valueTotal.font = { bold: true, size: 12, color: { argb: 'FFFF0000' } }; 
    valueTotal.alignment = { horizontal: 'center', vertical: 'middle' };
    valueTotal.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    valueTotal.numFmt = '#,##0';

    sheet.columns = [
        { key: 'col1', width: 6 },
        { key: 'col2', width: 45 },
        { key: 'col3', width: 15 },
        { key: 'col4', width: 20 },
        { key: 'col5', width: 25 }
    ];

    const fileName = `Laporan_Omset_Per_Item_${startDate}_sd_${endDate}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), fileName);
};

export const exportKeuanganExcel = async ({
    financeData,
    expenditureData,
    incomeData,
    startDate,
    endDate
}) => {
    if (!financeData?.length && !expenditureData?.length && !incomeData?.length) return;

    const tanggal = (startDate && endDate) ? `Periode ${startDate} s.d. ${endDate}` : 'Periode -';
    
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Laporan Keuangan");

    let currentRow = generateExcelHeader(
        sheet, 
        "I", 
        "LAPORAN KEUANGAN", 
        tanggal
    );

    sheet.mergeCells(`A${currentRow}:I${currentRow}`);
    const titleFinance = sheet.getCell(`A${currentRow}`);
    titleFinance.value = "REKAP KEUANGAN";
    titleFinance.font = { bold: true, size: 12 };
    titleFinance.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE599' } };
    currentRow++;

    const financeCols = ['No', 'Tanggal', 'Omset Offline', 'Omset Online', 'Total Omset', 'Transfer Masuk', 'Cash Masuk', 'Pengeluaran', 'Saldo Cash'];
    const headerRow1 = sheet.addRow(financeCols);
    headerRow1.font = { bold: true };
    headerRow1.eachCell({ includeEmpty: false }, cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCE5FF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
    currentRow++;

    (financeData || []).forEach((row, index) => {
        const excelRow = sheet.addRow([
            index + 1,
            row.date,
            Number(row.omset_offline),
            Number(row.omset_online),
            Number(row.total_omset),
            Number(row.transfer),
            Number(row.cash_masuk),
            Number(row.expenditure),
            Number(row.saldo)
        ]);
        
        excelRow.eachCell({ includeEmpty: false }, cell => {
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        for(let c = 3; c <= 9; c++) {
            excelRow.getCell(c).numFmt = '#,##0';
        }
        
        excelRow.getCell(5).font = { bold: true, color: { argb: 'FF1565C0' } }; 
        excelRow.getCell(8).font = { color: { argb: 'FFFF0000' } }; 
        
        const saldoCell = excelRow.getCell(9);
        saldoCell.font = { bold: true, color: { argb: row.saldo < 0 ? 'FFFF0000' : 'FF2E7D32' } };

        currentRow++;
    });

    currentRow += 2;

    sheet.mergeCells(`A${currentRow}:D${currentRow}`);
    const titleExp = sheet.getCell(`A${currentRow}`);
    titleExp.value = "DATA PENGELUARAN";
    titleExp.font = { bold: true, size: 11, color: { argb: 'FFFF0000' } };
    titleExp.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE599' } };

    sheet.mergeCells(`F${currentRow}:I${currentRow}`);
    const titleInc = sheet.getCell(`F${currentRow}`);
    titleInc.value = "DATA PEMASUKAN TAMBAHAN";
    titleInc.font = { bold: true, size: 11, color: { argb: 'FF2E7D32' } };
    titleInc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE599' } };
    currentRow++;

    const bottomHeaderRow = sheet.addRow([
        'No', 'Tanggal', 'Keterangan', 'Nominal', 
        '', 'No', 'Tanggal', 'Keterangan', 'Nominal'
    ]);
    
    bottomHeaderRow.font = { bold: true };
    [1, 2, 3, 4, 6, 7, 8, 9].forEach(colIndex => {
        const cell = bottomHeaderRow.getCell(colIndex);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCE5FF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
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
            exp ? exp.date : "",
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
            [1, 2, 3, 4].forEach(c => {
                const cell = dataRow.getCell(c);
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                cell.alignment = { vertical: 'middle', horizontal: c === 3 ? 'left' : 'center' };
            });
            dataRow.getCell(4).numFmt = '#,##0';
            dataRow.getCell(4).font = { color: { argb: 'FFFF0000' } };
        }

        if (inc) {
            [6, 7, 8, 9].forEach(c => {
                const cell = dataRow.getCell(c);
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                cell.alignment = { vertical: 'middle', horizontal: c === 8 ? 'left' : 'center' };
            });
            dataRow.getCell(9).numFmt = '#,##0';
            dataRow.getCell(9).font = { color: { argb: 'FF2E7D32' } };
        }
        currentRow++;
    }

    sheet.mergeCells(`A${currentRow}:C${currentRow}`);
    const labelTotalExp = sheet.getCell(`A${currentRow}`);
    labelTotalExp.value = "Total Pengeluaran";
    labelTotalExp.alignment = { horizontal: 'right', vertical: 'middle' };
    labelTotalExp.font = { bold: true };
    labelTotalExp.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    
    const valExp = sheet.getCell(`D${currentRow}`);
    valExp.value = totalExp;
    valExp.numFmt = '#,##0';
    valExp.font = { bold: true, color: { argb: 'FFFF0000' } };
    valExp.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

    sheet.mergeCells(`F${currentRow}:H${currentRow}`);
    const labelTotalInc = sheet.getCell(`F${currentRow}`);
    labelTotalInc.value = "Total Pemasukan Tambahan";
    labelTotalInc.alignment = { horizontal: 'right', vertical: 'middle' };
    labelTotalInc.font = { bold: true };
    labelTotalInc.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    
    const valInc = sheet.getCell(`I${currentRow}`);
    valInc.value = totalInc;
    valInc.numFmt = '#,##0';
    valInc.font = { bold: true, color: { argb: 'FF2E7D32' } };
    valInc.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

    sheet.columns = [
        { key: 'col1', width: 6 }, 
        { key: 'col2', width: 15 },
        { key: 'col3', width: 25 },
        { key: 'col4', width: 18 },
        { key: 'col5', width: 18 },
        { key: 'col6', width: 15 },
        { key: 'col7', width: 15 },
        { key: 'col8', width: 25 },
        { key: 'col9', width: 18 }
    ];

    const fileName = `Laporan_Keuangan_${startDate}_sd_${endDate}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), fileName);
};

export const exportAktivitasExcel = async ({
    activityData,
    archiveData,
    startDate,
    endDate
}) => {
    if ((!activityData || activityData.length === 0) && (!archiveData || archiveData.length === 0)) return;

    const tanggal = (startDate && endDate) ? `Periode ${startDate} s.d. ${endDate}` : 'Periode -';
    
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Aktivitas dan Arsip");

    let currentRow = generateExcelHeader(
        sheet, 
        "G", 
        "LAPORAN AKTIVITAS & ARSIP", 
        tanggal
    );

    sheet.mergeCells(`A${currentRow}:G${currentRow}`);
    const titleAct = sheet.getCell(`A${currentRow}`);
    titleAct.value = "AKTIVITAS SISTEM";
    titleAct.font = { bold: true, size: 12 };
    titleAct.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
    currentRow++;

    const actCols = ['No', 'Waktu', 'ID Order', 'Aktivitas', 'Pesan', 'Info Tambahan'];
    const headerAct = sheet.addRow(actCols);
    headerAct.font = { bold: true };
    headerAct.eachCell({ includeEmpty: false }, cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCE5FF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
    currentRow++;

    if (activityData && activityData.length > 0) {
        activityData.forEach((row, index) => {
            const excelRow = sheet.addRow([
                index + 1,
                row.date,
                row.order_id || "-",
                row.title,
                row.message,
                row.information || "-"
            ]);
            
            excelRow.eachCell({ includeEmpty: false }, cell => {
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });
            
            excelRow.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' };
            excelRow.getCell(5).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
            
            currentRow++;
        });
    } else {
        sheet.mergeCells(`A${currentRow}:F${currentRow}`);
        sheet.getCell(`A${currentRow}`).value = "Tidak ada aktivitas.";
        sheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center' };
        currentRow++;
    }

    currentRow += 2; 

    sheet.mergeCells(`A${currentRow}:G${currentRow}`);
    const titleArc = sheet.getCell(`A${currentRow}`);
    titleArc.value = "ARSIP ORDER TERHAPUS";
    titleArc.font = { bold: true, size: 12, color: { argb: 'FFFF0000' } };
    titleArc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE599' } };
    currentRow++;

    if (archiveData && archiveData.length > 0) {
        archiveData.forEach((order) => {
            sheet.mergeCells(`A${currentRow}:G${currentRow}`);
            const orderHeader = sheet.getCell(`A${currentRow}`);
            orderHeader.value = `Order #${order.nomorator} | Konsumen: ${order.customer_name} (${order.nomor})`;
            orderHeader.font = { bold: true };
            orderHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
            currentRow++;

            sheet.mergeCells(`A${currentRow}:G${currentRow}`);
            sheet.getCell(`A${currentRow}`).value = `Dibuat: ${order.date} | Dihapus: ${order.deleted_at} | Oleh: ${order.deleted_by_name} (${order.system})`;
            sheet.getCell(`A${currentRow}`).font = { italic: true };
            currentRow++;

            const itemCols = ['No', 'Nama Item', 'Finishing', 'Ukuran', 'Qty', 'Satuan', 'Jumlah'];
            const headerItem = sheet.addRow(itemCols);
            headerItem.font = { bold: true };
            headerItem.eachCell({ includeEmpty: false }, cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });
            currentRow++;

            if (order.items && order.items.length > 0) {
                order.items.forEach((item, idx) => {
                    const itemRow = sheet.addRow([
                        idx + 1,
                        item.judul,
                        item.finishing_names || "-",
                        item.size || "-",
                        item.quantity,
                        Number(item.unit),
                        Number(item.amount)
                    ]);

                    itemRow.eachCell({ includeEmpty: false }, cell => {
                        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    });

                    itemRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
                    itemRow.getCell(6).numFmt = '#,##0';
                    itemRow.getCell(7).numFmt = '#,##0';
                    currentRow++;
                });
            }

            sheet.mergeCells(`A${currentRow}:F${currentRow}`);
            const labelTotal = sheet.getCell(`A${currentRow}`);
            labelTotal.value = "Total Tagihan:";
            labelTotal.alignment = { horizontal: 'right', vertical: 'middle' };
            labelTotal.font = { bold: true };
            labelTotal.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

            const valTotal = sheet.getCell(`G${currentRow}`);
            valTotal.value = Number(order.total);
            valTotal.font = { bold: true };
            valTotal.numFmt = '#,##0';
            valTotal.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            
            currentRow += 2;
        });
    } else {
        sheet.mergeCells(`A${currentRow}:G${currentRow}`);
        sheet.getCell(`A${currentRow}`).value = "Tidak ada arsip order.";
        sheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center' };
        currentRow++;
    }

    sheet.columns = [
        { key: 'col1', width: 6 },
        { key: 'col2', width: 25 },
        { key: 'col3', width: 15 },
        { key: 'col4', width: 30 },
        { key: 'col5', width: 45 },
        { key: 'col6', width: 20 },
        { key: 'col7', width: 20 }
    ];

    const fileName = `Laporan_Aktivitas_${startDate}_sd_${endDate}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), fileName);
};

export const exportMaklunExcel = async ({
    maklunMasuk,
    maklunKeluar,
    startDate,
    endDate
}) => {
    if (!maklunMasuk?.length && !maklunKeluar?.length) return;

    const tanggal = (startDate && endDate) ? `Periode ${startDate} s.d. ${endDate}` : 'Periode -';
    
    const workbook = new ExcelJS.Workbook();

    const branches = new Set();
    (maklunMasuk || []).forEach(item => {
        if (item.branch_name) branches.add(item.branch_name);
    });
    (maklunKeluar || []).forEach(item => {
        if (item.branch_name) branches.add(item.branch_name);
    });

    const branchList = Array.from(branches);

    if (branchList.length === 0) {
        branchList.push("Semua Cabang");
    }

    branchList.forEach(branchName => {
        const safeSheetName = branchName.replace(/[\/\\\?\*\[\]\:]/g, "").substring(0, 31);
        const sheet = workbook.addWorksheet(safeSheetName);

        const filteredMasuk = (maklunMasuk || []).filter(item => item.branch_name === branchName || (branchName === "Semua Cabang" && !item.branch_name));
        const filteredKeluar = (maklunKeluar || []).filter(item => item.branch_name === branchName || (branchName === "Semua Cabang" && !item.branch_name));

        let currentRow = generateExcelHeader(
            sheet, 
            "I", 
            `LAPORAN MAKLUN - ${branchName.toUpperCase()}`, 
            tanggal
        );

        sheet.mergeCells(`A${currentRow}:I${currentRow}`);
        const titleMasuk = sheet.getCell(`A${currentRow}`);
        titleMasuk.value = "MAKLUN MASUK";
        titleMasuk.font = { bold: true, size: 12, color: { argb: 'FF1565C0' } };
        titleMasuk.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE599' } };
        currentRow++;

        const headerMasukCols = ['No', 'Nama', 'Ukuran', 'Finishing', 'Qty', 'Harga Satuan', 'Jumlah', 'Dari Cabang', 'Tanggal'];
        const headerRowMasuk = sheet.addRow(headerMasukCols);
        headerRowMasuk.font = { bold: true };
        headerRowMasuk.eachCell({ includeEmpty: false }, cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCE5FF' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
        currentRow++;

        let totalMasuk = 0;
        if (filteredMasuk.length > 0) {
            filteredMasuk.forEach((row, index) => {
                const jumlah = Number(row.jumlah_harga_calc) || 0;
                totalMasuk += jumlah;

                const excelRow = sheet.addRow([
                    index + 1,
                    row.judul || "-",
                    row.size || "-",
                    row.finishing_names || "-",
                    Number(row.quantity) || 0,
                    Number(row.harga_satuan_calc) || 0,
                    jumlah,
                    row.branch_name || "-",
                    row.date || "-"
                ]);
                
                excelRow.eachCell({ includeEmpty: false }, cell => {
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                });

                excelRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
                excelRow.getCell(8).alignment = { vertical: 'middle', horizontal: 'left' };

                excelRow.getCell(5).numFmt = '#,##0';
                excelRow.getCell(6).numFmt = '#,##0';
                excelRow.getCell(7).numFmt = '#,##0';
                excelRow.getCell(7).font = { bold: true, color: { argb: 'FF1565C0' } };

                currentRow++;
            });
        } else {
            sheet.mergeCells(`A${currentRow}:I${currentRow}`);
            const emptyCell = sheet.getCell(`A${currentRow}`);
            emptyCell.value = "Tidak ada data Maklun Masuk untuk cabang ini.";
            emptyCell.alignment = { horizontal: 'center' };
            emptyCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            currentRow++;
        }

        sheet.mergeCells(`A${currentRow}:F${currentRow}`);
        const labelTotalMasuk = sheet.getCell(`A${currentRow}`);
        labelTotalMasuk.value = "Total Nilai Maklun Masuk";
        labelTotalMasuk.alignment = { horizontal: 'right', vertical: 'middle' };
        labelTotalMasuk.font = { bold: true };
        labelTotalMasuk.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        
        const valTotalMasuk = sheet.getCell(`G${currentRow}`);
        valTotalMasuk.value = totalMasuk;
        valTotalMasuk.numFmt = '#,##0';
        valTotalMasuk.font = { bold: true, color: { argb: 'FF1565C0' } };
        valTotalMasuk.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        
        sheet.getCell(`H${currentRow}`).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        sheet.getCell(`I${currentRow}`).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

        currentRow += 3;

        sheet.mergeCells(`A${currentRow}:I${currentRow}`);
        const titleKeluar = sheet.getCell(`A${currentRow}`);
        titleKeluar.value = "MAKLUN KELUAR";
        titleKeluar.font = { bold: true, size: 12, color: { argb: 'FFFF0000' } };
        titleKeluar.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE599' } };
        currentRow++;

        const headerKeluarCols = ['No', 'Nama', 'Ukuran', 'Finishing', 'Qty', 'Harga Satuan', 'Jumlah', 'Ke Cabang', 'Tanggal'];
        const headerRowKeluar = sheet.addRow(headerKeluarCols);
        headerRowKeluar.font = { bold: true };
        headerRowKeluar.eachCell({ includeEmpty: false }, cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCE5FF' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
        currentRow++;

        let totalKeluar = 0;
        if (filteredKeluar.length > 0) {
            filteredKeluar.forEach((row, index) => {
                const jumlah = Number(row.jumlah_harga_calc) || 0;
                totalKeluar += jumlah;

                const excelRow = sheet.addRow([
                    index + 1,
                    row.judul || "-",
                    row.size || "-",
                    row.finishing_names || "-",
                    Number(row.quantity) || 0,
                    Number(row.harga_satuan_calc) || 0,
                    jumlah,
                    row.branch_name || "-",
                    row.date || "-"
                ]);
                
                excelRow.eachCell({ includeEmpty: false }, cell => {
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                });

                excelRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
                excelRow.getCell(8).alignment = { vertical: 'middle', horizontal: 'left' };

                excelRow.getCell(5).numFmt = '#,##0';
                excelRow.getCell(6).numFmt = '#,##0';
                excelRow.getCell(7).numFmt = '#,##0';
                excelRow.getCell(7).font = { bold: true, color: { argb: 'FFFF0000' } };

                currentRow++;
            });
        } else {
            sheet.mergeCells(`A${currentRow}:I${currentRow}`);
            const emptyCell = sheet.getCell(`A${currentRow}`);
            emptyCell.value = "Tidak ada data Maklun Keluar untuk cabang ini.";
            emptyCell.alignment = { horizontal: 'center' };
            emptyCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            currentRow++;
        }

        sheet.mergeCells(`A${currentRow}:F${currentRow}`);
        const labelTotalKeluar = sheet.getCell(`A${currentRow}`);
        labelTotalKeluar.value = "Total Nilai Maklun Keluar";
        labelTotalKeluar.alignment = { horizontal: 'right', vertical: 'middle' };
        labelTotalKeluar.font = { bold: true };
        labelTotalKeluar.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        
        const valTotalKeluar = sheet.getCell(`G${currentRow}`);
        valTotalKeluar.value = totalKeluar;
        valTotalKeluar.numFmt = '#,##0';
        valTotalKeluar.font = { bold: true, color: { argb: 'FFFF0000' } };
        valTotalKeluar.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        
        sheet.getCell(`H${currentRow}`).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        sheet.getCell(`I${currentRow}`).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

        sheet.columns = [
            { key: 'col1', width: 6 },
            { key: 'col2', width: 25 },
            { key: 'col3', width: 10 },
            { key: 'col4', width: 20 },
            { key: 'col5', width: 10 }, 
            { key: 'col6', width: 15 }, 
            { key: 'col7', width: 18 },
            { key: 'col8', width: 25 },
            { key: 'col9', width: 20 }
        ];
    });

    const fileName = `Laporan_Maklun_Per_Cabang_${startDate}_sd_${endDate}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), fileName);
};

export const exportFailureExcel = async ({
    failures,
    startDate,
    endDate
}) => {
    if (!failures || failures.length === 0) return;

    const tanggal = (startDate && endDate) ? `Periode ${startDate} s.d. ${endDate}` : 'Periode -';
    
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Laporan Kegagalan");

    let currentRow = generateExcelHeader(
        sheet, 
        "N", 
        "LAPORAN KEGAGALAN PRODUKSI", 
        tanggal
    );

    sheet.mergeCells(`A${currentRow}:N${currentRow}`);
    const titleTab = sheet.getCell(`A${currentRow}`);
    titleTab.value = "DATA KEGAGALAN (REJECT)";
    titleTab.font = { bold: true, size: 12, color: { argb: 'FFFF0000' } }; // Warna Merah
    titleTab.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE599' } };
    currentRow++;

    const headerCols = [
        'No', 'Tanggal', 'Nomorator', 'Customer', 'Operator', 'Mesin', 
        'Judul', 'Ukuran', 'Qty', 'Finishing', 'Detail Gagal', 
        'Kerugian', 'Beban', 'Keterangan'
    ];
    
    const headerRow = sheet.addRow(headerCols);
    headerRow.font = { bold: true };
    headerRow.eachCell({ includeEmpty: false }, cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCE5FF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
    currentRow++;

    let totalLoss = 0;
    
    failures.forEach((row, index) => {
        const kerugian = Number(row.total_loss) || 0;
        totalLoss += kerugian;

        const detailGagalClean = (row.detail_gagal || "-").replace(/<br\s*[\/]?>/gi, "\n");

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
        
        excelRow.eachCell({ includeEmpty: false }, cell => {
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        });

        excelRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        excelRow.getCell(7).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        excelRow.getCell(11).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }; 
        excelRow.getCell(14).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }; 


        excelRow.getCell(9).numFmt = '#,##0';
        excelRow.getCell(12).numFmt = '#,##0';
        excelRow.getCell(12).font = { color: { argb: 'FFFF0000' } }; 

        currentRow++;
    });

    sheet.mergeCells(`A${currentRow}:K${currentRow}`);
    const labelTotal = sheet.getCell(`A${currentRow}`);
    labelTotal.value = "Total Nominal Kerugian Produksi";
    labelTotal.alignment = { horizontal: 'right', vertical: 'middle' };
    labelTotal.font = { bold: true };
    labelTotal.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    
    const valTotal = sheet.getCell(`L${currentRow}`);
    valTotal.value = totalLoss;
    valTotal.numFmt = '#,##0';
    valTotal.font = { bold: true, color: { argb: 'FFFF0000' } };
    valTotal.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

    sheet.getCell(`M${currentRow}`).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    sheet.getCell(`N${currentRow}`).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

    sheet.columns = [
        { key: 'col1', width: 5 },
        { key: 'col2', width: 15 },
        { key: 'col3', width: 12 },
        { key: 'col4', width: 22 },
        { key: 'col5', width: 18 },
        { key: 'col6', width: 20 },
        { key: 'col7', width: 25 },
        { key: 'col8', width: 12 },
        { key: 'col9', width: 8 },
        { key: 'col10', width: 22 },
        { key: 'col11', width: 45 },
        { key: 'col12', width: 15 },
        { key: 'col13', width: 15 },
        { key: 'col14', width: 30 },
    ];

    const fileName = `Laporan_Kegagalan_Produksi_${startDate}_sd_${endDate}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), fileName);
};