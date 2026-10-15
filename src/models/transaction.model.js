const mongoose = require("mongoose")

const transactionSchema  = new mongoose.Schema({
    fromAccount: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "account",
        required: [true, "Transacton must be associated with a fromAccount"],
        index: true
    },
    toAccount: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "account",
        required: [true, "Transacton must be associated with a ToAccount"],
        index: true
     },
     status:{
        type: String,
        enum: {
            values : ["PENDING", "COMPLETED", "FAILED", "REVERED"],
            message: "Status must be either PENDING, COMPLETED, FAILED, or REVERED"
        }
     },
    amount: {
        type: Number,
        required: [true, "Transaction amount is required"],
        min: [0, "Transaction amount must be a positive number"]
    },
    idempotencyKey: {
        type: String,
        required: [true, "Idempotency key is required for transaction"],
        index: true,
        unique: true
    },
},
{
    timestamps: true
}

)


const transactionModel = mongoose.model("transaction", transactionSchema)

module.exports = transactionModel