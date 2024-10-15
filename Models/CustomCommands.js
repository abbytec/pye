const { Schema, model } = require('mongoose')

/**
 * @typedef {Object} CustomCommands
 * @property {string} name
 * @property {object} content
 */

/**
 * @type {Schema<CustomCommands>}
 */
const customCommandSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  content: {
    type: Object,
    required: true
  }
}, { versionKey: false })

exports.CustomCommands = model('Custom-Commands', customCommandSchema)