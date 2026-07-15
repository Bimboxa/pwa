import { useSelector, useDispatch } from "react-redux";

import {
  setAnchorPosition,
  setClickedNode,
} from "Features/contextMenu/contextMenuSlice";

import useAnnotationTemplateCandidates from "../hooks/useAnnotationTemplateCandidates";
import useChangeAnnotationTemplate from "../hooks/useChangeAnnotationTemplate";

import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import { Paper } from "@mui/material";
import SelectorAnnotationTemplateVariantDense from "./SelectorAnnotationTemplateVariantDense";

export default function ContextMenuAnnotationTemplates() {
  const dispatch = useDispatch();

  // data

  const clickedNode = useSelector((s) => s.contextMenu.clickedNode);
  const changeAnnotationTemplate = useChangeAnnotationTemplate();

  // helpers - annotation

  // Raw DB record on purpose: the template merge is written back to the DB,
  // so resolved pixel points must not leak into annotation.points.
  const annotation = useLiveQuery(async () => {
    if (!clickedNode?.id) return null;
    return await db.annotations.get(clickedNode.id);
  }, [clickedNode?.id]);

  // helpers - candidates

  const { candidates, listings } =
    useAnnotationTemplateCandidates(annotation, { variant: "sameType" }) ?? {};

  // handlers

  async function handleTemplateChange(annotationTemplateId) {
    const template = candidates?.find((t) => t.id === annotationTemplateId);
    await changeAnnotationTemplate(annotation, template);
    dispatch(setClickedNode(null));
    dispatch(setAnchorPosition(null));
  }

  // render

  return (
    <Paper
      sx={{
        width: 280,
        maxHeight: 420,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <SelectorAnnotationTemplateVariantDense
        selectedAnnotationTemplateId={annotation?.annotationTemplateId}
        onChange={handleTemplateChange}
        annotationTemplates={candidates}
        listings={listings}
      />
    </Paper>
  );
}
