export default class MarkersManager {
  constructor(mapEditor) {
    this.mapEditor = mapEditor;
    this.markers = [];
    this.markersById = {};
  }

  addMarker(marker) {
    this.markers.push(marker);
    this.markersById[marker.id] = marker;
  }

  removeMarker(marker) {
    const index = this.markers.indexOf(marker);
    if (index !== -1) {
      this.markers.splice(index, 1);
    }
    delete this.markersById[marker.id];
  }

  getMarkerById(id) {
    return this.markersById[id];
  }

  getMarkers() {
    return this.markers;
  }

  getMarkersByType(type) {
    return this.markers.filter((marker) => marker.type === type);
  }

  getMarkersByTypes(types) {
    return this.markers.filter((marker) => types.includes(marker.type));
  }

  clearMarkers() {
    this.markers = [];
    this.markersById = {};
  }
}
