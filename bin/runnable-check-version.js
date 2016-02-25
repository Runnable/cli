'use strict'

require('colors')
var Promise = require('bluebird')
var isEmpty = require('101/is-empty')
var npm = require('npm')
var program = require('commander')
var semver = require('semver')

program
  .description('Prints current version and checks for updates.')
  .parse(process.argv)

var packageData = require('../package.json')
var currentVersion = packageData.version
var name = packageData.name

console.log('Current version:'.bold, semver.clean(currentVersion))
Promise.fromCallback(npm.load.bind(npm, { silent: true }))
  .then(function () {
    return Promise.fromCallback(function (callback) {
      npm.commands['view']([name, 'version'], true, callback)
    })
    // return Promise.fromCallback(npm.view.bind(npm, [name, 'version'], true))
  })
  .then(function (versionObject) {
    if (!versionObject || isEmpty(versionObject)) {
      throw new Error('Could not determine remote available version.')
    }
    var remoteVersion = Object.keys(versionObject)[0]
    console.log('Remote version (latest):'.bold, semver.clean(remoteVersion))
    if (semver.gt(currentVersion, remoteVersion)) {
      console.log('You are out of date!'.red.bold)
      console.log('To update your `runnable` version, run `npm install -g @runnable/cli`')
    } else {
      console.log('You are up to date!'.green.bold)
    }
  })
