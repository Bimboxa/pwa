import { createContext, useState, useContext } from "react";

const SmartZoomContext = createContext(null);

export function SmartZoomProvider({ children }) {
    // On stocke l'élément DOM (div) où le zoom doit s'afficher
    const [zoomContainer, setZoomContainer] = useState(null);

    return (
        <SmartZoomContext.Provider value={{ zoomContainer, setZoomContainer }}>
            {children}
        </SmartZoomContext.Provider>
    );
}

export const useSmartZoom = () => useContext(SmartZoomContext);