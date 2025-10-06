const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
        },
        password: {
            type: String,
            required: false,
        },
        googleId: {
            type: String,
            unique: true,
            sparse: true,
        },
        providers: {
            type: [String],
            enum: ['password', 'google'],
            default: ['password'],
        },
        photo:{
            type:String,
        },
        resetPasswordToken: String,
        resetPasswordExpires: Date,
    },
    { timestamps: true }
);
const User = mongoose.model("User", userSchema);
module.exports = User;
