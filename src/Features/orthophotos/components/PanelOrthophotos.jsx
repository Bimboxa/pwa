import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setSelectedOrthophotoId } from "../orthophotosSlice";

import {
  Avatar,
  Box,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutline from "@mui/icons-material/DeleteOutline";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";
import DialogAddOrthophoto from "./DialogAddOrthophoto";
import SectionOrthophotoDetail from "./SectionOrthophotoDetail";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useOrthophotos from "../hooks/useOrthophotos";
import { deleteOrthophotoService } from "../services/orthophotoServices";

// Orthophotos tool of the right band (Fonds de plan module): the unit
// orthophotos of the selected orthomosaic base map — list, add, delete, and
// the detail of the selected one (name, images, « Recaler »). While the tool
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
  const deleteS = "Supprimer";
  const noSourceS = "Sans image d'origine";

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
        <List dense disablePadding>
          {orthophotos.length === 0 && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ px: 2, py: 1 }}
            >
              {emptyS}
            </Typography>
          )}
          {orthophotos.map((orthophoto) => (
            <ListItemButton
              key={orthophoto.id}
              selected={orthophoto.id === selectedOrthophotoId}
              onClick={() =>
                dispatch(
                  setSelectedOrthophotoId(
                    orthophoto.id === selectedOrthophotoId
                      ? null
                      : orthophoto.id
                  )
                )
              }
              sx={{ "&:hover .orthophoto-delete": { opacity: 1 } }}
            >
              <Avatar
                src={orthophoto.orthoImage?.thumbnail}
                variant="rounded"
                sx={{ width: 28, height: 28, mr: 1.5 }}
              />
              <ListItemText
                primary={orthophoto.name}
                secondary={orthophoto.sourceImage ? null : noSourceS}
                slotProps={{
                  primary: { variant: "body2", noWrap: true },
                  secondary: { variant: "caption" },
                }}
              />
              <Tooltip title={deleteS}>
                <IconButton
                  size="small"
                  className="orthophoto-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    setToDelete(orthophoto);
                  }}
                  sx={{ opacity: 0, transition: "0.2s", p: 0.25 }}
                >
                  <DeleteOutline sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </ListItemButton>
          ))}

          <ListItemButton
            onClick={() => setOpenAdd(true)}
            sx={{ gap: 1.5, color: "text.disabled" }}
          >
            <Box
              sx={{
                width: 28,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 1,
                border: "1.5px dashed",
                borderColor: "divider",
              }}
            >
              <AddIcon sx={{ fontSize: 16, color: "text.disabled" }} />
            </Box>
            <Typography variant="body2" color="text.disabled">
              {addS}
            </Typography>
          </ListItemButton>
        </List>

        {selected && (
          <Box sx={{ p: 1.5 }}>
            <SectionOrthophotoDetail orthophoto={selected} baseMap={baseMap} />
          </Box>
        )}
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
