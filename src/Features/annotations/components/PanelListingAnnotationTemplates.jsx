import { useState } from "react";

import { useDispatch } from "react-redux";

import { setOpenedPanel } from "Features/listings/listingsSlice";

import useAnnotationTemplatesBySelectedListing from "../hooks/useAnnotationTemplatesBySelectedListing";
import useUpdateAnnotationTemplate from "../hooks/useUpdateAnnotationTemplate";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import SectionEditAnnotationTemplate from "./SectionEditAnnotationTemplate";
import SectionListAnnotationTemplates from "./SectionListAnnotationTemplates";
import useDeleteAnnotationTemplate from "../hooks/useDeleteAnnotationTemplate";

export default function PanelListingAnnotationTemplates() {
  const dispatch = useDispatch();

  // data

  const annotationTemplates = useAnnotationTemplatesBySelectedListing({
    sortByLabel: true,
    splitByIsFromAnnotation: true,
  });

  // data - func

  const updateAnnotationTemplate = useUpdateAnnotationTemplate();
  const deleteAnnotationTemplate = useDeleteAnnotationTemplate();

  // state

  const [selectedAnnotationTemplate, setSelectedAnnotationTemplate] =
    useState(null);

  // helpers

  const showEdit = selectedAnnotationTemplate !== null;

  // handlers

  function handleClick(annotationTemplate) {
    setSelectedAnnotationTemplate(annotationTemplate);
  }

  function handleCloseList() {
    dispatch(setOpenedPanel("LISTING"));
  }

  async function handleSave(annotationTemplate) {
    await updateAnnotationTemplate(annotationTemplate);
    setSelectedAnnotationTemplate(null);
  }

  async function handleDelete(annotationTemplate) {
    await deleteAnnotationTemplate(annotationTemplate.id);
    setSelectedAnnotationTemplate(null);
  }

  function handleClose() {
    setSelectedAnnotationTemplate(null);
  }

  return (
    <BoxFlexVStretch>
      {showEdit && (
        <SectionEditAnnotationTemplate
          annotationTemplate={selectedAnnotationTemplate}
          onSaveClick={handleSave}
          onDeleteClick={handleDelete}
          onCloseClick={handleClose}
        />
      )}
      {!showEdit && (
        <SectionListAnnotationTemplates
          annotationTemplates={annotationTemplates}
          onClick={handleClick}
          onClose={handleCloseList}
        />
      )}
    </BoxFlexVStretch>
  );
}
