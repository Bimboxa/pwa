# Spec — Système « GO gaine » et procédure « Cuvelage gaine »

|                          |                                                                                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Feature**              | Génération paramétrique du gros œuvre d'une gaine depuis un seuil 2 points, puis cuvelage de la gaine selon la hauteur d'eau                         |
| **Domaine**              | `annotationsAuto` (procédures `Data/edx/automatedAnnotationsProcedures/gaine/`), bibliothèques `GO_GAINE` / `CUVELAGE_GAINE`, objectsLibrary SYSTEMS |
| **Issue / branche**      | — (demande directe, 2026-10-14)                                                                                                                      |
| **Statut**               | Implémenté, tests node verts (2026-10-14) ; validation UI par l'utilisateur à faire                                                                  |
| **Exemple de référence** | [`example-annotations.json`](example-annotations.json) → [`expected-render.svg`](expected-render.svg)                                                |

> Le rendu attendu est **généré par l'implémentation réelle** via
> [`generateExpectedRender.js`](generateExpectedRender.js) (rejeu de `gaineGoV1`
> puis de `gaineCuvelageV1` sur le seuil de l'exemple, pour trois hauteurs
> d'eau). Si un builder change, on régénère le SVG.

---

## 1. Contexte & problème

Le gros œuvre d'une gaine de ventilation (sol en pente depuis le seuil, voiles
périphériques, sous-face de dalle, trémie et ses voiles) se dessinait à la main
en six annotations partageant leurs points, puis le cuvelage (parois, sous-face)
se redessinait encore à la main pour chaque hauteur d'eau.

## 2. Objectif

