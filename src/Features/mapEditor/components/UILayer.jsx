import useIsMobile from "Features/layout/hooks/useIsMobile";

import UILayerDesktop from "./UILayerDesktop";
import UILayerMobile from "./UILayerMobile";

export default function UILayer({ mapController, onResetCamera }) {

    const isMobile = useIsMobile();

    return (
        isMobile ? <UILayerMobile mapController={mapController} onResetCamera={onResetCamera} /> : <UILayerDesktop mapController={mapController} onResetCamera={onResetCamera} />
    );
}