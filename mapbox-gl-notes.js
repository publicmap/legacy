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
  this._toggle = new pluginButton({show: this.options.showButton, onToggle: this.toggle.bind(this)});

  this._hide = this._hide.bind(this);
  this._show = this._show.bind(this);
  this._hasSource = this._hasSource.bind(this);

  this._noteMode = this._noteMode.bind(this);
  this._fetchData = this._fetchData.bind(this);
  this._openNote = this._openNote.bind(this);

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

MapboxNotes.prototype.onAdd = function(map) {
  this._map = map;
  map.on('load', this.render);
  // map.on('moveend', this._updateMap);
  return this._toggle.elem;
};

MapboxNotes.prototype.onRemove = function() {
  this._map.off('load', this.render);

  var elem = this._toggle.elem;
  elem.parentNode.removeChild(elem);
  this._map = undefined;
};

/**
 * Toggle the plugin
 */
MapboxNotes.prototype.toggle = function() {
  this.options.active = !this.options.active;
  this.render();
};

/**
 * Render the plugin elements
 */
MapboxNotes.prototype.render = function() {

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
    var roadLayers = this._map.getStyle().layers.filter(function(layer) {
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
    onToggle: function() {}
  }, options);

  this._btn = button(); // Plugin toggle button
  this._btn.onclick = options.onToggle;
  this.elem = container(this._btn, options.show);
}

pluginButton.prototype.setPluginIcon = function() {
  this._btn.className = 'mapboxgl-ctrl-icon mapboxgl-ctrl-notes';
};

pluginButton.prototype.setMapIcon = function() {
  this._btn.className = 'mapboxgl-ctrl-icon mapboxgl-ctrl-notes active';
};

// Show layers
MapboxNotes.prototype._show = function() {
  var style = this._map.getStyle();
  var source = /notes/;
  style.layers.forEach(function(layer) {
    if (source.test(layer['source'])) {
      layer['layout'] = layer['layout'] || {};
      layer['layout']['visibility'] = 'visible';
    }
  });
  this._map.setStyle(style);
  this._fetchData();
  this._map.on('click', this._noteMode);
};

// Hide layers that have the target source
MapboxNotes.prototype._hide = function() {
  var style = this._map.getStyle();
  var source = /notes/;
  style.layers.forEach(function(layer) {
    if (source.test(layer['source'])) {
      layer['layout'] = layer['layout'] || {};
      layer['layout']['visibility'] = 'none';
    }
  });
  this._map.setStyle(style);
  this._map.off('click', this._noteMode);
};

// Return true if source layers has been added already on first run
MapboxNotes.prototype._hasSource = function() {
  var style = this._map.getStyle();
  var source = /notes/;
  return Object.keys(style.sources).filter(function(sourceName) {
    return source.test(sourceName);
  }).length > 0;
};

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
    "<div class='col--12 my3'><input id='open' type='radio' name='review' value='open' checked='checked'><label class='btn--s btn--green' for='open'>Open</label><input id='closed' type='radio' name='review' value='closed'><label class='btn--s btn--red' for='closed'>Closed</label></div>",
    "<textarea class='textarea my3' rows='2' cols='50' placeholder='Notes'></textarea>",
    "<fieldset class='col--12 my3'><label id='reported'>Reported by:</label><input type='text' class='input input--s' name='author' placeholder='Your name'></input></fieldset>",
    "<div class='col--12 my3'><a class='btn' id='updateOverlayFeature' href='#'>Save</a><a id='deleteOverlayFeature' class='link link--red fr my6' href='#'>Delete</a></div>",
  ]

 var noteForm = `<form id='mapbox-gl-notes-popup' class='grid w300'>${formHTML[0]}${formHTML[1]}${formHTML[2]}${formHTML[3]}</form>`;

  return noteForm;
}

// Add style layers to the map
function addStyleLayers(style, layers, before) {

  for (var i = 0; i < style.layers.length; i++) {
    var layer = style.layers[i];
    if (before === layer.id) {
      var newLayers = style.layers.slice(0, i).concat(layers).concat(style.layers.slice(i));
      return Object.assign({}, style, {layers: newLayers});
    }
  }
  return style;
}

