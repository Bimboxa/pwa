import useProjects from "Features/projects/hooks/useProjects";
import useMasterProjects from "Features/masterProjects/hooks/useMasterProjects";

export default function useProjectsItems() {

    // data

    const { value: projects } = useProjects();
    const masterProjects = useMasterProjects();

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
    projectItems = projectItems.map((p) => ({ ...p, primaryText: p.name }));

    // return

    return projectItems
}