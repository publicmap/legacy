'use strict';

/* global App */
var mapboxglLive = require('../../mapbox-gl-live');

mapboxgl.accessToken = 'pk.eyJ1IjoicGxhbmVtYWQiLCJhIjoiY2l3ZmNjNXVzMDAzZzJ0cDV6b2lkOG9odSJ9.eep6sUoBS0eMN4thZUWpyQ';
var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/planemad/ciwgs6y0v00dn2pmqlnhd8fuo',
    zoom: 7.4,
    center: [
        74.02, 19.41
    ],
    hash: true
});

mapboxglLive.initmap(map);

map.on('load', function() {

    // Inspect layer on click and show popup information
    mapboxglLive.inspector(map, {
        layers: ['mh-villages line', 'mh-villages point']
    });

    // Add notes to the map on click
    mapboxglLive.notes(map);

});
