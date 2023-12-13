

module.exports = {

  removeAllVersionsPerma: async function(flowId, { FlowModel, Node, Edge }) {
    const allVersions = await FlowModel.find({ parentId: flowId, type: 'version' });
    return Promise.all(allVersions.map(async (item) => {
      await Node.remove({ flowId: item._id });
      await Edge.remove({ flowId: item._id });
      await FlowModel.findOneAndRemove({ _id: item._id });
    }))
  },


  removeModelPerma: async function(flowId, { FlowModel, Node, Edge }) {
    await Node.remove({ flowId });
    await Edge.remove({ flowId });
    await FlowModel.findOneAndRemove({ _id: flowId });
    return { flowId }
  },

  //Remove um modelo do tipo 'main'
  removeMainFlow: async function(current, { FlowModel, Node, Edge }) {

    const flowId = current._id;

    const allVersions = await FlowModel.find({ parentId: flowId, type: 'version' });
    let mainVersion;
    // Verifica se não há versões para substituir a versão base 
    if (allVersions.length > 0) {

      const minDateVersion = allVersions.reduce((minItem, currentItem) => {
        const currentDate = new Date(currentItem.createdAt);
        const minDate = new Date(minItem.createdAt);
        return currentDate < minDate ? currentItem : minItem;
      }, allVersions[0]);

      //A versão mais antiga será utilizada como a nova base

      mainVersion = await FlowModel.findByIdAndUpdate(
        { _id: minDateVersion._id },
        {
          default: current.default && JSON.stringify(current.default)
            !== JSON.stringify(minDateVersion._id)
            ? current.default : null,
          type: 'main',
          parentId: null,
        },
        { new: true })

      // Update the new ParentId
      await Promise.all(allVersions.map(async (version) => {
        if (version._id !== minDateVersion._id) {
          await FlowModel.findByIdAndUpdate(
            { _id: version._id },
            { parentId: minDateVersion._id },
            { new: true }
          )
        }
      }))
    }

    //Remove the main Version
    await Node.remove({ flowId });
    await Edge.remove({ flowId });
    await FlowModel.findOneAndRemove({ _id: flowId });


    if (mainVersion) {
      return { flowId: mainVersion._id, default: mainVersion.default }
    } else {
      return false;
    }


  },







}
