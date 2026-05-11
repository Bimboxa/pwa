#!/usr/bin/env bash
set -euo pipefail

main_root=$(git worktree list --porcelain | awk '/^worktree/ {print $2; exit}')
current=$(git rev-parse --show-toplevel)

if [ "$main_root" = "$current" ]; then
  echo "Already in the main worktree — nothing to link."
  exit 0
fi

linked=0

link_one() {
  local rel="$1"
  local src="$main_root/$rel"
  local dest="$current/$rel"
  [ ! -e "$src" ] && return 0
  [ -e "$dest" ] || [ -L "$dest" ] && return 0
  mkdir -p "$(dirname "$dest")"
  ln -s "$src" "$dest"
  echo "Linked $rel"
  linked=$((linked + 1))
}

# Explicit top-level files
for rel in .env .env.local; do
  link_one "$rel"
done

# All gitignored files inside data-bearing directories of the main worktree.
# Self-updating: any new gitignored file is picked up automatically.
GIT_IGNORE_SCOPES=(
  "src/Data"
  "src/Features/appConfig/data"
)

while IFS= read -r rel; do
  [ -z "$rel" ] && continue
  link_one "$rel"
done < <(
  cd "$main_root"
  git ls-files --others --ignored --exclude-standard -- "${GIT_IGNORE_SCOPES[@]}" 2>/dev/null || true
)

if [ "$linked" = 0 ]; then
  echo "Nothing to link (already present, or no source files in main)."
else
  echo "Linked $linked file(s)."
fi
