import db from "App/db/db";

export default function getProjectByClientRef(clientRef) {
  return db.projects
    .where("clientRef")
    .equals(clientRef)
    .first()
    .then((project) => {
      if (!project) {
        console.error(`Project with clientRef ${clientRef} not found`);
        return null;
      }
      return project;
    })
    .catch((error) => {
      console.error("Error fetching project by clientRef:", error);
      return null;
    });
}
