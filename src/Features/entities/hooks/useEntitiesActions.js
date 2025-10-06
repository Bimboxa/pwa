import { useSelector, useDispatch } from "react-redux";
import { setOpenedPanel } from "Features/listings/listingsSlice";
import {
  setIsEditingEntity,
  setEditedEntity,
  setOpenDialogDeleteEntity,
} from "../entitiesSlice";

import useSelectedEntity from "./useSelectedEntity";
import useEntities from "./useEntities";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";

import { Edit, Delete, PictureAsPdf as PdfIcon } from "@mui/icons-material";

import createIssuesPdfReport from "Features/pdfReport/utils/createIssuesPdfReport";

export default function useEntitiesActions() {
  const dispatch = useDispatch();

  // data

  const selectedEntityId = useSelector((s) => s.entities.selectedEntityId);
  const { value: selectedEntity } = useSelectedEntity({ withImage: true });
  const { value: entities } = useEntities({
    withImages: true,
    withAnnotations: true,
  });
  const spriteImage = useAnnotationSpriteImage();

  // main

  const actions = [
    {
      label: "Modifier",
      icon: Edit,
      handler: () => {
        dispatch(setIsEditingEntity(true));
        dispatch(setEditedEntity(selectedEntity));
        dispatch(setOpenedPanel("EDITED_ENTITY"));
      },
      disabled: !selectedEntityId,
    },
    // {
    //   label: "PDF",
    //   icon: PdfIcon,
    //   handler: () => {
    //     createIssuesPdfReport(entities, { spriteImage });
    //   },
    // },
    {
      label: "Supprimer",
      icon: Delete,
      handler: () => {
        dispatch(setOpenDialogDeleteEntity(true));
      },
      disabled: !selectedEntityId,
    },
  ];

  return actions;
}
