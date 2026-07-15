import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

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

    sheet.mergeCells("A1:E1");
    sheet.getCell("A1").value = storeName;
    sheet.getCell("A1").alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getCell("A1").font = { bold: true, size: 16 };

    sheet.mergeCells("A2:E2");
    sheet.getCell("A2").value = storeAddress;
    sheet.getCell("A2").alignment = { vertical: 'middle', horizontal: 'center' };

    sheet.addRow([]);
    sheet.mergeCells("A4:E4");
    sheet.getCell("A4").value = `Laporan Penggunaan Bahan - ${categoryTitle.toUpperCase()}`;
    sheet.getCell("A4").alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getCell("A4").font = { bold: true, size: 14 };

    sheet.mergeCells("A5:E5");
    sheet.getCell("A5").value = tanggal;
    sheet.getCell("A5").alignment = { vertical: 'middle', horizontal: 'center' };

    sheet.addRow([]);

    let currentRow = 7;

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