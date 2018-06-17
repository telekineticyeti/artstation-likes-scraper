import { Settings } from "./app-settings";
import { ArtstationScraper } from "./artstation-scraper";
const scraper = new ArtstationScraper;

scraper.checkHashChanges()
  .then(hashChanged => {
    if (hashChanged) {
      console.log('Updating hashfile with remote likes')
      return scraper.getLikeCount(Settings.userName).then(scraper.resolveHashes);
    } else {
      console.log('No remote changes detected.')
      // return false;
    }
  }).then(
    results => {
      console.log(results)
      return scraper.writeHashes(results);
    }
  );


