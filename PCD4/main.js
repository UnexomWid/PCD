//Load openDSU enviroment
require("../opendsu-sdk/psknode/bundles/openDSU");

//Load openDSU SDK
const opendsu = require("opendsu");

//Load resolver library
const resolver = opendsu.loadApi("resolver");

//Load keyssi library
const keyssispace = opendsu.loadApi("keyssi");

//Create a template keySSI (for default domain). See /conf/BDNS.hosts.json
const templateSSI = keyssispace.createTemplateSeedSSI('default');

function error() {
    console.error(`Usage: node ${process.argv[1]} <create-dsu | create-file | list-files | get-content>`);
    process.exit(1);
}

const argc = process.argv.length;

if (argc < 3) {
    error();
}

const action = process.argv[2];

switch(action) {
case 'create-dsu':
    createDsu();
    break;
case 'create-file':
    if (argc != 5) {
        error();
    }

    // keySSI, path
    createFile(process.argv[3], process.argv[4]);
    break;
case 'list-files':
    if (argc != 5) {
        error();
    }

    // keySSI, dir path
    listFiles(process.argv[3], process.argv[4]);
    break;
case 'get-content':
    if (argc != 5) {
        error();
    }

    // keySSI, path
    getContent(process.argv[3], process.argv[4]);
    break;
case 'set-content':
    if (argc != 6) {
        error();
    }

    // keySSI, path, content
    setContent(process.argv[3], process.argv[4], process.argv[5]);
    break;
default:
    error();
    break;
}

function createDsu() {
    resolver.createDSU(templateSSI, (err, dsuInstance) =>{
        if (err){
            throw err;
        }

        dsuInstance.getKeySSIAsString((err, keyidentifier) => {
            process.stdout.write(`\nThe new DSU's KeySSI is: ${keyidentifier}\n`);
        });
    });
}

function createFile(keyssi, path) {
    resolver.loadDSU(keyssi, (err, dsuInstance) => {
        if (err) {
            throw err;
        }

        dsuInstance.readFile(path, (err, _) => {
            if (err) {
                // File doesn't exist, so we create it
                dsuInstance.writeFile(path, '', (err) => {
                    if (err) {
                        throw err;
                    }
                });
            }
        });
    });
}

function listFiles(keyssi, dir) {
    resolver.loadDSU(keyssi, (err, dsuInstance) => {
        if (err) {
            throw err;
        }

        dsuInstance.listFiles(dir, {}, (err, files) => {
            if (err) {
                throw err;
            }

            for (const file of files) {
                process.stdout.write(`\n/${file}`);
            }

            process.stdout.write('\n');
        });
    });
}

function setContent(keyssi, path, content) {
    resolver.loadDSU(keyssi, (err, dsuInstance) => {
        if (err) {
            throw err;
        }

        dsuInstance.writeFile(path, content, (err) => {
            if (err) {
                throw err;
            }
        });
    });
}

function getContent(keyssi, path) {
    resolver.loadDSU(keyssi, (err, dsuInstance) => {
        if (err) {
            throw err;
        }

        dsuInstance.readFile(path, (err, content) => {
            if (err) {
                console.error("File doesn't exist");
                process.exit(1);
            }

            process.stdout.write(`\n${content.toString()}\n`);
        });
    });
}