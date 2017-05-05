'use strict';

import mapboxgl from 'mapbox-gl';
import Live from './mapbox-gl-live';

mapboxgl.accessToken = 'pk.eyJ1IjoicGxhbmVtYWQiLCJhIjoiY2l3ZmNjNXVzMDAzZzJ0cDV6b2lkOG9odSJ9.eep6sUoBS0eMN4thZUWpyQ';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/planemad/cirnjr9do000pgxma53mkgdw0',
    zoom: 11.6,
    center: [
        77.5937, 12.9736
    ],
    hash: true
});

Live.initmap(map);

// Live.addLayerInput(map);

map.on('load', function() {
    // Inspect layer on click and show popup information
    Live.inspector(map);
});

// the 'building' layer in the mapbox-streets vector source contains building-height
// data from OpenStreetMap.
map.on('load', function() {
    map.addLayer({
        'id': '3d-buildings',
        'source': 'composite',
        'source-layer': 'building',
        'filter': [
            '==', 'extrude', 'true'
        ],
        'type': 'fill-extrusion',
        'minzoom': 15,
        'paint': {
            'fill-extrusion-color': '#eee',
            'fill-extrusion-height': {
                'type': 'identity',
                'property': 'height'
            },
            'fill-extrusion-base': {
                'type': 'identity',
                'property': 'min_height'
            },
            'fill-extrusion-opacity': .4
        }
    }, 'housenum-label');
});
