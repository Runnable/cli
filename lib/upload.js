'use strict'

var Promise = require('bluebird')
var fs = Promise.promisifyAll(require('fs'))
var keypather = require('keypather')()
var path = require('path')

var utils = require('./utils')

var createDirectory = function (container, path, directoryName) {
  var opts = {
    name: directoryName,
    path: path,
    isDir: true
  }
  return Promise.fromCallback(function (callback) {
    container.createFile(opts, callback)
  })
}

var createFile = function (container, path, fileName, file) {
  var opts = {
    name: fileName,
    path: path,
    isDir: false,
    content: file.toString()
  }
  return Promise.fromCallback(function (callback) {
    container.createFile(opts, callback)
  })
}

var recusivelyCreateDirectories = function (container, basePath, fullPath) {
  function createSingleDirectory (createdPaths, remainingPaths) {
    if (remainingPaths.length > 0) {
      var createPath = path.join(basePath, createdPaths.join(path.sep))
      var newPath = remainingPaths.splice(0, 1)[0]
      createdPaths.push(newPath)
      return createDirectory(container, createPath, newPath)
        .then(function () {
          return createSingleDirectory(createdPaths, remainingPaths)
        })
        .catch(function () {
          return createSingleDirectory(createdPaths, remainingPaths)
        })
    }
    return
  }
  return createSingleDirectory([], fullPath.split(path.sep))
}

module.exports = {
  uploadFile: Promise.method(function (args) {
    return utils.getRepositoryAndInstance(args)
      .spread(function (argsWithRepo, instance) {
        return fs.readFileAsync(path.resolve(process.cwd(), argsWithRepo.file))
          .then(function (file) {
            var workingDir = keypather.get(instance, 'container.inspect.Config.WorkingDir') || ''
            var container = argsWithRepo._user.newInstance(instance._id)
              .newContainer(instance.container.dockerContainer)
            var dirname = argsWithRepo.path || ''
            var fileName = path.basename(argsWithRepo.file)
            var fullPath = path.join(workingDir, dirname)
            return recusivelyCreateDirectories(container, workingDir, dirname)
              .then(function () {
                return createFile(container, fullPath, fileName, file)
              })
          })
      })
  })
}
