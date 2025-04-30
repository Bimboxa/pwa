import * as Excel from "exceljs";

export default async function fileToWorkbook(file) {
  const workbook = new Excel.Workbook();
  const arrayBuffer = await file.arrayBuffer();
  if (file.name?.endsWith(".xlsx")) {
    await workbook.xlsx.load(arrayBuffer);
  }
  return workbook;
}
