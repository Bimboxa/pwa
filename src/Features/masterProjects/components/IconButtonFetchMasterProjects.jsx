import { useState } from "react";
import useFetchMasterProjects from "../hooks/useFetchMasterProjects";

import { IconButton } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";

export default function IconButtonFetchMasterProjects() {

    // data - func

    const fetchMasterProjects = useFetchMasterProjects();

    // state

    const [loading, setLoading] = useState(false);

    // handlers

    async function handleClick() {
        setLoading(true);
        const projects = await fetchMasterProjects();
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