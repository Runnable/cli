'use strict'

const keypather = require('keypather')()
const Promise = require('bluebird')

const Runnable = require('./runnable')
const Utils = require('./utils')

class Compose extends Runnable {
  static generateJSON (args) {
    return Utils.getRepositoryAndInstance(args)
      .spread((argsWithRepo, instance) => {
        return instance
      })
      .then((instance) => {
        const servicesTree = {}

        function gogoTree (node) {
          return Promise.try(() => {
            console.log(`. looking at ${node.lowerName}`)
            if (servicesTree[node.lowerName]) {
              console.log(`! already analized ${node.lowerName}`)
              return
            }
            const iModel = Compose.user.newInstance(node.id)
            return Promise.fromCallback((cb) => {
              iModel.fetch(cb)
            })
              .then((iData) => {
                const name = iData.lowerName
                servicesTree[name] = {
                  // image: keypather.get(iData, 'contextVersion.build.dockerTag')
                  image: 'alpine',
                  command: 'sleep 15'
                }
                return Promise.fromCallback((cb) => {
                  iModel.fetchDependencies({}, cb)
                })
                  .then((dependencies) => {
                    if (Array.isArray(dependencies) && dependencies.length) {
                      servicesTree[name].depends_on = []
                      dependencies.forEach((d) => {
                        if (servicesTree[d.lowerName]) { return }
                        servicesTree[name].depends_on.push(d.lowerName)
                      })
                      return Promise.each(dependencies, gogoTree)
                    } else {
                      return
                    }
                  })
              })
          })
        }

        return gogoTree(instance)
          .then(() => { return servicesTree })
      })
      .then((data) => {
        return JSON.stringify({
          version: '2',
          services: data
        }, null, 2)
      })
  }
}

module.exports = Compose
