'use strict'

const fs = require('fs')
const sinon = require('sinon')

const Runnable = require('../../lib/runnable')

describe('Runnable Class', () => {
  describe('_assertFileExists', () => {
    beforeEach(() => {
      sinon.stub(fs, 'existsSync').returns(true)
      sinon.stub(fs, 'writeFileSync')
    })

    afterEach(() => {
      fs.existsSync.restore()
      fs.writeFileSync.restore()
    })

    it('should check to see if the file exists', () => {
      Runnable._assertFileExists('myfile')
      sinon.assert.calledOnce(fs.existsSync)
      sinon.assert.calledWithExactly(
        fs.existsSync,
        'myfile'
      )
    })

    it('should not write anything if the file exists', () => {
      Runnable._assertFileExists('myfile')
      sinon.assert.notCalled(fs.writeFileSync)
    })

    it('should write an empty string if nothing provided', () => {
      fs.existsSync.returns(false)
      Runnable._assertFileExists('myfile')
      sinon.assert.calledOnce(fs.writeFileSync)
      sinon.assert.calledWithExactly(
        fs.writeFileSync,
        'myfile',
        ''
      )
    })

    it('should write an any given value', () => {
      fs.existsSync.returns(false)
      Runnable._assertFileExists('myfile', 'foobar')
      sinon.assert.calledOnce(fs.writeFileSync)
      sinon.assert.calledWithExactly(
        fs.writeFileSync,
        'myfile',
        'foobar'
      )
    })
  })

  describe('_init', () => {
    beforeEach(() => {
      sinon.stub(fs, 'readdirSync').returns(true)
      sinon.stub(fs, 'mkdirSync')
    })

    afterEach(() => {
      fs.readdirSync.restore()
      fs.mkdirSync.restore()
    })

    it('should check that the runnable folder exists', () => {
      Runnable._init()
      sinon.assert.calledOnce(fs.readdirSync)
      sinon.assert.calledWithExactly(
        fs.readdirSync,
        sinon.match(/.+\.runnable$/)
      )
    })

    it('should not create the runnable folder if it exists', () => {
      Runnable._init()
      sinon.assert.notCalled(fs.mkdirSync)
    })

    it('should create the runnable folder if it did not exist', () => {
      fs.readdirSync.throws(new Error('nope'))
      Runnable._init()
      sinon.assert.calledOnce(fs.mkdirSync)
      sinon.assert.calledWithExactly(
        fs.mkdirSync,
        sinon.match(/.+\.runnable$/)
      )
    })
  })
})
