const socketCluster = require('socketcluster-client');
const readline = require('readline');

const options = {
  hostname: 'proxy',
  port: 80
};

const socket = socketCluster.connect(options);
const chan = socket.subscribe('test_chan');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', function (line) {
  console.log(line);
  chan.publish(line);
})

