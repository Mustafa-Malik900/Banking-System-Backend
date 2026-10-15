const transactionModel = require("../models/transaction.model");
const ledgerModel = require("../models/ledger.model");
const accountModel = require("../models/account.model");
const emailService = require("../services/email.services");
const mongoose = require("mongoose")

/**
 * - Create a new transaction
 * THE 10 STEPS OF CREATING A TRANSACTION
 * 1. Validate the request body to ensure that all required fields are present and valid.
 * 2. Validate idemPotencyKey
 * 3. Check Account Status.
 * 4. Derive sender balance from ledger.
 * 5. Create Transaction (PENDING).
 * 6. Create DEBIT ledger entry.
 * 7. Update the balance of the fromAccount in the database.
 * 8. Update the balance of the toAccount in the database.
 * 9. Create ledger entries for both accounts to record the transaction.
 * 10.Send email notification
 */



//  1. Validate the request body to ensure that all required fields are present and valid.

async function createTransaction(req, res) {
    const { fromAccount, toAccount, idempotencyKey } = req.body
    const amount = Number(req.body.amount)

    // 1. Validate body
    if (!fromAccount || !toAccount || !idempotencyKey || !Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({
            message: "Valid fromAccount, toAccount, positive amount, and idempotencyKey are required"
        })
    }
    if (fromAccount === toAccount) {
        return res.status(400).json({ message: "fromAccount and toAccount must be different" })
    }
    if (!mongoose.isValidObjectId(fromAccount) || !mongoose.isValidObjectId(toAccount)) {
        return res.status(400).json({ message: "Invalid account id format" })
    }

    const [fromUserAccount, toUserAccount] = await Promise.all([
        accountModel.findById(fromAccount),
        accountModel.findById(toAccount)
    ])
    if (!fromUserAccount || !toUserAccount) {
        return res.status(400).json({ message: "Invalid fromAccount or toAccount" })
    }

    // Authorization: system user can move money between any accounts,
    // a normal user can only debit their own account
    const isSystemUser = req.user.systemUser === true   // adjust to your user model field
    if (!isSystemUser && fromUserAccount.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "You can only transfer from your own account" })
    }

    // 2. Idempotency
    const existing = await transactionModel.findOne({ idempotencyKey })
    if (existing) {
        const responses = {
            COMPLETED: [200, "Transaction already processed", { transaction: existing }],
            PENDING:   [200, "Transaction is still processing"],
            FAILED:    [500, "Transaction processing failed, please retry"],
            REVERSED:  [200, "Transaction was reversed, please retry"],
        }
        const [code, message, extra] = responses[existing.status] || [409, "Unknown transaction state"]
        return res.status(code).json({ message, ...extra })
    }

    // 3. Account status
    if (fromUserAccount.status !== "ACTIVE" || toUserAccount.status !== "ACTIVE") {
        return res.status(400).json({
            message: "Both fromAccount and toAccount must be ACTIVE to process transaction"
        })
    }

    // 4. Balance from ledger
    const balance = await fromUserAccount.getBalance()
    if (balance < amount) {
        return res.status(400).json({
            message: `Insufficient balance, Current balance is ${balance}, Requested amount is ${amount}`
        })
    }

    // 5-9. Atomic debit + credit
    const session = await mongoose.startSession()
    let transaction
    try {
        session.startTransaction();

            [transaction] = await transactionModel.create([{
            fromAccount: fromUserAccount._id,
            toAccount: toUserAccount._id,
            amount,
            idempotencyKey,
            status: "PENDING"
        }], { session })

        await ledgerModel.create([
            { account: fromUserAccount._id, amount, transaction: transaction._id, type: "DEBIT" },
            { account: toUserAccount._id,   amount, transaction: transaction._id, type: "CREDIT" }
        ], { session, ordered: true })

        transaction.status = "COMPLETED"
        await transaction.save({ session })

        await session.commitTransaction()
    } catch (err) {
        await session.abortTransaction()
        if (err.code === 11000) {   // duplicate idempotencyKey (race condition)
            return res.status(409).json({ message: "Duplicate idempotencyKey, request already in progress" })
        }
        console.error(err)
        return res.status(500).json({ message: "Transaction failed" })
    } finally {
        session.endSession()
    }

    // 10. Email must not break a completed transaction
    try {
        await emailService.sendTransactionEmail(req.user.email, req.user.name, amount, toUserAccount._id)
    } catch (err) {
        console.error("Email failed:", err.message)
    }

    return res.status(201).json({
        message: "Transaction completed successfully",
        transaction: {
            _id: transaction._id,
            fromAccount: transaction.fromAccount,
            toAccount: transaction.toAccount,
            amount: transaction.amount,
            status: transaction.status,
            idempotencyKey: transaction.idempotencyKey
        }
    })
}


async function createInitialFundsTransaction(req, res) {
    const { toAccount, idempotencyKey } = req.body
    const amount = Number(req.body.amount)

    if (!toAccount || !idempotencyKey || !Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({
            message: "toAccount, a positive amount, and idempotencyKey are required"
        })
    }
    if (!mongoose.isValidObjectId(toAccount)) {
        return res.status(400).json({ message: "Invalid account id format" })
    }

    // Only system users may seed money
    if (req.user.systemUser !== true) {   // adjust to your user model field
        return res.status(403).json({ message: "Only system user can add initial funds" })
    }

    const toUserAccount = await accountModel.findById(toAccount)
    if (!toUserAccount) {
        return res.status(400).json({ message: "toAccount not found" })
    }

    const fromUserAccount = await accountModel.findOne({ user: req.user._id })
    if (!fromUserAccount) {
        return res.status(400).json({ message: "System user account not found" })
    }

    // Idempotency
    const existing = await transactionModel.findOne({ idempotencyKey })
    if (existing) {
        return res.status(200).json({
            message: "Transaction already processed",
            transaction: existing
        })
    }

    // NOTE: no balance check here, the system account is the source of new money

    const session = await mongoose.startSession()
    let transaction
    try {
        session.startTransaction();
        
        [transaction] = await transactionModel.create([{
            fromAccount: fromUserAccount._id,
            toAccount: toUserAccount._id,
            amount,
            idempotencyKey,
            status: "PENDING"
        }], { session })

        await ledgerModel.create([
            { account: fromUserAccount._id, amount, transaction: transaction._id, type: "DEBIT" },
            { account: toUserAccount._id,   amount, transaction: transaction._id, type: "CREDIT" }
        ], { session, ordered: true })

        transaction.status = "COMPLETED"
        await transaction.save({ session })

        await session.commitTransaction()
    } catch (err) {
        await session.abortTransaction()
        console.error(err)
        return res.status(500).json({ message: "Initial funds transaction failed" })
    } finally {
        session.endSession()
    }

    return res.status(201).json({
        message: "Initial funds transaction completed successfully",
        transaction
    })
}


module.exports = {
    createTransaction,
    createInitialFundsTransaction
}