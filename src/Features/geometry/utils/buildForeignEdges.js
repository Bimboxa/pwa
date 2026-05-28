/**
 * Collect all edge segments from polygons other than polygons[currentIndex].
 * Includes outer ring edges and cut ring edges.
 * @returns {Array<{ax: number, ay: number, bx: number, by: number}>}
 */
export default function buildForeignEdges(polygons, currentIndex) {
  const edges = [];
  for (let j = 0; j < polygons.length; j++) {
    if (j === currentIndex) continue;
    const poly = polygons[j];

    // outer ring edges
    const pts = poly.points;
    if (pts?.length >= 3) {
      const outerHidden = new Set(poly.hiddenSegmentsIdx ?? []);
      for (let i = 0; i < pts.length; i++) {
        if (outerHidden.has(i)) continue;
        const next = (i + 1) % pts.length;
        edges.push({
          ax: pts[i].x,
          ay: pts[i].y,
          idA: pts[i].id,
          bx: pts[next].x,
          by: pts[next].y,
          idB: pts[next].id,
          polygonIndex: j,
          ringKind: "outer",
        });
      }
    }

    // cut edges
    if (poly.cuts?.length) {
      for (let ci = 0; ci < poly.cuts.length; ci++) {
        const cut = poly.cuts[ci];
        const cpts = cut.points;
        if (!cpts?.length || cpts.length < 3) continue;
        const cutHidden = new Set(cut.hiddenSegmentsIdx ?? []);
        for (let i = 0; i < cpts.length; i++) {
          if (cutHidden.has(i)) continue;
          const next = (i + 1) % cpts.length;
          edges.push({
            ax: cpts[i].x,
            ay: cpts[i].y,
            idA: cpts[i].id,
            bx: cpts[next].x,
            by: cpts[next].y,
            idB: cpts[next].id,
            polygonIndex: j,
            ringKind: "cut",
            cutIndex: ci,
          });
        }
      }
    }
  }
  return edges;
}
