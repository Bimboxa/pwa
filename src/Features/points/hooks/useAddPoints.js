import { useSelector } from "react-redux";
import db from "Features/db/db";

export default function useAddPoints() {

    const baseMapId = useSelector(s => s.mapEditor.selectedBaseMapId)

    const addPoints = async (points, options) => {

        try {
            points = points.map(point => {
                return {
                    ...point,
                    baseMapId: options?.baseMapId || baseMapId,
                }
            })

            // Use bulkPut instead of bulkAdd to replace existing points
            await db.points.bulkPut(points)
        } catch (e) {
            console.log("error adding points", e)
        }
    }

    return addPoints
}