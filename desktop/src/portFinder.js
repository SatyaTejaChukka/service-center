const net = require('net');

/**
 * Checks if a specific port is available for TCP listening on 127.0.0.1
 */
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
        resolve(false);
      } else {
        resolve(false);
      }
    });
    server.once('listening', () => {
      server.close(() => {
        resolve(true);
      });
    });
    server.listen(port, '127.0.0.1');
  });
}

/**
 * Scans starting from startPort up to maxPort to find the first free port.
 */
async function findFreePort(startPort = 8000, maxPort = 8099) {
  for (let port = startPort; port <= maxPort; port++) {
    const available = await isPortAvailable(port);
    if (available) {
      return port;
    }
  }
  throw new Error(`No available TCP port found between ${startPort} and ${maxPort}`);
}

module.exports = {
  isPortAvailable,
  findFreePort,
};
