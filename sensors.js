let fs = require('fs');

class sensor {
	constructor (params) {
		this.name = params.name;
		this.path = params.path;
		this.period = params.period || 1000;
		this.buflen = params.buflen || 100;
		this.buf = new Buffer.alloc(this.buflen);
		fs.open(this.path, 'r', (err, fd) => {
			if(!err) {
				this.fd = fd;
				this.process();
			} else
				throw new Error("Sensor " + this.path + " open error: \n\t" + err);
		});
	}

	process() {
		if(this.fd) {
			fs.read(this.fd, this.buf, 0, this.buflen, 0, (err, count) => {
				if(!err) {
					this.fired = new Date();
					let readedData = this.buf.toString('utf8', 0, count);
					this.data = this.parse(readedData);
				} else
					throw new Error("Sensor " + this.path + " read error: " + err);
			});
		}
		setTimeout(() => this.process(), this.period);
		console.log(this);
		// console.log(this.data);
	}

	parse(data) {
		return data;
	}
}

class temp extends sensor {
	constructor () {
		super({
			name: 'temp',
			path: '/sys/devices/virtual/thermal/thermal_zone0/temp',
			buflen: 10
		});
	}

	parse(data) {
		return +data;
	}
}

class uptime extends sensor {
	constructor () {
		super({
			name: 'uptime',
			path: '/proc/uptime',
			buflen: 30
		});
	}

	parse(data) {
		return +data.split(' ')[0];
	}
}

class cpuUsage extends sensor {
	constructor () {
		super({
			name: 'cpuUsage',
			path: '/proc/stat',
			buflen: 400
		});
	}

	parse(data) {
		return data.split('\n').slice(0, 5).map((elem) => { //change 5 to real cores number
			let fields = elem.split(/\s+/);
			return {load: +fields[1] + +fields[3], total: +fields[1] + +fields[3] + +fields[4]};
		});
	}
}

class cpuLA extends sensor {
	constructor () {
		super({
			name: 'load_average',
			path: '/proc/loadavg',
			period: 1000,
			buflen: 100
		});
	}

	parse(data) {
		return data.split(' ').slice(0, 3).map(Number);
	}
}

class networkStat extends sensor {
	constructor (direction) {
		super({
			name: 'net' + direction.toUpperCase(),
			path: '/sys/class/net/eth0/statistics/' + direction + '_bytes',
			period: 1000,
			buflen: 20
		});
	}

	parse(data) {
		return +data;
	}
}

class coreFreq extends sensor {
	constructor (core) {
		super({
			name: 'coreFreq' + core,
			path: '/sys/devices/system/cpu/cpu' + core + '/cpufreq/cpuinfo_cur_freq'
		});
	}

	parse(data) {
		return +data;
	}
}

let sensors = [
	new temp(),
	new uptime(),
	new cpuUsage(),
	new cpuLA(),
	new networkStat('rx'),
	new networkStat('tx'),
	new coreFreq(0),
	new coreFreq(1),
	new coreFreq(2),
	new coreFreq(3),
];
