import { useSelector, useDispatch } from "react-redux";

import { setPresetListingsKeys } from "Features/onboarding/onboardingSlice";
import { setSelectedListingId } from "../listingsSlice";

import useScope from "Features/scopes/hooks/useScope";
import useUpdateScope from "Features/scopes/hooks/useUpdateScope";
import useCreateListingsFromPresetListingsKeys from "../hooks/useCreateListingsFromPresetListingsKeys";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import { Box, Typography } from "@mui/material";

import SectionSelectorPresetListings from "./SectionSelectorPresetListings";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";

export default function PanelSelectorListingsOnboarding() {
  const dispatch = useDispatch();

  // strings

  const helperS = `Sélectionnez les "objets" que vous souhaitez repérer.`;
  const saveS = "Enregistrer";

  // data

  const presetListingsKeys = useSelector(
    (s) => s.onboarding.presetListingsKeys
  );
  const appConfig = useAppConfig();
  const { value: scope } = useScope();
  console.log("debug_2209_scope", presetListingsKeys);

  // data - func

  const createListings = useCreateListingsFromPresetListingsKeys();
  const updateScope = useUpdateScope();

  // handlers

  function handleChange(selection) {
    dispatch(setPresetListingsKeys(selection));
  }

  async function handleSave() {
    const newListings = await createListings({ presetListingsKeys });

    console.log("newListings", newListings);

    // selected listing
    dispatch(setSelectedListingId(newListings[0]?.id));

    // update scope
    if (newListings && scope) {
      const newScopeListings = newListings.map(({ id, table, type }) => ({
        id,
        table,
        type,
      }));

      const updates = {
        id: scope?.id,
        sortedListings: [...(scope?.sortedListings ?? []), ...newScopeListings],
      };

      // update scope
      if (scope) await updateScope(updates);
    }
  }
  return (
    <BoxFlexVStretch sx={{ bgcolor: "white" }}>
      <Box sx={{ p: 3 }}>
        <Box sx={{ p: 1, bgcolor: "secondary.main", borderRadius: "4px" }}>
          <Typography variant="body2" color="white">
            {helperS}
          </Typography>
        </Box>
      </Box>
      <SectionSelectorPresetListings
        selectedKeys={presetListingsKeys}
        onChange={handleChange}
        multiselection={true}
      />
      <ButtonInPanelV2
        label={saveS}
        onClick={handleSave}
        variant="contained"
        color="secondary"
        disabled={!presetListingsKeys?.length > 0}
      />
    </BoxFlexVStretch>
  );
}
