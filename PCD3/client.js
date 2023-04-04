import url from 'url';
import path from 'path';
import io from 'socket.io-client';

(async () => {
    let tags = [];
    let contains = '';

    for (let i = 2; i < process.argv.length; ++i) {
        if (process.argv[i] === 'contains') {
            contains = process.argv[++i];
        } else {
            tags.push(process.argv[i]);
        }
    }

    const sock = io.connect('http://45.63.114.20:3004', {reconnect: true});

    sock.on('connect', (server) => {
        console.log('Connected');
        sock.emit('subscribe', {
            tags,
            contains
        });

        sock.on('news', (data) => {
            console.log(data)
        });
    });
})();