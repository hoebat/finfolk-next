// UI contract test; the code.test fixture owns this server and its saved cases.
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
const [origin, appModule] = process.argv.slice(2);
const fetchHTTP = globalThis.fetch;
const window = new Window({url: origin});
window.document.write((await (await fetchHTTP(origin)).text()).replace(/<script[^>]*>[\s\S]*?<\/script>/g, ''));
Object.assign(globalThis, {window, document: window.document, requestAnimationFrame: () => 0});
globalThis.fetch = (url, options) => fetchHTTP(new URL(url, origin), options);
const ui = await import(appModule);
async function until(predicate) {
  for (let i = 0; i < 300; i++) {
    await ui.poll();
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  throw new Error('Workbench operation did not finish');
}
async function run(status) {
  const previous = ui.state.model.value.verification.latest?.time;
  await ui.verifyAction(document.querySelector('[data-verification="verify-page"]'));
  await until(() => {
    const latest = ui.state.model.value.verification.latest;
    return latest?.time !== previous && latest?.status === status;
  });
  ui.render();
}
try {
  await until(() => ui.state.model?.value);
  document.querySelector('[data-view="pages"]').click();
  await ui.verifyAction(document.querySelector('[data-load-case="contract"]'));
  await run('passed');
  const draft = JSON.parse(document.querySelector('#verification-request').value);
  draft.expect.contains.name = 'wrong';
  ui.state.verifyDraft = JSON.stringify(draft); ui.render();
  await run('failed');
  assert.match(document.querySelector('.verification-workbench').textContent, /Failed/);
  draft.expect.contains.name = 'session';
  ui.state.verifyDraft = JSON.stringify(draft); ui.render();
  await run('passed');
  document.querySelector('#verification-case-id').value = 'ui-proof';
  await ui.verifyAction(document.querySelector('[data-verification="save-page-case"]'));
  await until(() => ui.state.model.value.verification.saved.cases['ui-proof']);
  ui.render();
  await ui.verifyAction(document.querySelector('[data-load-case="ui-proof"]'));
  assert.deepEqual(JSON.parse(document.querySelector('#verification-request').value), draft);
  console.log('PASS: load, run, fail, correct, save, reload');
} finally {
  window.dispatchEvent(new window.Event('beforeunload'));
  await window.happyDOM.close();
}
