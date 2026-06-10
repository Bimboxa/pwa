# Importer des annotations depuis un dessin à la main — prompt IA générative

> Note : exceptionnellement, ce document est rédigé en français (à la demande),
> mais tout ce qui relève du modèle de données reste en anglais (types, clés
> JSON, schéma).

Ce prompt transforme une photo/scan d'un **croquis fait à la main** en le
« JSON inline » consommé par l'outil du panneau de droite **Import annotations**
(`IMPORT_ANNOTATIONS`).

Utilisation : colle le prompt ci-dessous dans un modèle multimodal, **réponds à
sa première question sur le type de dessin**, joins le dessin, puis colle le JSON
renvoyé dans le champ texte du panneau.

Le schéma est volontairement aligné sur le modèle `annotationTemplate` /
`annotation` de l'application :

- les coordonnées sont **normalisées dans `[0..1]`** par rapport à l'image source
  (origine en haut à gauche, `x`→droite, `y`→bas) ;
- types supportés : **POLYLINE, POLYGON, COTE, STRIP** ;
- les courbes sont encodées en **triplet S-C-S** — un point de contrôle avec
  `"type":"circle"` entre deux sommets normaux (`"square"`), conformément à
  `Features/geometry/utils/arcSampling.js` ;
- un **STRIP** est une bande d'épaisseur constante le long d'une ligne directrice
  — idéal pour les couches de matériaux d'une élévation de détail technique. Son
  épaisseur est portée par `strokeWidth` + `strokeWidthUnit` (`"CM"` ou `"PX"`),
  avec `stripOrientation` (`1` ou `-1`) qui choisit de quel côté de la ligne
  directrice la bande s'étend ;
- `image.widthMeters` permet à l'importeur de déduire l'échelle réelle et **doit
  être renseigné dès que le dessin porte une dimension** (voir « Échelle »
  ci-dessous).

---

## Prompt

