import { useState } from "react";
import useFetchMasterProjects from "../hooks/useFetchMasterProjects";

import { IconButton } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";

export default function IconButtonFetchMasterProjects({ filterByProjectType }) {

    // data - func

    const fetchMasterProjects = useFetchMasterProjects();

    // state

    const [loading, setLoading] = useState(false);

    // handlers

    async function handleClick() {

        const keyMap = { "CHANTIER": "chantiers", "OPPORTUNITE": "opportunités" }

        setLoading(true);
        const projects = await fetchMasterProjects({ filterByOrigingKey: keyMap[filterByProjectType] });
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