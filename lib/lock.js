// Runs jobs one after another. Used for bookings so two candidates cannot take the last seat of a slot.
let chain = Promise.resolve();
const withLock = (fn) => { const run = chain.then(fn, fn); chain = run.catch(() => {}); return run; };
module.exports = { withLock };
