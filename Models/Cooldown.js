const { Schema, model } = require('mongoose')

const cooldownSchema = new Schema({
  user: {
    type: String,
    required: true
  },
  command: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  }
}, { versionKey: false })

exports.Cooldowns = model('Cooldowns', cooldownSchema)