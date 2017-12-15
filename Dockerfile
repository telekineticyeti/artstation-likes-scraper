FROM node:carbon
MAINTAINER paul.castle@gmail.com

RUN apt-get update && apt-get install -y git imagemagick graphicsmagick nano --no-install-recommends \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /var/src
ADD . /var/src