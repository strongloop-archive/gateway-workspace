// Copyright IBM Corp. 2015. All Rights Reserved.
// Node module: gateway-workspace
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

module.exports = function(ReverseProxy) {
  ReverseProxy.prototype.addMapping = function(mapping, cb) {
    this.params.routes = this.params.routes || [];
    if (typeof mapping === 'string') {
      // TBI
    } else if (typeof mapping === 'object') {
      // TBI
    } else {
      // TBI
    }
  };
};
