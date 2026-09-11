import { Box, Button, List, Switch, Typography } from "@mui/material";
import { CloudUpload } from "@mui/icons-material";

import db from "App/db/db";
import useCanEditRecord from "App/hooks/useCanEditRecord";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import WhiteSectionTitle from "Features/form/components/WhiteSectionTitle";
import FieldTextV2 from "Features/form/components/FieldTextV2";
import ListItemButtonForward from "Features/layout/components/ListItemButtonForward";

import RowToggleWithHint from "./RowToggleWithHint";
import ChipsSelectorSingle from "./ChipsSelectorSingle";
import HeaderListingConfigView from "./HeaderListingConfigView";

import {
  MAP_CARD_DEFAULTS,
  DEFAULT_AUTO_CODE_SUFFIX,
  getMapLabelOptions,
  getMapCardSetting,
  getMapCardTextOptions,
  getEffectiveCardSource,
  usesListCard,
  setListCard,
  setBooleanSetting,
  setItemName,
  setIncrementalNaming,
  setIncrementalFirstName,
  setMapLabel,
  setMapCard,
} from "../utils/notesAppListingSettings";

// Landing view of the listing configuration — the "Identité" tab of the
// mobile ConfigEntityModelScreen: identity, naming, organisation flags, map
// label / object preview, exclusions, plus the rows opening the fields,
// state models and codification views. Rendered at the root of the
// "Avancé" tab (`isRoot`: link status + push button instead of the back
// header) — the sub-views it opens are stacked over the panel.
export default function ViewListingConfigMain({
  listing,
  config,
  update,
  navigate,
  pushConfig,
  appName,
  isRoot = false,
}) {
  // strings

  const titleS = "Configuration";
  const captionS = `Configuration ${appName} · ${listing?.name ?? ""}`;
  const pushS = `Envoyer vers ${appName}`;
  const linkedS = `Lié à ${appName}`;
  const dirtyS = "Modifications non envoyées";
  const notLinkedS = "Non lié";
  const identityS = "Identité";
  const nameS = "Nom";
  const itemNameS = "Nom d'un objet (singulier)";
  const itemNamePlaceholderS =
    "Ex : Site, Équipement… (défaut : nom de la liste)";
  const namingS = "Nommage";
  const incrementalS = "Nom incrémental";
  const firstNameS = "Premier nom";
  const firstNamePlaceholderS = "Ex : S-001, #01, 1…";
  const organisationS = "Organisation";
  const notesListS = "Liste de notes";
  const notesListHintS =
    "Les objets deviennent des notes (titre + texte/photo/audio). Pas de modèle de fiche ; chaque note peut être reliée à des objets d'autres listes via le bandeau « Contexte ».";
  const treeModeS = "Mode arbre (hiérarchie)";
  const locationListS = "Liste de localisations";
  const locationListHintS =
    "Ses objets servent de localisations dans l'onglet OBJETS : on y crée des objets déjà reliés à la localisation courante. Activez le mode arbre pour une hiérarchie bâtiment / niveau / pièce.";
  const locatableS = "Objets localisables";
  const locatableHintS =
    "La liste apparaît en chip dans l'onglet OBJETS, même vide, et le disque central propose d'y créer un objet posé sur la localisation courante.";
  const mapLabelS = "Repère sur le plan";
  const mapLabelHintS =
    "Texte affiché dans l'étiquette de l'objet sur les plans (le nom si la valeur est vide).";
  const mapCardS = "Aperçu de l'objet";
  const avatarS = "Avatar";
  const primaryS = "Texte principal";
  const secondaryS = "Texte secondaire";
  const mapCardHintS =
    "Cellule affichée quand on touche un objet sur un plan. Sans photo (ni photo de repli sur un objet lié), l'avatar est un disque à la couleur de la liste ; un texte vide retombe sur le nom (principal) ou le nom de la liste (secondaire).";
  const listCardS = "Utiliser cet aperçu dans la liste";
  const listCardHintS =
    "Les lignes de la liste affichent l'avatar et les deux textes au lieu du nom et du code.";
  const excludeLinksS = "Exclure des liens";
  const excludeQuickAccessS =
    "Exclure de l'accès rapide depuis le journal des notes";
  const modelS = "Modèle de fiche";
  const stateModelsS = "Listes d'état";
  const codificationS = "Codification";
  const autoCodeTitleS = "Affectation automatique d'un code";
  const autoCodeInactiveS = "Inactive — calcul depuis une nomenclature liée";

  // data

  const { guardEditRecord } = useCanEditRecord();
  const { settings, fields, stateModels, isLinked, isDirty } = config;

  // helpers

  const statusS = isDirty ? dirtyS : isLinked ? linkedS : notLinkedS;

  const isNotes = !!settings.isNotesListing;
  const isLocationList = !!settings.isLocationListing;

  const mapLabelOptions = getMapLabelOptions(fields);
  const mapLabelValue = settings.mapLabel || "name";
  const mapLabelActive = mapLabelOptions.some((o) => o.value === mapLabelValue)
    ? mapLabelValue
    : "name";

  const cardAvatarOptions = [
    { value: "photo", label: "Photo" },
    { value: "none", label: "Aucun" },
  ];
  const cardTextOptions = getMapCardTextOptions(fields);
  const cardSecondaryOptions = [
    { value: "none", label: "Aucun" },
    ...cardTextOptions,
  ];
  const mapCard = getMapCardSetting(settings);
  const listCard = usesListCard(settings);
  const cardActive = (key, options) => {
    const v = getEffectiveCardSource(fields, key, mapCard);
    return options.some((o) => o.value === v) ? v : MAP_CARD_DEFAULTS[key];
  };

  const fieldsCountS = `${fields.length} champ${fields.length > 1 ? "s" : ""}`;
  const stateModelsCountS = `${stateModels.length} liste${stateModels.length > 1 ? "s" : ""} d'état`;
  const autoCodeS = settings.autoCode?.enabled
    ? `Active · suffixe « ${settings.autoCode.firstSuffix || DEFAULT_AUTO_CODE_SUFFIX} »`
    : autoCodeInactiveS;

  // handlers

  async function handleNameChange(value) {
    if (!value || !listing?.id || !guardEditRecord(listing)) return;
    await db.listings.update(listing.id, { name: value });
    // the name is part of the Krnet config: stamp the local edit
    await update.mutateNotesApp((n) => n);
  }

  const toggle = (key) => (checked) =>
    update.updateSettings((s) => setBooleanSetting(s, key, checked));

  // render

  const pushButton = (
    <Button
      size="small"
      variant="outlined"
      startIcon={<CloudUpload />}
      onClick={() => pushConfig({ listingIds: [listing.id], force: true })}
      sx={{ whiteSpace: "nowrap", mr: 0.5 }}
    >
      {pushS}
    </Button>
  );

  return (
    <>
      {isRoot ? (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 1.5,
            py: 0.5,
            borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography
            variant="caption"
            noWrap
            sx={{
              flexGrow: 1,
              minWidth: 0,
              color: isDirty ? "warning.main" : "text.secondary",
            }}
          >
            {statusS}
          </Typography>
          {pushButton}
        </Box>
      ) : (
        <HeaderListingConfigView
          caption={captionS}
          title={titleS}
          onBack={navigate.pop}
          action={pushButton}
        />
      )}
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
        <WhiteSectionTitle>{identityS}</WhiteSectionTitle>
        <FieldTextV2
          label={nameS}
          value={listing?.name ?? ""}
          onChange={handleNameChange}
          options={{
            showAsSection: true,
            showLabel: false,
            fullWidth: true,
            changeOnBlur: true,
          }}
        />
        <FieldTextV2
          label={itemNameS}
          value={settings.itemName ?? ""}
          onChange={(v) => update.updateSettings((s) => setItemName(s, v))}
          options={{
            showAsSection: true,
            showLabel: false,
            fullWidth: true,
            changeOnBlur: true,
            placeholder: itemNamePlaceholderS,
          }}
        />

        <WhiteSectionTitle sx={{ mt: 1 }}>{namingS}</WhiteSectionTitle>
        <RowToggleWithHint
          label={incrementalS}
          checked={!!settings.incrementalNaming}
          onChange={(v) =>
            update.updateSettings((s) => setIncrementalNaming(s, v))
          }
        />
        {settings.incrementalNaming && (
          <FieldTextV2
            label={firstNameS}
            value={settings.incrementalFirstName ?? ""}
            onChange={(v) =>
              update.updateSettings((s) => setIncrementalFirstName(s, v))
            }
            options={{
              showAsSection: true,
              showLabel: false,
              fullWidth: true,
              changeOnBlur: true,
              placeholder: firstNamePlaceholderS,
            }}
          />
        )}

        <WhiteSectionTitle sx={{ mt: 1 }}>{organisationS}</WhiteSectionTitle>
        <RowToggleWithHint
          label={notesListS}
          hint={notesListHintS}
          checked={isNotes}
          onChange={toggle("isNotesListing")}
        />
        {!isNotes && (
          <>
            <RowToggleWithHint
              label={treeModeS}
              checked={!!settings.treeMode}
              onChange={toggle("treeMode")}
            />
            <RowToggleWithHint
              label={locationListS}
              hint={locationListHintS}
              checked={isLocationList}
              onChange={toggle("isLocationListing")}
            />
            {!isLocationList && (
              <RowToggleWithHint
                label={locatableS}
                hint={locatableHintS}
                checked={!!settings.isLocatable}
                onChange={toggle("isLocatable")}
              />
            )}
            <WhiteSectionGeneric>
              <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
                {mapLabelS}
              </Typography>
              <ChipsSelectorSingle
                options={mapLabelOptions}
                value={mapLabelActive}
                onChange={(v) =>
                  update.updateSettings((s) => setMapLabel(s, v))
                }
              />
              <Typography
                variant="caption"
                sx={{ display: "block", color: "text.secondary", mt: 0.5 }}
              >
                {mapLabelHintS}
              </Typography>
            </WhiteSectionGeneric>
            <WhiteSectionGeneric>
              <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
                {mapCardS}
              </Typography>
              <Typography variant="caption" sx={{ display: "block", mb: 0.5 }}>
                {avatarS}
              </Typography>
              <ChipsSelectorSingle
                options={cardAvatarOptions}
                value={cardActive("avatar", cardAvatarOptions)}
                onChange={(v) =>
                  update.updateSettings((s) => setMapCard(s, "avatar", v))
                }
              />
              <Typography
                variant="caption"
                sx={{ display: "block", mt: 1, mb: 0.5 }}
              >
                {primaryS}
              </Typography>
              <ChipsSelectorSingle
                options={cardTextOptions}
                value={cardActive("primary", cardTextOptions)}
                onChange={(v) =>
                  update.updateSettings((s) => setMapCard(s, "primary", v))
                }
              />
              <Typography
                variant="caption"
                sx={{ display: "block", mt: 1, mb: 0.5 }}
              >
                {secondaryS}
              </Typography>
              <ChipsSelectorSingle
                options={cardSecondaryOptions}
                value={cardActive("secondary", cardSecondaryOptions)}
                onChange={(v) =>
                  update.updateSettings((s) => setMapCard(s, "secondary", v))
                }
              />
              <Typography
                variant="caption"
                sx={{ display: "block", color: "text.secondary", mt: 0.5 }}
              >
                {mapCardHintS}
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 1,
                  mt: 1,
                }}
              >
                <Typography variant="body2">{listCardS}</Typography>
                <Switch
                  size="small"
                  checked={listCard}
                  onChange={(e) =>
                    update.updateSettings((s) =>
                      setListCard(s, e.target.checked)
                    )
                  }
                />
              </Box>
              <Typography
                variant="caption"
                sx={{ display: "block", color: "text.secondary" }}
              >
                {listCardHintS}
              </Typography>
            </WhiteSectionGeneric>
            <RowToggleWithHint
              label={excludeLinksS}
              checked={!!settings.excludeFromLinks}
              onChange={toggle("excludeFromLinks")}
            />
            <RowToggleWithHint
              label={excludeQuickAccessS}
              checked={!!settings.excludeFromQuickAccess}
              onChange={toggle("excludeFromQuickAccess")}
            />
          </>
        )}

        <WhiteSectionGeneric>
          <List dense disablePadding sx={{ mx: -1 }}>
            {!isNotes && (
              <ListItemButtonForward
                label={`${modelS} · ${fieldsCountS}`}
                onClick={() => navigate.push({ key: "FIELDS" })}
                divider
              />
            )}
            <ListItemButtonForward
              label={`${stateModelsS} · ${stateModelsCountS}`}
              onClick={() => navigate.push({ key: "STATE_MODELS" })}
              divider={!isNotes}
            />
            {!isNotes && (
              <ListItemButtonForward
                label={`${codificationS} · ${autoCodeS}`}
                onClick={() => navigate.push({ key: "AUTO_CODE" })}
              />
            )}
          </List>
          {!isNotes && (
            <Typography
              variant="caption"
              sx={{ display: "block", color: "text.secondary", mt: 0.5 }}
            >
              {autoCodeTitleS}
            </Typography>
          )}
        </WhiteSectionGeneric>
      </Box>
    </>
  );
}
