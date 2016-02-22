'use strict'

var Promise = require('bluebird')
var inflect = require('inflect')
var keypather = require('keypather')()

module.exports = {
  listContainersForRepository: Promise.method(function (args) {
    if (!args.repository) {
      throw new Error('<repository> is required')
    }
    return Promise.fromCallback(function fetchInstances (callback) {
      var opts = {
        githubUsername: args._user._org
      }
      args._user.fetchInstances(opts, callback)
    })
      .then(function filterByRepository (instances) {
        var lowerRepo = args.repository.toLowerCase()
        return instances.filter(function (i) {
          var fullRepo = keypather.get(i, 'contextVersion.appCodeVersions[0].lowerRepo')
          if (!fullRepo) { return false }
          var repo = fullRepo.split('/').pop()
          return repo === lowerRepo
        })
      })
      .then(function generateDataTable (instances) {
        return instances.map(function (i) {
          var repo = keypather.get(i, 'contextVersion.appCodeVersions[0].lowerRepo')
          var containerStatus = keypather.get(i, 'container.inspect.State.Status') || '-'
          containerStatus = inflect.capitalize(containerStatus)
          repo = repo.split('/').pop()
          var branch = keypather.get(i, 'contextVersion.appCodeVersions[0].lowerBranch')
          var name = repo
          name = branch === 'master'
            ? name += '/master'
            : name += '/' + branch
          var orgName = args._user._org.toLowerCase()
          return {
            Container: name,
            Status: containerStatus,
            'Container URL': i.shortHash + '-' + repo + '-staging-' + orgName + '.runnableapp.com'
          }
        })
      })
  }),

  listContainerSummary: Promise.method(function (args) {
    return Promise.fromCallback(function fetchInstances (callback) {
      var opts = {
        githubUsername: args._user._org
      }
      args._user.fetchInstances(opts, callback)
    })
      .then(function gatherSummary (instances) {
        var repoMap = {}
        var servicesMap = {}

        // gather the information
        instances.forEach(function (i) {
          var repo = keypather.get(i, 'contextVersion.appCodeVersions[0].lowerRepo')
          if (repo) {
            if (repoMap[repo]) {
              repoMap[repo] += 1
            } else {
              repoMap[repo] = 1
            }
          } else {
            // TODO(bkendall): there will be a time (isolation) when multiple
            // non-repository containers will exist, but I don't have a good
            // way of gathering them now. Keep a 1 count for each service.
            servicesMap[i.lowerName] = 1
          }
        })

        // bring it into the correct format
        var repositories = Object.keys(repoMap).map(function (fullRepo) {
          var repo = fullRepo.split('/').pop()
          var count = repoMap[fullRepo]
          count += count > 1
            ? ' containers'
            : ' container'
          return {
            Repositories: repo,
            Count: count
          }
        })
        var services = Object.keys(servicesMap).map(function (lowerName) {
          // TODO(bkendall): there will be a time (isolation) when multiple
          // non-repository containers will exist, but I don't have a good way
          // of gathering them now. Always return 1 count for each service.
          return {
            Services: lowerName,
            Count: '1 container'
          }
        })

        return {
          repositories: repositories,
          services: services
        }
      })
  })
}
