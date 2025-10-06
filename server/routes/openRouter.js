const express = require("express")
const {handleUserSignUP, handleUserlogin,} = require("../controllers/user")
const router= express.Router()



router.get("/", (req, res)=>{
    res.render("open");
})


router.get("/home", (req, res)=>{
    res.render("homeOpen")
})


module.exports = router;

