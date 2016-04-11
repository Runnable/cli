'use strict'

const program = require('commander')

const Compose = require('../lib/compose')
const Utils = require('../lib/utils')

program
  .arguments('<repository>')
  .description('Print a .json file to use with Docker Compose.')
  .parse(process.argv)

const options = {
  repository: program.args.shift()
}

Compose.generateJSON(options)
  .then((result) => {
    console.log(result)
  })
  .catch(Utils.handleError)
