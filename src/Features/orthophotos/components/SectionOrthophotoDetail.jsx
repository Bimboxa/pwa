import { useRef } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setEditedOrthophotoId } from "../orthophotosSlice";

import { Avatar, Box, Button, Typography } from "@mui/material";
import Transform from "@mui/icons-material/Transform";

import db from "App/db/db";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldTextV2 from "Features/form/components/FieldTextV2";

import { replaceOrthophotoImageService } from "../services/orthophotoServices";
import { getDefaultOrthophotoCorners } from "../utils/getOrthophotoPlacement";

function ImageRow({ label, image, onReplace }) {
  // strings

  const replaceS = "Remplacer";
  const addS = "Ajouter";
  const missingS = "Aucune image";

  // state

  const inputRef = useRef(null);

  // render

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 0.5 }}>
      <Avatar
        src={image?.thumbnail}
        variant="rounded"
        sx={{ width: 44, height: 44 }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="caption" color="text.secondary">
          {image?.imageSize
            ? `${image.imageSize.width} × ${image.imageSize.height} px`
            : missingS}
        </Typography>
      </Box>
      <Button
        size="small"
        color="inherit"
        onClick={() => inputRef.current?.click()}
      >
        {image ? replaceS : addS}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onReplace(file);
        }}
      />
    </Box>
  );
}

// Detail of the orthophoto selected in the Orthophotos tool: name, its two
// images, and the « Recaler » mode (outline + handles over the plan, see
// LayerOrthophotoStations).
export default function SectionOrthophotoDetail({ orthophoto, baseMap }) {
  const dispatch = useDispatch();

  // strings

  const nameS = "Nom";
  const orthoS = "Orthophoto rectifiée";
  const sourceS = "Image d'origine";
  const adjustS = "Recaler l'orthophoto";
  const stopAdjustS = "Terminer le recalage";
  const adjustHelpS =
    "Centre : déplacer. Coin : tourner et mettre à l'échelle. Alt + coin : déformer ce coin seul.";
  const stationHelpS =
    "Faites glisser la pastille sur le plan pour déplacer la station.";
  const resetS = "Réinitialiser le calage";
  const pendingHelpS =
    "Photo à assembler : générez le prompt IA depuis « Ajouter des photos », ou ajoutez ici son orthophoto rectifiée.";

  // data

  const editedOrthophotoId = useSelector(
    (s) => s.orthophotos.editedOrthophotoId
  );

  // helpers

  const isAdjusting = editedOrthophotoId === orthophoto.id;
  // a photo waiting to be rectified has nothing to lay on the plan yet
  const isPending = !orthophoto.orthoImage?.fileName;

  // handlers

  function handleNameChange(name) {
    const next = String(name ?? "").trim();
    if (next && next !== orthophoto.name) {
      db.orthophotos.update(orthophoto.id, { name: next });
    }
  }

  // A rectified image given by hand to a photo that had none yet: it lands
  // centred on the plan, like an orthophoto added from the dialog.
  async function handleReplaceOrtho(file) {
    const image = await replaceOrthophotoImageService({
      orthophoto,
      role: "ortho",
      file,
    });
    if (!image || orthophoto.corners) return;
    await db.orthophotos.update(orthophoto.id, {
      corners: getDefaultOrthophotoCorners({
        baseMapSize: baseMap.getImageSize?.(),
        imageSize: image.imageSize,
      }),
      station: orthophoto.station ?? { x: 0.5, y: 0.5 },
    });
  }

  function handleResetCorners() {
    db.orthophotos.update(orthophoto.id, {
      corners: getDefaultOrthophotoCorners({
        baseMapSize: baseMap.getImageSize?.(),
        imageSize: orthophoto.orthoImage?.imageSize,
      }),
    });
  }

  // render

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <FieldTextV2
        key={orthophoto.id}
        label={nameS}
        value={orthophoto.name || ""}
        onChange={handleNameChange}
        options={{ showAsField: true, changeOnBlur: true, hideMic: true }}
      />

      <WhiteSectionGeneric>
        <ImageRow
          label={orthoS}
          image={orthophoto.orthoImage}
          onReplace={handleReplaceOrtho}
        />
        <ImageRow
          label={sourceS}
          image={orthophoto.sourceImage}
          onReplace={(file) =>
            replaceOrthophotoImageService({ orthophoto, role: "source", file })
          }
        />
      </WhiteSectionGeneric>

      {isPending ? (
        <Typography variant="caption" color="text.secondary">
          {pendingHelpS}
        </Typography>
      ) : (
        <WhiteSectionGeneric>
          <Button
            fullWidth
            size="small"
            variant={isAdjusting ? "contained" : "outlined"}
            startIcon={<Transform />}
            onClick={() =>
              dispatch(
                setEditedOrthophotoId(isAdjusting ? null : orthophoto.id)
              )
            }
          >
            {isAdjusting ? stopAdjustS : adjustS}
          </Button>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 1 }}
          >
            {isAdjusting ? adjustHelpS : stationHelpS}
          </Typography>
          {isAdjusting && (
            <Button
              size="small"
              color="inherit"
              onClick={handleResetCorners}
              sx={{ mt: 0.5 }}
            >
              {resetS}
            </Button>
          )}
        </WhiteSectionGeneric>
      )}
    </Box>
  );
}
