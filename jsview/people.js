var Util = function() {
  // Cookie functions swiped from http://www.quirksmode.org/js/cookies.html
  function writeCookie(name,value,days) {
    var expires;
    if (days) {
      var date = new Date();
      date.setTime(date.getTime()+(days*24*60*60*1000));
      expires = "; expires="+date.toGMTString();
    } else {
      expires = "";
    }
    document.cookie = name+"="+value+expires+"; path=/";
  }

  function readCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(var i=0;i < ca.length;i++) {
      var c = ca[i];
      while (c.charAt(0)==' ') { c = c.substring(1,c.length); }
      if (c.indexOf(nameEQ) === 0) { return c.substring(nameEQ.length,c.length); }
    }
    return null;
  }

  function eraseCookie(name) {
    createCookie(name,"",-1);
  }

  function writeJsonCookie(name, obj, days) {
    var json = escape(JSON.stringify(obj));
    this.writeCookie(name, json, days);
  }

  function readJsonCookie(name) {
    var raw = this.readCookie(name);
    var data = null;
    if(raw) {
      data = JSON.parse(unescape(raw));
    }
    return data;
  }

  return({
    writeCookie: writeCookie,
    readCookie: readCookie,
    eraseCookie: eraseCookie,
    writeJsonCookie: writeJsonCookie,
    readJsonCookie: readJsonCookie
  });
}();

var TriMet = {
  routes : {},
  parseRoute: function(data, textStatus, jqXHR) {
    var west = data.features[0];
    var east = data.features[1];
    var routename = data.features[0].properties.RTE;
    this.routes[routename] = data
  }
}

