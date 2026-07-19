import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

export const generateExcelHeader = (sheet, endColLetter, storeName, storeAddress, reportTitle, dateString) => {
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
    endDate,
    storeName,
    storeAddress
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

    // Memanggil fungsi header dinamis yang baru saja kita buat.
    // Karena tabel meteran hanya memiliki 5 kolom, kita atur endColLetter ke "E"
    let currentRow = generateExcelHeader(
        sheet, 
        "E", 
        storeName, 
        storeAddress, 
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
    endDate,
    storeName,
    storeAddress
}) => {
    if (!orders || orders.length === 0) return;

    const tanggal = (startDate && endDate) ? `Tanggal ${startDate} s.d. ${endDate}` : 'Tanggal -';
    
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Detail Transaksi");

    let currentRow = generateExcelHeader(
        sheet, 
        "G", 
        storeName, 
        storeAddress, 
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
    endDate,
    storeName,
    storeAddress
}) => {
    if (!harianData || harianData.length === 0) return;

    const tanggal = (startDate && endDate) ? `Tanggal ${startDate} s.d. ${endDate}` : 'Tanggal -';
    
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Transaksi Harian");

    // Menggunakan helper header yang sudah kita buat
    let currentRow = generateExcelHeader(
        sheet, 
        "F", 
        storeName, 
        storeAddress, 
        "LAPORAN TRANSAKSI HARIAN", 
        tanggal
    );

    // Header Tabel
    const columns = ['No', 'Nomorator', 'Nama Konsumen', 'Nominal', 'Metode', 'Status'];
    const headerRow = sheet.addRow(columns);
    headerRow.font = { bold: true };
    headerRow.eachCell({ includeEmpty: false }, cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCE5FF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
    currentRow++;

    // Data Rows
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

    // Summary Section
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
    endDate,
    storeName,
    storeAddress
}) => {
    if (!bulananData || bulananData.length === 0) return;

    const tanggal = (startDate && endDate) ? `Periode ${startDate} s.d. ${endDate}` : 'Periode -';
    
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Transaksi Bulanan");

    // Menggunakan header dengan kolom sampai G (7 kolom)
    let currentRow = generateExcelHeader(
        sheet, 
        "G", 
        storeName, 
        storeAddress, 
        "LAPORAN TRANSAKSI BULANAN", 
        tanggal
    );

    // Header Tabel
    const columns = ['No', 'Tanggal', 'Jml Order', 'Jml Transaksi', 'CASH', 'TRANSFER', 'Total Nominal'];
    const headerRow = sheet.addRow(columns);
    headerRow.font = { bold: true };
    headerRow.eachCell({ includeEmpty: false }, cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCE5FF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
    currentRow++;

    // Data Rows
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

    // Summary Section
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
    endDate,
    storeName,
    storeAddress
}) => {
    if (!transaksiItemData || Object.keys(transaksiItemData).length === 0) return;

    const tanggal = (startDate && endDate) ? `Periode ${startDate} s.d. ${endDate}` : 'Periode -';
    
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Transaksi Per Item");

    // Menggunakan header dengan kolom sampai I (9 kolom)
    let currentRow = generateExcelHeader(
        sheet, 
        "I", 
        storeName, 
        storeAddress, 
        "LAPORAN TRANSAKSI PER ITEM", 
        tanggal
    );

    // Iterasi per Produk
    Object.entries(transaksiItemData).forEach(([namaProduk, daftarOrder]) => {
        // Judul Produk (Sub-Header)
        sheet.mergeCells(`A${currentRow}:I${currentRow}`);
        const titleCell = sheet.getCell(`A${currentRow}`);
        titleCell.value = namaProduk;
        titleCell.font = { bold: true, size: 12 };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE599' } };
        currentRow++;

        // Header Tabel
        const columns = ['No', 'Nomorator', 'Nama', 'Ukuran', 'Finishing', 'Harga Produk', 'Qty', 'Subtotal', 'Tanggal'];
        const headerRow = sheet.addRow(columns);
        headerRow.font = { bold: true };
        headerRow.eachCell({ includeEmpty: false }, cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCE5FF' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
        currentRow++;

        // Data Rows
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
            excelRow.getCell(3).alignment = { horizontal: 'left' }; // Nama Konsumen
            excelRow.getCell(6).numFmt = '#,##0'; // Harga
            excelRow.getCell(8).numFmt = '#,##0'; // Subtotal
            currentRow++;
        });

        // Baris Total per produk
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
        
        currentRow += 2; // Spasi antar tabel produk
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