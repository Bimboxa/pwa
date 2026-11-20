// Meshes export table: one row per mesh and per active suffix
// (M-1-P, M-1-S, M-2-P, ...). Each expanded row keeps the surface of its
// mesh. No active suffix => the rows are returned untouched.
export default function expandMeshes3dRowsBySuffixes(rows, activeSuffixes) {
  if (!activeSuffixes?.length) return rows;

  return (rows || []).flatMap((row) =>
    activeSuffixes.map((suffix) => ({
      ...row,
      id: `${row.id}-${suffix}`,
      displayLabel: `${row.displayLabel}-${suffix}`,
    }))
  );
}
