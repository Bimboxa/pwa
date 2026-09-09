import { useEffect, useState } from "react";

import { Box, Button, TextField, Typography } from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import WhiteSectionTitle from "Features/form/components/WhiteSectionTitle";
import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";

import HeaderListingConfigView from "./HeaderListingConfigView";
import ListOptionsSelectable from "./ListOptionsSelectable";
import RowToggleWithHint from "./RowToggleWithHint";

import {
  FIELD_TYPES,
  buildField,
  isFieldValid,
  getAutoTitle,
  syncDerivedFromFields,
  getFields,
} from "../utils/notesAppListingSettings";
import { buildDefaultStateModel } from "../utils/notesAppStateModels";

// Field editor (mobile FieldEditorScreen): label, type, per-type
// parameters, required flag; "Enregistrer" writes the field into
// settings.fields (classifications mirrored), "Supprimer" removes it —
// values already entered on the objects are kept, as in Krnet.

const EMPTY_DRAFT = {
  label: "",
  type: "photo",
  required: false,
  nomenclatureListingId: null,
  targetListingId: null,
  readOnly: false,
  stateModelId: null,
  sourceListingIds: [],
};

export default function ViewListingConfigField({
  listing,
  view,
  config,
  update,
  refs,
  navigate,
  appName,
}) {
  // strings

  const captionS = `Configuration ${appName} · ${listing?.name ?? ""}`;
  const newTitleS = "Nouveau champ";
  const editTitleS = "Modifier le champ";
  const saveS = "Enregistrer";
  const labelS = "NOM DU CHAMP *";
  const labelPlaceholderS = "Nom du champ…";
  const typeS = "TYPE";
  const nomenclatureS = "NOMENCLATURE";
  const nomenclatureEmptyS =
    "Aucune liste arbre disponible. Activez « Mode arbre » sur une autre liste pour la rendre éligible.";
  const targetS = "LISTE CIBLE";
  const targetIndirectS = "LISTE CIBLE (objets à afficher)";
  const targetEmptyS = "Aucune autre liste disponible";
  const readOnlyS = "Lecture seule";
  const readOnlyHintS =
    "Affiche le lien (ex. lien inverse) sans permettre de le modifier ici.";
  const sourcesS = "VIA LES LISTES (sources)";
  const sourcesHintS =
    "Les objets cibles seront cherchés parmi les objets liés appartenant à ces listes. Laisser vide = via tous les objets liés.";
  const stateModelS = "LISTE D'ÉTAT";
  const createStateModelS = "+ Créer une liste d'état";
  const editStatesS = "Modifier les états de cette liste ›";
  const requiredS = "Champ obligatoire";
  const deleteS = "Supprimer le champ";
  const deleteMessageS =
    "Ce champ sera retiré du modèle. Les valeurs déjà saisies restent dans les objets.";

  // data

  const fieldId = view?.fieldId ?? null;
  const isEditing = !!fieldId;
  const existing = isEditing
    ? config.fields.find((f) => f.id === fieldId)
    : null;
  const { stateModels } = config;

  // state

  const [draft, setDraft] = useState(() =>
    existing ? { ...EMPTY_DRAFT, ...existing } : EMPTY_DRAFT
  );
  const [titleTouched, setTitleTouched] = useState(!!existing);
  const [openDelete, setOpenDelete] = useState(false);

  // effects — the field vanished (sync, deletion elsewhere): close

  useEffect(() => {
    if (isEditing && !existing) navigate.pop();
  }, [isEditing, existing]);

  // helpers

  const type = draft.type;
  const listingName = (id) => refs.listingById[id]?.name || "";
  const toOptions = (listings) =>
    listings.map((l) => ({ value: l.id, label: l.name || "Sans nom" }));
  const typeOptions = FIELD_TYPES.map((t) => ({
    value: t.type,
    label: t.label,
    desc: t.desc,
  }));
  const stateModelOptions = stateModels.map((sm) => ({
    value: sm.id,
    label: sm.name || "État",
  }));
  const valid = isFieldValid(draft);

  function applyAutoTitle(next) {
    if (titleTouched || !next) return;
    setDraft((d) => ({ ...d, label: next }));
  }

  // handlers

  function handlePickType(t) {
    setDraft((d) => ({ ...d, type: t }));
    const sm = stateModels.find((s) => s.id === draft.stateModelId);
    applyAutoTitle(
      getAutoTitle(t, {
        listingName:
          t === "category"
            ? listingName(draft.nomenclatureListingId)
            : listingName(draft.targetListingId),
        stateModelName: sm?.name,
      })
    );
  }

  function handlePickNomenclature(id) {
    setDraft((d) => ({ ...d, nomenclatureListingId: id }));
    applyAutoTitle(listingName(id));
  }

  function handlePickTarget(id) {
    setDraft((d) => ({
      ...d,
      targetListingId: id,
      sourceListingIds: (d.sourceListingIds ?? []).filter((s) => s !== id),
    }));
    applyAutoTitle(listingName(id));
  }

  function handleToggleSource(id) {
    setDraft((d) => ({
      ...d,
      sourceListingIds: (d.sourceListingIds ?? []).includes(id)
        ? d.sourceListingIds.filter((s) => s !== id)
        : [...(d.sourceListingIds ?? []), id],
    }));
  }

  function handlePickStateModel(id) {
    setDraft((d) => ({ ...d, stateModelId: id }));
    applyAutoTitle(stateModels.find((s) => s.id === id)?.name);
  }

  async function handleCreateStateModel() {
    const sm = buildDefaultStateModel();
    await update.updateStateModels((sms) => [...sms, sm]);
    setDraft((d) => ({ ...d, stateModelId: sm.id }));
    applyAutoTitle(sm.name);
  }

  async function handleSave() {
    if (!valid) return;
    const field = buildField({ ...draft, id: fieldId ?? undefined });
    await update.updateSettings((s) => {
      const stored = getFields(s);
      const idx = stored.findIndex((f) => f.id === field.id);
      const next =
        idx === -1
          ? [...stored, field]
          : stored.map((f, i) => (i === idx ? field : f));
      return syncDerivedFromFields(s, next);
    });
    navigate.pop();
  }

  async function handleDelete() {
    await update.updateSettings((s) =>
      syncDerivedFromFields(
        s,
        getFields(s).filter((f) => f.id !== fieldId)
      )
    );
    setOpenDelete(false);
    navigate.pop();
  }

  // render

  return (
    <>
      <HeaderListingConfigView
        caption={captionS}
        title={isEditing ? editTitleS : newTitleS}
        onBack={navigate.pop}
        action={
          <Button
            size="small"
            variant="contained"
            disabled={!valid}
            onClick={handleSave}
            sx={{ mr: 0.5 }}
          >
            {saveS}
          </Button>
        }
      />
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          p: 1.5,
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        <WhiteSectionGeneric>
          <WhiteSectionTitle sx={{ mb: 1 }}>{labelS}</WhiteSectionTitle>
          <TextField
            size="small"
            fullWidth
            autoFocus={!isEditing}
            placeholder={labelPlaceholderS}
            value={draft.label}
            onChange={(e) => {
              setTitleTouched(true);
              setDraft((d) => ({ ...d, label: e.target.value }));
            }}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </WhiteSectionGeneric>

        <WhiteSectionGeneric>
          <WhiteSectionTitle>{typeS}</WhiteSectionTitle>
          <ListOptionsSelectable
            options={typeOptions}
            value={type}
            onSelect={handlePickType}
          />
        </WhiteSectionGeneric>

        {type === "category" && (
          <WhiteSectionGeneric>
            <WhiteSectionTitle>{nomenclatureS}</WhiteSectionTitle>
            <ListOptionsSelectable
              options={toOptions(refs.eligibleNomenclatures)}
              value={draft.nomenclatureListingId}
              onSelect={handlePickNomenclature}
              emptyHint={nomenclatureEmptyS}
            />
          </WhiteSectionGeneric>
        )}

        {(type === "linkSingle" || type === "linkMulti") && (
          <>
            <WhiteSectionGeneric>
              <WhiteSectionTitle>{targetS}</WhiteSectionTitle>
              <ListOptionsSelectable
                options={toOptions(refs.linkTargets)}
                value={draft.targetListingId}
                onSelect={handlePickTarget}
                emptyHint={targetEmptyS}
              />
            </WhiteSectionGeneric>
            <RowToggleWithHint
              label={readOnlyS}
              hint={readOnlyHintS}
              checked={!!draft.readOnly}
              onChange={(v) => setDraft((d) => ({ ...d, readOnly: v }))}
            />
          </>
        )}

        {type === "linkIndirect" && (
          <>
            <WhiteSectionGeneric>
              <WhiteSectionTitle>{targetIndirectS}</WhiteSectionTitle>
              <ListOptionsSelectable
                options={toOptions(refs.linkTargets)}
                value={draft.targetListingId}
                onSelect={handlePickTarget}
                emptyHint={targetEmptyS}
              />
            </WhiteSectionGeneric>
            <WhiteSectionGeneric>
              <WhiteSectionTitle>{sourcesS}</WhiteSectionTitle>
              <Typography
                variant="caption"
                sx={{ display: "block", color: "text.secondary", mb: 0.5 }}
              >
                {sourcesHintS}
              </Typography>
              <ListOptionsSelectable
                options={toOptions(
                  refs.linkTargets.filter((l) => l.id !== draft.targetListingId)
                )}
                values={draft.sourceListingIds ?? []}
                onSelect={handleToggleSource}
              />
            </WhiteSectionGeneric>
          </>
        )}

        {type === "state" && (
          <WhiteSectionGeneric>
            <WhiteSectionTitle>{stateModelS}</WhiteSectionTitle>
            <ListOptionsSelectable
              options={stateModelOptions}
              value={draft.stateModelId}
              onSelect={handlePickStateModel}
            />
            <Button
              size="small"
              onClick={handleCreateStateModel}
              sx={{ mt: 0.5 }}
            >
              {createStateModelS}
            </Button>
            {draft.stateModelId && (
              <Button
                size="small"
                onClick={() =>
                  navigate.push({
                    key: "STATE_MODEL",
                    stateModelId: draft.stateModelId,
                  })
                }
                sx={{ display: "block", mt: 0.5 }}
              >
                {editStatesS}
              </Button>
            )}
          </WhiteSectionGeneric>
        )}

        {type !== "linkIndirect" && (
          <RowToggleWithHint
            label={requiredS}
            checked={!!draft.required}
            onChange={(v) => setDraft((d) => ({ ...d, required: v }))}
          />
        )}

        {isEditing && (
          <Button
            size="small"
            color="error"
            variant="outlined"
            onClick={() => setOpenDelete(true)}
          >
            {deleteS}
          </Button>
        )}
      </Box>

      <DialogDeleteRessource
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        onConfirmAsync={handleDelete}
        message={deleteMessageS}
      />
    </>
  );
}
