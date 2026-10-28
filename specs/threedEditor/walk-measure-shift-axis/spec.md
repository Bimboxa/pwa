# Spec — Cote Maj du télémètre en première personne (rayon sur un demi-axe du repère)

| | |
|---|---|
| **Feature** | Télémètre du mode première personne : second point contraint par Maj |
| **Domaine** | `threedEditor` (walk mode) + `localScans` (nuages de points) + `threedMesh` (pick) + `scene3d` |
| **Issue / branche** | — (commit `136177f16` sur `main`) |
| **Statut** | Implémenté, en attente de validation UI (2026-10-28) |
| **Doc technique** | `src/Features/localScans/README.md` § « First-person laser meter » |

---

## 1. Contexte & problème

En mode première personne (touche **P**), l'outil **MEASURE** (télémètre) crée
une cote en deux tirs (**Espace**) : chaque tir pose un point sur la surface
visée par le réticule (maillage, fond « Scène 3D » ou nuage de points d'un
Scan 3D). Après le premier point, **Maj** contraint le second point.

La première version (commits `e11897918` / `bb021c98d`) faisait partir un rayon
du premier point le long de la normale de son plan et l'arrêtait sur un
« plan facial » reconstruit à chaque poll à partir du point visé (plan RANSAC
du nuage ou face du maillage sous le réticule). Le rayon était fixe mais le
plan facial changeait à chaque pick (refit RANSAC autour d'un autre point
toutes les 250 ms, alternance face de la Zmap / nuage) : le point d'arrivée
**sautait de quelques centimètres** alors que l'utilisateur balayait la même
surface.

## 2. Objectif

Avec Maj maintenu après le premier point :

- la direction est **un demi-axe du repère de l'éditeur 3D** (± X, ± Y, ± Z
  du gizmo, yaw du repère compris), choisi par la visée ;
- le point d'arrivée est **la première surface réellement rencontrée** le long
  de ce rayon fixe — maillages, fonds « Scène 3D », ou nuage de points ;
- dans un nuage, l'arrêt se fait sur la **première zone assez dense**
  (un disque qui avance le long de l'axe), jamais sur un point isolé ;
- tant que la visée reste du même côté, **le point ne bouge pas** ;
- le trait provisoire prend la **couleur de l'axe** (X rouge, Y vert, Z bleu).

## 3. Scénarios utilisateur

1. **Largeur d'une pièce dans un nuage** — Premier tir sur le mur A. Maj
   maintenu, le réticule tourné vers le mur d'en face : le trait provisoire part
   du premier point le long de l'axe horizontal le plus proche de la visée, en
   couleur de l'axe, et se termine sur le mur B par une cible (disque + anneau)
   couchée dans la surface. Balayer le mur B, le sol ou le plafond du même côté
   ne fait pas bouger le point. ✅ *Critère : point d'arrivée fixe, longueur
   affichée stable (HUD « measureLiveM »).*
2. **Hauteur sous plafond** — Premier tir au sol, Maj, réticule vers le
   plafond : axe Z (bleu), arrivée sur la première tranche dense du nuage au
   plafond. ✅ *Critère : la longueur ne varie pas en déplaçant le réticule sur
   le plafond.*
3. **Changer de demi-axe** — Toujours Maj, le réticule passe nettement vers un
   autre côté (autre mur, derrière) : le trait bascule sur le nouveau demi-axe,
   nouvelle couleur si l'axe change, nouveau point. Revenir vers le premier côté
   redonne exactement le premier point (cache). ✅
4. **Valider** — **Maj + Espace** commet la cote entre le premier point et le
   point d'arrivée prévisualisé (annotation COTE persistée comme pour un tir
   normal, hébergée par le fond de plan de la surface touchée quand il y en a
   un). Si aucune surface n'est rencontrée dans cette direction : pas de
   prévisualisation, et Maj + Espace ne fait rien. ✅
5. **Repère tourné** — Après « Orienter le repère », les demi-axes suivent le
   yaw du repère : la cote Maj suit les murs du bâtiment, pas les axes monde. ✅

## 4. Exigences fonctionnelles

- **FR-1 Direction** — Les six demi-axes candidats sont ± `dir` de
  `getUserAxesWorldDirections(axesSettings.yawDeg)` (user X = monde +X, user Y
  = monde +Z, user Z = monde +Y, X/Y tournés du yaw). Le demi-axe retenu est
  celui dont le produit scalaire avec `normalize(aim − start)` est le plus grand
  en valeur absolue, le signe donnant le sens. Si le point visé est confondu
  avec le premier point (≤ 2 cm), la direction de vue de la caméra remplace
  `aim − start`.
- **FR-2 Point visé (aim)** — Le point sous le réticule tel que lu par la boucle
  10 Hz existante : le plus proche entre le hit maillage (frais) et le dernier
  hit nuage (throttlé 250 ms) ; à défaut le point « vide » à 30 m sur le rayon
  caméra (qui donne quand même un côté).
- **FR-3 Surface rencontrée** — La plus proche de :
  - maillages et fonds « Scène 3D » : `pickWorldHitAlongRay` (Raycaster depuis
    le premier point, `near = 0,05 m` pour ne pas retoucher la surface de
    départ ; mêmes filtres clipping / visibilité que le pick du réticule ;
    `intersectScene3d` accepte un rayon arbitraire) ;
  - nuages affichés : `scanPicker.pickRay(start, dir, {radius 0,10 m,
    minDepth 0,05 m, slab 0,05 m, minPoints 6})`, voir FR-4.
