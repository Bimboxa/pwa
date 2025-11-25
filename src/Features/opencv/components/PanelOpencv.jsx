import { useState, useMemo, useEffect, useCallback } from "react";

import { useDispatch, useSelector } from "react-redux";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import { Paper, Box, Typography, IconButton, Tabs, Tab } from "@mui/material";
import { ArrowDropDown as Down, ArrowDropUp as Up } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import ButtonEnhanceBaseMap from "Features/baseMaps/components/ButtonEnhanceBaseMap";
import ButtonRemoveText from "./ButtonRemoveText";
import ButtonRemoveColoredContent from "./ButtonRemoveColoredContent";
import ButtonKeepColoredContent from "./ButtonKeepColoredContent";
import ButtonGetHorizontalAndVerticalLines from "./ButtonGetHorizontalAndVerticalLines";
import ButtonCalculateOverlayTransform from "./ButtonCalculateOverlayTransform";
import ButtonDetectContours from "./ButtonDetectContours";
import ButtonDetectStraightLine from "./ButtonDetectStraightLine";
import SectionShowEnhanced from "Features/baseMaps/components/SectionShowEnhanced";
import SectionSaveOpencvPreview from "./SectionSaveOpencvPreview";

import ButtonToggleShowEnhanced from "./ButtonToggleShowEnhanced";
import ButtonOpencvDebug from "./ButtonOpencvDebug";
import ButtonFillHatch from "./ButtonFillHatch";
import ButtonRemoveThinRegions from "./ButtonRemoveThinRegions";
import ButtonToggleShowOpencvPreview from "./ButtonToggleShowOpencvPreview";

import { Divider } from "@mui/material";

function TabPanel({ children, value, index }) {
  if (value !== index) return null;
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {children}
    </Box>
  );
}

export default function PanelOpencv() {
  const dispatch = useDispatch();
  // strings

  const title = "Traitement d'image";
  const contoursS = "Détecter les contours";

  // state

  const [open, setOpen] = useState(true);

  // data

  const { value: listing } = useSelectedListing();
  const opencvPreviewUrl = useSelector((s) => s.opencv.opencvPreviewUrl);

  // helpers

  const em = listing?.entityModel?.type;
  console.log("em", em);

  // helpers - buttons

  const buttons = useMemo(
    () => [
      {
        key: "btn-enhance",
        component: <ButtonEnhanceBaseMap />,
        ems: ["BASE_MAP"],
        group: "Sat.",
      },
      {
        key: "btn-detect-straight-line",
        component: <ButtonDetectStraightLine />,
        ems: ["BASE_MAP"],
        group: "Prépa",
      },
      {
        key: "btn-remove-text",
        component: <ButtonRemoveText />,
        ems: ["BASE_MAP"],
        group: "Prépa",
      },
      {
        key: "btn-keep-colored",
        component: <ButtonKeepColoredContent />,
        ems: ["BASE_MAP"],
        group: "Prépa",
      },
      {
        key: "btn-remove-colored",
        component: <ButtonRemoveColoredContent />,
        ems: ["BASE_MAP"],
        group: "Prépa",
      },

      {
        key: "btn-get-lines",
        component: <ButtonGetHorizontalAndVerticalLines />,
        ems: ["BASE_MAP"],
        group: "Prépa",
      },
      {
        key: "btn-fill-hatch",
        component: <ButtonFillHatch />,
        ems: ["BASE_MAP"],
        group: "Prépa",
      },
      {
        key: "btn-remove-thin",
        component: <ButtonRemoveThinRegions />,
        ems: ["BASE_MAP"],
        group: "Prépa",
      },

      {
        key: "btn-detect-contours",
        component: <ButtonDetectContours />,
        ems: ["BASE_MAP", "LOCATED_ENTITY"],
        group: "Zones",
      },

      {
        key: "btn-overlay",
        component: <ButtonCalculateOverlayTransform />,
        ems: ["BASE_MAP"],
        group: "Autres",
      },
      {
        key: "btn-debug",
        component: <ButtonOpencvDebug />,
        ems: ["BASE_MAP"],
        group: "Autres",
      },
    ],
    [contoursS]
  );

  const availableGroups = useMemo(() => {
    return buttons
      .filter((btn) => btn.ems.includes(em))
      .reduce((acc, btn) => {
        if (!acc[btn.group]) acc[btn.group] = [];
        acc[btn.group].push(btn);
        return acc;
      }, {});
  }, [buttons, em]);

  const groupNames = useMemo(
    () => Object.keys(availableGroups),
    [availableGroups]
  );
  const [activeGroup, setActiveGroup] = useState(null);

  useEffect(() => {
    if (!groupNames.length) {
      setActiveGroup(null);
      return;
    }
    setActiveGroup((prev) =>
      prev && groupNames.includes(prev) ? prev : groupNames[0]
    );
  }, [groupNames]);

  function handleTabChange(_evt, newValue) {
    setActiveGroup(newValue);
  }

  const tabValue = useMemo(() => {
    if (!groupNames.length) return null;
    return activeGroup ?? groupNames[0];
  }, [activeGroup, groupNames]);

  return (
    <Paper>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          p: 1,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          {title}
        </Typography>
        <IconButton size="small" onClick={() => setOpen((open) => !open)}>
          {open ? <Up fontSize="small" /> : <Down fontSize="small" />}
        </IconButton>
      </Box>
      {open && (
        <BoxFlexVStretch>
          <SectionShowEnhanced />
          {groupNames.length > 0 && tabValue && (
            <>
              <Tabs
                value={tabValue}
                onChange={handleTabChange}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ bgcolor: "background.default" }}
              >
                {groupNames.map((group) => (
                  <Tab key={group} value={group} label={group} />
                ))}
              </Tabs>

              {groupNames.map((group) => (
                <TabPanel key={`panel-${group}`} value={tabValue} index={group}>
                  <Box sx={{ py: 2 }}>
                    {availableGroups[group].map((btn) => (
                      <Box key={btn.key}>{btn.component}</Box>
                    ))}
                  </Box>
                </TabPanel>
              ))}
            </>
          )}

          <Divider sx={{ my: 2 }} />
          <SectionSaveOpencvPreview />
          <ButtonToggleShowOpencvPreview />
        </BoxFlexVStretch>
      )}
    </Paper>
  );
}
