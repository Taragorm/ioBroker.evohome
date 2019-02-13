#!/bin/bash
#
# Dev only - copy working to evohome
#
DST=/opt/iobroker/node_modules/iobroker.evohome
echo $DST
#mkdir $DST
cp -R . $DST
#chmod -R 777 $DST

