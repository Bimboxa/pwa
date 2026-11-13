import { useDispatch } from "react-redux";

import { triggerAnnotationTemplatesUpdate } from "Features/annotations/annotationsSlice";

import { Box, MenuItem, Select, Switch, Typography } from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import WhiteSectionTitle from "Features/form/components/WhiteSectionTitle";

import db from "App/db/db";
import useUpdateListing from "Features/listings/hooks/useUpdateListing";

import FieldsSystemParams from "./FieldsSystemParams";
import { SYSTEM_ROLE_SOURCE } from "../constants/systemConstants";
import useSystemProcedures from "../hooks/useSystemProcedures";

const NO_ROLE = "";

// « Système » section of an annotation listing (properties panel, « Avancé »
// tab): makes the listing DEFINE a system — `listing.system = { procedureKey,
// params }` — and gives every template its role in it
// (`template.systemRole`): the SOURCE the user draws, or one of the elements
// the procedure generates (`procedure.roles`).
// A system listing is hidden from the drawing lists; it is drawn through a
// template of shape « Système » of another listing.
export default function SectionListingSystem({ listing, annotationTemplates }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Système";
  const switchS = "Cette liste définit un système";
  const helperS =
    "Un système génère des annotations à partir d'une annotation source. La liste est alors masquée du dessin : on l'utilise via un modèle de forme « Système » dans une autre liste.";
  const procedureS = "Procédure";
  const noProcedureS = "Aucune procédure de système disponible.";
  const pickProcedureS = "Choisir…";
  const rolesS = "Rôle des modèles";
  const sourceS = "Source";
  const noneS = "—";
  const paramsS = "Paramètres par défaut";

  // data

  const updateListing = useUpdateListing();
  const procedures = useSystemProcedures();

  // helpers

  const system = listing?.system ?? null;
  const isSystem = Boolean(system);
  const procedure =
    procedures.find((p) => p.key === system?.procedureKey) ?? null;
  const roles = [
    { key: SYSTEM_ROLE_SOURCE, label: sourceS },
    ...(procedure?.roles ?? []),
  ];
  const params = { ...(procedure?.defaultParams ?? {}), ...system?.params };
  const templates = (annotationTemplates ?? []).filter(
    (t) => t?.id && !t.isDivider
  );

  // handlers

  function handleToggle(e) {
    if (!listing?.id) return;
    updateListing({
      id: listing.id,
      system: e.target.checked
        ? { procedureKey: procedures[0]?.key ?? null }
        : null,
    });
  }

  function handleProcedureChange(e) {
    updateListing({
      id: listing.id,
      system: { ...system, procedureKey: e.target.value || null },
    });
  }

  function handleParamChange(key, value) {
    updateListing({
      id: listing.id,
      system: {
        ...system,
        params: { ...(system?.params ?? {}), [key]: value },
      },
    });
  }

  async function handleRoleChange(template, role) {
    const nextRole = role || null;
    await db.transaction("rw", db.annotationTemplates, async () => {
      // a role is held by one template only
      if (nextRole) {
        const holders = templates.filter(
          (t) => t.id !== template.id && t.systemRole === nextRole
        );
        for (const holder of holders)
          await db.annotationTemplates.update(holder.id, { systemRole: null });
      }
      await db.annotationTemplates.update(template.id, {
        systemRole: nextRole,
      });
    });
    dispatch(triggerAnnotationTemplatesUpdate());
  }

  // render

  if (!listing?.id) return null;

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
        <WhiteSectionTitle>{titleS}</WhiteSectionTitle>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography variant="body2">{switchS}</Typography>
          <Switch size="small" checked={isSystem} onChange={handleToggle} />
        </Box>
        <Typography variant="caption" color="text.secondary">
          {helperS}
        </Typography>

        {isSystem && (
          <>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="body2" sx={{ flex: 1 }}>
                {procedureS}
              </Typography>
              {procedures.length > 0 ? (
                <Select
                  size="small"
                  displayEmpty
                  value={procedure?.key ?? ""}
                  onChange={handleProcedureChange}
                  sx={{ minWidth: 160, fontSize: 13 }}
                  renderValue={(key) =>
                    procedures.find((p) => p.key === key)?.label ??
                    pickProcedureS
                  }
                >
                  {procedures.map((p) => (
                    <MenuItem key={p.key} value={p.key} dense>
                      {p.label ?? p.key}
                    </MenuItem>
                  ))}
                </Select>
              ) : (
                <Typography variant="caption" color="text.disabled">
                  {noProcedureS}
                </Typography>
              )}
            </Box>

            {templates.length > 0 && (
              <>
                <WhiteSectionTitle sx={{ mt: 0.5 }}>{rolesS}</WhiteSectionTitle>
                {templates.map((template) => (
                  <Box
                    key={template.id}
                    sx={{ display: "flex", alignItems: "center", gap: 1 }}
                  >
                    <Typography
                      variant="body2"
                      noWrap
                      sx={{ flex: 1, minWidth: 0 }}
                    >
                      {template.label}
                    </Typography>
                    <Select
                      size="small"
                      displayEmpty
                      value={
                        roles.some((r) => r.key === template.systemRole)
                          ? template.systemRole
                          : NO_ROLE
                      }
                      onChange={(e) =>
                        handleRoleChange(template, e.target.value)
                      }
                      sx={{ minWidth: 130, fontSize: 13 }}
                      renderValue={(key) =>
                        roles.find((r) => r.key === key)?.label ?? noneS
                      }
                    >
                      <MenuItem value={NO_ROLE} dense>
                        {noneS}
                      </MenuItem>
                      {roles.map((r) => (
                        <MenuItem key={r.key} value={r.key} dense>
                          {r.label ?? r.key}
                        </MenuItem>
                      ))}
                    </Select>
                  </Box>
                ))}
              </>
            )}

            {procedure?.paramsDefinition?.length > 0 && (
              <>
                <WhiteSectionTitle sx={{ mt: 0.5 }}>
                  {paramsS}
                </WhiteSectionTitle>
                <FieldsSystemParams
                  procedure={procedure}
                  values={params}
                  onChange={handleParamChange}
                />
              </>
            )}
          </>
        )}
      </Box>
    </WhiteSectionGeneric>
  );
}
