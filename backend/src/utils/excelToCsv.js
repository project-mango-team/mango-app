import * as XLSX from 'xlsx';

const isExcelFilename = (filename) => {
  if (!filename) return false;
  const lower = filename.toLowerCase();
  return lower.endsWith('.xlsx') || lower.endsWith('.xls');
};

const excelToCsvBuffer = async (buffer, encoding = 'utf8') => {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('No se encontraron hojas con datos');
    }

    // Find first non-empty sheet or default to first sheet
    let targetSheetName = workbook.SheetNames[0];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (sheet && sheet['!ref']) {
        targetSheetName = sheetName;
        break;
      }
    }

    const worksheet = workbook.Sheets[targetSheetName];
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);

    return Buffer.from(csvContent, encoding);
  } catch (error) {
    throw new Error(`No se pudo convertir el Excel a CSV: ${error.message}`);
  }
};

export { excelToCsvBuffer, isExcelFilename };
