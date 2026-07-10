// Recap sheet of the 3D mesh cells ("mailles"): label + surface.
export default function createSheetMeshes3d(workbook, meshes3d) {
  // 1. Data preparation
  const items = (meshes3d || []).map((mesh3d) => ({
    label: mesh3d.displayLabel ?? mesh3d.label ?? `M${mesh3d.number ?? ""}`,
    surface: Math.round((mesh3d.surface ?? 0) * 100) / 100,
    facesCount: mesh3d.faces?.length ?? 0,
    color: mesh3d.color ?? "-",
  }));

  // 2. Column definitions
  const columnsDef = [
    { key: "label", label: "Maille", width: 20 },
    { key: "surface", label: "Surface (m²)", width: 15 },
    { key: "facesCount", label: "Nb faces", width: 10 },
    { key: "color", label: "Couleur", width: 12 },
  ];

  const sheet = workbook.addWorksheet("Maillage");

  // 3. Column headers
  sheet.columns = columnsDef.map((col) => ({
    header: col.label,
    key: col.key,
    width: col.width || 15,
  }));

  // 4. Add data
  sheet.addRows(items);

  // 5. Header styling
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
