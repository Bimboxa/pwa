import { Box, ListItemButton } from "@mui/material";
import useMeasure from "react-use-measure";

import { useDraggable } from '@dnd-kit/core';
import { DragOverlay, useDndContext } from '@dnd-kit/core';

import { CSS } from '@dnd-kit/utilities';

// Sous-composant pour gérer le drag individuel
const DraggableImageItem = ({ image, selected, onClick, width, height }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `draggable-image-${image.url}`,
    data: {
      type: 'EXTERNAL_IMAGE',
      imageUrl: image.url,
      idMaster: image.idMaster,
    },
  });

  const style = {
    // IMPORTANT : On n'utilise PLUS CSS.Translate.toString(transform) ici !
    // Cela force l'élément d'origine à rester statique dans la grille.

    cursor: isDragging ? 'grabbing' : 'grab',
    width: width,
    height: height,
    border: selected ? '2px solid blue' : '1px solid #ccc',
    position: 'relative',

    // Si tu veux qu'on sache laquelle est en train d'être clonée, 
    // tu peux mettre 0.8, mais pour qu'elle "ne disparaisse pas", laisse 1.
    opacity: 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <ListItemButton onClick={() => onClick(image)} sx={{ p: 0, width: '100%', height: '100%' }}>
        <img
          src={image.url}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            // On peut ajouter un petit filtre gris si on veut marquer qu'elle est "active"
            filter: isDragging ? 'grayscale(0.5)' : 'none'
          }}
        />
      </ListItemButton>
    </div>
  );
};


export default function GridImagesClickable({
  images,
  selectedUrl,
  onClick,
  columns = 2,
  containerWidth,
}) {

  const { active } = useDndContext();

  // 1. Hook de mesure
  // On récupère une ref à attacher et les dimensions (bounds)
  const [ref, bounds] = useMeasure();

  // 2. Détermination de la largeur à utiliser
  // Si la prop est définie, on l'utilise. Sinon, on utilise la largeur mesurée.
  const effectiveWidth = containerWidth ?? bounds.width;

  const gap = 8; // 8px

  // helpers
  // Calcul de la dimension (carrée)
  // On s'assure que effectiveWidth est > 0 pour éviter des valeurs négatives au premier render
  const safeWidth = effectiveWidth > 0 ? effectiveWidth : 0;

  // Formule: Largeur totale - (Espaces totaux) / Nombre de colonnes
  // Espaces totaux = gap * (columns + 1) car il y a un gap à gauche, à droite et entre chaque colonne
  const dim = safeWidth > 0
    ? (safeWidth - gap * (columns + 1)) / columns
    : 0;

  // handlers

  function handleClick(image) {
    if (onClick) onClick(image);
  }

  return (
    <Box ref={ref} sx={{ width: 1, display: "flex", flexWrap: "wrap", px: `${gap / 2}px` }}>
      {images.map((image) => (
        <Box key={image.url} sx={{ px: `${gap / 2}px`, py: `${gap / 2}px` }}>
          <DraggableImageItem
            image={image}
            selected={selectedUrl === image.url}
            onClick={onClick}
            width={dim}
            height={dim}
          />
        </Box>
      ))}

      {/* L'ajout de dropAnimation={null} désactive le retour vers la case départ.
          Dès que vous lâchez la souris, le clone disparaît instantanément.
      */}
      <DragOverlay dropAnimation={null} zIndex={1000}>
        {active?.data.current?.type === 'EXTERNAL_IMAGE' ? (
          <Box
            sx={{
              width: dim,
              height: dim,
              border: '2px solid blue',
              opacity: 0.8, // Légère transparence pour voir la zone de drop en dessous
              cursor: 'grabbing',
              // On s'assure qu'aucun événement de souris ne bloque le drop
              pointerEvents: 'none',
            }}
          >
            <img
              src={active.data.current.imageUrl}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </Box>
        ) : null}
      </DragOverlay>
    </Box>
  );
}