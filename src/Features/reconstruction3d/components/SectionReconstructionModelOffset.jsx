import { useDispatch } from "react-redux";

import { triggerBaseMapsUpdate } from "Features/baseMaps/baseMapsSlice";

import { Stack, TextField, Typography } from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import db from "App/db/db";
import getBaseMapRenderScale, {
  getGlbModelUnitsPerPx,
} from "Features/baseMaps/js/getBaseMapRenderScale";

// World units per model unit: the model of a reconstruction follows the scale
// of its base map (scene3d.relativeToBaseMap — same ratio as the scanWrap
// scale of attachScene3dGlbToBaseMapGroup).
function getWorldPerModelUnit(baseMap) {
  const modelUnitsPerPx = getGlbModelUnitsPerPx(baseMap);
  if (!modelUnitsPerPx) return 1;
  const ratio = getBaseMapRenderScale(baseMap) / modelUnitsPerPx;
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
}

// « Calage » section of the Reconstruction 3D tool: the vertical offset of
// the model relative to the plane of the base map image
// (baseMap.scene3d.offsetZ, model units — 0 = the lowest point of the model
// sits on the plane). Typed in the units of the 3D scene.
export default function SectionReconstructionModelOffset({ baseMap }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Calage";
  const offsetS = "Décalage Z du modèle";
  const helperS =
    "Déplace le modèle 3D par rapport à l'image du fond de plan. À 0, le point le plus bas du modèle est posé sur l'image ; une valeur négative le descend.";

  // helpers

  const worldPerModelUnit = getWorldPerModelUnit(baseMap);
  const offsetZ = (Number(baseMap?.scene3d?.offsetZ) || 0) * worldPerModelUnit;
  const displayed = +offsetZ.toFixed(3);

  // handlers

  async function commitOffset(input) {
    const value = Number(input.value);
    if (!input.value || !Number.isFinite(value)) {
      input.value = String(displayed);
      return;
    }
    if (value === displayed) return;
    // re-read: the record may have changed since the render
    const record = await db.baseMaps.get(baseMap.id);
    if (!record?.scene3d) return;
    await db.baseMaps.update(baseMap.id, {
      scene3d: { ...record.scene3d, offsetZ: value / worldPerModelUnit },
    });
    dispatch(triggerBaseMapsUpdate());
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Stack spacing={1}>
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          {titleS}
        </Typography>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={1}
        >
          <Typography variant="body2">{offsetS}</Typography>
          <TextField
            key={displayed}
            type="number"
            size="small"
            defaultValue={displayed}
            aria-label={offsetS}
            sx={{
              width: 96,
              "& .MuiInputBase-root": { height: 32, fontSize: "0.8125rem" },
              "& .MuiInputBase-input": { px: 1, py: 0.5 },
            }}
            slotProps={{
              htmlInput: { step: 0.01 },
              input: {
                endAdornment: (
                  <Typography variant="caption" color="text.secondary">
                    m
                  </Typography>
                ),
              },
            }}
            onBlur={(event) => commitOffset(event.target)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter") event.target.blur();
            }}
          />
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {helperS}
        </Typography>
      </Stack>
    </WhiteSectionGeneric>
  );
}
