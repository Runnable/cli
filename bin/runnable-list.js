'use strict'

const program = require('commander')

const List = require('../lib/list')
const Table = require('../lib/table')

program
  .arguments('[repository]')
  .description('Lists all repositories and services. Specify a repository to list its containers.')
  .parse(process.argv)

const options = {
  repository: program.args.shift()
}

if (options.repository) {
  List.listContainersForRepository(options)
    .then((results) => {
      Table.log(results)
    })
} else {
  List.listContainerSummary(options)
    .then((results) => {
      function tableFormatter (obj, cell) {
        for (const key in obj) {
          if (!obj.hasOwnProperty(key)) continue
          cell(key === 'Count' ? '' : key, obj[key])
        }
      }
      Table.log(results.repositories, tableFormatter)
      Table.log(results.services, tableFormatter)
    })
}
