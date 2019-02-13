<h1>
    <img src="admin/tcc.png" width="64"/>
    ioBroker.evohome
</h1>

[![NPM version](http://img.shields.io/npm/v/iobroker.evohome.svg)](https://www.npmjs.com/package/iobroker.evohome)
[![Downloads](https://img.shields.io/npm/dm/iobroker.evohome.svg)](https://www.npmjs.com/package/iobroker.evohome)
[![Dependency Status](https://img.shields.io/david/Taragorm/iobroker.evohome.svg)](https://david-dm.org/Author/iobroker.evohome)
[![Known Vulnerabilities](https://snyk.io/test/github/Taragorm/ioBroker.evohome/badge.svg)](https://snyk.io/test/github/Author/ioBroker.evohome)

[![NPM](https://nodei.co/npm/iobroker.evohome.png?downloads=true)](https://nodei.co/npm/iobroker.evohome/)

**Tests:** Linux/Mac: [![Travis-CI](http://img.shields.io/travis/Taragorm/ioBroker.evohome/master.svg)](https://travis-ci.org/Author/ioBroker.evohome)
Windows: [![AppVeyor](https://ci.appveyor.com/api/projects/status/github/Taragorm/ioBroker.evohome?branch=master&svg=true)](https://ci.appveyor.com/project/Author/ioBroker-evohome/)

## Honeywell EvoHome adapter for ioBroker

Provide an adaptor which can connect to the Honeywell EvoHome cloud, usung the `emea` API, so might not work in the US.


### Instance settings

| Setting       |  Description      |
|---------------|-------------------|
| username      | Your TCC username |
| password      | Your TCC Password |
| simpleTree    | If set, don't include a node for `gateway-controlSystem`. Use this mode if you have only one system, or all your zone names are unique. See below. |



#### `simpleTree` setting.

The data received from the cloud has a data structure like:

`Location/Gateway/ControlSystem/Zone`

Unfortunately, niether the `Gateway` nor `ControlSystem` parts have a
descriptive name, and just have a numeric id.

If you have  `simpleTree` == true, the adaptor will omit the `Gateway/ControlSystem` part, and create
objects like:

`location-name/Zone-name`

e.g.
`Home/Kitchen`

If you have  `simpleTree` == false, the adaptor will include the `Gateway/ControlSystem` part, and create
objects like:

`location_name/gateway_id-controlsystem_id/Zone-name`

e.g.
`Home/12345-6789/Kitchen`

## Todo

* Writable system modes
* Custom Widgets
* Schedule support
* Hot Water support - can't do this as I have no hardware -T
* Other EvoHome devices - can't do this as I have no hardware -T

## Changelog

### 0.0.1
* Taragorm -  initial release

## License
MIT License

Copyright (c) 2019 Taragorm@zoho.eu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
