var mongoose = require("mongoose");

var AdminCryptoKeySchema = new mongoose.Schema({
  publicKey: mongoose.Schema.Types.Mixed,
  privateKey: mongoose.Schema.Types.Mixed,
});

const AdminCryptoKey = mongoose.model("AdminCryptoKey", AdminCryptoKeySchema);
module.exports = AdminCryptoKey;
