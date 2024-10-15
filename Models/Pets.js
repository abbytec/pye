const { Schema, model } = require('mongoose')

/**
 * @typedef {Object} Pets
 * @property {string} id
 * @property {string} name
 * @property {number} food

/**
 * @type {Schema<Pets>}
 */
const petSchema = new Schema({
  id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    default: 'none',
  },
  food: {
    type: Number, 
    default: 100
  },
  mood: {
    type: Number, 
    default: 100
  },
  shower: {
    type: Number, 
    default: 100
  }
}, { versionKey: false })


exports.Pets = model('Pets', petSchema)