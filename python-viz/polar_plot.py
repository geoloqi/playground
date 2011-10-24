#!/usr/bin/env python
import math
import Geoloqi
import matplotlib.pyplot as plt

# Create a Geoloqi data source
data_source = Geoloqi.Geoloqi('PUT KEY HERE')

# Pull the data from the server starting from this date
data_source.pull_data(1314835200) # September 01 2011

heading = data_source.headings
speed   = data_source.speeds



# Matplotlib stuff

# Set the color map (if mapping color)
cmap = plt.cm.jet
color = []

# not mapping color to anything in this case, so set to white
color = 'white'

# Loop through data and rotate it 90 degress, reverse direcion, put in radians. 
# This is because polor plots use unit circle math, counter clockwise 0 (N) is 
# on the right. This makes it like a compass
for i in range(len(heading)):
  heading[i] = 360 - heading[i]
  heading[i] = heading[i] + 90
  heading[i] = math.radians(heading[i])
  
  # Make color map here
  #color.append(data[i])

# Make matplotlib figure
fig = plt.figure(frameon=False)

# Make matplotlib axes, polar plot!
ax = fig.add_subplot(111, polar=True, frameon=False)

# No grid
ax.grid(False)

# Scatter plot data
ax.scatter(heading, speed, c=color, s=6, linewidth=0, alpha=0.05, cmap=cmap)


# Labels, make ticks on the cardinals 
ax.xaxis.set_ticks([    math.radians(0)
                      , math.radians(45)
                      , math.radians(90)
                      , math.radians(135)
                      , math.radians(180)
                      , math.radians(225)
                      , math.radians(270)
                      , math.radians(315)])
ax.set_xticklabels(['E','NE','N','NW','W','SW','S','SE'])

# No r axis ticks
ax.yaxis.set_ticks([])

# color them white
for t in  ax.xaxis.get_ticklabels():
  t.set_color('white') 


# Uncomment this to see live preview
#plt.show()

# Write image to disk
plt.savefig("heading.png", dpi=200, Transparent='Transparent')
