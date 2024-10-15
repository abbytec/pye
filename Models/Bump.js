const { Schema, model } = require('mongoose')

/**
 * @typedef {Object} Bump
 * @property {string} user
 * @property {date} fecha

/**
 * @type {Schema<Bump>}
 */
const bumpSchema = new Schema({
  user: {
    type: String,
    required: true
  },
  fecha: {
    type: Date, 
    required: true
  }
}, { versionKey: false })


exports.Bumps = model('Bumps', bumpSchema)