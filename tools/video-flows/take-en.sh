#!/bin/zsh
# uso: take-en.sh <n>  — espera carga baja (≤15 min), graba la toma inglesa n y mide la fluidez
cd "$(dirname $0)"
export PLAYWRIGHT_BROWSERS_PATH=$PWD/../flow-en/ms-playwright
FF=$(ls $PLAYWRIGHT_BROWSERS_PATH/ffmpeg-*/ffmpeg-mac)
n=$1
for i in $(seq 0 15); do
  l=$(sysctl -n vm.loadavg | awk '{print $2}')
  echo "carga $(date +%H:%M:%S) $l"
  if (( l < 4.5 )); then break; fi
  if (( i == 15 )); then echo "CARGA ALTA tras 15 min: grabo igual"; break; fi
  sleep 60
done
echo "ARRANCA toma $n con carga $(sysctl -n vm.loadavg)"
FLOW_LANG=en DSF=3 MODE=full NORETRY=1 node flow-apollo.mjs > take-en-n$n.log 2>&1
echo "carga al terminar $(sysctl -n vm.loadavg)"
grep -E "FALLÓ|REPORT|RUTA GUARDADA|arrancó" take-en-n$n.log | cut -c1-400
if [ -f cuts-en.json ] && grep -q '"ok": true' cuts-en.json && [ cuts-en.json -nt take-en.sh ]; then cp cuts-en.json cuts-en-n$n.json; fi
cp cuts-en-full-caratula-inicio-caratula-fin.json cuts-en-n$n-any.json 2>/dev/null
FF=$FF SYNC_ONLY=1 node syncstat.mjs cuts-en-n$n-any.json $PWD/syncstat-tmp.webm 2>&1 | grep -E "fluidez|congelados"
echo FIN
