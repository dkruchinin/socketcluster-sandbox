const socketCluster = require('socketcluster-client');

const options = {
  hostname: 'proxy',
  port: 80
};

const socket = socketCluster.connect(options);
const chan = socket.subscribe('test_chan');

console.log('Feed me!');
chan.watch((data) => {
  console.log('Food:', data);
  console.log('Feed me!');
});
