import { useState } from "react";
import { useRef, useEffect } from "react";

import { useSelector } from "react-redux";

import useLegendItems from "../hooks/useLegendItems";

import { Typography, Box, Divider } from "@mui/material";

import IconButtonDropDown from "Features/layout/components/IconButtonDropDown";
import Panel from "Features/layout/components/Panel";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import SectionLegendItems from "./SectionLegendItems";

import editor from "App/editor";

export default function PanelLegend({ printMode }) {
  const legendRef = useRef();

  // strings

  const title = "Légende";

  // data

  const legendItems = useLegendItems();
  const printModeEnabled = useSelector((s) => s.mapEditor.printModeEnabled);

  // state

  const [open, setOpen] = useState(true);

  // effect

  useEffect(() => {
    if (editor.mapEditor && legendRef.current) {
      editor.mapEditor.legendRef = legendRef;
    }
  }, [editor.mapEditor, legendRef.current]);

  return (
    <>
      {!printModeEnabled && (
        <Panel elevation={0}>
          <Box
            ref={printMode ? legendRef : null}
            sx={{
              width: 1,
              display: "flex",
              flexDirection: "column",
              ...(printMode && {
                border: (theme) => `1px solid ${theme.palette.divider}`,
              }),
              borderRadius: "8px",
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Typography sx={{ p: 0.5, fontWeight: "bold" }} variant="caption">
                {title}
              </Typography>
              <IconButtonDropDown
                open={open}
                onOpenChange={() => setOpen(!open)}
              />
            </Box>

            <BoxFlexVStretch sx={{ p: 1, display: open ? "flex" : "none" }}>
              <SectionLegendItems legendItems={legendItems} />
            </BoxFlexVStretch>
          </Box>
        </Panel>
      )}

      <Box
        ref={legendRef}
        sx={{
          position: "absolute",
          top: "-9999px",
          width: 1,
          display: "flex",
          flexDirection: "column",
          border: (theme) => `1px solid ${theme.palette.divider}`,
          borderRadius: "8px",
          bgcolor: "white",
        }}
      >
        <Typography sx={{ p: 0.5, fontWeight: "bold" }} variant="caption">
          {title}
        </Typography>
        <Divider sx={{ mb: 1 }} />

        <BoxFlexVStretch sx={{ p: 1 }}>
          <SectionLegendItems legendItems={legendItems} />
        </BoxFlexVStretch>
      </Box>
    </>
  );
}
