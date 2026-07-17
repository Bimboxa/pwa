# API PovPreviews — partage des vignettes de points de vue (POV)

Spécification backend pour le partage des images de prévisualisation des points de vue ("POV", module POINT DE VUE de la PWA), et pour l'exposition de ces vignettes dans les endpoints de récupération des scopeConfigurations.

Statut : **proposition frontend** — les noms de routes suivent les conventions existantes de `/api/ScopesConfigurations/...` et peuvent être ajustés d'un commun accord.

---

## 1. Contexte et objectif

Dans la PWA, un utilisateur peut créer des **points de vue (POV)** dans un scope ("Krto") : chaque POV est une vue cadrée du plan 2D ou de la scène 3D, avec une image de prévisualisation générée côté client.

Objectif de cette API :

1. Permettre à l'utilisateur de **partager** l'image d'un POV vers le backend (bouton "share" sur la vignette). Un ré-appui **met à jour** le partage (upsert).
2. Permettre de **supprimer** un partage (menu "..." du panneau de propriétés du POV).
3. **Exposer les vignettes partagées** dans les réponses des endpoints de récupération des scopeConfigurations, via un nouveau champ `povPreviews`. Ces vignettes seront affichées dans le dashboard (miniatures sur les items projet, panneau agrandi au survol).

Caractéristiques de l'image envoyée :

- Format **PNG**, taille ≤ **200 Ko** en pratique (générée et compressée côté client).
- Ratio d'aspect variable (dépend du cadrage choisi par l'utilisateur).

---

## 2. Modèle de données `PovPreview`

Un enregistrement par POV partagé.

| Champ backend | Type | Description |
|---|---|---|
| `id` | string/uuid | Identifiant maître généré par le backend. Renvoyé au frontend comme `povId`, stocké côté client dans `pov.idMaster`. |
| `povId` | string | Identifiant client du POV (nanoid, unique globalement). **Clé d'upsert** : un second Push avec le même `povId` remplace l'enregistrement. |
| `scopeId` | string | Identifiant du scope (Krto) auquel le POV appartient — même valeur que le `scopeId` des ScopesConfigurations. |
| `projectObjectId` | string | Identifiant maître du projet (`project.idMaster`), même convention que le champ `projectObjectId` de `ScopesConfigurations/Push`. |
| `povIndex` | string | **Index fractionnaire** (fractional index, ex. `"a0"`, `"a0V"`, `"a1"`). Chaîne opaque à stocker **telle quelle** : l'ordre d'affichage des POV est l'ordre lexicographique de ce champ. Ne pas parser, ne pas convertir en nombre. |
| `description` | string | Description libre du POV, saisie par l'utilisateur. Optionnelle — peut être absente ou vide (`""`). |
| image | binaire | Le fichier PNG reçu, stocké par le backend, servi via `povImageUrl`. |
| `povImageUrl` | string (URL) | URL de l'image stockée, renvoyée dans les réponses (voir §6 pour les contraintes d'hébergement). |
| `createdById` | string | Auteur du partage (`userProfile.idMaster`), même convention que le champ `createdById` de `ScopesConfigurations/Push`. |
| `createdAt` / `updatedAt` | datetime | Horodatage géré par le backend. |

---

## 3. `POST /api/PovPreviews/Push` — créer / mettre à jour un partage

- **Méthode** : `POST`
- **Content-Type** : `multipart/form-data` (même pattern que `ScopesConfigurations/Push`)
- **Auth** : `Authorization: Bearer <jwt>`
- **Comportement** : **upsert** keyé sur `povId` — crée l'enregistrement s'il n'existe pas, sinon remplace l'image et les métadonnées (`povIndex`, `description`).
  - Lors d'une **mise à jour** (le `povId` existe déjà), le champ `file` est **optionnel** : s'il est absent, l'image existante est conservée et seules les métadonnées sont mises à jour (ex. changement de description ou réordonnancement).
  - Lors d'une **création** (le `povId` est inconnu), `file` est obligatoire → `400 Bad Request` s'il manque.

### Champs du formulaire

