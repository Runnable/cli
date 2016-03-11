'use strict'

const program = require('commander')

const Upload = require('../lib/upload')
const Utils = require('../lib/utils')

program
  .arguments('<file> [dest]')
  .description('Upload a file to the container for your local branch.')
  .parse(process.argv)

const file = program.args.shift()
const path = program.args.shift()

const options = {
  file,
  path
}
Upload.uploadFile(options)
  .then(() => {
    console.log('Uploaded file.')
  })
  .catch(Utils.handleError)
