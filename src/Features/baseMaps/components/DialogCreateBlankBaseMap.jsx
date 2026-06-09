import { useState } from "react";

import useCreateBaseMapFromImage from "Features/baseMaps/hooks/useCreateBaseMapFromImage";

import {
  Box,
  Typography,
  TextField,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import {
  CropLandscape as LandscapeIcon,
  CropSquare as SquareIcon,
  CropPortrait as PortraitIcon,
} from "@mui/icons-material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";

import createBlankImageFile from "Features/images/utils/createBlankImageFile";
import getBlankBaseMapGeometry, {
  FORMATS,
  SIZES,
  SCALES,
} from "../utils/getBlankBaseMapGeometry";

const FORMAT_LABELS = {
  paysage: { label: "Paysage", Icon: LandscapeIcon },
  carre: { label: "Carré", Icon: SquareIcon },
  portrait: { label: "Portrait", Icon: PortraitIcon },
};

export default function DialogCreateBlankBaseMap({
  open,
  onClose,
  listing,
  onCreated,
}) {
  // strings

  const title = "Ajouter une page blanche";
  const nameLabel = "Nom du fond de plan";
  const formatLabel = "Format";
  const sizeLabel = "Taille";
  const scaleLabel = "Échelle";
  const createS = "Créer le fond de plan";

  // data

  const createBaseMapFromImage = useCreateBaseMapFromImage();

  // state

  const [name, setName] = useState("");
  const [format, setFormat] = useState("portrait");
  const [size, setSize] = useState("A4");
  const [scale, setScale] = useState(50);

  // handlers

  function handleFormatChange(_, value) {
    if (value) setFormat(value);
  }
  function handleSizeChange(_, value) {
    if (value) setSize(value);
  }
  function handleScaleChange(_, value) {
    if (value) setScale(value);
  }

  async function handleCreate() {
    if (!name) return;

    const { pixelWidth, pixelHeight, meterByPx } = getBlankBaseMapGeometry({
      format,
      size,
      scale,
    });

    const file = await createBlankImageFile({
      width: pixelWidth,
      height: pixelHeight,
      fileName: `${name}.png`,
    });

    const entity = await createBaseMapFromImage({
      file,
      name,
      listing,
      meterByPx,
    });

    handleClose();
    if (onCreated) onCreated(entity);
  }

  function handleClose() {
    setName("");
    setFormat("portrait");
    setSize("A4");
    setScale(50);
    if (onClose) onClose();
  }

  // render

  return (
    <DialogGeneric open={open} onClose={handleClose} title={title} width={420}>
      <BoxFlexVStretch sx={{ p: 2, gap: 2, overflow: "auto" }}>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
            {nameLabel}
          </Typography>
          <TextField
            value={name}
            onChange={(e) => setName(e.target.value)}
            size="small"
            fullWidth
            autoFocus
          />
        </Box>

        <Box>
          <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
            {formatLabel}
          </Typography>
          <ToggleButtonGroup
            value={format}
            exclusive
            onChange={handleFormatChange}
            size="small"
            fullWidth
          >
            {FORMATS.map((f) => {
              const { label, Icon } = FORMAT_LABELS[f];
              return (
                <ToggleButton key={f} value={f}>
                  <Icon fontSize="small" sx={{ mr: 0.5 }} />
                  <Typography variant="body2">{label}</Typography>
                </ToggleButton>
              );
            })}
          </ToggleButtonGroup>
        </Box>

        <Box>
          <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
            {sizeLabel}
          </Typography>
          <ToggleButtonGroup
            value={size}
            exclusive
            onChange={handleSizeChange}
            size="small"
            fullWidth
          >
            {SIZES.map((s) => (
              <ToggleButton key={s} value={s}>
                <Typography variant="body2">{s}</Typography>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        <Box>
          <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
            {scaleLabel}
          </Typography>
          <ToggleButtonGroup
            value={scale}
            exclusive
            onChange={handleScaleChange}
            size="small"
            fullWidth
          >
            {SCALES.map((s) => (
              <ToggleButton key={s} value={s}>
                <Typography variant="body2">{`1:${s}`}</Typography>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      </BoxFlexVStretch>

      <Box>
        <ButtonInPanelV2
          label={createS}
          onClick={handleCreate}
          color="secondary"
          variant="contained"
          disabled={!name}
        />
      </Box>
    </DialogGeneric>
  );
}
