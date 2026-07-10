import { useEffect } from "react";

import { useSelector, useDispatch } from "react-redux";

import { setStepKey } from "../scopeCreatorSlice";
import { setSelectedProjectId } from "../scopeCreatorSlice";

import { Box } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import BoxFlexHStretch from "Features/layout/components/BoxFlexHStretch";
import HeaderScopeCreator from "./HeaderScopeCreator";
import SectionSteps from "./SectionSteps";
import SectionStepper from "./SectionStepper";


export default function PageScopeCreator() {
  const dispatch = useDispatch();

  // data

  //const width = useSelector((s) => s.scopeCreator.stepPanelWidth);

  const projectId = useSelector(s => s.projects.selectedProjectId);
  const initialStepKey = useSelector(s => s.scopeCreator.initialStepKey);

  // effect - set initial step

  useEffect(() => {
    if (projectId) {
      dispatch(setStepKey("SELECT_PRESET_SCOPE"));
      dispatch(setSelectedProjectId(projectId));
    } else if (initialStepKey) {
      // one-shot step requested by the opener (e.g. dashboard "Nouveau
      // projet" → CREATE_PROJECT). Re-applied on StrictMode remount since
      // the unmount cleanup below resets stepKey.
      dispatch(setStepKey(initialStepKey));
    }
  }, [projectId]);

  useEffect(() => {
    return () => {
      dispatch(setSelectedProjectId(null));
      dispatch(setStepKey("SEARCH_PROJECT"));
    };
  }, []);

  return (
    <BoxFlexVStretch>
      <HeaderScopeCreator />
      <BoxFlexHStretch>

        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            width: 1,
            //width,
            //borderRight: (theme) => `1px solid ${theme.palette.divider}`,
          }}
        >
          <SectionStepper />
          <BoxFlexVStretch>
            <SectionSteps />
          </BoxFlexVStretch>

        </Box>
        {/* <BoxFlexVStretch sx={{ flex: 1, bgcolor: "background.default" }}>
          <SectionStepDetail />
        </BoxFlexVStretch> */}
      </BoxFlexHStretch>
    </BoxFlexVStretch>
  );
}
