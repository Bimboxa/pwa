import { useSelector } from "react-redux";

import db from "App/db/db";
import fitContainerToBaseMap from "Features/portfolioEditor/utils/fitContainerToBaseMap";

export default function useLinkBaseMapToContainer() {
    const sourceContainerId = useSelector((s) => s.baseMapCreator.sourceContainerId);
    const sourceContentArea = useSelector((s) => s.baseMapCreator.sourceContentArea);
    const sourcePageId = useSelector((s) => s.baseMapCreator.sourcePageId);

    return async (baseMapId) => {
        if (!sourceContainerId || !baseMapId) return;

        const record = await db.baseMaps.get(baseMapId);
        const imageSize = record?.image?.imageSize;

        if (imageSize && sourceContentArea) {
            const fitted = fitContainerToBaseMap(imageSize, sourceContentArea);
            await db.portfolioBaseMapContainers.update(sourceContainerId, {
                baseMapId,
                x: fitted.x,
                y: fitted.y,
                width: fitted.width,
                height: fitted.height,
                viewBox: {
                    x: 0,
                    y: 0,
                    width: imageSize.width,
                    height: imageSize.height,
                },
            });
        } else {
            await db.portfolioBaseMapContainers.update(sourceContainerId, {
                baseMapId,
            });
        }

        // rename page title if still default
        if (sourcePageId) {
            const page = await db.portfolioPages.get(sourcePageId);
            if (
                page &&
                (page.title === "Nouvelle page" || page.title?.startsWith("Page "))
            ) {
                const name = record?.name || "Base map";
                await db.portfolioPages.update(sourcePageId, { title: name });
            }
        }
    };
}
