const Promise = require('bluebird');
const fs = require("fs");
const Mime = require('mime');
const request = Promise.promisify(require("request"));

export class ArtstationScraper {
  /**
   * Get the like count from a users profile, as well as how many pages are required
   * for their like count (50 likes per page).
   * @param username Artstation username
   * @returns Promise with data object
   */
  public getLikeCount(username) {
    return new Promise((resolve, reject) => {
      let uri: string = 'https://www.artstation.com/users/' + username + '.json';
      let body: any;
      request({ uri: uri, followAllRedirects: true })
        .then(response => {
          let body = JSON.parse(response.body)
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

  /**
   * Creates an object that contains all assets and associated metadata for 
   * a liked project.
   * @param id The ID hash of the like to download
   * @returns Promise with data object
   */
  public downloadLike(id: string) {
    let like: LikeObject;
    return new Promise((resolve, reject) => {
      let uri = 'https://www.artstation.com/projects/' + id + '.json';
      let body: any;
      request({ uri: uri, followAllRedirects: true })
        .then(response => {
          body = JSON.parse(response.body);

          like = {
            title: body.user.full_name,
            slug: body.slug,
            url: body.permalink,
            artistName: body.user.full_name,
            artistUserName: body.user.username,
            assets: []
          }

          if (body.assets.length <= 1) {
            like.assets.push({
              fileName: like.artistName + ' (' + like.artistUserName + ') - ' + like.slug,
              url: body.assets[0].image_url
            });
          }
          else {
            let count = 1;
  
            for (var index = 0; index < body.assets.length; index++) {
              if (body.assets[index].asset_type === 'image' && body.assets[index].has_image === true) {
                like.assets.push({
                  fileName: like.artistName + ' (' + like.artistUserName + ') - ' + like.slug + ' (' + count + ')',
                  url: body.assets[index].image_url
                });
                count++;
              }
            }
          }
          resolve(like);
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  public resolveAssets(data: any, callback: any) {
    return new Promise((resolve, reject) => {
  
      let imageDownload = [];
  
      for (var index = 0; index < data.assets; index++) {
  
      }
  
    });
  }
}

export interface LikeObject {
  title: string,
  slug: string,
  url: string,
  description?: string,
  artistName: string,
  artistUserName: string,
  assets: Array<{
    url: string,
    fileName: string,
    type?: string
  }>
}