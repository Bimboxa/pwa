## Rôle et fichiers

Tu convertis des documents de chantier (DPGF, bordereau de prix, CCTP,
métré, liste de tâches…) en une **liste hiérarchisée d'éléments** importable
dans l'application Krto.

Le zip contient :

- `INSTRUCTIONS.md` — ce fichier ;
- `contexte.json` — nom de la liste, type d'éléments, unités autorisées,
  liste des pièces jointes, rappel du format de sortie ;
- `pieces-jointes/` — les documents déposés par l'utilisateur. Pour chaque
  classeur Excel, un export `…__<feuille>.csv` (séparateur `;`, une ligne par
  ligne de la feuille, valeurs calculées des formules) est fourni à côté du
  fichier d'origine : utilise-le si tu ne peux pas ouvrir le `.xlsx`.

Lis d'abord `contexte.json`, puis la section « Demande » en tête de ce
fichier : **l'instruction de l'utilisateur est prioritaire** sur les règles
par défaut ci-dessous.

## Règles de lecture

1. **Une ligne du document = un élément**, dans l'ordre du document.
2. **Hiérarchie** : elle suit la numérotation des articles (`4.` → `4.1.` →
   `4.1.3.`) ou, à défaut, la mise en forme (titres, retraits). Chaque
   élément référence son parent par `parentId` ; `null` pour la racine.
3. **Chapitres et sous-chapitres** (lignes qui regroupent d'autres lignes) :
   `isTitle: true`, sans unité ni quantité.
4. **Articles** (lignes feuilles) : `isTitle: false`. Un article chiffré porte
   son unité et sa quantité ; un article purement descriptif (sans unité ni
   quantité) est conservé avec `unit: null`.
5. **À ignorer** : en-têtes de colonnes, lignes vides, sous-totaux, totaux,
   TVA, récapitulatifs, cartouches, mentions de signature.
6. **Prix** : les prix unitaires et les montants ne sont pas importés.
7. **Libellés** : recopie la désignation telle quelle (accents, casse,
   dimensions), sans le numéro d'article, sans la résumer ni la traduire.
   Supprime seulement les espaces et retours à la ligne superflus.
8. **Numéros d'article** : recopie-les dans `code`, tels qu'écrits. Un numéro
   dupliqué ou incohérent dans le document n'est pas corrigé : la position de
   la ligne dans le document fait foi pour la hiérarchie.
9. **N'invente rien** : ni ligne, ni quantité, ni unité. Une valeur absente
   reste absente.
10. Plusieurs documents : n'importe que ce que demande l'utilisateur ; sans
    précision, le document de type DPGF / bordereau est la source, les autres
    servent de contexte.

## Unités

`unit` est l'unité **d'origine**, recopiée telle quelle (`"Ens."`, `"ML"`,
`"M²"`, `"kg"`, `"Ft"`…). C'est un texte libre : ne la convertis pas, ne la
traduis pas. Sans unité (titre, article descriptif) : `null`.

`refQty` est la quantité d'origine, en nombre (point décimal, sans séparateur
de milliers).

## Schéma de sortie

Un objet JSON :

```json
{
  "version": "1.0",
  "listingName": "DPGF Lot 01 - Étanchéité",
  "note": "116 lignes lues, 5 chapitres, sous-totaux ignorés.",
  "businessObjects": [
    {
      "id": "o1",
      "parentId": null,
      "code": "4.",
      "label": "Descriptifs des ouvrages – Bâtiment CETA",
      "isTitle": true
    },
    {
      "id": "o2",
      "parentId": "o1",
      "code": "4.1.",
      "label": "Travaux préparatoires",
      "isTitle": true
    },
    {
      "id": "o3",
      "parentId": "o2",
      "code": "4.1.4.",
      "label": "Dépose membrane étanchéité PVC",
      "unit": "M²",
      "refQty": 404
    }
  ]
}
```

| Clé                             | Obligatoire | Description                                                        |
| ------------------------------- | ----------- | ------------------------------------------------------------------ |
| `version`                       | oui         | `"1.0"`                                                            |
| `listingName`                   | non         | nom proposé pour la liste                                          |
| `note`                          | non         | remarque courte pour l'utilisateur (doutes, lignes écartées…)      |
| `businessObjects`               | oui         | liste **à plat**, dans l'ordre du document, parents avant enfants  |
| `businessObjects[].id`          | oui         | identifiant court, unique dans la réponse (`o1`, `o2`…)            |
| `businessObjects[].parentId`    | oui         | `id` du parent, ou `null`                                          |
| `businessObjects[].label`       | oui         | désignation                                                        |
| `businessObjects[].code`        | non         | numéro d'article                                                   |
| `businessObjects[].isTitle`     | non         | `true` pour un chapitre / sous-chapitre                            |
| `businessObjects[].unit`        | non         | unité d'origine (texte libre) ou `null`                            |
| `businessObjects[].refQty`      | non         | quantité d'origine (nombre)                                        |
| `businessObjects[].description` | non         | précision utile qui ne tient pas dans le libellé                   |

N'ajoute aucune autre clé.

## Forme de la réponse

1. Un résumé de **3 lignes au plus** (nombre de chapitres, nombre d'articles,
   points d'attention).
2. Le JSON **complet**, **sur une seule ligne**, dans un unique bloc de code
   ` ```json `. Si tu peux exécuter du code, génère-le avec
   `json.dumps(data, ensure_ascii=False, separators=(",", ":"))` et vérifie
   que chaque `parentId` correspond à un `id` présent.
3. Ne tronque jamais le JSON (`…`, « etc. », « suite identique »). S'il est
   trop long pour une seule réponse, dis-le et découpe par chapitre racine,
   un bloc de code par réponse, chacun étant un objet JSON complet et valide.
