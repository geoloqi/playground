#!/usr/bin/env python
import urllib2
import json

class Geoloqi(object):

  def __init__(self, token):
    self.speeds       = []
    self.headings     = []
    self.OAuth_token  = token

  def get_page(self, date, count):
    url  = "https://api.geoloqi.com/1/location/history?"
    url += "count=%d" % count
    url += "&sort=asc"
    url += "&after=%d" % date
  
    headers = { 'Authorization': 'OAuth %s' % self.OAuth_token }
   
    req = urllib2.Request(url, None, headers)
    response = urllib2.urlopen(req)
    data = response.read()
    geoloqi = json.loads(data)

    points = geoloqi['points']
    
    return points

  def parse(self, points):
    for point in points:
      loc = point['location']['position']
      
      speed   = float(loc['speed'])
      heading = float(loc['heading'])
      
      # lets not bother with missing/trivial data
      if speed > 0 and heading >= 0:
        self.speeds.append(speed)
        self.headings.append(heading)

  def pull_data(self, date):
    i = 1
    while (1):
      print 'Getting data [%d]' % i
      points = self.get_page(date, 10000)
      print '    + returned %d points' % len(points)
      if len(points) < 1 : break
      self.parse(points)
      date = points[-1]['date_ts']
      i = i + 1
    print 'Done.'
