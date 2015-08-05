module.exports = function(app) {
  // Registering policy handlers with the Facet
  var Facet = app.models.Facet;
  var GatewayMap = app.models.GatewayMap;
  if (Facet && Facet.artifactTypes) {
    Facet.registerArtifactType('policy-config', {
      load: function(cache, facetName, configFile, cb) {
        configFile.load(function(err) {
          if (err) return cb(err);
          GatewayMap.deserialize(cache, facetName, configFile);
          cb();
        });
      },
      save: function(cache, facetName) {
        var configFile = GatewayMap.serialize(cache, facetName);
        return configFile;
      }
    });
  }
};
