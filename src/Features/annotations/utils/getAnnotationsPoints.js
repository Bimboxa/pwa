export default function getAnnotationsPoints(annotations, options) {

    if (!annotations) return null;

    // options

    const imageSize = options?.imageSize;
    console.log("debug_161_imageSize", imageSize)

    // main
    const pointById = {}

    annotations.forEach(annotation => {
        annotation.points?.forEach(point => {
            const _point = { ...point }
            if (imageSize) {
                _point.x = point.x * imageSize.width;
                _point.y = point.y * imageSize.height;
            }
            pointById[point.id] = _point
        })
    })

    return Object.values(pointById)
}