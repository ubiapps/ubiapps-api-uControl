(function() {
  "use strict";
  var http = require("http");
  var url = require("url");
  var _apiUrl = "http://ucontrolapi.ubiapps.com/";
//  var _apiUrl = "http://localhost:3333/";
  var _apiKey = "c9a63";
  var _authUser = "ubiapps";
  var _authPwd = "sppaibu";
  var _sensorTypeLookup = {
    "e": "EM",
    "t": "FHT",
    "k": "ASH",
    "f": "PIRI",
    "z": "COZIR",
    "emonTH": "EMON-TH",
    "emonTx": "EMON-Tx"
  };

  function UControlImpl(cfg,rpcHandler) {
    this._rpcHandler = rpcHandler;
    this._config = cfg;
    this._subscribers = {};
    this._pollTimer = 0;
    this._pollInterval = 30000;
    this._cachedCurrent = undefined;
  }

  var ucontrolJSONRequest = function(endpoint, successCB, errorCB) {
    console.log("ucontrolJSONRequest: " + endpoint);
    var endpointOptions = url.parse(endpoint);
    endpointOptions.auth = _authUser + ":" + _authPwd;
    endpointOptions.headers = {"x-api-key": _apiKey};
    http.get(endpointOptions, function(res) {
      var chunks = [];
      res.on('data', function(chunk) {
        chunks.push(chunk.toString());
      }).on('end', function() {
          var body = chunks.join("");
          try {
            var jsonBody = JSON.parse(body);
            successCB(jsonBody);
          } catch (e) {
            errorCB(e);
          }
        });
    }).on("error", function(err) {
      if (typeof errorCB === "function") {
        errorCB(err);
      }
    });
  };

  var getCurrent = function(successCB, errorCB) {
    var self = this;

    // Issue request to REST API to get current data.
    var currentEndpoint = _apiUrl + "deviceCurrent/" + this._config.deviceId + "/" + this._config.sensorId;
    ucontrolJSONRequest(currentEndpoint, function(val) { self._cachedCurrent = val; successCB(val); }, errorCB);
  };

  var getCurrentStats = function(successCB, errorCB) {
    var self = this;
    // Issue request to REST API to get current stats for device.
    var statsEndpoint = _apiUrl + "deviceCount/" + this._config.deviceId + "/" + this._config.sensorId;
    ucontrolJSONRequest(statsEndpoint, function(val) { self._cachedStats = val; successCB(val); }, errorCB);
  };

  var getPage = function(index, successCB, errorCB) {
    // index is an offset relative to the current date.
    var today = new Date();
    today.setUTCHours(0,0,0,0);
    var pageDay = new Date(today);
    pageDay.setDate(today.getDate() - index);
    // Issue request to REST API to get a page.
    var statsEndpoint = _apiUrl + "deviceDay/" + this._config.deviceId + "/" + this._config.sensorId + "/" + pageDay.getTime();
    ucontrolJSONRequest(statsEndpoint, function(val) { successCB(val); }, errorCB);
  };

  var notifySubscriber = function(objectRef) {
    var rpc = this._rpcHandler.createRPC(objectRef, 'onEvent', this._cachedCurrent);
    if (false === this._rpcHandler.executeRPC(rpc)) {
      // Client dropped?
      console.log("************ uControl - deleting dropped subscriber");
      delete this._subscribers[objectRef.rpcId];
    }
  };

  var doPoll = function() {
    var self = this;
    var oldCache = JSON.stringify(self._cachedCurrent);
    self._pollTimer = 0;

    var success = function(val) {
      if (JSON.stringify(val) !== oldCache) {
        for (var s in self._subscribers) {
          if (self._subscribers.hasOwnProperty(s)) {
            var objectRef = self._subscribers[s];
            notifySubscriber.call(self,objectRef);
          }
        }
      }
      startPolling.call(self);
    };

    var err = function(err) {
      console.log("failed during ucontrol service call");
      startPolling.call(self);
    };

    getCurrent.call(self,success,err);
  };

  var startPolling = function() {
    if (this._pollTimer === 0 && Object.keys(this._subscribers).length > 0) {
      this._pollTimer = setTimeout(doPoll.bind(this),this._pollInterval);
    }
  };

  UControlImpl.prototype.subscribe = function(successCB, errorCB, objectRef) {
    var self = this;

    // Add callbacks to list of subscribers.
    if (!this._subscribers.hasOwnProperty(objectRef.rpcId)) {
      this._subscribers[objectRef.rpcId] = objectRef;
      if (this._cachedCurrent === undefined) {
        getCurrent.call(this, function(val) { process.nextTick(function() { notifySubscriber.call(self,objectRef); }, errorCB);
        });
      } else {
        process.nextTick(function() { notifySubscriber.call(self,objectRef); });
      }
    }

    startPolling.call(this);
  };

  UControlImpl.prototype.unsubscribe = function(id, successCB, errorCB) {
    // Remove callbacks from list of subscribers.
    delete this._subscribers[id];
    successCB();
  };

  UControlImpl.prototype.getCurrent = function(successCB, errorCB) {
    getCurrent.call(this,successCB,errorCB);
  };

  UControlImpl.prototype.getStats = function(successCB, errorCB) {
    getCurrentStats.call(this,successCB,errorCB);
  };

  UControlImpl.prototype.getPage = function(index, successCB, errorCB) {
    getPage.call(this, index, successCB,errorCB);
  };

  UControlImpl.loadServices = function(rpcHandler, register, unregister, serviceClass) {

    var errorCB = function(err) {
      console.log("!! ucontrol service load: failure talking to ucontrol api");
    };

    var gotDevice = function(dev) {
      for (var s in dev.sensors) {
        if (dev.sensors.hasOwnProperty(s)) {

          var sensorCode = s.split('-');
          if (sensorCode.length > 1) {
            sensorCode = sensorCode[0];
          } else {
            sensorCode = s[0];
          }

          var sensor = dev.sensors[s];
          var serviceParams = {
            deviceName: dev.name,
            deviceId: dev._id,
            sensorId: s,
            sensorType: _sensorTypeLookup[sensorCode],
            sensorName: sensor.name
          };
          var service = new serviceClass(rpcHandler, serviceParams);
          var id = register(service);
        }
      }
    };

    var gotDevices = function(devices) {
      for (var d in devices) {
        if (devices.hasOwnProperty(d) && devices[d].hasOwnProperty("device")) {
          var dev = devices[d];
          var deviceEndpoint = _apiUrl + "device/" + dev.device;
          ucontrolJSONRequest(deviceEndpoint, gotDevice, errorCB);
        }
      }
    };

    // Get list of devices.
    var devicesEndpoint = _apiUrl + "devices";
    ucontrolJSONRequest(devicesEndpoint, gotDevices, errorCB);
  };

  module.exports = UControlImpl;
}());