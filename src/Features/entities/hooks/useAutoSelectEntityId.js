import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { setSelectedEntityId } from "../entitiesSlice";
import { setSelectedListingId } from "Features/listings/listingsSlice";

import db from "App/db/db";

export default function useAutoSelectEntityId() {

    const dispatch = useDispatch();

    // data

    const selectedNode = useSelector((s) => s.mapEditor.selectedNode);

    useLiveQuery(async () => {
        if (selectedNode?.nodeType === "ANNOTATION") {
            const annotation = await db.annotations.get(selectedNode.nodeId);
            if (annotation) {
                dispatch(setSelectedEntityId(annotation.entityId));
                dispatch(setSelectedListingId(annotation.listingId));
            }
        }

    }, [selectedNode?.nodeId])


}