var People = {

  setup: function(map_element) {
    this.setup_options();
    $.ajaxSetup({timeout:15000});
    People.map = People.setup_map(map_element);
    this.peepso = new PeepsOverlay();
    this.peepso.setMap(People.map);
  
    $('#gmapIconTemplate').template("gmapIcon");
    $('#userWidgetTemplate').template("userWidget");

    People.user_list_setup($("#followers"));
    People.follow_users();
  },

  setup_options: function() {
    this.load_options();
    $('#panMapCheckbox').change( jQuery.proxy(this.options_changed, this) );
    this.options_changed();
  },

  load_options: function() {
    this.options = Util.readJsonCookie('options') || {};
    if(this.options.panMap === false) {
      $('#panMapCheckbox').removeAttr('checked');
    }
  },

  save_options: function() {
    Util.writeJsonCookie('options', this.options);
  },

  options_changed: function() {
    this.options.panMap = $('#panMapCheckbox').is(':checked');
    this.save_options();
  },
  
  setup_map: function (map_element) {
    // initial map center
    var last = {lat: 45.5, lng: -122.65};
  
    var latlng = new google.maps.LatLng(last.lat, last.lng);
    var myOptions = {
      zoom: 14,
      center: latlng,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      mapTypeControl: false,
      streetViewControl: false,
      zoomControl: true,
      zoomControlOptions: {position: google.maps.ControlPosition.TOP_RIGHT},
      panControl: false
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
                     service_type: user.service.type,
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
    var time_element = $('#'+user.username+' .time');
    time_element.addClass('spinning');
    People.start_update(user.service.type, user);
  },

  start_update: function(service_type, user) {
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
    if(service_type == "trimet") {
      var components = user.service.id.split(";")
      var line = components[0], stop = components[1];
      
      url = 'http://developer.trimet.org/ws/V1/routeConfig?appID='+Auth['trimet']+'&route='+line+'&dir=1&stops=1&tp=1&json=true&callback=?'
      parser = People.trimet_update;
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
    if(typeof(json[0].location.batterylevel)!="undefined") {
      var battery_element = $('#'+user.username+' .battery');
      battery_element.html(json[0].location.batterylevel+'% batt');
      battery_element.show();
    }
    People.finish_update(user, myLatLng);
  },

  geoloqi_update: function(json,users,user,map) {
    var myLatLng = new google.maps.LatLng(json.location.position.latitude, 
                                          json.location.position.longitude);
    user.last_date = new Date(json.date_ts*1000);
    if(typeof(json.raw.battery)!="undefined") {
      var battery_element = $('#'+user.username+' .battery');
      battery_element.html(json.raw.battery+'% batt');
      battery_element.show();
    }
    People.finish_update(user, myLatLng);
  },

  trimet_update: function(json,users,user,map) {
    var routes = json.resultSet;
    TriMet.routes[routes.route[0].route] = routes;
    
    var stops = [];
    routes.route[0].dir[0].stop.forEach(function(stop) {
      stops.push(stop.locid);
    });
    url = 'http://developer.trimet.org/ws/V1/arrivals?appID='+Auth['trimet']+'&locIDs='+stops.join(',')+'&json=true&callback=?'
    $.getJSON(url, function(json){People.trimet_update2(json, Users, user, People.map)});
  },

  trimet_update2: function(json, users, user, map) {
    var arrivals = json.resultSet.arrival;
    estimated_arrivals = arrivals.filter(function(a){return a.status == "estimated"})
    unique_arrivals = []
    estimated_arrivals.forEach(function(arrival) {
      if (!unique_arrivals.some(function(a){
             return (a.blockPosition.lat == arrival.blockPosition.lat) &&
                    (a.blockPosition.lng == arrival.blockPosition.lng) })){
        unique_arrivals.push(arrival)
      }
    });
    unique_arrivals.forEach(function(a) {
    console.log('trimet: lat:'+a.blockPosition.lat+' long:'+
                a.blockPosition.lng+' feet:'+a.blockPosition.feet);
    });
    var block = unique_arrivals[0].blockPosition
    var myLatLng = new google.maps.LatLng(block.lat,
                                          block.lng);
    People.finish_update(user, myLatLng);
  },

  finish_update: function(user, latLng) {
    user.marker.push(latLng);
    this.peepso.draw();
    People.needsSort = true;
    setTimeout(People.sort_users, 1000*2);

    if(this.options.panMap) { People.map.panTo(latLng); }
    var myTime = $('#'+user.username+' .time');
    myTime.html(People.time_ago(user.last_date));
    myTime.removeClass('spinning');
    $('#'+user.username+' .count').html(user.marker.length);
  },

  canSort: true,
  sort_users: function() {
    if(People.canSort) {
      if(People.needsSort) {
        People.needsSort = false;

        People.canSort = false;
        sorted_users = Users.slice(0);
        sorted_users.sort(People.sort_by_last_time);

        jQuery(sorted_users).each(function() {
          element = $('#'+this.username);
          element.appendTo(element.parent());
        });
        People.canSort = true;
      } else {
        People.needsSort = false;
      }
      return sorted_users;
    } else {
      setTimeout(People.sort_users, 50);
    }
  },

  sort_by_last_time: function (a,b) {
    var x = a.last_date;
    var y = b.last_date;
    return ((x < y) ? 1 : ((x > y) ? -1 : 0));
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
      new_y = point.y-(panel.height()/2);
      for(var i=0; i < user.marker.length; i++) {
        var point = this.getProjection().fromLatLngToDivPixel(user.marker[i]);
      }
    } else {
      new_x = -50
      new_y = -50;
    }
    if(typeof user.last_date != 'undefined') {
      var ms_ago = (new Date()).getTime() - user.last_date.getTime();
      var one_hour = 3600000;
      var one_day = (24*one_hour);

      var opacity = 1;
      if(one_hour < ms_ago && ms_ago < (6*one_hour)) {
        opacity = 0.9;
      } else if((6*one_hour) <= ms_ago && ms_ago < (12*one_hour)) {
        opacity = 0.8;
      } else if((12*one_hour) <= ms_ago && ms_ago < one_day) {
        opacity = 0.7;
      } else if(one_day <= ms_ago && ms_ago < (3*one_day)) {
        opacity = 0.6;
      } else if((3*one_day) <= ms_ago && ms_ago < (7*one_day)) {
        opacity = 0.5;
      } else if((7*one_day) <= ms_ago && ms_ago < (14*one_day)) {
        opacity = 0.4;
      } else if((14*one_day) <= ms_ago && ms_ago < (30*one_day)) {
        opacity = 0.3;
      } else if((30*one_day) <= ms_ago && ms_ago < (60*one_day)) {
        opacity = 0.2;
      } else if((60*one_day) <= ms_ago) {
        opacity = 0.1;
      }
      panel.fadeTo(50, opacity);
    }
    panel.css("left",new_x+"px");
    panel.css("top",new_y+"px");
  }
};

PeepsOverlay.prototype.onRemove = function() {
};

