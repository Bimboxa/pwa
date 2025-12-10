export default function getPolylinePointsFromRectangle(points) {
    const pointA = points[0]
    const pointC = points[1]

    const pointB = { x: pointC.x, y: pointA.y }
    const pointD = { x: pointA.x, y: pointC.y }

    return [pointA, pointB, pointC, pointD]
}