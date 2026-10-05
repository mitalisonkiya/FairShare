const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema({
  name: String,
  members: [String],  // emails
  joinCode: { type: String, unique: true },  // NEW FIELD
});

module.exports = mongoose.model("Group", groupSchema);
