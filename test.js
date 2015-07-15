var gatewayWorkspace = require('.');
var models = gatewayWorkspace.models().map(function(m) {
  return m.modelName;
});

console.log(models)
