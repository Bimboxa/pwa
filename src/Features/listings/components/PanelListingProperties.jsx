import { useState, useEffect } from "react";
import { useSelector } from "react-redux";

import useListings from "../hooks/useListings";
import useUpdateListing from "../hooks/useUpdateListing";
import useListingEntityModel from "../hooks/useListingEntityModel";

import { Box, Typography, Chip } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FormListing from "./FormListing";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import IconButtonMoreActionsListing from "./IconButtonMoreActionsListing";

export default function PanelListingProperties({ listing, onSaved }) {
    // data

    const projectId = useSelector((s) => s.projects.selectedProjectId);
    const { value: listings } = useListings({ filterByProjectId: projectId });
    const updateListing = useUpdateListing();
    const entityModel = useListingEntityModel(listing);

    // state

    const [tempListing, setTempListing] = useState(listing);

    useEffect(() => {
        if (listing) {
            setTempListing({
                ...listing,
                entityModel: entityModel || listing.entityModel
            });
        }
    }, [listing?.id, entityModel?.key]);

    // helpers

    const label = listing?.name ?? "Liste";

    // handlers

    function handleChange(updatedListing) {
        setTempListing(updatedListing);
    }

    async function handleSave() {
        const _listing = { ...tempListing };
        _listing.entityModelKey = _listing?.entityModel?.key;
        _listing.table = _listing?.table ?? _listing?.entityModel?.defaultTable;

        console.log("[PanelListingProperties] Saving...", _listing);
        await updateListing(_listing, { updateSyncFile: true });

        if (onSaved) onSaved();
    }

    return (
        <BoxFlexVStretch sx={{ height: '100%' }}>
            <Box sx={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                p: 0.5,
                pl: 2,
            }}>
                <Box>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontStyle: "italic", fontSize: (theme) => theme.typography.caption.fontSize }}>
                        Liste
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                        {label}
                    </Typography>
                </Box>
                <IconButtonMoreActionsListing listing={listing} />
            </Box>
            <BoxFlexVStretch sx={{ overflow: "auto" }}>
                <FormListing
                    listing={tempListing}
                    relatedListings={listings}
                    onChange={handleChange}
                />
                {listing?.articlesNomenclatures?.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                        <WhiteSectionGeneric>
                            <Typography variant="body2" sx={{ fontWeight: "bold", mb: 0.5 }}>
                                Articles
                            </Typography>
                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                                {listing.articlesNomenclatures.map((nom) => (
                                    <Chip
                                        key={nom.key}
                                        label={nom.label ?? nom.key}
                                        size="small"
                                        variant="outlined"
                                    />
                                ))}
                            </Box>
                        </WhiteSectionGeneric>
                    </Box>
                )}
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