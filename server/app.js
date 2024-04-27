const express = require("express");
require("dotenv").config();
const session = require("express-session");
const User = require("./models/user.js");
const Chat = require("./models/chat.js");
const Message = require("./models/message.js");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const asyncHandler = require("express-async-handler");
const { isUserExist } = require("./middlewares/isUserExist.js");
const cors = require("cors");
const mongoose = require('mongoose');
const { isLoggedIn } = require("./middlewares/isLoggedIn.js");
const { generateToken } = require("./middlewares/generateToken.js");
const ExpressError = require("./helper/ExpressError.js");
const useRoute = require("./routes/user.js");
const chatRoute = require("./routes/chat.js");
const groupRoute = require("./routes/group.js");
const messageRoute = require("./routes/message.js");
const app = express();
const PORT = process.env.PORT || 3000;

const store = MongoStore.create({
  mongoUrl: process.env.DB_URL,
  secret: process.env.SECRET,
  touchAfter: 24 * 3600,
});

store.on("error", (err) => {
  console.log("Mongo Session Error", err);
});

const sessionOptions = {
  store: store,
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
  },
};

app.use(flash());
app.use(cors());
app.use(session(sessionOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Passport Initialization
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


app.use("/", useRoute);
app.use("/", chatRoute);
app.use("/", messageRoute);
app.use("/", groupRoute);



app.all("*", (req, res)=> {
  res.status(404).json({message: "Page Not Found"});
})

app.use((err, req, res, next) => {
  let {status = 500, message = "Some Error Occured"} = err;
  if (message == "Unauthorized") {
        message = "Please Enter A Valid Password";
  }
  res.status(status).json(message);
});

const server = app.listen(PORT, () => {
  console.log(`Listening To ${PORT}`);
});

const io = require("socket.io")(server, {
  cors: {
      origin: "*",
  },
  pingTimeout: 60000,
});

io.on("connection", (socket) => {
  console.log("Connection Established");

  socket.on("setup", (userData) => {
      socket.join(userData._id);
      console.log("Server Joined");
      socket.emit("connected");
  });

  socket.on("joinChat", (chatId) => {
      socket.join(chatId);
      console.log("Room Joined");
  });

  socket.on("newMessage", (newMessage) => {
      io.to(newMessage.chatId).emit("messageReceived", newMessage);
  });
});


main().catch(err => console.log(`Please check your internet connection ${err.message}`));

async function main() {
  await mongoose.connect(process.env.DB_URL);
  console.log("Database is ready!");
}
