# threedMergeFaces — « Fusionner des faces » (éditeur 3D)

Réunit deux annotations qui se touchent par des faces coplanaires en **une seule annotation maillée** (`isMesh3d`), ce qui fait disparaître le trait noir tracé sur leur frontière commune. Disponible dans l'éditeur 3D du module Dessin.

## Vocabulaire (français → code)

| Terme employé ici             | Nom dans le code                                                                                                                                                                         |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fusionner des faces (l'outil) | mode `threedEditor.mergeFacesMode` ; ligne `MERGE_FACES` des « Outils de dessin » (`toolItems`, `RowThreedTool`) ; bouton « Fusionner » de la rangée overlay (`OverlayButtonMergeFaces`) |
| Face de départ                | `mergeFacesMode.seed` : `{ annotationId, baseMapId, plane: { point, normal } }` (repère local du fond de plan, z absolu)                                                                 |
| Annotation de départ          | `seedAnnotationId` : elle garde son id, son modèle, sa liste, ses rels, et reçoit le mesh union                                                                                          |
| Annotation absorbée           | `otherAnnotationId` : supprimée (soft delete) par `useDeleteAnnotations`                                                                                                                 |
| Même type                     | `areMergeableTypes` : même `annotationTemplateId` ; sans modèle, même type d'origine (`mesh3dSource.fields.type` d'une annotation déjà maillée, sinon `type`)                            |
| Faces de contact              | faces coplanaires de normales opposées (bout de mur contre bout de mur) : remplacées par leurs différences 2D (`resolveContacts`)                                                        |
| Union des faces               | `coalesceCoplanarFaces` appliqué à chaque **paire** (face de A, face de B) coplanaire qui se touche (`unionAcross`)                                                                      |

## Flux utilisateur

1. Clic sur une annotation, puis clic sur une de ses faces (sélection « annotation d'abord, face ensuite » de `MainThreedEditor`). La rangée overlay se place au point cliqué et propose « Fusionner ».
2. Clic sur « Fusionner » (ou sur la ligne « Fusionner des faces » des outils : le premier clic choisit alors la face de départ, qui est sélectionnée).
3. Chaque clic sur une face **coplanaire** (même orientation à 1°, écart de plan ≤ 3 mm) d'une **autre** annotation fusionne immédiatement cette annotation dans celle de départ. L'outil reste armé : on enchaîne les voisines.
4. Escape quitte l'outil. Ctrl+Z annule une fusion (un seul pas : réécriture du mesh, peintures ré-hébergées, suppression en cascade).

## Règles et refus (toasts dans `utils/mergeFacesMessages.js`)

- Même fond de plan obligatoire (`DIFFERENT_BASE_MAP`).
- Même type / modèle (`DIFFERENT_TYPE`).
- Aucune des deux annotations ne porte d'ouvertures ni ne participe à une soustraction (`HAS_RELATIONS`) — même règle que la découpe 2D de « Coupe face ».
- Les deux annotations doivent avoir des faces éditables (`getEditableMesh3d`) : murs fins PX (quads ouverts), révolutions, profils, coques, rampes, objets découpés par CSG sont refusés (`NOT_EDITABLE`).
- Les deux faces doivent se toucher sur le plan de départ (`NOT_TOUCHING`) : une union qui laisserait l'annotation en deux morceaux est refusée.
- Une face déjà découpée par une ligne (« Coupe face ») garde sa découpe : seules des faces d'annotations **différentes** sont unies (`tags`), jamais deux faces d'une même annotation.

## Géométrie (`utils/mergeMesh3dSolids.js`, pur, testé en node)

1. Faces brutes `{ contour, holes, normal }` des deux meshes (z absolu).
2. Faces de contact : différences 2D `A − B` / `B − A` (`polygon-clipping`) dans la base du plan (`computePlaneBasis`, `planeProjection`). Des bouts identiques disparaissent ; un bout plus haut garde sa partie non couverte.
3. Unions croisées par paire sur chaque plan (`coalesceCoplanarFaces([a, b])`, réparation des T-jonctions incluse).
4. Ré-indexation par `buildMesh3dFromPlanarFaces` (seconde moitié de `buildMesh3dFromTriangles` : annulation des faces opposées identiques, soudure, T-jonctions, `cleanupMesh3d`).

Tests : `node --test src/Features/threedMergeFaces/utils/*.test.mjs`.

## Écriture (`services/mergeAnnotationMeshesService.js`)

Dans un `withUndoGroup` : ré-hébergement des `db.meshPaints` de l'annotation absorbée sur celle de départ, `writeMesh3dService` (l'unique chemin d'écriture d'un mesh : l'annotation devient `POLYGON isMesh3d`, sa projection 2D est re-dérivée, `mesh3dSource` est pris à la première conversion), puis `deleteAnnotationsFn([other])`.

## Limites V1

- `mesh3dSource` de l'annotation de départ ne restaure que **sa** géométrie 2D d'origine ; l'annotation absorbée ne revient que par Ctrl+Z.
- Pas de bascule au re-clic ni d'annulation dédiée.
- Pas de raccourci lettre (toutes les lettres simples de l'éditeur 3D sont prises).
- Deux faces d'une même annotation reliées par une face de l'autre ne sont unies que par paire : la première union absorbe la voisine, la seconde face de la même annotation garde son arête.
