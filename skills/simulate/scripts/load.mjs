/* Shared by build.mjs and check.mjs: load the engine and a topic file in a sandbox (no browser). */
import { readFileSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const engineDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'engine');
export const ENGINE = ['core.js', 'scene.js', 'views.js'];

export function read(p) {
  try { return readFileSync(p, 'utf8'); } catch (e) { throw new Error('cannot read ' + p); }
}

/* Returns { topic, L, engineJs, topicJs }. Throws with a readable message. */
export function loadTopic(topicPath) {
  const engineJs = ENGINE.map(f => read(join(engineDir, f))).join('\n');
  const topicJs = read(topicPath);
  /* Seedable Math.random so check.mjs can compare two runs of the simulator. */
  const SMath = Object.create(Math);
  let seed = 1;
  SMath.random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const sandbox = { console, setTimeout, clearTimeout, Math: SMath, JSON, Promise, performance };
  sandbox.window = sandbox;
  sandbox.document = {
    hidden: false,
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    createElement() { throw new Error('topic code touched the DOM (document.createElement) outside the page'); },
    createElementNS() { throw new Error('topic code touched the DOM (createElementNS) outside the page'); }
  };
  sandbox.CustomEvent = class { constructor(n) { this.type = n; } };
  vm.createContext(sandbox);
  try { vm.runInContext(engineJs, sandbox, { filename: 'engine.js' }); }
  catch (e) { throw new Error('engine failed to load: ' + e.message); }
  try { vm.runInContext(topicJs, sandbox, { filename: basename(topicPath) }); }
  catch (e) { throw new Error('topic failed to load: ' + e.message + locate(e)); }
  const L = sandbox.SimLab;
  if (!L.current) throw new Error('the topic file did not call SimLab.topic({...})');
  return { topic: L.current, L, engineJs, topicJs, reseed: n => { seed = (n % 2147483646) + 1; } };
}

function locate(e) {
  const m = /:(\d+)(?::\d+)?\)?\s*$/m.exec(String(e.stack || '').split('\n').slice(0, 3).join('\n'));
  return m ? ' (line ' + m[1] + ')' : '';
}