> Tu es un interprète de dessins techniques / CAO qui convertit un croquis fait
> à la main en un JSON strict d'annotations pour une application de cartographie.
>
> **ÉTAPE 0 — demander d'abord.** Avant de produire quoi que ce soit, pose à
> l'utilisateur une seule question : *« Quel type de dessin est-ce ? (a) plan vu
> de dessus, ou (b) élévation d'un détail technique ? »* Attends la réponse, puis
> interprète le dessin en conséquence :
> - **Plan (vue de dessus)** : les surfaces sont des POLYGON, les murs/arêtes des
>   POLYLINE.
> - **Élévation de détail technique** : représente en **STRIP** (bande d'épaisseur
>   constante suivant une ligne directrice) aussi bien les **couches de matériaux**
>   de recouvrement (étanchéité, isolant, chape, « rappiage », etc.) que les
>   **bandes du support béton/structurel** — privilégie STRIP plutôt qu'un POLYGON
>   pour toutes ces bandes. Ne garde le POLYGON que pour les zones véritablement
>   surfaciques qui ne se lisent pas comme une bande.
>
> Une fois la réponse obtenue, **ne renvoie QUE un JSON inline (du texte brut)**
> — un seul bloc de texte JSON, directement collable dans le champ du panneau,
> sans aucun commentaire, sans texte autour, et sans clôture de code markdown
> (pas de ```).
>
> **Système de coordonnées** : normalisé par rapport à l'image, origine en
> **haut à gauche**, `x` croît vers la droite, `y` croît vers le bas. Chaque
> coordonnée est un flottant dans `[0,1]` = position en pixels divisée par la
> largeur (`x`) ou la hauteur (`y`) de l'image.
>
> **Types d'éléments** :
> - **POLYLINE** — lignes/segments ouverts (une arête, un cheminement, un axe).
> - **POLYGON** — surfaces/zones fermées (une dalle, une section béton, une
>   zone). Mettre `"closeLine": true`.
> - **STRIP** — une bande d'épaisseur constante le long d'une ligne directrice
>   (une couche de matériau ou une bande du support béton). Donne ses `points`
>   comme la ligne directrice ; règle `strokeWidth` à l'épaisseur avec
>   `strokeWidthUnit:"CM"`, et `stripOrientation` à `1` ou `-1` pour choisir le
>   côté. **La couleur d'un STRIP est portée par `strokeColor`** (et non
>   `fillColor`). **Quand des bandes forment un angle orthogonal (≈ 90°),
>   n'utilise pas un seul STRIP à plusieurs points qui tourne à angle droit : crée
>   un STRIP distinct (à 2 points) par segment droit** — cela évite les artefacts
>   de raccord dans le coin. **À l'inverse, si des segments consécutifs ne sont
>   PAS orthogonaux mais alignés (l'un prolonge l'autre, quasi-colinéaires),
>   fusionne-les en un seul STRIP** au lieu de les laisser séparés.
> - **COTE** — lignes de cote (une mesure entre deux points). Exactement 2
>   points ; règle `"unit"` (`"MM"|"CM"|"M"`), `"decimals"`, et
>   `"showUnitLabel": true`. **Retranscris la valeur écrite à l'identique** (voir
>   « Cohérence »).
> - **Courbes/arcs** — quand un segment est clairement courbe, modélise-le comme
>   un groupe de 3 points sur la même polyline/polygon/strip : sommet de départ
>   (pas de `type`), un **point de contrôle situé sur l'arc** avec
>   `"type":"circle"`, puis le sommet d'arrivée. Les sommets droits n'ont pas
>   besoin de `type`.
>
> **Échelle (important)** : si le dessin porte **une quelconque** dimension (une
> cote, une échelle graphique, une longueur indiquée comme « 1 m » ou « 20 cm »),
> tu DOIS calculer et renseigner `image.widthMeters`. Procède en mesurant, dans
> l'image, l'étendue en pixels de l'élément qu'une cote désigne, en la convertis-
> sant en fraction de la largeur de l'image, puis en déduisant la largeur réelle :
> par ex. si une cote « 1 m » occupe 0.5 de la largeur de l'image, alors
> `image.widthMeters = 1 / 0.5 = 2`. N'omets `widthMeters` que si le dessin ne
> comporte aucune dimension.
>
> **Cohérence (important)** : les VALEURS de cote font foi — **ne modifie jamais
> la valeur écrite d'une cote pour l'accorder à ta géométrie**. Ajuste plutôt la
> GÉOMÉTRIE pour que le dessin soit cohérent avec les valeurs choisies : place
> les points cotés de sorte que, à l'échelle déduite, la distance réelle entre
> eux soit égale à la valeur indiquée. Si deux dimensions sont contradictoires,
> conserve-les telles qu'écrites et fais en sorte que la géométrie s'en approche
> au mieux pour toutes.
>
> **Alignement orthogonal (important)** : on cherche à aligner les annotations
> dessinées sur les axes orthogonaux principaux (horizontal / vertical). Un trait
> tracé presque horizontal doit être rendu parfaitement horizontal (mêmes `y`
> pour ses deux extrémités), et un trait presque vertical parfaitement vertical
> (mêmes `x`). Redresse ainsi les segments quasi-axiaux et les angles proches de
> 90° ; ne conserve une orientation oblique que lorsqu'elle est manifestement
> intentionnelle (pente, biais marqué).
>
> **Templates** : regroupe les éléments partageant un même sens/couleur/style
> dans un seul `annotationTemplate` (un `label` court, le `type` correspondant, et
> le style : `fillColor`/`fillOpacity` pour les polygones, `strokeColor`/
> `strokeWidth`/`strokeWidthUnit` pour les lignes et bandes). Chaque annotation
> référence son template via `annotationTemplateId`. Utilise des couleurs hex
> distinctes par template.
>
> **Schéma de sortie** (exactement cette forme) :
> ```json
> {
>   "version": "1.0",
>   "image": { "width": 2000, "height": 1500, "widthMeters": 2.0 },
>   "annotationTemplates": [
>     {
>       "id": "tpl_concrete",
>       "label": "Béton",
>       "type": "POLYGON",
>       "fillColor": "#9E9E9E",
>       "fillOpacity": 0.4,
>       "strokeColor": "#424242",
>       "strokeWidth": 2,
>       "strokeWidthUnit": "PX"
>     },
>     {
>       "id": "tpl_rappiage",
>       "label": "Rappiage",
>       "type": "STRIP",
>       "strokeColor": "#FF6F00",
>       "strokeOpacity": 1,
>       "strokeWidth": 5,
>       "strokeWidthUnit": "CM",
>       "stripOrientation": 1
>     },
>     {
>       "id": "tpl_cote",
>       "label": "Cote",
>       "type": "COTE",
>       "strokeColor": "#000000",
>       "strokeWidth": 1,
>       "strokeWidthUnit": "PX",
>       "unit": "CM",
>       "decimals": 0,
>       "showUnitLabel": true
>     }
>   ],
>   "annotations": [
>     {
>       "id": "a1",
>       "type": "POLYGON",
>       "annotationTemplateId": "tpl_concrete",
>       "closeLine": true,
>       "points": [ { "x": 0.10, "y": 0.20 }, { "x": 0.16, "y": 0.20 }, { "x": 0.16, "y": 0.70 }, { "x": 0.10, "y": 0.70 } ]
>     },
>     {
>       "id": "s1",
>       "type": "STRIP",
>       "annotationTemplateId": "tpl_rappiage",
>       "points": [ { "x": 0.16, "y": 0.20 }, { "x": 0.16, "y": 0.70 } ]
>     },
>     {
>       "id": "c1",
>       "type": "COTE",
>       "annotationTemplateId": "tpl_cote",
>       "unit": "M",
>       "decimals": 2,
>       "showUnitLabel": true,
>       "points": [ { "x": 0.16, "y": 0.78 }, { "x": 0.66, "y": 0.78 } ]
>     }
>   ]
> }
> ```
>
> Garde des `id` courts et uniques. Préfère des polylignes plus simples et moins
> nombreuses à une multitude de petits segments.

---

## Variante — vectoriser un dessin technique déjà dessiné (CAO / PDF)

À utiliser **à la place** du prompt ci-dessus quand l'entrée n'est pas un croquis
à la main mais un **plan technique précis** (export CAO / PDF, type carnet de
détails d'étanchéité). Ici on ne « devine » pas le tracé : on **vectorise
fidèlement** un dessin déjà exact pour le reproduire en annotations dans
l'application. Le même schéma de sortie s'applique (mêmes types, mêmes clés JSON,
même JSON inline en texte brut).

Différences clés avec le mode croquis :

- **Fidélité, pas interprétation** : reproduis la géométrie telle qu'elle est
  tracée. **Ne redresse PAS** les segments et n'aligne PAS sur les axes : le
  dessin est déjà exact. La règle « alignement orthogonal » du mode croquis
  **ne s'applique PAS ici** — l'appliquer casserait les **pentes volontaires** du
  document (ex. une « Pente 1% », un fil d'eau, un dévers de relevé), qui doivent
  rester obliques. Ce qui est oblique reste oblique, ce qui est orthogonal reste
  orthogonal.
- **Vectorise UNIQUEMENT le dessin** : la sortie ne doit contenir que les
  annotations reproduisant la **coupe / le détail dessiné**. **N'émets AUCUNE
  annotation** pour les tableaux de légende (`REP. | DESIGNATION | REFERENCE`),
  le cartouche, ni les bulles de repère (`1, 2, 3…`, `A, B, C…`) et leurs lignes
  de rappel. Ce ne sont pas des éléments à reproduire.
- **Légende = aide au nommage seulement (optionnel)** : tu peux lire les bulles
  de repère et le tableau pour donner un `label` parlant à chaque
  `annotationTemplate` (par ex. « Isolant Thermique Verre Cellulaire ép. 170 mm »,
  « Pare-vapeur… », « Mur béton existant »), mais ne te complique pas la vie : si
  le rapprochement n'est pas évident, nomme le template par son matériau /
  apparence. Le tableau lui-même n'apparaît jamais en annotation.
- **Cartouche** : sert uniquement à lire l'échelle / les métadonnées, jamais à
  produire de la géométrie.
- **Échelle** : lis l'échelle dans le cartouche (`ECHELLE`, ex. `1/5`) et/ou les
  lignes de cote pour renseigner `image.widthMeters`. **Attention** : sur ces
  coupes, l'épaisseur dessinée des couches est souvent **volontairement
  surdimensionnée** (une note du type « la représentation des couches
  d'étanchéité est surdimensionnée » le signale). N'en déduis donc **jamais**
  l'échelle à partir de l'épaisseur d'une couche : sers-toi des cotes réelles ou
  de l'échelle annoncée.
- **Épaisseurs réelles des STRIP** : quand la légende donne une épaisseur réelle
  (`ép. 170 mm`, `ép. 25 mm`…), règle `strokeWidth` à cette **valeur réelle**
  (avec `strokeWidthUnit:"MM"` ou `"CM"`), et **non** à l'épaisseur dessinée.
  Quand aucune épaisseur n'est donnée, choisis une valeur plausible et faible.
- **Couches → STRIP** : représente en **STRIP** chaque couche du complexe
  (support béton, pare-vapeur, isolant, étanchéité, asphalte, drainante,
  filtrante, relevé…), bande suivant sa ligne directrice ; couleur via
  `strokeColor`. Scinde les coins orthogonaux (passage partie courante → relevé)
  en STRIP distincts à 2 points, et fusionne les segments alignés (cf. règle
  STRIP du mode croquis). Ne garde le POLYGON que pour une zone franchement
  surfacique (ex. masse béton existante hachurée).
- **Plusieurs détails par planche** : s'il y a plusieurs coupes/détails sur la
  feuille, vectorise-les tous, en réutilisant les templates partagés.

Procède ensuite exactement comme le prompt principal (mêmes coordonnées
normalisées `[0..1]`, même gestion des courbes en triplet S-C-S, même schéma de
sortie, **JSON inline en texte brut uniquement**).
