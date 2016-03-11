'use strict'

const fs = require('fs')
const program = require('commander')

const Login = require('../lib/login')
const Utils = require('../lib/utils')

program
  .description('Authenticate with the Runnable CLI.')
  .parse(process.argv)

Login.login({})
  .then(() => {
    return Login.chooseOrg({})
      .then((org) => {
        fs.writeFileSync(
          Login.settingsFile,
          JSON.stringify({ organization: org })
        )
      })
  })
  .catch(Utils.handleError)
