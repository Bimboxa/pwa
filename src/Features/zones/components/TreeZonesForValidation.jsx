import { useState, useCallback, useMemo } from "react";
import { RichTreeViewPro } from "@mui/x-tree-view-pro";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SectionSearch from "Features/tree/components/SectionSearch";
import TreeItemForValidation from "Features/tree/components/TreeItemForValidation";

import { cleanNodesIds } from "Features/tree/utils/nodesManagementUtils";
import getNodesFromSearchText from "Features/tree/utils/getNodesFromSearchText";
import getAllNodesIds from "Features/tree/utils/getAllNodesIds";

/**
 * TreeZonesForValidation
 * Gère l'affichage de l'arbre avec revue des modifications IA
 */
export default function TreeZonesForValidation({
    items,
    onItemsChange,
    expandedItems,
    onExpandedItemsChange,
    selectedItems,
    onSelectedItemsChange,
    onItemPositionChange,
    onDeleteItems,
    updatedAt,
    onMoreClick,
}) {

    console.log("debug_0302_items", items);

    const [searchText, setSearchText] = useState("");

    // --- 1. CALCUL DU DÉPLOIEMENT AUTOMATIQUE ---

    const aiExpandedIds = useMemo(() => {
        const ids = new Set();
        const walk = (nodes, parentId = null) => {
            nodes.forEach((node) => {
                const hasMod = node.agentModification && node.agentModification !== "NONE";
                // Si le noeud a une modif, on veut ouvrir son parent
                if (hasMod && parentId) ids.add(parentId);
                if (node.children) walk(node.children, node.id);
            });
        };
        walk(items);
        return Array.from(ids);
    }, [items]);

    const combinedExpanded = useMemo(() => {
        // Union des items dépliés manuellement et ceux suggérés par l'IA
        return Array.from(new Set([...(expandedItems || []), ...aiExpandedIds]));
    }, [expandedItems, aiExpandedIds]);

    // --- 2. LOGIQUE DE MISE À JOUR DE L'ARBRE ---

    const updateTreeRecursively = useCallback((nodes, itemId, patch) => {
        return nodes
            .map((node) => {
                if (node.id === itemId) {
                    if (patch === null) return null; // Action d'effacement (Ignore CREATE ou Accept DELETE)
                    return { ...node, ...patch };
                }
                if (node.children) {
                    return {
                        ...node,
                        children: updateTreeRecursively(node.children, itemId, patch).filter(Boolean),
                    };
                }
                return node;
            })
            .filter(Boolean);
    }, []);

    // --- 3. HANDLERS D'ACTIONS IA ---

    const handleAcceptChange = (itemId) => {
        const findNode = (nodes) => {
            for (let n of nodes) {
                if (n.id === itemId) return n;
                if (n.children) {
                    const found = findNode(n.children);
                    if (found) return found;
                }
            }
        };

        const node = findNode(items);
        // Si on accepte un DELETE, on le retire (null), sinon on valide (NONE)
        const patch = node?.agentModification === "DELETE" ? null : { agentModification: "NONE" };
        onItemsChange(updateTreeRecursively(items, itemId, patch));
    };

    const handleIgnoreChange = (itemId) => {
        const findNode = (nodes) => {
            for (let n of nodes) {
                if (n.id === itemId) return n;
                if (n.children) {
                    const found = findNode(n.children);
                    if (found) return found;
                }
            }
        };

        const node = findNode(items);
        // Si on ignore un CREATE, on le retire (null), sinon on reset le flag (NONE)
        const patch = node?.agentModification === "CREATE" ? null : { agentModification: "NONE" };
        onItemsChange(updateTreeRecursively(items, itemId, patch));
    };

    const handleEditLabel = (itemId, newLabel) => {
        if (newLabel !== null) {
            onItemsChange(updateTreeRecursively(items, itemId, { label: newLabel, agentModification: "UPDATE" }));
        }
    };

    // --- 4. TRAITEMENT RECHERCHE & IDS ---

    let processedItems = cleanNodesIds(items);
    processedItems = getNodesFromSearchText(searchText, processedItems);

    let finalExpanded = combinedExpanded;
    if (searchText?.length > 0) {
        finalExpanded = getAllNodesIds(processedItems);
    }

    return (
        <BoxFlexVStretch>
            <SectionSearch searchText={searchText} onChange={setSearchText} />
            <BoxFlexVStretch sx={{ width: 1, p: 1, overflow: "auto" }}>
                <RichTreeViewPro
                    key={updatedAt}
                    // DESACTIVATION DU DRAG N DROP
                    itemsReordering={false}
                    canMoveItem={() => false}
                    items={processedItems}
                    expandedItems={finalExpanded}
                    onExpandedItemsChange={(e, ids) => onExpandedItemsChange?.(ids)}
                    selectedItems={selectedItems}
                    onSelectedItemsChange={(e, ids) => onSelectedItemsChange?.(ids)}
                    slots={{ item: TreeItemForValidation }}

                    slotProps={{
                        item: {
                            // On ne passe que les fonctions/statiques ici
                            onAccept: handleAcceptChange,
                            onIgnore: handleIgnoreChange,
                            onEdit: handleEditLabel,
                            onMoreClick: onMoreClick,
                        },
                    }}
                />
            </BoxFlexVStretch>
        </BoxFlexVStretch>
    );
}