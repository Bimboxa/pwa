/**
 * Split a polyline/strip annotation at a given vertex index.
 *
 * @param {Array<{id: string, type?: string}>} points - annotation.points array
 * @param {number} vertexIndex - index of the vertex to split at
 * @param {boolean} closeLine - whether the annotation is closed
 * @returns {{ piece1: Array, piece2?: Array } | null}
 *   - Open: { piece1, piece2 } — two pieces sharing the split point
 *   - Closed: { piece1 } — single reordered open piece
 *   - null if split is not possible (first/last of open annotation)
 */
export default function splitPolylineAtVertex(points, vertexIndex, closeLine) {
    if (!points || points.length < 2) return null;

    if (closeLine) {
        // Closed → open: rotate so split vertex is at both ends
        const rotated = [
            ...points.slice(vertexIndex),
            ...points.slice(0, vertexIndex + 1),
        ];
        return { piece1: rotated };
    }

    // Open: split into two pieces
    if (vertexIndex === 0 || vertexIndex === points.length - 1) return null;

    return {
        piece1: points.slice(0, vertexIndex + 1),
        piece2: points.slice(vertexIndex),
    };
}
