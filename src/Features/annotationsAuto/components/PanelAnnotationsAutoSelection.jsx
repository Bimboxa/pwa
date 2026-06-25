import { useState } from "react";
import { useDispatch } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import useAnnotationsAutoRun from "../hooks/useAnnotationsAutoRun";
import useSelectedAnnotationsByProcedure from "../hooks/useSelectedAnnotationsByProcedure";
import fireFlash from "../utils/fireFlash";

import {
  Box,
  Typography,
  Paper,
  Button,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
} from "@mui/material";
import { PlayArrow } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

export default function PanelAnnotationsAutoSelection() {
  const dispatch = useDispatch();

  // data

  const groups = useSelectedAnnotationsByProcedure();
  const run = useAnnotationsAutoRun();

  // state

  const [runningKey, setRunningKey] = useState(null);

  // handlers

  async function handleApply(group) {
    if (runningKey) return;
    setRunningKey(group.procedure.key);
    try {
      const result = await run({
        procedureKey: group.procedure.key,
        sourceAnnotationIds: group.annotations.map((a) => a.id),
      });
      const created = result?.annotations?.length ?? 0;
      const updated = result?.updatedAnnotations?.length ?? 0;
      if (created > 0 || updated > 0) {
        fireFlash();
        const message =
          created > 0
            ? `${created} annotation(s) créée(s)`
            : `${updated} annotation(s) mise(s) à jour`;
        dispatch(setToaster({ message }));
      } else {
        dispatch(
          setToaster({
            message:
              "Aucune annotation créée. Vérifiez les catégories des modèles.",
            severity: "warning",
          })
        );
      }
    } finally {
      setRunningKey(null);
    }
  }

  // render

  return (
    <BoxFlexVStretch>
      <Box sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: "bold", mb: 2 }}>
          Procédure
        </Typography>

        {groups.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Aucune procédure associée aux annotations sélectionnées.
          </Typography>
        )}

        {groups.map((group) => {
          const running = runningKey === group.procedure.key;
          return (
            <Paper
              key={group.procedure.key}
              sx={{
                p: 2,
                mb: 2,
                display: "flex",
                flexDirection: "column",
                gap: 1,
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: "bold" }}>
                {group.procedure.label}
              </Typography>

              <Typography variant="caption" color="text.secondary">
                {group.annotations.length} annotation
                {group.annotations.length > 1 ? "s" : ""} concernée
                {group.annotations.length > 1 ? "s" : ""}
              </Typography>

              <List
                dense
                disablePadding
                sx={{ maxHeight: 200, overflow: "auto" }}
              >
                {group.annotations.map((annotation) => (
                  <ListItem key={annotation.id} disableGutters sx={{ py: 0 }}>
                    <ListItemText
                      primary={annotation.label ?? annotation.id}
                      primaryTypographyProps={{
                        variant: "body2",
                        noWrap: true,
                      }}
                    />
                  </ListItem>
                ))}
              </List>

              <Button
                variant="contained"
                color="inherit"
                startIcon={
                  running ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    <PlayArrow />
                  )
                }
                onClick={() => handleApply(group)}
                disabled={Boolean(runningKey)}
                sx={{
                  bgcolor: "common.black",
                  color: "common.white",
                  "&:hover": { bgcolor: "grey.800" },
                  borderRadius: 6,
                }}
              >
                {running ? "En cours..." : "Appliquer la procédure"}
              </Button>
            </Paper>
          );
        })}
      </Box>
    </BoxFlexVStretch>
  );
}
