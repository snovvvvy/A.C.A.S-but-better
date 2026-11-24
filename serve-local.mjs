// Serves this repository at http://localhost/A.C.A.S/ so the userscript uses your
// local copy of the GUI instead of the hosted one. No dependencies.
//
// Usage:  node serve-local.mjs          (port 80, required by the userscript)
//         node serve-local.mjs 8080     (other port, GUI only; userscript won't connect)
//
// The userscript only recognises the backend when the page host is exactly
// "localhost" (no port) and the path contains "/A.C.A.S/", so port 80 is needed.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PREFIX = '/A.C.A.S';
const PORT = Number(process.argv[2]) || 80;
const HOST = '127.0.0.1';

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.wasm': 'application/wasm',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.ico': 'image/x-icon',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.wav': 'audio/wav',
	'.mp3': 'audio/mpeg',
	'.txt': 'text/plain; charset=utf-8',
	'.md': 'text/plain; charset=utf-8',
	'.xml': 'application/xml'
};

function send(res, status, body, headers = {}) {
	res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
	res.end(body);
}

const server = http.createServer((req, res) => {
	let pathname;
	try {
		pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
	} catch {
		return send(res, 400, 'Bad request');
	}

	if(pathname === '/' || pathname === PREFIX) {
		return send(res, 302, '', { Location: PREFIX + '/' });
	}

	if(!pathname.startsWith(PREFIX + '/')) {
		return send(res, 404, 'Not found');
	}

	let filePath = path.join(ROOT, pathname.slice(PREFIX.length));

	// Block path traversal and the .git folder
	const rel = path.relative(ROOT, filePath);
	if(rel.startsWith('..') || path.isAbsolute(rel) || rel.split(path.sep)[0] === '.git') {
		return send(res, 403, 'Forbidden');
	}

	fs.stat(filePath, (err, stat) => {
		if(!err && stat.isDirectory()) {
			if(!pathname.endsWith('/')) {
				return send(res, 301, '', { Location: pathname + '/' });
			}
			filePath = path.join(filePath, 'index.html');
		}

		fs.stat(filePath, (err2, fileStat) => {
			if(err2 || !fileStat.isFile()) {
				const notFound = path.join(ROOT, '404.html');
				return fs.existsSync(notFound)
					? (res.writeHead(404, { 'Content-Type': MIME['.html'] }), fs.createReadStream(notFound).pipe(res))
					: send(res, 404, 'Not found');
			}

			const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
			res.writeHead(200, {
				'Content-Type': type,
				'Content-Length': fileStat.size,
				// Always pick up local edits on reload
				'Cache-Control': 'no-cache',
				// Cross-origin isolation enables SharedArrayBuffer for multi-threaded
				// WASM engines without relying on coi-serviceworker.js
				'Cross-Origin-Opener-Policy': 'same-origin',
				'Cross-Origin-Embedder-Policy': 'credentialless'
			});

			if(req.method === 'HEAD') return res.end();
			fs.createReadStream(filePath).pipe(res);
		});
	});
});

server.on('error', err => {
	if(err.code === 'EADDRINUSE') {
		console.error(`Port ${PORT} is already in use. Close whatever is using it (Skype, IIS, another server) and retry.`);
	} else if(err.code === 'EACCES') {
		console.error(`No permission to use port ${PORT}. Try running the terminal as Administrator.`);
	} else {
		console.error(err);
	}
	process.exit(1);
});

server.listen(PORT, HOST, () => {
	const portPart = PORT === 80 ? '' : `:${PORT}`;
	console.log(`A.C.A.S GUI:        http://localhost${portPart}${PREFIX}/app/`);
	console.log(`Install userscript: http://localhost${portPart}${PREFIX}/acas.user.js`);
	console.log('Press Ctrl+C to stop.');
});
