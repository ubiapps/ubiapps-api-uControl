(function() {
  "use strict";
  var http = require("http");
  var url = require("url");
//  var _apiUrl = "http://ucontrolapi.ubiapps.com/";
  var _apiUrl = "http://localhost:3333/";
  var _apiKey = "c9a66";
  var _authUser = "ubiapps";
  var _authPwd = "sppaibu";

  function UControlImpl(cfg,rpcHandler) {
    var self = this;
    this._rpcHandler = rpcHandler;
    this._config = cfg;
    this._subscribers = {};
    this._pollTimer = 0;
    this._pollInterval = 10000;
    this._cachedTemp = {};
    this._cachedStats = {};
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
    }).on("error", errorCB);
  };

  var getCurrentTemp = function(successCB, errorCB) {
    var self = this;

    // Issue request to REST API to get current temp/timestamp.
    var tempEndpoint = _apiUrl + "deviceCurrent/" + this._config.deviceId;
    ucontrolJSONRequest(tempEndpoint, function(val) { self._cachedTemp = val; successCB(val); }, errorCB);
  };

  var getCurrentStats = function(successCB, errorCB) {
    var self = this;
    // Issue request to REST API to get current stats for device.
    var statsEndpoint = _apiUrl + "deviceCount/" + this._config.deviceId;
    ucontrolJSONRequest(statsEndpoint, function(val) { self._cachedStats = val; successCB(val); }, errorCB);
  };

  var getPage = function(index, successCB, errorCB) {
    var self = this;
    // Issue request to REST API to get a page.
    var statsEndpoint = _apiUrl + "devicePage/" + this._config.deviceId + "/" + index;
    ucontrolJSONRequest(statsEndpoint, function(val) { successCB(val); }, errorCB);
  };

  var notifySubscriber = function(objectRef) {
    var rpc = this._rpcHandler.createRPC(objectRef, 'onEvent', this._cachedTemp);
    if (false === this._rpcHandler.executeRPC(rpc)) {
      // Client dropped?
      console.log("************ uControl - deleting dropped subscriber");
      delete this._subscribers[objectRef.rpcId];
    }
  }

  var doPoll = function() {
    var self = this;
    var cachedTemp = self._cachedTemp.temperature;
    self._pollTimer = 0;

    var success = function(val) {
      if (val.temperature !== cachedTemp) {
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

    getCurrentTemp.call(self,success,err);
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
      if (this._cachedTemp === 0) {
        getCurrentTemp.call(this, function(val) {
          process.nextTick(function() { notifySubscriber.call(self,objectRef); });
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
  };

  UControlImpl.prototype.getCurrent = function(successCB, errorCB) {
    getCurrentTemp.call(this,successCB,errorCB);
  };

  UControlImpl.prototype.getStats = function(successCB, errorCB) {
    getCurrentStats.call(this,successCB,errorCB);
  };

  UControlImpl.prototype.getPage = function(index, successCB, errorCB) {
    getPage.call(this, index, successCB,errorCB);
  };

  module.exports = UControlImpl;
}());