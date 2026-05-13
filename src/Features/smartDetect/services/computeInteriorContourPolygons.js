import computeInteriorWallChains from "Features/geometry/utils/computeInteriorWallChains";

/**
 * Compute wall-surface POLYGON contours between adjacent source polygons.
 *
 * Thin wrapper kept for backwards compatibility with the "Contour intérieur"
 * mode of `IconButtonVectorisation` / `useTraceInteriorContours`. Delegates to
 * the pure geometric util `computeInteriorWallChains`, which is also consumed
 * by the floor+ceiling wall-fill auto procedure.
 *
 * @param {Object} args
 * @param {Array<{points: Array<{x:number,y:number,id?:string}>, cuts?: any}>} args.polygons
 * @param {number} args.meterByPx
 * @returns {Array<{ pointsPx: Array<{x:number,y:number,sourcePointId?:string}> }>}
 */
export default function computeInteriorContourPolygons({
  polygons,
  meterByPx,
}) {
  return computeInteriorWallChains({ polygons, meterByPx });
}
