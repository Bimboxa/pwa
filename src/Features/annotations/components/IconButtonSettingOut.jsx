import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import useAnnotationTemplates from "../hooks/useAnnotationTemplates";
import useCreateSettingOutAnnotations from "../hooks/useCreateSettingOutAnnotations";
import useListings from "Features/listings/hooks/useListings";
import { resolveDrawingShape } from "../constants/drawingShapeConfig";

import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  InputBase,
  Popover,
  Tooltip,
  Typography,
} from "@mui/material";

import SelectorAnnotationTemplateVariantDense from "./SelectorAnnotationTemplateVariantDense";
import IconSettingOut from "./IconSettingOut";

export default function IconButtonSettingOut({ annotations, accentColor }) {
  // data

  const dispatch = useDispatch();
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const allTemplates = useAnnotationTemplates({ sortByLabel: true });
  const createSettingOut = useCreateSettingOutAnnotations();
  const { value: listings } = useListings({
    filterByScopeId: selectedScopeId,
    filterByEntityModelType: "LOCATED_ENTITY",
    excludeIsForBaseMaps: true,
  });

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stepM, setStepM] = useState("1");
  const [considerHeight, setConsiderHeight] = useState(true);
  const [considerAngle, setConsiderAngle] = useState(true);
  const [considerExtremities, setConsiderExtremities] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);

  // helpers

  const open = Boolean(anchorEl);

  // Source = POINT templates defined on the current scope only (same principle as
  // the "Dupliquer" selector: grouped by the scope's listings).
  const scopeListingIds = new Set((listings ?? []).map((l) => l.id));
  const pointTemplates = allTemplates?.filter(
    (t) =>
      resolveDrawingShape(t) === "POINT" && scopeListingIds.has(t.listingId)
  );

  const canRun =
    Boolean(selectedTemplateId) && Number(stepM) > 0 && !loading;

  // handlers

  function handleOpen(event) {
    setAnchorEl(anchorEl ? null : event.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  async function handleRun() {
    if (!canRun) return;
    setLoading(true);
    try {
      const created = await createSettingOut({
        annotations,
        annotationTemplateId: selectedTemplateId,
        options: {
          stepM: Number(stepM),
          considerHeight,
          considerAngle,
          considerExtremities,
        },
      });
      if (!created?.length) {
        dispatch(
          setToaster({ message: "Aucun point généré", isError: true })
        );
      } else {
        dispatch(
          setToaster({
            message: `${created.length} point${created.length > 1 ? "s" : ""} de calepinage créé${created.length > 1 ? "s" : ""}`,
          })
        );
        handleClose();
      }
    } catch (e) {
      console.error("[settingOut]", e);
      dispatch(setToaster({ message: "Erreur de calepinage", isError: true }));
    } finally {
      setLoading(false);
    }
  }

  // render

  return (
    <>
      <Tooltip title="Calepiner">
        <IconButton
          size="small"
          onClick={handleOpen}
          sx={{
            color: open ? accentColor : "text.disabled",
            bgcolor: open ? accentColor + "18" : "transparent",
            "&:hover": {
              color: accentColor,
              bgcolor: accentColor + "18",
            },
          }}
        >
          <IconSettingOut fontSize="small" />
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { borderRadius: 2, mt: 0.5 } } }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            px: 1.5,
            py: 1.5,
            width: 280,
            gap: 1,
          }}
        >
          {/* STEP (pill input, no number spinners) */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Pas
            </Typography>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                bgcolor: "action.hover",
                px: 1.5,
                py: 0.5,
                borderRadius: 1.5,
                minHeight: 32,
              }}
            >
              <InputBase
                value={stepM}
                onChange={(e) => setStepM(e.target.value.replace(",", "."))}
                inputProps={{ inputMode: "decimal" }}
                sx={{
                  width: 44,
                  fontSize: "0.875rem",
                  fontWeight: "bold",
                  "& input": { textAlign: "right", p: 0 },
                }}
              />
              <Typography
                variant="caption"
                sx={{ ml: 0.5, fontWeight: "bold", color: "text.secondary" }}
              >
                m
              </Typography>
            </Box>
          </Box>

          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={considerHeight}
                onChange={(e) => setConsiderHeight(e.target.checked)}
              />
            }
            label="Changements de hauteur"
            slotProps={{ typography: { variant: "body2" } }}
          />
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={considerAngle}
                onChange={(e) => setConsiderAngle(e.target.checked)}
              />
            }
            label="Ruptures d'angle"
            slotProps={{ typography: { variant: "body2" } }}
          />
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={considerExtremities}
                onChange={(e) => setConsiderExtremities(e.target.checked)}
              />
            }
            label="Aux extrémités"
            slotProps={{ typography: { variant: "body2" } }}
          />

          <Divider />

          <Box
            sx={{ height: 260, display: "flex", flexDirection: "column" }}
          >
            <SelectorAnnotationTemplateVariantDense
              selectedAnnotationTemplateId={selectedTemplateId}
              onChange={setSelectedTemplateId}
              annotationTemplates={pointTemplates}
              listings={listings}
            />
          </Box>

          <Button
            size="small"
            variant="contained"
            disabled={!canRun}
            onClick={handleRun}
            sx={{ mt: 0.5, textTransform: "none" }}
          >
            {loading ? (
              <CircularProgress size={18} thickness={5} />
            ) : (
              "Calepiner"
            )}
          </Button>
        </Box>
      </Popover>
    </>
  );
}
