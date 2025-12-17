import resolvePoints from "./resolvePoints";

export default function resolveCuts({ cuts, pointsIndex, imageSize }) {
    if (!cuts || !cuts.length || !pointsIndex || !imageSize) return null;

    return cuts.map((cut) => {
        return {
            ...cut,
            points: resolvePoints({ points: cut.points, pointsIndex, imageSize })
        }
    })
}

