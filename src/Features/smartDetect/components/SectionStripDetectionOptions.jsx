import { useDispatch, useSelector } from "react-redux";

import { setStripDetectionMultiple } from "Features/mapEditor/mapEditorSlice";

import { Typography } from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldCheck from "Features/form/components/FieldCheck";

export default function SectionStripDetectionOptions() {
  // data

  const dispatch = useDispatch();
  const stripDetectionMultiple = useSelector(
    (s) => s.mapEditor.stripDetectionMultiple
  );

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
        Détection bande
      </Typography>
      <FieldCheck
        value={stripDetectionMultiple}
        onChange={(v) => dispatch(setStripDetectionMultiple(v))}
        label="Détections multiples"
        options={{ type: "check", showAsInline: true }}
      />
    </WhiteSectionGeneric>
  );
}
