const { DateTime } = require('luxon');

module.exports = function (task) {
    //date é a data de comparação, pode ser hoje ou a data de conclusão
    //da tarefa
    //startedAt, expirationHours, status, date
    if (task.data.status === 'pending') {
        return
    }



    const startedAt = task.data.startedAt;
    const expirationHours = task.data.expiration.number;
    const status = task.data.status;
    const date = status === 'doing' ? DateTime.now() :
        status === 'done' ? task.data.finishedAt :
            null;


    let compareDate = date;

    if (status === 'done') {
        compareDate = DateTime.fromMillis(date);
    }

    const start = DateTime.fromMillis(startedAt);

    const deadlineDate = start.plus({ hours: expirationHours });

    const diffHours = deadlineDate.diff(compareDate, 'hours').hours;
    const diffDays = deadlineDate.diff(compareDate, 'days').days;

    //Calculo básico -> startedAt + expirationTime = data final  -> milissegundos

    const currentStatus =
        status === 'doing'
            ? diffHours > 0
                ? 'doing'
                : 'late'
            : status === 'done'
                ? diffHours > 0
                    ? 'done'
                    : 'doneLate'
                : null;

    return {
        currentStatus,
        diffHours,
        diffDays,
        deadline: status === 'doing' ? deadlineDate.toMillis() : null,
        finishedAt: status === 'done' ? date : null,
    };
}