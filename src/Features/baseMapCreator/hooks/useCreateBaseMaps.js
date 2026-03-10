import { nanoid } from "@reduxjs/toolkit";
import { useSelector, useDispatch } from "react-redux";

import { setSelectedBaseMapsListingId } from "Features/mapEditor/mapEditorSlice";

import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";
import useCreateListings from "Features/listings/hooks/useCreateListings";
import useDefaultBaseMapsListingProps from "Features/baseMaps/hooks/useDefaultBaseMapsListingProps";

import db from "App/db/db";

export default function useCreateBaseMaps() {

    const dispatch = useDispatch();

    const listingId = useSelector((s) => s.mapEditor.selectedBaseMapsListingId);
    const projectId = useSelector((s) => s.projects.selectedProjectId);
    const projectBaseMapListings = useProjectBaseMapListings();
    const createEntity = useCreateEntity();
    const createListings = useCreateListings();
    const defaultProps = useDefaultBaseMapsListingProps();

    return async (baseMaps) => {

        let listing = projectBaseMapListings.find((l) => l.id === listingId);

        if (!listing) {
            console.error("ERROR - No baseMap listing found => create new listing");
            const [created] = await createListings({
                listings: [{ ...defaultProps, projectId }],
            });
            listing = created;
            dispatch(setSelectedBaseMapsListingId(listing?.id));
        }

        const entities = await Promise.all(baseMaps.map(async (baseMap) => {
            const entity = {
                name: baseMap.name,
                image: { file: baseMap.imageFile },
                meterByPx: baseMap.meterByPx,
            };
            const _entity = await createEntity(entity, { listing });

            // Post-process: set up version system with initial version
            if (_entity?.id) {
                const record = await db.baseMaps.get(_entity.id);
                if (record?.image?.imageSize) {
                    await db.baseMaps.update(_entity.id, {
                        refWidth: record.image.imageSize.width,
                        refHeight: record.image.imageSize.height,
                    });
                    await db.baseMapVersions.put({
                        id: nanoid(),
                        baseMapId: _entity.id,
                        projectId: record.projectId,
                        listingId: record.listingId,
                        label: "Image d'origine",
                        fractionalIndex: "a0",
                        isActive: true,
                        image: record.image,
                        transform: { x: 0, y: 0, rotation: 0, scale: 1 },
                    });
                }
            }

            return _entity;
        }));

        return entities;
    }
}