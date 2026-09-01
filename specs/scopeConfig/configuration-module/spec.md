# Spec — Module Configuration plein écran & activation modules/outils par scope

| | |
|---|---|
| **Feature** | Dialog de configuration plein écran + activation des modules et outils par scope |
| **Domaine** | `scopeConfig` (nouveau) (+ `viewers`, `rightPanel`, `appConfig`, `mapEditor`, `krtoFile`, `scopes`, `projects`, `App/db`) |
| **Issue / branche** | #315 — `issue_315_configuration_module` |
| **Statut** | En cours d'implémentation (2026-09-01) |

---

## 1. Contexte & problème

La configuration de l'application vit aujourd'hui dans un petit dialog de
350 px (`PanelAppConfig`) : « Mode avancé », « Désactiver la 3D », projection
de capture satellite, chrono, suppression des données de l'appareil. Ce format
ne laisse aucune place pour configurer les **modules** (bande verticale de
gauche) ni les **outils** (bande verticale de droite), alors que tous les
scopes n'ont pas besoin de tous les modules (un repérage simple n'a que faire
du Maillage ou des Zones) et que la liste d'outils est aujourd'hui figée par
l'appConfig d'organisation.

## 2. Objectif

Promouvoir la configuration en vrai module :

1. Un bouton « Configuration » (icône Tune) **en bas de la bande de modules**
   ouvre un **dialog plein page**.
2. Le dialog est organisé en **sommaire à gauche** / **contenu à droite**,
   avec quatre sections dans le sommaire (de haut en bas) : **Généralités**,
   **Modules**, **Outils**, **Éditeurs**.
3. L'activation des modules et des outils est **par scope**, partagée entre
   utilisateurs, et modifiable **par tout le monde** (y compris un visiteur
   d'un scope privé) — d'où une table Dexie dédiée hors du verrou d'ownership
   qui protège la row `scopes`.
4. Les préférences d'éditeurs restent **locales à l'appareil** (localStorage),
   comme aujourd'hui — la page ne fait que les regrouper.

## 3. Scénarios utilisateur

1. **Ouvrir la configuration** — L'utilisateur clique le bouton « Configuration »
   en bas de la bande de gauche (ou le bouton nom d'organisation en bas de
   l'écran, ou « Config. » sur mobile, ou l'engrenage des pages de sélection
   de projet) : le même dialog plein page s'ouvre. ✅ *Critère : un seul
   dialog, tous les points d'entrée convergent.*
2. **Désactiver un module** — Dans la section Modules, l'utilisateur ouvre
   « Maillage » et coupe « Module actif » : l'icône disparaît immédiatement de
   la bande de gauche et `Ctrl+I` devient inerte. Si Maillage était le module
   sélectionné, l'app bascule sur Dessin (ou le premier module actif).
   ✅ *Critère : aucune trace du module dans la bande, le sélecteur de module
   ni les hotkeys ; au rechargement, la restauration du dernier module tombe
   sur un module actif.*
3. **Désactiver un outil à la racine** — Dans la section Outils, l'utilisateur
   ouvre « Export » et coupe « Outil actif » : l'outil disparaît de la bande de
   droite dans **tous** les modules, quel que soit son état par module.
   ✅ *Critère : les toggles par module de cet outil apparaissent désactivés
   avec la mention « Désactivé globalement ».*
4. **Désactiver un outil dans un module** — Dans la page du module Dessin,
   l'utilisateur coupe « Élévation » : l'outil disparaît de la bande de droite
   uniquement quand Dessin est sélectionné (la touche `E` devient inerte dans
   ce module), et reste disponible dans Maillage. Si le panneau de l'outil
   était ouvert, il se ferme. ✅
5. **Partage entre utilisateurs** — Un second utilisateur (même un visiteur
   d'un scope privé) modifie la configuration : l'écriture passe (pas de
   `OwnershipError` / `ReadOnlyScopeError`) et la configuration voyage avec
   les exports Krto, la synchro distante (merge newest-wins) et la duplication
   de scope. ✅
6. **Préférences d'éditeurs** — Section Éditeurs : « Éditeur 2D » règle la
   taille par défaut des vertex (le même contrôle que l'outil Réglages du
   panneau de droite), « Carte satellite » règle la projection de capture
   (Mercator / Lambert CC), « Éditeur 3D » est un emplacement réservé. ✅
   *Critère : valeurs persistées en localStorage, indépendantes du scope.*
7. **Données & préférences** — Section Généralités : version de la config,
   « Mode avancé », « Désactiver la 3D », chrono, « Supprimer les données de
   l'appareil » (contenu de l'ancien dialog, hors bloc satellite). ✅

## 4. Exigences fonctionnelles

- **FR-1** — Nouvelle table Dexie `scopeConfigs` (v32), schéma
  `"id,scopeId,projectId"`, une row par scope (convention `id = scopeId` à la
  création). Champs :

  ```js
  {
    id,                        // == scopeId at creation (deterministic upsert)
    scopeId,
    projectId,
    disabledModuleKeys: [],    // module keys hidden from the left band
    disabledToolKeys: [],      // root-disabled tools (all modules)
    disabledToolKeysByModule: {}, // {moduleKey: [toolKey]}
  }
  ```

- **FR-2** — Droits : la table est dans `AUDIT_TABLES` (timestamps → merge
  newest-wins des zips Krto) et `OWNERSHIP_EXEMPT_TABLES` ; l'app écrit
  exclusivement via `withSystemWrite` + `notifyLocalChange()` manuel, si bien
  que **tout utilisateur** peut modifier la configuration, y compris sur un
  scope privé étranger. Pas de soft-delete.
- **FR-3** — Un module désactivé disparaît de `useViewers()` (bande, sélecteur
  de module, hotkeys Ctrl+lettre dérivés). Le module sélectionné devient-il
  désactivé → bascule automatique vers `MAP` ou le premier module actif
  (garde `useEnsureEnabledModule`, active seulement après hydratation de la
  synchro). Impossible de désactiver le **dernier** module actif (garde UI).
- **FR-4** — Un outil désactivé à la racine est filtré de la bande de droite
  dans tous les modules ; un outil désactivé par module ne l'est que dans ce
  module. Les hotkeys d'outils dérivent de la liste filtrée (aucun code
  supplémentaire). Le panneau d'un outil qui devient désactivé se ferme.
