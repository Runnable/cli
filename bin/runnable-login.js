'use strict'

const fs = require('fs')
const program = require('commander')

const Login = require('../lib/login')
const Utils = require('../lib/utils')

program
  .description('Authenticate with the Runnable CLI.')
  .option('-t, --token <token>', 'Provide access token for authentication.')
  .parse(process.argv)

let method = Login.login
if (program.token) {
  method = Login.loginToken
}
method(program)
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
