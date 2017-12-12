/**
 * A [Mapbox GL JS plugin](https://www.mapbox.com/blog/build-mapbox-gl-js-plugins/) that allows you to
 * Add annotations to your Mapbox map via the Mapbox Datasets API
 * @constructor
 * @param {object} options - Options to configure the plugin.
*/

// Mapbox Notes
// based on github.com/mapbox/mapbox-gl-traffic/blob/master/mapbox-gl-traffic.js

var MapboxClient = require('mapbox/lib/services/datasets');

function MapboxNotes(options) {
  if (!(this instanceof MapboxNotes)) {
    throw new Error('MapboxNotes needs to be called with the new keyword');
  }

  this.options = Object.assign({
    enabled: false,
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
  this._saveData = this._saveData.bind(this);

  this._source = null;
  this._noteData = {
    'type': 'FeatureCollection',
    'features': []
  };
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
  this.options.enabled = !this.options.enabled;
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
  if (this.options.enabled) {
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
  this._btn.className = 'mapboxgl-ctrl-icon mapboxgl-ctrl-map';
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

      _this._noteData.features = _this._noteData.features.concat(data.features);
      var lastFeatureID = data.features[data.features.length - 1].id;
      _this._fetchData(lastFeatureID);
    }
    _this._source.setData(_this._noteData);
  });
}

MapboxNotes.prototype._saveData = function() {}
MapboxNotes.prototype._noteMode = function(e) {
  console.log('shoot');

  var newOverlayFeature = {
    "type": "Feature",
    "properties": {},
    "geometry": {
      "coordinates": [],
      "type": "Point"
    }
  };

  var _this = this;

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

  if (clickedLayerFeatures.length) {
    overlayFeatureForm(clickedLayerFeatures[0]);

  } else {
    overlayFeatureForm();
  }

  // Popup
  function overlayFeatureForm(feature) {
    var formOptions = "<div class='radio-pill pill pad1y clearfix'><input id='safe' type='radio' name='review' value='safe' checked='checked'><label for='safe' class='short button icon check fill-green'>Safe</label><input id='unsafe' type='radio' name='review' value='unsafe'><label for='unsafe' class='short button icon check fill-red'>Danger</label></div>";
    var formReviewer = "<fieldset><label>Reported by: <span id='reviewer' style='padding:5px;background-color:#eee'></span></label><input type='text' name='reviewer' placeholder='name'></input></fieldset>"
    var popupHTML = "<form>" + formOptions + formReviewer + "<a id='updateOverlayFeature' class='button col4' href='#'>Save</a><a id='deleteOverlayFeature' class='button quiet fr col4' href='#' style=''>Delete</a></form>";
    var popup = new mapboxgl.Popup().setLngLat(e.lngLat).setHTML(popupHTML).addTo(_this._map);

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
      _this._mapboxApi.insertFeature(newOverlayFeature, _this.options.mapbox.dataset.split('/')[1], function(err, response) {
        console.log(response);
        _this._noteData.features = _this._noteData.features.concat(response);
        _this._source.setData(_this._noteData);
      });
    };
    // Delete feature on clicking delete
    document.getElementById("deleteOverlayFeature").onclick = function() {
      popup.remove();
      _this._mapboxApi.deleteFeature(newOverlayFeature["id"], _this.options.mapbox.dataset.split('/')[1], function(err, response) {
        console.log(response);
      });
    };
  }

}

// Export plugin
module.exports = MapboxNotes;
