const { Schema, model } = require('mongoose')


/**
 * @typedef {Object} Giveaway
 * @property {string} name
 * @property {string} mensaje
 * @property {string} canal
 * @property {Number} fin
 * @property {Boolean} acabado
 */

/**
 * @type {Schema<Giveaway>}
 */
const schemaGiveaway = new Schema({
  name: {
    type: String,
    required: true
  },
  creador: {
    type: String,
    required: true
  },
  mensaje: {
    type: String,
    required: true
  },
  canal: {
    type: String,
    required: true
  },
  guild: {
    type: String,
    required: true
  },
  ganadores: {
    type: Number,
    required: true
  },
  fin: {
    type: Number,
    required: true
  },
  acabado: {
    type: Boolean,
    required: true,
    default: false
  }
}, { versionKey: false })

exports.Giveaway = model('Giveaway', schemaGiveaway)