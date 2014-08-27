(function () {
  UControlModule = function (obj) {
    WebinosService.call(this,obj);
  };

  UControlModule.prototype = Object.create(WebinosService.prototype);
  UControlModule.prototype.constructor = UControlModule;

  // Register to the service discovery
  _webinos.registerServiceConstructor("http://ubiapps.com/api/ucontrol", UControlModule);

  UControlModule.prototype.bindService = function (bindCB) {
    this.subscribe = subscribe;
    this.unsubscribe = unsubscribe;
    this.getCurrent = getCurrent;
    this.getStats = getStats;
    this.getPage = getPage;
    this._subscribeIds = {};

    if (typeof bindCB.onBind === 'function') {
      bindCB.onBind(this);
    }
  };

  var doRPC = function(method,params,successCB,errorCB) {
    var rpc = webinos.rpcHandler.createRPC(this, method, params);
    webinos.rpcHandler.executeRPC(rpc,
      function (res) {
        if (typeof successCB !== 'undefined') {
          successCB(res);
        }
      },
      function (err) {
        if (typeof errorCB !== 'undefined') {
          errorCB(err);
        }
      }
    );
  };

  function subscribe(success, fail) {
    var rpc = webinos.rpcHandler.createRPC(this, "subscribe", []);
    rpc.onEvent = function(data) {
      success(data);
    };
    rpc.onError = function(err) {
      fail(err);
    };
    webinos.rpcHandler.registerCallbackObject(rpc);
    webinos.rpcHandler.executeRPC(rpc);

    var subscribeId = parseInt(rpc.id, 16);
    this._subscribeIds[subscribeId] = rpc.id;
    return subscribeId;
  };

  function unsubscribe(subscribeId) {
    if (!this._subscribeIds.hasOwnProperty(subscribeId)) {
      console.log("ucontrol unsubscribe - invalid id: " + subscribeId);
      return;
    }
    var rpcId = this._subscribeIds[subscribeId];
    var rpc = webinos.rpcHandler.createRPC(this, "unsubscribe", [rpcId]);
    webinos.rpcHandler.executeRPC(rpc);

    delete this._subscribeIds[subscribeId];
    webinos.rpcHandler.unregisterCallbackObject( { api:rpcId });
  };

  function getCurrent(success, fail) {
    doRPC.call(this,"getCurrent",[],success,fail);
  }

  function getStats(success, fail) {
    doRPC.call(this,"getStats",[],success,fail);
  }

  function getPage(index, success, fail) {
    doRPC.call(this,"getPage",[index],success,fail);
  }
}());