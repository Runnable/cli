'use strict'

const FileCookieStore = require('tough-cookie-filestore')
const Runnable = require('@runnable/api-client')
const fs = require('fs')
const path = require('path')
const request = require('request')

class RunnableClass {
  static _assertFileExists (fileName, emptyValue) {
    const exists = fs.existsSync(fileName)
    if (exists) { return }
    if (!emptyValue) { emptyValue = '' }
    fs.writeFileSync(fileName, emptyValue)
  }

  static _init () {
    const runnableFolder = process.env.RUNNABLE_STORE ||
    path.resolve(process.env.HOME, '.runnable')
    const cookieFile = path.resolve(runnableFolder, 'cookie-jar.json')
    const settingsFile = path.resolve(runnableFolder, 'settings.json')
    const runnableHost = process.env.RUNNABLE_HOST || 'https://api.runnable.io'
    try {
      fs.readdirSync(runnableFolder)
    } catch (err) {
      fs.mkdirSync(runnableFolder)
    }

    RunnableClass._assertFileExists(cookieFile)
    RunnableClass._assertFileExists(settingsFile, '{}')

    const settings = require(settingsFile)

    const runnableOpts = {
      requestDefaults: {
        headers: { 'user-agent': 'runnable-cli' }
      }
    }

    const jar = new FileCookieStore(cookieFile)
    runnableOpts.requestDefaults.jar = request.jar(jar)

    const _user = new Runnable(runnableHost, runnableOpts)
    _user._org = settings.organization

    RunnableClass.user = _user
    RunnableClass.settingsFile = settingsFile
  }
}

RunnableClass._init()

module.exports = RunnableClass
