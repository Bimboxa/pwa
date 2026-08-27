import deleteProjectLocalDataService from "../services/deleteProjectLocalDataService";

export default function useDeleteProject() {
  return (projectId) => deleteProjectLocalDataService(projectId);
}
