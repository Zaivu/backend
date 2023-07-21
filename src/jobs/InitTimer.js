const invokeLambda = ({ nodeId }) => nodeId;

module.exports = {
  key: "InitTimerEvent",
  async handle({ data }) {
    const { nodeId } = data;

    console.log("Processo: ", nodeId);

    //chamar lambda aqui com os dados
    invokeLambda(nodeId);
  },
};
