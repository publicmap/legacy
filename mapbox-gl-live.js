// mapbox-gl-live: Live tools to add interactivity to your Mapbox GL map
//  inspector: Explore the map data by inspecting features with the mouse

var xtend = require('xtend');
var urlencode = require('urlencode');

defaultOpts = {
    layers: [
        'building',
        'road-label-large',
        'road-label-medium',
        'road-label-small',
        'poi-scalerank4-l1',
        'poi-scalerank4-l15'
    ],
    on: 'click'
}

var Live = {

    // Inspect map layers on mouse interactivity
    inspector: function(map, opts) {

        opts = xtend(defaultOpts, opts);

        // Query features on interaction with the layers
        map.on(opts.on, function(e) {

            // Select the first feature from the list of features near the mouse
            var feature = map.queryRenderedFeatures(pixelPointToSquare(e.point, 4), {layers: opts.layers})[0];
            console.log(feature);
            var popupHTML = populateTable(feature);
            var popup = new mapboxgl.Popup().setLngLat(e.lngLat).setHTML(popupHTML).addTo(map);

        });

        // Change the mouse to a pointer on hovering over inspectable features
        map.on('mousemove', function(e) {
            var features = map.queryRenderedFeatures(pixelPointToSquare(e.point, 2), {layers: opts.layers});
            if (features.length) 
                map.getSource('hover').setData(features[0]);
            map.getCanvas().style.cursor = (features.length)
                ? 'pointer'
                : '';
        });

        // Highlight hovered over features
        map.addSource('hover', {
            type: 'geojson',
            data: {
                "type": "FeatureCollection",
                "features": []
            }
        });
        map.addLayer({
            "id": "route",
            "type": "line",
            "source": "hover",
            "layout": {
                "line-join": "round"
            },
            "paint": {
                "line-color": "#627BC1",
                "line-width": 3,
                "line-opacity": 0.5
            }
        });

    }
}

// Genreate HTML content for the inspector view
function populateTable(feature) {

    // Populate the popup and set its coordinates
    // based on the feature found.

    var popupHTML = "<h3>" + feature.properties.name + "</h3>";
    popupHTML += "<a href='" + nominatimLink(feature.properties.name, feature.geometry.coordinates) + "'>OSM Search</a><br>";

    popupHTML += "<table style='table-layout:fixed'>";

    for (property in feature.properties) {
        if (property == 'distance') {
            var distance = feature.properties[property];
            popupHTML += "<tr bgcolor = #d5e8ce><td>" + property + "</td><td>" + parseFloat(distance.toFixed(3)) + "</td></tr>";
        } else {
            popupHTML += "<tr><td>" + property + "</td><td>" + feature.properties[property] + "</td></tr>";
        }
    }
    popupHTML += "</table>";

    return popupHTML;
}

// Generate a nominatim search link for a feature name
function nominatimLink(name, coordinates) {

    const NOMINATIM_BASE = 'http://nominatim.openstreetmap.org/search.php?q=';

    // Limit search to the vicinity of the given coordinates
    try {

        var left = coordinates[0] - 1;
        var top = coordinates[1] - 1;
        var right = coordinates[0] + 1;
        var bottom = coordinates[1] + 1;

        var NOMINATIM_OPTS = name + "&polygon=1&bounded=1&viewbox=" + left + "%2C" + top + "%2C" + right + "%2C" + bottom

    } catch (e) {
        var NOMINATIM_OPTS = urlencode(name);
    }

    return NOMINATIM_BASE + NOMINATIM_OPTS;

}

// Geometry functions

// Return a square bbox of pixel coordinates from a given x,y point
function pixelPointToSquare(point, width) {
    var pointToSquare = [
        [
            point.x - width / 2,
            point.y - width / 2
        ],
        [
            point.x + width / 2,
            point.y + width / 2
        ]
    ];
    return pointToSquare;
}

// Export module
module.exports = Live;
