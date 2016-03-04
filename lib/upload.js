'use strict'

const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs'))
const keypather = require('keypather')()
const path = require('path')

const Runnable = require('./runnable')
const utils = require('./utils')

class Upload extends Runnable {
  static uploadFile (args) {
    return utils.getRepositoryAndInstance(args)
      .spread((argsWithRepo, instance) => {
        return fs.readFileAsync(path.resolve(process.cwd(), argsWithRepo.file))
          .then((file) => {
            const workingDir = keypather.get(
              instance,
              'container.inspect.Config.WorkingDir'
            )
            const container = Upload.user.newInstance(instance._id)
              .newContainer(instance.container.dockerContainer)
            const dirname = argsWithRepo.path || ''
            const fileName = path.basename(argsWithRepo.file)
            let basePath
            let fullPath
            if (dirname[0] === '/') {
              fullPath = dirname
              basePath = '/'
            } else {
              fullPath = path.join(workingDir, dirname)
              basePath = workingDir
            }
            return Upload._recusivelyCreateDirectories(container, basePath, dirname)
              .then(function () {
                return Upload._createFile(container, fullPath, fileName, file)
              })
          })
      })
  }

  static _createDirectory (container, path, directoryName) {
    const opts = {
      name: directoryName,
      path: path,
      isDir: true
    }
    return Promise.fromCallback((callback) => {
      container.createFile(opts, callback)
    })
  }

  static _createFile (container, path, fileName, file) {
    const opts = {
      name: fileName,
      path: path,
      isDir: false,
      content: file.toString()
    }
    return Promise.fromCallback((callback) => {
      container.createFile(opts, callback)
    })
  }

  static _recusivelyCreateDirectories (container, basePath, fullPath) {
    function createSingleDirectory (createdPaths, remainingPaths) {
      if (remainingPaths.length > 0) {
        const createPath = path.join(basePath, createdPaths.join(path.sep))
        const newPath = remainingPaths.splice(0, 1)[0]
        createdPaths.push(newPath)
        return Upload._createDirectory(container, createPath, newPath)
          .then(() => {
            return createSingleDirectory(createdPaths, remainingPaths)
          })
          .catch(() => {
            return createSingleDirectory(createdPaths, remainingPaths)
          })
      }
      return Promise.resolve()
    }
    let allPaths = fullPath.split(path.sep)
    allPaths = allPaths.filter((path) => path.length > 0)
    return createSingleDirectory([], allPaths)
  }
}

module.exports = Upload
