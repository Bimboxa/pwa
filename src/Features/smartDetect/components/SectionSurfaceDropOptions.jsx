import { useDispatch, useSelector } from "react-redux";

import {
  setRawDetection,
  setNoCuts,
  setNoSmallCuts,
  setConvexHull,
} from "../smartDetectSlice";

import { Typography } from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldCheck from "Features/form/components/FieldCheck";

export default function SectionSurfaceDropOptions() {
  // data

  const dispatch = useDispatch();
  const rawDetection = useSelector((s) => s.smartDetect.rawDetection);
  const noCuts = useSelector((s) => s.smartDetect.noCuts);
  const noSmallCuts = useSelector((s) => s.smartDetect.noSmallCuts);
  const convexHull = useSelector((s) => s.smartDetect.convexHull);

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
    </WhiteSectionGeneric>
  );
}
