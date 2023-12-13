const ActivedFlow = require("../models/ActivedFlow");
const ActivedEdge = require("../models/ActivedEdge");
const ActivedNode = require("../models/ActivedNode");
const { DateTime } = require('luxon');

const { randomUUID } = require("crypto");


// Função para criar um fluxo ativo no estado base,
// onde somente o eventStart começará como status 'doing'
// É necessário que o progresso do fluxo seja feito posteriormente 
// de forma separada
module.exports = async function addActivedFlow(baseModel, { nodes, edges }) {
  const liveModel = new ActivedFlow({ ...baseModel });
  const activedFlow = await liveModel.save();
  // const activedFlow = liveModel;
  const nodesAndEdges = [...nodes, ...edges].map((item) => {
    const commonFields = {
      type: item.type,
      id: item.id,
      flowId: activedFlow._id,
      tenantId: activedFlow.tenantId,
    };

    if (item.source) {
      return new ActivedEdge({
        ...commonFields,
        source: item.source,
        target: item.target,
        sourceHandle: item.sourceHandle,
        targetHandle: item.targetHandle,
        data: { ...item.data, status: "pending" },
      });
    } else {
      return new ActivedNode({
        ...commonFields,
        position: item.position,
        targetPosition: item.targetPosition,
        sourcePosition: item.sourcePosition,
        data: {
          ...item.data,
          status: item.type === 'eventStart' ? 'doing' : "pending",
          ...(item.type === 'eventStart' && {
            startedAt: DateTime.now().toMillis()
          }),

          ...(item.type === "task" && {
            comments: "",
            posts: [],
            subtasks: item.data.subtasks.map((e) => ({
              ...e,
              id: randomUUID(),
            })),
            accountable: null,
            expiration: { ...item.data.expiration },
          }),
        },
      });
    }
  });

  const aElements = await Promise.all(
    nodesAndEdges.map(async (item) => {
      return await item.save();
      // return item;
    })
  );

  const plainAF = activedFlow.toObject({ getters: true, virtuals: true });

  return { elements: aElements, ...plainAF };
};

