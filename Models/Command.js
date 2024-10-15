const { Schema, model } = require('mongoose')

/**
 * @typedef {Object} Command
 * @property {string} name
 * @property {number} lowestMoney
 * @property {number} highestMoney
 * @property {number} failRate
 * @property {number} cooldown
 */

/**
 * @type {Schema<Command>}
 */
const commandSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  lowestMoney: {
    type: Number,
    default: 10
  },
  highestMoney: {
    type: Number,
    default: 100
  },
  failRate: {
    type: Number,
    default: 0
  },
  cooldown: {
    type: Number,
    default: 0 // EN HORAS
  }
}, { versionKey: false })

exports.Commands = model('Commands', commandSchema)