import ExcelJS from 'exceljs';

const isExcelFilename = (filename) => {
  if (!filename) return false;
  return filename.toLowerCase().endsWith('.xlsx');
};

const formatDate = (date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
};

const getCellText = (cell) => {
  if (!cell) return '';
  if (typeof cell.text === 'string' && cell.text !== '') {
    return cell.text;
  }

  const value = cell.value;
  if (value === null || value === undefined) return '';

  if (value instanceof Date) return formatDate(value);

  if (typeof value === 'object') {
    if (value.richText) {
      return value.richText.map((part) => part.text).join('');
    }
    if (Object.prototype.hasOwnProperty.call(value, 'result')) {
      return value.result === null || value.result === undefined ? '' : String(value.result);
    }
    if (Object.prototype.hasOwnProperty.call(value, 'text')) {
      return value.text === null || value.text === undefined ? '' : String(value.text);
    }
  }

  return String(value);
};

const escapeCsvValue = (rawValue) => {
  const value = rawValue === null || rawValue === undefined ? '' : String(rawValue);
  const escaped = value.replace(/"/g, '""');
  if (/[",\n\r]/.test(escaped)) {
    return `"${escaped}"`;
  }
  return escaped;
};

const getFirstDataWorksheet = (workbook) => {
  if (!workbook || !workbook.worksheets || workbook.worksheets.length === 0) {
    return null;
  }

  const withData = workbook.worksheets.find((sheet) => sheet.actualRowCount > 0);
  return withData || workbook.worksheets[0];
};

const excelToCsvBuffer = async (buffer, encoding = 'utf8') => {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = getFirstDataWorksheet(workbook);
    if (!worksheet) {
      throw new Error('No se encontraron hojas con datos');
    }

    const rowCount = worksheet.actualRowCount || worksheet.rowCount || 0;
    const lines = [];

    for (let rowIndex = 1; rowIndex <= rowCount; rowIndex++) {
      const row = worksheet.getRow(rowIndex);

      if (!row || !row.hasValues) {
        lines.push('');
        continue;
      }

      const values = row.values || [];
      let lastCol = 0;
      for (let i = values.length - 1; i >= 1; i--) {
        const value = values[i];
        if (value !== null && value !== undefined && value !== '') {
          lastCol = i;
          break;
        }
      }

      if (lastCol === 0) {
        lines.push('');
        continue;
      }

      const fields = [];
      for (let colIndex = 1; colIndex <= lastCol; colIndex++) {
        const cell = row.getCell(colIndex);
        const cellText = getCellText(cell);
        fields.push(escapeCsvValue(cellText));
      }

      lines.push(fields.join(','));
    }

    const csvContent = lines.join('\n');
    return Buffer.from(csvContent, encoding);
  } catch (error) {
    throw new Error(`No se pudo convertir el Excel a CSV: ${error.message}`);
  }
};

export { excelToCsvBuffer, isExcelFilename };
