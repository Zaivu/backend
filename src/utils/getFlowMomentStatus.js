const { DateTime } = require("luxon");
module.exports = function (flow) {
  const { estimatedAt = null, criticalDate = null } = flow?.flowStatus || {};

  if (!estimatedAt || !criticalDate) {
    return { currentStatus: flow.finishedAt ? "done" : "doing" };
  }
  const estimatedAtMillis = DateTime.fromISO(estimatedAt).toMillis();
  const criticalDateMillis = DateTime.fromISO(criticalDate).toMillis();

  //Caso a data estimada esteja após a data crítica
  if (estimatedAtMillis > criticalDateMillis) {
    return { currentStatus: flow.finishedAt ? "doneLate" : "late" };
  } else {
    return { currentStatus: flow.finishedAt ? "done" : "doing" };
  }
};
