'use strict'

const pick = require('101/pick')
const program = require('commander')

const AutoIsolation = require('../lib/auto-isolation')
const Utils = require('../lib/utils')

console.warn('[WARN] auto-isolation is an experimental feature.')

program
  .arguments('[repository]')
  .option('-d, --disable', 'Disable Auto Isolation.')
  .option('-e, --enable', 'Enable Auto Isolation.')
  .description('List or toggle Auto Isolation for a Repository.')
  .parse(process.argv)

const options = pick(program, [ 'disable', 'enable' ])
options.repository = program.args.shift()

AutoIsolation.handleAutoIsolation(options)
  .catch(Utils.handleError)
