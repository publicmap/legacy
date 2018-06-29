/**
 * A [Mapbox GL JS plugin](https://www.mapbox.com/blog/build-mapbox-gl-js-plugins/) that allows you to
 * Add annotations to your Mapbox map via the Mapbox Datasets API
 * @constructor
 * @param {object} options - Options to configure the plugin.
*/

// Mapbox Notes
// based on github.com/mapbox/mapbox-gl-traffic/blob/master/mapbox-gl-traffic.js

// A note can be used to crowdsource geolocated points of information
// Every note has the following properties:
// - The note <string>
// - Author <string>
// - Timestamp <time>
// - Location <geometry>
// All the properties are updated to the latest state at each change


var MapboxClient = require('mapbox/lib/services/datasets');
var timeAgo = require('node-time-ago');

function MapboxNotes(options) {
  if (!(this instanceof MapboxNotes)) {
    throw new Error('MapboxNotes needs to be called with the new keyword');
  }

  this.options = Object.assign({
    active: false,
    query: null,
    mapbox: {
      dataset: 'theplanemad/citdwsmsa007846o5n1ff2zs9',
      accessToken: 'sk.eyJ1IjoidGhlcGxhbmVtYWQiLCJhIjoiY2l3a2Jkazl1MDAwbjJvbXN1MXZzNXJwNyJ9.kNJ9l7CjEfQU4TfWnGpUFw'
    },
    source: {
      name: 'notes'
    },
    style: {
      label: '{name}',
      labelSize: 10,
      color: '#ff00ed',
      size: 10,
      opacity: 0.5,
      layers: null
    },
    showButton: true
  }, options);

  // API
  this._mapboxApi = new MapboxClient(this.options.mapbox.accessToken);
  this.toggle = this.toggle.bind(this);
  this.render = this.render.bind(this);
  this._toggle = new pluginButton({ show: this.options.showButton, onToggle: this.toggle.bind(this) });

  this._hide = this._hide.bind(this);
  this._show = this._show.bind(this);
  this._hasSource = this._hasSource.bind(this);

  this._openNote = this._openNote.bind(this);
  this._setNoteData = this._setNoteData.bind(this);
  this._setSourceLayersProperty = this._setSourceLayersProperty.bind(this);

  this._source = null;
  this._author = null;

  this._noteFeatureCollection = {
    'type': 'FeatureCollection',
    'features': []
  };
  this._noteFeature = {
    "type": "Feature",
    "properties": {},
    "geometry": {
      "coordinates": [],
      "type": "Point"
    }
  };;
}

MapboxNotes.prototype.onAdd = function (map) {
  this._map = map;
  map.on('load', this.render);
  // map.on('moveend', this._updateMap);
  return this._toggle.elem;
};

MapboxNotes.prototype.onRemove = function () {
  this._map.off('load', this.render);

  var elem = this._toggle.elem;
  elem.parentNode.removeChild(elem);
  this._map = undefined;
};

/**
 * Toggle the plugin
 */
MapboxNotes.prototype.toggle = function () {
  this.options.active = !this.options.active;
  this.render();
};

/**
 * Render the plugin elements
 */
MapboxNotes.prototype.render = function () {

  // Add the source and style layers if not already added
  if (!this._hasSource()) {
    this._map.addSource(this.options.source.name, {
      type: 'geojson',
      data: {
        "type": "FeatureCollection",
        "features": []
      }
    });
    this._source = this._map.getSource(this.options.source.name);

    // Compute where to insert the additional style layers
    var roadLayers = this._map.getStyle().layers.filter(function (layer) {
      return layer['source-layer'] === 'road';
    });
    var topRoadLayer = roadLayers[roadLayers.length - 1].id;

    // Build the style layers for the data
    if (!this.options.style.layers) {
      this.options.style.layers = buildStyleLayers(this.options.style);
    }
    // Add the style layers
    var style = this._map.getStyle();
    var mapStyle = addStyleLayers(style, this.options.style.layers, topRoadLayer);
    this._map.setStyle(mapStyle);
  }

  // Change plugin icon based on state
  if (this.options.active) {
    this._show();
    this._toggle.setMapIcon();
  } else {
    this._hide();
    this._toggle.setPluginIcon();
  }

};

// UI controls

