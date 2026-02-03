import { useState, useEffect } from "react";

import { useDispatch } from "react-redux";

import { setManagedDataByAgent } from "Features/chat/chatSlice";

import useCreateOrUpdateZonesTree from "../hooks/useCreateOrUpdateZonesTree";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useZonesTree from "../hooks/useZonesTree";

import { Box } from "@mui/material";

import BoxAlignToRight from "Features/layout/components/BoxAlignToRight";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import TreeZonesForValidation from "Features/zones/components/TreeZonesForValidation";

import { commitChanges } from "Features/chat/utils/commitChanges";



export default function SectionValidateTreeZones({ items }) {
    const dispatch = useDispatch();

    // data

    const createOrUpdateZonesTree = useCreateOrUpdateZonesTree();
    const { value: listing } = useSelectedListing();

    // state

    const [tempItems, setTempItems] = useState(items);
    useEffect(() => {
        setTempItems(items);
    }, [items?.length]);

    // handlers

    const handleValidate = async () => {
        const cleanItems = commitChanges(tempItems);
        await createOrUpdateZonesTree({
            listing,
            zonesTree: cleanItems
        });
        dispatch(setManagedDataByAgent({}))
    };

    const handleCancel = () => {
        console.log("Cancel clicked");
        dispatch(setManagedDataByAgent({}))
    };

    const handleItemsChange = (newItems) => {
        setTempItems(newItems);
    };

    return (
        <Box sx={{ border: theme => `1px solid ${theme.palette.divider}`, borderRadius: 1, width: 1 }}>
            <TreeZonesForValidation items={tempItems} onItemsChange={handleItemsChange} />
            <BoxAlignToRight>
                <ButtonGeneric label="Annuler" onClick={handleCancel} />
                <ButtonGeneric label="Valider" onClick={handleValidate} />
            </BoxAlignToRight>
        </Box>
    );
}