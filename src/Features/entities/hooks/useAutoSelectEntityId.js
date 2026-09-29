import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { setSelectedListingId } from "Features/listings/listingsSlice";

import db from "App/db/db";

export default function useAutoSelectEntityId() {

    const dispatch = useDispatch();

    // data

    const selectedNode = useSelector((s) => s.mapEditor.selectedNode);

    useLiveQuery(async () => {
        if (selectedNode?.nodeType === "ANNOTATION" && selectedNode?.nodeId) {
            const annotation = await db.annotations.get(selectedNode.nodeId);
            // templateless annotations ("Dessin" tool) carry no listing:
            // keep the selected one
            if (annotation?.listingId) {
                dispatch(setSelectedListingId(annotation.listingId));
            }
        }

    }, [selectedNode?.nodeId])


}