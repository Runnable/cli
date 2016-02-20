'use strict'

var Promise = require('bluebird')
var fs = Promise.promisifyAll(require('fs'))
var keypather = require('keypather')()
var path = require('path')

var utils = require('./utils')

module.exports = {
  uploadFile: Promise.method(function (args) {
    return utils.getRepositoryAndInstance(args)
      .spread(function (argsWithRepo, instance) {
        return fs.readFileAsync(path.resolve(process.cwd(), argsWithRepo.file))
          .then(function (file) {
            var workingDir = keypather.get(instance, 'container.inspect.Config.WorkingDir')
            var container = argsWithRepo._user.newInstance(instance._id)
              .newContainer(instance.container.dockerContainer)
            var fileName = path.basename(argsWithRepo.file)
            var opts = {
              name: fileName,
              path: workingDir,
              isDir: false,
              content: file.toString()
            }
            return Promise.fromCallback(function (callback) {
              container.createFile(opts, callback)
            })
          })
      })
  })
}
