const express = require("express")
const authMiddleware = require("../middleware/auth.middleware")
const transactionController = require("../controllers/transaction.controller")
const emailService = require("../services/email.services");



const router = express.Router()

/**
 * - POST /api/transactions
 * - Create a transfer between accounts as a system user
 */

router.post("/", authMiddleware.authSystemUserMiddleware, transactionController.createTransaction)


/**
 * - POST /api/transactions/system/initial-funds
 * - Create initial funds transaction from system user
 */

router.post("/system/initial-funds", authMiddleware.authSystemUserMiddleware,transactionController.createInitialFundsTransaction)

module.exports = router