1. **Système « GO gaine »** : dessiner le **sol principal** de la gaine
   (polygone jusqu'à la trémie, segment du seuil **masqué**) et la **trémie**
   (polygone collé à un côté du sol), lancer la procédure depuis le sol ou le
   listing, saisir **3 hauteurs** dans un dialog (coupe, champs in-situ comme
   le château d'eau) et obtenir le GO complet, taggé avec les catégories
   génériques `OUVRAGE:SOL`, `TOPO:FRONTIERE_SOL`, `TOPO:SOUS_FACE_PLANCHER`,
   `TOPO:TREMIE` pour rester lisible par les procédures de type cuvelage.
   _(Première version du 2026-10-14 matin : STRIP « Seuil gaine » 2 points +
   5 cotes, remplacée le même jour à la demande de l'utilisateur.)_
2. **Procédure « Cuvelage gaine »** : depuis un Sol dupliqué dans le listing
   « Cuvelage gaine », produire les parois et la sous-face en fonction de la
   hauteur d'eau, en retrouvant le GO voisin par catégorie dans la bbox du Sol.

## 3. Scénarios utilisateur

1. **Dessiner une gaine** — Bibliothèque → Dessin → Systèmes → « GO gaine » →
   « Dessiner » : le modèle « Sol » est armé ; l'utilisateur dessine le sol
   principal (jusqu'à la trémie), masque le segment du seuil, dessine la
   trémie (modèle « Trémie ventilation », bleu ciel hachuré) collée à un côté
   du sol, puis lance depuis la toolbar du sol (ou la bande « Dessin auto »).
   Le dialog « GO gaine — hauteurs » s'ouvre (longueur du sol lue sur le
   dessin) ; « Lancer » écrit la pente, remonte la trémie à H1 et crée le
   voile U, la sous-face et les voiles de trémie. ✅ _Critère : panneau A du
   SVG ; en 3D le sol est en pente (E1 au seuil), le U est à l'extérieur, la
   trémie a ses voiles au-dessus de la dalle._
2. **Modifier les hauteurs** — Play / Actualiser dans la toolbar du sol rouvre
   le dialog pré-rempli ; les anciennes sorties sont remplacées, la pente et
   l'altitude de la trémie sont réécrites. ✅
3. **Cuveler la gaine** — Créer un listing depuis la bibliothèque « Cuvelage -
   Gaine », sélectionner le Sol du GO gaine → « Dupliquer » → modèle « Sol » du
   listing Cuvelage gaine. Saisir la hauteur d'eau (altitude absolue) et lancer
   depuis la toolbar du Sol dupliqué ou depuis la bande « Dessin auto » du
   listing. ✅ _Critère : panneaux B / C / D du SVG._

## 4. Exigences fonctionnelles

- **FR-01** Paramètres (m) : `H1` hauteur sous dalle, `H2` hauteur **totale**
  (sol → sommet des voiles de trémie), `E1` épaisseur du seuil (le sol monte
  de E1 au seuil : « file la pente »). La géométrie en plan (longueur, largeur,
  trémie) est lue sur les polygones dessinés ; l'épaisseur des voiles =
  `strokeWidth` du modèle « Voile béton » (20 cm).
- **FR-02** Entrées : le sol principal (`OUVRAGE:SOL`) avec **un seul**
  segment masqué (`hiddenSegmentsIdx`) = le seuil ; la trémie (`TOPO:TREMIE`)
  collée à un côté du sol (les deux extrémités et le milieu du côté sur le
  contour de la trémie, tol. 5 cm). Toutes les altitudes sont relatives à
  l'`offsetZ` du sol (sol à `z0`, dalle / trémie à `z0 + H1`).
- **FR-03** Sorties (points partagés avec les polygones d'entrée) :

  | Sortie          | Modèle                               | Géométrie                                                                      | Champs                                                    |
  | --------------- | ------------------------------------ | ------------------------------------------------------------------------------ | --------------------------------------------------------- |
  | Pente (patch)   | sur le sol principal                 | `guideLines` : milieu du côté collé à la trémie (bas) → milieu du seuil (haut) | `slopePct = E1 / longueur × 100`, 2 points frais          |
  | Trémie (patch)  | sur la trémie                        | —                                                                              | `offsetZ: z0 + H1`                                        |
  | Voile U         | « Voile béton » `TOPO:FRONTIERE_SOL` | STRIP : contour de (sol ∪ trémie) moins le segment du seuil                    | `offsetZ: z0`, `height: H1`, bande extérieure, `isExt`    |
  | Sous-face dalle | `TOPO:SOUS_FACE_PLANCHER`            | anneau du sol principal                                                        | `offsetZ: z0 + H1`                                        |
  | Voiles trémie   | « Voile béton »                      | STRIP fermé sur la trémie                                                      | `offsetZ: z0 + H1`, `height: H2−H1`, bande **extérieure** |

- **FR-04** Erreurs bloquantes : `H2 ≤ H1`, paramètre ≤ 0, pas de segment
  masqué (ou plusieurs), aucune trémie collée, sol trop court, modèle manquant.
- **FR-05** Cuvelage : par Sol `CVG:SOL` (z0 = `offsetZ`) ; eau ≤ z0 → rien ;
  « Paroi » `CVG:PAROI` (POLYLINE, `offsetZ` z0, `height` = min(sommet du
  voile, eau) − z0, `isExt` du voile) le long des voiles `TOPO:FRONTIERE_SOL`
  dont le pied est à z0 ; eau > `offsetZ` de la sous-face → copie « Sous-face »
  `CVG:SOUS_FACE` ; eau > `offsetZ` de la trémie → parois sur le contour de la
  trémie avec les voiles dont le pied est à cette altitude (anneau fermé →
  `closeLine`). Hauteur d'eau vide = pas de plafonnement.
- **FR-06** Les sorties du cuvelage sont dans le listing du Sol, taggées
  `autoCreatedFrom` = id du Sol, avec des lignes de points **fraîches** (jamais
  celles du GO).

## 5. Modèle de données

- Nouvelles catégories (`Data/edx/mappingCategories.js`) : `TOPO:TREMIE` ;
  nomenclature `CVG` (« Cuvelage gaine ») : `SOL`, `PAROI`, `SOUS_FACE`.
- Bibliothèques : `annotationTemplates/GO_GAINE.js` (library-level
  `procedureKeys:["GAINE_GO_V1"]` ; Sol `OUVRAGE:SOL`
  `procedureKeys:["GAINE_GO_V1"]` ; Voile béton ; Sous-face dalle ; Trémie
  ventilation `TOPO:TREMIE` bleu ciel hachuré) et
  `annotationTemplates/CUVELAGE_GAINE.js` (`procedureKeys:["GAINE_CUVELAGE_V1"]`
  ; Sol `CVG:SOL` `procedureKeys:["GAINE_CUVELAGE_V1"]` ; Paroi ; Sous-face).
- Système : `objectsLibrary/manifest.json` → `gaine_go_auto` (`tab:"SYSTEMS"`,
  `procedureKey:"GAINE_GO_V1"`, `templateLibraryKey:"GO_GAINE"`).
- Hauteurs persistées sur la ligne du sol principal :
  `procedureParams.GAINE_GO_V1` ; pente écrite dans `guideLines` du sol
  (2 lignes `db.points`), trémie remontée via `annotationPatches`.

## 6. Mécanisme

### 6.1 Dialog (`gaine/DialogProcedureGaineGo.jsx`)

Trois champs (H1, H2, E1) sur une coupe (`shared/ProcedureSchematicFields`,
composant extrait du dialog révolution) ; la longueur du sol est lue sur la
ligne brute du sol (lignes `db.points` + segment masqué), la trémie est
dessinée avec une longueur nominale. Ouvert par le lancement mono-source
(toolbar du sol, ou bande du listing avec un seul sol) ; sinon les hauteurs
stockées (`procedureParams.GAINE_GO_V1`) ou les défauts s'appliquent.

Contrat générique `{ open, annotation, onClose, onConfirm(params) }` ;
géométrie du schéma : `gaine/buildGaineGoPreviews.js` (mètres, y vers le bas).

### 6.2 GO (`gaine/buildGaineGoGeometry.js` + `gaine/gaineGoV1.js`)

Builder pur px : côté collé = premier côté non masqué dont les extrémités et
le milieu sont sur le contour de la trémie ; voile U = anneau du sol parcouru
depuis la fin du segment masqué, le côté collé remplacé par « le grand tour »
de la trémie (`ringPathTheLongWay`, l'arc le plus long entre les deux
extrémités) ; pente = ligne guide stockée comme « Pente auto »
(`guideLines[{points:[{pointId,type}], slopePct}]`, remplace les pentes
existantes) ; trémie remontée par `annotationPatches`.

Builder pur px. Pièges : l'orientation du U est décidée géométriquement
(normale du premier segment vs centroïde du sol) ; l'anneau des voiles de
trémie est forcé en aire signée positive (formule d'`offsetPolygon`) car le
rendu 2D (`offsetPolygon`, normalisé : +1 = toujours vers l'extérieur) et les
détecteurs de frontières (`offsetControlPolyline`, non normalisé) ne
coïncident que dans ce sens ; les
refs du STRIP restent `{id}` purs (un `offsetTop` sur un STRIP bascule le 3D en
ruban). Sorties via `createRunOutputCollector` (extension `seedPoints` pour
réutiliser les deux lignes du seuil), `type:"STRIP"` forcé après `baseProps`.

### 6.3 Cuvelage (`gaine/gaineCuvelageGeometry.js` + `gaine/gaineCuvelageV1.js`)

Arêtes guides = `collectFrontierEdges` (exporté de `surfacesVerticales.js`,
bande-aware), **pré-filtrées par altitude du pied** (`filterEdgesAtZ`, ±2 cm) —
indispensable : `findGuideEdgeForSubEdge` retient le guide au sommet le plus
haut et l'arête du fond du Sol matcherait sinon le voile de trémie coplanaire.
`computeRingWallRuns` : sous-division aux projections des sommets de voiles,
classification à 5 cm, fusion des spans de mêmes (isExt, sommet) en runs,
anneau sans trou → `closeLine`, points colinéaires supprimés. Contenance
sous-face / trémie dans le Sol = test de bbox (`bboxContains`, les arêtes sont
partagées, un point-in-polygon y est indéfini).

## 7. Exemple de référence

![expected-render](expected-render.svg)

Entrée : sol principal `P1 (5540.192, 1979.405) → A' (5933.238, 1979.405) →
B' (5933.238, 2104.257) → P2 (5540.192, 2104.257)`, segment `P2→P1` masqué ;
trémie `A' → A (6004.488, …) → B → B'` ; `meterByPx 0.011814`, hauteurs
`H1 0.9, H2 1.4, E1 0.05`. Panneau A : GO généré (pente en pointillé orange,
voile U autour de sol ∪ trémie). B : eau 0.5 m → parois latérales plafonnées
à 0.5 m. C : eau 1.1 m → parois 0.9 m, sous-face, parois de trémie 0.2 m à
partir de 0.9 m. D : sans hauteur d'eau → tout, hauteurs pleines.

## 8. Cas limites & limitations

- Le sol sous la trémie n'est pas modélisé (le sol principal s'arrête à la
  trémie) : le cuvelage n'y crée ni sol ni parois, seules les parois de
  trémie au-dessus de la dalle.
- Les parois de cuvelage le long du sol sont deux runs ouverts (les grands
  côtés) : pas de voile au pied du côté collé à la trémie.
- Relancer la procédure crée deux nouvelles lignes `db.points` pour la pente
  (les anciennes restent orphelines, sans effet).
- Pied des parois de cuvelage = `offsetZ` du Sol : la pente E1 est ignorée
  (aucune paroi sur l'arête du seuil de toute façon).
- Les sols / sous-faces du GO portent un `deltaOffsetZ3d` de ±5 mm (rendu 3D
  seulement) pour ne pas se confondre avec les copies du cuvelage.
- Relancer le GO gaine régénère son Sol mais pas la copie cuvelage (à
  redupliquer). Les deux procédures ne sont volontairement **pas chaînées**.
- Listing GO masqué → « Aucun voile « Frontière sol » visible… ».
- Anneaux tessellés (pas d'arc dans un GO gaine), cuts du Sol ignorés.

## 9. Vérification

```bash
npx esbuild src/Data/edx/automatedAnnotationsProcedures/gaine/__test__gaineGoV1.mjs --bundle --format=esm --platform=node --alias:Features=./src/Features --outfile=/tmp/__test__gaineGoV1.mjs && node /tmp/__test__gaineGoV1.mjs
npx esbuild src/Data/edx/automatedAnnotationsProcedures/gaine/__test__gaineCuvelageV1.mjs --bundle --format=esm --platform=node --alias:Features=./src/Features --outfile=/tmp/__test__gaineCuvelageV1.mjs && node /tmp/__test__gaineCuvelageV1.mjs
node_modules/.bin/esbuild specs/annotationsAuto/gaine-go-cuvelage/generateExpectedRender.js --bundle --format=esm --platform=node --alias:Features=./src/Features --alias:App=./src/App --outfile=/tmp/specRenderGaine.mjs && node /tmp/specRenderGaine.mjs
```

Non-régression (refactor du dialog / collector / export) :
`__test__surfacesVerticales.mjs`, `reservoir/__test__reservoirV1.mjs`,
`chateauEau/__test__chateauEauV1.mjs`, `chateauEau/__test__chateauEauSurfacesV1.mjs`.

## 10. Fichiers impactés

- Nouveaux : `automatedAnnotationsProcedures/shared/{schematicLayout.js, ProcedureSchematicFields.jsx}` (le modèle « Seuil gaine » de la première version a été retiré), `automatedAnnotationsProcedures/gaine/*`, `annotationTemplates/{GO_GAINE, CUVELAGE_GAINE}.js`, `objectsLibrary/assets/gaine_go_auto.svg`.
- Modifiés (tous sous `src/Data/edx/`, gitignoré) : `automatedAnnotationsProcedures/index.js`, `revolution/DialogProcedureRevolutionSection.jsx`, `revolution/revolutionRunHelpers.js`, `surfacesVerticales.js`, `mappingCategories.js`, `annotationTemplatesLibraries.js`, `objectsLibrary/manifest.json`.
- Aucune modification sous `src/Features/`.
