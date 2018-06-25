const Promise = require("bluebird");
const FileSystem = require("fs");
const Mime = require("mime");
const request = Promise.promisify(require("request"));
import { Settings } from "./app-settings";

export class ArtstationScraper {
  public userName: string;

  public constructor() {
    this.userName = Settings.userName;
  }

  /**
   * Get the like count from a users profile, as well as how many total pages are
   * used required to render their like count (at 50 like items per page).
   *
   * Please note: we get the like count from the `total_count` property on the
   * `users/{user}/likes.json?page=1` endpoint, as this provides an accurate count
   * of like items.
   * The `liked_projects_count` property on the `/users/{user}.json` endpoint provides
   * an errornous value, as it does not decrement when a user removes a like.
   * @returns Promise
   */
  public getRemoteHashCount() {
    return new Promise((resolve, reject) => {
      // let uri: string = 'https://www.artstation.com/users/' + username + '.json';
      let uri: string =
        "https://www.artstation.com/users/" + Settings.userName + "/likes.json?page=1";
      request({ uri: uri, followAllRedirects: true })
        .then(response => {
          let body = JSON.parse(response.body);
          resolve({
            count: body.total_count,
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
          // Some likes occasionally return an error code
          // if they've been deleted.
          if (response.statusCode !== 200) {
            console.warn(`${id} Could not be resolved`);
            resolve(false);
          } else {
            try {
              body = JSON.parse(response.body);
            } catch(error) {
              console.log('FAILED on ', id)
              reject(error);
            }
          }

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
  public downloadAssets(data: any) {
    const total: number = data.assets.length;
    let count: number = 0;

    return data.assets.reduce((promise, asset) => {
      return promise
        .then(() => {
          count++;
          const counter = `[${count}/${total}]`;

          console.log(`DOWNLOADING ${counter}: ${asset.fileName}`);
          return resolveSingleAsset(asset).then(() => console.log(`${counter} COMPLETE!`));
        })
        .catch(console.error);
      }, Promise.resolve());

      function resolveSingleAsset(asset) {
        return new Promise((resolve, reject) => {
          request({ uri: asset.url, followAllRedirects: true, encoding: null })
            .then(response => {
              let assetType = Mime.getExtension(response.headers["content-type"]);
    
              if (assetType === "jpeg") assetType = "jpg";
    
              FileSystem.writeFile(
                Settings.downloadLocation + asset.fileName + "." + assetType,
                response.body,
                error => {
                  if (error) {
                    reject(error);
                  } else {
                    resolve();
                  }
                }
              );
            })
            .catch(console.error);
        });
      };
  }

  /**
   * Resolves all remote hash ID's for likes on the user's profile.
   * @param data Input object containing the number of likes and pages
   * @param limit Number of page resolves to limit to. Usually defined by data object.
   * @returns Promise
   */
  public resolveHashesFromPages(data: any) {
    // if (typeof limit === "undefined") {
      const limit = data.pages + 1;
      // const limit = 1;
    // }

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
        console.log(`Resolving page [${page}]`)
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
   * Get local hash count followed by a remote hash count, then
   * compares for and returns an array of symetrical differences.
   * @returns Promise
   */
  public compareHashes() {
    let localData = this.getLocalHashes();
    let remoteData = this.getRemoteHashCount();
    return Promise.all([localData, remoteData]).then(values => {
      return values;
    })
    .then(values => {
      let local = values[0];
      let remote = values[1];

      if (local.count !== remote.count) {
        return new Promise(resolve => {
          this.resolveHashesFromPages(remote)
            .then(remoteHashes => {
              // Get the symmetrical difference between local and remote hashes
              // https://stackoverflow.com/questions/1187518/how-to-get-the-difference-between-two-arrays-in-javascript
              let difference = remoteHashes
                              .filter(x => !local.hashes.includes(x))
                              .concat(local.hashes.filter(x => !remoteHashes.includes(x)));
              
              resolve({
                localHashes: local.hashes,
                remoteHashes: remoteHashes,
                difference: difference,
              });
            })
        });
      } else {
        return false;
      }
    });
  }

  /**
   * Download the assets for a like or an array of likes in series to the target directory.
   * @param hashes Array contains hash IDs
   * @returns Promise
   */
  public downloadLikes(hashes) {
    return hashes.reduce((promiseChain, hash) => {
      return promiseChain
        .then(() => {
          return this.processLike(hash)
                     .then(like => {
                        if (like) {
                          return this.downloadAssets(like)
                        } else {
                          console.log(`Skipping ${hash}`);
                        }
                      })
        })
    }, Promise.resolve());
  }

  /**
   * Retrieve hashes from local file
   * @returns Promise containing contents of hash file
   */
  public getLocalHashes() {
    let respond: any = {};

    return new Promise(resolve => {
      this.checkHashFileExists().then(
        () => {
          this.readFile(Settings.hashes)
            .then(file => {
              if (typeof file.hashes !== 'undefined') {
                respond.hashes = file.hashes;
              } else {
                respond.hashes = [];
              }
              respond.count = respond.hashes.length;
              resolve(respond);
            });
        }
      )
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

  private checkHashFileExists() {
    return new Promise((resolve, reject) => {
      FileSystem.stat(Settings.hashes, (error, stat) => {
        if (error === null) {
          resolve();
        } else if (error.code === 'ENOENT') {
          this.writeHashes([]);
          resolve();
        } else {
          console.error(error);
          reject();
        }
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
