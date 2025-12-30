import { useSelector, useDispatch } from "react-redux";

import useScopes from "Features/scopes/hooks/useScopes";

import { setSelectedScopeId } from "../scopesSlice";
import { setSelectedListingId } from "Features/listings/listingsSlice";

import { List, ListItemButton, ListItemText, Divider } from "@mui/material";

export default function SectionScopeSelectorVariantList({ onSelect }) {
    const dispatch = useDispatch();

    // data         
    const projectId = useSelector((s) => s.projects.selectedProjectId);
    const { value: scopes } = useScopes({ filterByProjectId: projectId });
    const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);

    // handlers

    function handleSelect(id) {
        dispatch(setSelectedScopeId(id));
        const scope = scopes.find(s => s.id === id)
        const listings = scope?.sortedListings

        // listing selection

        const id0 = listings?.[0]?.id;
        console.log("debug_3012 [scope] selected listing", id0);
        dispatch(setSelectedListingId(id0));

        // onSelect

        if (onSelect) onSelect();
    }

    return <List dense>
        {scopes?.map(scope => {
            const selected = scope.id === selectedScopeId;
            return <ListItemButton
                key={scope.id}
                selected={selected}
                onClick={() => handleSelect(scope.id)}
            >
                <ListItemText primary={scope.name} />
            </ListItemButton>
        })}
        <Divider />
    </List>
}