export const applyChanges = (originalData, diffs) => {
    let newData = JSON.parse(JSON.stringify(originalData));
    const isRootArray = Array.isArray(newData);

    const findAndModify = (container, change) => {
        const items = Array.isArray(container) ? container : (container.children || []);

        for (let i = 0; i < items.length; i++) {
            if (items[i].id === change.id) {
                // Au lieu de splice, on garde l'item et on lui passe le flag de l'IA
                items[i] = { ...items[i], ...change };
                return true;
            }
            if (items[i].id === change.parentId && change.agentModification === "CREATE") {
                if (!items[i].children) items[i].children = [];
                items[i].children.push({
                    children: [],
                    ...change,
                    id: change.id || `new-${Math.random().toString(36).substr(2, 9)}`
                });
                return true;
            }
            if (items[i].children && findAndModify(items[i].children, change)) return true;
        }
        return false;
    };

    if (Array.isArray(diffs)) {
        diffs.forEach(change => {
            if (change.agentModification === "CREATE" && !change.parentId) {
                const root = isRootArray ? newData : (newData.children || []);
                root.push({ children: [], ...change, id: change.id || `root-new-${Math.random()}` });
            } else {
                findAndModify(newData, change);
            }
        });
    }

    return newData; // Le tri est géré par RichTreeViewPro avec itemsReordering
};