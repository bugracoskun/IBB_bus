var BC = {};

// Configs
BC.config = {
  mapboxglAccessToken : 'pk.eyJ1IjoiYnVncmE5NiIsImEiOiJjazd1Y2phc2QwMDhrM2VtbWtzOHVtNjN4In0.jYnDbRwLXxh1S4Ni4-L8sg',
  mapStyle:'mapbox://styles/mapbox/dark-v10',
  zoom:8,
  center:[29.176,41.068],
  pitch:0,
  rotate:0,
  clientHeight:300,
  bus:[],
  lastIndex:0
};


mapboxgl.accessToken = BC.config.mapboxglAccessToken;
BC.config.clientHeight = document.getElementById('map').clientHeight;

BC.map = new mapboxgl.Map({
  container: 'map',
  hash:true,
  style: BC.config.mapStyle,
  antialias: true,
  pitchWithRotate:true,
  clickTolerance:5,
  preserveDrawingBuffer:true,
  zoom:BC.config.zoom,
  center:BC.config.center,
  pitch:BC.config.pitch,
  rotate:BC.config.rotate
});

// get Bus stops from API
BC.getPostData = function(){
  $.get("https://b9879cfcb1f5.ngrok.io/getstops", function(data, status){
    if(BC.map.getSource("stops")==undefined){
      BC.addGeojsonStops(data.data);
    }
  });
}

// when map load get Bus stops
BC.map.on('load', function () {
  BC.getPostData();
})

// add Bus stops with image
BC.addGeojsonStops=function(data){
  BC.map.loadImage(
    '../src/img/bus_stop.png',
    function (error, image) {
      if (error) throw error;
      BC.map.addImage('busstop',image);

      BC.map.addSource('stops', {
        'type': 'geojson',
        'data': data
      });
    
      BC.map.addLayer({
        'id': 'stops-point',
        'source': 'stops',
        'type': 'symbol',
        'layout': {
          'icon-image': 'busstop',
          'icon-size': 0.1
        }
      });
    }
  )
  
}

// Click event on map
BC.map.on('click', function (e) {
  if(BC.map.getSource('stops')){
    var features = BC.map.queryRenderedFeatures(e.point, { layers: ['stops-point'] });

    if (!features.length) {
        return;
    }
  
    var feature = features[0]; // bus stop
    var coords=feature.geometry.coordinates;
    BC.map.setCenter([coords[0], coords[1]]);
    BC.map.setZoom(15);
    myfooter.$children[0].open(); // go to timeline
  
    // Show popup
    var popup = new mapboxgl.Popup()
        .setLngLat(feature.geometry.coordinates)
        .setHTML(feature.properties.SDURAKADI)
        .addTo(BC.map);
  }
});

// Addgeojson to layer
BC.addGeojsonToData=function(props){
  if(BC.map.getSource(props.id)==undefined){
    BC.map.addSource(props.id, {
      'type': 'geojson',
      'data': props.data
    });
  
    BC.map.addLayer({
      'id': props.id+'-point',
      'source': props.id,
      'type': 'circle',
      'paint': {
        'circle-radius': 10,
        'circle-color': '#007cbf'
      },
      'filter': ['==', '$type', 'Point']
    });
  
    BC.map.addLayer({
      'id': props.id+'-polygon',
      'type': 'fill',
      'source': props.id, 
      'layout': {},
      'paint': {
      'fill-color': '#0080ff', 
      'fill-opacity': 0.5
      },
      'filter': ['==', '$type', 'Polygon']
    });
    
    BC.map.addLayer({
      'id': props.id+"-line",
      'type': 'line',
      'source': props.id,
      'layout': {},
      'paint': {
        'line-color': '#2c1bcc',
        'line-width': 9,
        'line-opacity': 0.7
      },
      'filter': ['==', '$type', 'LineString']
    });
  }else{
    BC.removeLayerById(props.id);
    BC.config.bus=[];
    BC.addGeojsonToData(props);
    myfooter.$children[0].clearValues();
  }
  
}

// remove a layer by id
BC.removeLayerById=function(id){
  if (BC.map.getLayer(id+"-point")) {
    BC.map.removeLayer(id+"-point");
  }
  if (BC.map.getLayer(id+"-line")) {
    BC.map.removeLayer(id+"-line");
  }
  if (BC.map.getLayer(id+"-polygon")) {
    BC.map.removeLayer(id+"-polygon");
  }

  BC.map.removeSource(id);
}

// GEt a feat by index
BC.findFeat=function(index){
  for(var i=0;BC.config.bus.length;i++){
    if(BC.config.bus[i].properties.index==index){
      return BC.config.bus[i]
    }
  }
}

// REfresh bus layer
BC.refreshBusLayer=function(){
  var geojson={"type": "FeatureCollection","features": []}
  var features = BC.config.bus;

  for(var i=0;i<features.length;i++){
    geojson.features.push(features[i]);
  }
  BC.map.getSource('bus').setData(geojson);
}

// Delete a feature by id
BC.deleteFeatById=function(index){
  var features = BC.config.bus;
  for(var i=0;i<features.length;i++){
    if(features[i].properties.index==index){
      features.splice(i,1);
      BC.refreshBusLayer();
    }
  }
}

// clear feats data
BC.spliceRemoveFeats=function(){
  var features = BC.config.bus;
  for(var i=0;i<features.length;i++){
    features[i].properties.splice_data=[];
    features[i].properties.start="";
    features[i].properties.finish="";
  }
}

// Time converter
BC.convertTime=function(time){
  var hours1 = Math.floor(time / 60);
  var minutes1 = (time - (hours1 * 60)).toFixed(2);

  if (hours1.length == 1) hours1 = '0' + hours1;
  if (minutes1.length == 1) minutes1 = '0' + minutes1;
  if (minutes1 == 0) minutes1 = '00';
  if (hours1 >= 12) {
      if (hours1 == 12) {
          hours1 = hours1;
          minutes1 = minutes1 + " PM";
      } else {
          hours1 = hours1 - 12;
          minutes1 = minutes1 + " PM";
      }
  } else {
      hours1 = hours1;
      minutes1 = minutes1 + " AM";
  }
  if (hours1 == 0) {
      hours1 = 12;
      minutes1 = minutes1;
  }


  var text=hours1 + ':' + minutes1;
  return text
}