- **FR-4 Densité dans le nuage** — Dans le worker (`pickLocalScanPoint`, mode
  `query.ray`), les points à moins de `radius` du rayon et au-delà de
  `minDepth` sont triés par profondeur ; une tranche d'épaisseur `slab`
  démarre à chaque point ; la première tranche comptant au moins
  `max(minPoints, ⌈25 % de la tranche la plus dense⌉)` points est retenue
  (`findDenseSlabDepth`). Le point graine = profondeur moyenne de cette
  tranche, **sur le rayon**. Le fit de plan existant (RANSAC dans un cube de
  1 m, normale snappée horizontal / vertical à 12°) est appliqué autour de la
  graine ; le point d'arrivée = rayon ∩ plan ajusté si l'intersection reste dans
  le cube, sinon la graine. Un point isolé en l'air n'arrête jamais le rayon.
- **FR-5 Stabilité / cache** — `walkOrthoRay` lance au plus une recherche par
  demi-axe (`X+`, `X-`, …) et par premier point ; le résultat (HIT ou NONE) est
  mis en cache jusqu'au `reset()` : nouveau tir (premier ou second point),
  changement d'outil (**O**), effacement (**⌫**). Le relâchement de Maj ne vide
  pas le cache.
- **FR-6 Prévisualisation** — Tant que la recherche est en cours (PENDING), la
  dernière prévisualisation reste affichée. HIT : trait fin plein du premier
  point au point d'arrivée + cible (disque translucide, anneau, croix) couchée
  dans la surface rencontrée (normale du hit, sinon le rayon), **dans la couleur
  de l'axe** (`AXIS_COLORS`). NONE : aucune prévisualisation, longueur nulle
  dans le HUD.
- **FR-7 Commit** — Maj + Espace résout le demi-axe courant (recherche attendue
  si en cours), puis passe par `shootMeasure` comme un tir normal : la cote est
  persistée par `commitDrawnCoteService` avec le `baseMapId` de la surface
  touchée. Le tir est ignoré si le premier point a changé entre-temps ou si rien
  n'est rencontré.
- **FR-8 Sans Maj** — Comportement inchangé : point libre sous le réticule
  (nuage prioritaire s'il est plus proche, pulse du plan détecté).

## 5. Modèle de données

Aucun changement de schéma. La cote commise est une annotation `COTE`
ordinaire (`commitDrawnCoteService`, points 3D hébergés par le fond de plan
de la surface touchée ou le fond principal). Lecture seule de
`threedEditor.axesSettings.yawDeg` (Redux) pour les axes.

## 6. Mécanisme

```
poll 10 Hz (useWalkMode)                      Maj + Espace (onPrimaryStart)
  aim = readAim()                               axis = orthoRay.getAxis(start, aim)
  axis = orthoRay.getAxis(start, aim.point)     await orthoRay.resolve(start, axis)
  r = orthoRay.get(start, axis)                 → shootMeasure({point: end, …})
  HIT  → updatePreview(end, {planeNormal, color: axis.color})
  NONE → updatePreview(null)
  PENDING → dernière preview conservée

walkOrthoRay.search(start, axis)
  meshHit = pickWorldHitAlongRay(start, dir, near 5 cm)      (sync)
  scanHit = scanPicker.pickRay(start, dir, disc 10 cm)       (worker, async)
  hit = le plus proche → {end: hit.point, planeNormal: hit.normal ?? dir, hit}
  cache[axis.id] = résultat
```

Fichiers : `threedEditor/services/walkOrthoRay.js` (choix de l'axe, cache),
`threedEditor/utils/getOrthoRayAxis.js`, `threedEditor/hooks/useWalkMode.js`
(branchement poll + tir), `threedEditor/services/walkMeasureController.js`
(`updatePreview` couleur), `threedMesh/services/shootPick.js`
(`pickWorldHitAlongRay`), `scene3d/services/intersectScene3d.js` (option
`ray`), `localScans/services/createLocalScanRayPicker.js` (`pickRay`),
`localScans/utils/pickLocalScanPoint.js` (mode rayon, `findDenseSlabDepth`).
`threedEditor/utils/getPerpendicularIntercept.js` (ancien plan facial) est
supprimé.

## 7. Cas limites & limitations

- **Nuage clairsemé** : un mur avec moins de 6 points dans le disque de 10 cm
  n'arrête pas le rayon (constantes `SCAN_RAY_RADIUS_M`, `SCAN_SLAB_M` dans
  `walkOrthoRay.js`, `minPoints` dans `createLocalScanRayPicker.pickRay`).
- **Objet proche de la surface de départ** (< 5 cm, ex. plinthe) : ignoré par
  `minDepth`.
- **Zmap d'un fond scan** : mesh raycastable même masqué (comme pour le pick du
  réticule) ; sur un rayon horizontal elle n'est touchée que si le relief monte.
- **Surface absente du côté visé** : pas de point, pas de repli sur un plan
  parallèle (le vide n'est pas mesurable, comme pour un tir normal).
- **Changement de repère pendant la mesure** : les demi-axes sont relus à
  chaque poll, mais une recherche déjà en cache pour `X+` n'est pas refaite
  tant que le premier point n'est pas reposé.

## 8. Vérification

```bash
node --test src/Features/threedEditor/utils/getOrthoRayAxis.test.mjs src/Features/localScans/utils/pickLocalScanPoint.test.mjs
```

Manuel : projet avec un fond scan et son nuage affiché (« Points ») → **P** →
outil MEASURE (**O**) → Espace sur un mur → Maj maintenu, réticule vers le mur
d'en face : trait coloré selon l'axe, point fixe en balayant ; viser le plafond :
trait bleu ; Maj + Espace : cote persistée au point prévisualisé.
