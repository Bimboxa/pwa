import getAggregatedAnnotationRows from "Features/annotations/utils/getAggregatedAnnotationRows";

const MULTIPLE_HEIGHTS_LABEL = "Hauteurs multiples";

const columnsDef = [
  { key: "listingName", label: "Liste", width: 20 },
  { key: "baseMapName", label: "Fond de plan", width: 20 },
  { key: "layerName", label: "Calque", width: 20 },
  { key: "templateLabel", label: "Modèle", width: 20 },
  { key: "height", label: "Hauteur", width: 15 },
  { key: "unit", label: "Unité", width: 10 },
  { key: "length", label: "Longueur", width: 15 },
  { key: "surface", label: "Surface", width: 15 },
];

function addSheet(workbook, sheetName, rows) {
  const items = rows.map((row) => ({
    listingName: row.listingName,
    baseMapName: row.baseMapName,
    layerName: row.layerName,
    templateLabel: row.templateLabel,
    height: row.hasMultipleHeights ? MULTIPLE_HEIGHTS_LABEL : row.height,
    unit: row.unit,
    length: row.length,
    surface: row.surface,
  }));

  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = columnsDef.map((col) => ({
    header: col.label,
    key: col.key,
    width: col.width || 15,
  }));

  sheet.addRows(items);

  // header styling
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = {
      bold: true,
      name: "Calibri",
      size: 11,
    };
    cell.border = {
      bottom: { style: "thin" },
    };
  });

  headerRow.commit();
}

export default function createSheetAnnotationsAggregated(
  workbook,
  annotations,
  { templateRankById } = {}
) {
  const globalRows = getAggregatedAnnotationRows({
    annotations,
    splitByContext: false,
    templateRankById,
  });
  addSheet(workbook, "Agrégation globale", globalRows);

  const splitRows = getAggregatedAnnotationRows({
    annotations,
    splitByContext: true,
    templateRankById,
  });
  addSheet(workbook, "Agrégation détaillée", splitRows);
}
