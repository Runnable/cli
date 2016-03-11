'use strict'

const program = require('commander')

const SSH = require('../lib/ssh')
const Utils = require('../lib/utils')

program
  .arguments('[repository]')
  .description('Starts a terminal session on the container for your local branch.')
  .parse(process.argv)

const options = {
  repository: program.args.shift()
}
SSH.connectTerminalStream(options)
  .catch(Utils.handleError)
