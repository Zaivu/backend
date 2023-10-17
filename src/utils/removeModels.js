
module.exports = {

    removeAllVersionsPerma: async function (flowId, { FlowModel, Node, Edge }) {

        const allVersions = await FlowModel.find({ parentId: flowId, type: 'version' });
        return Promise.all(allVersions.map(async (item) => {
            await Node.remove({ flowId: item._id });
            await Edge.remove({ flowId: item._id });
            await FlowModel.findOneAndRemove({ _id: item._id });
        }))

    },

    removeModelPerma: async function (flowId, { FlowModel, Node, Edge }) {
        await Node.remove({ flowId });
        await Edge.remove({ flowId });
        await FlowModel.findOneAndRemove({ _id: flowId });
        return { flowId }
    }

    // removeAllVersions: async function (flowId, { FlowModel, Node, Edge }) {
    // }
}