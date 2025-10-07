require('dotenv').config();
const express = require("express");
const app= express();
const path = require("path");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const {restrictToLoggedInUserOnly} = require("./middlewares/auth");
const passport = require("./config/passport");


const router= express.Router();

const userRoute = require("./routes/user")
const staticRouter= require("./routes/staticRouter");
const openRouter = require("./routes/openRouter");
const authRouter = require("./routes/auth");
const paymentRouter = require("./routes/payment");
const rootRouter = require("./routes/root");

app.use(express.json());
app.use(express.urlencoded({extended:false}))
app.use(cookieParser());

app.use(express.static(path.join(__dirname, 'public')));
app.use(
    session({
      // Hardcoded session secret
      secret: 'Aaditya@3737',
      resave: false,
      saveUninitialized: false,
    })
  );

app.use(passport.initialize());
app.use(passport.session());
try {
  const setupFlash = require('./middlewares/flash');
  if (typeof setupFlash === 'function') setupFlash(app);
} catch (e) {
  console.error('Flash middleware setup failed:', e && e.message);
}



app.use("/user", userRoute);
app.use("/home", restrictToLoggedInUserOnly, staticRouter);
app.use("/open", openRouter);
app.use("/auth", authRouter);
app.use('/payment', paymentRouter);
app.use('/', rootRouter);

app.set("view engine","ejs");
app.set("views", path.resolve("./views"));



const{connectMongoDB}= require('./connect')
const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/verto';
connectMongoDB(mongoUrl)

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));