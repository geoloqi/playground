var People = {

  setup: function(map_element) {
    $.ajaxSetup({timeout:15000});
    People.map = People.setup_map(map_element);
    var peepso = new PeepsOverlay();
    peepso.setMap(People.map);
  
    $('#gmapIconTemplate').template("gmapIcon");
    $('#userWidgetTemplate').template("userWidget");

    People.user_list_setup($("#followers"));
    People.follow_users();
  },
  
  setup_map: function (map_element) {
    map_element.css('height:'+window.innerHeight+'px');

    // initial map center
    var last = {lat: 45.5, lng: -122.65};
  
    var latlng = new google.maps.LatLng(last.lat, last.lng);
    var myOptions = {
      zoom: 14,
      center: latlng,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };
  
    return new google.maps.Map(map_element[0], myOptions);
  },
  
  user_list_load: function (user_list_url, followers_element) {
    $.ajax({
      url: user_list_url,
      success: People.user_list_loaded,
    });
  },
  
  user_list_loaded: function (data) {
  },
  
  user_list_setup: function (listhtml) {
    for(var i in Users){
      var user = Users[i];
      user.marker = [];
      var userhtml = People.user_widget(user);
      listhtml.append(userhtml);
      userhtml.find('.count').html(user.marker.length);
      userhtml.find('.gravatar,.username').click(function(user){
          return function(){
          if(user.marker.length > 0) {
            People.map.panTo(user.marker[user.marker.length-1]);
          }
        }}(user));
    }
  },
  
  map_usermarker: function(user) {
    var panel = $.tmpl("gmapIcon", {gravatar_url:People.gravatar(user.email,30)});
    panel.attr('id', 'infopanel_'+user.username);
    return panel;
  },

  user_widget: function(user) {
    var panel = $.tmpl("userWidget", 
                   { gravatar_url: People.gravatar(user.email,35),
                     service_icon_url: user.service.type+".png",
                     username: user.username });
    panel.attr('id', user.username);
    return panel;
  },

  follow_users: function () {
    for(var i in Users){
      var user = Users[i];

      People.update_location(user);
  
      setInterval(function(user){
        return function(){People.update_location(user)}}(user)
      , 1000*60);
    }
  },
  
  update_location: function (user){
    var me = $('#'+user.username+'_update');
    me.html(me.html()+' (refreshing)');
    People.service_update(user.service.type, user);
  },

  service_update: function(service_type, user) {
    var url, parser;
    if(service_type == "icecondor") {
      url = "http://icecondor.com/locations.jsonp?id="+user.service.id+"&limit=1&callback=?";
      parser = People.icecondor_update;
    } 
    if(service_type == "geoloqi") {
      url = "https://api.geoloqi.com/1/share/last?geoloqi_token="+user.service.id+"&callback=?";
      parser = People.geoloqi_update;
    }
    if(service_type == "latitude") {
      //url = "http://www.google.com/latitude/apps/badge/api?user="+user.service.id+"&type=json";
      url = "http://jsonpify.heroku.com?resource=http://www.google.com/latitude/apps/badge/api%3Fuser="+user.service.id+"%26type=json&callback=?";
      parser = People.latitude_update;
    }
    if(service_type == "instamapper") {
      url = 'https://www.instamapper.com/api?action=getPositions&key='+user.service.id+'&format=json&jsoncallback=?'
      parser = People.instamapper_update;
    }
    $.getJSON(url, function(json){parser(json, Users, user, People.map)});
  },

  latitude_update: function(json,users,user,map) {
    var me = $('#'+user.username+'_update');
    var myLatLng = new google.maps.LatLng(json.features[0].geometry.coordinates[1], 
                                          json.features[0].geometry.coordinates[0]);
    user.last_date = new Date(json.features[0].properties.timeStamp*1000);
    People.finish_update(user, myLatLng);
  },

  instamapper_update: function(json,users,user,map) {
    var me = $('#'+user.username+'_update');
    var myLatLng = new google.maps.LatLng(json[0].location.geom.y, 
                                          json[0].location.geom.x);
    user.last_date = (new Date()).setISO8601(json[0].location.created_at);
    People.finish_update(user, myLatLng);
  },

  icecondor_update: function(json,users,user,map) {
    var me = $('#'+user.username+'_update');
    var myLatLng = new google.maps.LatLng(json[0].location.geom.y, 
                                          json[0].location.geom.x);
    user.last_date = (new Date()).setISO8601(json[0].location.timestamp);
    People.finish_update(user, myLatLng);
  },

  geoloqi_update: function(json,users,user,map) {
    var myLatLng = new google.maps.LatLng(json.location.position.latitude, 
                                          json.location.position.longitude);
    user.last_date = new Date(json.date_ts*1000);
    if(typeof(json.raw.battery)!="undefined") {
      var me = $('#'+user.username+' .battery');
      me.find('.text').html(json.raw.battery+'% batt');
      me.show();
    }
    People.finish_update(user, myLatLng);
  },

  finish_update: function(user, latLng) {
    People.map.panTo(latLng);
    user.marker.push(latLng);
    var me = $('#'+user.username+' .time .text');
    me.fadeOut();
    me.html(People.time_ago(user.last_date));
    me.fadeIn();
    People.sort_by_last_time(user);
  },

  sort_by_last_time: function (user) {
    $('#'+user.username+' .count').html(user.marker.length);

    if (Users.length < 2) { return; }
    var winner = null;

    for(var i in Users){
      var u = Users[i];
      if (user.username != u.username && typeof(u.last_date)!="undefined") {
        if(u.last_date < user.last_date) {
          if(winner == null || winner.last_date < u.last_date) {
            winner = u;
          }
        }
      }
    }

    if(winner != null) {
      $('#followers').remove($('#'+user.username));
      $('#'+winner.username).before($('#'+user.username));
    }
  },

  time_ago: function(date) {
    var unit = "seconds";
    var value = ((new Date()) - date) / 1000;
    if (unit == "seconds" && value > 60) { unit = "minutes"; value = value / 60; }
    if (unit == "minutes" && value > 60) { unit = "hours"; value = value / 60; }
    if (unit == "hours" && value > 24) { unit = "days"; value = value / 24; }
    value = Math.floor(value);
    return  value+' '+unit;
  },

  gravatar: function(email,size) {
    return "http://gravatar.com/avatar/"+MD5_hexhash(email)+"?s="+size;
  },

  userfind: function(username) {
    for(var i=0; i < Users.length; i++) {
      if(Users[i].username == username) {
        return Users[i];
      }
    }
  }
}

