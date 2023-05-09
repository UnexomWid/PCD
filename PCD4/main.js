const termkit = require('terminal-kit').terminal;
const Path = require('path');

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
    console.error(`Usage: node ${process.argv[1]} <create-dsu | create-file | list-files | get-content | explore>`);
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
case 'explore':
    if (argc != 4) {
        error();
    }

    // keySSI
    explore(process.argv[3]);
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

function explore(keyssi) {
    resolver.loadDSU(keyssi, (err, dsuInstance) => {
        if (err) {
            throw err;
        }

        let selectedFile = null;

        const render = (path, content) => {
            termkit.clear();
            termkit.cyan(`DSU Explorer (^w${keyssi}^c)\n\n`);

            if (selectedFile) {
                termkit.white('(N)ew folder    (C)reate file    (U)pload file    (E)dit file    (D)elete file    (S)ave file\n\n');
            } else {
                termkit.white('(N)ew folder    (C)reate file    (U)pload file\n\n');
            }

            termkit.yellow(path);
            termkit('\n');

            if (content) {
                termkit('\n');
                termkit.magenta(content);
                termkit('\n');
            }

            dsuInstance.listFiles(path, { recursive: false }, (err, files) => {
                if (err) {
                    throw err;
                }

                dsuInstance.listFolders(path, { recursive: false }, (err, folders) => {
                    if (err) {
                        throw err;
                    }

                    let items = files;
                    for (const folder of folders) {
                        items.push(`[${folder}]`);
                    }

                    if (path !== '/') {
                        items.unshift('..');
                    }
            
                    items.push('<quit>');
            
                    termkit.gridMenu(items, { exitOnUnexpectedKey: true }, (err, res) => {
                        if (res.unexpectedKey) {
                            if (res.unexpectedKey === 'n') {
                                termkit.green('\nEnter new folder name: ')
                                termkit.inputField({ cancelable: true }, (err, res) => {
                                    if (!res) {
                                        selectedFile = null;
                                        render(path);
                                    } else {
                                        dsuInstance.createFolder(path + (path.endsWith('/') ? '' : '/') + res, (err) => {
                                            if (err) {
                                                throw err;
                                            }

                                            selectedFile = null;
                                            render(path, "Created folder " + res);
                                        });
                                    }
                                });
                            } else if (res.unexpectedKey === 'c') {
                                termkit.green('\nEnter new file name: ')
                                termkit.inputField({ cancelable: true }, (err, res) => {
                                    if (!res) {
                                        selectedFile = null;
                                        render(path);
                                    } else {
                                        dsuInstance.readFile(path + (path.endsWith('/') ? '' : '/') + res, (err, _) => {
                                            if (err) {
                                                // File doesn't exist, so we create it
                                                dsuInstance.writeFile(path + (path.endsWith('/') ? '' : '/') + res, '', (err) => {
                                                    if (err) {
                                                        throw err;
                                                    }

                                                    selectedFile = null;
                                                    render(path, "Created file " + res);
                                                });
                                            } else {
                                                selectedFile = null;
                                                render(path, "File already exists");
                                            }
                                        });
                                    }
                                });
                            } else if (res.unexpectedKey === 'u') {
                                termkit.green('\nEnter local file path to upload: ')
                                termkit.inputField({ cancelable: true }, (err, res) => {
                                    if (!res) {
                                        selectedFile = null;
                                        render(path);
                                    } else {
                                        dsuInstance.addFile(res, path + (path.endsWith('/') ? '' : '/') + Path.basename(res), (err) => {
                                            if (err) {
                                                throw err;
                                            }

                                            selectedFile = null;
                                            render(path, "Uploaded file " + Path.basename(res));
                                        });
                                    }
                                });
                            } else if (selectedFile && res.unexpectedKey === 'e') {
                                termkit.green('\nEnter new content: ')
                                termkit.inputField({ cancelable: true }, (err, res) => {
                                    if (!res) {
                                        selectedFile = null;
                                        render(path);
                                    } else {
                                        dsuInstance.writeFile(selectedFile, res, (err) => {
                                            if (err) {
                                                throw err;
                                            }

                                            const msg = "Edited file " + selectedFile;
                                            selectedFile = null;
                                            render(path, msg);
                                        });
                                    }
                                });
                            } else if (selectedFile && res.unexpectedKey === 'd') {
                                dsuInstance.delete(selectedFile, (err) => {
                                    if (err) {
                                        throw err;
                                    }

                                    const msg = "Deleted file " + selectedFile;
                                    selectedFile = null;
                
                                    render(path, msg);
                                });
                            } else if (selectedFile && res.unexpectedKey === 's') {
                                termkit.green('\nEnter local download path: ')
                                termkit.inputField({ cancelable: true }, (err, res) => {
                                    if (!res) {
                                        selectedFile = null;
                                        render(path);
                                    } else {
                                        dsuInstance.extractFile(res, selectedFile, (err) => {
                                            if (err) {
                                                throw err;
                                            }

                                            const msg = "Saved file " + selectedFile;
                                            selectedFile = null;
                                            render(path, msg);
                                        });
                                    }
                                });
                            } else {
                                selectedFile = null;
                                render(path);
                            }
            
                            return;
                        }
            
                        const text = res.selectedText;

                        if (text === '..') {
                            path = path.slice(0, path.lastIndexOf('/'));
            
                            if (path.length === 0) {
                                path = '/';
                            }

                            render(path, null);
                        } else if (text === '<quit>') {
                            process.exit(0);
                        } else if (text.startsWith('[') && text.endsWith(']')) {
                            path += (path.endsWith('/') ? '' : '/') + res.selectedText;
                            selectedFile = null;

                            render(path, null);
                        } else {
                            dsuInstance.readFile(path + (path.endsWith('/') ? '' : '/') + res.selectedText, (err, content) => {
                                if (err) {
                                    console.error("File doesn't exist");
                                    process.exit(1);
                                }

                                selectedFile = path + (path.endsWith('/') ? '' : '/') + text;
                                render(path, content.toString());
                            });
                        }
                    });
                });
            });
        };

        render('/');
    });
}