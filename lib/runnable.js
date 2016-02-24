'use strict'

var FileCookieStore = require('tough-cookie-filestore')
var Runnable = require('@runnable/api-client')
var assign = require('101/assign')
var fs = require('fs')
var path = require('path')
var request = require('request')

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

assertFileExists(cookieFile)
assertFileExists(settingsFile, '{}')

var settings = require(settingsFile)

var runnableOpts = {
  requestDefaults: {
    headers: { 'user-agent': 'runnable-cli' }
  }
}

var jar = new FileCookieStore(cookieFile)
runnableOpts.requestDefaults.jar = request.jar(jar)

var _user = new Runnable(runnableHost, runnableOpts)
_user._org = settings.organization

var functions = {
  user: _user,
  settingsFile: settingsFile
}
assign(functions, require('./list'))
assign(functions, require('./login'))
assign(functions, require('./logs'))
assign(functions, require('./ssh'))
assign(functions, require('./upload'))

module.exports = functions

function assertFileExists (cookieFile, emptyValue) {
  var exists = fs.existsSync(cookieFile)
  if (exists) { return }
  if (!emptyValue) { emptyValue = '' }
  fs.writeFileSync(cookieFile, emptyValue)
}
