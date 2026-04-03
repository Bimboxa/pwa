# Drag d'annotations — Architecture Optimistic Overlay

## Problème résolu

Lors du drag d'une annotation, l'ancien pattern (masquer le statique + afficher un ghost + setTimeout pour re-afficher)
provoquait un **blink** entre la suppression du ghost et l'arrivée des nouvelles données depuis la DB.

## Nouveau pattern : Overlay + Opacity

### Principe

Le noeud SVG de l'annotation statique n'est **jamais démonté** pendant un drag.
Il est rendu **invisible** (`opacity: 0`) tandis qu'un overlay (TransientAnnotationLayer) affiche
l'annotation à sa position déplacée. Quand les données DB arrivent, le statique est restauré (`opacity: 1`)
et l'overlay est supprimé **dans le même render cycle** — zéro blink.

### Cycle de vie d'un drag

```
mouseDown
  → dragAnnotationState = { pending: true }

mouseMove (seuil > 3px)
  → pendingMovesRef.set(annotationId, { deltaPos: {0,0}, partType })
  → setPendingMovesVersion(v+1)  → StaticMapContent/EditedObjectLayer lisent le pendingMove → opacity:0
  → dragAnnotationState = { active: true }
  → TransientAnnotationLayer s'affiche (overlay)

mouseMove (drag actif)
  → pendingMovesRef.set(..., { deltaPos, partType })  — mise à jour du ref, pas de re-render
  → setDragAnnotationState(...)  — re-render pour le TransientAnnotationLayer uniquement

mouseUp
  → commitSnapshotRef = snapshot des coordonnées AVANT le drag
  → onAnnotationMoveCommit(annotationId, deltaPos, ...)  — commit DB (async)
  → dispatch(triggerAnnotationsUpdate())  — force useLiveQuery à re-fetch
  → commitPendingRef = annotationId
  → startCommitPendingWatch()  — lance le fallback timeout (500ms)
  → dragAnnotationState = null  — cleanup immédiat
  → Le pendingMove RESTE → l'overlay reste visible via getPendingMove()

useEffect([annotations])  — convergence par comparaison de snapshot
  → Compare les coordonnées courantes de l'annotation avec le snapshot
  → Si les coordonnées n'ont PAS changé → on ne fait rien (données intermédiaires)
  → Si les coordonnées ONT changé → les vraies données DB sont arrivées :
    → clearCommitPending() (annule aussi le fallback timeout)
    → pendingMovesRef.delete(annotationId)
    → setPendingMovesVersion(v+1)
    → StaticMapContent/EditedObjectLayer rendent l'annotation à sa nouvelle position (opacity:1)
    → TransientAnnotationLayer disparait (getPendingMove retourne null)

Fallback timeout (500ms)
  → Si le snapshot ne détecte pas de changement (ex: dimensions verrouillées par template),
    le timeout clear le pendingMove pour éviter un état bloqué
```

### Fichiers clés

| Fichier | Rôle |
|---------|------|
| `InteractionContext.jsx` | `pendingMovesRef` (Map), `pendingMovesVersion` (state), `getPendingMove()` |
| `InteractionLayer.jsx` | Gère le cycle mouseDown → mouseMove → mouseUp, convergence snapshot + fallback timeout |
| `StaticMapContent.jsx` | Lit `getPendingMove()` — rend `opacity:0` si pendingMove existe |
| `EditedObjectLayer.jsx` | Idem — `opacity:0` si pendingMove |
| `TransientAnnotationLayer.jsx` | Overlay de rendu à 60fps pendant le drag |
| `applyDeltaPosToAnnotation.js` | Utilitaire pur — applique un delta à une annotation (IMAGE: aspect ratio, RECTANGLE: libre) |
| `MainMapEditorV3.jsx` | `handleAnnotationMoveCommit` — commit DB + `dispatch(triggerAnnotationsUpdate())` |
| `NodeRectangleStatic.jsx` | Handles de resize grisés si dimension contrainte par template |

### Pourquoi opacity:0 et pas return null ?

`return null` démonte le noeud SVG. Quand les données arrivent, React doit remonter le noeud = 2 commits React minimum.
`opacity: 0` garde le noeud monté. Le passage opacity 0→1 + mise à jour des coords se fait en 1 seul commit React.

### Pourquoi un ref (pendingMovesRef) et pas un state ?

Pendant le mousemove à 60fps, on met à jour le deltaPos. Si c'était un state, chaque mise à jour
déclencherait un re-render de tous les consumers du context (dont StaticMapContent avec N annotations).
Avec un ref, seul le TransientAnnotationLayer re-rend (via setDragAnnotationState local).

`pendingMovesVersion` (state) n'est incrémenté que 2 fois par cycle de drag :
1. Au start du drag (pour déclencher opacity:0)
2. À la convergence DB (pour restaurer opacity:1)

### Pourquoi la convergence par snapshot et pas par useEffect([annotationsUpdatedAt]) ?

`useLiveQuery` est **async** : quand `annotationsUpdatedAt` change (via `dispatch(triggerAnnotationsUpdate())`),
le re-fetch DB démarre mais n'est pas instantané. Le problème se manifeste en 2 temps :

1. `annotationsUpdatedAt` change → `useLiveQuery` produit un résultat **intermédiaire** avec les anciennes données
2. Le re-fetch async termine → `useLiveQuery` produit le résultat **final** avec les nouvelles données

Si on clear le pendingMove dès le premier changement de `annotations` (résultat intermédiaire),
l'annotation statique est re-affichée à son **ancienne** position pendant 1-2 frames → blink visible.

La solution : on stocke un **snapshot** des coordonnées au mouseUp et on compare avec les données courantes.
Tant que les coordonnées sont identiques au snapshot, c'est un résultat intermédiaire → on ne clear pas.
Dès que les coordonnées diffèrent du snapshot, les vraies données DB sont arrivées → on clear.

Un **fallback timeout** (500ms) est ajouté pour couvrir les cas où le snapshot ne détecte pas de changement
(ex: dimensions verrouillées par un annotationTemplate, ou erreurs de précision float). Le timeout est annulé
si la convergence par snapshot réussit en premier.

---

## Resize : IMAGE vs RECTANGLE

### IMAGE — Aspect ratio contraint

Le resize conserve toujours le ratio d'aspect (width/height). Le delta horizontal pilote le redimensionnement
et la hauteur s'adapte automatiquement. Code identique dans `applyDeltaPosToAnnotation` et `handleAnnotationMoveCommit`.

### RECTANGLE — Resize libre par dimension

Le resize modifie width et height **indépendamment**. Chaque dimension répond à son delta (x ou y).

#### Contraintes template (`annotationTemplateProps.size`)

Si un `annotationTemplate` définit `size.width` et/ou `size.height`, ces dimensions sont **verrouillées** :

- `size.width != null` → la largeur est fixée, le delta X est ignoré pendant le resize
- `size.height != null` → la hauteur est fixée, le delta Y est ignoré pendant le resize
- Les handles de coin (NW, NE, SW, SE) sont **grisés** (`pointerEvents: none`, couleur grise, opacity réduite) dès qu'au moins une dimension est contrainte
- Le **move** et la **rotation** restent toujours disponibles