// Fetch data from a Mapbox dataset
MapboxNotes.prototype._fetchData = function(startID) {

  var url = `https://api.mapbox.com/datasets/v1/${this.options.mapbox.dataset}/features`;
  var params = {
    'access_token': this.options.mapbox.accessToken
  };

  // Begin with the last feature of previous request
  if (startID) {
    params.start = startID;
  }

  var _this = this;

  // Download the geojson from the dataset
  $.getJSON(url, params, function(data) {

    if (data.features.length) {

      data.features.forEach(function(feature) { // Add dataset feature id as a property
        feature.properties.id = feature.id;
      });

      _this._noteFeatureCollection.features = _this._noteFeatureCollection.features.concat(data.features);
      var lastFeatureID = data.features[data.features.length - 1].id;
      _this._fetchData(lastFeatureID);
    }
    _this._source.setData(_this._noteFeatureCollection);
  });
}

MapboxNotes.prototype._openNote = function(notes, location) {

  // Create a popup form at the location
  var popup = new mapboxgl.Popup().setLngLat(location.lngLat).setHTML(buildForm()).addTo(this._map);

  // Populate with data from existing note if available else only set the clicked location
  if (notes.length) {
    this._noteFeature = notes[0];   // Get the first note from the result
    this._noteFeature["name"] = this._noteFeature.properties["name"];
    this._noteFeature["id"] = this._noteFeature.properties["id"];
    $("#mapbox-gl-notes-popup input[name=review][value=" + this._noteFeature.properties["key"] + "]").prop('checked', true);
    $("#mapbox-gl-notes-popup textarea").text(this._noteFeature.properties["name"]);
    
    // If previous author name is available
    if (this._noteFeature.properties["author"]){
      $("#mapbox-gl-notes-popup #reported").append(`<span id='author' class='txt-code'>${this._noteFeature.properties["author"]}</span>`);
    }

    let age = timeAgo(this._noteFeature.properties["timestamp"]);
    $("#mapbox-gl-notes-popup #reported").append(`<span class='fr'>${age}</span>`);
  
  } else {
    this._noteFeature.geometry.coordinates = location.lngLat.toArray();
  }
  // Set author name if previously saved
  if (this._author) {    
    $("input[name=author]").val(this._author);
  }

  console.log(this._noteFeature);
  var _this = this;

  // Update dataset with feature status on clicking save
  document.getElementById("updateOverlayFeature").onclick = function() {

    // Update note properties from the form
    _this._noteFeature.properties["name"] = $("#mapbox-gl-notes-popup textarea").val();
    _this._noteFeature.properties["key"] = $("input[name=review]:checked").val();
    _this._author = $("input[name=author]").val();
    _this._noteFeature.properties["author"] = _this._author;
    _this._noteFeature.properties["timestamp"] = Date.now();
    popup.remove();

    // Upload note
    _this._mapboxApi.insertFeature(_this._noteFeature, _this.options.mapbox.dataset.split('/')[1], function(err, response) {
      console.log(response);
      _this._noteFeatureCollection.features = _this._noteFeatureCollection.features.concat(response);
      _this._source.setData(_this._noteFeatureCollection);
    });
  };

  // Delete feature on clicking delete
  document.getElementById("deleteOverlayFeature").onclick = function() {
    popup.remove();
    // Push a note with a deleted=true property
    _this._mapboxApi.deleteFeature(_this._noteFeature["id"], _this.options.mapbox.dataset.split('/')[1], function(err, response) {
      console.log(response);
    });
    // Delete note from dataset
    _this._mapboxApi.deleteFeature(_this._noteFeature["id"], _this.options.mapbox.dataset.split('/')[1], function(err, response) {
      console.log(response);
    });
  };

}

MapboxNotes.prototype._noteMode = function(e) {

  var newOverlayFeature = {
    "type": "Feature",
    "properties": {},
    "geometry": {
      "coordinates": [],
      "type": "Point"
    }
  };

  var _this = this;

  // Check for notes at clicked location
  var clickedLayerFeatures = this._map.queryRenderedFeatures([
    [
      e.point.x - 5,
      e.point.y - 5
    ],
    [
      e.point.x + 5,
      e.point.y + 5
    ]
  ], {layers: ['notes circle']});



  // Popup
  this._openNote(clickedLayerFeatures, e);



}

// Export plugin
module.exports = MapboxNotes;
