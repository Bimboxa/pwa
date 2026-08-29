# Spec — Ouvertures collées : suivi de l'hôte au drag de sommet

| | |
|---|---|
| **Feature** | Les ouvertures collées (`isOpening`) suivent leur annotation hôte sur TOUS les chemins de déplacement de sommet |
| **Domaine** | `mapEditor` (+ `annotations`) |
| **Branche** | `fix_openings_follow_host_vertex_drag` |
| **Statut** | Implémenté et validé (2026-08-29) |
| **Replay** | [`scripts/replay/openingAnchorRemapReplay.js`](../../../scripts/replay/openingAnchorRemapReplay.js) |

---

## 1. Contexte & problème

Une ouverture (outil `OPENING_SEGMENT`, « Porte / Fenêtre ») est collée sur un
segment de son hôte (POLYLINE / POLYGON) via une relation
`db.relAnnotationOpenings` qui ancre l'ouverture sur des **ids de points** de
l'hôte : `{hostSegmentStartPointId, hostSegmentEndPointId,
hostArcControlPointId, hostDistanceM, carve}`. `hostDistanceM` est l'abscisse
curviligne du **centre** de l'ouverture, mesurée depuis le sommet de référence.

Au commit d'un changement de géométrie de l'hôte,
`reflowOpeningsForHostService` repositionne les 2 points de l'ouverture et
rafraîchit le carve. Ce reflow était branché sur la plupart des chemins (drag
de sommet simple, multi-sélection, split de segment, transform wrapper,
déplacement 3D, édition de cote) — **mais pas sur deux chemins** :

1. **Le fork** (`duplicateAndMovePoint`) : sélectionner une annotation puis
   dragger un de ses sommets activait *toujours* le mode fork
   (`usePointDrag` : `isPotentialDuplicate = mustFork ||
   selectedAnnotationHasPoint`), même pour un point non partagé. Le fork
   mint un **nouvel id de point**, réécrit les refs de l'hôte, et ne
   remappait ni l'ancre de la relation ni ne déclenchait le reflow →
   l'ouverture restait sur place, ancrée sur un point orphelin. Le bloc de
   fork (2026-02) est antérieur à la feature « openings glued » (2026-07).
2. **Le snap-replace** (`replacePointBySnap`, quick-edit d'un sommet d'une
   annotation non sélectionnée relâché sur un sommet existant) : swap d'id
   sans remap d'ancre ni reflow, avec en plus suppression du point orphelin.

Signature du bug : l'ouverture reste à `hostDistanceM` exact du sommet de
référence **le long de l'ancienne direction**, et `updatedAt` de l'hôte est
bumpé par le `db.annotations.update` du fork.

## 2. Objectif

Quel que soit le geste qui déplace un sommet de l'hôte, l'ouverture collée
doit suivre : conserver sa distance curviligne au sommet de référence, son
carve, et — quand le geste garde l'id du point stable — suivre **en live**
pendant le drag (ghost du `TransientTopologyLayer`).

## 3. Scénarios utilisateur

1. **Drag d'un sommet exclusif** — L'utilisateur sélectionne une polyligne
   portant une ouverture et drague un sommet du segment ancré. ✅ *Critère :
   l'ouverture suit en live pendant le drag et reste à `hostDistanceM` du
   sommet de référence au relâchement (plus de fork : l'id du point est
   stable, chemin `handlePointMoveCommit` → reflow).*
2. **Drag d'un sommet partagé (fork)** — Deux murs à moi partagent un sommet ;
   je drague ce sommet sur le mur sélectionné. ✅ *Critère : le mur voisin ne
   bouge pas (fork conservé) ; l'ouverture du mur édité saute à sa place au
   commit (remap d'ancre sur le nouvel id + reflow) ; cadenas / segments
   cachés / guides du mur édité survivent au swap d'id.*
3. **Quick-edit snap** — Je drague un sommet d'un mur non sélectionné et le
   relâche sur un sommet existant d'une autre annotation. ✅ *Critère :
   l'ancre suit le swap d'id vers le point de snap et l'ouverture est
   reflowée ; les refs guides/flags suivent aussi.*
4. **Ancre déjà stale** — Une relation dont l'ancre référence des ids re-mintés
   par un ancien carve. ✅ *Critère : le reflow (appelé avec `hostIds`)
   ré-ancre par projection du centre sur le contour restauré (auto-guérison
   existante).*
5. **Relation d'un autre utilisateur** — Le hook d'ownership refuse l'écriture
   de la relation. ✅ *Critère : dégradation silencieuse (ancre stale, log
   console), le geste de l'utilisateur n'est jamais annulé.*

## 4. Exigences fonctionnelles

- **FR-1** — Tout swap d'id de point sur un hôte (fork, snap-replace) remappe
  les ancres des relations `relAnnotationOpenings` dont il est
  `hostAnnotationId`, avec le même map old-id → new-id que ses refs. Les
  relations des annotations *partageant* le point ne sont **pas** remappées
  (leur géométrie n'a pas changé).
- **FR-2** — Le remap précède le reflow : `anchorIsValid` passe et
  `hostDistanceM` est conservé à l'identique (pas de fallback projection).
- **FR-3** — Après `duplicateAndMovePoint` et `replacePointBySnap`, le caller
  (`MainMapEditorV3`) appelle `reflowOpenings({movedPointIds, hostIds})` —
  `hostIds` inclus pour auto-guérir les ancres déjà stales.
- **FR-4** — Le fork ne s'active que si le point est réellement partagé :
  `mustFork || (selectedAnnotationHasPoint && affectedIds.length > 1)`. Un
  point exclusif passe par le move simple (id stable, reflow existant, ghost
  live, pas de point orphelin).
- **FR-5** — Le fork et le snap-replace réécrivent **toutes** les refs de
  l'annotation via le helper partagé `remapPointIds` (contour, cuts, inner
  points, guideLines, isoHeightLines, profileLines, tableaux d'ids de flags
  de segments racine + par cut) — plus seulement `points`/`cuts`.
- **FR-6** — Un échec d'écriture sur une relation (ownership) est contenu par
  relation (try/catch + log) : jamais d'abandon du geste ni de la transaction
  ambiante.

## 5. Modèle de données

Aucun changement de schéma. `relAnnotationOpenings` inchangé ; seuls les
champs d'ancre existants (`hostSegmentStartPointId`, `hostSegmentEndPointId`,
`hostArcControlPointId`) sont réécrits via le writer existant
`updateAnnotationOpeningAnchor` (whitelist de champs).

## 6. Mécanisme

```
geste (fork / snap-replace)
  │ 1. swap d'id dans les refs de l'annotation éditée (remapPointIds sur clone)
  ▼
