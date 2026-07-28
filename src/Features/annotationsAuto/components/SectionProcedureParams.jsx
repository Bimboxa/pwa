import { useDispatch, useSelector } from "react-redux";

import {
  setHeight,
  setWaterHeight,
  setReturnTechnique,
  setIgnoreInteriorWalls,
} from "../annotationsAutoSlice";

import hasProcedureParams from "../utils/hasProcedureParams";

import { Box, Typography, FormControlLabel, Checkbox } from "@mui/material";

import FieldTextV2 from "Features/form/components/FieldTextV2";
import FieldNumberWithUnit from "Features/form/components/FieldNumberWithUnit";

/**
 * Parameters of an automated procedure (height, water level, options), driven
 * by the procedure's show* flags in appConfig. Shared by the "Dessin auto"
 * panel and the "Auto" popper: both edit the same annotationsAuto slice state,
 * which useAnnotationsAutoRun reads at launch time.
 *
 * Renders nothing when the procedure exposes no parameter.
 */
export default function SectionProcedureParams({
  procedure,
  dense = false,
  sx,
}) {
  const dispatch = useDispatch();

  // data

  const height = useSelector((s) => s.annotationsAuto.height);
  const waterHeight = useSelector((s) => s.annotationsAuto.waterHeight);
  const returnTechnique = useSelector((s) => s.annotationsAuto.returnTechnique);
  const ignoreInteriorWalls = useSelector(
    (s) => s.annotationsAuto.ignoreInteriorWalls
  );

  // helpers

  const showHeightInput = procedure?.showHeightInput === true;
  const showCuvelageHeight = procedure?.showCuvelageHeight === true;
  const showWaterHeight = procedure?.showWaterHeight === true;
  const showReturnTechnique = procedure?.showReturnTechnique === true;

  // handlers

  function handleHeightChange(value) {
    dispatch(setHeight(value));
  }

  // render

  if (!hasProcedureParams(procedure)) return null;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: dense ? 1 : 2,
        ...sx,
      }}
    >
      {showHeightInput && (
        <FieldTextV2
          value={height ?? ""}
          onChange={handleHeightChange}
          label="Hauteur (m)"
          options={{
            showAsSection: true,
            isNumber: true,
            changeOnBlur: true,
          }}
        />
      )}

      {showCuvelageHeight && (
        <FieldNumberWithUnit
          value={height}
          onChange={handleHeightChange}
          label="Hauteur cuvelage"
          unit="m"
          helperText="Hauteur exprimée par rapport au fond de plan"
        />
      )}

      {showWaterHeight && (
        <FieldNumberWithUnit
          value={waterHeight}
          onChange={(v) => dispatch(setWaterHeight(v))}
          label="Hauteur d'eau"
          unit="m"
          helperText="Altitude absolue (scène 3D). Vide = ignorée"
        />
      )}

      {showReturnTechnique && (
        <FormControlLabel
          control={
            <Checkbox
              checked={returnTechnique ?? true}
              onChange={(e) => dispatch(setReturnTechnique(e.target.checked))}
              size="small"
            />
          }
          label={<Typography variant="body2">Retour technique 1m</Typography>}
        />
      )}

      {showReturnTechnique && (
        <FormControlLabel
          control={
            <Checkbox
              checked={ignoreInteriorWalls ?? false}
              onChange={(e) =>
                dispatch(setIgnoreInteriorWalls(e.target.checked))
              }
              size="small"
            />
          }
          label={
            <Typography variant="body2">Ignorer les murs intérieurs</Typography>
          }
        />
      )}
    </Box>
  );
}
