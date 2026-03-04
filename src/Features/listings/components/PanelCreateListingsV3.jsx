import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setSelectedListingId, setOpenedPanel } from "../listingsSlice";

import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useCreateListingsFromPresetListingsKeys from "../hooks/useCreateListingsFromPresetListingsKeys";
import useCreateListings from "../hooks/useCreateListings";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Box, Typography } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import BoxFlexHStretch from "Features/layout/components/BoxFlexHStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FormListing from "./FormListing";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import SectionPresetListingsSelector from "./SectionPresetListingsSelector";
import SectionPresetListingsPreview from "./SectionPresetListingsPreview";

export default function PanelCreateListingsV3({ onListingCreated, isForBaseMaps }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Ajouter des listes d'objets à repérer";
  const createS = "Créer";
  const backS = "Retour";

  // data

  const appConfig = useAppConfig();
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const { value: scope } = useSelectedScope();
  const createListingsFromPresets = useCreateListingsFromPresetListingsKeys();
  const createListings = useCreateListings();

  // state

  const [selectedKeys, setSelectedKeys] = useState([]);
  const [step, setStep] = useState("SELECT");
  const [tempListing, setTempListing] = useState({ name: "Nouvelle liste" });

  // helpers

  const defaultEntityModel = Object.values(
    appConfig?.entityModelsObject ?? {}
  ).find((em) => em.isDefault && em.type === "LOCATED_ENTITY");

  // handlers

  async function handleAddListings() {
    const listings = await createListingsFromPresets({
      presetListingsKeys: selectedKeys,
      scope,
      isForBaseMaps,
    });
    if (listings?.length > 0) {
      dispatch(setSelectedListingId(listings[0].id));
      dispatch(setOpenedPanel("LISTING"));
    }
    if (onListingCreated) onListingCreated();
  }

  function handleAddEmptyListing() {
    setStep("FORM");
    setTempListing({ name: "Nouvelle liste" });
  }

  function handleFormChange(newListing) {
    setTempListing((prev) => ({ ...prev, ...newListing }));
  }

  function handleBack() {
    setStep("SELECT");
  }

  async function handleCreateEmpty() {
    const resolvedEntityModel = tempListing?.entityModel ?? defaultEntityModel;
    const newListing = {
      ...tempListing,
      projectId,
      canCreateItem: true,
      table:
        tempListing?.table ??
        resolvedEntityModel?.defaultTable ??
        "entities",
      entityModel: resolvedEntityModel,
      ...(isForBaseMaps && { isForBaseMaps: true }),
    };
    if (newListing.entityModel) {
      newListing.entityModelKey = newListing.entityModel?.key;
    }

    const [_newListing] = await createListings({ listings: [newListing], scope });

    dispatch(setSelectedListingId(_newListing.id));
    dispatch(setOpenedPanel("LISTING"));

    if (onListingCreated) onListingCreated(_newListing);
  }

  // render - form step

  if (step === "FORM") {
    return (
      <BoxFlexVStretch>
        <Box>
          <ButtonGeneric size="small" onClick={handleBack} label={backS} />
        </Box>
        <BoxFlexVStretch>
          <FormListing
            listing={tempListing}
            onChange={handleFormChange}
            variant="standard"
            locatedListingOnly={true}
          />
        </BoxFlexVStretch>
        <ButtonInPanelV2
          onClick={handleCreateEmpty}
          label={createS}
          variant="contained"
          color="secondary"
        />
      </BoxFlexVStretch>
    );
  }

  // render - selection step

  return (
    <BoxFlexVStretch sx={{
      //overflow: "hidden"

    }}>
      <Box sx={{ p: 1 }}>
        <Typography variant="h6">{titleS}</Typography>
      </Box>

      <BoxFlexHStretch sx={{ flexGrow: 1, minHeight: 0, width: 1 }}>
        <Box sx={{ width: "50%", minWidth: 0, p: 1 }}>
          <WhiteSectionGeneric>
            <SectionPresetListingsSelector
              selectedKeys={selectedKeys}
              onChange={setSelectedKeys}
              isForBaseMaps={isForBaseMaps}
            />
          </WhiteSectionGeneric>
        </Box>

        <Box
          sx={{
            width: "50%",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <SectionPresetListingsPreview
            selectedKeys={selectedKeys}
            onAddListings={handleAddListings}
            onAddEmptyListing={handleAddEmptyListing}
          />
        </Box>
      </BoxFlexHStretch>
    </BoxFlexVStretch>
  );
}
