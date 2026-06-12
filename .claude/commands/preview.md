---
description: Configure le worktree (.env + symlinks src/Data + vite.config) puis (re)démarre le preview Vite
---

Contexte : on est dans un worktree parallèle de `/Users/FVA/Projets/Bimboxa/pwa`. Les fichiers gitignorés (`.env`, `src/Data/`, certains YAML dans `src/Features/appConfig/data/`) ne sont pas dans ce worktree, donc l'app charge la mauvaise `appConfig` (default au lieu d'edx) et affiche `"undefined v…"` en bas à gauche. Le fix est sur `main` (script `link-worktree-env.sh` + `vite.config.js` qui étend `server.fs.allow`), mais il n'est pas encore sur la branche courante.

Effectue ces étapes dans l'ordre, sans rien commiter sur la branche courante :

1. **Copie `vite.config.js` depuis main** (s'il n'est pas déjà identique) :
   ```
   cp /Users/FVA/Projets/Bimboxa/pwa/vite.config.js ./vite.config.js
   ```

2. **Lance le script de symlinks** depuis main (pas besoin de le copier) :
   ```
   bash /Users/FVA/Projets/Bimboxa/pwa/scripts/link-worktree-env.sh
   ```

3. **(Re)démarre le preview** via les outils `preview_*`. Vite lit `.env` et glob les YAML au démarrage, donc HMR ne suffit pas :
   - Si un preview est déjà actif (`preview_list`), appelle `preview_stop` puis `preview_start` avec `name: "dev"`.
   - Sinon, appelle directement `preview_start` avec `name: "dev"`.

4. **Vérifie** via `preview_logs` (level=error) qu'il n'y a plus d'erreur `Failed to resolve import` et que Vite affiche `ready`. Si une erreur d'import persiste, signale-la avec le chemin de fichier exact.

⚠️ Ne commit PAS `vite.config.js` sur cette branche — il est déjà sur `main` et le merge le gérera proprement quand la branche sera mergée.
