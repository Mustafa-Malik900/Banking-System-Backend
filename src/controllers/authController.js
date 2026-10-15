const userModel = require("../models/user.model")
const jwt = require("jsonwebtoken")
const emailService = require("../services/email.services")
const tokenBlackListModel = require("../models/blackList.model")


/**
 * - User Registration Controller  
 * - POST /api/auth/register
 */
const userRegisterController = async (req, res) => {
    const { name, email, password } = req.body

    const isExist = await userModel.findOne({ email: email })

    if (isExist) {
        return res.status(400).json({
            status: "failed",
            message: "Email already exists"
        })
    }

    const user = await userModel.create({
        name, email, password
    })

    const token = jwt.sign({
        userId: user._id,


    }, process.env.JWT_SECRET, { expiresIn: "3d" })

    res.cookie("token", token);
    res.status(201).json({
        status: "success",
        message: "User registered successfully",
        user: {
            name: user.name,
            email: user.email,
            token: token
        }
    });

    await emailService.sendRegistrationEmail(user.email, user.name)

}

/**
 * - POST /api/auth/Login
 */
const userLoginController = async (req, res) => {
    const { email, password } = req.body

    const user = await userModel.findOne({ email: email }).select("+password")

    if (!user) {
        return res.status(401).json({
            status: "failed",
            message: "Invalid email or password"
        })
    }

    const isPasswordValid = await user.comparePassword(password)

    if(!isPasswordValid){
        return res.status(401).json({
            status: "failed",
            message: "Invalid email or password"
        })
    }

    const token = jwt.sign({
        userId: user._id,


    }, process.env.JWT_SECRET, { expiresIn: "3d" })

    res.cookie("token", token)

    res.status(200).json({
        status: "success",
        message: "User logged in successfully",
        user: {
            _id: user._id,
            name: user.name,
            email: user.email
        },
        token
    })
}


async function userLogOutController(req, res) {
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1]
    if(!token){
        return res.status(200).json({
        message: "User logged out successfully"
        })
    }

    res.cookie("token", "")
    await tokenBlackListModel.create({
        token: token
    })
    res.status(200).json({
        message: "User logged out successfully"
    })
}

module.exports = { userRegisterController, userLoginController, userLogOutController }