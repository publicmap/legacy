'use strict';

/* global App */
var mapboxglLive = require('./mapbox-gl-live');

mapboxgl.accessToken = 'pk.eyJ1IjoicGxhbmVtYWQiLCJhIjoiY2l3ZmNjNXVzMDAzZzJ0cDV6b2lkOG9odSJ9.eep6sUoBS0eMN4thZUWpyQ';
var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/planemad/cirnjr9do000pgxma53mkgdw0',
    zoom: 11.6,
    center: [
        77.5937, 12.9736
    ],
    hash: true
});

map.addControl(new MapboxGeocoder({accessToken: mapboxgl.accessToken}));

map.on('load', function() {

    // Inspect layer on click and show popup information
    mapboxglLive.inspector(map);

});
