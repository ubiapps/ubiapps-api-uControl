(function () {
  var RPCWebinosService = require('webinos-jsonrpc2').RPCWebinosService;
  var UControlImpl = require("./uControl_impl");

  var UControlModule = function (rpcHandler, params) {
    this.rpcHandler = rpcHandler;
    this.params = params;
    this.internalRegistry = {};
  };

  UControlModule.prototype.init = function (register, unregister) {
    this.register = register;
    this.unregister = unregister;
    process.nextTick(loadServices.bind(this));
  };

  var loadServices = function() {
    UControlImpl.loadServices(this.rpcHandler, this.register, this.unregister, UControlService);
  };

  UControlModule.prototype.updateServiceParams = function (serviceId, params) {
    var self = this;
    var id;

    if (serviceId && self.internalRegistry[serviceId]) {
      self.unregister({"id":serviceId, "api": self.internalRegistry[serviceId].api} );
      delete self.internalRegistry[serviceId];
    }

    if (params) {
      var service = new UControlService(this.rpcHandler, params);
      id = this.register(service);
      this.internalRegistry[id] = service;
    }

    return id;
  };

  var UControlService = function (rpcHandler, params) {
    // inherit from RPCWebinosService
    this.base = RPCWebinosService;
    this.base({
      api: 'http://ubiapps.com/api/ucontrol/' + params.deviceName,
      displayName: params.sensorName,
      description: params.sensorType
    });

    this.rpcHandler = rpcHandler;

    this._impl = new UControlImpl(params, rpcHandler);
  };

  UControlService.prototype = new RPCWebinosService;

  UControlService.prototype.subscribe = function(params, successCB, errorCB, objectRef) {
    return this._impl.subscribe(successCB, errorCB, objectRef);
  };

  UControlService.prototype.unsubscribe = function(params, successCB, errorCB, objectRef) {
    return this._impl.unsubscribe(params[0], successCB, errorCB, objectRef);
  };

  UControlService.prototype.getCurrent = function (params, successCB, errorCB) {
    return this._impl.getCurrent(successCB, errorCB);
  };

  UControlService.prototype.getStats = function (params, successCB, errorCB) {
    return this._impl.getStats(successCB, errorCB);
  };

  UControlService.prototype.getPage = function (params, successCB, errorCB) {
    return this._impl.getPage(params[0], successCB, errorCB);
  };

  // export our object
  exports.Module = UControlModule;
})();
