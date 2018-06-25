# Artstation likes scraper
This software will scrape an [artstation.com](http://artstation.com) user profile and retrieve a list of their 'liked' artworks. It can also download the assets for that artwork.

## Install
```
  git clone https://github.com/telekineticyeti/artstation-likes-scraper
  cd artstation-likes-scraper
  npm install
```

## Usage
Edit `./src/app-settings.ts`, replacing userName property with desired value, as well as setting custom locations for downloads and hash file.

## The hash file
The hash file serves as a local reference for liked artworks that have already been processed.


## API Methods
---

#### getRemoteHashCount()
Retrieve the remote hash count and page count for the provided username.

#### processLike(_idhash_)
Generates a metadata object for a single liked item, including
asset paths.

#### downloadAssets()
Resolve all assets associated with a project, downloading them locally.

#### resolveHashesFromPages()
Resolves all remote hash ID's for likes on the user's profile.

#### compareHashes()
Get local hash count followed by a remote hash count, then compares for and returns an array of symetrical differences.

#### getLocalHashes()
Retrieve hashes from local file

#### downloadLikes()
Download the assets for a like or an array of likes in series to the target directory.

#### writeHashes()
Store user's hashes to a JSON file.



## TODO
---
- Work out how to save progress on very long operations
- Add methods to start/end at a specific hash id or page to ease debugging
- Strip special characters from descriptions for file names