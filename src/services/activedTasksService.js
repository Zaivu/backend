const exceptions = require("../exceptions");

class ActivedTasksService {
  constructor(activedTasksRepository) {
    this.activedTasksRepository = activedTasksRepository;
  }
  async pagination(user, queries, page) {
    return await this.activedTasksRepository.pagination(user, queries, page);
  }
  async getUserStats(userId, tenantId, dates) {
    const userFilter =
      JSON.stringify(userId) === JSON.stringify(tenantId)
        ? { _id: userId }
        : { _id: userId, tenantId };

    const user = await this.activedTasksRepository.getUser(userFilter);

    if (!user) throw exceptions.entityNotFound("Usuário não encontrado.");

    const tasks = await this.activedTasksRepository.getUserStats(user, dates);

    return tasks;
  }
  async getUsersByTenant(userId, tenantId) {
    const userFilter =
      JSON.stringify(userId) === JSON.stringify(tenantId)
        ? { _id: userId }
        : { _id: userId, tenantId };

    const user = await this.activedTasksRepository.getUser(userFilter);

    if (!user) throw exceptions.entityNotFound("Usuário não encontrado.");

    const userFilters =
      user.rank === "admin"
        ? { $or: [{ tenantId }, { _id: user._id }] }
        : user.rank === "gerente"
        ? {
            $or: [
              { _id: user._id, tenantId },
              { rank: "colaborador", tenantId },
            ],
          }
        : { _id: user._id, tenantId };

    const relatedUsers = (
      await this.activedTasksRepository.getTenantUsersWithAvatars({
        ...userFilters,
        isDeleted: false,
        status: "active",
      })
    ).map(
      (user) =>
        (user = {
          rank: user.rank,
          _id: user._id,
          username: user.username,
          email: user.email,
          avatarURL: user.avatarURL,
        })
    );

    return relatedUsers;
  }
  async getDashboardUsersProductivity(tenantId, startDate) {
    return await this.activedTasksRepository.getDashboardUsersProductivity(
      tenantId,
      startDate
    );
  }
  async getDashboardTasksProductivity(tenantId, startDate) {
    return await this.activedTasksRepository.getDashboardTasksProductivity(
      tenantId,
      startDate
    );
  }
  async getDashboardFlowsProductivity(tenantId) {
    return await this.activedTasksRepository.getDashboardFlowsProductivity(
      tenantId
    );
  }
  async setAccountable(taskId, userId, tenantId) {
    const user = await this.activedTasksRepository.getUser({ _id: userId });

    if (!user) throw exceptions.entityNotFound("Usuário não encontrado.");

    const task = await this.activedTasksRepository.getTask({
      _id: taskId,
      tenantId,
    });

    if (!task) throw exceptions.entityNotFound("Tarefa não encontrada.");

    return await this.activedTasksRepository.setAccountable(task, user);
  }
  async setAccountableMultiple(tasksList, userId, tenantId) {
    const user = await this.activedTasksRepository.getUser({ _id: userId });

    if (!user) throw exceptions.entityNotFound("Usuário não encontrado.");

    return await this.activedTasksRepository.setAccountableMultiple(
      tasksList,
      user,
      tenantId
    );
  }
  async updateTaskDeadline(taskId, tenantId, delayTime) {
    const query = { _id: taskId, tenantId, type: "task" };
    const task = await this.activedTasksRepository.getTask(query);

    if (!task) {
      throw exceptions.entityNotFound("Tarefa não encontrada");
    }
    const status = task.data.status;
    if (status !== "doing") {
      throw exceptions.acessDenied("Tarefa deve estar em execução");
    }
    //delayTime vem em horas adicionais
    const delayedDate = new Date(delayTime);
    const startedAt = new Date(task.data.startedAt);
    const delayedHours =
      (delayedDate.getTime() - startedAt.getTime()) / (1000 * 60 * 60);

    const data = {
      ...task.data.expiration,
      number: delayedHours,
      date: delayedDate.getTime(),
    };

    return await this.activedTasksRepository.updateTask(
      { _id: task._id },
      { "data.expiration": data }
    );
  }
  async setLabel(taskId, tenantId, label) {
    const query = { _id: taskId, tenantId };
    const task = await this.activedTasksRepository.getTask(query);

    if (!task) throw exceptions.entityNotFound("Tarefa não encontrada.");

    return await this.activedTasksRepository.setLabel(task, label);
  }
  async removeAccountable(taskId, tenantId) {
    const query = {
      _id: taskId,
      tenantId,
    };
    const task = await this.activedTasksRepository.getTask(query);

    if (!task) throw exceptions.entityNotFound("Tarefa não encontrada.");

    return await this.activedTasksRepository.removeAccountable(task);
  }
}

module.exports = ActivedTasksService;
