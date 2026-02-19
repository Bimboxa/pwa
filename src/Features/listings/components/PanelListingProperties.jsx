import { useState, useEffect } from "react";
import { useSelector } from "react-redux";

import useListings from "../hooks/useListings";
import useUpdateListing from "../hooks/useUpdateListing";
import useListingEntityModel from "../hooks/useListingEntityModel";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import FormListing from "./FormListing";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import HeaderListing from "./HeaderListing";

export default function PanelListingProperties({ listing, onSaved }) {
    // 1. Data & Hooks
    const projectId = useSelector((s) => s.projects.selectedProjectId);
    const listings = useListings({ filterByProjectId: projectId });
    const updateListing = useUpdateListing();
    const entityModel = useListingEntityModel(listing);

    // 2. État local pour le formulaire
    const [tempListing, setTempListing] = useState(listing);

    // Synchronisation si le listing ou l'entityModel change
    useEffect(() => {
        if (listing) {
            setTempListing({
                ...listing,
                entityModel: entityModel || listing.entityModel
            });
        }
    }, [listing?.id, entityModel?.key]);

    // 3. Handlers
    function handleChange(updatedListing) {
        setTempListing(updatedListing);
    }

    async function handleSave() {
        const _listing = { ...tempListing };
        _listing.entityModelKey = _listing?.entityModel?.key;
        _listing.table = _listing?.table ?? _listing?.entityModel?.defaultTable;

        console.log("[PanelListingProperties] Saving...", _listing);
        await updateListing(_listing, { updateSyncFile: true });

        // Callback optionnel pour fermer un parent ou notifier du succès
        if (onSaved) onSaved();
    }

    return (
        <BoxFlexVStretch sx={{ height: '100%' }}>
            <HeaderListing listing={listing} showMoreButton={false} />
            <BoxFlexVStretch sx={{ overflow: "auto" }}>
                <FormListing
                    listing={tempListing}
                    relatedListings={listings}
                    onChange={handleChange}
                />
            </BoxFlexVStretch>

            <ButtonInPanelV2
                label="Enregistrer"
                variant="contained"
                onClick={handleSave}
                sx={{ mt: 2 }}
            />
        </BoxFlexVStretch>
    );
}