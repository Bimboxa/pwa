import createKrtoZip from "Features/krtoFile/services/createKrtoZip";
import loadKrtoZip from "Features/krtoFile/services/loadKrtoZip";

/**
 * Duplicates a scope INTO ANOTHER project (e.g. the Krto of an opportunité
 * copied into its chantier).
 *
 * duplicateScopeService copies inside the scope's own project and shares its
 * project-level base maps; across projects the base maps must be copied too.
 * The scope goes through the Krto zip pipeline instead: export, then import
 * in duplicate mode (every id regenerated, rows re-owned to the current
 * user, no sync state) attached to the target project.
 *
 * Full copy: the dialog filters do not apply. Base map folders hidden in the
 * source scope ship without their image files, as in any Krto zip.
 *
 * Returns { newScopeId }.
 */
export default async function duplicateScopeToProjectService({
  scope,
  name,
  targetProjectId,
}) {
  if (!scope?.id || !targetProjectId) {
    throw new Error("duplicateScopeToProjectService: missing scope or target");
  }

  const zipFile = await createKrtoZip(scope.id);

  const { scope: newScope } = await loadKrtoZip(zipFile, {
    duplicate: true,
    duplicateIntoProjectId: targetProjectId,
    scopeName: name,
  });

  if (!newScope) throw new Error("Duplicated scope not found after import");

  return { newScopeId: newScope.id };
}
