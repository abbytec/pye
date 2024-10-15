const { Schema, model } = require('mongoose')

/**
 * Used to save how many messages an user have on a channel and then grant roles
 * @typedef {Object} TextMessages
 * @property {string} id
 * @property {string} channelId
 * @property {number} messages
 */

/**
 * @type {Schema<TextMessages>}
 */
const schemaMessages = new Schema({
  id: {
    type: String,
    required: true
  },
  channelId: {
    type: String,
    required: true
  },
  messages: {
    type: Number,
    default: 0
  }
}, { versionKey: false })

exports.TextMessages = model('TextMessages', schemaMessages)