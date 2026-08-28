# ScopesConfigurations — content stats dans le champ `metaData`

Le frontend envoie au `Push` des statistiques de contenu du scope dans le champ **`metaData` existant** des `ScopesConfigurations`, affichées en badges sur les lignes de scopes du dashboard (scopes d'un projet, scopes du jour).

Statut : **frontend prêt** — le frontend envoie déjà `metaData` au Push et masque les badges tant que les listes ne le retournent pas.

## 1. `POST /api/ScopesConfigurations/Push`

Une entrée supplémentaire dans le `FormData` existant, chaîne JSON :

```
metaData: {"annotationsCount":142,"baseMapsCount":6}
```

| Clé | Type | Rôle |
|---|---|---|
| `annotationsCount` | int | Nombre d'annotations non supprimées "visibles" du scope au moment du Push (pseudo-annotations techniques exclues côté front). |
| `baseMapsCount` | int | Nombre de fonds de plan non supprimés du scope au moment du Push (fonds de détail générés à la volée exclus). |

Le champ est **optionnel** : un Push sans `metaData` (ancien client, échec du calcul) reste valide. Le contenu est opaque pour le backend (stocké/retourné tel quel) — d'autres clés pourront s'y ajouter.

## 2. Endpoints de lecture — écho du champ

Retourner `metaData` (string, nullable) sur chaque item de :

- `GET /api/ScopesConfigurations/{scopeId}` (pull dernière version)
- `GET /api/ScopesConfigurations/ByProject/{projectObjectId}`
- `GET /api/ScopesConfigurations/ByUser/{userId}`
- `GET /api/ScopesConfigurations/AllVersions/{scopeId}`
- `POST /api/ScopesConfigurations/SearchAndFilters`
- `GET /api/ScopesConfigurations/ScopesByDay/{date}` (metaData de la dernière configuration du scope ce jour-là)

Côté front, le mapping est déclaré dans `appConfig_edx.yaml` (`features.remoteScopeConfigurations.mapping` et `features.dailyScopes.mapping`) et le parsing (JSON string ou objet, tolérant) est centralisé dans `getScopeConfigMetaData`.
