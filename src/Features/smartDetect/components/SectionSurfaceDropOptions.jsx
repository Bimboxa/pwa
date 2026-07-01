import { useDispatch, useSelector } from "react-redux";

import {
  setRawDetection,
  setNoCuts,
  setNoSmallCuts,
  setConvexHull,
  setIgnoreBaseMap,
  setUseOutlines,
} from "../smartDetectSlice";

import { Box, Typography } from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldCheck from "Features/form/components/FieldCheck";

export default function SectionSurfaceDropOptions() {
  // data

  const dispatch = useDispatch();
  const rawDetection = useSelector((s) => s.smartDetect.rawDetection);
  const noCuts = useSelector((s) => s.smartDetect.noCuts);
  const noSmallCuts = useSelector((s) => s.smartDetect.noSmallCuts);
  const convexHull = useSelector((s) => s.smartDetect.convexHull);
  const ignoreBaseMap = useSelector((s) => s.smartDetect.ignoreBaseMap);
  const useOutlines = useSelector((s) => s.smartDetect.useOutlines);

  // render

  return (
    <WhiteSectionGeneric>
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          fontSize: "0.7rem",
          textTransform: "uppercase",
          color: "text.secondary",
          letterSpacing: 0.5,
          mb: 0.5,
          display: "block",
        }}
      >
        Outil remplissage
      </Typography>
      <FieldCheck
        value={useOutlines}
        onChange={(v) => dispatch(setUseOutlines(v))}
        label="Utiliser les contours"
        options={{ type: "check", showAsInline: true }}
      />
      <Box
        sx={{
          opacity: useOutlines ? 0.4 : 1,
          pointerEvents: useOutlines ? "none" : "auto",
        }}
      >
        <FieldCheck
          value={rawDetection}
          onChange={(v) => dispatch(setRawDetection(v))}
          label="Détection brute"
          options={{ type: "check", showAsInline: true }}
        />
        <FieldCheck
          value={noCuts}
          onChange={(v) => dispatch(setNoCuts(v))}
          label="Aucune ouverture"
          options={{ type: "check", showAsInline: true }}
        />
        <FieldCheck
          value={noSmallCuts}
          onChange={(v) => dispatch(setNoSmallCuts(v))}
          label="Aucune petite ouverture"
          options={{ type: "check", showAsInline: true }}
        />
        <FieldCheck
          value={convexHull}
          onChange={(v) => dispatch(setConvexHull(v))}
          label="Enveloppe convexe"
          options={{ type: "check", showAsInline: true }}
        />
        <FieldCheck
          value={ignoreBaseMap}
          onChange={(v) => dispatch(setIgnoreBaseMap(v))}
          label="Ignorer le fond de plan"
          options={{ type: "check", showAsInline: true }}
        />
      </Box>
    </WhiteSectionGeneric>
  );
}
