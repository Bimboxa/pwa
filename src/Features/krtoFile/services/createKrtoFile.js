import db from "App/db/db";

export default async function createKrtoFile(projectId) {
  // Get project details for metadata
  const project = await db.projects.get(projectId);
  if (!project) {
    throw new Error(`Project with ID ${projectId} not found`);
  }

  const blob = await db.export({
    // prettyJson: true, // optional (bigger file, human-readable)
    filter: (table, value) => {
      if (table === "projects") return value.id === projectId;
      // All other tables have projectId as a foreign key:
      return "projectId" in (value ?? {}) && value.projectId === projectId;
    },
    // progressCallback: p => { console.log(p); return true; } // optional
  });

  // Create a readable filename from project name
  const sanitizedName = (project.name || "project")
    .replace(/[^a-z0-9]/gi, "_") // Replace non-alphanumeric with underscore
    .toLowerCase();

  const now = new Date();
  const date = now.toISOString().split("T")[0]; // YYYY-MM-DD
  const time = now
    .toTimeString()
    .split(" ")[0]
    .substring(0, 5)
    .replace(":", "h"); // HHhMM
  const timestamp = `${date}_${time}`;
  const filename = `${sanitizedName}_${timestamp}.krto`;

  const file = new File([blob], filename, { type: blob.type });

  return file;
}
