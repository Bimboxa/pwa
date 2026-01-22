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
        return { ...p, primaryText: p.name, secondaryText: p.clientRef, id: p.id ?? p.idMaster, shouldCreateProject }
    });

    // return

    return projectItems
}