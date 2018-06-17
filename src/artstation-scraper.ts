const Promise = require("bluebird");
const FileSystem = require("fs");
const Mime = require("mime");
const request = Promise.promisify(require("request"));
import { Settings } from "./app-settings";

export class ArtstationScraper {
  /**
   * Get the like count from a users profile, as well as how many total pages are
   * used required to render their like count (at 50 like items per page).
   *
   * Please note: we get the like count from the `total_count` property on the
   * `users/{user}/likes.json?page=1` endpoint, as this provides an accurate count
   * of like items.
   * The `liked_projects_count` property on the `/users/{user}.json` endpoint provides
   * an errornous value, as it does not decrement when a user removes a like.
   * @param username Artstation username
   * @returns Promise
   */
  public getLikeCount(username) {
    return new Promise((resolve, reject) => {
      // let uri: string = 'https://www.artstation.com/users/' + username + '.json';
      let uri: string =
        "https://www.artstation.com/users/" + username + "/likes.json?page=1";
      request({ uri: uri, followAllRedirects: true })
        .then(response => {
          let body = JSON.parse(response.body);
          resolve({
            likes: body.total_count,
            pages: Math.ceil(body.total_count / 50)
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
   * @returns Promise
   */
  public processLike(id: string) {
    let like: LikeObject;
    return new Promise((resolve, reject) => {
      let uri = "https://www.artstation.com/projects/" + id + ".json";
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
          };

          if (body.assets.length <= 1) {
            like.assets.push({
              fileName:
                like.artistName +
                " (" +
                like.artistUserName +
                ") - " +
                like.slug,
              url: body.assets[0].image_url
            });
          } else {
            let count = 1;

            for (var index = 0; index < body.assets.length; index++) {
              if (
                body.assets[index].asset_type === "image" &&
                body.assets[index].has_image === true
              ) {
                like.assets.push({
                  fileName:
                    like.artistName +
                    " (" +
                    like.artistUserName +
                    ") - " +
                    like.slug +
                    " (" +
                    count +
                    ")",
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

  /**
   * Resolve all assets associated with a project
   * @param data Object containing metadata and asset details
   * @param callback Optional - callback to fire when all assets are retrieved (TODO)
   * @returns Promise
   */
  public resolveAssets(data: any, callback?: any) {
    return new Promise((resolve, reject) => {
      Promise.all(data.assets.map(this.downloadAsset)).then(() => {
        console.log("All files downloaded");
      });
    });
  }

  /**
   * Download a single asset
   * @param asset Asset object containing name and URL data
   * @returns Promise
   */
  private downloadAsset(asset: Asset) {
    return new Promise((resolve, reject) => {
      console.log("Downloading Asset:", asset.fileName);
      request({ uri: asset.url, followAllRedirects: true, encoding: null })
        .then(response => {
          let assetType = Mime.getExtension(response.headers["content-type"]);

          if (assetType === "jpeg") {
            assetType = "jpg";
          }

          FileSystem.writeFile(
            Settings.downloadLocation + asset.fileName + "." + assetType,
            response.body,
            error => {
              if (error) {
                reject(error);
              } else {
                console.log("Download Complete:", asset.fileName);
                resolve();
              }
            }
          );
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  /**
   *
   * @param data Input object containing the number of likes and pages
   * @param limit Number of page resolves to limit to. Usually defined by data object.
   * @returns Promise
   */
  public resolveHashes(data: any, limit: number) {
    if (typeof limit === "undefined") {
      limit = data.pages + 1;
    }

    return new Promise((resolve, reject) => {
      let uri: string =
        "https://www.artstation.com/users/" +
        Settings.userName +
        "/likes.json?page=";
      let pages: Array<string> = []; // Contains endpoint URL's for all pages
      var hashes: Array<{ any }> = []; // Contains hashes scraped from all pages

      for (var index = 1; index < limit; index++) {
        pages.push(uri + index);
      }

      let queue = Promise.each(pages, getHashesFromPage); // Iterate each page and get hashes

      queue.then(() => {
        resolve(hashes);
      });

      function getHashesFromPage(page) {
        return new Promise((resolve, reject) => {
          request({ uri: page, followAllRedirects: true, encoding: null })
            .then(response => {
              let body = JSON.parse(response.body);
              for (var index = 0; index < body.data.length; index++) {
                hashes.push(body.data[index].hash_id);
              }
              resolve();
            })
            .catch(error => {
              reject(error);
            });
        });
      }
    });
  }

  /**
   * Store user's hashes to a JSON file.
   * @param hashes
   */
  public writeHashes(hashes) {
    return new Promise((resolve, reject) => {
      let json: string = JSON.stringify({
        lastCount: hashes.length,
        hashes: hashes
      });

      FileSystem.writeFile(Settings.hashes, json, "utf8", error => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  private getLocalCount(status) {
    return new Promise((resolve, reject) => {
      if (status) {
        this.readFile(Settings.hashes).then(file => {
          resolve(file.lastCount);
        });
      } else {
        resolve(0);
      }
    });
  }

  /**
   * Operation performs a hash check for likes using the following process:
   * Check if local hash file exists
   *
   * @returns Promise
   */
  public checkHashChanges() {
    return new Promise(resolve => {
      let checkFilePromise = this.checkFileExists(Settings.hashes);
      let localCountPromise = checkFilePromise.then(
        this.getLocalCount.bind(this)
      );
      let remoteCountPromise = this.getLikeCount(Settings.userName);

      Promise.all([
        checkFilePromise,
        localCountPromise,
        remoteCountPromise
      ]).then(([fileCheck, localCount, remoteCount]) => {
        if (localCount !== remoteCount.likes) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }

  private checkFileExists(path) {
    return new Promise((resolve, reject) => {
      FileSystem.exists(path, function(exists) {
        resolve(exists);
      });
    });
  }

  private readFile(path) {
    return new Promise((resolve, reject) => {
      FileSystem.readFile(path, "utf8", (error, data) => {
        if (error) {
          reject(error);
        } else {
          resolve(JSON.parse(data));
        }
      });
    });
  }
}

export interface LikeObject {
  title: string;
  slug: string;
  url: string;
  description?: string;
  artistName: string;
  artistUserName: string;
  assets: Array<Asset>;
}

export interface Asset {
  url: string;
  fileName: string;
  type?: string;
}
