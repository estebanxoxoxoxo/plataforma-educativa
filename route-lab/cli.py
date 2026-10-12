#!/usr/bin/env python3
"""route-lab CLI. Corre etapas del pipeline sobre un job (carpeta de artefactos).

  python3 cli.py run poc-solar --sources "Sistema solar" "Júpiter (planeta)" --edad 10 --nivel medio
  python3 cli.py ingest poc-solar --sources "Sistema solar" "Júpiter (planeta)"
  python3 cli.py extract poc-solar
  ...
"""
from __future__ import annotations
import argparse
import json
import sys

from core.env import load_env
from core.job import Job
from stages import ingest, extract, graph, plan, generate, bundle

load_env()  # carga OPENAI_API_KEY desde .env si existe


def _p(stage: str, res: dict) -> None:
    print(f"\n▸ {stage}")
    print(json.dumps(res, ensure_ascii=False, indent=2))


def main() -> int:
    ap = argparse.ArgumentParser(prog="route-lab")
    ap.add_argument("stage", choices=["ingest", "extract", "graph", "plan", "generate", "bundle", "run"])
    ap.add_argument("job")
    ap.add_argument("--sources", nargs="+", default=[])
    ap.add_argument("--lang", default="es")
    ap.add_argument("--edad", type=int, default=10)
    ap.add_argument("--nivel", default="medio", choices=["basico", "medio", "avanzado"])
    args = ap.parse_args()

    job = Job(args.job)

    # persistir el request (fuente de verdad de los args)
    if args.stage in ("ingest", "run"):
        job.write_json("00-request.json", {
            "jobId": args.job, "sources": args.sources, "lang": args.lang,
            "edad": args.edad, "nivel": args.nivel,
        })

    if args.stage in ("ingest", "run"):
        if not args.sources:
            print("error: ingest necesita --sources", file=sys.stderr)
            return 2
        _p("ingest", ingest.run(job, args.sources, args.lang))
    if args.stage in ("extract", "run"):
        _p("extract", extract.run(job))
    if args.stage in ("graph", "run"):
        _p("graph", graph.run(job))
    if args.stage in ("plan", "run"):
        _p("plan", plan.run(job, args.edad, args.nivel))
    if args.stage in ("generate", "run"):
        _p("generate", generate.run(job))
    if args.stage in ("bundle", "run"):
        _p("bundle", bundle.run(job))

    if args.stage == "run":
        print(f"\n✅ bundle listo: jobs/{args.job}/60-route-bundle.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
