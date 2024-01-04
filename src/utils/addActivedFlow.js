const ActivedFlow = require("../models/ActivedFlow");
const ActivedEdge = require("../models/ActivedEdge");
const ActivedNode = require("../models/ActivedNode");
const { DateTime } = require("luxon");
const { randomUUID } = require("crypto");

// Função para criar um fluxo ativo no estado base,
// onde somente o eventStart começará como status 'doing'
// É necessário que o progresso do fluxo seja feito posteriormente
// de forma separada

module.exports = async function addActivedFlow(baseModel, { nodes, edges }) {
  const liveModel = new ActivedFlow({ ...baseModel });
  const activedFlow = await liveModel.save();

  const nodesAndEdges = [...nodes, ...edges].map((item) => {
    const commonFields = {
      type: item.type,
      id: item.id,
      flowId: activedFlow._id,
      tenantId: activedFlow.tenantId,
    };

    if (item.source) {
      // Handling for edges
      return new ActivedEdge({
        ...commonFields,
        source: item.source,
        target: item.target,
        sourceHandle: item.sourceHandle,
        targetHandle: item.targetHandle,
        data: { ...item.data, status: "pending" },
      });
    } else {
      // Handling for nodes using a switch-case structure
      switch (item.type) {
        case "eventStart":
          return new ActivedNode({
            ...commonFields,
            position: item.position,
            data: {
              ...item.data,
              status: "doing", // 'eventStart' nodes begin as 'doing'
              startedAt: DateTime.now().toMillis(), // Record the start time
            },
          });
        case "task":
          return new ActivedNode({
            ...commonFields,
            position: item.position,
            data: {
              ...item.data,
              status: "pending", // 'task' nodes begin as 'pending'
              comments: "",
              posts: [],
              subtasks: item.data.subtasks.map((subtask) => ({
                ...subtask,
                id: randomUUID(), // Assign a unique ID to each subtask
              })),
              accountable: null,
              expiration: { ...item.data.expiration },
            },
          });

        case "customNote":
          return new ActivedNode({
            type: item.type,
            id: item.id,
            flowId: activedFlow._id,
            tenantId: activedFlow.tenantId,
            position: item.position,
            data: {
              ...item.data,
            },
          });

        default:
          // Optionally handle unrecognized node types
          throw new Error(`Unhandled node type: ${item.type}`);
      }
    }
  });

  const aElements = await Promise.all(
    nodesAndEdges.map(async (item) => await item.save())
  );

  const plainAF = activedFlow.toObject({ getters: true, virtuals: true });
  return { elements: aElements, ...plainAF };
};
