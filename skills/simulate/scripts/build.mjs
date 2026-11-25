#!/usr/bin/env node
/* Build one self-contained HTML page from a topic file.

   node build.mjs <topic.js> [-o out.html] [--fragment]

   --fragment  leave out <!doctype>, <html> and the viewport meta, for hosts that
               add their own document wrapper (for example Claude Artifacts).
   Needs Node 18+. No npm packages. */
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadTopic, read, engineDir } from './load.mjs';

function fail(msg) { console.error('build: ' + msg); process.exit(1); }

const args = process.argv.slice(2);
let topicPath = null, out = null, fragment = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '-o' || a === '--out') out = args[++i];
  else if (a === '--fragment') fragment = true;
  else if (a === '-h' || a === '--help') { console.log('usage: node build.mjs <topic.js> [-o out.html] [--fragment]'); process.exit(0); }
  else if (!topicPath) topicPath = a;
  else fail('unexpected argument: ' + a);
}
if (!topicPath) fail('give a topic file, e.g. node build.mjs websocket.topic.js');
topicPath = resolve(topicPath);

let loaded;
try { loaded = loadTopic(topicPath); } catch (e) { fail(e.message); }
const { topic, engineJs, topicJs } = loaded;

/* Keep inline code from closing its own tag early. */
const safeJs = s => s.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const safeCss = s => s.replace(/<\/style/gi, '<\\/style');
const escHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let html;
try {
  const fill = {
    '{{TITLE}}': escHtml(topic.name + ' · how it works'),
    '/*{{CSS}}*/': safeCss(read(join(engineDir, 'lab.css'))),
    '/*{{ENGINE}}*/': safeJs(engineJs),
    '/*{{TOPIC}}*/': safeJs(topicJs),
    '/*{{PAGE}}*/': safeJs(read(join(engineDir, 'page.js')))
  };
  html = read(join(engineDir, 'shell.html'));
  for (const [k, v] of Object.entries(fill)) {
    if (!html.includes(k)) fail('shell.html is missing ' + k);
    html = html.split(k).join(v); // split/join: no special $ patterns
  }
} catch (e) { fail(e.message); }
if (!fragment) html = '<!doctype html>\n<html lang="en">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' + html + '</html>\n';

out = resolve(out || topicPath.replace(/(\.topic)?\.js$/, '') + '.html');
writeFileSync(out, html);
console.log('built ' + out + ' (' + Math.round(html.length / 1024) + ' KB) · ' + topic.name);
