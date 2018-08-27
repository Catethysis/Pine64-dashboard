cat /sys/devices/virtual/thermal/thermal_zone0/temp
cat /proc/uptime | awk '{print $1}'
free | awk 'NR==2,NR==3 {print $2,$3}'
cat /proc/stat | grep 'cpu' | awk '{print ($2+$4), ($2+$4+$5)}'
cat /proc/loadavg | awk '{print $1,$2,$3}'
iw dev wlan0 station dump | awk 'BEGIN{FS="\n"; RS=" dBm\n"} {print $1,$2}' | awk '{print $2,$6}'
df / | awk 'NR==2 {print $2,$3}'
cat /sys/class/net/eth0/statistics/rx_bytes
cat /sys/class/net/eth0/statistics/tx_bytes
eval cat /sys/devices/system/cpu/cpu{0..3}/cpufreq/cpuinfo_cur_freq
eval cat /sys/class/regulator/regulator.{1..12}/microvolts
#ping ya.ru -c 1 -W 1 1>/dev/null && echo "gut"
