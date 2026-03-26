import theme from "Styles/theme"

export default function createSheetAnnotations(workbook, annotations) {

    // 1. Data preparation
    const items = annotations.map(annotation => {
        return {
            listingName: annotation.listingName ?? "-",
            baseMapName: annotation.baseMapName ?? "-",
            layerName: annotation.layerName ?? "-",
            annotationTemplateLabel: annotation.annotationTemplateProps?.label ?? "Sans Label",
            height: annotation.height,
            unit: 1,
            length: annotation.qties?.length ?? 0,
            surface: annotation.qties?.surface ?? 0,
        }
    })

    // 2. Column definitions
    const columnsDef = [
        { key: "listingName", label: "Liste", width: 20 },
        { key: "baseMapName", label: "Fond de plan", width: 20 },
        { key: "layerName", label: "Calque", width: 20 },
        { key: "annotationTemplateLabel", label: "Modèle", width: 20 },
        { key: "height", label: "Hauteur", width: 15 },
        { key: "unit", label: "Unité", width: 10 },
        { key: "length", label: "Longueur", width: 15 },
        { key: "surface", label: "Surface", width: 15 },
    ]

    const sheet = workbook.addWorksheet("Annotations");

    // 3. Column headers
    sheet.columns = columnsDef.map(col => ({
        header: col.label,
        key: col.key,
        width: col.width || 15
    }));

    // 4. Add data
    sheet.addRows(items);

    // 5. Column-specific styling (except header)
    columnsDef.forEach(colDef => {
        if (colDef.style && colDef.style.color) {
            const column = sheet.getColumn(colDef.key);
            const colorArgb = "FF" + colDef.style.color.replace("#", "");
            column.eachCell((cell, rowNumber) => {
                if (rowNumber > 1) {
                    cell.font = {
                        color: { argb: colorArgb }
                    };
                }
            });
        }
    });

    // 6. Header styling
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
        cell.font = {
            bold: true,
            name: 'Calibri',
            size: 11
        };
        cell.border = {
            bottom: { style: 'thin' }
        };
    });

    headerRow.commit();
}
