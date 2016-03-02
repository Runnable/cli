'use strict'

var program = require('commander')

var runnable = require('../lib/runnable')

program
  .arguments('<file>')
  .option('-p, --path [path]', 'Destination path in then container for the specified file', '')
  .description('Upload a file to the container for your local branch.')
  .parse(process.argv)

var options = {
  _user: runnable.user,
  file: program.args.shift(),
  path: program.path
}

runnable.uploadFile(options)
  .then(function () {
    console.log('Uploaded file.')
  })
