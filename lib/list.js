'use strict'

const inflect = require('inflect')
const keypather = require('keypather')()
const Promise = require('bluebird')

const Runnable = require('./runnable')

class List extends Runnable {
  static listContainersForRepository (args) {
    return Promise.try(() => {
      if (!args.repository) {
        throw new Error('<repository> is required')
      }
      return Promise.fromCallback((callback) => {
        const opts = {
          githubUsername: List.user._org
        }
        List.user.fetchInstances(opts, callback)
      })
        .then(function filterByRepository (instances) {
          const lowerRepo = args.repository.toLowerCase()
          return instances.filter((i) => {
            const fullRepo = keypather.get(i, 'contextVersion.appCodeVersions[0].lowerRepo')
            if (!fullRepo) { return false }
            const repo = fullRepo.split('/').pop()
            return repo === lowerRepo
          })
        })
        .then(function generateDataTable (instances) {
          return instances.map((i) => {
            let repo = keypather.get(i, 'contextVersion.appCodeVersions[0].lowerRepo')
            let containerStatus = keypather.get(i, 'container.inspect.State.Status') || '-'
            containerStatus = inflect.capitalize(containerStatus)
            repo = repo.split('/').pop()
            const branch = keypather.get(i, 'contextVersion.appCodeVersions[0].lowerBranch')
            let name = repo
            name = branch === 'master'
              ? name += '/master'
              : name += `/${branch}`
            const orgName = List.user._org.toLowerCase()
            return {
              Container: name,
              Status: containerStatus,
              'Container URL': `${i.shortHash}-${repo}-staging-${orgName}.runnableapp.com`
            }
          })
        })
    })
  }

  static listContainerSummary (args) {
    return Promise.fromCallback(function fetchInstances (callback) {
      const opts = {
        githubUsername: List.user._org
      }
      List.user.fetchInstances(opts, callback)
    })
      .then(function gatherSummary (instances) {
        const repoMap = {}
        const servicesMap = {}

        // gather the information
        instances.forEach((i) => {
          const repo = keypather.get(i, 'contextVersion.appCodeVersions[0].lowerRepo')
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
        const repositories = Object.keys(repoMap).map((fullRepo) => {
          const repo = fullRepo.split('/').pop()
          let count = repoMap[fullRepo]
          count += count > 1
            ? ' containers'
            : ' container'
          return {
            Repositories: repo,
            Count: count
          }
        })
        const services = Object.keys(servicesMap).map((lowerName) => {
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
  }
}

module.exports = List
