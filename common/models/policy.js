var async = require('async');

module.exports = function(Policy) {
  Policy.getUniqueId = function(data) {
    return data.name || data.id;
  };

  /**
   * Find all pipelines that reference the given policy
   * @param {String} name Policy name
   * @param cb
   */
  Policy.findPipelineRefs = function(name, cb) {
    Policy.findOne({where: {name: name}}, function(err, policy) {
      if (err) return cb(err);
      var Pipeline = Policy.app.models.Pipeline;
      Pipeline.find(function(err, pipelines) {
        if (err) return cb(err);
        var matched = pipelines.filter(function(p) {
          return p.policyIds.indexOf(policy.id) !== -1;
        });
        cb(null, {policy: policy, pipelines: matched});
      });
    });
  };

  /**
   * Rename a policy and adjust pipelines that reference the policy
   * @param {String} currentName Current name
   * @param {String} newName New name
   * @param cb
   */
  Policy.rename = function(currentName, newName, cb) {
    if (currentName === newName) {
      return process.nextTick(function() {
        cb(null, false);
      });
    }
    this.findPipelineRefs(currentName, function(err, result) {
      if (err) return cb(err);
      var oldId = result.policy.id;
      result.policy.updateAttributes({name: newName}, function(err, policy) {
        if (err) return cb(err);
        policy.id = Policy.getUniqueId(policy);
        async.each(result.pipelines, function(p, done) {
          var ids = p.policyIds;
          ids.forEach(function(id, index) {
            if (id === oldId) {
              ids[index] = newName;
            }
          });
          p.updateAttributes({policyIds: ids}, done);
        }, function(err) {
          if (err) return cb(err);
          cb(null, policy);
        });
      });
    });
  };

  Policy.remoteMethod('rename', {
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
        arg: 'policy',
        type: 'Policy',
        root: true
      }
    ]
  });
};
