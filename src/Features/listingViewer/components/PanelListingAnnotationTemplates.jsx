import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setSelectedItem, selectSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import {
  List,
  ListItemButton,
  Typography,
  Box,
} from "@mui/material";

import useAnnotationTemplatesBySelectedListing from "Features/annotations/hooks/useAnnotationTemplatesBySelectedListing";
import useAnnotationTemplateCountById from "Features/annotations/hooks/useAnnotationTemplateCountById";
import useAnnotationTemplateQtiesById from "Features/annotations/hooks/useAnnotationTemplateQtiesById";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import DialogCreateAnnotationTemplate from "Features/annotations/components/DialogCreateAnnotationTemplate";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SearchBar from "Features/search/components/SearchBar";

import getFoundItems from "Features/search/getFoundItems";

export default function PanelListingAnnotationTemplates({ listing }) {
  const dispatch = useDispatch();

  // state

  const [searchText, setSearchText] = useState("");
  const [openCreateDialog, setOpenCreateDialog] = useState(false);

  // data

  const selectedItem = useSelector(selectSelectedItem);

  const annotationTemplates = useAnnotationTemplatesBySelectedListing({
    sortByLabel: true,
  });
  const annotationTemplateCountById = useAnnotationTemplateCountById();
  const annotationTemplateQtiesById = useAnnotationTemplateQtiesById();

  // helpers

  const templates = annotationTemplates?.filter((t) => !t.isDivider) ?? [];

  const filteredTemplates = getFoundItems({
    items: templates,
    searchText,
    searchKeys: ["label"],
  });

  const color = listing?.color;

  // handlers

  function handleSearchTextChange(text) {
    setSearchText(text);
  }

  function handleCreateClick() {
    setOpenCreateDialog(true);
  }

  function handleCreateDialogClose() {
    setOpenCreateDialog(false);
  }

  function handleTemplateClick(template) {
    dispatch(
      setSelectedItem({ id: template.id, type: "ANNOTATION_TEMPLATE" })
    );
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  }

  // render

  return (
    <BoxFlexVStretch>
      <Box sx={{ width: 1, p: 1, pt: 2 }}>
        <SearchBar
          value={searchText}
          onChange={handleSearchTextChange}
          onCreateClick={handleCreateClick}
          color={color}
        />
      </Box>

      <BoxFlexVStretch sx={{ overflow: "auto" }}>
        <List disablePadding sx={{ bgcolor: "white", width: 1 }}>
          {filteredTemplates?.map((template) => {
            const count =
              annotationTemplateCountById?.[template.id] || 0;
            const qtyLabel =
              annotationTemplateQtiesById?.[template.id]?.mainQtyLabel;

            return (
              <ListItemButton
                key={template.id}
                divider
                selected={
                  selectedItem?.type === "ANNOTATION_TEMPLATE" &&
                  selectedItem?.id === template.id
                }
                onClick={() => handleTemplateClick(template)}
                sx={{
                  px: 1.5,
                  py: 1,
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    flex: 1,
                    minWidth: 0,
                    gap: 1.5,
                  }}
                >
                  <AnnotationTemplateIcon template={template} size={20} />
                  <Typography variant="body2" noWrap>
                    {template.label}
                  </Typography>
                </Box>

                <Typography
                  align="right"
                  noWrap
                  sx={{ fontSize: "12px", minWidth: "40px", ml: 1, fontFamily: "monospace", fontWeight: 500 }}
                  color={count > 0 ? "secondary.main" : "grey.200"}
                >
                  {qtyLabel}
                </Typography>
              </ListItemButton>
            );
          })}
        </List>
      </BoxFlexVStretch>

      <DialogCreateAnnotationTemplate
        open={openCreateDialog}
        onClose={handleCreateDialogClose}
        listingId={listing?.id}
      />
    </BoxFlexVStretch>
  );
}
