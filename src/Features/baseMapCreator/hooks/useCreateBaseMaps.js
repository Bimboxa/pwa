import { useSelector, useDispatch } from "react-redux";

import { setSelectedBaseMapsListingId } from "Features/mapEditor/mapEditorSlice";

import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";
import useCreateListing from "Features/listings/hooks/useCreateListing";
import useDefaultBaseMapsListingProps from "Features/baseMaps/hooks/useDefaultBaseMapsListingProps";

export default function useCreateBaseMaps() {

    const dispatch = useDispatch();

    const listingId = useSelector((s) => s.mapEditor.selectedBaseMapsListingId);
    const projectId = useSelector((s) => s.projects.selectedProjectId);
    const projectBaseMapListings = useProjectBaseMapListings();
    const createEntity = useCreateEntity();
    const createListing = useCreateListing();
    const defaultProps = useDefaultBaseMapsListingProps();

    return async (baseMaps) => {

        let listing = projectBaseMapListings.find((l) => l.id === listingId);

        if (!listing) {
            console.error("ERROR - No baseMap listing found => create new listing");
            // create baseMaps listing
            listing = await createListing({
                listing: { ...defaultProps, projectId },
            });
            dispatch(setSelectedBaseMapsListingId(listing?.id));
        }

        const entities = await Promise.all(baseMaps.map(async (baseMap) => {
            const entity = {
                name: baseMap.name,
                image: { file: baseMap.imageFile },
                meterByPx: baseMap.meterByPx,
            };
            return await createEntity(entity, { listing });
        }));

        return entities;
    }
}