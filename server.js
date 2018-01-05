const Promise = require('bluebird');
const request = Promise.promisify(require("request"));
const fs = require("fs");
const mime = require('mime');

var user_name = 'teleyeti';
var page_limit = 2;


function get_artstation_like_count() {
	return new Promise((resolve, reject) => {
		let uri = 'https://www.artstation.com/users/' + user_name + '.json';
		request({ uri: uri, followAllRedirects: true })
			.then(res => {
				body = JSON.parse(res.body)
				resolve({
					likes: body.liked_projects_count,
					pages: Math.ceil(body.liked_projects_count / 50)
				});
			})
			.catch(error => {
				reject(error);
			});
	});
}


function get_like_pages(page_number) {
	return new Promise((resolve, reject) => {
		if (typeof page_number === 'undefined' || !page_number) {
			page_number = 1;
		}

		let uri = 'https://www.artstation.com/users/' + user_name + '/likes.json?page=' + page_number;
		request({ uri: uri, followAllRedirects: true })
			.then(res => {
				body = JSON.parse(res.body)

				let likes_object = {
					like_data: [],
					like_count: body.data.length
				}

				for (var i = 0; i < body.data.length; i++) {
					likes_object.like_data.push(body.data[i].hash_id);
				}

				resolve(likes_object);
			})
			.catch(error => {
				reject(error);
			});
	});
}


function process_like(hash_id) {
	return new Promise((resolve, reject) => {
		let uri = 'https://www.artstation.com/projects/' + hash_id + '.json';
		request({ uri: uri, followAllRedirects: true })
			.then(res => {
				body = JSON.parse(res.body)

				let like_object = {
					assets: [],
					artist_name: body.user.full_name,
					artist_username: body.user.username,
					artwork_title: body.title,
					artwork_slug: body.slug
				}

				if (body.assets.length <= 1) {
					like_object.assets.push({
						name: like_object.artist_name + ' (' + like_object.artist_username + ') - ' + like_object.artwork_slug,
						url: body.assets[0].image_url
					});
				}

				// If the project has more than one asset, append a number to the end of the filename
				else {
					let count = 1;

					for (var i = 0; i < body.assets.length; i++) {
						if (body.assets[i].asset_type === 'image' && body.assets[i].has_image === true) {
							like_object.assets.push({
								name: like_object.artist_name + ' (' + like_object.artist_username + ') - ' + like_object.artwork_slug + ' (' + count + ')',
								url: body.assets[i].image_url
							});
							count++;
						}
					}
				}

				resolve(like_object);
			})
			.catch(error => {
				reject(error);
			});
	});
}


// 
// TODO
// 
// write latest like hash to a file for later reference
// 
function resolve_assets(data, callback) {
	Promise.each(data.assets, image => new Promise((resolve, reject) => {
		console.log('Downloading Image: ' + image.name);
		request({ uri: image.url, followAllRedirects: true, encoding: null })
			.then(response => {
				let image_extension = mime.getExtension(response.headers['content-type']);

				if (image_extension === "jpeg") {
					image_extension = "jpg";
				}

				fs.writeFile('./' + image.name + '.' + image_extension, response.body, (error) => {
					if (error) {
						reject(error);
					}
				});

				console.log('....done');

				resolve();
				return 'b';
			})
	}))
	.then(() => {
		console.log('All downloads complete');
	})
	.catch(err => {
		console.error('Failed: ' + err.message);
	});
}


var test_hashes = ['xVBXX', 'NvxQb', 'oVJOJ'];

var th = [];

for (var i = 0; i < test_hashes.length; i++) {
	th.push(process_like(test_hashes[i]).then(data => {
		console.log('[ PROCESSING: ' + test_hashes[i] + ' ]');
		resolve_assets(data);
	}));
}

// process_like('xVBXX').then(data => { resolve_assets(data); });

// for (var i = 0; i < test_hashes.length; i++) {
// 	th.push(process_like(test_hashes[i]).then(data => {
// 		console.log('[ PROCESSING: ' + test_hashes[i] + ' ]');
// 		resolve_assets(data);
// 	}));
// }

// Promise.all(th).then(function() {
//     console.log("all the files were created");
// });

return th.reduce((current, next) => {
	return current.then(next);
}, Promise.resolve().then(() => {
	console.log("all the files were created");
}))