// Create a button element
function button() {
  var btn = document.createElement('button');
  btn.className = 'mapboxgl-ctrl-icon mapboxgl-ctrl-notes';
  btn.type = 'button';
  btn['aria-label'] = 'Inspect';
  return btn;
}

// Plugin controls container
function container(button, show) {
  var container = document.createElement('div');
  container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
  container.appendChild(button);
  if (!show) {
    container.style.display = 'none';
  }
  return container;
}

// Create the plugin control
function pluginButton(options) {
  options = Object.assign({
    show: true,
    onToggle: function () { }
  }, options);

  this._btn = button(); // Plugin toggle button
  this._btn.onclick = options.onToggle;
  this.elem = container(this._btn, options.show);
}

pluginButton.prototype.setPluginIcon = function () {
  this._btn.className = 'mapboxgl-ctrl-icon mapboxgl-ctrl-notes';
};

pluginButton.prototype.setMapIcon = function () {
  this._btn.className = 'mapboxgl-ctrl-icon mapboxgl-ctrl-notes active';
};

// Plugin Active
MapboxNotes.prototype._show = function () {
  this._setSourceLayersProperty(/notes/, 'visible');
  this._setNoteData();
  this._map.on('click', this._openNote);
  this._map.doubleClickZoom.disable();
  this._map.on('dblclick', this._openNote);

  this._map.addLayer({
        'id': 'wms-test-layer',
        'type': 'raster',
        'source': {
            'type': 'raster',
            'tiles': [
                'http://a.tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            'tileSize': 256
        },
        'paint': {}
    }, 'aeroway-taxiway');
};

// Plugin deactivated
MapboxNotes.prototype._hide = function () {
  this._setSourceLayersProperty(/notes/, 'none');
  this._map.off('click', this._noteMode);
  this._map.doubleClickZoom.enable();
};

// Return true if source layers has been added already on first run
MapboxNotes.prototype._hasSource = function () {
  var style = this._map.getStyle();
  var source = /notes/;
  return Object.keys(style.sources).filter(function (sourceName) {
    return source.test(sourceName);
  }).length > 0;
};

MapboxNotes.prototype._setSourceLayersProperty = function (source, visibility) {
  var style = this._map.getStyle();
  style.layers.forEach(function (layer) {
    if (source.test(layer['source'])) {
      layer['layout'] = layer['layout'] || {};
      layer['layout']['visibility'] = visibility;
    }
  });
  this._map.setStyle(style);
}

/**
 * Define layers
 */
function buildStyleLayers(options) {
  var styleLayers = [
    {
      'id': 'notes circle',
      'type': 'circle',
      'source': 'notes',
      'paint': {
        'circle-color': options.color,
        'circle-radius': options.size,
        'circle-opacity': options.opacity
      }
    }, {
      'id': 'notes symbol',
      'type': 'symbol',
      'source': 'notes',
      'layout': {
        'text-field': options.label,
        'text-size': options.labelSize,
        "text-font": [
          "Open Sans Semibold", "Arial Unicode MS Bold"
        ],
        'text-anchor': 'top'
      }
    }
  ];
  return styleLayers;
}

// HTML note form
function buildForm(options) {

  var formHTML = [
    "<textarea class='textarea my3 bg-yellow-faint' rows='2' cols='50' placeholder='Notes'></textarea>",
    "<fieldset class='col--12 my3'><label id='reported'>Reported by:</label><input type='text' class='input input--s' name='author' placeholder='Your name'></input></fieldset>",
    "<div class='col--12 my3'><a class='btn' id='updateOverlayFeature' data-action='update' href='#'>Save</a><a id='deleteOverlayFeature' data-action='delete' class='link link--red fr my6' href='#'>Delete</a></div>",
  ]

  var noteForm = `<form id='mapbox-gl-notes-popup' class='grid w300'>${formHTML[0]}${formHTML[1]}${formHTML[2]}</form>`;

  return noteForm;
}

// Add style layers to the map
function addStyleLayers(style, layers, before) {

  for (var i = 0; i < style.layers.length; i++) {
    var layer = style.layers[i];
    if (before === layer.id) {
      var newLayers = style.layers.slice(0, i).concat(layers).concat(style.layers.slice(i));
      return Object.assign({}, style, { layers: newLayers });
    }
  }
  return style;
}

// Fetch data from a Mapbox dataset
MapboxNotes.prototype._setNoteData = function (startID) {

  // Configure Mapbox Dataset request. DOCS https://www.mapbox.com/api-documentation/?language=JavaScript#list-features
  var url = `https://api.mapbox.com/datasets/v1/${this.options.mapbox.dataset}/features`;
  var options = {
    'access_token': this.options.mapbox.accessToken,
    'start': startID || undefined,
    'limit': 10
  };

  var _this = this;

  // Download paginated geojson data from the Mapbox datasets API
  // TODO: this._mapboxApi.listFeatures(_this.options.mapbox.dataset.split('/')[1], params, function(err, data) {
  $.getJSON(url, options, function (data) {

    _this._noteFeatureCollection.features = _this._noteFeatureCollection.features.concat(data.features);


    // Request all pages 
    if (data.features.length == options.limit) {
      var lastFeatureID = data.features[data.features.length - 1].id;
      _this._setNoteData(lastFeatureID);
    }

    _this._source.setData(_this._noteFeatureCollection);

    // DEBUG: Downloaded notes from the datasets API
    // console.log(_this._noteFeatureCollection);

  });
}

// Open an existing note or create a new note
MapboxNotes.prototype._openNote = function (e) {

  // Check for loaded notes at clicked location
  if (e.type == 'click') {

    var notes = this._map.queryRenderedFeatures([
      [
        e.point.x - 5,
        e.point.y - 5
      ],
      [
        e.point.x + 5,
        e.point.y + 5
      ]
    ], { layers: ['notes circle'] });

    // Populate with data from existing note if available else only set the clicked location
    if (notes.length) {

      // Get the first note from the result and create a popup
      this._noteFeature = notes[0];
      var popup = new mapboxgl.Popup().setLngLat(e.lngLat).setHTML(buildForm()).addTo(this._map);

      // Now render the form UI with the values
      $("#mapbox-gl-notes-popup textarea").text(this._noteFeature.properties["name"]);

      // If previous author name is available
      if (this._noteFeature.properties["author"]) {
        $("#mapbox-gl-notes-popup #reported").append(`<span id='author' class='txt-code'>${this._noteFeature.properties["author"]}</span>`);
      }

      // Show note age
      let age = timeAgo(this._noteFeature.properties["timestamp"]);
      $("#mapbox-gl-notes-popup #reported").append(`<span class='fr'>${age}</span>`);
    }

    // Set author name if previously saved
    if (this._author) {
      $("input[name=author]").val(this._author);
    }
  }

  // Create a new note
  if (e.type == 'dblclick') {
    var popup = new mapboxgl.Popup().setLngLat(e.lngLat).setHTML(buildForm()).addTo(this._map);
    this._noteFeature.geometry.coordinates = e.lngLat.toArray();
  }

  var _this = this;
  // Get note properties from the form
  function getFormValues() {
    _this._noteFeature.properties["name"] = $("#mapbox-gl-notes-popup textarea").val();
    _this._author = $("input[name=author]").val();
    _this._noteFeature.properties["author"] = _this._author;
    _this._noteFeature.properties["timestamp"] = Date.now();
  }

  // Define handlers for the popup form
  if (popup) {

    updateNote = function () {

      // Get the action of clicked button
      var buttonAction = this.getAttribute('data-action');

      // DEBUG: Note properties
      console.log(_this._noteFeature);

      getFormValues();

      if (buttonAction == 'update') {
        // Upload note
        _this._mapboxApi.insertFeature(_this._noteFeature, _this.options.mapbox.dataset.split('/')[1], function (err, response) {
          console.log(response);
          _this._noteFeatureCollection.features = _this._noteFeatureCollection.features.concat(response);
          _this._source.setData(_this._noteFeatureCollection);
        });
      }
      if (buttonAction == 'delete') {
        // Push a note with a deleted=true property
        // _this._mapboxApi.deleteFeature(_this._noteFeature["id"], _this.options.mapbox.dataset.split('/')[1], function(err, response) {
        //   console.log(response);
        // });
        // Delete note from dataset
        _this._mapboxApi.deleteFeature(_this._noteFeature["id"], _this.options.mapbox.dataset.split('/')[1], function (err, response) {
          console.log(response);
        });
      }
      popup.remove();
    };

    // Update dataset with feature status on clicking save
    document.getElementById("updateOverlayFeature").onclick = updateNote;
    document.getElementById("deleteOverlayFeature").onclick = updateNote;
  }


}

// Export plugin
module.exports = MapboxNotes;
