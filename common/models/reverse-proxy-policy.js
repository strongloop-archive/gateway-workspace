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
