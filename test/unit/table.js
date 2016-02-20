'use strict'

require('colors')
var assert = require('chai').assert

var Table = require('../../lib/table')

describe('Table Generator', function () {
  it('should format data as we expect', function () {
    var data = [
      { Container: 'api/master', State: 'Running', 'Container URL': 'akdo1.runnableapp.com' },
      { Container: 'api/anton-test', State: 'Running', 'Container URL': 'akdo2.runnableapp.com' },
      { Container: 'api/better-fatal-errors', State: 'Building', 'Container URL': 'akdo3.runnableapp.com' }
    ]

    var expected = [
      'Container'.bold + '                ' + 'State'.bold + '     ' + 'Container URL'.bold,
      'api/master               Running   akdo1.runnableapp.com',
      'api/anton-test           Running   akdo2.runnableapp.com',
      'api/better-fatal-errors  Building  akdo3.runnableapp.com',
      ''
    ]

    var actual = Table.print(data).split('\n').map(function (s) { return s.trim() })
    assert.deepEqual(actual, expected)
  })
})
