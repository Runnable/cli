'use strict'

require('colors')
var pick = require('101/pick')
var program = require('commander')
var utils = require('../lib/utils')

var runnable = require('../lib/runnable')

program
  .arguments('[repository]')
  .option('-b, --build', 'View build logs only.')
  .option('-c, --cmd', 'View command logs only (default).')
  .description('View the logs of the container for your local branch.')
  .parse(process.argv)

console.log('[Control + C to EXIT]'.bold)

if (!program.build && !program.cmd) {
  program.cmd = true
}

var options = pick(program, [ 'build', 'cmd' ])
options._user = runnable.user
options.repository = program.args.shift()

runnable.connectContainerLogs(options)
  .error(utils.handleError)
