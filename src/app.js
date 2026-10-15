const express = require('express')
const authRouter = require("./routes/auth.route")
const cookieParser = require("cookie-parser")
const accountRouter = require("./routes/accounts.route")
const transactionRouter = require("./routes/transaction.routes")



const app = express()
app.use(express.json())
app.use(cookieParser())

app.get("/", (req, res)=> {
    res.send("Banking System is running")
})


app.use("/api/auth", authRouter)
app.use("/api/accounts", accountRouter)
app.use("/api/transactions", transactionRouter)

module.exports = app
