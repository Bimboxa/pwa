import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import { Box, ButtonBase, Typography } from "@mui/material";
import { Add } from "@mui/icons-material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import RowProcedureActionAuto from "Features/annotationsAuto/components/RowProcedureActionAuto";
import DialogAssociateSystemToAxis from "./DialogAssociateSystemToAxis";
import getRevolutionAxisProcedures, {
  splitRevolutionAxisProcedures,
} from "../utils/getRevolutionAxisProcedures";

// Section of the REVOLUTION_AXIS edit toolbar: the systems of the axis.
//
// - one launcher band (play / reset / refresh — RowProcedureActionAuto) per
//   system ASSOCIATED to the axis, i.e. whose params dialog was confirmed
//   once on it (procedureParams[procedureKey] stored on the row);
// - below, while at least one system is not associated yet, a grey
//   "Associer un système à l'axe" band opening the system picker
//   (DialogAssociateSystemToAxis).
//
// The axis row is read live by id so the bands appear as soon as the params
// dialog persists the association.
export default function SectionRevolutionAxisSystems({ axisId }) {
  // strings

  const associateS = "Associer un système à l'axe";

  // data

  const appConfig = useAppConfig();
  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );
  const axis = useLiveQuery(
    () => (axisId ? db.annotations.get(axisId) : null),
    [axisId, annotationsUpdatedAt]
  );

  const procedures = useMemo(
    () =>
      getRevolutionAxisProcedures(appConfig?.automatedAnnotationsProcedures),
    [appConfig?.automatedAnnotationsProcedures]
  );

  // state

  const [dialogOpen, setDialogOpen] = useState(false);

  // helpers

  const { associated, available } = splitRevolutionAxisProcedures(
    axis,
    procedures
  );

  // render

  if (!axis || axis.deletedAt || procedures.length === 0) return null;

  return (
    <>
      {associated.length > 0 && (
        <RowProcedureActionAuto
          annotation={axis}
          onlyProcedureKeys={associated.map((p) => p.key)}
        />
      )}

      {available.length > 0 && (
        <ButtonBase
          onClick={() => setDialogOpen(true)}
          sx={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 0.75,
            px: 1.25,
            py: 0.75,
            borderTop: "1px solid",
            borderColor: "divider",
            bgcolor: "action.hover",
            color: "text.secondary",
            "&:hover": { bgcolor: "action.selected", color: "text.primary" },
          }}
        >
          <Add sx={{ fontSize: 16 }} />
          <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
            {associateS}
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
        </ButtonBase>
      )}

      {dialogOpen && (
        <DialogAssociateSystemToAxis
          axis={axis}
          procedures={available}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </>
  );
}
