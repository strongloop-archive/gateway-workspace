var async = require('async');

module.exports = function(Pipeline) {
  Pipeline.getUniqueId = function(data) {
    return data.name || data.id;
  };

  /**
   * Find gateway maps that reference the given pipeline
   * @param {String} name The pipeline name
   * @param cb
   */
  Pipeline.findMapRefs = function(name, cb) {
    Pipeline.findOne({where: {name: name}}, function(err, pipeline) {
      if (err) return cb(err);
      var GatewayMap = Pipeline.app.models.GatewayMap;
      GatewayMap.find({where: {pipelineId: pipeline.id}}, function(err, maps) {
        if (err) return cb(err);
        cb(null, {pipeline: pipeline, maps: maps});
      });
    });
  };

  /**
   * Rename a pipeline and adjust the gateway maps that reference the pipeline
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
    this.findMapRefs(currentName, function(err, result) {
      if (err) return cb(err);
      result.pipeline.updateAttributes({name: newName}, function(err, pipeline) {
        if (err) return cb(err);
        pipeline.id = Pipeline.getUniqueId(pipeline);
        async.each(result.maps, function(map, done) {
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
};
