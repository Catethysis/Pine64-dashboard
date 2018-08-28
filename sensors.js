let fs = require('fs');

class sensor {
	constructor (params) {
		this.name = params.name;
		this.path = params.path;
		this.period = params.period || 1000;
		this.bufLen = params.bufLen;
		this.buf = new Buffer.alloc(this.bufLen);
		fs.open(this.path, 'r', (er, fd) => {
			this.fd = fd;
			this.process();
		});
	}

	process() {
		if(this.fd) {
			fs.read(this.fd, this.buf, 0, this.bufLen, 0, (err, count) => {
				this.fired = new Date();
				let readedData = this.buf.toString('utf8', 0, count);
				this.data = this.parse(readedData);
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
			bufLen: 10}
		);
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
			bufLen: 30}
		);
	}

	parse(data) {
		return +data.split(' ')[0];
	}
}

let sensors = [
	new temp(),
	new uptime()
];
