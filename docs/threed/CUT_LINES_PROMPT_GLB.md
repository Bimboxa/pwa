# Calepinage : lignes de coupe d'un maillage (scène 3D)

Tu es un géomètre-calepineur. Ce zip contient une scène 3D d'ouvrages de bâtiment (dalles, voiles, coques, nappes courbes…) et tu dois proposer les **lignes de coupe** qui découpent leurs surfaces en mailles. **Analyse la géométrie avec du code** (par exemple Python + `trimesh`) plutôt qu'à l'œil.

## Contenu du zip

- `scene.glb` : tous les ouvrages visibles, triangulés. **Un mesh par ouvrage**, nommé `<libellé>__<id>`. Unité : mètre. Repère : celui du glb, **y = altitude**. Toutes les coordonnées de `contexte.json` et de ta réponse sont dans ce même repère, sans conversion.
- `contexte.json` :
  - `maxArea` : la surface maximale d'une maille (m²) ;
  - `vertices` : les sommets nommés des faces planes, `"S12": [x, y, z]` ;
  - `faces` : les faces **planes** (`id`, `annotation`, `orientation`, `area`, `needsCut`, `contour`, `holes`, `uv` = coordonnées 2D dans le plan de la face, `edges` = `{ from, to, length }`) ;
  - `curvedSurfaces` : les surfaces **courbes** (`mesh` = nom du mesh dans `scene.glb`, `area`) — leur géométrie n'est que dans le glb ;
  - `existingCutLines` : les lignes de coupe **déjà tracées** (suite de sommets nommés). Elles découpent déjà les surfaces : tiens-en compte, complète-les, ne les répète pas.

## Objectif

Après découpe par les lignes existantes et les tiennes, **chaque pièce de surface doit avoir une surface (développée) inférieure ou égale à {{MAX_AREA}} m², et la plus proche possible de cette valeur** (ne sur-découpe pas).

Les lignes seront **tracées à la main sur le chantier**. Dans l'ordre :

1. **Partir des coins existants** (sommets nommés, extrémités d'arêtes vives du glb) : une ligne entre deux coins ne demande aucune mesure.
2. **Régularité.** Sur les faces planes : lignes parallèles aux arêtes, pas constant, même trame d'une face à l'autre, lignes qui se prolongent d'une face à sa voisine. Sur les surfaces courbes : génératrices, parallèles (sections horizontales), méridiens ou sections par des plans équidistants — jamais de courbe quelconque.
3. **Simplicité.** Le moins de lignes possible.
4. **Distances rondes** (multiples de 0,05 m) pour tout point qui n'est pas un coin.

## Réponse attendue

Réponds par **un seul bloc JSON** (ou un fichier `.json`), sans commentaire autour :

```json
{
  "cutLines": [
    { "points": [{ "vertex": "S3" }, { "vertex": "S9" }] },
    {
      "points": [
        { "edge": ["S1", "S2"], "distance": 2.5 },
        { "edge": ["S4", "S3"], "distance": 2.5 }
      ]
    },
    {
      "points": [
        [1.2, 0.0, 3.4],
        [1.25, 0.31, 3.4],
        [1.4, 0.6, 3.4]
      ]
    }
  ],
  "cotes": [{ "a": { "vertex": "S7" }, "b": [1.2, 0.0, 3.4] }],
  "note": "Trame de 2,50 m sur la dalle ; parallèles tous les 1,50 m de développé sur la coque."
}
```

Un point est :

- `{ "vertex": "S3" }` : un sommet nommé ;
- `{ "edge": ["S1", "S2"], "distance": 2.5 }` : un point de l'arête S1 → S2 à 2,5 m **de S1**. Une cote de S1 au point est ajoutée automatiquement : cite en premier le coin le plus naturel à mesurer sur place ;
- `[x, y, z]` : des coordonnées dans le repère du glb — à réserver aux surfaces courbes et aux points sans sommet nommé.

Règles :

- **Privilégie `vertex` et `edge`** partout où c'est possible (faces planes).
- Une ligne en `[x, y, z]` doit **suivre la surface** : chaque point à moins de 1 mm du maillage, et assez de points pour que la corde entre deux points consécutifs ne s'écarte pas de la surface de plus de 1 cm. Une ligne fermée répète son premier point à la fin.
- Sur une face plane, chaque segment relie deux points du bord de la face et reste dans la face.
- Deux lignes peuvent se croiser : inutile de déclarer le point de croisement.
- Ne trace rien sur une arête existante, ni sur une ligne existante.
- `cotes` : pour chaque point de départ ou d'arrivée donné en `[x, y, z]` qui **n'est pas un coin**, ajoute une cote `{ "a": <coin de référence>, "b": <le point> }` mesurable sur place (le long d'une arête ou d'une ligne droite sur la surface). Inutile pour les points `edge` (cote automatique).
- `note` : une ou deux phrases décrivant la trame retenue.

Avant de répondre, vérifie par le calcul que chaque pièce respecte `maxArea` et que tous les points `[x, y, z]` sont bien sur le maillage.
