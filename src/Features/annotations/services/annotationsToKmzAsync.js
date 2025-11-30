import JSZip from "jszip";
import db from "App/db/db";
import getAnnotationEntityAsync from "Features/entities/services/getAnnotationEntityAsync";
import getEntityWithImagesAsync from "Features/entities/services/getEntityWithImagesAsync";

export default async function annotationsToKmzAsync({
  annotations,
  baseMap,
  spriteImage,
  appConfig,
}) {
  // data

  const imageSize = baseMap?.image?.imageSize;
  const latLng = baseMap?.latLng; // {lat, lng, x, y}
  const meterByPx = baseMap?.image?.meterByPx ?? baseMap?.meterByPx;

  // Validate required data
  if (!imageSize || !latLng || !meterByPx) {
    console.log("baseMap", baseMap);
    throw new Error(
      "Missing required baseMap data: imageSize, latLng, or meterByPx"
    );
  }

  if (!annotations || annotations.length === 0) {
    throw new Error("No annotations provided");
  }

  // Helper: Convert relative coordinates (0-1) to lat/lng
  function convertToLatLng(relativeX, relativeY) {
    const imageWidth = imageSize.width;
    const imageHeight = imageSize.height;

    // Convert relative to pixel coordinates
    const pixelX = relativeX * imageWidth;
    const pixelY = relativeY * imageHeight;

    // Calculate offset in meters from reference point
    // Note: In image coordinates, Y=0 is at top and increases downward
    // In geographic coordinates, latitude increases northward
    // So we need to flip the Y-axis
    const offsetXMeters = (pixelX - latLng.x) * meterByPx;
    const offsetYMeters = -(pixelY - latLng.y) * meterByPx; // Negative to flip Y-axis

    // Convert meters to degrees
    // 1 degree latitude ≈ 111,000 meters
    // 1 degree longitude ≈ 111,000 * cos(latitude) meters
    const metersPerDegreeLat = 111000;
    const metersPerDegreeLng = 111000 * Math.cos((latLng.lat * Math.PI) / 180);

    const lat = latLng.lat + offsetYMeters / metersPerDegreeLat;
    const lng = latLng.lng + offsetXMeters / metersPerDegreeLng;

    return { lat, lng };
  }

  // Helper: Extract icon from sprite sheet
  async function extractIconFromSprite(iconKey) {
    if (!spriteImage || !iconKey) return null;

    const { iconKeys, columns, rows, tile, url } = spriteImage;
    const index = iconKeys?.indexOf(iconKey);
    if (index === -1 || index === undefined) return null;

    try {
      // Load sprite image
      let image;
      if (typeof url === "string" && url.startsWith("data:")) {
        // Data URL
        image = new Image();
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = reject;
          image.src = url;
        });
      } else {
        // Try fetch first, fallback to Image if needed
        try {
          const response = await fetch(url);
          const blob = await response.blob();
          if (typeof createImageBitmap !== "undefined") {
            image = await createImageBitmap(blob);
          } else {
            // Fallback for older browsers
            const imageUrl = URL.createObjectURL(blob);
            image = new Image();
            await new Promise((resolve, reject) => {
              image.onload = resolve;
              image.onerror = reject;
              image.src = imageUrl;
            });
            URL.revokeObjectURL(imageUrl);
          }
        } catch (fetchError) {
          // Fallback: try as direct image URL
          image = new Image();
          await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = reject;
            image.src = url;
          });
        }
      }

      // Calculate position in sprite sheet
      const col = index % columns;
      const row = Math.floor(index / columns);

      // Create canvas to extract icon
      const canvas = document.createElement("canvas");
      canvas.width = tile;
      canvas.height = tile;
      const ctx = canvas.getContext("2d");

      // Draw the icon portion
      ctx.drawImage(
        image,
        col * tile,
        row * tile,
        tile,
        tile,
        0,
        0,
        tile,
        tile
      );

      // Return the canvas (not blob) so we can composite it
      return canvas;
    } catch (error) {
      console.error("Error extracting icon from sprite:", error);
      return null;
    }
  }

  // Helper: Create colored circle icon with white border and sprite icon in center
  async function createCircleIconWithSprite(fillColor, iconKey) {
    try {
      // Create canvas for the composite icon
      const size = 64; // Icon size in pixels
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");

      // Clear canvas
      ctx.clearRect(0, 0, size, size);

      const centerX = size / 2;
      const centerY = size / 2;
      const radius = size / 2 - 4; // Leave space for border

      // Draw white border (outer circle)
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 2, 0, 2 * Math.PI);
      ctx.fillStyle = "white";
      ctx.fill();

      // Draw colored circle (inner circle)
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.fillStyle = fillColor || "#3388ff";
      ctx.fill();

      // Extract and draw sprite icon in the center if available
      if (iconKey) {
        const spriteCanvas = await extractIconFromSprite(iconKey);
        if (spriteCanvas) {
          // Calculate size and position to center the sprite icon
          const iconSize = size * 0.6; // Sprite icon takes 60% of circle
          const iconX = centerX - iconSize / 2;
          const iconY = centerY - iconSize / 2;
          
          ctx.drawImage(spriteCanvas, iconX, iconY, iconSize, iconSize);
        }
      }

      // Convert to blob
      return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), "image/png");
      });
    } catch (error) {
      console.error("Error creating circle icon with sprite:", error);
      return null;
    }
  }

  // Helper: Get entity images
  async function getEntityImages(entity, annotationId) {
    if (!entity) return [];

    const images = [];
    const entriesWithImages = Object.entries(entity).filter(
      ([key, value]) => value?.isImage && value?.fileName
    );

    for (const [key, value] of entriesWithImages) {
      const file = await db.files.get(value.fileName);
      if (file && file.fileArrayBuffer) {
        const blob = new Blob([file.fileArrayBuffer], {
          type: file.fileMime || "image/png",
        });

        // Convert blob to base64 data URL for embedding in KML description
        const dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });

        // Generate unique filename using annotation ID and key
        const originalFileName = value.fileName || `image_${key}`;
        const extension = originalFileName.split(".").pop() || "png";
        const baseName =
          originalFileName.replace(/\.[^/.]+$/, "") || `image_${key}`;
        const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, "_");
        const uniqueFileName = `img_${annotationId}_${sanitizedBaseName}.${extension}`;

        images.push({
          blob,
          fileName: uniqueFileName,
          dataUrl, // Add data URL for use in descriptions
          key,
        });
      }
    }

    return images;
  }

  // Helper: Escape XML
  function escapeXml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  // Helper: Create KML for annotation
  async function createAnnotationKML(annotation, index) {
    const entity = appConfig
      ? await getAnnotationEntityAsync(annotation, appConfig)
      : null;

    // Get entity data if not provided
    let entityData = entity;
    if (!entityData && annotation.entityId && annotation.listingId) {
      const listing = await db.listings.get(annotation.listingId);
      const table = listing?.table;
      if (table) {
        const entityRaw = await db[table].get(annotation.entityId);
        if (entityRaw) {
          const { entityWithImages } = await getEntityWithImagesAsync(
            entityRaw
          );
          entityData = entityWithImages;
        }
      }
    }

    // Get name and description for KML
    // Name: use entity.num if available, otherwise fallback to label or index
    const placemarkName =
      entityData?.num ||
      annotation.label ||
      `Annotation ${index + 1}`;

    // Description: combine annotation.label and entity.text
    const descriptionParts = [];
    if (annotation.label) {
      descriptionParts.push(annotation.label);
    }
    if (entityData?.text) {
      descriptionParts.push(entityData.text);
    }
    const placemarkDescription = descriptionParts.join("\n") || placemarkName;

    // Get entity images
    const entityImages = entityData
      ? await getEntityImages(entityData, annotation.id || `ann_${index}`)
      : [];

    // Create colored circle icon with sprite in center for MARKER type
    let iconBlob = null;
    let iconFileName = null;
    if (annotation.type === "MARKER") {
      iconBlob = await createCircleIconWithSprite(
        annotation.fillColor,
        annotation.iconKey
      );
      if (iconBlob) {
        iconFileName = `icon_${annotation.id}.png`;
      }
    }

    // Convert points to coordinates
    let coordinates = [];
    const points =
      annotation.points ||
      annotation.polyline?.points ||
      annotation.rectangle?.points ||
      annotation.segment?.points ||
      annotation.shape?.points ||
      [];

    if (points.length > 0) {
      coordinates = points.map((point) => {
        const { lat, lng } = convertToLatLng(point.x, point.y);
        return `${lng},${lat},0`;
      });
    } else if (annotation.type === "MARKER" && annotation.x !== undefined) {
      // Single point marker
      const { lat, lng } = convertToLatLng(annotation.x, annotation.y);
      coordinates = [`${lng},${lat},0`];
    }

    if (coordinates.length === 0) {
      return null; // Skip annotations without valid coordinates
    }

    // Build description HTML
    let description = `<![CDATA[<div>`;
    
    // Add the combined description (label + text)
    if (placemarkDescription) {
      // Split by newlines and wrap each part in a paragraph
      const descLines = String(placemarkDescription).split("\n");
      descLines.forEach(line => {
        if (line.trim()) {
          description += `<p>${escapeXml(line)}</p>`;
        }
      });
    }

    // Add additional entity description if available and different
    if (entityData?.description && !descriptionParts.includes(entityData.description)) {
      description += `<p>${escapeXml(String(entityData.description))}</p>`;
    }

    // Add entity images to description using file references from the ZIP
    // Note: Some KMZ viewers may not support local file references and will show warnings
    entityImages.forEach((img, idx) => {
      description += `<p><img src="files/${img.fileName}" alt="Image ${
        idx + 1
      }" style="max-width: 500px;"/></p>`;
    });

    description += `</div>]]>`;

    // Create KML based on annotation type
    let kmlContent = "";

    if (annotation.type === "MARKER" && coordinates.length === 1) {
      // Point/Placemark - elevate above ground to stay visible above buildings
      const [lng, lat] = coordinates[0].split(",");
      const elevatedCoord = `${lng},${lat},50`; // 50 meters above ground
      
      kmlContent = `
    <Placemark>
      <name>${escapeXml(String(placemarkName))}</name>
      <description>${description}</description>
      ${
        iconFileName
          ? `<Style><IconStyle><Icon><href>files/${iconFileName}</href></Icon></IconStyle></Style>`
          : ""
      }
      <Point>
        <altitudeMode>relativeToGround</altitudeMode>
        <coordinates>${elevatedCoord}</coordinates>
      </Point>
    </Placemark>`;
    } else if (
      annotation.type === "POLYLINE" ||
      annotation.type === "RECTANGLE" ||
      coordinates.length > 1
    ) {
      // LineString or Polygon - use clampToGround with extrusion
      const isClosed =
        annotation.closeLine ||
        annotation.type === "RECTANGLE" ||
        (coordinates.length > 2 &&
          coordinates[0] === coordinates[coordinates.length - 1]);

      if (isClosed && coordinates.length >= 3) {
        // Polygon
        kmlContent = `
    <Placemark>
      <name>${escapeXml(String(entityText))}</name>
      <description>${description}</description>
      <Style>
        <LineStyle>
          <color>ff0000ff</color>
          <width>3</width>
        </LineStyle>
        <PolyStyle>
          <color>4d0000ff</color>
        </PolyStyle>
      </Style>
      <Polygon>
        <extrude>1</extrude>
        <altitudeMode>clampToGround</altitudeMode>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${coordinates.join(" ")}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>`;
      } else {
        // LineString
        kmlContent = `
    <Placemark>
      <name>${escapeXml(String(entityText))}</name>
      <description>${description}</description>
      <Style>
        <LineStyle>
          <color>ff0000ff</color>
          <width>3</width>
        </LineStyle>
      </Style>
      <LineString>
        <extrude>1</extrude>
        <altitudeMode>clampToGround</altitudeMode>
        <coordinates>${coordinates.join(" ")}</coordinates>
      </LineString>
    </Placemark>`;
      }
    }

    return {
      kml: kmlContent,
      iconBlob,
      iconFileName,
      entityImages,
    };
  }

  // Create KML document
  const kmlPlacemarks = [];
  const allFiles = new Map(); // fileName -> blob

  for (let i = 0; i < annotations.length; i++) {
    const annotation = annotations[i];
    const result = await createAnnotationKML(annotation, i);

    if (result && result.kml) {
      kmlPlacemarks.push(result.kml);

      // Add icon to files
      if (result.iconBlob && result.iconFileName) {
        allFiles.set(result.iconFileName, result.iconBlob);
      }

      // Add entity images to files
      result.entityImages.forEach((img) => {
        allFiles.set(img.fileName, img.blob);
      });
    }
  }

  // Build complete KML document
  const documentName = baseMap?.name || "Annotations Export";
  const kmlDocument = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(String(documentName))}</name>
    <description>Observations - ${escapeXml(String(documentName))}</description>
${kmlPlacemarks.join("\n")}
  </Document>
</kml>`;

  // Create KMZ (ZIP) file
  const zip = new JSZip();
  zip.file("doc.kml", kmlDocument);

  // Add all files to files/ folder
  const filesFolder = zip.folder("files");
  for (const [fileName, blob] of allFiles.entries()) {
    filesFolder.file(fileName, blob);
  }

  // Generate KMZ blob
  const kmzBlob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return kmzBlob;
}
