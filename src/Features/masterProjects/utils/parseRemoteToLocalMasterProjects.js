export default function parseRemoteToLocalMasterProjects(projects) {
  return projects?.map((project) => ({
    id: project.IdObject,
    name: project.sDesignation,
    clientRef: project.sNumero,
    address: { city: project.sVille },
  }));
}
