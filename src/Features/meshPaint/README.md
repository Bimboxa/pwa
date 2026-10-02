# meshPaint — « Pinceau » 3D (`MESH_BRUSH`)

Le Pinceau colore les facettes et les arêtes des objets 3D d'annotations avec un modèle d'annotation (`annotationTemplate`). Il est disponible dans l'éditeur 3D du module Dessin.

- Un modèle **Surface** (`drawingShape: "POLYGON"`) peint des **facettes** (`partType: "FACE"`). La quantité est en m², comptée par côté peint.
- Un modèle **Ligne** (`drawingShape: "POLYLINE"`) peint des **arêtes** (`partType: "EDGE"`). La quantité est en ml.
- Une partie peinte prend la couleur du modèle en 3D, et sa quantité s'ajoute aux totaux de ce modèle.

## Vocabulaire (français → code)

| Terme employé ici                                                      | Nom dans le code                                                                                               |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Pinceau (l'outil)                                                      | clé d'outil `MESH_BRUSH` (`MESH_BRUSH_TOOL_KEY`). À ne pas confondre avec l'outil 2D `"BRUSH"` (masque raster) |
| Partie peinte, peinture                                                | une ligne de la table Dexie `db.meshPaints` (« paint »)                                                        |
| Modèle                                                                 | `annotationTemplate` ; le modèle qui peint est `annotationTemplateId`                                          |
| Liste                                                                  | `listing` ; la liste du modèle qui peint est `listingId`                                                       |
| Hôte (l'annotation peinte)                                             | `hostAnnotationId`                                                                                             |
| Facette                                                                | `partType: "FACE"` : un îlot plan connexe (`island`) de l'objet 3D de l'hôte                                   |
| Arête                                                                  | `partType: "EDGE"` : une arête vive droite (`chain`)                                                           |
| Côté peint                                                             | le signe de `geometry.normal`, qui pointe vers le côté peint                                                   |
| Fond de plan                                                           | `baseMap` ; repère de la géométrie : `imagesManager.getGroup(baseMapId)`                                       |
| Calque                                                                 | `layer` (`host.layerId`)                                                                                       |
| Orpheline                                                              | `sync.state: "ORPHAN"`                                                                                         |
| En conflit                                                             | statut `CONFLICT` à la lecture (`resolveMeshPaints`)                                                           |
| « À vérifier »                                                         | `isStale`                                                                                                      |
| Rétrécissement anti-crénelage (« Réduire le crénelage des parements ») | réglage `threedEditor.antiAliasingShrink` ; exemption par annotation : `_noAntiAliasingShrink`                 |
| Recalage                                                               | « re-sync » (`planPaintResync`, `useMeshPaintsResync`)                                                         |

## Règles fonctionnelles (V1)

**Hôtes**

- Tout objet 3D d'annotation peut être peint : dalles extrudées, murs épais ou minces, bandes, rampes, meshes `isMesh3d`…
- Sont refusés (`utils/getPaintHostRefusal.js`) :
  - les mailles (`db.meshes3d`), les fonds de plan et les scans ;
  - `OBJECT_3D` et les formes courbes `REVOLUTION` / `EXTRUSION_PROFILE` ;
  - les cellules de maillage (`isMeshCell`) et les photo-plans ;
  - les annotations du modèle armé lui-même, pour éviter de compter deux fois.

**Facettes et arêtes**

- Une facette est la région plane connexe sous le curseur.
- Une arête est une arête vive droite ; ses morceaux colinéaires sont fusionnés.

**Un seul modèle par partie**

- Une arête, ou un côté de facette, porte au plus un modèle.
- Re-cliquer avec le même modèle retire la peinture ; cliquer avec un autre modèle la remplace (`utils/planPaintToggle.js`).
- Les deux côtés d'une face mince (voile mince, bande verticale, feuille) peuvent porter deux modèles différents.
- Le côté intérieur d'un solide fermé est refusé (`INNER_FACE`). Les deux parements d'un mur épais sont deux facettes distinctes.
- Correspondance entre parties (`utils/findMeshPaintMatches.js`) :
  - elle est faite par fond de plan, tous hôtes confondus : l'arête d'angle commune à deux murs n'est qu'une seule arête ;
  - facettes : même côté, écart de plan ≤ 3 mm, recouvrement ≥ 50 % ;
  - arêtes : colinéaires, écart ≤ 3 mm, recouvrement ≥ 50 %.

**Visibilité**

- Une partie peinte est visible si et seulement si son **propre** modèle et sa **propre** liste sont visibles.
- Le modèle et la liste de l'hôte sont ignorés : masquer l'hôte laisse visibles les peintures des autres modèles.
- Le **calque de l'hôte** est suivi : masquer un niveau masque ses peintures.
- Règle complète : `utils/getMeshPaintVisibility.js` → `HIDDEN` | `DIMMED` | `VISIBLE`.

**Rétrécissement anti-crénelage**

- Il est supprimé pour tout hôte peint et pour toute annotation convertie en mesh.
- La partie visée est alors redétectée « à la volée » sur la géométrie réelle (`services/ensureUnshrunkHostObject.js` puis `matchPaintPartToIndex`).

**Quand l'hôte change**

- Les peintures sont recalées automatiquement.
- Si la face disparaît, la peinture devient **orpheline** : elle reste listée mais n'est plus comptée.
- Un badge « À vérifier » signale un hôte modifié pendant que l'éditeur 3D était fermé : le recalage n'a lieu que lorsque l'hôte est construit en 3D.

## Données : `db.meshPaints` (Dexie v42)

Une ligne par partie peinte.

```
{ id, projectId, scopeId,
  listingId, annotationTemplateId,      // modèle QUI PEINT + sa liste
  hostAnnotationId, baseMapId,          // hôte + repère de la géométrie
  partType: "FACE" | "EDGE",
  geometry: FACE { polygons: [{contour, holes}], normal: [x, y, z] }
          | EDGE { points: [p0, p1], sides?: [[x, y, z], …] },
  paintedAt,                            // actions utilisateur uniquement (arbitrage des conflits)
  sync: { state: "OK" | "ORPHAN", geomHash, syncedAt, provisional?, nearOnly? } }
```

**Conventions géométriques** (conversions dans `utils/meshPaintFrame.js`)

- Un point est `[nx, ny, z]` :
  - `nx` et `ny` sont normalisés sur l'image de référence du fond de plan, comme `db.points` ;
  - `z` est le z local en mètres, **absolu**, dans le repère de `imagesManager.getGroup(baseMapId)`. À la différence de `mesh3d`, `offsetZ` y est déjà inclus.
- La normale d'une FACE est en mètres locaux et pointe **vers le côté peint** : c'est elle qui encode le côté.
- Une facette coupée reste une seule ligne (multi-polygone).
- `sides` (EDGE) contient les normales des facettes bordées par l'arête. Le recalage s'en sert pour ne pas confondre deux arêtes parallèles.

**Enregistrements dans `App/db/db.js`**

- La table est dans `AUDIT_TABLES`, `OWNERSHIP_EXEMPT_TABLES`, `SOFT_DELETE_TABLES` et `UNDO_TABLES`.
- La garde des listes liées vérifie `listingId` : on ne peut pas peindre avec un modèle d'une liste liée, mais on peut peindre un hôte issu d'une liste liée.

**Écritures dérivées (recalage)**

- Elles s'exécutent dans une transaction `tx.derivedWrite` : pas de tampon d'audit (`updatedAt`), pas d'entrée d'undo, pas de « scope modifié ».
- Une suppression dérivée s'écrit `update({deletedAt})`, jamais `delete()` : le middleware de soft-delete pousserait sinon une entrée d'undo.

**Hook d'undo**

- `undoManager.registerUndoHooks` enregistre la ligne COMPLÈTE après modification comme `after`.
- Raison : Dexie transmet les modifications imbriquées aux hooks `updating` sous forme de clés pointées (`"geometry.polygons"`). L'ancien `{...obj, ...modifications}` cassait le redo des mises à jour imbriquées, y compris `mesh3d`.

## Organisation du code

**État et données**

- `meshPaintSlice.js` : surbrillance / cadrage depuis le panneau (`highlightedPaintId`, `focusNonce`) et exemptions de rétrécissement de la session (`shrinkExemptAnnotationIds`).
- `hooks/useMeshPaints.js` : lignes vivantes plus hôtes et listes BRUTS. Ne jamais passer par `useAnnotationsV2`, qui écarte les hôtes masqués.
- `utils/resolveMeshPaints.js` : à la lecture, écarte les lignes invalides et attribue un statut `OK` / `ORPHAN` / `CONFLICT` (le `paintedAt` le plus récent gagne) ainsi que `isStale`.

**Outil**

- Entrée `MESH_BRUSH` dans `mapEditor/constants/drawingTools.jsx` (`editor: "3D"`, `requiresTemplate: true`), ajoutée en fin des `tools` POLYGON / POLYLINE de `annotations/constants/drawingShapeConfig.js`.
- Les listes d'outils dépendent de l'éditeur (`mapEditor/utils/filterDrawingToolsForEditor.js`) : le pinceau n'apparaît que dans le module Dessin en 3D. Il ne peut devenir ni `defaultTool` ni un outil du Dessin sans modèle.
- `utils/meshBrushTools.js` et `utils/meshBrushSelectors.js` (`selectIsMeshBrushActive`).
- Activation : le pinceau s'appuie sur `threedDrawing/hooks/useTemplateFaceDrawBridge.js` (`drawingMode.active`). La machinerie de dessin de faces (`useDrawingPointerHandlers`, `DrawingOverlayThreed`) reste inerte. Quitter la 3D désarme l'outil.

**Sélection de la cible et validation du clic**

- `services/meshBrushPick.js` choisit la cible. Les peintures existantes sont prioritaires, ce qui permet d'en retirer une même si son hôte est masqué.
- `hooks/useMeshBrushPointerHandlers.js` :
  - survol en rAF ;
  - un appui qui bouge de moins de 4 px vaut un clic, sinon c'est une rotation de caméra ;
  - Échap quitte le pinceau.
- `components/MeshBrushThreed.jsx` et `MeshBrushOverlayThreed.jsx` affichent le libellé du curseur : « Peindre », « Retirer », « Remplacer « X » » ou le motif de refus.
- `services/commitMeshBrushTargetService.js` appelle `services/paintMeshPartService.js` (bascule / remplacement en une seule étape d'undo).
- `services/deleteMeshPaintsService.js` supprime des peintures.

**Géométrie de l'hôte**

- `js/buildHostPartIndexFromObject.js` extrait les triangles `SOLID` en mètres locaux du fond de plan.
- `utils/buildHostPartIndex.js` en tire :
  - les îlots plans, avec normales sortantes sur les hôtes fermés ;
  - les chaînes d'arêtes vives ;
  - un hash.

**Exemption de rétrécissement**

- `services/ensureUnshrunkHostObject.js`.
- `createAnnotationObject3D.js` respecte `_noAntiAliasingShrink`.
- `useAutoLoadAnnotationsInThreedEditor.js` marque les hôtes peints et les exemptions de session.
- `AnnotationsManager.isCarvePending(id)`.
- `getEditableMesh3d` dé-rétrécit avant la conversion en mesh.

**Rendu 3D**

- `components/ThreedMeshPaints.jsx` :
  - une couche par fond de plan, sous son groupe d'image ;
  - facettes en peau `FrontSide` décollée de 1 mm ;
  - arêtes en lignes épaisses ;
  - `userData.isPaintOverlay`.
- Avec `js/meshPaintObjectsStore.js` et `services/focusMeshPaintInThreed.js`.

**Recalage**

- `components/MeshPaintsResyncThreed.jsx` et `hooks/useMeshPaintsResync.js` : déclenché quand un hôte est prêt ou que les annotations se rechargent, avec un debounce de 300 ms et une comparaison de hash.
- `utils/planPaintResync.js`, en trois étapes :
  - Stage 1 : plan ou ligne parallèle proche, ≤ 20 mm ;
  - Stage 2 : plan parallèle éloigné, sans ambiguïté ;
  - Stage 3 : glissement dans le même plan.
- `services/applyMeshPaintsResyncService.js` écrit le résultat.

**Quantités et panneaux**

- `hooks/usePaintedPartsQties.js` prend les mêmes noms d'options que `useAnnotationsV2`.
- `annotations/utils/mergePaintedQtiesIntoTemplateQties.js` fusionne les quantités peintes dans celles des modèles.

**Cycle de vie**

- `services/copyMeshPaintsService.js` et `utils/classifyMeshPaintsForSplit.js` : après une coupe 2D, chaque peinture est rattachée au morceau qui la porte, ou copiée sur les morceaux qu'elle chevauche.
- `utils/applyAffineToPaintGeometry.js`, `utils/mapPaintGeometryXY.js`, `services/meshPaintWriteGuard.js`, `services/syncMeshPaintsAfterUndoService.js`.

**Consommateurs des quantités branchés**

- Panneau Dessin : lignes de modèles, compteurs de liste, et liste « Parties peintes » de la vue détail (`panelDrawing/components/SectionTemplatePaintedParts.jsx`, `RowTemplatePaintedPart.jsx`).
- Panneau Viewer (`PanelViewerAnnotations`).
- `PopperMapListings`.
- Légende 3D (`useThreedLegendItems`), y compris une ligne pour les modèles uniquement peints.
- `useAnnotationTemplateQtiesById` et `useAnnotationTemplateQtiesByIdForBaseMap`, qui alimentent les totaux des légendes 2D / portfolio et les propriétés de liste.
- Export agrégé (`getAggregatedAnnotationRows`), avec une colonne « Parties peintes » dans la feuille Excel et dans `DatagridAnnotationsAggregated`.

**Cycle de vie branché**

- Zip Krto, avec remap de `hostAnnotationId` (`remapDexieExportIds`).
- Export et purge locale du projet.
- Vidage et duplication de scope.
- Suppression d'annotations, suppression de modèle, modèles inutilisés (une peinture compte comme usage).
- Purge : tombstones et hôtes purgés uniquement, jamais une peinture vivante dont l'hôte n'est pas chargé.
- Déplacement / rotation 2D et 3D (`commitWrapperTransform`, `commitAnnotationsTransformFrom3d`).
- « Régénérer depuis le PDF » (`regenerateBaseMapFromPdfPageService`).
- Coupes 2D (`useHandleSplitPolyline`, `useHandleSplitCommit`) et Coupe face (`cutFaceAlongPathService`).

## Pièges

- **Nouveau service qui réécrit des coordonnées** dans le repère d'un fond de plan : il doit aussi traiter `db.meshPaints`, comme il traite `mesh3d`.
- **Drapeau des overlays** : les objets de peinture portent `isPaintOverlay`, pas `isHoverOverlay`. Picking, index de snap (`useVertexSnap`), contours de coupe et traits « aquarelle » l'ignorent ; l'export 3D le garde.
- **Parent des overlays** : ne jamais placer une peinture sous la racine de son hôte, car un hôte masqué n'est pas construit du tout.
- **Immutabilité des lignes** : les formes locales sont mises en cache par objet ligne (WeakMap). Ne jamais modifier une ligne Dexie en place.

## Tests

```
node --test src/Features/meshPaint/utils/*.test.mjs
```

Les utils purs n'utilisent que des imports relatifs en `.js`, sans alias.

## V2 : reste à faire

**Copies**

- Copier les peintures au coller / dupliquer d'une annotation, à la duplication de calque et à la jointure de murs (`applyJoinAnnotationMergesService`). Aujourd'hui, les peintures de la pièce supprimée deviennent orphelines.

**Objets métier / planning**

- Les quantités peintes ne remontent pas dans les objets métier ni dans les lots de travaux. Ces quantités passent par des liens annotation → objet : il faudrait un lien peinture → objet, ou une correspondance par modèle.

**Légendes et récapitulatifs**

- Lignes des légendes 2D et portfolio pour les modèles UNIQUEMENT peints (`useLegendItems`, `useLegendItemsByBaseMapId`).
- Récap SCOPE (`SectionAnnotationTemplateQties`) et compteurs de `SectionDrawingListings`.

**Export**

- Feuille Excel « Parties peintes » détaillée par partie.
- Datagrid par annotation.

**Géométrie**

- Surfaces courbes et gauches peintes comme une seule région ; en V1, elles se peignent facette par facette.
- Chaînes d'arêtes courbes.
- Géométrie de référence exacte, indépendante de l'affichage.

**Recalage**

- Recalage sans affichage des hôtes non construits en 3D (hôte masqué, ou 3D fermée). En V1, c'est le badge « À vérifier » qui le signale.

**Performance**

- Rendu groupé par modèle au-delà d'environ 1000 peintures.
- Une seule résolution des parties partagée par tous les consommateurs de quantités.
