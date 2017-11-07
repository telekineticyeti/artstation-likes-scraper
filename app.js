const https = require("https");
const request = require('request');
const fs = require('fs');
var user_name = "";
var likes_file_location = "artsation_likes.json";

var page_limit = 2;

/**
 * The initiator
 * Scrapes the first like page to determine the 'total page count' value.
 */
(function() {
	let url = "https://www.artstation.com/users/" + user_name + "/likes.json?page=1";
	https
		.get(url, response => {
			response.setEncoding("utf8");
			let body = "";
			response.on("data", data => {
				body += data;
			});
			response.on("end", () => {
				body = JSON.parse(body);
 				let total_count = body.total_count;
 				let total_pages = Math.ceil(total_count / 50);

 				console.log(
 					`Artstation User ${user_name}: -`,
					`Like Count: ${total_count} -`,
					`Page Count: ${total_pages}`
				);

 				get_pages(total_pages, 1);
			});
		})
		.on('error', function(error){
			process.exit(1)
		});
})();


/**
 * Get the selected page's JSON (1 if not specified) and iterates over itself
 * until all remaining pages have been processed.
 * @param  {[int]} total_page_count   The total amount of pages to process
 * @param  {[int]} current_page       The current page to process
 * @return {[string]}                 JSON formatted string of page results
 */

function get_pages(total_page_count, current_page, likes_from_site) {
	if (typeof current_page === 'undefined' || !current_page) {
		current_page = 1;
	}
	if (!typeof likes_from_site === 'undefined' || !likes_from_site) {
		likes_from_site = [];
	}
	let url = "https://www.artstation.com/users/" + user_name + "/likes.json?page=" + current_page;

	https
		.get(url, response => {
			response.setEncoding("utf8");
			let body = "";
			response.on("data", data => {
				body += data;
			});
			response.on("end", () => {
				body = JSON.parse(body);

				for (var i = 0; i < body.data.length; i++) {
					likes_from_site.push(body.data[i]['hash_id']);
				}

				if (!typeof page_limit === 'undefined' || page_limit) {
					if (current_page < page_limit) {
						get_pages(total_page_count, (current_page + 1), likes_from_site);
						console.log('Processing page ' + current_page + '/' + (current_page + 1) + " (Limit: " + page_limit + " pages)");
					} else {
						console.log('Total: ' + likes_from_site.length);
						check_likes_file(likes_from_site);
					}	
				} else {
					if (current_page < total_page_count) {
						get_pages(total_page_count, (current_page + 1), likes_from_site);
						console.log('Processing page ' + current_page + '/' + (current_page + 1));
					} else {
						console.log('Total Artstation Likes Found: ' + likes_from_site.length);
						check_likes_file(likes_from_site);
					}
				}
			});
		})
}


/**
 * Creates or Loads a file consisting of likes that have been processed.
 */
function check_likes_file(likes_from_site) {
	let unprocessed_likes = [];
	let likes_file_object = { likes: [] };

	fs.exists(likes_file_location, function(exists) {
		if (exists) {
			fs.readFile(likes_file_location, function readFileCallback(error, data) {
				likes_file_object = JSON.parse(data);

				for (let i = 1; i < likes_from_site.length; i++) {
					if ( (likes_file_object['likes'].indexOf(likes_from_site[i])) === -1 ) {
						unprocessed_likes.push(likes_from_site[i]);
						console.log("Adding " + likes_from_site[i]);
					}
				}

				if (unprocessed_likes.length) {
					process_new_likes(unprocessed_likes, likes_file_object);
				} else {
					console.log('No new changes, closing file and exiting');
					process.exit(1);
				}
			});
		} else {
			unprocessed_likes = likes_from_site;
			process_new_likes(unprocessed_likes, likes_file_object);
		}
	});
}


/**
 * [process_new_likes description]
 * @param  {[type]} new_likes_from_site [description]
 * @return {[type]}                 [description]
 */
function process_new_likes(new_likes_from_site, likes_file_object) {
	if (!new_likes_from_site.length) {
		console.log('Nothing left to process.');
		write_likes_file(likes_file_object);
	} else {
		let project_url = "https://www.artstation.com/projects/" + new_likes_from_site[0] + ".json";
		console.log('PROCESSING: ' + new_likes_from_site[0]);
		https.get(project_url, response => {
			response.setEncoding("utf8");
			let body = "";
			response.on("data", data => {
				body += data;
			});
			response.on("end", () => {
				body = JSON.parse(body);


				for (var i = 0; i < body.assets.length; i++) {
					let asset_url = body.assets[i].image_url;
					let author_name = body.user.username;
					let asset_title = body.title;
					let asset_file_name = "images/" + author_name + " - " + asset_url.match(/[^/\\&\?]+\.\w{3,4}(?=([\?&].*$|$))/)[0];

					let current_asset = i;
					let asset_total = body.assets.length;

					request.head(asset_url, function(error, response, body) {
						request(asset_url)
							.pipe(fs.createWriteStream(asset_file_name))
							.on('close', function() {
								if (current_asset >= asset_total) {
									console.log('Adding ' + new_likes_from_site[0] + " to likes file object and removing it from process queue");
									likes_file_object.likes.push(new_likes_from_site[0])
									new_likes_from_site.splice(0, 1);
									process_new_likes(new_likes_from_site, likes_file_object);
								}
							}).on('end', function() { console.log('sdfsdf'); });
					});
					// NOTE
					// App downloads image of first ID but exits.

					// https.request(asset_url, response => {
					// 	let image_data = new Stream();

					// 	response.on("data", function (chunk) {
					// 		image_data.push(chunk);
					// 	});

					// 	response.on("end", () => {
					// 		fs.writeFile("images/" + asset_file_name, image_data.read(), (error) => {
					// 			if (error) {
					// 				console.log('Could not write the asset file');
					// 				process.exit(1);
					// 			} else {
					// 				console.log('Image File Written');
					// 				if (i >= body.assets.length) {
					// 					console.log('Adding ' + new_likes_from_site[0] + " to likes file object and removing it from process queue");
					// 					likes_file_object.likes.push(new_likes_from_site[0])
					// 					new_likes_from_site.splice(0, 1);
					// 					process_new_likes(new_likes_from_site, likes_file_object);
					// 				}
					// 			}
					// 		});
								
					// 		// fs.writeFile("images/" + asset_file_name, image_body, (error) => {
					// 		// });

					// 	});
					// });

				} // for
			});
		});
	}
}


/**
 * JSONify the provided likes object and write it to the file
 * @param  {[object]}     likes_to_write     Object containing likes
 */
function write_likes_file(likes_to_write) {
	let json = JSON.stringify(likes_to_write);
	fs.writeFile(likes_file_location, json, (error) => {
		if (error) {
			console.log('Could not write the file');
			process.exit(1);
		} else {
			console.log('File Written');
			process.exit(0)
		}
	});
}