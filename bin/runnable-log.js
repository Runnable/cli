'use strict'

const pick = require('101/pick')
const program = require('commander')

const Logs = require('../lib/logs')
const Utils = require('../lib/utils')

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

const options = pick(program, [ 'build', 'cmd' ])
options.repository = program.args.shift()

Logs.connectContainerLogs(options)
  .catch(Utils.handleError)
