import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setSelectedOrthophotoId } from "../orthophotosSlice";

import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";
import DialogAddOrthophoto from "./DialogAddOrthophoto";
import SectionOrthophotoDetail from "./SectionOrthophotoDetail";
import SectionOrthophotoAddPhotos from "./SectionOrthophotoAddPhotos";
import SectionOrthophotosArchive from "./SectionOrthophotosArchive";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useOrthophotos from "../hooks/useOrthophotos";
import {
  deleteOrthophotoService,
  isPendingOrthophoto,
} from "../services/orthophotoServices";

// Orthophotos tool of the right band (Fonds de plan module): the unit
// orthophotos of the selected orthomosaic base map — grid of square
// thumbnails (click selects, "x" on hover removes), add, the
// detail of the selected one (name, images, « Recaler ») and « Ajouter des
// photos » (Prompt IA round trip that builds the mosaic). While the tool
// is opened the stations are drawn over the plan and can be dragged
// (LayerOrthophotos).
export default function PanelOrthophotos() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Orthophotos";
  const selectS = "Sélectionnez un fond de plan";
  const notOrthophotoS =
    "Ce fond de plan n'est pas une orthomosaïque. Activez « Orthomosaïque » dans ses propriétés pour gérer ses orthophotos unitaires.";
  const emptyS = "Aucune orthophoto unitaire";
  const addS = "Ajouter une orthophoto";
  const removeS = "Retirer";
  const noSourceS = "Sans image d'origine";
  const pendingS = "À assembler";

  // data

  const baseMap = useMainBaseMap();
  const isOrthophoto = Boolean(baseMap?.isOrthophoto);
  const orthophotos = useOrthophotos({
    baseMapId: isOrthophoto ? baseMap.id : null,
  });
  const selectedOrthophotoId = useSelector(
    (s) => s.orthophotos.selectedOrthophotoId
  );

  // state

  const [openAdd, setOpenAdd] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  // helpers

  const selected = orthophotos.find((o) => o.id === selectedOrthophotoId);

  // handlers

  // A photo still waiting to be assembled is removed at once (nothing lies
  // on the plan yet); an assembled one asks first.
  async function handleRemove(orthophoto) {
    if (!isPendingOrthophoto(orthophoto)) {
      setToDelete(orthophoto);
      return;
    }
    await deleteOrthophotoService(orthophoto);
    if (orthophoto.id === selectedOrthophotoId) {
      dispatch(setSelectedOrthophotoId(null));
    }
  }

  // render

  if (!baseMap || !isOrthophoto) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {baseMap ? notOrthophotoS : selectS}
        </Typography>
      </Box>
    );
  }

  return (
    <BoxFlexVStretch>
      <Box sx={{ p: 0.5, pl: 2, py: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {titleS}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          {baseMap.name || "Fond de plan"}
        </Typography>
      </Box>

      <BoxFlexVStretch sx={{ overflow: "auto" }}>
        {orthophotos.length === 0 && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ px: 2, py: 1 }}
          >
            {emptyS}
          </Typography>
        )}

        {/* Square thumbnails: click selects, the hovered one shows a "x" */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
            gap: 0.75,
            px: 1.5,
            py: 0.5,
          }}
        >
          {orthophotos.map((orthophoto) => {
            const isSelected = orthophoto.id === selectedOrthophotoId;
            const isPending = isPendingOrthophoto(orthophoto);
            const thumbnail =
              orthophoto.orthoImage?.thumbnail ??
              orthophoto.sourceImage?.thumbnail;
            return (
              <Tooltip
                key={orthophoto.id}
                title={
                  isPending
                    ? `${orthophoto.name} — ${pendingS}`
                    : orthophoto.sourceImage
                      ? orthophoto.name
                      : `${orthophoto.name} — ${noSourceS}`
                }
                placement="top"
                disableInteractive
              >
                <Box
                  onClick={() =>
                    dispatch(
                      setSelectedOrthophotoId(isSelected ? null : orthophoto.id)
                    )
                  }
                  sx={{
                    position: "relative",
                    aspectRatio: "1 / 1",
                    borderRadius: 1,
                    overflow: "hidden",
                    cursor: "pointer",
                    bgcolor: "grey.300",
                    backgroundImage: thumbnail ? `url("${thumbnail}")` : "none",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    outline: "2px solid",
                    outlineColor: isSelected ? "primary.main" : "transparent",
                    outlineOffset: isSelected ? 1 : 0,
                    "&:hover .orthophoto-remove": { opacity: 1 },
                  }}
                >
                  {/* name, on a dark band for any photo */}
                  <Typography
                    variant="caption"
                    sx={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: 0,
                      px: 0.5,
                      py: "1px",
                      display: "flex",
                      alignItems: "center",
                      gap: 0.5,
                      fontWeight: 700,
                      lineHeight: 1.4,
                      color: "common.white",
                      background:
                        "linear-gradient(transparent, rgba(0,0,0,0.65))",
                    }}
                  >
                    {isPending && (
                      <Box
                        sx={{
                          width: 6,
                          height: 6,
                          flexShrink: 0,
                          borderRadius: "50%",
                          bgcolor: "warning.main",
                        }}
                      />
                    )}
                    <Box
                      component="span"
                      sx={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {orthophoto.name}
                    </Box>
                  </Typography>

                  <IconButton
                    size="small"
                    className="orthophoto-remove"
                    title={removeS}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(orthophoto);
                    }}
                    sx={{
                      position: "absolute",
                      top: 2,
                      right: 2,
                      p: "2px",
                      opacity: 0,
                      transition: "0.15s",
                      color: "common.white",
                      bgcolor: "rgba(0,0,0,0.55)",
                      "&:hover": { bgcolor: "rgba(0,0,0,0.8)" },
                    }}
                  >
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              </Tooltip>
            );
          })}

          <Tooltip title={addS} placement="top" disableInteractive>
            <Box
              onClick={() => setOpenAdd(true)}
              sx={{
                aspectRatio: "1 / 1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 1,
                border: "1.5px dashed",
                borderColor: "divider",
                cursor: "pointer",
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <AddIcon sx={{ fontSize: 20, color: "text.disabled" }} />
            </Box>
          </Tooltip>
        </Box>

        {selected && (
          <Box sx={{ p: 1.5, pb: 0 }}>
            <SectionOrthophotoDetail orthophoto={selected} baseMap={baseMap} />
          </Box>
        )}

        <Box sx={{ p: 1.5 }}>
          <SectionOrthophotoAddPhotos
            baseMap={baseMap}
            orthophotos={orthophotos}
          />
        </Box>

        <Box sx={{ p: 1.5, pt: 0 }}>
          <SectionOrthophotosArchive
            baseMap={baseMap}
            orthophotos={orthophotos}
          />
        </Box>
      </BoxFlexVStretch>

      <DialogAddOrthophoto
        open={openAdd}
        onClose={() => setOpenAdd(false)}
        baseMap={baseMap}
        orthophotos={orthophotos}
        onAdded={(row) => row && dispatch(setSelectedOrthophotoId(row.id))}
      />

      <DialogDeleteRessource
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirmAsync={async () => {
          await deleteOrthophotoService(toDelete);
          if (toDelete?.id === selectedOrthophotoId) {
            dispatch(setSelectedOrthophotoId(null));
          }
          setToDelete(null);
        }}
      />
    </BoxFlexVStretch>
  );
}
