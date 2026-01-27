import { useEffect } from "react";

import { useSelector } from "react-redux";

import useFetchMasterProjectPictures from "./useFetchMasterProjectPictures";
import useSelectedProject from "Features/projects/hooks/useSelectedProject";

export default function useInitFetchMasterProjectPictures() {

    // data

    const jwt = useSelector(s => s.auth.jwt);
    const { value: selectedProject } = useSelectedProject();

    console.log("debug_2701_useInitFetchMasterProjectPictures selectedProject", selectedProject);

    // hooks

    const fetchMasterProjectPictures = useFetchMasterProjectPictures();

    // useEffect

    useEffect(() => {
        if (!selectedProject?.idMaster || !jwt) return;
        fetchMasterProjectPictures({ jwt, project: selectedProject });
    }, [selectedProject?.idMaster, jwt]);


}