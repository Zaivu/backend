require("dotenv").config();
require("./models/FlowModel");
require("./models/ActivedFlow");
require("./models/Edge");
require("./models/Node");
require("./models/ActivedEdge");
require("./models/ActivedNode");
require("./models/User");
require("./models/Post");
require("./models/ChatMessage");
require("./models/BackgroundJobs");

//express
const express = require("express");
const mongoose = require("mongoose");

//Rotas
// const modelRoutes = require('./routes/modelRoutes');
const modelflowsRoutes = require("./routes/modelflowsRoutes");
const activedFlowRoutes = require("./routes/activedFlowRoutes");
const authRoutes = require("./routes/authRoutes");
const usersRoutes = require("./routes/usersRoutes");
const activedTaskRoutes = require("./routes/acTasksRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

// utils
const BackgroundJobs = require("./models/BackgroundJobs");
const cors = require("cors");
const path = require("path");
const Queues = require("./lib/Queue");
const app = express();
const setupSocketServer = require("./websockets/server");
const { ExpressAdapter } = require("@bull-board/express");
const { createBullBoard } = require("bull-board");
const { BullAdapter } = require("bull-board/bullAdapter");

//Websockets
const httpServer = setupSocketServer(app);

const serverAdapter = new ExpressAdapter();

//middlewares
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb" }));
app.use(
  "/files",
  express.static(path.resolve(__dirname, "..", "tmp", "uploads"))
);
const nodesQueue = Queues.queues.find((q) => q.name === "ConfirmNode");
Queues.process(BackgroundJobs);

//Bull Queue
serverAdapter.setBasePath("/admin/queues");
const { router } = createBullBoard([new BullAdapter(nodesQueue.bull)]);
app.use("/admin/queues", router);

app.get("/", (req, res) => {
  res.status(200).send("ok");
});

app.use(authRoutes);
app.use(usersRoutes);
app.use(notificationRoutes);
app.use(modelflowsRoutes);
app.use(activedTaskRoutes);
app.use("/activedflows", activedFlowRoutes);

const mongoUri = process.env.MONGO_URL;
mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

mongoose.connection.on("connected", () => {
  console.log("Connected to mongo api // zaivu!");
});
mongoose.connection.on("error", (err) => {
  console.error("Error connecting to mongo api", err);
});

httpServer.listen(process.env.PORT || 5000, () => {
  console.log("Listening on port 5000");
});
