const express = require('express');
const mongoose = require('mongoose');
const ObjectID = require('mongodb').ObjectID;
const exceptions = require('../exceptions');
const requireAuth = require('../middlewares/requireAuth');
const router = express.Router();
const { DateTime } = require('luxon');

const ActivedFlow = mongoose.model('ActivedFlow');
// const ActivedEdge = mongoose.model('ActivedEdge');
// const ActivedNode = mongoose.model('ActivedNode');

router.use(requireAuth);

//Pagination
router.get('/pagination/:tenantId/:page', async (req, res) => {
  const { tenantId, page = '1' } = req.params;
  const { title = '' } = req.query;

  // const isAlpha = alpha === 'true'; //Ordem do alfabeto
  // const isCreation = creation === 'true'; //Ordem de Criação

  const SortedBy = { createdAt: -1 };

  try {
    if (!ObjectID.isValid(tenantId)) {
      throw exceptions.unprocessableEntity('tenantId must be a valid ObjectId');
    }

    const paginateOptions = {
      page,
      limit: 4,
      sort: SortedBy, // ultimas instancias
    };

    const Pagination = await ActivedFlow.paginate(
      { tenantId, title: { $regex: title, $options: 'i' } },
      paginateOptions
    );

    const flows = Pagination.docs;
    const totalPages = Pagination.totalPages;

    res.send({ activedflows: flows, pages: totalPages });
  } catch (err) {
    const code = err.code ? err.code : '412';
    res.status(code).send({ error: err.message, code });
  }
});

//Add Active Flow
router.post('/new', async (req, res) => {
  try {
    const { title, tenantId, client = '', description } = req.body;
    // const isArray = Array.isArray;

    //Elementos serão puxados diretamente da requisição

    if (
      !(typeof title === 'string') ||
      !ObjectID.isValid(tenantId) ||
      !(typeof description === 'string') ||
      !(typeof client === 'string')
      // ||!isArray(elements)
    ) {
      throw exceptions.unprocessableEntity('Invalid argument types');
    }

    const nowLocal = DateTime.now();

    let baseModel = {
      title,
      tenantId,
      description,
      client,
      createdAt: nowLocal,
      lastUpdate: nowLocal,
    };

    const liveModel = new ActivedFlow({ ...baseModel, default: null });

    const activedFlow = await liveModel.save();

    res.status(200).json({
      activedflow: {
        title: activedFlow.title,
        _id: activedFlow._id,
        client: activedFlow.client,
        status: activedFlow.status,
        createdAt: activedFlow.createdAt,
        finishedAt: activedFlow.finishedAt,
        tenantId: activedFlow.tenantId,
        comments: activedFlow.comments,
        posts: activedFlow.posts,
        lastState: activedFlow.lastState,
        // elements: [...nodes, ...edges],
      },
    });
  } catch (err) {
    const code = err.code ? err.code : '412';
    res.status(code).send({ error: err.message, code });
  }
});
module.exports = router;
