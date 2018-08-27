const express = require('express');
const app = express();
const port = process.env.PORT || 5000;

var fs = require('fs');

const { execSync } = require('child_process');

var SerialPort = require('serialport');
var serialPort = new SerialPort("/dev/rfcomm0", {
	baudRate: 9600
});

let netstat = {}, health = {disk: {total: 0, used: 0}}, clients = [];
let rx_bytes = 0;
let tx_bytes = 0;
let interval_ms = 1000;
let history = [];

let getData = (counter) => execSync(counter).toString('utf8').slice(0, -1);

let getETHCounter = (interface, counter) => 
	getData('cat /sys/class/net/' + interface + '/statistics/' + counter);

getNetStat = (interval) => {
	old_rx_bytes = rx_bytes; rx_bytes = +getETHCounter('eth0', 'rx_bytes');
	old_tx_bytes = tx_bytes; tx_bytes = +getETHCounter('eth0', 'tx_bytes');
	let rx_bandwidth = (rx_bytes - old_rx_bytes) * 1000 / interval * 8 / 1024;
	let tx_bandwidth = (tx_bytes - old_tx_bytes) * 1000 / interval * 8 / 1024;

	return netstat = {
		rx_bytes_total: rx_bytes, // B
		tx_bytes_total: tx_bytes, // B
		rx_bandwidth_kbps: +rx_bandwidth.toFixed(1), // kb/s
		tx_bandwidth_kbps: +tx_bandwidth.toFixed(1)  // kb/s
	};
};

let old_cpu_usage_24    = [0, 0, 0, 0, 0];
let total_cpu_usage_24  = [0, 0, 0, 0, 0];
let old_cpu_usage_245   = [0, 0, 0, 0, 0];
let total_cpu_usage_245 = [0, 0, 0, 0, 0];
let cpu_usage           = [0, 0, 0, 0, 0];

getSysHealth = () => {
	temp = +getData('cat /sys/devices/virtual/thermal/thermal_zone0/temp');
	uptime = Math.round(getData('cat /proc/uptime').split(' ')[0]);
	mem = getData('free | awk \'NR==2,NR==3 {print $2,$3}\'').split(/\n| /);

	// get user+nice processes current cpu time, and divide it on user+nice+idle
	old_cpu_usage_24 = total_cpu_usage_24;
	old_cpu_usage_245 = total_cpu_usage_245;
	total_cpu_usage = getData('cat /proc/stat | grep \'cpu\' | awk \'{print ($2+$4), ($2+$4+$5)}\'').split(/\n| /);
	total_cpu_usage_24  = [total_cpu_usage[0], total_cpu_usage[2], total_cpu_usage[4], total_cpu_usage[6], total_cpu_usage[8]];
	total_cpu_usage_245 = [total_cpu_usage[1], total_cpu_usage[3], total_cpu_usage[5], total_cpu_usage[7], total_cpu_usage[9]];
	for(var core = 0; core < 5; core++)
		cpu_usage[core] = Math.round(100 * (total_cpu_usage_24[core] - old_cpu_usage_24[core]) / (total_cpu_usage_245[core] - old_cpu_usage_245[core]));

	load_average = getData('cat /proc/loadavg').split(' ').slice(0, 3);

	return syshealth = {
		temp: temp,
		uptime_sec: uptime,
		mem: {total: mem[0], used: mem[1]},
		swap: {total: mem[2], used: mem[3]},
		disk: health.disk,
		cpu_percent: cpu_usage,
		load_average: load_average
	};
};

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
			client.speed = +getData('cat /sys/class/net/eth0/speed'); // TODO: 'client.interface' instead of 'eth0'
		}

		return client;
	});
};

setInterval(() => {
	netstat = getNetStat(2 * interval_ms);
}, 2 * interval_ms);

const window = 10, depth = 6;
let old_time = 0, old_rx = 0, old_tx = 0;
setInterval(() => {
	health = getSysHealth();

	let time = +Date.now();
	let rx = +netstat.rx_bytes_total;
	let tx = +netstat.tx_bytes_total;
	let record = {
		temp: syshealth.temp,
		cpu: syshealth.cpu_percent.slice(),
		mem: +syshealth.mem.used,
	}
	if(history.length % window == 0) {
		record.time = old_time = time;
		record.rx = old_rx = rx;
		record.tx = old_tx = tx;
		if(history.length / window == depth)
			history.splice(0, window);
	} else {
		record.dtime = time - old_time;
		record.drx = rx - old_rx;
		record.dtx = tx - old_tx;
	}
	history.push(record);
}, 2 * interval_ms);

clients = getAPClients();

setInterval(() => {
	clients = getAPClients();
	var disk = getData('df / | awk \'NR==2 {print $2,$3}\'').split(' ');
	syshealth.disk = {total: disk[0], used: disk[1]};
}, 30 * interval_ms);

setInterval(() => {
	BTdata = '\t' + [
		syshealth.cpu_percent[0],
		syshealth.temp,
		clients.length,
		Math.round(netstat.rx_bandwidth_kbps),
		Math.round(netstat.tx_bandwidth_kbps),
	].join(',') + ',^';
	serialPort.write(BTdata);
}, 2 * interval_ms);

app.get('/netstat', function (req, res) {
	res.send(netstat);
});

app.get('/syshealth', function (req, res) {
	res.send(health);
});

app.get('/apclients', function (req, res) {
	res.send(clients);
});

app.get('/history', function (req, res) {
	res.send(history);
});

app.get('/allinfo', function (req, res) {
	res.send({
		syshealth: health,
		netstat: netstat,
		apclients: clients,
		history: history,
	});
});

app.listen(port, () => console.log(`Listening on port ${port}`));