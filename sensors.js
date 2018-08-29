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
          let prev_fired = this.fired;
          this.fired = new Date();
          let readedData = this.buf.toString('utf8', 0, count);
          this.data = this.parse(readedData, prev_fired);
        } else
          throw new Error("Sensor " + this.path + " read error: " + err);
      });
    }
    setTimeout(() => this.process(), this.period);
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
    return Number(data);
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
    return Number(data.split(' ')[0]);
  }
}

class cpuUsage extends sensor {
  constructor (cores) {
    super({
      name: 'cpuUsage',
      path: '/proc/stat',
      buflen: 400
    });
    this.cores = cores;
  }

  parse(data, prev_fired) {
    // let total = Number(data);
    // let speed = null;
    // if(this.data)
    //   speed = (total - this.data.total) / ((this.fired - prev_fired) / 1000) / 1024;
      
    let current = data.split('\n').slice(0, this.cores + 1).map((elem) => { //change 5 to real cores number
      let fields = elem.split(/\s+/).map(Number);
      return {load: fields[1] + fields[3], total: fields[1] + fields[3] + fields[4]};
    });
    
    //new Array(this.cores + 1).
    let speed = [0, 0, 0, 0, 0];
    if(this.data)
      speed = speed.map((core, i) =>
        (current[i].load - this.data.current[i].load) / ((this.fired - prev_fired) / 1000)
      );
    return {current, speed};
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
  constructor (iface, direction) {
    super({
      name: 'net' + direction.toUpperCase(),
      path: '/sys/class/net/' + iface + '/statistics/' + direction + '_bytes',
      period: 1000,
      buflen: 20
    });
  }

  parse(data, prev_fired) {
    let total = Number(data);
    let speed = null;
    if(this.data)
      speed = (total - this.data.total) / ((this.fired - prev_fired) / 1000) / 1024;
    return {total, speed};
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
    return Number(data);
  }
}

class voltage extends sensor {
  constructor (channel) {
    super({
      name: 'voltage' + channel,
      path: '/sys/class/regulator/regulator.' + channel + '/microvolts'
    });
  }

  parse(data) {
    return Number(data) / 1000000;
  }
}

class DRAMFreq extends sensor {
  constructor () {
    super({
      name: 'DRAMFreq',
      path: '/sys/devices/1c62000.dramfreq/devfreq/dramfreq/cur_freq',
      period: 1000,
      buflen: 20
    });
  }

  parse(data) {
    return Number(data);
  }
}

class Memory extends sensor {
  constructor () {
    super({
      name: 'mem',
      path: '/proc/meminfo',
      period: 1000,
      buflen: 500
    });
  }

  parse(data) {
    let lines = data.split('\n');
    lines = [lines[0], lines[1], lines[13], lines[14]]; // total/free RAM, total/free swap
    lines = lines.map(elem => elem.split(/\s+/)[1]);
    return lines;
  }
}

createSensors = (cores, voltage_channels) => {
  let sensors = [
    new temp(),
    new uptime(),
    new cpuUsage(cores),
    new cpuLA(),
    new networkStat('eth0', 'rx'),
    new networkStat('eth0', 'tx'),
    new DRAMFreq,
    new Memory,
  ];

  // for(let i = 0; i < cores; i++)
  //   sensors.push(new coreFreq(i));

  // for(let i = 0; i < voltage_channels; i++)
  //   sensors.push(new voltage(i + 1));

  return sensors;
}

const cores = 4;
const voltage_channels = 12;
let sensors = createSensors(cores, voltage_channels);

setInterval(() => {
  sensors.forEach((sensor) => {
    console.log(sensor.name + ': ' + JSON.stringify(sensor.data, null, 4));
    // console.log(sensor.name + ': ' + sensor.data);
  });
  console.log();
}, 1000);