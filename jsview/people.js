var PeepsOverlay  = function() {
  google.maps.OverlayView.call(this);
}
PeepsOverlay.prototype = new google.maps.OverlayView();
PeepsOverlay.prototype.onAdd = function() {
  var pane = this.getPanes().overlayImage;
  for(var i in Users){
    var user = Users[i];
    $(pane).append(People.user_infopanel(user));
  }
};
PeepsOverlay.prototype.draw = function() {
  var pane = this.getPanes().overlayImage;
  for(var i in Users){
    var user = Users[i];
    var point = this.getProjection().fromLatLngToDivPixel(user.marker);
    var panel = $('#infopanel_'+user.username);
    var new_x, new_y;
    panel.css("position","absolute");
    if(point) {
      new_x = point.x-(panel.width()/2);
      new_y = point.y-panel.height();
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

var People = {

  setup: function () {
    $('#map').css('height:'+window.innerHeight+'px');
    $.ajaxSetup({timeout:15000});
    var map_element = document.getElementById("map");
    var map = People.setup_map(map_element);
    var peepso = new PeepsOverlay();
    peepso.setMap(map);
  
    People.user_list_setup($("#followers"), Users);
    $("#followers .find").click(function(){
	var username = $(this).parent().attr('id');
        var user = People.userfind(username)
	map.panTo(user.marker);
    });
  
    People.follow_users(map, Users);
  },
  
  setup_map: function (map_element) {
    var last = {lat: 45.5, lng: -122.65};
  
    var latlng = new google.maps.LatLng(last.lat, last.lng);
    var myOptions = {
      zoom: 14,
      center: latlng,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };
  
    return new google.maps.Map(map_element, myOptions);
  },
  
  user_list_load: function (user_list_url, followers_element) {
    $.ajax({
      url: user_list_url,
      success: People.user_list_loaded,
    });
  },
  
  user_list_loaded: function (data) {
  },
  
  user_list_setup: function (ulist, users) {
    for(var i in users){
      ulist.append(People.user_widget(users[i]));
    }
  },
  
  user_infopanel: function(user) {
    var d = document.createElement('div');
    d.setAttribute('id', 'infopanel_'+user.username);
    d.innerHTML = '\
             <img src="'+People.gravatar(user.email,40)+'" \
                  style="vertical-align:top; float:left;" border="0" />';
    return d;
  },

  user_widget: function(user) {
    var d = document.createElement('div');
    d.setAttribute('id', user.username);
    d.innerHTML = '\
        <a class="find" href="javascript:void(0);"><img src="'+People.gravatar(user.email,40)+'" style="vertical-align:top; float:left;" border="0" /><img src="'+user.service.type+'.png"></a>\
        <a class="find" href="javascript:void(0);"> '+user.username+' </a>\
        <div>\
          <img src="icon_clock.gif" style="float:left">\
          <div id="'+user.username+'_update">\
          </div>\
        </div>\
        <div >\
          <img id="'+user.username+'_battery_img" src="icon_world_dynamic.gif" style="float:left; display:none">\
          <div id="'+user.username+'_battery">\
          </div>\
        </div>\
		<div class="latlng"></div>\
        <br clear="all" />\
    ';
    return d;
  },

  follow_users: function (map, users) {
    for(var i in users){
      var user = users[i];

      // eliminate this default
      user.marker = new google.maps.LatLng(45.5, -122.6);
      People.update_location(users, user, map);
  
      setInterval(function(user){
        return function(){People.update_location(users, user, map)}}(user)
      , 1000*60);
    }
  },
  
  update_location: function (users, user, map){
    var me = $('#'+user.username+'_update');
    me.html(me.html()+' (refreshing)');
    People.service_update(users, user, map);
  },

  service_update: function(users, user, map) {
    var service_url;
    if(user.service.type == "icecondor") {
      url = "http://icecondor.com/locations.jsonp?id="+user.service.id+"&limit=1&callback=?";
      $.getJSON(url, function(json){People.icecondor_update(json, users, user, map)});
    } 
    if(user.service.type == "geoloqi") {
      url = "http://geoloqi.com/proxy.php?user="+user.service.id+"&callback=?";
      $.getJSON(url, function(json){People.geoloqi_update(json, users, user, map)});
    }
    if(user.service.type == "geoloqi2") {
      url = user.service.id+"&callback=?";
      $.getJSON(url, function(json){People.geoloqi_update(json, users, user, map)});
    }
    if(user.service.type == "instamapper") {
      url = 'https://www.instamapper.com/api?action=getPositions&key='+user.service.id+'&format=json&jsoncallback=?'
      $.getJSON(url, function(json){People.instamapper_update(json, users, user, map)});
    }
  },

  instamapper_update: function(json,users,user,map) {
    var me = $('#'+user.username+'_update');
      var myLatLng = new google.maps.LatLng(json[0].location.geom.y, 
                                            json[0].location.geom.x);
      if(!user.marker.equals(myLatLng)) {
        map.panTo(myLatLng);
      }
      var last_date = (new Date()).setISO8601(json[0].location.created_at);
      user.last_date = last_date;
      user.marker = myLatLng;
      me.fadeOut();
      me.html(People.time_ago(last_date));
      me.fadeIn();
      People.sort_by_last_time(users, user);
  },

  icecondor_update: function(json,users,user,map) {
    var me = $('#'+user.username+'_update');
      var myLatLng = new google.maps.LatLng(json[0].location.geom.y, 
                                            json[0].location.geom.x);
      if(!user.marker.equals(myLatLng)) {
        map.panTo(myLatLng);
      }
      var last_date = (new Date()).setISO8601(json[0].location.timestamp);
      user.last_date = last_date;
      user.marker = myLatLng;
      me.fadeOut();
      me.html(People.time_ago(last_date));
      me.fadeIn();
      People.sort_by_last_time(users, user);
  },

  geoloqi_update: function(json,users,user,map) {
      var me = $('#'+user.username+'_update');
      var myLatLng = new google.maps.LatLng(json.data.location.position.latitude, 
                                            json.data.location.position.longitude);
      if(!user.marker.equals(myLatLng)) {
        map.panTo(myLatLng);
      }
      var last_date = (new Date()).setISO8601(json.data.date);
      user.last_date = last_date;
      user.marker = myLatLng;
      me.fadeOut();
      me.html(People.time_ago(last_date));
      me.fadeIn();
      if(typeof(json.data.raw)!="undefined") {
        $('#'+user.username+'_battery').html(json.data.raw.battery+'% batt');
        $('#'+user.username+'_battery_img').show();
      }
      People.sort_by_last_time(users, user);
  },

  sort_by_last_time: function (users, user) {
    if (users.length < 2) { return; }
    var winner = null;

    for(var i in users){
      var u = users[i];
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

Date.prototype.setISO8601 = function(dString){
  var regexp = /(\d\d\d\d)(-)?(\d\d)(-)?(\d\d)(T)?(\d\d)(:)?(\d\d)(:)?(\d\d)(\.\d+)?(Z|([+-])(\d\d)(:)?(\d\d))/;
  if (dString.toString().match(new RegExp(regexp))) {
    var d = dString.match(new RegExp(regexp));
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

