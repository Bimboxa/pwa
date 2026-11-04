# threedMergeFaces — fusions d'annotations dans l'éditeur 3D

Deux commandes réunissent plusieurs annotations en **une seule annotation maillée** (`isMesh3d`) :

- **« Fusionner des faces »** (`MERGE_FACES`) : deux annotations qui se touchent par des faces coplanaires, choisies face par face ; fait disparaître le trait noir tracé sur leur frontière commune.
- **« Fusionner les annotations »** (`MERGE`, mode maille) : la sélection courante (shift+clic, lasso), quel que soit le type de contact — face, arête ou simple sommet — et quels que soient les types d'origine (un mur POLYLINE avec une dalle POLYGON). Voir la section dédiée en fin de document.

Disponibles dans l'éditeur 3D du module Dessin.

## « Fusionner des faces »

## Vocabulaire (français → code)

| Terme employé ici             | Nom dans le code                                                                                                                                                                         |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fusionner des faces (l'outil) | mode `threedEditor.mergeFacesMode` ; commande `MERGE_FACES` de la toolbar unifiée des commandes (`commandsToolbar/commands/mergeFaces`) — une face sélectionnée est la graine |
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

## « Fusionner les annotations » — mode maille (`MERGE`)

La commande `MERGE` de la toolbar unifiée (`commandsToolbar/commands/merge`) est **hybride** (`resolveMergeSelection.js`) :

1. **Fusion 2D paramétrique** (`useMergeAnnotations`, inchangée) quand elle s'applique : que des lignes ou que des surfaces, aucune maille, et — dans l'éditeur 3D seulement — mêmes `offsetZ` / `height`, aucun décalage de sommet, même épaisseur pour des polylignes. Le résultat reste une annotation 2D classique.
2. **Fusion en maille** (`services/mergeAnnotationsToMeshService.js`) sinon, dans l'éditeur 3D seulement (elle lit la scène) : la graine reçoit le mesh union (`writeMesh3dService`, devient / reste `POLYGON isMesh3d`), les autres annotations sont supprimées. Un seul pas d'annulation. En 2D la commande est désactivée avec la raison « Fusion en maille disponible dans l'éditeur 3D ».

### Règle des modèles (décision utilisateur 2026-11-04)

`resolveMergeTemplate` : au plus **un** modèle dans la sélection. Tous le même modèle, ou tous sans modèle, ou un modèle + des sans-modèle : la graine est la première annotation sélectionnée **qui porte le modèle**, les sans-modèle absorbées « prennent » son modèle (et sa liste). Deux modèles distincts → `MIXED_TEMPLATES`. Les types d'origine peuvent différer (contrairement à `areMergeableTypes` de la fusion de faces).

### Refus

Même fond de plan (`DIFFERENT_BASE_MAP`), aucune ouverture ni soustraction (`HAS_RELATIONS`), toutes convertibles (`isAnnotationConvertibleToMesh3d` ou déjà `isMesh3d` ; `NOT_EDITABLE` sinon — révolutions, profils, coques, mailles découpées par CSG en direct), et surtout **contact obligatoire** : des objets disjoints sont refusés (`NOT_TOUCHING`, « Les annotations ne se touchent pas »). Les mailles **ouvertes** sont acceptées (`getEditableMesh3d` avec `allowOpen` : un mur PX est une chaîne de quads sans épaisseur, un polygone plat est une feuille).

### Géométrie

`utils/mergeMesh3dMeshes.js` replie la graine avec les autres, dans un ordre qui marche (une annotation qui ne touche pas *encore* le résultat attend la passe suivante). Pour chaque paire :

- deux **solides fermés dont les volumes se recouvrent** (un mur qui traverse une dalle) → **union CSG** `three-bvh-csg` `ADDITION` (`annotationMesh3d/services/unionMesh3dSolids.js`, brushes construits depuis les mailles locales, pas depuis les objets de scène ; recouvrement mesuré par `INTERSECTION`, seuil `MIN_OVERLAP_VOLUME_M3`) puis relecture en faces planes (`buildMesh3dFromCarvedTriangles`) ;
- sinon → **fusion planaire** `utils/mergeMesh3dSolids.js`, désormais sans plan de départ obligatoire :
  0. `snapMeshesTogether` (2 mm) : les sommets d'une maille sont tirés sur les sommets / arêtes proches de l'autre — les builders ne sont pas tous décalés pareil et deux formes dessinées en 3D peuvent se rater d'un arrondi ;
  1. faces de contact (différences 2D) et 2. unions coplanaires croisées, comme pour les faces ;
  3. `buildMesh3dFromPlanarFaces` : soudure + **jonctions en T** (un sommet posé sur une arête de l'autre maille y est inséré : c'est ce qui relie le haut d'un mur à l'arête de la dalle sur laquelle il est posé) ;
  4. test de contact : `countMesh3dComponents(résultat) < composantes(A) + composantes(B)`, sinon `NOT_TOUCHING` ;
  5. `orientMesh3dFaces` (`annotationMesh3d/utils/orientMesh3d.js`) : solide fermé → vers l'extérieur ; surface ouverte 2-manifold → voisines cohérentes (`isMesh3dOriented`), la plus grande aire garde son côté ; arête à ≥ 3 faces → inchangé.

Tests : `node --test src/Features/threedMergeFaces/utils/*.test.mjs src/Features/annotationMesh3d/services/unionMesh3dSolids.test.mjs` (profil en L avec le mur 1 mm trop bas, boîtes accolées sans plan de départ, disjoints refusés, contact par un sommet, repli hors d'ordre, union CSG mur / dalle).

### Limites V1

- Une arête posée **à l'intérieur** d'une face de l'autre maille (pas sur son bord) n'est pas reliée : refus `NOT_TOUCHING` tant qu'il n'y a ni sommet ni arête de contour commun.
- Une arête partagée par trois faces ou plus garde l'orientation d'entrée (pas d'orientation cohérente possible).
- `mesh3dSource` ne restaure que la graine ; les absorbées ne reviennent que par Ctrl+Z.
- Un POLYGON **à modèle** rendu avec le « Delta offset 3D » sous l'option anti-crénelage est converti décalé : le snap de 2 mm ne rattrape pas un delta plus grand.
- Le mur PX converti en maille était 1 mm trop bas (pas de lift anti-z-fight dans `extrudePolylineWall`) : corrigé avec cette fonctionnalité (le builder applique désormais le même lift que `extrudeClosedShape`), le snap reste le filet de sécurité.
