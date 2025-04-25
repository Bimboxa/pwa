import db from "App/db/db";

export default function getProjectByClientRef(clientRef) {
  return db.projects
    .where("clientRef")
    .equals(clientRef)
    .first()
    .then((project) => {
      if (!project) {
        console.log(`Project with clientRef ${clientRef} not found in local`);
        return null;
      }
      return project;
    })
    .catch((error) => {
      console.log("Error fetching project by clientRef:", error);
      return null;
    });
}
