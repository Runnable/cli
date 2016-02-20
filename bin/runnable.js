#!/usr/bin/env node
'use strict'

require('colors')
require('console.table')
var FileCookieStore = require('tough-cookie-filestore')
var Runnable = require('@runnable/api-client')
var debug = require('debug')('runnable-cli')
var fs = require('fs')
var path = require('path')
var program = require('commander')
var request = require('request')

var Table = require('../lib/table')
var functions = require('../lib/runnable')

var runnableFolder = process.env.RUNNABLE_STORE ||
  path.resolve(process.env.HOME, '.runnable')
var cookieFile = path.resolve(runnableFolder, 'cookie-jar.json')
var settingsFile = path.resolve(runnableFolder, 'settings.json')
var runnableHost = process.env.RUNNABLE_HOST || 'https://api.runnable.io'

try {
  fs.readdirSync(runnableFolder)
} catch (err) {
  fs.mkdirSync(runnableFolder)
}
checkCookie(cookieFile)
checkCookie(settingsFile, '{}')

var settings = require(settingsFile)

var runnableOpts = {
  requestDefaults: {
    headers: { 'user-agent': 'runnable-cli' }
  }
}

if (!process.env.NO_COOKIE) {
  debug('using cookies')
  var jar = new FileCookieStore(cookieFile)
  runnableOpts.requestDefaults.jar = request.jar(jar)
}

var _user = new Runnable(runnableHost, runnableOpts)
_user._org = settings.organization

program
  .version(require('../package.json').version)
  .usage('[options] <command>')

program
  .command('list [repository]')
  .description('Lists all repositories and services. Specify a repository ' +
    'to list its containers.')
  .action(function (repository, options) {
    if (!options) { options = {} }
    options.repository = repository
    options._user = _user
    if (options.repository) {
      functions.listContainersForRepository(options)
        .then(function (results) {
          Table.log(results)
        })
    } else {
      functions.listContainerSummary(options)
        .then(function (results) {
          function tableFormatter (obj, cell) {
            for (var key in obj) {
              if (!obj.hasOwnProperty(key)) continue
              cell(key === 'Count' ? '' : key, obj[key])
            }
          }
          var repositories = results.repositories
          var services = results.services
          Table.log(repositories, tableFormatter)
          Table.log(services, tableFormatter)
        })
    }
  })

program
  .command('logs [repository]')
  .alias('log')
  .option('-b, --build', 'View build logs only.')
  .option('-c, --cmd', 'View command logs only (default).')
  .description('View the logs of the container for your local branch.')
  .action(function (repository, options) {
    console.log('[Control + C to EXIT]'.bold)
    if (!options) { options = {} }
    if (!options.build && !options.cmd) {
      options.cmd = true
    }
    options.repository = repository
    options._user = _user
    functions.connectContainerLogs(options)
  })

program
  .command('ssh [repository]')
  .description('Starts a terminal session on the container for your local branch.')
  .action(function (repository) {
    var options = {
      _user: _user,
      repository: repository
    }
    functions.connectTerminalStream(options)
  })

program
  .command('upload <file>')
  .description('Upload a file to the container for your local branch.')
  .action(function (file) {
    var options = {
      file: file,
      _user: _user
    }
    functions.uploadFile(options)
      .then(function () {
        console.log('Uploaded file.')
      })
  })

program
  .command('login')
  .description('Authenticate with Runnable CLI.')
  .action(function (options) {
    if (!options) { options = {} }
    options._user = _user
    functions.login(options)
      .then(function () {
        return functions.chooseOrg(options)
          .then(function (org) {
            fs.writeFileSync(settingsFile, JSON.stringify({ organization: org }))
          })
      })
  })

program
  .command('org')
  .description('Choose a GitHub organization to use with Runnable.')
  .action(function () {
    var options = { _user: _user }
    return functions.chooseOrg(options)
      .then(function (org) {
        fs.writeFileSync(settingsFile, JSON.stringify({ organization: org }))
      })
  })

var isLogin = process.argv.indexOf('login') !== -1
var isHelp = process.argv.indexOf('--help') !== -1

if (isLogin || isHelp) {
  program.parse(process.argv)
} else {
  _user.fetch('me', function (err) {
    if (err) {
      console.error('Not authorized. Please login.')
      program.help()
    } else {
      program.parse(process.argv)
    }
  })
}

function checkCookie (cookieFile, emptyValue) {
  var exists = fs.existsSync(cookieFile)
  if (exists) { return }
  if (!emptyValue) { emptyValue = '' }
  fs.writeFileSync(cookieFile, emptyValue)
}
