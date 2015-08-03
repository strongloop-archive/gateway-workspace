module.exports = function(Pipeline) {
  Pipeline.getUniqueId = function(data) {
    return data.name || data.id;
  };
};