db.annotations.update(host, refs remappées)
  │ 2. remapOpeningAnchorsForHosts({hostAnnotationIds, pointIdMap})
  │    — computeOpeningAnchorRemap(rel, map) par relation, écrit via
  │      updateAnnotationOpeningAnchor, try/catch par relation
  ▼
ancres à jour (mêmes ids que les refs de l'hôte)
  │ 3. reflowOpenings({movedPointIds: [newId], hostIds}) (caller)
  │    — anchorIsValid passe → computeOpeningEndpointsFromHost repositionne
  │      les 2 points de l'ouverture à hostDistanceM du sommet de référence
  ▼
ouverture recollée + carve rafraîchi
```

Sémantique conservée : l'ouverture est à distance curviligne **fixe** du
sommet de référence — étirer le mur par l'autre extrémité ne la déplace pas.

## 7. Cas limites

- Relation étrangère (ownership) → ancre stale conservée, log, geste intact ;
  au prochain reflow elle s'auto-guérit par projection (FR-3 / scénario 4).
- Point exclusif référencé par une seule annotation mais présent dans un
  guide/cut d'une autre → compte comme partagé (`affectedIds` scanne tous les
  types de refs) → fork conservé.
- Fork d'un sommet partagé : pas de ghost live de l'ouverture pendant le drag
  (le nouvel id n'existe pas encore) — elle saute à sa place au commit.
  Limitation acceptée, rare depuis FR-4.
- `replacePointBySnap` : le check d'orphelin ne scanne toujours que
  `points`/`cuts` (comportement existant) ; les refs guides étant désormais
  remappées, le risque de ref pendante diminue.

## 8. Vérification

```bash
# Deterministic replay (13 checks, exits 1 on failure):
node_modules/.bin/esbuild scripts/replay/openingAnchorRemapReplay.js --bundle --format=esm --platform=node --alias:Features=./src/Features --alias:App=./src/App --outfile=/tmp/openingAnchorRemapReplay.mjs && node /tmp/openingAnchorRemapReplay.mjs
```

Le replay couvre : swaps start / end / arc-control, relation non concernée →
null, relation soft-deleted → null, et la couverture de `remapPointIds`
(contour + type préservé, ring de cut, flags racine + par cut, refs
guideLine, non-mutation de la source). + `npm run lint`, `npm run build` ;
validation visuelle par l'utilisateur (scénarios §3).

## 9. Fichiers impactés

| Rôle | Fichiers |
|---|---|
| Util pur (remap d'ancre) | `annotations/utils/computeOpeningAnchorRemap.js` *(nouveau)* |
| Service remap | `annotations/services/remapOpeningAnchorsForHosts.js` *(nouveau)* |
| Commit fork | `mapEditor/services/duplicateAndMovePoint.js` (remapPointIds + remap ancres + retour `newPointId`) |
| Commit snap-replace | `mapEditor/services/replacePointBySnap.js` (remapPointIds, table rel dans la transaction, remap ancres) |
| Callers + reflow | `mapEditor/components/MainMapEditorV3.jsx` (`handleDuplicateAndMovePoint`, `handlePointSnapReplace`) |
| Cause racine (de-fork) | `mapEditor/hooks/usePointDrag.js` (condition de fork), commentaire dans `mapEditor/components/InteractionLayer.jsx` |
| Tests | `scripts/replay/openingAnchorRemapReplay.js` *(nouveau)* |
