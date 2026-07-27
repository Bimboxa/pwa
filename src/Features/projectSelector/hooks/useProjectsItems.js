import useProjects from "Features/projects/hooks/useProjects";
import useMasterProjects from "Features/masterProjects/hooks/useMasterProjects";

export default function useProjectsItems() {

    // data

    const { value: projects } = useProjects();
    const masterProjects = useMasterProjects();

    console.log("debug_2101_masterProjects", masterProjects);

    // concate

    const allProjectsByClientRef = {};

    projects?.forEach(p => {
        const clientRef = p.clientRef;
        if (!allProjectsByClientRef[clientRef]) {
            allProjectsByClientRef[clientRef] = p;
        }
        allProjectsByClientRef[clientRef] = { ...allProjectsByClientRef[clientRef], ...p };
    });

    masterProjects?.forEach(mp => {
        const clientRef = mp.clientRef;
        if (!allProjectsByClientRef[clientRef]) {
            allProjectsByClientRef[clientRef] = mp;
        }
        allProjectsByClientRef[clientRef] = { ...allProjectsByClientRef[clientRef], ...mp };
    });

    // transform

    let projectItems = Object.values(allProjectsByClientRef);

    projectItems = projectItems.map((p) => {
        const shouldCreateProject = !Boolean(p.id);
        // no local id for master-only projects: useCreateProject generates a
        // nanoid and stores idMaster separately; key is for the React list only
        const key = p.id ?? (p.idMaster != null ? `master-${p.idMaster}` : p.clientRef);
        return { ...p, primaryText: p.name, secondaryText: p.clientRef, key, shouldCreateProject }
    });

    // return

    return projectItems
}