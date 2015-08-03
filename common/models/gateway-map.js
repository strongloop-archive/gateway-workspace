module.exports = function(GatewayMap) {
  GatewayMap.getUniqueId = function(data) {
    return data.name || data.id;
  };

  /**
   * Build a set of scopes from maps/pipelines/policies
   * @param {GatewayMap[]) maps
   * @param {Pipeline[]) pipelines
   * @param {Policy[]) policies
   * @returns {{}}
   */
  GatewayMap.buildScopes = function(maps, pipelines, policies) {
    var scopes = {};
    maps.forEach(function(m) {
      var matchedPipelines = pipelines.filter(function(pipeline) {
        return m.pipelineId === pipeline.id;
      });
      matchedPipelines.forEach(function(pipeline) {
        var matchedPolicies = policies.filter(function(policy) {
          return policy.type === 'auth' &&
            pipeline.policyIds.indexOf(policy.id) !== -1;
        });
        matchedPolicies.forEach(function(policy) {
          if (policy.scopes) {
            policy.scopes.forEach(function(s) {
              var routes = scopes[s];
              if (!routes) {
                routes = []
                scopes[s] = routes;
              }
              routes.push({verb: m.verb, endpoint: m.endpoint});
            });
          }
        });
      });
    });
    return scopes;
  }

  /**
   * Serialize the policy model instances to the JSON object for
   * policy-config.json
   * @param {*[]} cache The cache data source
   * @param {String} facetName Facet name
   * @returns {ConfigFile}
   */
  GatewayMap.serialize = function(cache, facetName) {
    var policyConfigPath = path.join(facetName, 'policy-config.json');
    var configs = loadFromCache(cache);

    debug('Writing to policy-config.json: %j', configs);
    return new ConfigFile({
      path: policyConfigPath,
      data: configs
    });
  }

  /**
   * Load the policy config from the file into cache.
   * @param cache
   * @param facetName
   * @param configFile
   */
  GatewayMap.deserialize = function(cache, facetName, configFile) {
    var configs = configFile.data || {};
    configs.policies.forEach(function(p) {
      debug('loading [%s] policy into cache', p.name);
      Policy.addToCache(cache, p);
    });
    configs.pipelines.forEach(function(p) {
      debug('loading [%s] pipeline into cache', p.name);
      Pipeline.addToCache(cache, p);
    });
    configs.maps.forEach(function(m) {
      debug('loading [%s] map into cache', m.name);
      GatewayMap.addToCache(cache, m);
    });
  };

  /**
   * Get the list of scope mappings
   * @param cb
   */
  GatewayMap.getScopes = function(cb) {
    // Find referenced pipeline/policies of type `auth`
    GatewayMap.find({
      include: {
        pipeline: {
          relation: 'policies',
          scope: {
            where: {
              type: 'auth'
            }
          }
        }
      }
    }, function(err, maps) {
      if (err) return cb(err);
      var scopes = {};
      maps.forEach(function(m) {
        var map = m.toJSON();
        if (map.pipeline) {
          if (map.pipeline.policies) {
            map.pipeline.policies.forEach(function(policy) {
              if (policy.scopes) {
                policy.scopes.forEach(function(s) {
                  var routes = scopes[s];
                  if (!routes) {
                    routes = []
                    scopes[s] = routes;
                  }
                  routes.push({verb: map.verb, endpoint: map.endpoint});
                });
              }
            });
          }
        }
      });
      cb(null, scopes);
    });
  };
};
