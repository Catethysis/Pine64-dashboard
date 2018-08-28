let fs = require('fs');

class sensor {
	constructor (params) {
		this.name = params.name;
		this.path = params.path;
		this.period = params.period || 1000;
		this.bufLen = params.bufLen;
		this.buf = new Buffer.alloc(this.bufLen);
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
			fs.read(this.fd, this.buf, 0, this.bufLen, 0, (err, count) => {
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
			bufLen: 10
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
			bufLen: 30
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
			bufLen: 400
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
			bufLen: 100
		});
	}

	parse(data) {
		return data.split(' ').slice(0, 3).map(Number);
	}
}

let sensors = [
	// new temp(),
	// new uptime(),
	new cpuUsage(),
	new cpuLA(),
];
