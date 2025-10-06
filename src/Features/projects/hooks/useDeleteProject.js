import db from "App/db/db";

export default function useDeleteProject() {
  const deleteProjects = async (projectId) => {
    await db.projects.get(projectId).clear();
    await db.scopes.where("projectId").equals(projectId).clear();
    await db.listings.where("projectId").equals(projectId).clear();
    await db.entities.where("projectId").equals(projectId).clear();
    await db.files.where("projectId").equals(projectId).clear();
    await db.syncFiles.where("projectId").equals(projectId).clear();
  };

  return deleteProjects;
}