- **FR-5** — Outils verrouillés, jamais désactivables : `SELECTION_PROPERTIES`
  (Propriétés — invariant d'injection forcée : chaque module garde au moins un
  outil) et `SETTINGS` (Réglages — porte de sortie). Rendus en switch
  désactivé-ON avec la mention « Toujours actif ».
- **FR-6** — Le catalogue d'outils configurables = allowlist
  `appConfig.features.tools` (ordre préservé) + outils contextuels (Capture,
  Réglages, Transfo.), `SELECTION_PROPERTIES` toujours inclus. Un outil absent
  de l'allowlist d'organisation n'apparaît jamais dans la configuration.
- **FR-7** — La configuration par scope voyage : export Krto (table ajoutée à
  `tablesWithScopeId`), synchro distante push/fetch (round-trip Krto,
  merge newest-wins par row grâce aux timestamps), duplication de scope
  (copie explicite dans `duplicateScopeService`), nettoyages
  (`clearScopeDataService`, `deleteProjectLocalDataService`,
  `useDeleteProjects`).
- **FR-8** — Sans scope sélectionné (dashboard, pages de sélection), les
  sections Modules et Outils sont masquées ; Généralités et Éditeurs restent.
- **FR-9** — L'ancien dialog compact (`DialogAppConfig` + `PanelAppConfig`)
  est supprimé ; tous les points d'entrée dispatchent
  `setOpenAppConfig(true)` vers le nouveau dialog monté une seule fois dans
  `MainApp`.

## 5. Modèle de données & état

- **Dexie** : table `scopeConfigs` (FR-1/FR-2). Lecture réactive via le
  `dexieSyncService` existant (une `liveQuery` module-level → Redux), **pas**
  de `useLiveQuery` dans `useViewers`/`useRightPanelTools` (des dizaines de
  consommateurs).
