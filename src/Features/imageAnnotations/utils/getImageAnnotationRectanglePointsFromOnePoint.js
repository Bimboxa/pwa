export default function getImageAnnotationRectanglePointsFromOnePoint({
    annotation,
    baseMapMeterByPx,
    point,
}) {

    const annotationMeterByPx = annotation.meterByPx;
    const annotationImageSize = annotation.image.imageSize;

    const annotationWidthInBaseMap = annotationImageSize.width * annotationMeterByPx / baseMapMeterByPx;
    const annotationHeightInBaseMap = annotationImageSize.height * annotationMeterByPx / baseMapMeterByPx;

    const x1 = point.x - annotationWidthInBaseMap / 2;
    const y1 = point.y - annotationHeightInBaseMap / 2;

    const x2 = point.x + annotationWidthInBaseMap / 2;
    const y2 = point.y + annotationHeightInBaseMap / 2;

    return [{ x: x1, y: y1 }, { x: x2, y: y2 }];

}