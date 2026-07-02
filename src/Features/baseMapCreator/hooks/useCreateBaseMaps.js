import { nanoid } from "@reduxjs/toolkit";
import { generateKeyBetween } from "fractional-indexing";
import { useSelector, useDispatch } from "react-redux";

import { setSelectedBaseMapsListingId } from "Features/mapEditor/mapEditorSlice";
import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";

import useUserEmail from "Features/auth/hooks/useUserEmail";
import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";
import useCreateListings from "Features/listings/hooks/useCreateListings";
import useDefaultBaseMapsListingProps from "Features/baseMaps/hooks/useDefaultBaseMapsListingProps";

import getEntityPureDataAndFilesDataByKey from "Features/entities/utils/getEntityPureDataAndFilesDataByKey";

import db from "App/db/db";

export default function useCreateBaseMaps() {

    const dispatch = useDispatch();

    const listingId = useSelector((s) => s.mapEditor.selectedBaseMapsListingId);
    const projectId = useSelector((s) => s.projects.selectedProjectId);
    const projectBaseMapListings = useProjectBaseMapListings();
    const createListings = useCreateListings();
    const defaultProps = useDefaultBaseMapsListingProps();
    const { value: userEmail } = useUserEmail();

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

        const table = listing.table ?? listing?.entityModel?.defaultTable;

        // The base maps listing sorts by `sortIndex` (fractional index) and
        // falls back to alphabetical name sorting when it is null — which
        // breaks page order (Page 1, Page 10, Page 11, Page 2, …). So we assign
        // a sortIndex to each created base map, in input (page) order, appended
        // after any base maps already present in the listing.
        const existing = (
            await db.baseMaps.where("listingId").equals(listing.id).toArray()
        ).filter((r) => !r.deletedAt);
        let prevSortIndex = existing
            .map((r) => r.sortIndex)
            .filter((s) => s != null)
            .reduce((max, s) => (max == null || s > max ? s : max), null);

        // 1. Preparation loop (sequential to preserve the input order — page
        // order for the "one base map per page" batch). All the image work
        // (imageSize, thumbnail) happens here, before any DB write, so each
        // record can be built complete in one shot (refWidth/refHeight,
        // placement, initial version) — no post-add update needed.
        const records = [];
        const versionRecords = [];
        const allFiles = [];

        for (const baseMap of baseMaps) {
            const sortIndex = generateKeyBetween(prevSortIndex, null);
            prevSortIndex = sortIndex;

            const entityId = nanoid();
            const result = await getEntityPureDataAndFilesDataByKey(
                {
                    name: baseMap.name,
                    image: { file: baseMap.imageFile },
                    meterByPx: baseMap.meterByPx,
                    sortIndex,
                },
                {
                    entityId,
                    projectId: listing.projectId,
                    listingId: listing.id,
                    listingTable: table,
                    createdBy: userEmail,
                }
            );
            if (!result) continue;

            const { pureData, filesDataByKey } = result;

            if (filesDataByKey) {
                allFiles.push(...Object.values(filesDataByKey).flat());
            }

            const record = {
                id: entityId,
                createdBy: userEmail,
                listingId: listing.id,
                ...pureData,
            };

            if (pureData.image?.imageSize) {
                record.refWidth = pureData.image.imageSize.width;
                record.refHeight = pureData.image.imageSize.height;

                // Persist the pre-computed 3D placement (same-page cuts) when
                // present, so the baseMap lands in the right spot in 3D.
                if (baseMap.position) {
                    record.orientation = baseMap.orientation;
                    record.angleDeg = baseMap.angleDeg;
                    record.position = baseMap.position;
                }

                // Tag as VERTICAL when dropped into a "coupes & élévations"
                // listing (verticalBaseMaps). This is the user's explicit
                // intent, so it overrides the placement's default HORIZONTAL
                // orientation (computeBaseMapsPlacements always returns
                // HORIZONTAL). Mirrors useCreateBaseMapFromImage so the PDF
                // import matches the blank-page path.
                if (listing?.verticalBaseMaps) {
                    record.orientation = "VERTICAL";
                }

                // Set up the version system with the initial version.
                versionRecords.push({
                    id: nanoid(),
                    baseMapId: entityId,
                    projectId: listing.projectId,
                    listingId: listing.id,
                    label: "Image d'origine",
                    fractionalIndex: "a0",
                    isActive: true,
                    image: pureData.image,
                    transform: { x: 0, y: 0, rotation: 0, scale: 1 },
                });
            }

            records.push(record);
        }

        // 2. Single transaction + single dispatch: one liveQuery invalidation
        // for the whole batch instead of ~4 per baseMap (each of which reloads
        // and re-hydrates every baseMap image of the project).
        if (records.length > 0) {
            await db.transaction(
                "rw",
                [db.files, db[table], db.baseMapVersions],
                async () => {
                    if (allFiles.length > 0) await db.files.bulkPut(allFiles);
                    await db[table].bulkAdd(records);
                    if (versionRecords.length > 0) {
                        await db.baseMapVersions.bulkAdd(versionRecords);
                    }
                }
            );
            dispatch(triggerEntitiesTableUpdate(table));
        }

        return records;
    }
}
