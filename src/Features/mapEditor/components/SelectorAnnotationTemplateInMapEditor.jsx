import { useState } from "react";

import { useSelector, useDispatch } from "react-redux";

import { setSelectedAnnotationTemplateId } from "../mapEditorSlice";

import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useAnnotationTemplatesListingInMapEditor from "Features/annotations/hooks/useAnnotationTemplatesListingInMapEditor";

import { Box, Paper, ListItemButton, Typography } from "@mui/material";
import { ArrowDropDown as Down } from "@mui/icons-material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

import SelectorAnnotationTemplateVariantList from "Features/annotations/components/SelectorAnnotationTemplateVariantList";
import MarkerIcon from "Features/markers/components/MarkerIcon";

import getPropsFromAnnotationTemplateId from "Features/annotations/utils/getPropsFromAnnotationTemplateId";

export default function SelectorAnnotationTemplateInMapEditor() {
  const dispatch = useDispatch();

  // data

  const spriteImage = useAnnotationSpriteImage();
  const templateId = useSelector(
    (s) => s.mapEditor.selectedAnnotationTemplateId
  );

  const { value: listing } = useSelectedListing();
  const annotationTemplates = useAnnotationTemplates({
    filterByAnnotationTemplatesListingKey: listing?.annotationTemplatesKey,
  });
  const annotationTemplatesListing = useAnnotationTemplatesListingInMapEditor();

  // state

  const [open, setOpen] = useState(false);

  // helper - annotation template

  const annotationTemplate = annotationTemplates?.find(
    (at) => at.id === templateId
  );

  // helper - label

  const label = annotationTemplate?.label || annotationTemplatesListing?.name;
  const { iconKey, fillColor } = annotationTemplate ?? {};

  // handlers

  function handleChange(id) {
    dispatch(setSelectedAnnotationTemplateId(id));
    setOpen(false);
  }

  return (
    <>
      <Paper sx={{ width: 200, bgcolor: "white", borderRadius: 1 }}>
        {!templateId && (
          <ListItemButton
            sx={{ p: 1, width: 1, justifyContent: "space-between" }}
            onClick={() => setOpen(true)}
          >
            <Typography noWrap variant="body2">
              {label}
            </Typography>
            <Down />
          </ListItemButton>
        )}
        {templateId && (
          <ListItemButton
            sx={{ p: 1, width: 1, justifyContent: "space-between" }}
            onClick={() => setOpen(true)}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                minWidth: 0,
              }}
            >
              <MarkerIcon
                iconKey={iconKey}
                fillColor={fillColor}
                spriteImage={spriteImage}
                size={18}
              />

              <Typography variant="body2" noWrap>
                {label}
              </Typography>
            </Box>
            <Down />
          </ListItemButton>
        )}
      </Paper>

      <DialogGeneric open={open} onClose={() => setOpen(false)}>
        <SelectorAnnotationTemplateVariantList
          title={annotationTemplatesListing?.name}
          selectedAnnotationTemplateId={templateId}
          onChange={handleChange}
          annotationTemplates={annotationTemplates}
          spriteImage={spriteImage}
          size={14}
        />
      </DialogGeneric>
    </>
  );
}
