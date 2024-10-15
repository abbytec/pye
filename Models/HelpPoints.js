const { Schema, model } = require('mongoose')

/**
 * @typedef {Object} HelperPoint
 * @property {string} _id
 * @property {number} point

/**
 * @type {Schema<HelperPoint>}
 */
const helperpointSchema = new Schema({
  _id: {
    type: String,
    required: true
  },
  points: {
    type: Number, 
    default: 0
  }
}, { versionKey: false })


exports.HelperPoint = model('HelperPoint', helperpointSchema)