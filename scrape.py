from playwright.sync_api import sync_playwright, TimeoutError
import logging
import json
from colorama import init, Fore, Style

# Initialize colorama
init(autoreset=True)

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class ChiefDelphiScraper:
    def __init__(self):
        self.url = 'https://www.chiefdelphi.com/'
        self.user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"

    def scrape_posts(self):
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)  # Changed to headless
            context = browser.new_context(
                user_agent=self.user_agent,
                ignore_https_errors=True
            )
            page = context.new_page()

            logger.debug(f"Navigating to {self.url}")
            page.goto(self.url)
            page.wait_for_load_state('networkidle')

            logger.debug("Checking for topic list")
            topic_list = page.query_selector('.topic-list')
            if topic_list is None:
                logger.error("Topic list not found")
                return None

            logger.debug("Checking for topic items")
            posts = page.query_selector_all('.topic-list-item')
            if not posts:
                logger.warning("No topic items found")
                return None

            posts_data = []
            for post in posts:
                post_data = {}
                
                title_element = post.query_selector('.title')
                post_data['title'] = title_element.inner_text().strip() if title_element else "N/A"
                post_data['url'] = f"https://www.chiefdelphi.com{title_element.get_attribute('href')}" if title_element else "N/A"

                category_element = post.query_selector('.category-name')
                post_data['category'] = category_element.inner_text().strip() if category_element else "N/A"

                replies_element = post.query_selector('.posts')
                post_data['replies'] = replies_element.inner_text().strip() if replies_element else "N/A"

                views_element = post.query_selector('.views')
                post_data['views'] = views_element.inner_text().strip() if views_element else "N/A"

                activity_element = post.query_selector('.age')
                post_data['last_activity'] = activity_element.inner_text().strip() if activity_element else "N/A"

                posts_data.append(post_data)

            logger.debug("Scraping completed successfully.")
            return posts_data

    def run(self):
        try:
            posts_data = self.scrape_posts()
            if posts_data:
                return json.dumps(posts_data, indent=2)
            else:
                return json.dumps({"error": "No posts found or an error occurred"})
        except Exception as e:
            logger.error(f"An error occurred: {e}")
            return json.dumps({"error": str(e)})

if __name__ == '__main__':
    scraper = ChiefDelphiScraper()
    result = scraper.run()
    print(result)