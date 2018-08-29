const createSensor = require('./sensors.js');

const cores = 4;
const voltage_channels = 12;
let sensors = createSensor.createSensors({cores: 4, voltage_channels: 12, eth_interface: 'eth0'});

setInterval(() => {
  sensors.forEach((sensor) => {
    console.log(sensor.name + ': ' + sensor.data);
  });
  console.log();
}, 1000);