'use strict'

const isEmpty = require('101/is-empty')
const npm = require('npm')
const program = require('commander')
const Promise = require('bluebird')
const semver = require('semver')

const packageData = require('../package.json')
const Utils = require('../lib/utils')

program
  .description('Prints current version and checks for updates.')
  .parse(process.argv)

const currentVersion = packageData.version
const name = packageData.name

console.log('Current version:'.bold, semver.clean(currentVersion))
const npmConfig = {
  registry: process.env.RUNNABLE_NPM_REGISTRY || 'https://registry.npmjs.org/',
  'cache-min': 0
}
Promise.fromCallback(npm.load.bind(npm, npmConfig))
  .then(() => {
    return Promise.fromCallback(function (callback) {
      npm.commands['view']([name, 'version'], true, callback)
    })
  })
  .then((versionObject) => {
    if (!versionObject || isEmpty(versionObject)) {
      throw new Error('Could not determine remote available version.')
    }
    const remoteVersion = Object.keys(versionObject)[0]
    console.log('Remote version (latest):'.bold, semver.clean(remoteVersion))
    if (semver.lt(currentVersion, remoteVersion)) {
      console.log('You are out of date!'.red.bold)
      console.log('To update your `runnable` version, run `npm install -g @runnable/cli`')
    } else {
      console.log('You are up to date!'.green.bold)
    }
  })
  .catch(Utils.handleError)
