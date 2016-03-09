'use strict'

var program = require('commander')

var runnable = require('../lib/runnable')
var Table = require('../lib/table')
var utils = require('../lib/utils')

program
  .arguments('[repository]')
  .description('Lists all repositories and services. Specify a repository to list its containers.')
  .parse(process.argv)

var options = {
  _user: runnable.user,
  repository: program.args.shift()
}

if (options.repository) {
  runnable.listContainersForRepository(options)
    .then(function (results) {
      Table.log(results)
    })
    .catch(utils.handleError)
} else {
  runnable.listContainerSummary(options)
    .then(function (results) {
      function tableFormatter (obj, cell) {
        for (var key in obj) {
          if (!obj.hasOwnProperty(key)) continue
          cell(key === 'Count' ? '' : key, obj[key])
        }
      }
      var repositories = results.repositories
      var services = results.services
      Table.log(repositories, tableFormatter)
      Table.log(services, tableFormatter)
    })
    .catch(utils.handleError)
}
