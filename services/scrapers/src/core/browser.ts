import { chromium, type Browser } from "playwright";

export async function createBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: true,
    args: ["--disable-dev-shm-usage", "--no-sandbox"]
  });
}
