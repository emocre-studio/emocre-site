.PHONY: vendor import transpile build

install: install/tools install/creatures
	yarn install

install/tools:
	@if [ ! -d vendor/emocre-tools/.git ]; then \
		git clone https://github.com/afonsof/emocre-tools.git vendor/emocre-tools; \
	else \
		echo "vendor/emocre-tools already cloned, pulling latest"; \
		git -C vendor/emocre-tools pull --ff-only; \
	fi
	rm -f vendor/emocre-tools/.yarnrc.yml vendor/emocre-tools/yarn.lock

install/creatures:
	@if [ ! -d vendor/emocre-art/.git ]; then \
		git clone --filter=blob:none --sparse git@github.com:afonsof/emocre-art.git vendor/emocre-art; \
	else \
		echo "vendor/emocre-art already cloned, pulling latest"; \
		git -C vendor/emocre-art pull --ff-only; \
	fi
	cd vendor/emocre-art && git sparse-checkout set dist/sprites/creatures

import:
	IMPORT_DATA_DIR="$(PWD)/data" IMPORT_ENV_PATH="$(PWD)/.env" IMPORT_PRESSKIT_PATH="$(PWD)/pt/press-kit.md" yarn workspace @emocre/tools import

transpile:
	node -r ts-node/register tools/transpile.ts

build:
	yarn build

start: install import transpile
	yarn start
