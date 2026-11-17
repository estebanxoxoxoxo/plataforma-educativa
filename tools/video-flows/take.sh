#!/bin/zsh
# uso: take.sh <es|en> <n>  — espera carga baja (≤15 min), graba la toma inglesa n y mide la fluidez
cd "$(dirname $0)"
export PLAYWRIGHT_BROWSERS_PATH=$PWD/../flow-en/ms-playwright
FF=$(ls $PLAYWRIGHT_BROWSERS_PATH/ffmpeg-*/ffmpeg-mac)
L=$1; n=$2
for i in $(seq 0 15); do
  l=$(sysctl -n vm.loadavg | awk '{print $2}')
  echo "carga $(date +%H:%M:%S) $l"
  if (( l < 4.5 )); then break; fi
  if (( i == 15 )); then echo "CARGA ALTA tras 15 min: grabo igual"; break; fi
  sleep 60
done
echo "ARRANCA toma $n con carga $(sysctl -n vm.loadavg)"
FLOW_LANG=$L DSF=3 MODE=full NORETRY=1 node flow-apollo.mjs > take-$L-n$n.log 2>&1
echo "carga al terminar $(sysctl -n vm.loadavg)"
grep -E "FALLÓ|REPORT|RUTA GUARDADA|arrancó" take-$L-n$n.log | cut -c1-400
if [ -f cuts-$L.json ] && grep -q '"ok": true' cuts-$L.json && [ cuts-$L.json -nt take.sh ]; then cp cuts-$L.json cuts-$L-n$n.json; fi
cp cuts-$L-full-caratula-inicio-caratula-fin.json cuts-$L-n$n-any.json 2>/dev/null
FF=$FF SYNC_ONLY=1 node syncstat.mjs cuts-$L-n$n-any.json $PWD/syncstat-tmp.webm 2>&1 | grep -E "fluidez|congelados"
echo FIN
