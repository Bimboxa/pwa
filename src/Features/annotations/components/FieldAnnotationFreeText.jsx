import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";

import FieldAnnotationFreeTextAlign from "./FieldAnnotationFreeTextAlign";
import FieldAnnotationFreeTextSize from "./FieldAnnotationFreeTextSize";
import FieldAnnotationFreeTextStyle from "./FieldAnnotationFreeTextStyle";
import FieldAnnotationFreeTextFill from "./FieldAnnotationFreeTextFill";
import FieldAnnotationFreeTextBorder from "./FieldAnnotationFreeTextBorder";

// Per-annotation FREE_TEXT style editor (PanelProperties): the template
// popover options laid flat as five cards (alignment / size / style / fill /
// border), each writing its own subset of the style props onto the
// annotation row. No padlock — override locks are a template-level concern
// (see FieldAnnotationTemplateFreeText).
export default function FieldAnnotationFreeText({ annotation }) {
  const updateAnnotation = useUpdateAnnotation();

  // handlers

  async function handlePatch(changes) {
    if (!annotation?.id) return;
    await updateAnnotation({ id: annotation.id, ...changes });
  }

  // render

  return (
    <>
      <FieldAnnotationFreeTextAlign value={annotation} onChange={handlePatch} />
      <FieldAnnotationFreeTextSize value={annotation} onChange={handlePatch} />
      <FieldAnnotationFreeTextStyle value={annotation} onChange={handlePatch} />
      <FieldAnnotationFreeTextFill value={annotation} onChange={handlePatch} />
      <FieldAnnotationFreeTextBorder
        value={annotation}
        onChange={handlePatch}
      />
    </>
  );
}
