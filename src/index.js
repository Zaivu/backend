require("./models/FlowModel");
require("./models/ActivedFlow");
require("./models/Edge");
require("./models/Node");
require("./models/ActivedEdge");
require("./models/ActivedNode");
require("./models/User");
const express = require("express");
const mongoose = require("mongoose");
const modelRoutes = require("./routes/modelRoutes");
const activedRoutes = require("./routes/activedRoutes");
const authRoutes = require("./routes/authRoutes");
const usersRoutes = require("./routes/usersRoutes");
const cors = require("cors");

const AWSXRay = require("aws-xray-sdk");
AWSXRay.config([
  AWSXRay.plugins.EC2Plugin,
  AWSXRay.plugins.ElasticBeanstalkPlugin,
]);

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb" }));

app.get("/", (req, res) => {
  res.status(200).send("ok");
});

app.use(authRoutes);
app.use(modelRoutes);
app.use(activedRoutes);
app.use(usersRoutes);

const mongoUri =
  "mongodb://camboim:Guitarra7762@172.31.15.183:27017/test?authSource=admin";
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
