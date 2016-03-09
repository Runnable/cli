'use strict'

var program = require('commander')

var runnable = require('../lib/runnable')
var utils = require('../lib/utils')

program
  .arguments('<file> [dest]')
  .description('Upload a file to the container for your local branch.')
  .parse(process.argv)

var options = {
  _user: runnable.user,
  file: program.args.shift(),
  path: program.args.shift()
}

runnable.uploadFile(options)
  .then(function () {
    console.log('Uploaded file.')
  })
  .catch(utils.handleError)
