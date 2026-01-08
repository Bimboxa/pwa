import { useState, useEffect } from "react"

import { useDispatch, useSelector } from "react-redux"

import { setOpenedPanel, setSelectedListingId } from "../listingsSlice"

import useResolvedPresetListings from "../hooks/useResolvedPresetListings"

import useSelectedScope from "Features/scopes/hooks/useSelectedScope"
import useCreateListing from "../hooks/useCreateListing"
import useAddListingToScope from "Features/scopes/hooks/useAddListingToScope"

import { Box, Typography } from "@mui/material"

import ListItemsGeneric from "Features/layout/components/ListItemsGeneric";
import Panel from "Features/layout/components/Panel"
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import FormListing from "./FormListing";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

export default function PanelCreateListingV2({ onListingCreated }) {
    const dispatch = useDispatch()

    // strings

    const selectS = "Listes pré-configurées"

    // data

    const projectId = useSelector(s => s.projects.selectedProjectId)
    const presetListings = useResolvedPresetListings();
    const { value: scope } = useSelectedScope();
    const createListing = useCreateListing();
    const addListingToScope = useAddListingToScope();

    // state

    const [selectedPresetListing, setSelectedPresetListing] = useState(null);
    const [tempListing, setTempListing] = useState(selectedPresetListing);
    useEffect(() => {
        setTempListing({ ...selectedPresetListing, name: selectedPresetListing?.fullName })
    }, [selectedPresetListing?.key])

    // helpers

    const listings = presetListings.filter(listing => listing.annotationTemplatesLibrary)

    // helpers - steps

    let step = 1;
    if (selectedPresetListing) step = 2;

    // handlers

    function handleClick(listing) {
        setSelectedPresetListing(listing)
    }

    function handleChange(newListing) {
        setTempListing(tempListing => ({ ...tempListing, ...newListing }))
    }

    function handleBack() {
        setSelectedPresetListing(null)
    }

    async function handleCreate() {
        const newListing = {
            ...tempListing,
            projectId,
            canCreateItem: true,
        };
        if (newListing.entityModel) delete newListing.entityModel;

        // create listing
        const _newListing = await createListing({ listing: newListing, scope });

        // add listing to scope
        if (scope) {
            await addListingToScope({
                listingId: _newListing.id,
                listingTable: _newListing.table,
                scope,
            });
        }

        //
        dispatch(setSelectedListingId(_newListing.id));
        dispatch(setOpenedPanel("LISTING"))

        if (onListingCreated) onListingCreated(_newListing);
    }


    return (
        <Panel>
            {step === 1 && <BoxFlexVStretch>
                <Typography sx={{ p: 1 }} variant="body2" color="text.secondary">
                    {selectS}
                </Typography>

                <ListItemsGeneric items={listings} onClick={handleClick} labelKey="fullName" />
            </BoxFlexVStretch>}

            {step === 2 && <BoxFlexVStretch>
                <Box>
                    <ButtonGeneric
                        size="small"
                        onClick={handleBack}
                        label="Retour"
                    />
                </Box>
                <BoxFlexVStretch>
                    <FormListing
                        listing={tempListing}
                        onChange={handleChange}
                        variant="basic"
                    />
                </BoxFlexVStretch>
                <ButtonInPanelV2
                    onClick={handleCreate}
                    label="Créer"
                    variant="contained"
                    color="secondary"
                />

            </BoxFlexVStretch>}


        </Panel>
    )
}