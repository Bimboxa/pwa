import { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import { setShowLayers } from "Features/popperMapListings/popperMapListingsSlice";

import { LOCKED_MODULE_KEYS } from "Features/viewers/hooks/useViewers";
import { SCOPE_MODULE_KEY } from "Features/listingViewer/utils/resolveScopeModuleLabel";
import { getBusinessObjectTypeKeyFromModuleKey } from "Features/businessObjects/utils/businessObjectModuleKeys";
import { getBusinessObjectType } from "Features/businessObjects/data/businessObjectTypesCatalog";

import useScopeConfigActions from "../hooks/useScopeConfigActions";
import {
  selectDisabledModuleKeys,
  selectDisabledToolKeys,
  selectDisabledToolKeysByModule,
  selectModuleLabelsByKey,
  selectModuleIconKeysByKey,
  selectDisabledBaseMapSourceKeys,
  selectSystemAnnotationTemplatesEnabled,
  selectLayersMode,
} from "../utils/scopeConfigSelectors";

import BASE_MAP_SOURCE_CATALOG from "Features/baseMaps/data/baseMapSourceCatalog";

import { Box, Divider, TextField, Typography } from "@mui/material";

import RowSwitchConfig from "./RowSwitchConfig";
import FieldModuleIconPicker from "./FieldModuleIconPicker";

// Module page of the Configuration dialog: activation of the module itself
// (a disabled module leaves the left band, its Ctrl+letter unbinds), the
// label / icon overrides of the business-objects modules (one per type of
// the registry, stored in scopeConfigs.moduleLabelsByKey /
// moduleIconKeysByKey — generic mechanisms, exposed for those modules only),
// then the per-module activation of the tools available in that module.
export default function PageModuleConfig({ module, tools }) {
  const dispatch = useDispatch();

  // data

  const disabledModuleKeys = useSelector(selectDisabledModuleKeys);
  // Dessin-only setting (moved from the popper's properties panel). Session
  // state: auto-enabled when the baseMap has layers (PopperMapListings).
  const showLayers = useSelector((s) => s.popperMapListings.showLayers);
  const disabledToolKeys = useSelector(selectDisabledToolKeys);
  const disabledToolKeysByModule = useSelector(selectDisabledToolKeysByModule);
  const moduleLabelsByKey = useSelector(selectModuleLabelsByKey);
  const moduleIconKeysByKey = useSelector(selectModuleIconKeysByKey);
  const disabledBaseMapSourceKeys = useSelector(
    selectDisabledBaseMapSourceKeys
  );

  const systemTemplatesEnabled = useSelector(
    selectSystemAnnotationTemplatesEnabled
  );
  const layersMode = useSelector(selectLayersMode);

  const {
    toggleModule,
    toggleToolInModule,
    toggleBaseMapSource,
    setSystemAnnotationTemplates,
    setLayersMode,
    setModuleLabel,
    setModuleIconKey,
  } = useScopeConfigActions();

  // state — module label override edited locally, committed on blur

  const labelOverride = moduleLabelsByKey[module.key] ?? "";
  const [labelDraft, setLabelDraft] = useState(labelOverride);

  useEffect(() => {
    setLabelDraft(labelOverride);
  }, [module.key, labelOverride]);

  // helpers

  const locked = LOCKED_MODULE_KEYS.has(module.key);
  const enabled = locked || !disabledModuleKeys.includes(module.key);
  const businessObjectTypeKey = getBusinessObjectTypeKeyFromModuleKey(
    module.key
  );
  // The SCOPE module reads moduleLabelsByKey too (useScopeModuleLabel), so it
  // is renamable per scope. Its icon is NOT configurable: only the
  // business-objects modules resolve moduleIconKeysByKey (useViewers hardcodes
  // every other module's icon), so the picker would be a dead control.
  const renamable =
    businessObjectTypeKey !== null || module.key === SCOPE_MODULE_KEY;
  const iconConfigurable = businessObjectTypeKey !== null;
  const defaultIconKey =
    module.defaultIconKey ??
    getBusinessObjectType(businessObjectTypeKey)?.defaultIconKey ??
    null;

  const moduleTools = tools.filter(
    (t) => !t.viewers || t.viewers.includes(module.key)
  );
  const disabledForModule = disabledToolKeysByModule[module.key] ?? [];

  // render

  return (
    <Box sx={{ px: 3, py: 2, maxWidth: 560 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
        <Box sx={{ display: "flex", color: "text.secondary" }}>
          {module.icon}
        </Box>
        <Typography variant="h6">{module.label}</Typography>
      </Box>

      <RowSwitchConfig
        label="Module actif"
        caption={
          locked
            ? "Toujours actif"
            : "Désactivé, le module disparaît du bandeau de gauche."
        }
        checked={enabled}
        disabled={locked}
        onChange={() => toggleModule(module.key)}
      />

      {renamable && (
        <>
          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Nom du module
          </Typography>

          <TextField
            fullWidth
            size="small"
            label="Nom affiché"
            placeholder={module.label}
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onBlur={() => {
              if (labelDraft.trim() !== labelOverride)
                setModuleLabel(module.key, labelDraft);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.target.blur();
            }}
            helperText="Nom du module pour ce dossier (bandeau de gauche, panneaux). Vide : nom par défaut."
          />
        </>
      )}

      {iconConfigurable && (
        <>
          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Icône du module
          </Typography>

          <FieldModuleIconPicker
            value={moduleIconKeysByKey[module.key] ?? null}
            defaultIconKey={defaultIconKey}
            onChange={(iconKey) => setModuleIconKey(module.key, iconKey)}
          />
        </>
      )}

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Outils du module
      </Typography>

      {moduleTools.map((t) => {
        const rootDisabled = disabledToolKeys.includes(t.key);
        if (t.locked) {
          return (
            <RowSwitchConfig
              key={t.key}
              icon={t.icon}
              label={t.label}
              caption="Toujours actif"
              checked
              disabled
            />
          );
        }
        if (rootDisabled) {
          return (
            <RowSwitchConfig
              key={t.key}
              icon={t.icon}
              label={t.label}
              caption="Désactivé globalement (section Outils)"
              checked={false}
              disabled
            />
          );
        }
        return (
          <RowSwitchConfig
            key={t.key}
            icon={t.icon}
            label={t.label}
            checked={!disabledForModule.includes(t.key)}
            onChange={() => toggleToolInModule(module.key, t.key)}
          />
        );
      })}

      {module.key === "BASE_MAPS" && (
        <>
          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Sources de fonds de plan
          </Typography>

          {BASE_MAP_SOURCE_CATALOG.map((source) => (
            <RowSwitchConfig
              key={source.key}
              label={source.label}
              caption={source.caption}
              checked={!disabledBaseMapSourceKeys.includes(source.key)}
              onChange={() => toggleBaseMapSource(source.key)}
            />
          ))}
        </>
      )}

      {module.key === "MAP" && (
        <>
          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Modèles système
          </Typography>

          <RowSwitchConfig
            label="Liste Générique (Ligne / Polygone)"
            caption="Créée automatiquement à l'ouverture du dossier. Désactivée : aucune liste système n'est ajoutée."
            checked={systemTemplatesEnabled}
            onChange={() =>
              setSystemAnnotationTemplates(!systemTemplatesEnabled)
            }
          />

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Calques
          </Typography>

          <RowSwitchConfig
            label="Travailler avec des calques"
            caption="Activé automatiquement quand le fond de plan contient des calques."
            checked={showLayers}
            onChange={() => dispatch(setShowLayers(!showLayers))}
          />
          <RowSwitchConfig
            label="Calques globaux"
            caption="Une seule liste de calques pour tous les fonds de plan du scope (au lieu d'une liste par fond de plan). Les tâches du Planning se rattachent aux calques globaux."
            checked={layersMode === "GLOBAL"}
            onChange={() =>
              setLayersMode(layersMode === "GLOBAL" ? "BASE_MAP" : "GLOBAL")
            }
          />
        </>
      )}
    </Box>
  );
}
