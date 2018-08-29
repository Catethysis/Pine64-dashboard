const createSensor = require('./sensors.js');
const ping = require('net-ping');

const cores = 4;
const voltage_channels = 12;
let sensors = createSensor.createSensors({cores: 4, voltage_channels: 12, eth_interface: 'eth0'});
let inetAccess = false;

var pingSession = ping.createSession({
  networkProtocol: ping.NetworkProtocol.IPv4,
  packetSize: 16,
  retries: 1,
  sessionId: (process.pid % 65535),
  timeout: 200,
  ttl: 128
});

setInterval(() => {
  pingSession.pingHost ('8.8.8.8', function (error, target) {
    if (!error)
      inetAccess = true;
    else
      inetAccess = false;
  });
}, 1000);

setInterval(() => {
  sensors.forEach((sensor) => {
    console.log(sensor.name + ': ' + sensor.data);
  });
  console.log('WAN: ' + inetAccess);
  console.log();
}, 1000);