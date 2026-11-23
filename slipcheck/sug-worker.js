/* Works out the suggested slips off the main thread, so the page never stalls on a slow phone. Same engine, same maths. */
importScripts("bet-engine.js");
onmessage = e => { try { postMessage({ id: e.data.id, sug: BetEngine.suggestSlips(e.data.args) }); } catch (err) { postMessage({ id: e.data.id, error: String(err) }); } };
