import url from 'url';
import path from 'path';
import http from 'http';
import { Server } from 'socket.io';
import express from 'express';
import eryn from 'eryn';

const app = express();

const PORT = 3004;
const NODE_ENV = 'development';

(async () => {
    const engine = eryn({
        bypassCache: NODE_ENV === 'development',
        logRenderTime: NODE_ENV === 'development',
        throwOnCompileDirError: true,
        workingDirectory: path.join(path.dirname(url.fileURLToPath(import.meta.url)), 'views')
    });

    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());

    app.use((req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');

        res.render = (file, context) => {
            const data = engine.render(file, context, {});
            res.setHeader('content-type', 'text/html');
            res.send(data);
        }

        next();
    });

    app.use(express.static(path.join(path.dirname(url.fileURLToPath(import.meta.url)), 'public')))

    let news = [];

    app.get('/admin', async (req, res) => {
        res.render('admin.eryn', {});
    });

    app.get('/', (req, res) => {
        res.render('index.eryn', { news });
    });

    app.post('/news',(req, res) => {
        const data = {
            content: req.body.content,
            tags: req.body.tags
        };

        news.push(data);

        for (const sock of sockets) {
            let emitted = false;

            for (const tag of data.tags) {
                if (sock.data.tags.indexOf(tag) > -1) {
                    emitted = true;
                    break;
                }
            }

            if (!emitted) {
                if (sock.data.contains && data.content.includes(sock.data.contains)) {
                    emitted = true;
                }
            }

            if (emitted) {
                sock.emit('news', data);
                console.log("EMIT");
            }
        }
    });

    const server = http.createServer(app);
    const io = new Server(server, { cors: { origin: '*' } });

    let sockets = [];

    io.on('connection', (socket) => {
        socket.data = {
            tags: [],
            contains: ''
        };
        sockets.push(socket);

        socket.on('disconnect', () => {
            sockets.pop(socket);
        });

        socket.on('subscribe', (data) => {
            console.log('subscription ' + JSON.stringify(data))
            socket.data = {
                tags: data.tags,
                contains: data.contains
            };
        })
    });

    server.listen(PORT);
    console.log(`Server up on localhost:${PORT}`);
})();