- **Redux** : nouvelle slice `scopeConfig` —
  `{ itemsByScopeId: {}, synced: false }`, action `setScopeConfigs` (rows
  indexées par `scopeId`, la plus récente gagne en cas d'anomalie de doublon).
  Sélecteurs à référence stable (`EMPTY_ARR`/`EMPTY_OBJ`) :
  `selectDisabledModuleKeys`, `selectDisabledToolKeys`,
  `selectDisabledToolKeysByModule` (lisent la row du
  `s.scopes.selectedScopeId`).
- **Écriture** : `useScopeConfigActions` → `toggleModule`, `toggleToolRoot`,
  `toggleToolInModule` ; upsert `withSystemWrite` (patch sans `updatedAt`
  pour laisser le hook `updating` retamponner) + `notifyLocalChange()`.
- **Préférences appareil** (inchangées) : `vertexSizeMultiplier`
  (`mapEditorSettings` localStorage), `satelliteCaptureMode`, `disable3D`,
  `advancedLayout` (non persisté, comme avant).

## 6. Mécanisme (chaîne de filtrage)

```
db.scopeConfigs ──liveQuery──▶ scopeConfigSlice.itemsByScopeId
                                      │
              ┌───────────────────────┴──────────────────────┐
              ▼                                              ▼
  useViewers({ignoreScopeConfig})                useRightPanelTools
  filtre disabledModuleKeys                      filtre isScopeDisabled(key) =
              │                                  !locked && (root || perModule)
              ├─▶ VerticalMenuViewers (bande)                │
              ├─▶ SelectorViewer                             ├─▶ VerticalMenuRightPanel
              ├─▶ useViewerSwitchHotkeys (Ctrl+X)            ├─▶ useRightPanelToolHotkeys
              └─▶ useEnsureEnabledModule (bascule)           └─▶ auto-close du panneau ouvert
```

Le dialog de configuration lit les listes **non filtrées** :
`useViewers({ ignoreScopeConfig: true })` pour les modules, et le nouveau
membre `catalog` retourné par `useRightPanelTools` pour les outils.

## 7. Cas limites

- **Dernier module actif** : switch verrouillé côté UI (« Au moins un module
  doit rester actif. ») — pas de garde DB.
- **Restauration au boot d'un module désactivé** : `getInitSelectedModuleKey`
  reste ignorant du scope ; `useEnsureEnabledModule` corrige juste après
  l'hydratation (`synced === true`), même pattern que la correction
  `disable3D`.
- **Doublon de rows** (import anormal) : le reducer garde la plus récente
  (`updatedAt ?? createdAt`) — lecture déterministe.
- **Duplication de scope** : la row copiée prend `id = scopeId` du nouveau
  scope via `duplicateScopeService` ; le chemin zip (`remapDexieExportIds`)
  produit un nanoid — sans conséquence, les lectures passent par l'index
  `scopeId`.
- **Merge distant** : newest-wins par row ; une row sans timestamp perd face
  à la locale (d'où l'appartenance à `AUDIT_TABLES`).
- **Visiteur d'un scope privé** : l'enrôlement automatique de la table dans
  `READ_ONLY_BLOCKED_TABLES` (via `AUDIT_TABLES`) est inerte car l'unique
  chemin d'écriture passe par `withSystemWrite`.
- **Outil déjà ouvert puis désactivé** : effet d'auto-fermeture étendu dans
  `VerticalMenuRightPanel` (flag `scopeDisabled` sur `toolsByKey`).
- **Mobile** : pas de bande de modules ; le dialog (fullScreen automatique via
  `DialogGeneric`) reste accessible par « Config. ».

## 8. Vérification

```bash
npm run build
```

```bash
npx eslint src/Features/scopeConfig src/Features/viewers src/Features/rightPanel src/App/db/db.js
```

Vérifications manuelles (utilisateur) : scénarios §3 — entrées multiples,
désactivation module (bande + hotkey + bascule + restauration boot),
désactivation outil racine/par module (+ fermeture du panneau ouvert),
round-trip Krto/duplication/merge, écriture par un visiteur de scope privé,
partage du contrôle « taille vertex » avec l'outil Réglages, sections
Modules/Outils masquées sans scope.

## 9. Fichiers impactés

**Nouveaux — feature `src/Features/scopeConfig/`** :
`scopeConfigSlice.js`, `utils/scopeConfigSelectors.js`,
`hooks/useScopeConfigActions.js`, `components/DialogConfiguration.jsx`,
`components/PanelConfiguration.jsx`, `components/NavConfigurationList.jsx`,
`components/PageDonneesPreferences.jsx`, `components/PageModuleConfig.jsx`,
`components/PageToolConfig.jsx`, `components/PageEditor2d.jsx`,
`components/PageEditor3d.jsx`, `components/PageSatelliteMap.jsx`.
Plus `src/Features/viewers/hooks/useEnsureEnabledModule.js` et
`src/Features/mapEditor/components/SectionVertexSize.jsx` (extraction).

**Modifiés** : `src/App/db/db.js` (v32 + sets), `src/App/dexieSyncService.js`,
`src/App/store.js`, `src/App/components/MainApp.jsx`,
`src/Features/viewers/hooks/useViewers.jsx`,
`src/Features/viewers/components/VerticalMenuViewers.jsx`,
`src/Features/layout/components/LayoutDesktop.jsx`,
`src/Features/rightPanel/hooks/useRightPanelTools.jsx`,
`src/Features/rightPanel/components/VerticalMenuRightPanel.jsx`,
`src/Features/mapEditor/components/SectionEditorSettings2d.jsx`,
`src/Features/krtoFile/services/createKrtoZip.js`,
`src/Features/scopes/services/duplicateScopeService.js`,
`src/Features/scopes/services/clearScopeDataService.js`,
`src/Features/projects/services/deleteProjectLocalDataService.js`,
`src/Features/projects/hooks/useDeleteProjects.js`,
`src/Features/appConfig/components/ButtonDialogAppConfig.jsx`,
`src/Features/appConfig/components/BarAppConfig.jsx`,
`src/Features/layout/components/LayoutMobile.jsx`.

**Supprimés** : `src/Features/appConfig/components/DialogAppConfig.jsx`,
`src/Features/appConfig/components/PanelAppConfig.jsx`.
