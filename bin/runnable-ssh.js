'use strict'

var program = require('commander')

var runnable = require('../lib/runnable')
var utils = require('../lib/utils')

program
  .arguments('[repository]')
  .description('Starts a terminal session on the container for your local branch.')
  .parse(process.argv)

var options = {
  _user: runnable.user,
  repository: program.args.shift()
}
runnable.connectTerminalStream(options)
  .catch(utils.handleError)
