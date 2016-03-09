'use strict'

var fs = require('fs')
var program = require('commander')
var utils = require('../lib/utils')

var runnable = require('../lib/runnable')

program
  .description('Choose a GitHub organization to use with Runnable.')
  .parse(process.argv)

var options = { _user: runnable.user }
runnable.chooseOrg(options)
  .then(function (org) {
    fs.writeFileSync(runnable.settingsFile, JSON.stringify({ organization: org }))
  })
  .error(utils.handleError)
