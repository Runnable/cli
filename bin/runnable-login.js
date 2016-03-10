'use strict'

var fs = require('fs')
var program = require('commander')
var utils = require('../lib/utils')

var runnable = require('../lib/runnable')

program
  .description('Authenticate with the Runnable CLI.')
  .parse(process.argv)

var options = {
  _user: runnable.user
}
runnable.login(options)
  .then(function () {
    return runnable.chooseOrg(options)
      .then(function (org) {
        fs.writeFileSync(runnable.settingsFile, JSON.stringify({ organization: org }))
      })
  })
  .catch(utils.handleError)
