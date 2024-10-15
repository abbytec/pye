const { Schema, model } = require('mongoose')

/**
 * @typedef {Object} GuildWelcome
 * @property {string} channel
 * @property {string} message
 * @property {string} image
 * @property {string} text
 */

/**
 * @typedef {Object} Guild
 * @property {string} id
 * @property {GuildWelcome} welcome
 */

/**
 * @type {Schema<Guild>}
 */
const guildSchema = new Schema({
  id: {
    type: String,
    required: true
  },
  welcome: {
    channel: {
      type: String,
      default: ''
    },
    message: {
      type: String,
      default: ''
    },
    image: {
      type: String,
      default: ''
    },
    text: {
      type: String,
      default: ''
    },
  }
}, { versionKey: false })

exports.Guild = model('Guild', guildSchema)