# meshPaint — « Pinceau » (`MESH_BRUSH`)

Le Pinceau colore les facettes et les arêtes des objets 3D d'annotations avec un modèle d'annotation (`annotationTemplate`). Il est disponible dans le module Dessin : en 3D il **peint** des parties d'objets (ce document), en 2D il **convertit ou duplique** des annotations existantes (voir « Pinceau en 2D » ci-dessous).

- Un modèle **Surface** (`drawingShape: "POLYGON"`) peint des **facettes** (`partType: "FACE"`). La quantité est en m², comptée par côté peint.
- Un modèle **Ligne** (`drawingShape: "POLYLINE"`) peint des **arêtes** (`partType: "EDGE"`). La quantité est en ml.
- Une partie peinte prend la couleur du modèle en 3D, et sa quantité s'ajoute aux totaux de ce modèle.

## Pinceau en 2D (pinceau de modèle)

Même outil, même clé `MESH_BRUSH`, même icône, même raccourci **P** : dans l'éditeur 2D du module Dessin, le Pinceau est proposé en fin de liste des outils des modèles Surface / Ligne. Armé, **chaque clic sur une annotation** :

- **la convertit** vers le modèle armé (`annotations/hooks/useChangeAnnotationTemplate` : patch diff-only, le type reste dans sa shape — une Bande reste une Bande sous un modèle Ligne, devient une Surface sous un modèle Surface) ;
- **ou la duplique** avec le modèle armé quand le switch « **Dupliquer l'annotation cible** » du DrawingHelper est actif (raccourci **D**, état `mapEditor.templateBrushDuplicateTarget`, persistant) : la cible garde son modèle, la copie est indépendante (nouveaux `db.points`, `useCloneAnnotationAndEntity` avec un brouillon explicite construit depuis le modèle comme le menu « Dupliquer » ; peintures 3D et ouvertures collées non copiées).

Règles (`utils/getTemplateBrushRefusal.js`, toaster en cas de refus) :

- **jamais vers le modèle que l'annotation porte déjà** : une copie serait un doublon indétectable, une conversion un no-op (« Cette annotation porte déjà ce modèle ») ;
- cibles acceptées : POLYGON / POLYLINE / STRIP (une COTE, une règle, un calepinage, un point, une étiquette, un rectangle-bbox sont refusés : « Modèle incompatible avec cette annotation ») ; une annotation `isMesh3d` n'accepte qu'un modèle Surface ;
- les pseudo-lignes en lecture seule (empreintes `foreign::` / `revolution::`, mailles) sont ignorées sans message ; convertir demande le droit d'édition sur la cible (`useAnnotationPermissions`), dupliquer non (les gardes Dexie de scope remontent en toaster).

Code : branche `MESH_BRUSH` de `handleWorldClick` dans `mapEditor/components/InteractionLayer.jsx` (curseur pointeur, pas de loupe ni de snap : `POINTER_CLICK_MODES` / `NO_SMART_DETECT_MODES`), action dans `hooks/useTemplateBrushClick.js` (câblé par `MainMapEditorV3`, prop `onTemplateBrushClick`), bloc 2D de `SectionDrawingHelperContent.jsx` (bandeau, switch D, raccourcis). La touche **D** du pinceau passe avant la loupe (`case 'd'`).

Conséquences de la clé commune : l'outil mémorisé par modèle (`selectedToolKeyByTemplateId`) est repris d'un éditeur à l'autre (un pinceau mémorisé en 3D arme le pinceau 2D au clic de ligne) ; la bascule **T** garde le pinceau armé (peinture en 3D, conversion en 2D) ; il n'est jamais « Outil par défaut » d'un modèle (`neverDefaultTool`) ; **P** cède à la loupe quand la détection auto est active (comme A).

## Vocabulaire (français → code)

