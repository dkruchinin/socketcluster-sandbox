all: build

setup:
	docker swarm init

build:
	docker build --file=Dockerfile_cli -t socketcluster_client .

deploy:
	docker stack deploy --compose-file=docker-compose.yml sandbox

stop:
	docker stack rm sandbox
