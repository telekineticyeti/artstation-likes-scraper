FROM node:carbon-alpine
MAINTAINER paul@mindres.in

RUN apk add --no-cache --update \
	imagemagick \
	graphicsmagick

ADD package.json /tmp/package.json
RUN cd /tmp && npm install
RUN mkdir -p /usr/app && cp -a /tmp/node_modules /usr/app/

WORKDIR /usr/app
ADD . /usr/app

CMD ["npm", "start"]
