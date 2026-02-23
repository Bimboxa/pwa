import db, { withHardDelete } from "App/db/db";

export default function useDeleteProjects() {
  const deleteProjects = async () => {
    await withHardDelete(async () => {
      await db.projects.clear();
      await db.scopes.clear();
      await db.listings.clear();
      await db.entities.clear();
      await db.files.clear();
      await db.syncFiles.clear();
    });
  };

  return deleteProjects;
}