/* ISO 8601 date format helper */
Date.prototype.setISO8601 = function(dString){
  var regexp = /(\d\d\d\d)(-)?(\d\d)(-)?(\d\d)(T)?(\d\d)(:)?(\d\d)(:)?(\d\d)(\.\d+)?(Z|([+-])(\d\d)(:)?(\d\d))/;
  var d = dString.toString().match(new RegExp(regexp));
  if (d) {
    var offset = 0;
    this.setUTCDate(1);
    this.setUTCFullYear(parseInt(d[1],10));
    this.setUTCMonth(parseInt(d[3],10) - 1);
    this.setUTCDate(parseInt(d[5],10));
    this.setUTCHours(parseInt(d[7],10));
    this.setUTCMinutes(parseInt(d[9],10));
    this.setUTCSeconds(parseInt(d[11],10));
    if (d[12])
      this.setUTCMilliseconds(parseFloat(d[12]) * 1000);
    else
      this.setUTCMilliseconds(0);
    if (d[13] != 'Z') {
      offset = (d[15] * 60) + parseInt(d[17],10);
      offset *= ((d[14] == '-') ? -1 : 1);
      this.setTime(this.getTime() - offset * 60 * 1000);
    }
  } else {
    this.setTime(Date.parse(dString));
  }
  return this;
};

/* google maps overlay */
var PeepsOverlay  = function() {
  google.maps.OverlayView.call(this);
}

PeepsOverlay.prototype = new google.maps.OverlayView();

PeepsOverlay.prototype.onAdd = function() {
  var pane = this.getPanes().overlayImage;
  for(var i in Users){
    var user = Users[i];
    $(pane).append(People.map_usermarker(user));
  }
};

PeepsOverlay.prototype.draw = function() {
  for(var i in Users){
    var user = Users[i];
    var panel = $('#infopanel_'+user.username);
    var new_x, new_y;
    panel.css("position","absolute");
    if(user.marker.length > 0) {
      var point = this.getProjection().fromLatLngToDivPixel(user.marker[user.marker.length-1]);
      new_x = point.x-(panel.width()/2);
      new_y = point.y-panel.height();
      for(var i=0; i < user.marker.length; i++) {
        var point = this.getProjection().fromLatLngToDivPixel(user.marker[i]);
      }
    } else {
      new_x = -50
      new_y = -50;
    }
    panel.css("left",new_x+"px");
    panel.css("top",new_y+"px");
  }
};

PeepsOverlay.prototype.onRemove = function() {
};

