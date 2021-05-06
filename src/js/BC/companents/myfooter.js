Vue.component('myfooter', {
	data:function(){
		return this.setDefault();
  },
  methods:{
      setDefault:function(){
          // Inputs
          return {
              onoff:true,
              businput:0,
              distance:0,
              total_time:30,
              data:"",
              play:false,
              disable:true,
              start:"",
              finish:"",
              counter: 0,
              steps: 25,
              first_poi:null
          }
      },
      open:function(){
        var that=this;
        this.onoff = true;
        this.disable=false;

        $.get( "src/files/route.geojson", function( data ) {
          BC.addGeojsonToData({id:"route",data:data});
          var firstPoi = data.features[0].geometry.coordinates[0];
          that.first_poi = turf.point(firstPoi);
          that.distance = turf.length(data, {units: 'meters'});
          that.data=data;
          that.addBus(6);
        });
      },
      close:function(e){
        this.onoff = false;
      },
      // Clear Values
      clearValues:function(){
        this.businput=0;
        this.distance=0;
        this.total_time=30;
        this.data="";
        this.play=false;
        this.disable=false;
        this.start="";
        this.finish="";
        this.counter= 0;
        this.steps= 25;
      },
      // add bus if needed
      addBus:function(number){
        var that=this;

        for(var i=0;i<number;i++){
          var poi = JSON.parse(JSON.stringify(that.first_poi));
          poi.properties["index"]=BC.config.lastIndex;
          poi.properties["x"]=0;
          poi.properties["num"]=BC.config.bus.length;
          poi.properties["status"]=true;
          poi.properties["start"]="";
          poi.properties["finish"]="";
          poi.properties["splice_data"]=[];
  
          BC.config.lastIndex=BC.config.lastIndex+1;
          //add Layer
          if(BC.map.getSource("bus")==undefined){
            BC.addGeojsonToData({id:"bus",data:poi});
            BC.config.bus.push(poi)
          }else{
            var geojson={"type": "FeatureCollection","features": []}
            var features = BC.config.bus;
            for(var i=0;i<features.length;i++){
              geojson.features.push(features[i]);
            }
  
            BC.config.bus.push(poi);
            geojson.features.push(poi);
            BC.map.getSource('bus').setData(geojson);
          }
        }
      },
      // calculating distance per bus
      calculateBus:function(){
        this.businput=Number(this.businput);
        
        var features = BC.config.bus;
        for(var i=0;i<features.length;i++){
          //Time Control
          var new_businput = Number(this.businput) - 10*features[i].properties.num;

          if(new_businput>this.total_time){
            var times = Math.floor(new_businput / this.total_time);
            var businput=new_businput % this.total_time;
          }else{
            var times = 0;
            var businput=new_businput;
          }

          // Animation on
          if(this.play){
            if(times !=0){
              if(times % 2 ==0){
                var x = (this.distance/this.total_time)*(Number(businput)+1);
              }else{
                var x = (this.distance/this.total_time)*(Number(businput)+1);
                x= this.distance-x;
              }
            }else{
              var x = (this.distance/this.total_time)*(Number(businput)+1);
            }
          
          // Animation off
          }else{
            if(times !=0){
              if(times % 2 ==0){
                var x = (this.distance/this.total_time)*businput;
              }else{
                var x = (this.distance/this.total_time)*businput;
                x= this.distance-x;
              }
            }else{
              var x = (this.distance/this.total_time)*businput;
            }
            this.counter=0;
          }

          // Set status
          if(x<=0){
            features[i].properties.status=false;
          }else{
            features[i].properties.status=true;
          }

          features[i].properties.x=x;
        }
        this.setBusPosition(features);
      },
      // set bus locations
      setBusPosition:function(feats){
        //debugger;
        if(this.data!=""){
          for(var j=0;j<feats.length;j++){
            if(feats[j].properties.status){
              if(feats[j].properties.x==0){
                feats[j].properties.x=1;
              }
  
              var along = turf.along(this.data.features[0], feats[j].properties.x, {units: 'meters'});
  
              feats[j].properties.start=turf.point(feats[j].geometry.coordinates);
              feats[j].properties.finish=along;
  
              var f = BC.findFeat(feats[j].properties.index);
  
              f.geometry.coordinates = along.geometry.coordinates;
            }
          }

          // Animation off
          if(this.play==false){
            BC.refreshBusLayer();
          }else{ // Animation on
            for(var k=0;k<feats.length;k++){
              if(feats[k].properties.status){
                // Splice data into steps
                var linestring2 = turf.lineString([feats[k].properties.start.geometry.coordinates,feats[k].properties.finish.geometry.coordinates]);
                var len = turf.length(linestring2, {units: 'meters'});
                for (var i = 0; i < len; i += len / this.steps) {
                  var segment = turf.along(linestring2, i, {units: 'meters'});
                  feats[k].properties.splice_data.push(segment.geometry.coordinates);
                }
              }
            }
          }
        }
      },
      // Animation start
      playAnimation:function(){
        var that=this;
        this.play=true;
        this.disable=true;
        this.counter=0;
        BC.spliceRemoveFeats();
        
        that.calculateBus();
        that.animatePoint();
      },
      stopAnimation:function(){
        this.play=false;
        this.disable=false;
      },
      // Animate Bus on map
      animatePoint:function(){
        var that=this;
        if(that.play==false){
          return
        }
        
        // If counter equals to steps then stop animation
        if (that.counter==that.steps){
          // end of the day
          if(that.businput>=1440){
            that.stopAnimation();
            return
          }
          that.stopAnimation();
          that.playAnimation();
          return
        }
        
        that.businput = (Number(that.businput)+0.04).toFixed(3);

        // setCoordinates
        for(var i=0;i<BC.config.bus.length;i++){  
          if(BC.config.bus[i].properties.status){
            BC.config.bus[i].properties.start.geometry.coordinates = BC.config.bus[i].properties.splice_data[that.counter];
            BC.config.bus[i].geometry.coordinates = turf.nearestPointOnLine(that.data.features[0], BC.config.bus[i].properties.start, {units: 'meters'}).geometry.coordinates;
          }
        }
        
        BC.refreshBusLayer(); // refresh layer

        // next frame
        if (that.counter <= that.steps) {
          requestAnimationFrame(that.animatePoint);
        }
        
        that.counter = that.counter + 1;
      }
  },
  template:
  '<div v-if="onoff">'+
      '<div style="width: 100%; text-align: center; padding-top: 10px;">'+
        '<label id="num">{{BC.convertTime(businput)}}</label><br>'+
        '<input v-model="businput" @input="calculateBus" style="width: 80% !important;" type="range" class="form-range" min="0" max="1440" step="0.04" :value=businput id="customRange" :disabled="disable == true">'+
        
        
        '<div>'+
          '<button v-if="play==false" @click="playAnimation" id="play_button" class="ui green icon button" :disabled="disable == true">'+
            '<i class="play icon"></i>'+
          '</button>'+
          '<button v-if="play==true" @click="stopAnimation" id="play_button" class="ui red icon button">'+
            '<i class="pause icon"></i>'+
          '</button>'+
        '</div>'+
      '</div>'+
  '</div>'
  });

var myfooter = new Vue({ el: '#myfooter' });