| Terme employé ici                                                   | Nom dans le code                                                                                                                                                |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pinceau (l'outil)                                                   | clé d'outil `MESH_BRUSH` (`MESH_BRUSH_TOOL_KEY`). À ne pas confondre avec l'outil 2D `"BRUSH"` (masque raster)                                                  |
| Partie peinte, peinture                                             | une ligne de la table Dexie `db.meshPaints` (« paint »)                                                                                                         |
| Modèle                                                              | `annotationTemplate` ; le modèle qui peint est `annotationTemplateId`                                                                                           |
| Liste                                                               | `listing` ; la liste du modèle qui peint est `listingId`                                                                                                        |
| Hôte (l'annotation peinte)                                          | `hostAnnotationId`                                                                                                                                              |
| Facette                                                             | `partType: "FACE"` : un îlot plan connexe (`island`) de l'objet 3D de l'hôte                                                                                    |
| Arête                                                               | `partType: "EDGE"` : une arête vive droite (`chain`)                                                                                                            |
| Surface courbe                                                      | `partType: "FACE"`, géométrie `{ vertices, facets, angleDeg }` : des facettes voisines lisses (`getSurfaces`)                                                   |
| Courbe                                                              | `partType: "EDGE"` à plus de 2 points : des arêtes enchaînées dans un même plan (`getCurves`)                                                                   |
| Seuil de lissage                                                    | `angleDeg` ; au clic, c'est le réglage « Sélection de face » (`threedEditor.faceSelectionAngleDeg`)                                                             |
| Côté peint                                                          | le signe de `geometry.normal`, qui pointe vers le côté peint                                                                                                    |
| Fond de plan                                                        | `baseMap` ; repère de la géométrie : `imagesManager.getGroup(baseMapId)`                                                                                        |
| Calque                                                              | `layer` (`host.layerId`)                                                                                                                                        |
| Orpheline                                                           | `sync.state: "ORPHAN"`                                                                                                                                          |
| En conflit                                                          | statut `CONFLICT` à la lecture (`resolveMeshPaints`)                                                                                                            |
| « À vérifier »                                                      | `isStale`                                                                                                                                                       |
| Rétrécissement anti-crénelage (« Séparer les surfaces en contact ») | réglage `threedEditor.antiAliasingShrink` (ON par défaut, couvre aussi le « Delta offset 3D » des POLYGON) ; exemption par annotation : `_noAntiAliasingShrink` |
| Recalage                                                            | « re-sync » (`planPaintResync`, `useMeshPaintsResync`)                                                                                                          |

## Règles fonctionnelles (V1)

**Hôtes**

- Tout objet 3D d'annotation peut être peint : dalles extrudées, murs épais ou minces, bandes, rampes, meshes `isMesh3d`, **objets 3D importés** (`OBJECT_3D`, GLB : les facettes et arêtes sont lues sur les triangles affichés du modèle, comme pour tout hôte)…
- Sont refusés (`utils/getPaintHostRefusal.js`) :
  - les mailles (`db.meshes3d`), les fonds de plan et les scans PLY (une **scène GLB** est peignable, voir ci-dessous) ;
  - les images (`IMAGE`) ;
  - les cellules de maillage (`isMeshCell`) et les photo-plans ;
  - les annotations du modèle armé lui-même, pour éviter de compter deux fois ;
  - les **arêtes** d'un hôte de plus de `BRUSH_MAX_HOST_TRIANGLES` triangles affichés (« Objet trop dense pour le pinceau », `TOO_DENSE`, décidé par `services/meshBrushPick.js`), ainsi que « Peindre toutes les faces » sur un tel hôte.
- **Hôte dense** (plus de `BRUSH_MAX_HOST_TRIANGLES` triangles, typiquement une maquette GLB lourde) : l'index de parties de tout l'hôte n'est **jamais construit** (il gèlerait le premier survol). Ses facettes restent peignables : la facette est la région plane sous le curseur (`getFaceRegion`, le même calcul que le survol des faces), la cible porte `dense: true`, et le clic **crée toujours une annotation** (2D si le plan peut la porter, sinon mesh), quel que soit le switch « Créer une annotation » — une peinture aurait besoin de l'index pour être recalée. Pas de test « face intérieure », pas de surface lissée ; une région non plane répond « Surface courbe ». Au-delà de 100 000 triangles par géométrie (`MAX_TRIS_FOR_ADJACENCY`), la région se réduit au triangle survolé.

- **Scène GLB d'un fond de plan** (`baseMap.scene3d.format === "GLB"`, maquette conservée telle quelle — `docs/baseMaps/SCENE_3D_BASE_MAPS.md`) : ses facettes sont peignables **sans annotation hôte** (`meshBrushPick.pickSceneFace`, cible `sceneHost: true`, `hostId: null`, `dense: true`). Mêmes règles qu'un hôte dense : la facette est la région plane sous le curseur, le clic crée toujours une annotation du fond de plan (2D si le plan peut la porter, sinon mesh), jamais de peinture. L'annotation créée est une annotation ordinaire : ni `autoCreatedFrom` ni `autoGenKind`. Pas d'arêtes (« Scène 3D : facettes uniquement »), pas de « Peindre toutes les faces » (« Scène 3D : peindre face par face »).

**Facettes et arêtes**

- Une facette est la région plane connexe sous le curseur. Exception : un **point de rupture** (point d'annotation marqué `isBreak`) sépare les deux faces qu'il borde, même coplanaires (voir « Pièges »).
- Une arête est une arête vive droite ; ses morceaux colinéaires sont fusionnés.
- Le type de partie peint est **indépendant de la forme du modèle** : par défaut (mode `AUTO`), un modèle Surface peint des facettes et un modèle Ligne des arêtes ; la bascule « Facette / Arête » du DrawingHelper (`mapEditor.meshBrushPartMode`, `selectMeshBrushPartType`) force l'un ou l'autre. Un modèle Ligne (« Surface verticale ») peint donc un parement ; un modèle peut porter des peintures des deux types, et leurs quantités s'additionnent par type (m² pour les facettes, ml pour les arêtes). La bascule revient à `AUTO` quand le modèle armé change.

**Créer une annotation** (`mapEditor.meshBrushCreateAnnotation`, switch « Créer une annotation », inactif par défaut pour éviter les doublons avec les annotations déjà dessinées) : 2D si le plan peut porter la partie, sinon annotation mesh pour une facette

- Quand le plan peut porter la partie cliquée, le Pinceau crée une **annotation 2D du modèle armé** au lieu d'une peinture (`services/commitMeshBrush2dService.js`, après la re-détection sur l'hôte non rétréci) :
  - **parement d'un mur épais** (POLYLINE en cm, STRIP) : le segment plan de la facette est découpé aux projections (≤ 5 cm) des sommets et aux intersections des contours des polygones « sol » — tout POLYGON du même fond de plan chargé en 3D, hors ouvertures, mailles, photo-plans et modèle armé (`services/collectGroundPolygonsFromScene.js`) — puis chaque morceau dont un point sondé à 5 cm du parement, **du côté peint**, tombe dans un sol devient une bande POLYLINE verticale (`utils/matchWallFaceToGroundPolygons.js` : la construction de `SURFACES_VERTICALES` vue depuis le mur ; le sol n'a pas à longer le parement, un mur au milieu d'une dalle est « posé » dessus ; plusieurs sols superposés → le plus haut). Bas = `offsetZ` de ce sol (+ rampe `guideLines`), haut = sommet de la facette (`utils/buildWallBandAnnotationFields.js`, conventions de `SURFACES_VERTICALES` / `computeAutoWallChains`). **Aucun sol sous aucun morceau → toaster « L'annotation doit être posée sur un sol pour être peinte », rien n'est créé** (pas de peinture non plus). Les ouvertures de la facette ne sont pas déduites ;
  - **autre facette plane** : `commitDrawnFace` en mode strict — POLYGON + `offsetZ` (trous → `cuts`), bande verticale si elle est exacte, polygone oblique sans trou ; la hauteur du modèle est ignorée (revêtement plat) ;
  - **arête horizontale** (Δz ≤ 5 mm) : POLYLINE 2D (`closeLine` pour une courbe fermée).
- **Facette sans encodage 2D** (surface courbe lissée, facette multi-polygone, face verticale ou oblique à trous, bande inexacte — `utils/classifyMeshBrushLocalPart.js` ou `FACE_COMMIT_NO_2D_ENCODING`) : une **annotation mesh** (`isMesh3d`) du modèle armé (`services/commitMeshBrushMeshService.js`) — une feuille d'une face par polygone, tournée vers le côté peint (`utils/localFaceToMesh3d.js` → `buildMesh3dFromPlanarFaces`), créée par `annotationMesh3d/services/createMesh3dAnnotationFromLocalMeshService.js` (le service de la feuille dessinée en 3D). Mêmes marqueurs que l'annotation 2D (`autoCreatedFrom`, `autoGenKind`). Garde anti-doublon propre : une annotation mesh vivante du même modèle, issue du même hôte, aux mêmes sommets (2 mm) → `DUPLICATE`.
- Reste une peinture : arête verticale ou en pente (un mesh ne porte pas une arête), ou facette dont le mesh n'a pas pu être construit.
- Seule une partie **nue** (rien à retirer / remplacer) devient une annotation ; le libellé du curseur passe de « Peindre » à « Annotation 2D » (optimiste pour un mur épais : la recherche de sol a lieu au clic ; une face peut encore se révéler sans encodage 2D et devenir un mesh) ou « Annotation mesh 3D ».
- L'annotation créée porte `autoCreatedFrom` (l'hôte) et `autoGenKind: "MESH_BRUSH"`, appartient à la liste du modèle armé et au calque de l'hôte. Elle est **indépendante de l'hôte** : déplacer l'hôte ne la déplace pas (une peinture, elle, suit). Elle se supprime comme toute annotation (pas de bascule au re-clic) ; une fois en place, elle couvre la facette et le survol répond « Annotation du modèle actif ».
- **Garde anti-doublon** : avant toute écriture, le plan est fouillé en base (toutes les annotations vivantes du fond, chargées en 3D ou non) pour une annotation **du même modèle et du même type au même endroit** — le critère de « Détection des doublons » (`findOverlappingAnnotations`, tolérance par défaut : longueur partagée pour les lignes, surface d'intersection pour les polygones), `utils/findSamePlaceAnnotation.js` + `services/findSamePlace2dAnnotationService.js`, branché sur le hook `checkBeforeCommit` de `commitDrawnFace` / `commitDrawnPolyline` et, pour les bandes de mur, sur chaque bande avant le groupe d'undo. Trouvée → statut `DUPLICATE`, **rien n'est créé (ni annotation, ni points, ni peinture)**, toaster d'erreur « Annotation non créée pour éviter un doublon ». Replay : `scripts/replay/meshBrushSamePlaceReplay.js`.
- Un clic = une étape d'undo (`withUndoGroup`). Après création, l'exemption de rétrécissement de session de l'hôte est retirée (`removeShrinkExemptAnnotationIds`) : la bande est collée au parement, l'hôte redevient rétréci.

**Peindre toutes les faces / toutes les arêtes de l'annotation** (`mapEditor.meshBrushPaintAllFaces` en mode Facette, `mapEditor.meshBrushPaintAllEdges` en mode Arête : un switch par type de partie dans la section « Options de peinture » du DrawingHelper, inactifs par défaut)

Les règles ci-dessous sont écrites pour les faces ; elles valent à l'identique pour les arêtes (voir « Arêtes » en fin de liste).

- Un clic sur une face **nue** peint d'un coup toutes les faces nues de l'hôte (« Peindre tout ») : une ligne `db.meshPaints` par facette plane, ou par surface lisse quand « Sélection de face » réunit des facettes — le découpage d'un clic simple. L'aperçu couvre toutes les faces concernées.
- Les faces déjà peintes par un **autre modèle** sont conservées ; seule la face cliquée est remplacée si elle en porte un (« Remplacer « X » et peindre tout »).
- Un clic sur une face portant **le modèle armé** retire toutes les peintures de facettes de ce modèle sur l'hôte (« Retirer tout ») ; les arêtes peintes ne sont pas touchées. Pour retirer une seule face, désactiver le switch.
- **Jamais de doublon** (`utils/listHostFaceParts.js`, `utils/planPaintAllParts.js`) :
  - hôte fermé (solide) : chaque face une fois, côté extérieur ;
  - hôte ouvert (feuille, voile mince, mesh ouvert) : **un seul côté par face** — celui de la face cliquée, propagé sur toute la feuille connexe (`index.getSurfaces(180)`) ; une feuille non reliée à la face cliquée est tournée vers la caméra (`viewDir` de la cible) ;
  - une face déjà peinte de ce côté (n'importe quel modèle, n'importe quel hôte du fond de plan : `findMeshPaintMatches`) est ignorée, ainsi que, sur un hôte ouvert, une face dont l'autre côté porte déjà le modèle armé ;
  - deux faces du lot au même endroit (stockées dos à dos) ne donnent qu'une ligne.
- Garde de volume : au-delà de `BRUSH_MAX_ALL_PARTS` faces (ou arêtes), le clic est refusé (« Trop de parties à peindre d'un coup », `TOO_MANY_PARTS`) — augmenter l'angle « Sélection de face ».
- Avec « Créer une annotation » : chaque face nue suit la règle d'un clic simple (annotation 2D si le plan peut la porter, sinon annotation mesh, à défaut peinture) ; les faces sans sol ou déjà couvertes par une annotation du modèle sont ignorées et résumées dans un toaster.
- **Arêtes** (`utils/listHostEdgeParts.js`) : les parties sont les courbes de `index.getCurves(angle)` — une arête vive droite, ou la courbe plane que forment des arêtes voisines sous l'angle « Sélection de face » —, exactement celles d'un clic simple. Une arête déjà peinte (n'importe quel modèle, n'importe quel hôte : l'arête d'angle commune à deux murs n'est qu'une arête) est ignorée ; « Retirer tout » ne retire que les arêtes du modèle armé sur l'hôte, les facettes peintes restent. Une arête n'a pas de côté : les règles « un seul côté par face » ne s'appliquent pas.
- Un clic = une étape d'undo ; les lignes sont écrites en une transaction (`bulkAdd`). Code : `services/getMeshBrushAllPartsPlan.js` (plan partagé par le survol et le clic), `services/commitMeshBrushAllPartsService.js`.

**Sélection et survol d'une partie peinte (éditeur 3D, Pinceau non armé)**

- Le survol d'une peinture affiche son propre retour (ligne verte sur une arête, pointillé bleu sur une facette) et un tooltip « modèle peintre · Arête · 3,20 ml » / « Face · 12,40 m² · peint sur <hôte> » (`ThreedHoverTooltip.setPaint`). L'hôte n'est pas survolé.
- Le clic sur une peinture **sélectionne l'hôte** (une peinture n'a pas de panneau propre) et **surligne la peinture** (`meshPaint.highlightedPaintId` : pointillé / ligne fluo en 3D, ligne surlignée et défilée dans la section « Parties peintes » du panneau de l'hôte). Tout autre clic 3D retire ce surlignage ; Maj / clic droit sur une peinture valent un clic simple.
- Une **annotation 2D créée par le Pinceau** (ligne plate POLYLINE sans hauteur posée sur une face) est une annotation ordinaire : au clic / survol, une ligne épaisse (`Line2`) posée sur une face **gagne** sur cette face à égalité de distance (`threedEditor/js/utilsAnnotationsManager/preferLineHits.js`, tolérance = 2 × celle de `attachFatLineRaycast`), y compris sur l'arête mesh / le segment de l'annotation déjà sélectionnée.
- Picking des peintures : `services/pickDisplayedMeshPaint.js` (arête par distance écran `BRUSH_EDGE_PICK_PX`, facette par raycast explicite des peaux, `PAINT_FACE_WIN_M`), partagé avec `meshBrushPick`. Les objets de peinture restent invisibles au raycast générique.

**Section « Parties peintes » du panneau d'une annotation hôte** (`components/SectionAnnotationPaintedParts.jsx`, `hooks/useHostPaintedParts.js`)

- Liste, **regroupées par modèle peintre** (icône, libellé, « 2 facettes · 12,40 m² · 1 arête · 3,20 ml »), les peintures de l'hôte (`RowTemplatePaintedPart`, clic = cadrage 3D, suppression au survol) et les annotations 2D que le Pinceau a créées sur lui (`autoCreatedFrom` = hôte, `autoGenKind: "MESH_BRUSH"`, `RowHostBrushAnnotation`, clic = sélection de l'annotation).
- Le bouton « **Tout retirer** » de l'en-tête retire d'un coup toutes les peintures de l'hôte (faces et arêtes, tous modèles) que le scope peut supprimer, en une étape d'undo. Les annotations 2D créées par le Pinceau sont des annotations ordinaires : elles restent.
- Auto-masquée sans partie. Le surlignage posé depuis la liste est retiré au démontage de la liste ; celui posé par un clic 3D survit au changement de panneau.

**Surfaces courbes et courbes**

- Le seuil de lissage est le réglage « Sélection de face » de la vue 3D. À 0, le Pinceau ne voit que des facettes planes et des arêtes droites.
- Une surface courbe réunit les facettes voisines dont le pli, mesuré **entre voisines**, reste sous le seuil : un mur en arc, une révolution ou une extrusion de profil se peignent en un clic (`index.getSurfaces(angleDeg)`).
- Une courbe réunit les arêtes vives qui se touchent, restent dans un même plan et tournent de moins que le seuil au point de contact (`index.getCurves(angleDeg)`). Une courbe fermée répète son premier point.
- « Révolution partielle » n'est qu'une option d'affichage : l'hôte est lu sur son **tour complet** (la moitié affichée et sa copie tournée de 180° autour de l'axe, `getHostPartData`). La peinture et ses quantités couvrent donc toute la révolution, quel que soit le côté affiché ; seule la moitié visible est dessinée et cliquable (`getHostHalfView`, `utils/clipPaintGeometry.js`). Une révolution partielle réglée sur l'axe (`revolutionPhi`) est, elle, la vraie géométrie.
- Une surface courbe ou une courbe est **une seule ligne** : une seule quantité, un seul clic pour la retirer.
- Une facette (ou un segment) déjà peinte seule fait partie de la surface (ou de la courbe) qui la contient : peindre la surface la remplace.

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
          | FACE { vertices: [p…], facets: [[contour, …trous], …], angleDeg }   // surface courbe
          | EDGE { points: [p0, p1, …], sides?: [[x, y, z], …], angleDeg? },   // angleDeg : courbe
  paintedAt,                            // actions utilisateur uniquement (arbitrage des conflits)
  sync: { state: "OK" | "ORPHAN", geomHash, syncedAt, provisional?, nearOnly? } }
```

**Conventions géométriques** (conversions dans `utils/meshPaintFrame.js`)

- Un point est `[nx, ny, z]` :
  - `nx` et `ny` sont normalisés sur l'image de référence du fond de plan, comme `db.points` ;
  - `z` est le z local en mètres, **absolu**, dans le repère de `imagesManager.getGroup(baseMapId)`. À la différence de `mesh3d`, `offsetZ` y est déjà inclus.
- La normale d'une FACE est en mètres locaux et pointe **vers le côté peint** : c'est elle qui encode le côté.
- Une facette coupée reste une seule ligne (multi-polygone).
- `sides` (EDGE) contient les normales des facettes bordées par l'arête. Le recalage s'en sert pour ne pas confondre deux arêtes parallèles. Pour une courbe : les facettes qui la bordent sur toute sa longueur.
- Surface courbe : un maillage **indexé** de facettes planes. Chaque boucle est un tableau d'indices dans `vertices` (un sommet partagé n'est stocké qu'une fois). Il n'y a pas de `normal` : chaque contour tourne dans le sens anti-horaire vu du côté peint.
- `angleDeg` est le seuil de lissage utilisé au clic. Le recalage reconstruit la surface ou la courbe avec ce même seuil, quel que soit le réglage de l'appareil.
- Dans les utilitaires, une surface courbe est un `LocalFace` `{ polygons, normal, curved: true, angleDeg }` : une facette par polygone, `normal` seulement indicative.
- Recalage d'une partie courbe : quelques-unes de ses plus grandes facettes (ou de ses segments) sont recalées comme des parties planes ; les facettes (ou arêtes) retrouvées désignent la surface (ou la courbe) de l'hôte, reprise en entier.

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

- Entrée `MESH_BRUSH` dans `mapEditor/constants/drawingTools.jsx` (`requiresTemplate: true`, `neverDefaultTool: true`, offert dans les deux éditeurs), ajoutée en fin des `tools` POLYGON / POLYLINE de `annotations/constants/drawingShapeConfig.js`. Icône rouleau (`FormatPaint`), raccourci **P** (`DRAWING_TOOL_HOTKEYS`, `p → MESH_BRUSH`) : actif seulement une fois un dessin armé (avant, P reste la bascule du mode promenade en 3D).
- Les listes d'outils dépendent de l'éditeur (`mapEditor/utils/filterDrawingToolsForEditor.js`) : la peinture de parties n'existe que dans le module Dessin en 3D (`selectMeshBrushPartType` est nul ailleurs). Le pinceau ne peut devenir ni `defaultTool` ni un outil du Dessin sans modèle.
- `utils/meshBrushTools.js` et `utils/meshBrushSelectors.js` (`selectIsMeshBrushActive`).
- Activation : le pinceau s'appuie sur `threedDrawing/hooks/useTemplateFaceDrawBridge.js` (`drawingMode.active`). La machinerie de dessin de faces (`useDrawingPointerHandlers`, `DrawingOverlayThreed`) reste inerte. Quitter la 3D (T) garde l'outil armé : il devient le pinceau de modèle 2D.

**Sélection de la cible et validation du clic**

- `services/meshBrushPick.js` choisit la cible. Les peintures existantes sont prioritaires (`services/pickDisplayedMeshPaint.js`), ce qui permet d'en retirer une même si son hôte est masqué.
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
  - facettes en deux peaux `FrontSide` : la peau avant décollée de 1 mm vers le côté peint, et une peau arrière, tournée vers l'autre côté et décollée de 0,5 mm, pour qu'une peinture reste visible des deux côtés d'un hôte fin (mesh ouvert, mur mince) ; sur un hôte épais la peau arrière est dans le volume, masquée par le test de profondeur ; si les deux côtés d'un hôte fin sont peints, la peau avant de chaque côté (1 mm) passe devant la peau arrière de l'autre (0,5 mm) ;
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
- Panneau de l'annotation hôte : section « Parties peintes » par modèle (`components/SectionAnnotationPaintedParts.jsx`).
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
- Déplacement / rotation d'un objet 3D importé (`OBJECT_3D`, hôte bbox sans `db.points`) : `services/moveMeshPaintsWithBboxHostService.js` applique l'affine pixel du geste (`utils/buildBboxHostAffine.js` : translation, ou rotation autour d'un centre — centre de la bbox ou pivot — avec la convention de `applyWrapperTransformToPoints`) aux peintures de l'hôte, dans la transaction de l'hôte, plus `dz` pour l'altitude : glisser / poignée de rotation dans `MainMapEditorV3`, champ Rotation du panneau, commandes « Déplacer » / « Tourner » 2D (`commitAnnotationsTransform2d`) et 3D (`commitAnnotationsTransformFrom3d`). Un objet 3D n'est pas redimensionnable.
- « Régénérer depuis le PDF » (`regenerateBaseMapFromPdfPageService`).
- Coupes 2D (`useHandleSplitPolyline`, `useHandleSplitCommit`) et Coupe face (`cutFaceAlongPathService`).

## Peintures créées par une procédure (« Quantités clé »)

Une procédure auto peut écrire des peintures à la place d'annotations : la
procédure `PISCINE_QTES_V1` (`Data/edx/automatedAnnotationsProcedures/piscine/
piscineQtesV1Entry.js`) métré la piscine depuis les meshs 3D de ses ouvrages
comme si l'utilisateur les avait peints.

- **Construction hors scène** : `services/buildHeadlessHostParts.js` construit
  l'objet d'une annotation RÉSOLUE (`annotations/utils/resolveAnnotationRowForBuild.js`
  depuis la ligne db + ses points) avec `createAnnotationObject3D` (sans
  anti-crénelage), le pose sous un `createBaseMapFrameGroup` et le lit par
  `getHostPartData` — même index de parties et même `hash` que le pinceau.
- **Hôte évidé par des soustractions** (`relAnnotationSubtractions`) :
  `buildHeadlessCarvedHostParts` (même fichier) construit les annotations
  soustraites avec le constructeur d'opérandes du carve de la scène
  (`buildAnnotationSolidObjectsAsync`, chacune dans le repère de son propre
  fond de plan) et applique le même booléen (`subtractAnnotationGeometries`,
  règle `isHollowSubtractionHost`) avant la lecture des parties : l'hôte est
  lu évidé, comme son objet affiché, avec le même hash.
- **Instance de bloc comme hôte** (`BLOCK_INSTANCE`, `Features/blocks`) :
  `services/createHeadlessBlockPrototypes.js` est le jumeau hors scène de
  `BlocksManager` — les membres du bloc construits une fois, chaque instance =
  le placeholder de la scène rempli de clones posés par les mêmes helpers
  (`threedEditor/js/utilsBlocksManager/blockFrame.js`). La peinture est
  portée par l'instance (`hostAnnotationId` = l'instance, géométrie dans le
  repère de son fond de plan) : une ligne par instance, recalée comme tout
  hôte quand l'instance est construite en 3D. Modifier le bloc ne recale pas
  les peintures de ses instances tant qu'elles ne sont pas reconstruites :
  relancer la procédure.
- **Repère commun** : `utils/transformHostParts.js` (matrices 4×4 colonne‑major,
  sans three) amène les îlots / chaînes de chaque hôte dans le repère du plan
  (z haut) et renvoie les géométries locales dans le repère de l'hôte.
- **Pipeline pur** `utils/meterHostParts.js` :
  `classifyHostPartsByRules` (table de rôles déclarative : orientation des
  normales d'un solide ouvert — INTERIOR / EXTERIOR / UP ; un hôte FERMÉ
  (`isClosed`, p. ex. un muret, un podium, un prisme étagé par des découpes
  de hauteur) garde les normales sortantes de l'index —, catégorie par face), `weldSupportFootprints` (empreinte d'un hôte posé retirée de la face
  horizontale qui le porte : sol − fosse, tête de muret − podium, plage −
  muret — ce sont les « soustractions » du métré : les ouvrages restent
  simplement posés les uns sur les autres), `findReentrantChains` (arêtes concaves d'un hôte : dièdre < 180° vu
  du côté peint, îlots coplanaires regroupés) et `findBaseEdgesOnSupports`
  (arêtes de base d'un muret posé sur une face support). Une règle peut
  cumuler les deux (`angles: ["INTRA", "BASE"]`).
- Découpes de hauteur : `resolveAnnotationRowForBuild` dérive `heightFaces`
  (`resolveHeightCuts` + `computeHeightFaces`, comme `useAnnotationsV2`) pour
  que le prisme étagé soit construit hors scène.
- **Écriture** : lignes `buildMeshPaintRow` + `autoCreatedByProcedureKey` /
  `autoCreatedFrom` (champs non indexés) ; `services/writeProcedureMeshPaintsService.js`
  balaie les peintures précédentes des mêmes sources puis écrit les nouvelles,
  en un seul pas d'undo.
- **Bande « Dessin auto »** : une procédure qui peint le déclare dans le
  registre (`outputKind: "MESH_PAINTS"`). Ses peintures sont alors des sorties
  comme les annotations (`annotationsAuto/services/getProcedurePaintOutputs.js`,
  `hooks/useProcedurePaintOutputs.js`) : la bande affiche l'icône « rafraîchir »
  et le bouton « supprimer » dès qu'il en existe, et
  `hooks/useDeleteProcedureOutputs.js` les balaie (suppression, relance avec
  remplacement de `useRunProcedureReplacing`, boutons de
  `ProcedureActionButtons`). `directLaunch: true` (procédure sans option à
  choisir) lance directement depuis la bande, sans dialog.
- Le toaster du lanceur affiche `result.message` (totaux) quand le résultat
  ne crée aucune annotation (`annotationsAuto/utils/notifyProcedureRunResult`).

Tests : `node --test src/Features/meshPaint/utils/*.test.mjs` (classification,
soudure, angles sur des soupes synthétiques, transformations),
`node src/Features/meshPaint/services/createHeadlessBlockPrototypes.test.mjs`
(instances de bloc avec les vrais constructeurs : taille réelle, rotation
horaire à l'écran, même hash que le solide dessiné en place),
`node src/Features/meshPaint/services/buildHeadlessHostParts.test.mjs` (hôte
évidé : prisme ouvert découpé par une annotation collée, prisme fermé
intact) et le replay
headless complet `node src/Data/edx/automatedAnnotationsProcedures/piscine/__test__piscineQtesV1.mjs`
(vrais builders, totaux de la piscine par défaut).

## Pièges

- **Nouveau service qui réécrit des coordonnées** dans le repère d'un fond de plan : il doit aussi traiter `db.meshPaints`, comme il traite `mesh3d`.
- **Drapeau des overlays** : les objets de peinture portent `isPaintOverlay`, pas `isHoverOverlay`. Picking générique, index de snap (`useVertexSnap`), contours de coupe et traits « aquarelle » l'ignorent (leur `raycast` est désactivé) ; seul `services/pickDisplayedMeshPaint.js` les cible (Pinceau, survol / clic de l'éditeur) ; l'export 3D le garde.
- **Parent des overlays** : ne jamais placer une peinture sous la racine de son hôte, car un hôte masqué n'est pas construit du tout.
- **Immutabilité des lignes** : les formes locales sont mises en cache par objet ligne (WeakMap). Ne jamais modifier une ligne Dexie en place.
- **Type de partie ≠ forme du modèle** : ne jamais filtrer les lignes `meshPaints` sur `partType` vs `drawingShape` du modèle (une facette peinte par un modèle Ligne disparaîtrait) ; la seule garde est « le modèle peut peindre » (`canTemplatePaint`).
- **Pièces d'une surface découpée** : une révolution, une coque ou un profil balayé coupés par « Découpe horizontale / verticale » (Coupe face, 3D — `annotation.surfaceCuts`, rejoués par `applySurfaceCuts`) sont affichés en plusieurs meshes `SOLID` tagués `userData.surfaceCutPiece`. Chaque mesh `SOLID` d'un hôte surface porte ce tag dès la première construction, découpé ou non (hôte non découpé = une pièce par mesh, numérotée par `planSurfacePieces`), pour la sélection au 2ᵉ clic — la face sélectionnée est la région de survol de la pièce (`getFaceRegion`, angle de sélection des faces), pas tout le mesh. `buildHostPartIndexFromObject` les transmet à `buildHostPartIndex` (`triGroups`) : deux pièces ne partagent jamais un groupe de plan, un îlot ni une surface lisse, chacune est donc une cible du Pinceau à part entière ; un hôte mono-mesh (pièce 0 seule) se partitionne comme avant. Une peinture courbe posée avant une découpe suit la tessellation de l'hôte : couper **avant** de peindre.
- **Faces séparées par un point de rupture** : un point d'un POLYGON avec hauteur ou d'un mur (POLYLINE avec hauteur) marqué `isBreak` (switch « Rupture » de la barre du point) sépare les deux faces qu'il borde, même coplanaires ou sous l'angle « Sélection de face ». Les constructeurs étiquettent chaque triangle (`geometry.userData.triParts`, `getBreakSegmentLabels` : une étiquette par suite de segments entre deux ruptures) ; `buildHostPartIndexFromObject` ajoute l'étiquette au groupe de **chaque** triangle du mesh, étiquette 0 comprise (`triGroups`, `getTriangleFaceLabels` — les surfaces lisses ne séparent deux îlots que s'ils ont tous deux un groupe) et `getFaceRegion` (`faceHoverHighlight`, partagé par le survol normal, la sélection de face au 2ᵉ clic, les outils de face et `pickHostFace`) ne traverse jamais une étiquette : le survol normal et le Pinceau montrent les mêmes faces. La conversion en faces de l'objet 3D (`convertObject3DToMesh3d` → `buildMesh3dFromTriangles({ labels })`, derrière `getDisplayedMesh3d` / `getEditableMesh3d`) regroupe elle aussi les triangles par plan **et** par étiquette : la face sélectionnée au clic (overlay, sommets, surface) et les outils de face (Fusionner, Déplacer, coupe, suppression, push/pull) portent sur la même sous-face que le survol, et le maillage enregistré à la première édition garde ces faces coplanaires distinctes. Chaque face est donc une cible à part ; l'arête de rupture n'est pas une arête peignable quand les faces sont coplanaires, et les arêtes haut / bas restent une seule chaîne. Après un carve CSG la géométrie est remplacée : les étiquettes sont perdues. Une peinture posée avant la rupture sur le côté entier se recale en une ligne couvrant les deux faces.
- **Prisme ouvert** : un POLYGON avec hauteur dont un segment est masqué n'a pas la face latérale correspondante ; l'hôte n'est plus fermé (`index.isClosed` faux), ses deux côtés sont peignables. Comme hôte d'une soustraction c'est une surface ouverte (`annotations/utils/isOpenSidePrism.js`, dans `isHollowSubtractionHost`) : il est découpé sans ajout de faces, et une annotation collée à l'une de ses faces (une « Fosse » sous un fond) y découpe son empreinte.

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

- Géométrie de référence exacte, indépendante de l'affichage. Aujourd'hui, une partie courbe suit la tessellation **affichée** : si le nombre de segments change, la peinture devient orpheline. En « Révolution partielle », les ouvertures creusées dans la moitié affichée sont reproduites en miroir dans la moitié masquée (qui n'est pas construite).

**Recalage**

- Recalage sans affichage des hôtes non construits en 3D (hôte masqué, ou 3D fermée). En V1, c'est le badge « À vérifier » qui le signale.

**Performance**

- Rendu groupé par modèle au-delà d'environ 1000 peintures.
- Une seule résolution des parties partagée par tous les consommateurs de quantités.
