# Atajos (macOS / Linux / Git Bash). En Windows sin make, ejecuta los comandos a mano.
.PHONY: instalar pipeline pruebas lint postgres powerbi todo

instalar:
	pip install -r requirements.txt

pipeline:
	python scripts/run_pipeline.py

pruebas:
	pytest -q

lint:
	ruff check --line-length 120 src scripts tests

postgres:
	bash scripts/cargar_postgres.sh

powerbi:
	python scripts/exportar_powerbi.py

todo: pipeline pruebas postgres powerbi
