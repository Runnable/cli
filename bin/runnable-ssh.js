'use strict'

const program = require('commander')

const SSH = require('../lib/ssh')

program
  .arguments('[repository]')
  .description('Starts a terminal session on the container for your local branch.')
  .parse(process.argv)

const options = {
  repository: program.args.shift()
}
SSH.connectTerminalStream(options)
