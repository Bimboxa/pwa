export default function getGeoJsonFromPoints(points) {

    const geoJson = [];
    const pointByXY = {};

    for (const point of points) {
        const xS = point.x.toFixed(3);
        const yS = point.y.toFixed(3);
        const key = `${xS}_${yS}`;
        pointByXY[key] = point;
        geoJson.push([parseFloat(xS), parseFloat(yS)]);
    }

    return { pointsFormatGeoJson: [geoJson], pointByXY }

}