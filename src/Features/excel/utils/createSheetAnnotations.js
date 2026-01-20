import theme from "Styles/theme"

export default function createSheetAnnotations(workbook, annotations) {

    // 1. Préparation des données (inchangé)
    const items = annotations.map(annotation => {
        return {
            id: annotation.id,
            annotationTemplateLabel: annotation.annotationTemplateProps?.label ?? "Sans Label",
            baseMapName: annotation.baseMapName,
            height: annotation.height,
            length: annotation.qties.length,
            surface: annotation.qties.surface,
        }
    })

    // 2. Définition des colonnes
    // J'ai ajouté une propriété 'width' par défaut pour que ce soit plus lisible
    const columnsDef = [
        { key: "id", label: "id", width: 30, style: { color: theme.palette.grey[500] } },
        { key: "annotationTemplateLabel", label: "Modèle", width: 20 },
        { key: "baseMapName", label: "Fond de plan", width: 20 },
        { key: "height", label: "Hauteur", width: 15 },
        { key: "length", label: "Longueur", width: 15 },
        { key: "surface", label: "Surface", width: 15 },
    ]

    const sheet = workbook.addWorksheet("Annotations");

    // 3. Configuration des headers de colonnes pour ExcelJS
    sheet.columns = columnsDef.map(col => ({
        header: col.label, // ExcelJS utilise 'header' pour le titre
        key: col.key,
        width: col.width || 15
    }));

    // 4. Ajout des données
    sheet.addRows(items);

    // 5. Application du style spécifique par colonne (sauf header)
    columnsDef.forEach(colDef => {
        if (colDef.style && colDef.style.color) {
            const column = sheet.getColumn(colDef.key);

            // ExcelJS attend du ARGB (Ex: FF000000). On retire le '#' du hex et on ajoute 'FF' pour l'opacité.
            const colorArgb = "FF" + colDef.style.color.replace("#", "");

            column.eachCell((cell, rowNumber) => {
                // On applique le style uniquement si ce n'est pas la ligne 1 (Header)
                if (rowNumber > 1) {
                    cell.font = {
                        color: { argb: colorArgb }
                    };
                }
            });
        }
    });

    // 6. Application du style pour le Header (Gras)
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
        cell.font = {
            bold: true,
            name: 'Calibri', // Police par défaut optionnelle
            size: 11
        };
        // Optionnel : ajouter une bordure en bas du header
        cell.border = {
            bottom: { style: 'thin' }
        };
    });

    // Bonnes pratiques : commiter les changements si nécessaire
    headerRow.commit();
}