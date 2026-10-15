const mongoose = require('mongoose')

async function connectDB(){
    try {
        
        await mongoose.connect(process.env.MONGO_URI)
        console.log("Database connected successfully")
    } catch (err) {
        console.error("Database connection error:", err);
        process.exit(1)
        
    }
}

module.exports = connectDB