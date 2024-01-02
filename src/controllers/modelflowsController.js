// modelflowsController.js
class ModelflowsController {
  constructor(modelflowsService) {
    this.modelflowsService = modelflowsService;
  }

  async pagination(req, res) {
    try {
      const { page = "1" } = req.params;
      const query = req.query;
      const user = req.user;
      const tenantId = user.tenantId ? user.tenantId : user._id; //Caso admin ou tenantID

      const modelflows = await this.modelflowsService.pagination(
        tenantId,
        page,
        query
      );

      res.status(200).send(modelflows);
    } catch (error) {
      const code = error.code ? error.code : "412";
      res.status(code).send({ error: error.message, code });
    }
  }

  async list(req, res) {
    try {
      const user = req.user;
      const tenantId = user.tenantId ? user.tenantId : user._id;

      const projects = await this.modelflowsService.list(tenantId);
      res.status(200).send({ projects });
    } catch (error) {
      const code = error.code ? error.code : "412";
      res.status(code).send({ error: error.message, code });
    }
  }

  async getFlow(req, res) {
    try {
      const { flowId } = req.params;

      const user = req.user;
      const tenantId = user.tenantId ? user.tenantId : user._id;

      const flow = await this.modelflowsService.getFlow(flowId, tenantId);
      res.status(200).send({ flow });
    } catch (error) {
      const code = error.code ? error.code : "412";
      res.status(code).send({ error: error.message, code });
    }
  }

  async newProject(req, res) {
    try {
      const user = req.user;
      const tenantId = user.tenantId ? user.tenantId : user._id;
      const elements = req.body.elements;
      const options = req.body.flow;

      const flow = await this.modelflowsService.newProject(
        tenantId,
        options,
        elements
      );

      res.status(201).send({ flow });
    } catch (error) {
      const code = error.code ? error.code : "412";
      res.status(code).send({ error: error.message, code });
    }
  }

  async newModel(req, res) {
    try {
      const user = req.user;
      const tenantId = user.tenantId ? user.tenantId : user._id;
      const elements = req.body.elements;
      const options = req.body.flow;

      const flow = await this.modelflowsService.newModel(
        tenantId,
        options,
        elements
      );

      res.status(201).send({ flow });
    } catch (error) {
      const code = error.code ? error.code : "412";
      res.status(code).send({ error: error.message, code });
    }
  }

  async copy(req, res) {
    try {
      const { flowId, title } = req.body;
      const copiedFlow = await this.modelflowsService.copy(flowId, title);
      res.status(201).send({ flow: copiedFlow });
    } catch (error) {
      const code = error.code ? error.code : "412";
      res.status(code).send({ error: error.message, code });
    }
  }

  async rename(req, res) {
    const { flowId, parentId, title } = req.body;
    try {
      const flow = await this.modelflowsService.rename(flowId, parentId, title);
      res.status(200).send({ flow });
    } catch (error) {
      const code = error.code ? error.code : "412";
      res.status(code).send({ error: error.message, code });
    }
  }

  async edit(req, res) {
    try {
      const { flowId, title, elements } = req.body;
      const flow = await this.modelflowsService.edit(flowId, title, elements);
      res.status(200).send({ flow });
    } catch (error) {
      const code = error.code ? error.code : "412";
      res.status(code).send({ error: error.message, code });
    }
  }

  async setDefault(req, res) {
    const { flowId, versionId } = req.body;
    try {
      const flow = await this.modelflowsService.setDefault(flowId, versionId);
      res.status(200).send({ flow });
    } catch (error) {
      const code = error.code ? error.code : "412";
      res.status(code).send({ error: error.message, code });
    }
  }

  async deleteProject(req, res) {
    try {
      const { flowId } = req.params;
      const user = req.user;
      const tenantId = user.tenantId ? user.tenantId : user._id; //Caso admin ou tenantID

      const flow = await this.modelflowsService.deleteProject(flowId, tenantId);
      res.status(204).send({ flow });
    } catch (error) {
      const code = error.code ? error.code : "412";
      res.status(code).send({ error: error.message, code });
    }
  }

  async deleteFlow(req, res) {
    try {
      const { flowId } = req.params;
      const user = req.user;
      const tenantId = user.tenantId ? user.tenantId : user._id; //Caso admin ou tenantID

      const flow = await this.modelflowsService.deleteFlow(flowId, tenantId);
      res.status(204).send({ flow });
    } catch (error) {
      const code = error.code ? error.code : "412";
      res.status(code).send({ error: error.message, code });
    }
  }
}

module.exports = ModelflowsController;
