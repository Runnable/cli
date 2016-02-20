'use strict'

var assign = require('101/assign')

var functions = {}
assign(functions, require('./list'))
assign(functions, require('./login'))
assign(functions, require('./logs'))
assign(functions, require('./ssh'))
assign(functions, require('./upload'))

module.exports = functions
