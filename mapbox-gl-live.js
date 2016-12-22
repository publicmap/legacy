// mapbox-gl-live: Live tools to add interactivity to your Mapbox GL map
//  inspector: Explore the map data by inspecting features with the mouse

// Datests setup
// 1. Create a new access token with the `datasets:read` and `datasets:write` scope. Request for a beta access if you do not see this option https://www.mapbox.com/api-documentation/#datasets
var mapboxAccessDatasetToken = 'sk.eyJ1IjoidGhlcGxhbmVtYWQiLCJhIjoiY2l3a2Jkazl1MDAwbjJvbXN1MXZzNXJwNyJ9.kNJ9l7CjEfQU4TfWnGpUFw';

// 2. Create a new Mapbox dataset and set the dataset location https://www.mapbox.com/blog/wildfire-datasets/
var dataset = 'ciwkbb8dm00092ymsu2dt5bvw';
var DATASETS_BASE = 'https://api.mapbox.com/datasets/v1/theplanemad/' + dataset + '/';

var xtend = require('xtend');
var urlencode = require('urlencode');
var MapboxClient = require('mapbox/lib/services/datasets');
var mapbox = new MapboxClient(mapboxAccessDatasetToken);

defaultOptions = {
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
    // options.layers : <Array> of layer ids to make interactive
    // options.on : <Event>
    inspector: function(map, options) {

        options = defaultOptions || options;

        // Query features on interaction with the layers
        map.on(options.on, function(e) {

            // Select the first feature from the list of features near the mouse
            var feature = map.queryRenderedFeatures(pixelPointToSquare(e.point, 4), {layers: options.layers})[0];
            console.log(feature);
            var popupHTML = populateTable(feature);
            var popup = new mapboxgl.Popup().setLngLat(e.lngLat).setHTML(popupHTML).addTo(map);

        });

        // Change the mouse to a pointer on hovering over inspectable features
        map.on('mousemove', function(e) {
            var features = map.queryRenderedFeatures(pixelPointToSquare(e.point, 2), {layers: options.layers});
            features.length && map.getSource('hover').setData(features[0]);
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
    },

    notes: function(map, options) {
        map.on('style.load', function(e) {
            init();

            function init() {

                map.addSource('overlayDataSource', overlayDataSource);
                map.addLayer(overlayData);
                getOverlayFeatures();

                map.on('click', function(e) {

                    console.log('shoot')

                    // Add review marker
                    var newOverlayFeature = {
                        "type": "Feature",
                        "properties": {},
                        "geometry": {
                            "coordinates": [],
                            "type": "Point"
                        }
                    };

                    var clickedOverlayFeatures = map.queryRenderedFeatures([
                        [
                            e.point.x - 5,
                            e.point.y - 5
                        ],
                        [
                            e.point.x + 5,
                            e.point.y + 5
                        ]
                    ], {layers: ['overlayData']});
                    if (clickedOverlayFeatures.length) {
                        overlayFeatureForm(clickedOverlayFeatures[0]);

                    } else {
                        overlayFeatureForm();
                    }

                    function overlayFeatureForm(feature) {
                        var formOptions = "<div class='radio-pill pill pad1y clearfix'><input id='safe' type='radio' name='review' value='safe' checked='checked'><label for='safe' class='short button icon check fill-green'>Safe</label><input id='unsafe' type='radio' name='review' value='unsafe'><label for='unsafe' class='short button icon check fill-red'>Danger</label></div>";
                        var formReviewer = "<fieldset><label>Reported by: <span id='reviewer' style='padding:5px;background-color:#eee'></span></label><input type='text' name='reviewer' placeholder='name'></input></fieldset>"
                        var popupHTML = "<form>" + formOptions + formReviewer + "<a id='updateOverlayFeature' class='button col4' href='#'>Save</a><a id='deleteOverlayFeature' class='button quiet fr col4' href='#' style=''>Delete</a></form>";
                        var popup = new mapboxgl.Popup().setLngLat(e.lngLat).setHTML(popupHTML).addTo(map);

                        // Show existing status if available
                        if (feature) {
                            $("input[name=review][value=" + feature.properties["key"] + "]").prop('checked', true);
                            $("#reviewer").html(feature.properties["contributed_by"]);
                            newOverlayFeature = feature;
                            newOverlayFeature["id"] = feature.properties["id"];
                            console.log(feature);
                        } else {
                            newOverlayFeature.geometry.coordinates = e.lngLat.toArray();
                        }

                        // Set reviewer name if previously saved
                        if (reviewer) {
                            $("input[name=reviewer]").val(reviewer);
                        }

                        // Update dataset with feature status on clicking save
                        document.getElementById("updateOverlayFeature").onclick = function() {
                            newOverlayFeature.properties["key"] = $("input[name=review]:checked").val();
                            reviewer = $("input[name=reviewer]").val();
                            newOverlayFeature.properties["contributed_by"] = reviewer;
                            popup.remove();
                            mapbox.insertFeature(newOverlayFeature, dataset, function(err, response) {
                                console.log(response);
                                overlayFeatureCollection.features = overlayFeatureCollection.features.concat(response);
                                overlayDataSource.setData(overlayFeatureCollection);
                            });
                        };
                        // Delete feature on clicking delete
                        document.getElementById("deleteOverlayFeature").onclick = function() {
                            popup.remove();
                            mapbox.deleteFeature(newOverlayFeature["id"], dataset, function(err, response) {
                                console.log(response);
                            });
                        };
                    }

                });

            }

            // Get data from a Mapbox dataset
            var overlayFeatureCollection = {
                'type': 'FeatureCollection',
                'features': []
            };

            function getOverlayFeatures(startID) {

                var url = DATASETS_BASE + 'features';
                var params = {
                    'access_token': mapboxAccessDatasetToken
                };

                // Begin with the last feature of previous request
                if (startID) {
                    params.start = startID;
                }

                $.getJSON(url, params, function(data) {

                    console.log(data);

                    if (data.features.length) {
                        data.features.forEach(function(feature) {
                            // Add dataset feature id as a property
                            feature.properties.id = feature.id;
                        });
                        overlayFeatureCollection.features = overlayFeatureCollection.features.concat(data.features);
                        var lastFeatureID = data.features[data.features.length - 1].id;
                        getOverlayFeatures(lastFeatureID);
                        overlayDataSource.setData(overlayFeatureCollection);
                    }
                    overlayDataSource.setData(overlayFeatureCollection);
                });
            }

        });
    },

    // Add custom layer input
    addLayerInput: function addMapLayer(map, options) {
        // Add an input text box
        $('.mapboxgl-ctrl-top-left').append('<div class="mapboxgl-ctrl-geocoder mapboxgl-ctrl"><input id="custom-layer" type="text" placeholder="Add tile url"></input></div>')
        // On pressing enter
        $('#custom-layer').on('keypress', function(e) {
            if (e.which === 13) {
                var url = $(this).val();
                console.log(url);

                // var wmsURL = 'https://geodata.state.nj.us/imagerywms/Natural2015?bbox={bbox-epsg-3857}&format=image/png&service=WMS&version=1.1.1&request=GetMap&srs=EPSG:3857&width=256&height=256&layers=Natural2015';
                var wmsURL = 'https://vtile4.nrsc.gov.in/bhuvan/gwc/service/wms/?LAYERS=vector%3Acity_hq&TRANSPARENT=TRUE&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&STYLES=&FORMAT=image%2Fpng&SRS=EPSG%3A4326&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256';
                var wmsURL = 'https://tile1.nrsc.gov.in/tilecache/tilecache.py/1.0.0/bhuvan_imagery2/{z}/{x}/{y}.jepg';
                map.addSource('custom-raster-layer', {
                    'type': 'raster',
                    'tiles': [url],
                    'tileSize': 256
                });

                map.addLayer({
                    'id': 'custom-raster-layer',
                    'type': 'raster',
                    'source': 'custom-raster-layer',
                    'paint': {}
                }, 'aeroway-taxiway');
            }
        });
    },

    // Init map controls
    initmap: function addDefaultControls(map, options) {
        map.addControl(new MapboxGeocoder({accessToken: mapboxgl.accessToken}));
        map.addControl(new mapboxgl.ScaleControl());
        map.addControl(new mapboxgl.NavigationControl());
        map.addControl(new mapboxgl.GeolocateControl({position: 'bottom-right'}));
    }
}

// Genreate HTML content for the inspector view
function populateTable(feature) {

    // Populate the popup and set its coordinates
    // based on the feature found.

    var popupHTML = "<h3>" + feature.properties.name + "</h3>";
    popupHTML += "<a href='" + nominatimLink(feature.properties.name, feature.geometry.coordinates[0][0]) + "'>OSM Search</a><br>";

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

        var NOMINATIM_options = name + "&polygon=1&bounded=1&viewbox=" + left + "%2C" + top + "%2C" + right + "%2C" + bottom

    } catch (e) {
        var NOMINATIM_options = urlencode(name);
    }

    return NOMINATIM_BASE + NOMINATIM_options;

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
rts = Live;
