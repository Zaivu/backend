require("dotenv").config();

require("./models/FlowModel");
require("./models/ActivedFlow");
require("./models/Edge");
require("./models/Node");
require("./models/ActivedEdge");
require("./models/ActivedNode");
require("./models/User");
require("./models/Post");
const express = require("express");
const mongoose = require("mongoose");
const modelRoutes = require("./routes/modelRoutes");
const activedRoutes = require("./routes/activedRoutes");
const authRoutes = require("./routes/authRoutes");
const usersRoutes = require("./routes/usersRoutes");
const activedTaskRoutes = require("./routes/activedTasksRoutes");
const cors = require("cors");
const path = require("path");
const { find } = require("./models/Post");
const ActivedNode = mongoose.model("ActivedNode");
const User = mongoose.model("User");

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb" }));
app.use(
  "/files",
  express.static(path.resolve(__dirname, "..", "tmp", "uploads"))
);

app.get("/", (req, res) => {
  res.status(200).send("ok");
});

app.use(authRoutes);
app.use(modelRoutes);
app.use(activedRoutes);
app.use(usersRoutes);
app.use(activedTaskRoutes);

const mongoUri = process.env.MONGO_URL;
mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

mongoose.connection.on("connected", () => {
  console.log("Connected to mongo api // zaivu");
});
mongoose.connection.on("error", (err) => {
  console.error("Error connecting to mongo api", err);
});

app.listen(process.env.PORT || 5000, () => {
  console.log("Listening on port 5000");
});
