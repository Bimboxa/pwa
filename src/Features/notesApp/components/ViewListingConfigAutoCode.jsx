import { useLiveQuery } from "dexie-react-hooks";

import { Alert, Box, Typography } from "@mui/material";

import db from "App/db/db";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import WhiteSectionTitle from "Features/form/components/WhiteSectionTitle";
import FieldTextV2 from "Features/form/components/FieldTextV2";
import useBusinessObjects from "Features/businessObjects/hooks/useBusinessObjects";

import HeaderListingConfigView from "./HeaderListingConfigView";
import ListOptionsSelectable from "./ListOptionsSelectable";
import RowToggleWithHint from "./RowToggleWithHint";

import {
  DEFAULT_AUTO_CODE_SUFFIX,
  DANGLING_REF_LABEL,
  getClassifications,
  setAutoCode,
} from "../utils/notesAppListingSettings";
import { computeAutoCode } from "../utils/notesAppAutoCode";

// Automatic codification (mobile ConfigAutoCodeScreen): activation, source
// nomenclature among the listing's classifications, first suffix, and a
// live preview of the next code computed from the local business objects
// (the nomenclature's first object carrying a `code`, the listing's peers).
export default function ViewListingConfigAutoCode({
  listing,
  config,
  update,
  refs,
  navigate,
  appName,
}) {
  // strings

  const titleS = "Codification auto";
  const captionS = `Configuration ${appName} · ${listing?.name ?? ""}`;
  const activationS = "Activation";
  const enableS = "Activer la codification auto";
  const enableHintS =
    "Le code est calculé à partir de la catégorie de classification de l'objet et d'un suffixe incrémental.";
  const warningS =
    "Aucune nomenclature liée à cette liste. Ajoutez d'abord un champ « Catégorie » dans le modèle de fiche.";
  const formatS = "Format";
  const sourceS = "Nomenclature source";
  const suffixS = "1er suffixe";
  const suffixHintS = "Ex : -001 → premier code « P-AC-001 », puis -002…";
  const previewS = "Aperçu";
  const previewEmptyS =
    "Aucune catégorie avec un code dans la nomenclature : pas de code calculable.";
  const nextCodeS = "Prochain code";

  // data

  const { settings } = config;
  const classifications = getClassifications(settings);
  const ac = settings.autoCode ?? {};
  const enabled = !!ac.enabled;
  const firstSuffix =
    typeof ac.firstSuffix === "string" && ac.firstSuffix.length > 0
      ? ac.firstSuffix
      : DEFAULT_AUTO_CODE_SUFFIX;
  const nomenclatureListingId =
    ac.nomenclatureListingId ||
    classifications[0]?.nomenclatureListingId ||
    null;

  const { value: peers } = useBusinessObjects({ listingId: listing?.id });
  const previewCategory = useLiveQuery(async () => {
    if (!nomenclatureListingId) return null;
    const rows = (
      await db.businessObjects
        .where("listingId")
        .equals(nomenclatureListingId)
        .toArray()
    ).filter((o) => !o.deletedAt);
    return (
      rows.find((o) => o.code && String(o.code).length > 0) ?? rows[0] ?? null
    );
  }, [nomenclatureListingId]);

  // helpers

  const sourceOptions = classifications.map((c) => ({
    value: c.nomenclatureListingId,
    label:
      refs.listingById[c.nomenclatureListingId]?.name || DANGLING_REF_LABEL,
    desc: c.label || undefined,
  }));
  const noClassification = classifications.length === 0;
  const previewCode = enabled
    ? computeAutoCode({
        autoCode: { enabled: true, firstSuffix, nomenclatureListingId },
        categoryEntity: previewCategory,
        listingPeers: peers ?? [],
      })
    : null;

  // handlers

  const persist = (patch) =>
    update.updateSettings((s) =>
      setAutoCode(s, { enabled, firstSuffix, nomenclatureListingId, ...patch })
    );

  // render

  return (
    <>
      <HeaderListingConfigView
        caption={captionS}
        title={titleS}
        onBack={navigate.pop}
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
        <WhiteSectionTitle>{activationS}</WhiteSectionTitle>
        <RowToggleWithHint
          label={enableS}
          hint={enableHintS}
          checked={enabled}
          onChange={(v) => persist({ enabled: v })}
        />

        {noClassification ? (
          <Alert severity="warning" sx={{ fontSize: 12 }}>
            {warningS}
          </Alert>
        ) : (
          <>
            <WhiteSectionTitle sx={{ mt: 1 }}>{formatS}</WhiteSectionTitle>
            <WhiteSectionGeneric>
              <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                {sourceS}
              </Typography>
              <ListOptionsSelectable
                options={sourceOptions}
                value={nomenclatureListingId}
                onSelect={(id) => persist({ nomenclatureListingId: id })}
                disabled={!enabled}
              />
            </WhiteSectionGeneric>
            <FieldTextV2
              label={suffixS}
              value={firstSuffix}
              onChange={(v) =>
                persist({ firstSuffix: v || DEFAULT_AUTO_CODE_SUFFIX })
              }
              options={{
                showAsSection: true,
                showLabel: false,
                fullWidth: true,
                changeOnBlur: true,
                readOnly: !enabled,
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {suffixHintS}
            </Typography>

            <WhiteSectionTitle sx={{ mt: 1 }}>{previewS}</WhiteSectionTitle>
            <WhiteSectionGeneric>
              {previewCode ? (
                <>
                  <Typography variant="caption" color="text.secondary">
                    {nextCodeS}
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{ fontWeight: "bold", fontFamily: "monospace" }}
                  >
                    {previewCode}
                  </Typography>
                </>
              ) : (
                <Typography variant="caption" color="text.disabled">
                  {enabled ? previewEmptyS : "Codification inactive."}
                </Typography>
              )}
            </WhiteSectionGeneric>
          </>
        )}
      </Box>
    </>
  );
}
