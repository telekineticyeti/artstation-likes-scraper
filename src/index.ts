import { ArtstationScraper } from "./artstation-scraper";
const scraper = new ArtstationScraper();

scraper.compareHashes().then(comparison => {
  if (comparison !== false) {
    let hashesCombined = comparison.difference.concat(comparison.localHashes);
    scraper
      .downloadLikes(comparison.difference)
      .then(scraper.writeHashes(hashesCombined));
  } else {
    console.log('No changes detected');
  }
});