const { Schema, model } = require('mongoose')

/**
 * @typedef {Object} Reminds
 * @property {string} id
 * @property {string} text
 * @property {number} time
 */

/**
 * @type {Schema<Reminds>}
 */
const schemaReminds = new Schema({
  id: {
    type: String,
    required: true
  },
  channel: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: true
  },
  time: {
    type: Number,
    required: true
  }
}, { versionKey: false })

exports.Reminds = model('Reminds', schemaReminds)