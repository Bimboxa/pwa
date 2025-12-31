import { useSelector } from "react-redux";

import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";


export default function useCreateBaseMaps() {

    const listingId = useSelector((s) => s.mapEditor.selectedBaseMapsListingId);
    const projectBaseMapListings = useProjectBaseMapListings();
    const createEntity = useCreateEntity();

    return async (baseMaps) => {

        const listing = projectBaseMapListings.find((l) => l.id === listingId);

        if (!listing) {
            throw new Error("No baseMap listing found");
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