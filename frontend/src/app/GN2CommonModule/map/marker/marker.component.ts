import { Component, OnInit, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { Map, Marker } from 'leaflet';
import { MapService } from '../map.service';
import { AppConfig } from '@geonature_config/app.config';
import * as L from 'leaflet';
import { CommonService } from '../../service/common.service';
import { GeoJson } from 'togeojson';

/**
 * Ce composant permet d'afficher un marker au clic sur la carte ainsi qu'un controleur permettant d'afficher/désafficher le marker.
 *
 * NB: Doit être utiliser à l'interieur d'une balise ``pnx-map``
 */
@Component({
  selector: 'pnx-marker',
  templateUrl: 'marker.component.html'
})
export class MarkerComponent implements OnInit, OnChanges {
  public map: Map;
  public previousCoord: Array<any>;
  @Input() coordinates: Array<any>;
  /** Niveau de zoom à partir du quel on peut ajouter un marker sur la carte*/
  @Input() zoomLevel: number;
  @Output() markerChanged = new EventEmitter<GeoJson>();
  constructor(public mapservice: MapService, private _commonService: CommonService) {}

  ngOnInit() {
    this.map = this.mapservice.map;
    this.zoomLevel = this.zoomLevel || AppConfig.MAPCONFIG.ZOOM_LEVEL_RELEVE;
    this.setMarkerLegend();
    this.enableMarkerOnClick();

    this.mapservice.isMarkerEditing$.subscribe(isEditing => {
      this.toggleEditing(isEditing);
    });
  }

  setMarkerLegend() {
    // Marker
    const MarkerLegend = this.mapservice.addCustomLegend(
      'topleft',
      'markerLegend',
      'url(assets/images/location-pointer.png)'
    );
    this.map.addControl(new MarkerLegend());
    // custom the marker
    document.getElementById('markerLegend').style.backgroundColor = '#c8c8cc';
    L.DomEvent.disableClickPropagation(document.getElementById('markerLegend'));
    document.getElementById('markerLegend').onclick = () => {
      this.toggleEditing(true);
    };
  }

  enableMarkerOnClick() {
    this.map.on('click', (e: any) => {
      // the boolean change MUST be before the output fire (emit)
      this.mapservice.firstLayerFromMap = false;
      // check zoom level
      if (this.map.getZoom() < this.zoomLevel) {
        this._commonService.translateToaster('warning', 'Map.ZoomWarning');
      } else {
        this.generateMarkerAndEvent(e.latlng.lng, e.latlng.lat);
      }
    });
  }
  generateMarkerAndEvent(x, y) {
    if (this.mapservice.marker !== undefined) {
      this.mapservice.marker.remove();
      this.mapservice.marker = this.mapservice.createMarker(x, y, true).addTo(this.map);
      this.previousCoord = [x, y];
      this.markerMoveEvent(this.mapservice.marker);
    } else {
      this.mapservice.marker = this.mapservice.createMarker(x, y, true).addTo(this.map);
      this.markerMoveEvent(this.mapservice.marker);
    }
    // observable to send geojson
    this.mapservice.firstLayerFromMap = false;

    this.markerChanged.emit(this.markerToGeojson(this.mapservice.marker.getLatLng()));
  }

  markerMoveEvent(marker: Marker) {
    marker.on('moveend', (event: MouseEvent) => {
      if (this.map.getZoom() < this.zoomLevel) {
        this._commonService.translateToaster('warning', 'Map.ZoomWarning');
        this.mapservice.marker.remove();
        this.mapservice.marker = this.mapservice.createMarker(
          this.previousCoord[0],
          this.previousCoord[1],
          true
        );
        this.map.addLayer(this.mapservice.marker);
        this.markerMoveEvent(this.mapservice.marker);
      } else {
        this.markerChanged.emit(this.markerToGeojson(this.mapservice.marker.getLatLng()));
      }
    });
  }

  toggleEditing(enable: boolean) {
    this.mapservice.editingMarker = enable;

    document.getElementById('markerLegend').style.backgroundColor = this.mapservice.editingMarker
      ? '#c8c8cc'
      : 'white';
    if (!this.mapservice.editingMarker) {
      // disable event
      this.mapservice.map.off('click');
      if (this.mapservice.marker !== undefined) {
        this.mapservice.marker.off('moveend');
        this.map.removeLayer(this.mapservice.marker);
      }
    } else {
      this.mapservice.removeAllLayers(this.map, this.mapservice.leafletDrawFeatureGroup);
      this.mapservice.removeAllLayers(this.map, this.mapservice.fileLayerFeatureGroup);
      this.enableMarkerOnClick();
    }
  }

  markerToGeojson(latLng) {
    return { geometry: { type: 'Point', coordinates: [latLng.lng, latLng.lat] } };
  }

  ngOnChanges(changes) {
    if (changes.coordinates && changes.coordinates.currentValue) {
      const coords = changes.coordinates.currentValue;
      this.previousCoord = coords;
      this.generateMarkerAndEvent(coords[0], coords[1]);
    }
  }
}