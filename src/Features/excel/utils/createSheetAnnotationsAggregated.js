export default function createSheetAnnotationsAggregated(workbook, annotations) {

    // 1. Aggregate by annotation template
    const grouped = {};
    for (const annotation of annotations) {
        const templateId = annotation.annotationTemplateId;
        if (!templateId) continue;

        if (!grouped[templateId]) {
            grouped[templateId] = {
                templateLabel: annotation.annotationTemplateProps?.label ?? "Sans Label",
                listingNames: new Set(),
                baseMapNames: new Set(),
                layerNames: new Set(),
                height: annotation.height ?? 0,
                unit: 0,
                length: 0,
                surface: 0,
            };
        }

        const row = grouped[templateId];
        row.unit += 1;
        if (annotation.listingName) row.listingNames.add(annotation.listingName);
        if (annotation.baseMapName) row.baseMapNames.add(annotation.baseMapName);
        if (annotation.layerName) row.layerNames.add(annotation.layerName);

        const qties = annotation.qties;
        if (qties?.enabled) {
            if (Number.isFinite(qties.length)) row.length += qties.length;
            if (Number.isFinite(qties.surface)) row.surface += qties.surface;
        }
    }

    const items = Object.values(grouped).map(row => ({
        listingName: [...row.listingNames].join(", "),
        baseMapName: [...row.baseMapNames].join(", "),
        layerName: [...row.layerNames].join(", "),
        templateLabel: row.templateLabel,
        height: row.height,
        unit: row.unit,
        length: row.length,
        surface: row.surface,
    }));

    // 2. Column definitions
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

    const sheet = workbook.addWorksheet("Données agrégées");

    // 3. Column headers
    sheet.columns = columnsDef.map(col => ({
        header: col.label,
        key: col.key,
        width: col.width || 15
    }));

    // 4. Add data
    sheet.addRows(items);

    // 5. Header styling
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
