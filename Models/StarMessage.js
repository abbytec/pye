const { Schema, model } = require('mongoose')

/**
 * @typedef {Object} StarMessage
 * @property {string} msgId
 */

/**
 * @type {Schema<StarMessage>}
 */
const schemaStarMessage = new Schema({
  msgId: {
    type: String,
    required: true
  },
  responseId: {
    type: String,
    required: true
  }
}, { versionKey: false })

exports.StarMessage = model('StarMessage', schemaStarMessage)