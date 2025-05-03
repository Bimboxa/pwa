import {useState} from "react";
import {useDispatch} from "react-redux";

import {setNewScope, setEditedScope, setIsEditingScope} from "../scopesSlice";

import useIsMobile from "Features/layout/hooks/useIsMobile";
import useScope from "../hooks/useScope";

import {Box} from "@mui/material";

import FormScope from "./FormScope";
import SectionScopeBottomActions from "./SectionScopeBottomActions";
import SectionNewScopePresetConfigs from "./SectionNewScopePresetConfigs";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

export default function SectionScope({forceNew, onSaved, newScopeProjectId}) {
  const dispatch = useDispatch();

  // state

  const [presetConfigKey, setPresetConfigKey] = useState("DEFAULT");

  // data

  const {value: scope, loading} = useScope({forceNew});
  const isMobile = useIsMobile();
  console.log("scope", scope, loading);

  // helpers

  const width = isMobile ? 1 : "400px";

  // handlers

  function handleChange(scope) {
    if (!scope.id) {
      dispatch(setNewScope(scope));
    } else {
      dispatch(setEditedScope(scope));
      dispatch(setIsEditingScope(true));
    }
  }

  function handleSaved(scope) {
    console.log("[SectionScope] new scope saved", scope);
    if (onSaved) onSaved(scope);
  }

  return (
    <Box
      sx={{
        width,
        height: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <BoxFlexVStretch>
        <Box sx={{width: 1, mb: 2}}>
          {!loading && <FormScope scope={scope} onChange={handleChange} />}
        </Box>
      </BoxFlexVStretch>
      <SectionScopeBottomActions
        forceNew={forceNew}
        newScopeProjectId={newScopeProjectId}
        onSaved={handleSaved}
      />
    </Box>
  );
}
