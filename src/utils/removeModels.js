
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
    },

    removeMainFlow: async function (flowId, { current, FlowModel, Node, Edge }) {

        const allVersions = await FlowModel.find({ parentId: flowId, type: 'version' });

        // Verifica se não há versões para substituir a versão base 
        if (allVersions.length > 0) {

            const minDateVersion = allVersions.reduce((minItem, currentItem) => {
                const currentDate = new Date(currentItem.createdAt);
                const minDate = new Date(minItem.createdAt);
                return currentDate < minDate ? currentItem : minItem;
            }, allVersions[0]);

            //A versão mais antiga será utilizada como a nova base
            await FlowModel.findByIdAndUpdate(
                { _id: minDateVersion._id },
                {
                    default: current.default !== minDateVersion._id ? current.default : null,
                    type: 'main',
                    parentId: null,
                    title: current.title,
                }, { new: true })

        }
        await this.removeModelPerma(flowId, { FlowModel, Node, Edge })


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
                { _id: item._id }, { isDeleted: true }, { new: true }
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