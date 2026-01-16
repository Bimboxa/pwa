export default function closePolygonPoints(points) {
    const lastIndex = points.length - 1;
    if (points[lastIndex].id === points[0].id) {
        return points;
    }
    return [...points, points[0]];
}