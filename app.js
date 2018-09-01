const createSensor = require('./sensors.js');
const ping = require('net-ping');
const { execSync } = require('child_process');
const fs = require('fs');

const express = require('express');
const app = express();
const port = process.env.PORT || 5000;

const eth_interface = 'eth0';
let clients = [];

let getData = (counter) => execSync(counter).toString('utf8').slice(0, -1);

getAPClients = () => {
	iwClients = getData('iw dev wlan0 station dump | awk \'BEGIN{FS="\\n"; RS=" dBm\\n"} {print $1,$2}\' | awk \'{print $2,$6}\'');
	iwClients = iwClients.split('\n');
	iwClients = iwClients.map(iwClient => {
		iwClient = iwClient.split(' ');
		return {"MAC": iwClient[0], "dBm": iwClient[1]};
	});

	leasesFileLocation = getData('find /tmp -name "dnsmasq.leases"');
	leasesFile = fs.readFileSync(leasesFileLocation, {"encoding": "utf8"}).slice(0, -1);
	clients = leasesFile.split('\n').sort((a, b) => a > b);
	return clients.map(client => {
		client = client.split(' ');
		client = {
			MAC: client[1],
			IP: client[2],
			hostname: client[3],
			until: +client[0]
		}
		client.interface = getData('ip -o route get ' + client.IP + ' | awk \'{ print $6 }\'');
		iwClient = iwClients.find(value => value.MAC == client.MAC);
		if(iwClient) {
			client.wired = false;
			client.dBm = +iwClient.dBm;
		} else {
			client.wired = true;
			client.speed = +getData('cat /sys/class/net/' + eth_interface + '/speed');
		}

		return client;
	});
};

setInterval(() => {
	clients = getAPClients();
	var disk = getData('df / | awk \'NR==2 {print $2,$3}\'').split(' ');
//	syshealth.disk = {total: disk[0], used: disk[1]};
}, 30000);

const cores = 4;
const voltage_channels = 12;
let sensors = createSensor.createSensors({cores: 4, voltage_channels: 12, eth_interface: eth_interface});
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

app.get('/', function (req, res) {
	res.send({
		sensors: sensors,
		WAN: inetAccess
	});
});

app.listen(port, () => console.log(`Listening on port ${port}`));
