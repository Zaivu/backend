
module.exports = {

    removeAllVersionsPerma: async function (flowId, { FlowModel, Node, Edge }) {
        const allVersions = await FlowModel.find({ parentId: flowId, type: 'version' });
        return Promise.all(allVersions.map(async (item) => {
            await Node.remove({ flowId: item._id });
            await Edge.remove({ flowId: item._id });
            await FlowModel.findOneAndRemove({ _id: item._id });
        }))
    },

    removeAllVersionsByTag: async function (flowId, { FlowModel, Node, Edge }) {
        const allVersions = await FlowModel.find({ parentId: flowId, type: 'version' });
        return Promise.all(allVersions.map(async (item) => {
            await Node.updateMany(
                { flowId: item._id },
                { $set: { isDeleted: true } },
                { new: true }
            );
            await Edge.updateMany(
                { flowId: item._id }, { $set: { isDeleted: true } }, { new: true }
            );
            await FlowModel.findByIdAndUpdate(
                { _id: item.id }, { isDeleted: true }, { new: true }
            );

        }))
    },
    removeModelByTag: async function (flowId, { FlowModel, Node, Edge }) {

        await Node.updateMany(
            { _id: flowId },
            { $set: { isDeleted: true } },
            { new: true }
        );
        await Edge.updateMany(
            { _id: flowId },
            { $set: { isDeleted: true } },
            { new: true }
        );
        await FlowModel.findByIdAndUpdate(
            { _id: flowId },
            {
                isDeleted: true,
            },
            { new: true }
        );

        return { flowId };
    },

    removeModelPerma: async function (flowId, { FlowModel, Node, Edge }) {
        await Node.remove({ flowId });
        await Edge.remove({ flowId });
        await FlowModel.findOneAndRemove({ _id: flowId });
        return { flowId }
    },



    restoreModelByTag: async function (flowId, { FlowModel, Node, Edge }) {
        await Node.updateMany(
            { _id: flowId },
            { $set: { isDeleted: false } },
            { new: true }
        );
        await Edge.updateMany(
            { _id: flowId },
            { $set: { isDeleted: false } },
            { new: true }
        );
        await FlowModel.findByIdAndUpdate(
            { _id: flowId },
            {
                isDeleted: false,
            },
            { new: true }
        );

        return { flowId };
    },

    restoreAllVersionsByTag: async function (flowId, { FlowModel, Node, Edge }) {
        const allVersions = await FlowModel.find({ parentId: flowId, type: 'version' });
        return Promise.all(allVersions.map(async (item) => {
            await Node.updateMany(
                { flowId: item._id },
                { $set: { isDeleted: false } },
                { new: true }
            );
            await Edge.updateMany(
                { flowId: item._id }, { $set: { isDeleted: false } }, { new: true }
            );
            await FlowModel.findByIdAndUpdate(
                { _id: item.id }, { isDeleted: false }, { new: true }
            );

        }))
    },

}