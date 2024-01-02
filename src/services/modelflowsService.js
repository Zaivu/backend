// modelflowsService.js
// const exceptions = require("../exceptions");

const { DateTime } = require("luxon");
const exceptions = require("../exceptions");

class ModelflowsService {
  constructor(modelflowsRepository) {
    this.modelflowsRepository = modelflowsRepository;
  }

  async pagination(tenantId, page, query) {
    return await this.modelflowsRepository.pagination(tenantId, page, query);
  }

  async list(tenantId) {
    return await this.modelflowsRepository.list(tenantId);
  }

  async getFlow(flowId, tenantId) {
    return await this.modelflowsRepository.getFlow(flowId, tenantId);
  }

  async newProject(tenantId, options, elements) {
    const { title } = options;
    const nowLocal = DateTime.now();

    let baseModel = {
      title,
      tenantId,
      type: "main",
      createdAt: nowLocal,
      lastUpdate: nowLocal,
      default: null,
    };

    return await this.modelflowsRepository.new(baseModel, elements);
  }

  async newModel(tenantId, options, elements) {
    const { title, parentId } = options;
    const nowLocal = DateTime.now();

    let baseModel = {
      title,
      tenantId,
      parentId,
      type: "version",
      createdAt: nowLocal,
      lastUpdate: nowLocal,
    };

    const query = {
      $or: [
        { _id: parentId, title },
        { parentId, title },
      ],
    };

    const alreadyExists = await this.modelflowsRepository.findFlow(query);

    if (alreadyExists) throw exceptions.alreadyExists("Versão já existente");

    return await this.modelflowsRepository.new(baseModel, elements);
  }

  async copy(flowId, title) {
    const flow = await this.modelflowsRepository.findFlow({ flowId });

    //Fluxo não encontrado
    if (!flow) {
      throw exceptions.entityNotFound("Fluxo não encontrado");
    }
    //Modelo Base
    const newProject = await this.modelflowsRepository.copy(flow, title);

    return newProject;
  }

  async rename(flowId, parentId, title) {
    const query = {
      $or: [
        { _id: flowId, title },
        { _id: parentId, title },
        { parentId, title },
      ],
    };

    const isAlreadyExist = await this.modelflowsRepository.findFlow(query);

    if (isAlreadyExist) {
      throw exceptions.alreadyExists("Nome de fluxo já existente.");
    }

    return await this.modelflowsRepository.rename(flowId, title);
  }

  async edit(flowId, title, elements) {
    const query = {
      $or: [
        { parentId: flowId, title }, //Versões
      ],
    };

    const alreadyExists = await this.modelflowsRepository.findFlow(query);

    if (alreadyExists) {
      throw exceptions.alreadyExists("Título de Fluxo já existente");
    }
    const flow = await this.modelflowsRepository.findFlow({ _id: flowId });

    if (!flow) {
      throw exceptions.entityNotFound("Fluxo não encontrado");
    }

    return await this.modelflowsRepository.edit(flowId, title, elements);
  }

  async setDefault(flowId, versionId) {
    return await this.modelflowsRepository.setDefault(flowId, versionId);
  }

  async deleteProject(flowId, tenantId) {
    const flow = await this.modelflowsRepository.findFlow({
      _id: flowId,
      tenantId,
      type: "main",
    });

    if (!flow) {
      throw exceptions.entityNotFound("Fluxo não encontrado");
    }

    return await this.modelflowsRepository.deleteProject(flowId);
  }

  async deleteFlow(flowId, tenantId) {
    const flow = await this.modelflowsRepository.findFlow({
      _id: flowId,
      tenantId,
    });

    if (!flow) {
      throw exceptions.entityNotFound("Fluxo não encontrado");
    }

    return await this.modelflowsRepository.deleteFlow(flow);
  }
}

module.exports = ModelflowsService;
