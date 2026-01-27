import { useState } from "react";
import { useSelector } from "react-redux";

import useFetchMasterProjectPictures from "../hooks/useFetchMasterProjectPictures";
import useSelectedProject from "Features/projects/hooks/useSelectedProject";

import { IconButton } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";

export default function IconButtonFetchMasterProjectPictures() {

    // data - func

    const fetchMasterProjectPictures = useFetchMasterProjectPictures();
    const { value: selectedProject } = useSelectedProject();
    const jwt = useSelector(s => s.auth.jwt);

    // state

    const [loading, setLoading] = useState(false);

    // handlers

    async function handleClick() {

        setLoading(true);
        const projects = await fetchMasterProjectPictures({ jwt, project: selectedProject });
        console.log("[IconButtonFetchMasterProjects] projects", projects);
        setLoading(false);
    }

    // render

    return (
        <IconButton onClick={handleClick} loading={loading}>
            <RefreshIcon />
        </IconButton>
    );
}