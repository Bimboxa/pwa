import { useEffect, useMemo, useState } from "react";

import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";

import { getLinkedTemplateIds } from "../utils/linkedTemplateIds";

// "+" of the "Annotations liées" section ("Quantités" tab): how to link
// annotations to the business object. Step MODE: "Par annotation" (the
// existing picking mode on the map, one rel per clicked annotation) or
// "Par modèle" (whole-template link: every annotation of the template in the
// scope, present and future). Step TEMPLATE: the templates having
// annotations in the scope, not linked by template yet — multi-select.
// annotations: every annotation in scope; annotationTemplateById: templates
// index; spriteImage: the templates sprite (rows show the template icon and
// color, like the quantity cards); onLinkByAnnotation(): the caller enters
// the picking mode; onLinkByTemplate(annotationTemplateIds).
export default function DialogLinkBusinessObjectAnnotations({
  open,
  businessObject,
  annotations,
  annotationTemplateById,
  spriteImage,
  onClose,
  onLinkByAnnotation,
  onLinkByTemplate,
}) {
  // strings

  const titleS = "Lier des annotations";
  const byAnnotationS = "Par annotation";
  const byAnnotationHelperS =
    "Cliquez les annotations à lier sur le plan (mode liaison).";
  const byTemplateS = "Par modèle";
  const byTemplateHelperS =
    "Toutes les annotations du modèle dans le scope, présentes et futures (exclusions possibles ensuite).";
  const templateTitleS = "Lier par modèle";
  const emptyS = "Aucun modèle à lier dans ce scope";
  const cancelS = "Annuler";
  const backS = "Retour";
  const linkS = "Lier";

  // state — "MODE" | "TEMPLATE"

  const [step, setStep] = useState("MODE");
  const [selection, setSelection] = useState([]);

  useEffect(() => {
    if (open) {
      setStep("MODE");
      setSelection([]);
    }
  }, [open]);

  // helpers — templates with annotations in scope, not linked by template

  const templates = useMemo(() => {
    const linked = new Set(getLinkedTemplateIds(businessObject));
    const ids = new Set();
    (annotations ?? []).forEach((annotation) => {
      if (annotation.isMeshCell || !annotation.annotationTemplateId) return;
      ids.add(annotation.annotationTemplateId);
    });
    return [...ids]
      .filter((id) => !linked.has(id) && annotationTemplateById?.[id])
      .map((id) => annotationTemplateById[id])
      .sort((a, b) =>
        (a.label ?? "").localeCompare(b.label ?? "", "fr", {
          sensitivity: "base",
        })
      );
  }, [annotations, annotationTemplateById, businessObject]);

  // handlers

  function handleToggleTemplate(template) {
    setSelection((prev) =>
      prev.includes(template.id)
        ? prev.filter((id) => id !== template.id)
        : [...prev, template.id]
    );
  }

  function handleLink() {
    if (selection.length === 0) return;
    onLinkByTemplate(selection);
  }

  // render

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      {step === "MODE" ? (
        <>
          <DialogTitle>{titleS}</DialogTitle>
          <DialogContent sx={{ px: 1 }}>
            <List dense disablePadding>
              <ListItemButton onClick={onLinkByAnnotation}>
                <ListItemText
                  primary={byAnnotationS}
                  secondary={byAnnotationHelperS}
                />
              </ListItemButton>
              <ListItemButton onClick={() => setStep("TEMPLATE")}>
                <ListItemText
                  primary={byTemplateS}
                  secondary={byTemplateHelperS}
                />
              </ListItemButton>
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>{cancelS}</Button>
          </DialogActions>
        </>
      ) : (
        <>
          <DialogTitle>{templateTitleS}</DialogTitle>
          <DialogContent sx={{ px: 1, py: 0 }}>
            {templates.length === 0 ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ px: 2, py: 1 }}
              >
                {emptyS}
              </Typography>
            ) : (
              <List dense disablePadding>
                {templates.map((template) => {
                  const selected = selection.includes(template.id);
                  return (
                    <ListItemButton
                      key={template.id}
                      divider
                      selected={selected}
                      onClick={() => handleToggleTemplate(template)}
                      sx={{ gap: 1 }}
                    >
                      <AnnotationTemplateIcon
                        template={template}
                        size={20}
                        spriteImage={spriteImage}
                      />
                      <Typography
                        variant="body2"
                        noWrap
                        sx={{
                          flex: 1,
                          minWidth: 0,
                          fontWeight: selected ? "bold" : "normal",
                        }}
                      >
                        {template.label}
                      </Typography>
                      <Checkbox
                        size="small"
                        checked={selected}
                        tabIndex={-1}
                        disableRipple
                        sx={{ p: 0 }}
                      />
                    </ListItemButton>
                  );
                })}
              </List>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setStep("MODE")}>{backS}</Button>
            <Button onClick={onClose}>{cancelS}</Button>
            <Button
              variant="contained"
              disabled={selection.length === 0}
              onClick={handleLink}
            >
              {selection.length > 0 ? `${linkS} (${selection.length})` : linkS}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
