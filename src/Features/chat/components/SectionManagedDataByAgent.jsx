import { useSelector } from "react-redux";

import { Box } from "@mui/material";

import SectionValidateTreeZones from "Features/zones/components/SectionValidateTreeZones";


export default function SectionManagedDataByAgent() {

    // data

    const managedDataByAgent = useSelector((state) => state.chat.managedDataByAgent);
    console.log("managedDataByAgent", managedDataByAgent);

    // helpers

    const isZonesTree = managedDataByAgent?.structure === "ZONES_TREE" &&
        Array.isArray(managedDataByAgent?.data);


    return (
        <Box sx={{ width: 1 }}>
            {isZonesTree && <SectionValidateTreeZones items={managedDataByAgent?.data} />}
        </Box>
    );
}