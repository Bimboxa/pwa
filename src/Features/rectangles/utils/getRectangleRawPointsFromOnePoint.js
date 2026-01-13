export default function getRectangleRawPointsFromOnePoint({ point, width, height }) {

    return [
        { x: point.x - width / 2, y: point.y - height / 2 },
        { x: point.x + width / 2, y: point.y + height / 2 },
    ]

}