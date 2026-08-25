# API ScopesConfigurations/Relink — ré-association en masse des configs d'un projet

Spécification backend pour la mise à jour **en masse** des champs projet dénormalisés portés par les `ScopesConfigurations`, lorsqu'un projet local est **relié** à une entité du référentiel (chantier / opportunité), **re-relié** à une autre entité, ou **détaché** (retour à l'état "projet libre").

Statut : **proposition frontend** — le nom de route suit les conventions existantes de `/api/ScopesConfigurations/...` et peut être ajusté d'un commun accord. Le frontend est déjà câblé (route configurable dans `appConfig_edx.yaml`, `features.remoteScopeConfigurations.relink`) et dégrade silencieusement tant que l'endpoint n'existe pas.

---

## 1. Contexte et objectif

Chaque `ScopesConfiguration` porte des champs projet **dénormalisés, figés au Push** : `projectObjectId`, `projectNum`, `projectType`, `projectName`. Quand l'utilisateur relie / change / détache le référentiel d'un projet depuis le dashboard (issue #309), ces copies deviennent obsolètes sur **toutes** les configs du projet (tous scopes, toutes versions).

Objectif : **un seul appel** qui met à jour ces métadonnées sur toutes les configs concernées — sans ré-upload de zip, y compris pour les Krtos non installés sur l'appareil.

Les configs d'un projet sont identifiées par **`projectIdClient`** (id client nanoid du projet, envoyé sur `ScopesConfigurations/Push`) : identifiant **immuable** — il survit à un changement de nom / numéro / référence backend — et présent même pour les projets libres (sans `projectObjectId`).

## 2. `POST /api/ScopesConfigurations/Relink`

- **Méthode** : `POST`
- **Content-Type** : `application/json`
- **Auth** : `Authorization: Bearer <jwt>`

### Corps de la requête

```json
{
  "projectIdClient": "nanoid_abc123",

  "newProjectObjectId": 777,
  "newProjectNum": "OPP-777",
  "newProjectType": "OPPORTUNITE",
  "newProjectName": "Nouvelle oppo"
}
```

| Champ | Type | Rôle | Obligatoire |
|---|---|---|---|
| `projectIdClient` | string | **Sélecteur** : id client (nanoid) du projet dont les configs doivent être mises à jour. | oui |
| `newProjectObjectId` | int | Nouvelle valeur de `projectObjectId`. `0` = effacer (détach). | non → inchangé si absent |
| `newProjectNum` | string | Nouvelle valeur de `projectNum`. | non → inchangé si absent |
| `newProjectType` | string | Nouvelle valeur de `projectType` : `CHANTIER` \| `OPPORTUNITE` \| `PROJECT`. | non → inchangé si absent |
| `newProjectName` | string | Nouvelle valeur de `projectName`. | non → inchangé si absent |

> Le frontend envoie aujourd'hui systématiquement les 4 champs `new*`, mais le contrat les traite comme **optionnels** ("absent = non modifié") pour rester un endpoint de mise à jour en masse générique.

### Comportement attendu

1. **Sélection** : toutes les lignes `ScopesConfigurations` où `projectIdClient == body.projectIdClient`, **toutes versions confondues** (pas seulement la dernière version de chaque scope — sinon un pull d'une version antérieure resterait rattaché à l'ancien projet). Les configs sans `projectIdClient` (antérieures à son introduction) ne sont **pas** concernées.
2. **Mise à jour** : chaque champ `new*` présent dans le corps est écrit sur toutes les lignes sélectionnées. `newProjectObjectId = 0` → vider la référence (NULL ou 0 selon le schéma).
3. L'appel est **idempotent** : le rejouer avec le même corps ne change rien de plus.

### Réponse

`200 OK` avec, idéalement :

```json
{ "updatedCount": 12 }
```

Le frontend ne dépend pas du shape (il logge la réponse) — tout JSON convient. `4xx/5xx` → le frontend affiche une erreur générique et laisse la mise à jour **locale** du projet en place (l'appel pourra être rejoué).

## 3. Les 3 cas d'usage (valeurs réelles envoyées)

**Relier un projet libre à un chantier :**
```json
{ "projectIdClient": "nanoid_abc123",
  "newProjectObjectId": 45899, "newProjectNum": "2.45899",
  "newProjectType": "CHANTIER", "newProjectName": "GLV - TT ATELIER" }
```

**Changer de référentiel (chantier → opportunité) :**
```json
{ "projectIdClient": "nanoid_abc123",
  "newProjectObjectId": 777, "newProjectNum": "OPP-777",
  "newProjectType": "OPPORTUNITE", "newProjectName": "Nouvelle oppo" }
```

**Détacher (retour projet libre — nom et numéro conservés) :**
```json
{ "projectIdClient": "nanoid_abc123",
  "newProjectObjectId": 0, "newProjectNum": "2.45899",
  "newProjectType": "PROJECT", "newProjectName": "GLV - TT ATELIER" }
```

## 4. Côté frontend (référence)

- Hook d'appel : `src/Features/remoteScopeConfigurations/hooks/useRelinkProjectScopeConfigurations.js` (config-driven, no-op si la route `relink` est absente de l'appConfig).
- Orchestrateur : `src/Features/projects/hooks/useLinkProjectToReferentiel.js` (met à jour le projet Dexie local puis appelle Relink).
- Route et corps configurés dans `appConfig_edx.yaml` → `features.remoteScopeConfigurations.relink` (l'ObjectId y est typé `fieldType: int`).
- Côté lecture, le frontend rattache déjà les configs aux projets locaux par `projectIdClient` en priorité (`projectNum` en fallback) : exposer `projectIdClient` dans les réponses des endpoints de récupération (`ByProject`, `ByUser`, `SearchAndFilters`, `AllVersions`) si ce n'est pas déjà le cas.