| Champ | Valeur côté frontend | Obligatoire |
|---|---|---|
| `povId` | `pov.id` (nanoid client) | oui |
| `scopeId` | `scope.id` | oui |
| `projectObjectId` | `project.idMaster` | oui |
| `povIndex` | `pov.sortIndex` (chaîne, index fractionnaire) | oui |
| `description` | `pov.description` | non (absente ou vide si le POV n'a pas de description) |
| `createdById` | `userProfile.idMaster` | oui |
| `file` | l'image PNG de prévisualisation (File) | oui à la création ; non lors d'une mise à jour (image existante conservée) |

### Exemple de requête

```bash
curl -X POST https://<host>/api/PovPreviews/Push \
  -H "Authorization: Bearer <jwt>" \
  -F "povId=Vq8kM2xPz4LhN0aB1cD5e" \
  -F "scopeId=kRt0aB1cD5eVq8kM2xPz4" \
  -F "projectObjectId=8f14e45f-ceea-467f-9b17-b6c1c1e4a7d2" \
  -F "povIndex=a0" \
  -F "description=Vue d'ensemble toiture terrasse" \
  -F "createdById=3c9909af-9d1a-4f8c-9c1e-2b7e6a1f0d44" \
  -F "file=@pov_preview.png;type=image/png"
```

### Réponse — `200 OK`

```json
{
  "povId": "b7e23ec2-9c47-4e6a-8f5d-1a2b3c4d5e6f",
  "povImageUrl": "https://<host>/api/PovPreviews/Image/b7e23ec2-9c47-4e6a-8f5d-1a2b3c4d5e6f?v=2",
  "scopeId": "kRt0aB1cD5eVq8kM2xPz4",
  "povIndex": "a0",
  "povDescription": "Vue d'ensemble toiture terrasse",
  "updatedAt": "2026-07-17T09:41:00Z"
}
```

> **Important — mapping côté frontend** : le `povId` de la **réponse** est l'identifiant maître backend (`id` de la table), mappé vers `pov.idMaster` côté client (même convention que `id → idMaster` dans le mapping des ScopesConfigurations). `povImageUrl` est mappé vers `pov.imageUrlMaster`. Seuls `povId` et `povImageUrl` sont indispensables dans la réponse.

---

## 4. `POST /api/PovPreviews/Remove` — supprimer un partage

- **Méthode** : `POST` (JSON), même pattern que `ScopesFavorites/Remove`
- **Auth** : `Authorization: Bearer <jwt>`
- **Comportement** : supprime l'enregistrement **et** l'image stockée. **Idempotent** : renvoyer `200`/`204` même si le `povId` est inconnu ou déjà supprimé.

### Corps de la requête

```json
{
  "povId": "Vq8kM2xPz4LhN0aB1cD5e"
}
```

> Le frontend envoie le **`povId` client** (le même que celui envoyé dans Push), pas l'identifiant maître. Si c'est plus simple côté backend, l'endpoint peut accepter indifféremment l'un ou l'autre.

### Réponse

`204 No Content` (ou `200 OK` avec corps vide).

---

## 5. Mise à jour des endpoints de récupération des scopeConfigurations

Chaque **item** des réponses des endpoints de liste suivants doit gagner un champ `povPreviews` :

| Endpoint | Méthode |
|---|---|
| `/api/ScopesConfigurations/SearchAndFilters` | POST |
| `/api/ScopesConfigurations/ByUser/{userIdMaster}` | GET |
| `/api/ScopesConfigurations/ByProject/{projectIdMaster}` | GET |
| `/api/ScopesConfigurations/ScopesByDay/{date}` | GET |

### Forme du champ

```json
{
  "scopeId": "kRt0aB1cD5eVq8kM2xPz4",
  "scopeName": "Étanchéité toiture bâtiment A",
  "projectNum": "P2026-0143",
  "...": "champs existants inchangés",
  "povPreviews": [
    {
      "povId": "b7e23ec2-9c47-4e6a-8f5d-1a2b3c4d5e6f",
      "povIndex": "a0",
      "povImageUrl": "https://<host>/api/PovPreviews/Image/b7e23ec2-9c47-4e6a-8f5d-1a2b3c4d5e6f?v=2",
      "povDescription": "Vue d'ensemble toiture terrasse"
    },
    {
      "povId": "c8f34fd3-0d58-4f7b-9e6e-2b3c4d5e6f70",
      "povIndex": "a1",
      "povImageUrl": "https://<host>/api/PovPreviews/Image/c8f34fd3-0d58-4f7b-9e6e-2b3c4d5e6f70?v=1",
      "povDescription": "Détail relevé d'étanchéité acrotère"
    }
  ]
}
```

Règles :

- Les `povPreviews` sont rattachés **au scope** (`scopeId`) : tous les items qui référencent un même scope portent le même tableau.
- Renvoyer un **tableau vide `[]`** (pas `null`, pas de champ absent) quand le scope n'a aucun POV partagé.
- Le tri n'est pas requis côté backend : le frontend trie par ordre lexicographique de `povIndex`. (Le renvoyer trié est un plus, pas une obligation.)
- `povId` = identifiant **maître** backend (le même que celui renvoyé par Push).

### Mapping côté frontend (pour information)

| Champ réponse | Champ client |
|---|---|
| `povId` | `pov.idMaster` |
| `povIndex` | `pov.sortIndex` |
| `povImageUrl` | `pov.imageUrlMaster` |
| `povDescription` | `pov.description` |

---

## 6. Auth et hébergement des images

- Tous les endpoints sont protégés par `Authorization: Bearer <jwt>`, comme les routes `ScopesConfigurations` existantes.
- `povImageUrl` doit être **récupérable par la PWA** : soit une URL publique, soit — **recommandé** — une URL servie derrière le même Bearer (le frontend fera un `fetch` avec le header `Authorization`).
- L'URL doit permettre l'invalidation de cache après un re-Push : soit une URL qui change à chaque mise à jour, soit un paramètre de version (`?v=N` dans les exemples ci-dessus), soit des en-têtes de cache appropriés. Sans cela, le dashboard continuera d'afficher l'ancienne image après une mise à jour du partage.

---

## 7. Cas d'erreur et règles diverses

| Cas | Comportement attendu |
|---|---|
| Requête sans token / token invalide | `401 Unauthorized` |
| `Remove` d'un `povId` inconnu | `200`/`204` (idempotent) |
| `Push` sans champ obligatoire (`povId`, `scopeId`, `projectObjectId`, `povIndex`, `createdById` — et `file` si création) | `400 Bad Request` avec message explicite |
| Fichier trop volumineux | Accepter jusqu'à **1 Mo** (marge de sécurité ; ≤ 200 Ko en pratique) ; `413` au-delà |
| Fichier non-PNG | Accepter au minimum `image/png` ; `415` sinon (ou accepter `image/jpeg`/`image/webp` si simple à faire) |
| Re-Push avec image identique | Mettre quand même à jour `povIndex` et `description` (l'utilisateur peut avoir réordonné ou renommé le POV) |
| Suppression d'un scope | Libre au backend de supprimer en cascade les `PovPreviews` associés (recommandé) |
