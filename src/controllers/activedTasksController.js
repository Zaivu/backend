class ActivedTasksController {
  constructor(activedTasksService) {
    this.activedTasksService = activedTasksService;
  }
  async pagination(req, res) {
    try {
      const { page = "1" } = req.params;
      const user = req.user;
      const queries = req.query;

      const tasks = await this.activedTasksService.pagination(
        user,
        queries,
        page
      );

      res.status(200).send(tasks);
    } catch (error) {
      const code = error.code ? error.code : "412";
      res.status(code).send({ error: error.message, code });
    }
  }
  async getUserStats(req, res) {
    try {
      const { id } = req.params;
      const user = req.user;
      const tenantId = user.tenantId ? user.tenantId : user._id;

      const dates = req.body;

      const data = await this.activedTasksService.getUserStats(
        id,
        tenantId,
        dates
      );

      res.status(200).send(data);
    } catch (error) {
      const code = error.code ? error.code : "412";
      res.status(code).send({ error: error.message, code });
    }
  }

  async getUsersByTenant(req, res) {
    try {
      const user = req.user;
      const userId = user._id;
      const tenantId = user.tenantId ? user.tenantId : user._id;

      const users = await this.activedTasksService.getUsersByTenant(
        userId,
        tenantId
      );

      res.status(200).send(users);
    } catch (error) {
      const code = error.code ? error.code : "412";
      res.status(code).send({ error: error.message, code });
    }
  }
  async setAccountable(req, res) {
    try {
      const { userId, id: taskId } = req.body;
      const user = req.user;
      const tenantId = user.tenantId ? user.tenantId : user._id;

      const task = await this.activedTasksService.setAccountable(
        taskId,
        userId,
        tenantId
      );
      res.status(200).send(task);
    } catch (error) {
      const code = error.code ? error.code : "412";
      res.status(code).send({ error: error.message, code });
    }
  }
  async setAccountableMultiple(req, res) {
    try {
      const { userId, tasksList } = req.body;
      const user = req.user;
      const tenantId = user.tenantId ? user.tenantId : user._id;

      const tasks = await this.activedTasksService.setAccountableMultiple(
        tasksList,
        userId,
        tenantId
      );
      res.status(200).send(tasks);
    } catch (error) {
      const code = error.code ? error.code : "412";
      res.status(code).send({ error: error.message, code });
    }
  }
  async setLabel(req, res) {
    try {
      const { label, taskId } = req.body;

      const user = req.user;
      const tenantId = user.tenantId ? user.tenantId : user._id;
      const task = await this.activedTasksService.setLabel(
        taskId,
        tenantId,
        label
      );
      res.status(200).send(task);
    } catch (error) {
      const code = error.code ? error.code : "412";
      res.status(code).send({ error: error.message, code });
    }
  }
  async removeAccountable(req, res) {
    try {
      const { id: taskId } = req.params;
      const user = req.user;
      const tenantId = user.tenantId ? user.tenantId : user._id;

      const task = await this.activedTasksService.removeAccountable(
        taskId,
        tenantId
      );
      res.status(200).send(task);
    } catch (error) {
      const code = error.code ? error.code : "412";
      res.status(code).send({ error: error.message, code });
    }
  }
}

module.exports = ActivedTasksController;
