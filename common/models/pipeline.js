var async = require('async');

module.exports = function(Pipeline) {
  Pipeline.getUniqueId = function(data) {
    return data.name || data.id;
  };

  /**
   * Find gateway mappings that reference the given pipeline
   * @param {String} name The pipeline name
   * @param cb
   */
  Pipeline.findMappingRefs = function(name, cb) {
    Pipeline.findOne({where: {name: name}}, function(err, pipeline) {
      if (err || !pipeline) return cb(err);
      var GatewayMapping = Pipeline.app.models.GatewayMapping;
      GatewayMapping.find({where: {pipelineId: pipeline.id}},
        function(err, mappings) {
        if (err) return cb(err);
        cb(null, {pipeline: pipeline, mappings: mappings});
      });
    });
  };

  /**
   * Rename a pipeline and adjust the gateway mappings that reference
   * the pipeline
   * @param {String} currentName Current name
   * @param {String} newName New Name
   * @param cb
   */
  Pipeline.rename = function(currentName, newName, cb) {
    if (currentName === newName) {
      return process.nextTick(function() {
        cb(null, false);
      });
    }
    this.findMappingRefs(currentName, function(err, result) {
      if (err) return cb(err);
      if (!result) {
        // Cannot find the policy by name
        err = new Error('Pipeline not found: ' + currentName);
        err.statusCode = 404;
        cb(err);
        return;
      }
      result.pipeline.updateAttributes({name: newName},
        function(err, pipeline) {
        if (err) return cb(err);
        pipeline.id = Pipeline.getUniqueId(pipeline);
        async.each(result.mappings, function(map, done) {
          map.updateAttributes({pipelineId: pipeline.id}, done);
        }, function(err) {
          if (err) return cb(err);
          cb(null, pipeline);
        });
      });
    });
  };

  Pipeline.remoteMethod('rename', {
    isStatic: true,
    accepts: [{
      arg: 'currentName',
      type: 'string',
      required: true,
      description: 'Current name'
    },
      {
        arg: 'newName',
        type: 'string',
        required: true,
        description: 'New name'
      }
    ],
    returns: [
      {
        arg: 'pipeline',
        type: 'Pipeline',
        root: true
      }
    ]
  });

  /**
   * Delete a pipeline by name
   * @param {string} name Policy name
   * @param {Boolean} force
   * @param cb
   */
  Pipeline.deleteByName = function(name, force, cb) {
    if (cb === undefined && typeof force === 'function') {
      cb = force;
      force = false;
    }
    this.findMappingRefs(name, function(err, result) {
      if (err) return cb(err, false);
      if (!result) {
        // Cannot find the policy by name
        err = new Error('Pipeline not found: ' + name);
        err.statusCode = 404;
        cb(err);
        return;
      }
      if (!force) {
        if (Array.isArray(result.mappings) && result.mappings.length > 0) {
          // Cannot delete the policy as it's in use
          err = new Error('Pipeline cannot be deleted as it is in use');
          err.statusCode = 400;
          cb(err);
          return;
        }
      }
      async.each(result.mappings, function(m, done) {
        // Remove the policy ref
        m.updateAttributes({pipelineId: null}, done);
      }, function(err) {
        if (err) return cb(err);
        result.pipeline.destroy(function(err) {
          if (err) return cb(err);
          cb(null, true);
        });
      });
    });
  };

  Pipeline.remoteMethod('deleteByName', {
    isStatic: true,
    accepts: [{
      arg: 'name',
      type: 'string',
      required: true,
      http: {source: 'path'},
      description: 'Pipeline name'
    }, {
      arg: 'force',
      type: 'boolean',
      http: {source: 'query'},
      description: 'Force delete'
    }],
    returns: [
      {
        arg: 'result',
        type: 'boolean',
        root: true
      }
    ],
    http: {
      verb: 'delete',
      path: '/names/:name'
    }
  });
};
