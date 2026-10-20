# Container baseMap du carnet : Croper, Reset et cadenas d'échelle

| | |
|---|---|
| Feature | `portfolioEditor` / `portfolioBaseMapContainers` |
| Issue | — |
| Statut | implémenté (2026-10-20) |
| Replay | `specs/portfolioEditor/container-crop-scale-lock/scaleLabelReplay.js` |

## Contexte

Dans l'éditeur de portfolio (« Carnet de détails »), un container baseMap est un rectangle de page `{x, y, width, height}` en pt qui affiche une fenêtre `viewBox` (px de référence) du fond de plan. L'échelle imprimée vaut `container.width / viewBox.width` pt par px. Elle correspond au 1:N de la zone d'impression uniquement quand ce ratio égale `pageDims(zone.format).width / zone.width`.

Avant cette évolution :

- hors mode « Cadrer », les poignées étiraient le cadre sans toucher le viewBox : l'échelle changeait silencieusement ;
- en mode « Cadrer », la molette zoomait ; les poignées recadraient (viewBox suit le cadre) ;
- le cartouche n'affichait « 1:N » que pour un container pleine page avec `viewBox == zone` : tout recadrage faisait disparaître l'échelle ;
- le « Reset » du mode Cadrer ne remettait que le viewBox.

## Objectif

Permettre de recadrer un fond de plan sans jamais modifier son échelle, de remettre la zone d'impression en place dans la page, et de protéger l'échelle par un cadenas — tout en gardant un cartouche cohérent (« 1:N » tant que le ratio est conservé).

## Scénarios utilisateur

1. **Croper** — Le container est sélectionné ; je clique « Croper ». Les poignées recadrent le cadre (le contenu reste fixe sur la page), le drag déplace l'image dans le cadre, la molette ne zoome pas. « Terminer » quitte le mode. Le cartouche affiche toujours « 1:100 ».
2. **Reset** — Le container a été déplacé, recadré ou zoomé ; je clique « Reset ». La page reprend le format / l'orientation de la zone d'impression, le container redevient pleine page avec la zone comme viewBox. Le cartouche affiche « 1:100 ».
3. **Cadenas** — Un container issu d'une zone 1:N démarre verrouillé : pas de poignées hors mode, « Cadrer » grisé avec un tooltip. Je peux déplacer (souris, flèches) et croper. Je déverrouille : les poignées (étirement à ratio verrouillé) et « Cadrer » (zoom) reviennent. Verrouiller pendant un mode « Cadrer » quitte ce mode.

## Exigences

- FR-01 : le bouton « Croper » ouvre un mode de recadrage (`framingMode = "CROP"`) : pan + poignées de crop, sans zoom molette.
- FR-02 : le bouton « Reset » applique le layout par défaut du container (`getBaseMapContainerDefaultLayout`) : zone → page au format de la zone, container pleine page, `viewBox = zone` ; sans zone → fit dans la zone de contenu avec viewBox image entière. Il ne modifie pas `scaleLocked`.
- FR-03 : un `IconButton` cadenas bascule `container.scaleLocked`. Verrouillé : poignées masquées hors mode, « Cadrer » désactivé. Déverrouillé : comportement historique.
- FR-04 : défaut du cadenas = `zone.scale > 0` quand `scaleLocked` n'est pas stocké.
- FR-05 : le cartouche affiche « 1:N » dès que le ratio pt/px du container (largeur et hauteur) égale celui de la zone à 0,5 % près, quelle que soit la taille du cadre ou le format de la page. Même règle à l'export PDF (même util).

## Modèle de données

```js
// db.portfolioBaseMapContainers (Dexie, UNDO table) — new optional field
{ ..., scaleLocked: true | false | undefined }

// redux portfolioBaseMapContainers
{ framingContainerId: string | null, framingMode: "FRAME" | "CROP" | null }
```

`scaleLocked` n'est pas indexé (aucun bump de schéma) et est un booléen (rien à remapper dans l'export Krto).

## Mécanisme

- `ContainerTransformOverlay` reçoit `scaleLocked` ; `showHandles = framing || !scaleLocked`. En mode framing (FRAME ou CROP) les poignées recadrent le viewBox proportionnellement (mécanisme existant) : l'échelle est conservée.
- `FramingOverlay` reçoit `allowZoom` (`framingMode !== "CROP"`) ; le listener `wheel` n'est pas attaché quand il est faux.
- `getPortfolioPageScaleLabel` compare `container.width / viewBox.width` et `container.height / viewBox.height` à `pageDims(zone).width / zone.width` (viewBox absent = la zone).

### Règle d'échelle — exemples (zone A3 paysage, 4000 px, 1:100)

| Container | viewBox | Libellé |
|---|---|---|
| pleine page 1191 × 842 | zone | `1:100` |
| croppé 595 × 337 | 2000 × 1131 (même ratio) | `1:100` |
| pleine page | 3000 × 2121 (zoom) | `""` |
| étiré 1429 × 1010 | zone | `""` |
| croppé, hauteur +10 % | zone × ratio | `""` |
| croppé même ratio sur une page A2 | — | `1:100` |
| zone « libre » (`scale: null`) | zone | `""` |

## Cas limites

- Un container déjà zoomé puis verrouillé garde son état : le cadenas fige, il ne corrige pas. « Reset » rétablit l'échelle.
- Les containers POV et les fonds de plan sans taille d'image gardent leur logique propre (fit dans la zone de contenu).
- Les raccourcis clavier (flèches = déplacement, Suppr) ne changent pas l'échelle et restent actifs quand le cadenas est fermé.

## Vérification

```bash
node_modules/.bin/esbuild specs/portfolioEditor/container-crop-scale-lock/scaleLabelReplay.js --bundle --format=esm --platform=node --alias:Features=./src/Features --alias:App=./src/App --outfile=/tmp/scaleLabelReplay.mjs && node /tmp/scaleLabelReplay.mjs
```

```bash
npx eslint src/Features/portfolioEditor src/Features/portfolioBaseMapContainers src/Features/portfolioPages
```

## Fichiers impactés

- `src/Features/portfolioEditor/utils/getBaseMapContainerDefaultLayout.js` (nouveau)
- `src/Features/portfolioEditor/utils/resolveContainerScaleLocked.js` (nouveau)
- `src/Features/portfolioEditor/utils/getPortfolioPageScaleLabel.js`
- `src/Features/portfolioEditor/components/PortfolioPageSvg.jsx`
- `src/Features/portfolioEditor/components/BaseMapContainerSvg.jsx`
- `src/Features/portfolioEditor/components/ContainerTransformOverlay.jsx`
- `src/Features/portfolioEditor/components/FramingOverlay.jsx`
- `src/Features/portfolioBaseMapContainers/portfolioBaseMapContainersSlice.js`
- `src/Features/portfolioPages/hooks/useCreateBaseMapPage.js`
- `src/Features/titleBlocks/data/defaultTitleBlockManifest.js` (commentaires)
