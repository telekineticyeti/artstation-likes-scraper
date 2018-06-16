import { ArtstationScraper } from "./artstation-scraper"
const scraper = new ArtstationScraper;

const username:string = "teleyeti";

// scraper.getLikeCount(username).then(response => {
//   console.log(response)
// });
// var test_hashes = ['xVBXX', 'NvxQb', 'oVJOJ'];

scraper.downloadLike('59YYw').then(response => {
  console.log(response)
});
