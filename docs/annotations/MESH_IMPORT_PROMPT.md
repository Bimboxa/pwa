# Mailler des annotations existantes — prompt IA générative

> Note : exceptionnellement, ce document est rédigé en français (à la demande),
> mais tout ce qui relève du modèle de données reste en anglais (types, clés
> JSON, schéma).

Ce prompt transforme un **export d'annotations sélectionnées** (bouton Debug 🐞
en haut de la toolbar d'édition d'annotations) en le « JSON inline » de type
**MESH** consommé par le panneau **Import annotations** : l'import crée les
**mailles** (annotations `isMeshCell`, libellées M1, M2, …) des annotations
existantes référencées, exactement comme l'éditeur de maillage de l'application.

Utilisation :

1. Sélectionner les annotations à mailler sur le plan, cliquer le bouton Debug
   de la toolbar → l'export `{ imageSize, meterByPx, annotations }` est copié.
2. Coller le prompt ci-dessous dans un modèle IA (le bouton « Copier le prompt »
   du panneau d'import copie ce prompt), puis coller l'export à la suite.
3. Répondre à la question de l'IA sur la **surface maximale par maille**.
4. Coller le JSON renvoyé dans le champ texte du panneau d'import → « Créer le
   maillage ».

Le format est volontairement aligné sur ce que l'application persiste sur
l'annotation parente (`meshLines` / `meshLinesBySegment`) : le maillage importé
reste **rééditable** dans l'éditeur de maillage, et un ré-import **remplace** le
maillage existant des annotations ciblées.

---

## Prompt

> Tu es un moteur de maillage pour une application de cartographie technique.
> On te fournit un export JSON `{ imageSize, meterByPx, annotations }` :
>
> - `imageSize` : dimensions **en pixels** du fond de plan (`width`, `height`) ;
> - `meterByPx` : échelle du plan, en **mètres par pixel** ;
> - `annotations` : les annotations à mailler. Leurs `points` sont en **pixels**
>   (origine en haut à gauche, `x`→droite, `y`→bas). Les POLYLINE portent aussi
>   `height` (hauteur du mur en mètres) et éventuellement `offsetZ`.
>
> **ÉTAPE 0 — demander d'abord.** Avant de produire quoi que ce soit, pose à
> l'utilisateur une seule question : *« Quelle surface maximale visez-vous pour
> chaque maille, en m² ? (par exemple 2.5) »*. Attends la réponse, puis génère
> le maillage en conséquence.
>
> **Objectif.** Découper chaque annotation en mailles :
>
> - les plus **régulières** possible (proches du carré, de surfaces homogènes) ;
> - chacune de surface **≤ la valeur maximale** donnée par l'utilisateur ;
> - en prenant **le plus possible les sommets (vertex) de l'annotation comme
>   coins de mailles** : fais passer les lignes de coupe par les sommets du
>   contour chaque fois que c'est possible, plutôt qu'à des positions
>   arbitraires.
>
> **Modèle de découpe : la guillotine.** Tu ne décris pas les mailles, mais des
> **lignes de coupe**. Chaque ligne découpe **toutes les cellules qu'elle
> traverse entièrement** (en commençant par le contour complet). Les lignes
> sont appliquées dans l'ordre. Conséquences :
>
> - privilégie des lignes **VERTICAL** / **HORIZONTAL** traversant toute la
>   forme (une grille régulière est le cas idéal) ;
> - utilise **FREE** (2 points quelconques) pour suivre une géométrie inclinée,
>   par exemple une ligne passant par deux sommets non alignés sur les axes ;
> - inutile de prolonger les extrémités : chaque ligne est étendue à l'infini
>   par le moteur au moment de la découpe ;
> - une ligne qui ne traverse pas entièrement une cellule la laisse intacte.
>
> **Annotations POLYGON (vue en plan).**
>
> - Travaille en pixels (surface réelle d'un rectangle de découpe :
>   `largeur_px × hauteur_px × meterByPx²` en m²), puis **normalise** les
>   coordonnées de sortie dans `[0..1]` : `x_px / imageSize.width`,
>   `y_px / imageSize.height`.
> - Choisis des pas de grille réguliers tels que chaque maille reste ≤ la
>   surface maximale, en alignant les lignes sur les sommets du polygone quand
>   ils s'y prêtent (sommets quasi alignés verticalement / horizontalement).
> - Format d'une ligne : `{ "orientation": "VERTICAL|HORIZONTAL|FREE",
>   "p1": { "x": 0..1, "y": 0..1 }, "p2": { ... } }`.
>
> **Annotations POLYLINE (élévation développée, par segment).**
>
> - Chaque segment `i` (entre `points[i]` et `points[i+1]` ; si
>   `closeLine: true`, le segment de fermeture `n-1` relie le dernier point au
>   premier) est un mur développé en rectangle :
>   - longueur = `distance(points[i], points[i+1]) × meterByPx` (mètres) ;
>   - hauteur = `height` de l'annotation (mètres).
> - Les lignes de coupe d'un segment s'expriment en `{ u, z }` :
>   - `u` ∈ `[0..1]` : position le long du segment, `0` = `points[i]`,
>     `1` = `points[i+1]` ;
>   - `z` ≥ 0 : altitude en **mètres**, `0` = bas du mur, `height` = haut.
> - Génère des lignes **VERTICAL** à pas régulier en `u` et **HORIZONTAL** à pas
>   régulier en `z`, choisis pour des mailles les plus carrées possible avec
>   `(longueur/N_u) × (hauteur/N_z) ≤ surface maximale`. Si la hauteur seule est
>   déjà ≤ à un côté raisonnable, des coupes verticales seules suffisent.
> - Maille **tous les segments** de chaque POLYLINE, sauf indication contraire
>   de l'utilisateur. La clé de `meshLinesBySegment` est l'index du segment **en
>   chaîne de caractères** (`"0"`, `"1"`, …).
>
> **Sortie.** Une fois la surface maximale connue, **ne renvoie QUE un JSON
> inline (du texte brut)** — un seul bloc de texte JSON, directement collable,
> sans commentaire, sans texte autour, sans clôture de code markdown (pas de
> ```), au schéma strict suivant :
>
> {
>   "version": "1.0",
>   "kind": "MESH",
>   "meshes": [
>     {
>       "annotationId": "<id exact de l'annotation source>",
>       "mode": "POLYGON",
>       "meshLines": [
>         { "orientation": "VERTICAL", "p1": { "x": 0.25, "y": 0.10 }, "p2": { "x": 0.25, "y": 0.60 } },
>         { "orientation": "HORIZONTAL", "p1": { "x": 0.10, "y": 0.35 }, "p2": { "x": 0.40, "y": 0.35 } },
>         { "orientation": "FREE", "p1": { "x": 0.12, "y": 0.14 }, "p2": { "x": 0.38, "y": 0.52 } }
>       ]
>     },
>     {
>       "annotationId": "<id exact de l'annotation source>",
>       "mode": "POLYLINE",
>       "meshLinesBySegment": {
>         "0": [
>           { "orientation": "VERTICAL", "p1": { "u": 0.5, "z": 0 }, "p2": { "u": 0.5, "z": 2.7 } },
>           { "orientation": "HORIZONTAL", "p1": { "u": 0, "z": 1.35 }, "p2": { "u": 1, "z": 1.35 } }
>         ],
>         "1": [
>           { "orientation": "VERTICAL", "p1": { "u": 0.33, "z": 0 }, "p2": { "u": 0.33, "z": 2.7 } },
>           { "orientation": "VERTICAL", "p1": { "u": 0.66, "z": 0 }, "p2": { "u": 0.66, "z": 2.7 } }
>         ]
>       }
>     }
>   ]
> }
>
> **Règles de validation strictes** :
>
> - `annotationId` : reprendre **l'`id` exact** de l'annotation de l'export
>   (champ `id`), jamais inventé ;
> - `mode` : `"POLYGON"` ou `"POLYLINE"`, égal au `type` de l'annotation —
>   ignore (sans erreur) les annotations d'un autre type (COTE, STRIP…) ;
> - une seule entrée par `annotationId` ;
> - POLYGON : coordonnées dans `[0..1]` ; POLYLINE : `u` dans `[0..1]`, `z` ≥ 0
>   en mètres ;
> - `p1` ≠ `p2` pour chaque ligne ;
> - **jamais de tableau de lignes vide** : si un segment n'a pas besoin de
>   coupe, **omets sa clé** de `meshLinesBySegment` (n'écris pas `"3": []`) ;
>   si une annotation n'a aucune ligne de coupe du tout, **omets l'entrée**
>   entière du tableau `meshes`.
